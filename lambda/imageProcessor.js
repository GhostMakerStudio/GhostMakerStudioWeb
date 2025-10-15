// AWS Lambda Function - Image Processing
// Triggered automatically when images are uploaded to S3
// Generates thumbnails and multiple quality/format versions

const AWS = require('aws-sdk');
const sharp = require('sharp');
const path = require('path');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';
const BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd17lfecj9hzae.cloudfront.net';

exports.handler = async (event) => {
  console.log('🖼️ Image processor triggered');
  
  try {
    // Get S3 object info from event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing image: ${key}`);
    
    // Skip if this is already a processed file (thumb.jpg, quality files, etc.)
    if (key.includes('/thumb.jpg') || 
        key.includes('/320w.') || 
        key.includes('/640w.') || 
        key.includes('/960w.') ||
        key.includes('/1280w.') ||
        key.includes('/1920w.') ||
        key.includes('/blur_placeholder.')) {
      console.log('⏭️ Skipping already processed file');
      return { statusCode: 200, body: 'Skipped processed file' };
    }
    
    // Extract project info from key path
    // Format: projects/{projectId}/media/{mediaId}/{filename}
    const pathParts = key.split('/');
    if (pathParts.length < 4 || pathParts[0] !== 'projects') {
      console.log('⏭️ Not a project media file, skipping');
      return { statusCode: 200, body: 'Not a project media file' };
    }
    
    const projectId = pathParts[1];
    const mediaId = pathParts[3];
    const mediaFolder = `projects/${projectId}/media/${mediaId}`;
    
    console.log(`Project: ${projectId}, Media: ${mediaId}`);
    
    // Download original image from S3
    const originalImage = await s3.getObject({
      Bucket: bucket,
      Key: key
    }).promise();
    
    console.log(`Downloaded original image (${originalImage.ContentLength} bytes)`);
    
    // Update DynamoDB to mark processing started
    await updateProcessingStatus(mediaId, projectId, 'processing');
    
    const imageQualities = [];
    
    // Step 1: Generate thumbnail (300x300)
    console.log('📸 Generating thumbnail...');
    const thumbnail = await sharp(originalImage.Body)
      .resize(300, 300, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const thumbnailKey = `${mediaFolder}/thumb.jpg`;
    await s3.putObject({
      Bucket: bucket,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise();
    
    const thumbnailUrl = `https://${CLOUDFRONT_DOMAIN}/${thumbnailKey}`;
    console.log(`✅ Thumbnail uploaded: ${thumbnailUrl}`);
    
    // Step 2: Generate multiple quality versions
    const qualities = [
      { name: 'blur_placeholder', width: 320, height: 320, quality: 20, resolution: 'BLURRY' },
      { name: '320w', width: 320, height: 320, quality: 75, resolution: '320w' },
      { name: '640w', width: 640, height: 640, quality: 80, resolution: '640w' },
      { name: '960w', width: 960, height: 960, quality: 85, resolution: '960w' },
      { name: '1280w', width: 1280, height: 1280, quality: 90, resolution: '1280w' },
      { name: '1920w', width: 1920, height: 1920, quality: 95, resolution: '1920w' }
    ];
    
    for (const quality of qualities) {
      console.log(`🖼️ Generating ${quality.name}...`);
      
      // For blur_placeholder, only generate JPEG
      if (quality.name === 'blur_placeholder') {
        const blurImage = await sharp(originalImage.Body)
          .resize(quality.width, quality.height, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: quality.quality })
          .toBuffer();
        
        const blurKey = `${mediaFolder}/${quality.name}.jpg`;
        await s3.putObject({
          Bucket: bucket,
          Key: blurKey,
          Body: blurImage,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable'
        }).promise();
        
        imageQualities.push({
          quality: quality.name,
          url: `https://${CLOUDFRONT_DOMAIN}/${blurKey}`,
          width: quality.width,
          height: quality.height,
          resolution: quality.resolution,
          formats: {
            jpg: `https://${CLOUDFRONT_DOMAIN}/${blurKey}`
          }
        });
        
        continue;
      }
      
      // Generate multiple formats (JPEG, WebP, AVIF/HEIF)
      const formats = [
        { ext: 'jpg', contentType: 'image/jpeg' },
        { ext: 'webp', contentType: 'image/webp' }
      ];
      
      const qualityFormats = {};
      
      for (const format of formats) {
        let processedImage;
        
        if (format.ext === 'jpg') {
          processedImage = await sharp(originalImage.Body)
            .resize(quality.width, quality.height, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .toColorspace('srgb')
            .jpeg({ quality: quality.quality, progressive: true })
            .toBuffer();
        } else if (format.ext === 'webp') {
          processedImage = await sharp(originalImage.Body)
            .resize(quality.width, quality.height, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .toColorspace('srgb')
            .webp({ quality: Math.max(70, quality.quality - 15) })
            .toBuffer();
        }
        
        const qualityKey = `${mediaFolder}/${quality.name}.${format.ext}`;
        await s3.putObject({
          Bucket: bucket,
          Key: qualityKey,
          Body: processedImage,
          ContentType: format.contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        }).promise();
        
        qualityFormats[format.ext] = `https://${CLOUDFRONT_DOMAIN}/${qualityKey}`;
        console.log(`  ✅ Uploaded ${quality.name}.${format.ext}`);
      }
      
      imageQualities.push({
        quality: quality.name,
        url: qualityFormats.jpg,
        width: quality.width,
        height: quality.height,
        resolution: quality.resolution,
        formats: qualityFormats
      });
    }
    
    console.log(`✅ Generated ${imageQualities.length} quality versions`);
    
    // Update DynamoDB with processing results
    await dynamodb.update({
      TableName: MEDIA_TABLE,
      Key: { 
        id: mediaId,
        projectId: projectId
      },
      UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl, imageQualities = :imageQualities, processingStatus = :status, urls.thumbnail = :thumbnailUrl, processedAt = :processedAt',
      ExpressionAttributeValues: {
        ':thumbnailUrl': thumbnailUrl,
        ':imageQualities': imageQualities,
        ':status': 'completed',
        ':processedAt': new Date().toISOString()
      }
    }).promise();
    
    console.log('✅ Updated DynamoDB with processing results');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Image processed successfully',
        mediaId: mediaId,
        thumbnailUrl: thumbnailUrl,
        qualities: imageQualities.length
      })
    };
    
  } catch (error) {
    console.error('❌ Image processing failed:', error);
    
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

