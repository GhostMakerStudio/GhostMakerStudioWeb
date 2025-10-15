// AWS Lambda Function - Video Processing
// Triggered automatically when videos are uploaded to S3
// Generates thumbnails, HLS streaming, and downloadable versions

const AWS = require('aws-sdk');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';
const BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd17lfecj9hzae.cloudfront.net';

// Lambda temp directory
const TMP_DIR = '/tmp';

exports.handler = async (event) => {
  console.log('🎬 Video processor triggered');
  
  try {
    // Get S3 object info from event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing video: ${key}`);
    
    // Skip if this is already a processed file
    if (key.includes('/hls/') || 
        key.includes('/downloads/') || 
        key.includes('/thumb.jpg')) {
      console.log('⏭️ Skipping already processed file');
      return { statusCode: 200, body: 'Skipped processed file' };
    }
    
    // Extract project info from key path
    const pathParts = key.split('/');
    if (pathParts.length < 4 || pathParts[0] !== 'projects') {
      console.log('⏭️ Not a project media file, skipping');
      return { statusCode: 200, body: 'Not a project media file' };
    }
    
    const projectId = pathParts[1];
    const mediaId = pathParts[3];
    const mediaFolder = `projects/${projectId}/media/${mediaId}`;
    const fileName = pathParts[pathParts.length - 1];
    const fileExtension = path.extname(fileName);
    
    console.log(`Project: ${projectId}, Media: ${mediaId}`);
    
    // Update DynamoDB to mark processing started
    await updateProcessingStatus(mediaId, projectId, 'processing');
    
    // Download original video to /tmp
    const videoPath = path.join(TMP_DIR, `${mediaId}_original${fileExtension}`);
    console.log(`Downloading video to ${videoPath}...`);
    
    const videoData = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    fs.writeFileSync(videoPath, videoData.Body);
    console.log(`✅ Downloaded video (${videoData.ContentLength} bytes)`);
    
    // Step 1: Generate video thumbnail
    console.log('📸 Generating video thumbnail...');
    const thumbnailPath = path.join(TMP_DIR, `${mediaId}_thumb.jpg`);
    await generateVideoThumbnail(videoPath, thumbnailPath);
    
    // Upload thumbnail to S3
    const thumbnailKey = `${mediaFolder}/thumb.jpg`;
    await s3.putObject({
      Bucket: bucket,
      Key: thumbnailKey,
      Body: fs.readFileSync(thumbnailPath),
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise();
    
    const thumbnailUrl = `https://${CLOUDFRONT_DOMAIN}/${thumbnailKey}`;
    console.log(`✅ Thumbnail uploaded: ${thumbnailUrl}`);
    
    // Step 2: Generate HLS adaptive streaming
    console.log('📺 Generating HLS adaptive streaming...');
    const hlsDir = path.join(TMP_DIR, `${mediaId}_hls`);
    fs.mkdirSync(hlsDir, { recursive: true });
    
    const renditions = [
      { label: '480p', width: 360, height: 640, bitrate: '1000k', maxrate: '1200k', bufsize: '2000k' },
      { label: '720p', width: 540, height: 960, bitrate: '2500k', maxrate: '3000k', bufsize: '5000k' },
      { label: '1080p', width: 720, height: 1280, bitrate: '5000k', maxrate: '6000k', bufsize: '10000k' }
    ];
    
    const videoQualities = [];
    
    for (const rendition of renditions) {
      console.log(`  🎬 Generating ${rendition.label} HLS...`);
      const qualityDir = path.join(hlsDir, rendition.label);
      fs.mkdirSync(qualityDir, { recursive: true });
      
      await generateHLSQuality(videoPath, qualityDir, rendition);
      
      // Upload HLS files to S3
      const files = fs.readdirSync(qualityDir);
      for (const file of files) {
        const filePath = path.join(qualityDir, file);
        const s3Key = `${mediaFolder}/hls/${rendition.label}/${file}`;
        
        let contentType = 'video/iso.segment';
        if (file.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
        if (file.endsWith('.mp4')) contentType = 'video/mp4';
        
        await s3.putObject({
          Bucket: bucket,
          Key: s3Key,
          Body: fs.readFileSync(filePath),
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        }).promise();
      }
      
      videoQualities.push({
        quality: rendition.label,
        url: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/${rendition.label}/${rendition.label}.m3u8`,
        width: rendition.width,
        height: rendition.height,
        bitrate: rendition.bitrate,
        resolution: rendition.label,
        isHLS: true
      });
      
      console.log(`  ✅ Uploaded ${rendition.label} HLS to S3`);
    }
    
    // Generate master playlist
    const masterPlaylist = generateMasterPlaylist(renditions);
    await s3.putObject({
      Bucket: bucket,
      Key: `${mediaFolder}/hls/master.m3u8`,
      Body: masterPlaylist,
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise();
    
    console.log('✅ Uploaded HLS master playlist');
    
    // Step 3: Generate downloadable MP4 (1080p)
    console.log('📥 Generating downloadable 1080p MP4...');
    const download1080Path = path.join(TMP_DIR, `${mediaId}_1080p.mp4`);
    await generateDownloadableMP4(videoPath, download1080Path, 1920, 1080, '5000k');
    
    // Upload to S3
    const download1080Key = `${mediaFolder}/downloads/1080p.mp4`;
    await s3.putObject({
      Bucket: bucket,
      Key: download1080Key,
      Body: fs.readFileSync(download1080Path),
      ContentType: 'video/mp4',
      ContentDisposition: 'attachment; filename="1080p.mp4"',
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise();
    
    console.log('✅ Uploaded 1080p download version');
    
    // Upload original as download option
    const originalDownloadKey = `${mediaFolder}/downloads/original${fileExtension}`;
    await s3.putObject({
      Bucket: bucket,
      Key: originalDownloadKey,
      Body: videoData.Body,
      ContentType: 'video/mp4',
      ContentDisposition: `attachment; filename="original${fileExtension}"`,
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise();
    
    console.log('✅ Uploaded original as download option');
    
    const downloadableVersions = [
      {
        quality: '1080p',
        url: `https://${CLOUDFRONT_DOMAIN}/${download1080Key}`,
        resolution: '1080p',
        type: 'download'
      },
      {
        quality: 'original',
        url: `https://${CLOUDFRONT_DOMAIN}/${originalDownloadKey}`,
        resolution: 'Original Quality',
        type: 'download'
      }
    ];
    
    videoQualities.downloadableVersions = downloadableVersions;
    
    // Update DynamoDB with processing results
    await dynamodb.update({
      TableName: MEDIA_TABLE,
      Key: { 
        id: mediaId,
        projectId: projectId
      },
      UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl, videoQualities = :videoQualities, processingStatus = :status, urls.thumbnail = :thumbnailUrl, urls.hls = :hlsUrl, processedAt = :processedAt',
      ExpressionAttributeValues: {
        ':thumbnailUrl': thumbnailUrl,
        ':videoQualities': videoQualities,
        ':status': 'completed',
        ':hlsUrl': `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master.m3u8`,
        ':processedAt': new Date().toISOString()
      }
    }).promise();
    
    console.log('✅ Updated DynamoDB with processing results');
    
    // Cleanup temp files
    console.log('🧹 Cleaning up temp files...');
    fs.unlinkSync(videoPath);
    fs.unlinkSync(thumbnailPath);
    fs.unlinkSync(download1080Path);
    fs.rmSync(hlsDir, { recursive: true, force: true });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Video processed successfully',
        mediaId: mediaId,
        thumbnailUrl: thumbnailUrl,
        hlsUrl: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master.m3u8`
      })
    };
    
  } catch (error) {
    console.error('❌ Video processing failed:', error);
    
    // Try to update DynamoDB with error status
    try {
      const key = event.Records[0].s3.object.key;
      const pathParts = key.split('/');
      if (pathParts.length >= 4) {
        const projectId = pathParts[1];
        const mediaId = pathParts[3];
        await updateProcessingStatus(mediaId, projectId, 'failed', error.message);
      }
    } catch (dbError) {
      console.error('Failed to update error status:', dbError);
    }
    
    throw error;
  }
};

// Helper: Generate video thumbnail using ffmpeg
function generateVideoThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01.000',
      '-vframes', '1',
      '-vf', 'scale=300:300:force_original_aspect_ratio=decrease',
      '-y',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    
    ffmpeg.on('error', reject);
  });
}

// Helper: Generate HLS quality variant
function generateHLSQuality(videoPath, outputDir, rendition) {
  return new Promise((resolve, reject) => {
    const playlistPath = path.join(outputDir, `${rendition.label}.m3u8`);
    const segmentPattern = path.join(outputDir, 'seg_%04d.m4s');
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-y',
      '-r', '30',
      '-g', '60',
      '-keyint_min', '60',
      '-sc_threshold', '0',
      '-c:v', 'h264',
      '-profile:v', 'high',
      '-vf', `scale=${rendition.width}:${rendition.height}`,
      '-b:v', rendition.bitrate,
      '-maxrate', rendition.maxrate,
      '-bufsize', rendition.bufsize,
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-ar', '48000',
      '-ac', '2',
      '-hls_time', '2',
      '-hls_flags', 'independent_segments',
      '-hls_segment_type', 'fmp4',
      '-hls_playlist_type', 'vod',
      '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_segment_filename', segmentPattern,
      '-hls_list_size', '0',
      '-f', 'hls',
      playlistPath
    ]);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`  [ffmpeg] ${data.toString().trim()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    
    ffmpeg.on('error', reject);
  });
}

// Helper: Generate downloadable MP4
function generateDownloadableMP4(videoPath, outputPath, width, height, bitrate) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      '-c:v', 'h264',
      '-b:v', bitrate,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-preset', 'medium',
      '-crf', '20',
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-y',
      outputPath
    ]);
    
    ffmpeg.stderr.on('data', (data) => {
      console.log(`  [ffmpeg] ${data.toString().trim()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    
    ffmpeg.on('error', reject);
  });
}

// Helper: Generate master playlist
function generateMasterPlaylist(renditions) {
  let content = '#EXTM3U\n#EXT-X-VERSION:7\n\n';
  
  renditions.forEach(rendition => {
    const bandwidth = parseInt(rendition.maxrate.replace('k', '')) * 1000;
    const avgBandwidth = parseInt(rendition.bitrate.replace('k', '')) * 1000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${avgBandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.640029,mp4a.40.2"\n`;
    content += `${rendition.label}/${rendition.label}.m3u8\n\n`;
  });
  
  return content;
}

// Helper: Update processing status
async function updateProcessingStatus(mediaId, projectId, status, errorMessage = null) {
  const updateParams = {
    TableName: MEDIA_TABLE,
    Key: { 
      id: mediaId,
      projectId: projectId
    },
    UpdateExpression: 'SET processingStatus = :status',
    ExpressionAttributeValues: {
      ':status': status
    }
  };
  
  if (errorMessage) {
    updateParams.UpdateExpression += ', processingError = :error';
    updateParams.ExpressionAttributeValues[':error'] = errorMessage;
  }
  
  await dynamodb.update(updateParams).promise();
}

