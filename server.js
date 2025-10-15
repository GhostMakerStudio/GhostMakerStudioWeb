// Simple Express server for GhostMaker Studio Stripe payments
// Handles real Stripe PaymentIntent creation with secret key

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch');

// Set FFmpeg path for Windows
ffmpeg.setFfmpegPath(`${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0-full_build\\bin\\ffmpeg.exe`);
require('dotenv').config();

// 🖼️ ENTERPRISE MEDIA PIPELINE v3 (Simple Deployment)
console.log('🚀 ENTERPRISE MEDIA PIPELINE v3 (Simple Deployment)');
console.log('Sharp formats:', sharp.format);
console.log('WebP support:', sharp.format.webp ? '✅ YES' : '❌ NO');
console.log('AVIF support:', sharp.format.avif ? '✅ YES' : '❌ NO');

// Initialize Stripe with your secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

// Thumbnail generation function
async function generateThumbnail(inputPath, outputPath, size = 300) {
  try {
    await sharp(inputPath)
      .resize(size, size, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('❌ Thumbnail generation failed:', error);
    return false;
  }
}

// Video thumbnail generation function
async function generateVideoThumbnail(videoPath, thumbnailPath, size = 300) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput('00:00:01.000') // Seek to 1 second
      .frames(1) // Extract 1 frame
      .size(`${size}x${size}`)
      .output(thumbnailPath)
      .on('end', () => {
        console.log('✅ Video thumbnail generated:', thumbnailPath);
        resolve(true);
      })
      .on('error', (error) => {
        console.error('❌ Video thumbnail generation failed:', error);
        resolve(false);
      })
      .run();
  });
}

// HLS adaptive streaming processing function
async function generateHLSAdaptiveStreaming(videoPath, outputDir) {
  const fs = require('fs');
  const path = require('path');
  
  // Remove file extension from outputDir to get base directory
  const baseDir = outputDir.replace(/\.[^/.]+$/, "");
  const hlsDir = `${baseDir}_hls`;
  
  // Create HLS directory structure
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  // Rendition ladder - optimized for portrait videos (1080x1920)
  const renditions = [
    { label: '480p', width: 360, height: 640, bitrate: '1000k', maxrate: '1200k', bufsize: '2000k' },
    { label: '720p', width: 540, height: 960, bitrate: '2500k', maxrate: '3000k', bufsize: '5000k' },
    { label: '1080p', width: 720, height: 1280, bitrate: '5000k', maxrate: '6000k', bufsize: '10000k' }
  ];

  const generatedQualities = [];

  // Helper function to convert Windows paths to absolute POSIX for ffmpeg
  function toFfmpegPath(p) {
    const abs = path.resolve(p);   // Make absolute (adds drive letter)
    return abs.replace(/\\/g, '/'); // ffmpeg-friendly slashes
  }

  // Build each variant separately so it's easy to debug
  for (const rendition of renditions) {
    try {
      const qualityDir = path.join(hlsDir, rendition.label);
      fs.mkdirSync(qualityDir, { recursive: true });

      const toFfmpegPath = p => path.resolve(p).replace(/\\/g, '/');

          const vPlaylist = toFfmpegPath(path.join(qualityDir, `${rendition.label}.m3u8`));
          const initFile = 'init.mp4';                                              // ✅ just a filename
          const segFiles = toFfmpegPath(path.join(qualityDir, 'seg_%04d.m4s'));
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            '-y',
            '-r', '30',
            '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
            '-c:v', 'h264', '-profile:v', 'high',
            '-vf', `scale=${rendition.width}:${rendition.height}`,
            '-b:v', rendition.bitrate, '-maxrate', rendition.maxrate, '-bufsize', rendition.bufsize,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-ar', '48000', '-ac', '2',
            '-hls_time', '2',
            '-hls_flags', 'independent_segments',
            '-hls_segment_type', 'fmp4',
            '-hls_playlist_type', 'vod',
            '-hls_fmp4_init_filename', initFile,        // ABSOLUTE
            '-hls_segment_filename', segFiles,          // ABSOLUTE
            '-hls_list_size', '0',
            '-f', 'hls'
          ])
          .on('start', cmd => console.log('🎬 ffmpeg:', cmd))
          .on('stderr', l => console.log('[ffmpeg]', l))
          .on('end', () => {
            // Guardrail: verify segments exist before upload
            const files = fs.readdirSync(qualityDir);
            const segs = files.filter(f => /^seg_\d+\.m4s$/.test(f));
            
            if (segs.length === 0) {
              console.error(`[${rendition.label}] No .m4s segments found in ${qualityDir}. Check -hls_segment_filename.`);
              
              // Safety net: if ffmpeg misplaced segments, move them
              const rootSegs = fs.readdirSync(hlsDir).filter(f => /^seg_\d+\.m4s$/.test(f));
              if (rootSegs.length > 0) {
                console.log(`[${rendition.label}] Moving ${rootSegs.length} segments from hls root to ${qualityDir}`);
                for (const f of rootSegs) {
                  fs.renameSync(path.join(hlsDir, f), path.join(qualityDir, f));
                }
              }
            } else {
              console.log(`[${rendition.label}] ${segs.length} segments created.`);
            }
            
            generatedQualities.push({
              quality: rendition.label,
              url: vPlaylist,  // absolute path for local reference
              width: rendition.width,
              height: rendition.height,
              bitrate: rendition.bitrate,
              resolution: rendition.label,
              isHLS: true
            });
            console.log(`✅ HLS ${rendition.label}: wrote ${vPlaylist}`);
            resolve();
          })
          .on('error', (error) => {
            console.error(`❌ ${rendition.label}:`, error);
            resolve(); // Continue with other qualities
          })
          .output(vPlaylist)                             // ABSOLUTE
          .run();
      });
    } catch (error) {
      console.error(`❌ Error generating HLS ${rendition.label} quality:`, error);
    }
  }
  
  // Generate master playlist
  await generateMasterPlaylist(hlsDir, renditions);
  
  return generatedQualities;
}

// Generate HLS master playlist
async function generateMasterPlaylist(hlsDir, renditions) {
  const fs = require('fs');
  const masterPlaylistPath = `${hlsDir}/master.m3u8`;
  
  let masterContent = '#EXTM3U\n#EXT-X-VERSION:7\n\n';
  
  renditions.forEach(rendition => {
    const bandwidth = parseInt(rendition.maxrate.replace('k', '')) * 1000;
    const avgBandwidth = parseInt(rendition.bitrate.replace('k', '')) * 1000;
    masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},AVERAGE-BANDWIDTH=${avgBandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.640029,mp4a.40.2"\n`;
    masterContent += `${rendition.label}/${rendition.label}.m3u8\n\n`;
  });
  
  fs.writeFileSync(masterPlaylistPath, masterContent);
  console.log('✅ Generated HLS master playlist:', masterPlaylistPath);
}

// Generate multiple video qualities (legacy function)
async function generateVideoQualities(videoPath, baseOutputPath) {
        const qualities = [
          { name: '360p', width: 480, height: 360, bitrate: '500k', resolution: '360p' },
          { name: '480p', width: 854, height: 480, bitrate: '1000k', resolution: '480p' },  
          { name: '720p', width: 1280, height: 720, bitrate: '2500k', resolution: '720p' },
          { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', resolution: '1080p' }
        ];

  const generatedQualities = [];
  
  for (const quality of qualities) {
    try {
      const outputPath = `${baseOutputPath}_${quality.name}.mp4`;
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .size(`${quality.width}x${quality.height}`)
          .videoBitrate(quality.bitrate)
          .audioBitrate('128k')
          .outputOptions([
            '-preset fast',
            '-crf 23',
            '-movflags +faststart' // Optimize for web streaming
          ])
          .output(outputPath)
          .on('end', () => {
            console.log(`✅ Generated ${quality.name} quality:`, outputPath);
                  generatedQualities.push({
                    quality: quality.name,
                    url: outputPath,
                    width: quality.width,
                    height: quality.height,
                    bitrate: quality.bitrate,
                    resolution: quality.resolution
                  });
            resolve();
          })
          .on('error', (error) => {
            console.error(`❌ Failed to generate ${quality.name} quality:`, error);
            resolve(); // Continue with other qualities
          })
          .run();
      });
    } catch (error) {
      console.error(`❌ Error generating ${quality.name} quality:`, error);
    }
  }
  
  return generatedQualities;
}
const dynamodb = new AWS.DynamoDB.DocumentClient();

// DynamoDB table names
const PROJECTS_TABLE = process.env.DYNAMODB_PROJECTS_TABLE || 'ghostmaker-projects';
const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Configure multer for memory storage (for v3 uploads)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 * 1024 // 20GB limit for large videos
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://ghostmakerstudio.com' : true,
  credentials: true
}));
app.use(express.json({ limit: '20gb' }));
app.use(express.urlencoded({ limit: '20gb', extended: true }));
app.use(express.static('public'));
app.use('/src', express.static('src'));

// Routes - Clean URLs without .html extension

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/admin.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/login.html'));
});

// Order page
app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/order.html'));
});

// Order tracking
app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/order-tracking.html'));
});

// Order details
app.get('/order/:orderId', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/order-details.html'));
});

// Account page
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/account.html'));
});

// Portfolio page (redirect to homepage portfolio section)
app.get('/portfolio', (req, res) => {
  res.redirect('/#portfolio');
});

// Services page (redirect to homepage services section)
app.get('/services', (req, res) => {
  res.redirect('/#services');
});

// Contact page
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/pages/contact.html'));
});

// Create Payment Intent endpoint
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    console.log('💳 Creating PaymentIntent:', req.body);
    
    const { amount, currency = 'usd', metadata = {} } = req.body;
    
    // Validate amount
    if (!amount || amount < 50) { // Minimum $0.50
      return res.status(400).json({
        error: 'Invalid amount. Minimum charge is $0.50'
      });
    }
    
    // Create PaymentIntent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      metadata: metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    console.log('✅ PaymentIntent created:', paymentIntent.id);
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    console.error('❌ PaymentIntent creation failed:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Confirm Payment Intent endpoint
app.post('/api/confirm-payment', async (req, res) => {
  try {
    console.log('🔐 Confirming payment:', req.body);
    
    const { paymentIntentId, paymentMethodId } = req.body;
    
    // Confirm the PaymentIntent with the PaymentMethod
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
    
    console.log('✅ Payment confirmed:', paymentIntent.id, 'Status:', paymentIntent.status);
    
    res.json({
      success: true,
      paymentIntent: paymentIntent,
      status: paymentIntent.status
    });
    
  } catch (error) {
    console.error('❌ Payment confirmation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// CMS API Endpoints

// 🚀 LAMBDA-POWERED UPLOAD ENDPOINTS

// Generate presigned URLs for fast direct S3 uploads
app.post('/api/lambda-upload/prepare', async (req, res) => {
  try {
    const { files, projectId } = req.body;
    console.log(`🚀 Preparing Lambda upload for ${files.length} files to project ${projectId}`);
    
    const uploadPromises = files.map(async (file) => {
      const fileId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const key = `projects/${projectId}/media/${fileId}/${file.name}`;
      
      // Generate presigned URL for direct upload
      const presignedUrl = await s3.getSignedUrlPromise('putObject', {
        Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
        Key: key,
        ContentType: file.type,
        Expires: 3600 // 1 hour
      });
      
      return {
        fileId,
        key,
        presignedUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      };
    });
    
    const uploadUrls = await Promise.all(uploadPromises);
    console.log(`✅ Generated ${uploadUrls.length} presigned URLs for direct S3 upload`);
    
    res.json({
      success: true,
      uploads: uploadUrls,
      message: 'Ready for lightning-fast uploads!'
    });
    
  } catch (error) {
    console.error('❌ Lambda upload preparation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger Lambda processing after files are uploaded
app.post('/api/lambda-upload/process', async (req, res) => {
  try {
    const { uploadedFiles, projectId } = req.body;
    console.log(`🔄 Starting background processing for ${uploadedFiles.length} files...`);
    
    // Create basic media records immediately (fast response)
    const basicResults = uploadedFiles.map(fileInfo => {
      const mediaId = fileInfo.fileId;
      
      // Create basic media record with original image only
      const assetRecord = {
        id: mediaId,
        projectId: projectId,
        filename: fileInfo.fileName,
        originalKey: fileInfo.key,
        type: 'image',
        status: 'processing', // Mark as processing
        width: 1920,
        height: 1920,
        thumbnailUrl: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
        lqipUrl: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
        imageQualities: [
          {
            quality: 'original',
            url: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
            width: 1920,
            height: 1920,
            compressionQuality: 95,
            resolution: 'original',
            formats: {
              jpg: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
              webp: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
              heif: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`
            }
          }
        ],
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        versionNumber: 1
      };
      
      // Save basic record to DynamoDB immediately
      dynamodb.put({
        TableName: process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media',
        Item: assetRecord
      }).promise().catch(err => console.error('Failed to save basic record:', err));
      
      return {
        fileId: fileInfo.fileId,
        status: 'processing',
        thumbnails: [`https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`]
      };
    });
    
    // Return immediate response (fast!)
    res.json({
      success: true,
      results: basicResults,
      message: 'Files uploaded! Processing in background...'
    });
    
          // Start background processing (don't await this)
          console.log(`🔄 Starting background processing for ${uploadedFiles.length} files...`);
          processImagesInBackground(uploadedFiles, projectId).catch(error => {
            console.error(`❌ Background processing failed:`, error);
          });
    
  } catch (error) {
    console.error('❌ Background processing setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Background image processing function
async function processImagesInBackground(uploadedFiles, projectId) {
  console.log(`🔄 Starting background Sharp processing for ${uploadedFiles.length} files...`);
  
  for (const fileInfo of uploadedFiles) {
    try {
      console.log(`⚡ Background processing ${fileInfo.fileName} with Sharp...`);
      
      // Download the original image from S3
      const originalImage = await s3.getObject({
        Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
        Key: fileInfo.key
      }).promise();
      
      const imageBuffer = Buffer.from(originalImage.Body);
      const image = sharp(imageBuffer);
      
      // Generate all qualities and formats
      const qualities = [
        { name: 'blur_placeholder', width: 20, height: 20, quality: 20 },
        { name: '320w', width: 320, height: 320, quality: 85 },
        { name: '640w', width: 640, height: 640, quality: 90 },
        { name: '960w', width: 960, height: 960, quality: 92 },
        { name: '1280w', width: 1280, height: 1280, quality: 94 },
        { name: '1920w', width: 1920, height: 1920, quality: 95 }
      ];
      
      const formats = [
        { ext: 'jpg', mime: 'image/jpeg' },
        { ext: 'webp', mime: 'image/webp' },
        { ext: 'heif', mime: 'image/heif' }
      ];
      
      const imageQualities = [];
      
      for (const quality of qualities) {
        console.log(`📸 Background generating ${quality.name} (${quality.width}x${quality.height})`);
        
        const qualityFormats = {};
        
        for (const format of formats) {
          try {
            let processedImage = image
              .clone()
              .resize(quality.width, quality.height, { 
                fit: 'inside', 
                withoutEnlargement: true 
              });
            
            let buffer;
            let finalExt = format.ext;
            
            if (format.ext === 'jpg') {
              buffer = await processedImage
                .jpeg({ quality: quality.quality })
                .toBuffer();
            } else if (format.ext === 'webp') {
              buffer = await processedImage
                .webp({ quality: quality.quality })
                .toBuffer();
            } else if (format.ext === 'heif') {
              try {
                buffer = await processedImage
                  .heif({ quality: quality.quality })
                  .toBuffer();
              } catch (heifError) {
                console.log(`HEIF not supported for ${quality.name}, using JPEG`);
                buffer = await processedImage
                  .jpeg({ quality: quality.quality })
                  .toBuffer();
                finalExt = 'jpg';
              }
            }
            
            const formatKey = fileInfo.key.replace(/\.[^/.]+$/, `_${quality.name}.${finalExt}`);
            console.log(`📤 Background uploading ${quality.name}.${finalExt}: ${formatKey}`);
            
            await s3.putObject({
              Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
              Key: formatKey,
              Body: buffer,
              ContentType: finalExt === 'heif' ? 'image/heif' : finalExt === 'webp' ? 'image/webp' : 'image/jpeg',
              CacheControl: 'public, max-age=31536000, immutable'
            }).promise();
            
            const formatUrl = `https://d17lfecj9hzae.cloudfront.net/${formatKey}`;
            qualityFormats[finalExt] = formatUrl;
            console.log(`✅ Background ${quality.name}.${finalExt} uploaded: ${formatUrl}`);
            
          } catch (formatError) {
            console.error(`❌ Failed to process ${quality.name}.${format.ext}:`, formatError.message);
          }
        }
        
        // Add quality info to the array
        imageQualities.push({
          quality: quality.name,
          url: qualityFormats.heif || qualityFormats.webp || qualityFormats.jpg,
          width: quality.width,
          height: quality.height,
          compressionQuality: quality.quality,
          resolution: quality.name,
          formats: qualityFormats
        });
      }
      
      // Update the media record with all processed qualities
      const mediaId = fileInfo.fileId;
      const updatedRecord = {
        id: mediaId,
        projectId: projectId,
        filename: fileInfo.fileName,
        originalKey: fileInfo.key,
        type: 'image',
        status: 'ready', // Mark as ready
        width: 1920,
        height: 1920,
        thumbnailUrl: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
        lqipUrl: `https://d17lfecj9hzae.cloudfront.net/${fileInfo.key}`,
        imageQualities: imageQualities,
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        versionNumber: 1
      };
      
      // Update DynamoDB with processed data
      await dynamodb.put({
        TableName: process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media',
        Item: updatedRecord
      }).promise();
      
      console.log(`✅ Background processing complete for ${fileInfo.fileName}!`);
      
  } catch (error) {
    console.error(`❌ Background processing failed for ${fileInfo.fileName}:`, error);
    console.error(`❌ Error details:`, error.stack);
  }
}
  
  console.log(`🎉 Background Sharp processing complete for ${uploadedFiles.length} files!`);
}

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    console.log('📁 Fetching all projects from DynamoDB');
    
    // Scan projects table
    const projectsResult = await dynamodb.scan({
      TableName: PROJECTS_TABLE
    }).promise();
    
    // Get all media items
    const mediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE
    }).promise();
    
    // Group media by project and sort by position
    const mediaByProject = {};
    mediaResult.Items.forEach(media => {
      if (!mediaByProject[media.projectId]) {
        mediaByProject[media.projectId] = [];
      }
      mediaByProject[media.projectId].push(media);
    });
    
    // Sort media by position for each project, with fallback to uploadDate for items without position
    Object.keys(mediaByProject).forEach(projectId => {
      mediaByProject[projectId].sort((a, b) => {
        // If both have position, sort by position
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        // If only one has position, prioritize it
        if (a.position !== undefined && b.position === undefined) {
          return -1; // a comes first
        }
        if (a.position === undefined && b.position !== undefined) {
          return 1; // b comes first
        }
        // If neither has position, sort by uploadDate
        return new Date(a.uploadDate) - new Date(b.uploadDate);
      });
    });
    
    // Combine projects with their media
    const projects = projectsResult.Items.map(project => {
      const projectMedia = mediaByProject[project.id] || [];
      return {
        ...project,
        content: projectMedia.map(media => ({
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl, // Include thumbnail URL
          alt: media.filename,
          quality: media.qualities?.[0] || 'original',
          mediaId: media.id,
          position: media.position,
          videoQualities: media.videoQualities, // Include video qualities for videos
          imageQualities: media.imageQualities, // Include image qualities for images
          urls: media.urls // Include URLs object with HLS URL
        }))
      };
    });
    
    // Sort projects by position, with fallback to date for items without position
    projects.sort((a, b) => {
      // If both have position, sort by position
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      // If only one has position, prioritize it
      if (a.position !== undefined && b.position === undefined) {
        return -1; // a comes first
      }
      if (a.position === undefined && b.position !== undefined) {
        return 1; // b comes first
      }
      // If neither has position, sort by date
      return new Date(a.date) - new Date(b.date);
    });
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Failed to fetch projects:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new project
app.post('/api/projects', async (req, res) => {
  try {
    console.log('📁 Creating new project:', req.body);
    
    // Get current project count to determine position
    const existingProjectsResult = await dynamodb.scan({
      TableName: PROJECTS_TABLE
    }).promise();
    
    const nextPosition = existingProjectsResult.Items.length;

    // Create new project
    const projectData = {
      ...req.body,
      id: req.body.id || 'proj_' + Date.now(),
      date: new Date().toISOString(),
      status: 'published',
      mediaItems: [],
      position: nextPosition
    };
    
    // Create S3 folder structure for the project
    try {
      const folderKey = `projects/${projectData.id}/`;
      await s3.putObject({
        Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
        Key: folderKey,
        Body: '', // Empty body to create a "folder"
        ContentType: 'application/x-directory'
      }).promise();
      
      // Create media subfolder
      const mediaFolderKey = `projects/${projectData.id}/media/`;
      await s3.putObject({
        Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
        Key: mediaFolderKey,
        Body: '', // Empty body to create a "folder"
        ContentType: 'application/x-directory'
      }).promise();
      
      console.log('📁 Created S3 folder structure for project:', projectData.id);
    } catch (s3Error) {
      console.warn('⚠️ Failed to create S3 folders (project will still be created):', s3Error.message);
    }
    
    // Save to DynamoDB
    await dynamodb.put({
      TableName: PROJECTS_TABLE,
      Item: projectData
    }).promise();
    
    console.log('✅ Project created and saved to DynamoDB:', projectData.id);
    
    res.json({ success: true, project: projectData });
  } catch (error) {
    console.error('❌ Failed to create project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update existing project
app.put('/api/projects/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    console.log('📝 Updating project:', projectId, req.body);
    console.log('📝 Project content media data:', req.body.content?.map(item => ({
      type: item.type,
      url: item.url,
      urls: item.urls,
      hasHLS: !!item.urls?.hls
    })));
    
    // First, get the existing project to preserve original fields
    const existingProject = await dynamodb.get({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId }
    }).promise();
    
    if (!existingProject.Item) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Update project data while preserving original createdAt and date
    const updateData = {
      ...existingProject.Item, // Keep all existing data
      ...req.body, // Apply new data
      id: projectId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
      // Preserve original fields if they exist
      createdAt: existingProject.Item.createdAt || new Date().toISOString(),
      date: existingProject.Item.date || new Date().toISOString()
    };
    
    // Save to DynamoDB
    await dynamodb.put({
      TableName: PROJECTS_TABLE,
      Item: updateData
    }).promise();
    
    console.log('✅ Project updated in DynamoDB:', projectId);
    
    res.json({ success: true, project: updateData });
  } catch (error) {
    console.error('❌ Failed to update project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('🗑️ Deleting project:', projectId);
    
    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId }
    }).promise();
    
    // Delete associated media records (using scan since index might not exist)
    const mediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE,
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    }).promise();
    
    // Delete each media record
    for (const mediaItem of mediaResult.Items) {
      await dynamodb.delete({
        TableName: MEDIA_TABLE,
        Key: { id: mediaItem.id }
      }).promise();
    }
    
    // Delete S3 files and folders
    try {
      const bucketName = process.env.S3_BUCKET || 'ghostmaker-studio-media';
      const projectPrefix = `projects/${projectId}/`;
      
      // List all objects with the project prefix
      const listParams = {
        Bucket: bucketName,
        Prefix: projectPrefix
      };
      
      const listedObjects = await s3.listObjectsV2(listParams).promise();
      
      if (listedObjects.Contents.length > 0) {
        // Delete all objects
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: listedObjects.Contents.map(obj => ({ Key: obj.Key }))
          }
        };
        
        await s3.deleteObjects(deleteParams).promise();
        console.log(`🗂️ Deleted ${listedObjects.Contents.length} S3 objects for project: ${projectId}`);
      } else {
        console.log(`📁 No S3 objects found for project: ${projectId}`);
      }
    } catch (s3Error) {
      console.warn('⚠️ Failed to delete S3 objects (project record still deleted):', s3Error.message);
    }
    
    console.log('✅ Project, media records, and S3 files deleted:', projectId);
    
    res.json({ success: true, message: 'Project and all associated files deleted successfully' });
  } catch (error) {
    console.error('❌ Failed to delete project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete individual media item from S3 (including thumbnails)
app.delete('/api/media/:mediaId', async (req, res) => {
  try {
    const { mediaId } = req.params;
    console.log('🗑️ Deleting media item from S3:', mediaId);
    
    // First, get the media record to find the folder path
    const mediaRecord = await dynamodb.get({
      TableName: MEDIA_TABLE,
      Key: { id: mediaId }
    }).promise();
    
    if (!mediaRecord.Item) {
      return res.status(404).json({ success: false, error: 'Media record not found' });
    }
    
    const s3Key = mediaRecord.Item.s3Key;
    const mediaFolder = s3Key.substring(0, s3Key.lastIndexOf('/')); // Get folder path
    
    console.log('📁 Deleting entire media folder:', mediaFolder);
    
    // List all objects in the media folder
    const listParams = {
      Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      Prefix: mediaFolder + '/'
    };
    
    const listedObjects = await s3.listObjectsV2(listParams).promise();
    
    if (listedObjects.Contents.length === 0) {
      console.log('⚠️ No files found in media folder');
      return res.json({ success: true, message: 'No files found to delete' });
    }
    
    // Delete all files in the folder
    const deleteParams = {
      Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      Delete: {
        Objects: listedObjects.Contents.map(object => ({ Key: object.Key }))
      }
    };
    
    await s3.deleteObjects(deleteParams).promise();
    console.log(`✅ Deleted ${listedObjects.Contents.length} files from media folder:`, mediaFolder);
    
    res.json({ success: true, message: `Deleted ${listedObjects.Contents.length} files from media folder` });
  } catch (error) {
    console.error('❌ Failed to delete media item from S3:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete media record from DynamoDB
app.delete('/api/media-record/:s3Key', async (req, res) => {
  try {
    const s3Key = decodeURIComponent(req.params.s3Key);
    console.log('🗑️ Deleting media record from DynamoDB for s3Key:', s3Key);
    
    // Find the record by s3Key
    const scanResult = await dynamodb.scan({
      TableName: MEDIA_TABLE,
      FilterExpression: 's3Key = :s3Key',
      ExpressionAttributeValues: {
        ':s3Key': s3Key
      }
    }).promise();
    
    if (scanResult.Items.length > 0) {
      const item = scanResult.Items[0];
      console.log('📋 Found media record to delete:', item);
      
      // Try different key combinations based on what we find
      let deleteKey = {};
      
      // Check what key fields exist
      if (item.id) {
        deleteKey.id = item.id;
      }
      if (item.mediaId) {
        deleteKey.mediaId = item.mediaId;
      }
      if (item.projectId) {
        deleteKey.projectId = item.projectId;
      }
      
      console.log('🗑️ Attempting to delete with key:', deleteKey);
      
      await dynamodb.delete({
        TableName: MEDIA_TABLE,
        Key: deleteKey
      }).promise();
      
      console.log('✅ Media record deleted from DynamoDB successfully');
      res.json({ success: true, message: 'Media record deleted from DynamoDB successfully' });
    } else {
      console.log('⚠️ Media record not found in DynamoDB for s3Key:', s3Key);
      res.json({ success: true, message: 'Media record not found (may have been deleted already)' });
    }
  } catch (error) {
    console.error('❌ Failed to delete media record from DynamoDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get media for a specific project
app.get('/api/projects/:projectId/media', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('📁 Fetching media for project:', projectId);
    
    const fs = require('fs');
    const dbPath = path.join(__dirname, 'src/data/database.json');
    
    if (fs.existsSync(dbPath)) {
      const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const projectMedia = dbData.media.filter(media => media.projectId === projectId);
      
      res.json({ success: true, media: projectMedia });
    } else {
      res.json({ success: true, media: [] });
    }
  } catch (error) {
    console.error('❌ Failed to fetch project media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fix cover images for existing projects
app.post('/api/fix-cover-images', async (req, res) => {
  try {
    console.log('🖼️ Fixing cover images for existing projects...');
    
    // Get all projects
    const projectsResult = await dynamodb.scan({
      TableName: PROJECTS_TABLE
    }).promise();
    
    // Get all media items
    const mediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE
    }).promise();
    
    // Group media by project
    const mediaByProject = {};
    mediaResult.Items.forEach(media => {
      if (!mediaByProject[media.projectId]) {
        mediaByProject[media.projectId] = [];
      }
      mediaByProject[media.projectId].push(media);
    });
    
    // Update each project's cover image
    const updatePromises = [];
    projectsResult.Items.forEach(project => {
      const projectMedia = mediaByProject[project.id] || [];
      
      // Sort by position, then by uploadDate
      projectMedia.sort((a, b) => {
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        if (a.position !== undefined && b.position === undefined) {
          return -1;
        }
        if (a.position === undefined && b.position !== undefined) {
          return 1;
        }
        return new Date(a.uploadDate) - new Date(b.uploadDate);
      });
      
      // Set the first media item as cover image if no cover image exists
      if (projectMedia.length > 0 && (!project.coverImage || project.coverImage === '')) {
        const firstMedia = projectMedia[0];
        console.log(`🖼️ Setting cover image for project ${project.id}:`, firstMedia.s3Url);
        
        updatePromises.push(
          dynamodb.update({
            TableName: PROJECTS_TABLE,
            Key: { id: project.id },
            UpdateExpression: 'SET coverImage = :coverImage',
            ExpressionAttributeValues: {
              ':coverImage': firstMedia.thumbnailUrl || firstMedia.s3Url
            }
          }).promise()
        );
      }
    });
    
    await Promise.all(updatePromises);
    
    console.log(`✅ Fixed cover images for ${updatePromises.length} projects.`);
    res.json({ 
      success: true, 
      message: `Successfully fixed cover images for ${updatePromises.length} projects` 
    });
  } catch (error) {
    console.error('❌ Failed to fix cover images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Migrate existing media items to add position field
app.post('/api/migrate-media-positions', async (req, res) => {
  try {
    console.log('🔄 Starting media position migration...');
    
    // Get all media items
    const mediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE
    }).promise();
    
    console.log('📊 Found media items:', mediaResult.Items.length);
    if (mediaResult.Items.length > 0) {
      console.log('📊 Sample media item:', mediaResult.Items[0]);
    }
    
    // Group by project
    const mediaByProject = {};
    mediaResult.Items.forEach(media => {
      if (!mediaByProject[media.projectId]) {
        mediaByProject[media.projectId] = [];
      }
      mediaByProject[media.projectId].push(media);
    });
    
    // Update each project's media with positions
    const updatePromises = [];
    Object.keys(mediaByProject).forEach(projectId => {
      const projectMedia = mediaByProject[projectId];
      
      // Sort by uploadDate first
      projectMedia.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
      
      // Add position field to each media item
      projectMedia.forEach((media, index) => {
        if (media.position === undefined) {
          console.log('🔄 Adding position to media item:', media.id, 'position:', index);
          updatePromises.push(
            dynamodb.update({
              TableName: MEDIA_TABLE,
              Key: { 
                id: media.id,
                projectId: media.projectId
              },
              UpdateExpression: 'SET #pos = :pos',
              ExpressionAttributeNames: {
                '#pos': 'position'
              },
              ExpressionAttributeValues: {
                ':pos': index
              }
            }).promise()
          );
        }
      });
    });
    
    await Promise.all(updatePromises);
    
    console.log(`✅ Migration complete! Updated ${updatePromises.length} media items.`);
    res.json({ 
      success: true, 
      message: `Successfully migrated ${updatePromises.length} media items with position fields` 
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Project Positions
app.put('/api/projects-order', async (req, res) => {
  try {
    const { projectOrder } = req.body;
    
    console.log('📝 Updating project order:', projectOrder);
    
    // Update each project's position
    const updatePromises = projectOrder.map((project, index) => {
      console.log(`🔄 Updating ${project.id} to position ${index}`);
      return dynamodb.update({
        TableName: PROJECTS_TABLE,
        Key: { id: project.id },
        UpdateExpression: 'SET #pos = :pos',
        ExpressionAttributeNames: {
          '#pos': 'position'
        },
        ExpressionAttributeValues: {
          ':pos': index
        }
      }).promise();
    });
    
    await Promise.all(updatePromises);
    
    console.log('✅ Project positions updated successfully');
    res.json({ success: true, message: 'Project order updated successfully' });
  } catch (error) {
    console.error('❌ Failed to update project order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Media Positions
app.put('/api/projects/:projectId/media-order', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { mediaOrder } = req.body;
    
    console.log('📝 Updating media order for project:', projectId, mediaOrder);
    
    // First, let's verify the media items exist
    console.log('🔍 Verifying media items exist...');
    const mediaItems = await dynamodb.scan({
      TableName: MEDIA_TABLE,
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    }).promise();
    
    console.log('📊 Found media items in table:', mediaItems.Items.map(item => ({ id: item.id, projectId: item.projectId })));
    console.log('📊 Trying to update:', mediaOrder);
    
    // Update each media item's position
    const updatePromises = mediaOrder.map((item, index) => {
      console.log(`🔄 Updating ${item.mediaId} to position ${index}`);
      return dynamodb.update({
        TableName: MEDIA_TABLE,
        Key: { 
          id: item.mediaId,
          projectId: projectId
        },
        UpdateExpression: 'SET #pos = :pos',
        ExpressionAttributeNames: {
          '#pos': 'position'
        },
        ExpressionAttributeValues: {
          ':pos': index
        }
      }).promise();
    });
    
    await Promise.all(updatePromises);
    
    // Update cover image to match the new first item (position 0)
    if (mediaOrder.length > 0) {
      const firstMediaItem = mediaOrder.find(item => item.position === 0);
      if (firstMediaItem) {
        // Find the URL for this media item
        const mediaItem = mediaItems.Items.find(item => item.id === firstMediaItem.mediaId);
        if (mediaItem) {
          await dynamodb.update({
            TableName: PROJECTS_TABLE,
            Key: { id: projectId },
            UpdateExpression: 'SET coverImage = :coverImage',
            ExpressionAttributeValues: {
              ':coverImage': mediaItem.thumbnailUrl || mediaItem.s3Url
            }
          }).promise();
          console.log('🖼️ Updated cover image to new first item:', mediaItem.s3Url);
        }
      }
    }
    
    console.log('✅ Media positions updated successfully');
    res.json({ success: true, message: 'Media order updated successfully' });
  } catch (error) {
    console.error('❌ Failed to update media order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Upload to S3
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { projectId, fileName } = req.body;
    const file = req.file;
    
    console.log('📤 Uploading file:', fileName, 'to project:', projectId);
    
// DynamoDB configuration
const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    // Generate unique filename with media-specific folder structure
    const timestamp = Date.now();
    const fileExtension = path.extname(fileName);
    const baseFileName = path.basename(fileName, fileExtension);
    const mediaId = `media_${timestamp}`;
    
    // Create media-specific folder structure: projects/{projectId}/media/{mediaId}/
    const mediaFolder = `projects/${projectId}/media/${mediaId}`;
    const s3Key = `${mediaFolder}/${baseFileName}${fileExtension}`;
    
    // Upload original to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      Key: s3Key,
      Body: require('fs').readFileSync(file.path),
      ContentType: file.mimetype
    };

    const s3Result = await s3.upload(uploadParams).promise();
    
    let thumbnailUrl = null;
    
    // Generate thumbnail for images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      try {
        const thumbnailPath = file.path + '_thumb.jpg';
        let thumbnailGenerated = false;
        
        if (file.mimetype.startsWith('image/')) {
          // Generate image thumbnail
          thumbnailGenerated = await generateThumbnail(file.path, thumbnailPath, 300);
        } else if (file.mimetype.startsWith('video/')) {
          // Generate video thumbnail
          thumbnailGenerated = await generateVideoThumbnail(file.path, thumbnailPath, 300);
        }
        
        if (thumbnailGenerated) {
          // Upload thumbnail to S3 in same media folder
          const thumbnailKey = `${mediaFolder}/thumb.jpg`;
          const thumbnailUploadParams = {
            Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
            Key: thumbnailKey,
            Body: require('fs').readFileSync(thumbnailPath),
            ContentType: 'image/jpeg'
          };
          
          const thumbnailS3Result = await s3.upload(thumbnailUploadParams).promise();
          thumbnailUrl = thumbnailS3Result.Location;
          
          // Clean up thumbnail file
          require('fs').unlinkSync(thumbnailPath);
          const cloudfrontThumbnailUrl = thumbnailUrl.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/');
        console.log('✅ Thumbnail generated and uploaded:', cloudfrontThumbnailUrl);
        }
      } catch (error) {
        console.error('❌ Thumbnail generation failed:', error);
      }
    }
    
    // Generate multiple video qualities for videos
    let videoQualities = [];
    if (file.mimetype.startsWith('video/')) {
      try {
        console.log('🎬 Generating HLS for streaming + MP4s for downloads...');
        const outputDir = file.path.replace(fileExtension, '');
        const fs = require('fs');
        
        // Step 1: Generate HLS for fast streaming (480p, 720p, 1080p)
        console.log('📺 Generating HLS adaptive streaming...');
        // Remove file extension from outputDir to avoid conflicts
        const baseDir = outputDir.replace(/\.[^/.]+$/, "");
        videoQualities = await generateHLSAdaptiveStreaming(file.path, baseDir);
        
        const hlsDir = `${baseDir}_hls`;
        
        // Upload master playlist
        const masterPlaylistPath = `${hlsDir}/master.m3u8`;
        if (fs.existsSync(masterPlaylistPath)) {
          const masterKey = `${mediaFolder}/hls/master.m3u8`;
          const masterUploadParams = {
            Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
            Key: masterKey,
            Body: fs.readFileSync(masterPlaylistPath),
            ContentType: 'application/vnd.apple.mpegurl'
          };
          await s3.upload(masterUploadParams).promise();
          console.log('✅ Uploaded HLS master playlist to S3');
        }
        
      // Upload each HLS quality variant and its segments
      for (const quality of videoQualities) {
        const qualityDir = path.join(hlsDir, quality.quality);
        const playlistPath = path.join(hlsDir, quality.quality, `${quality.quality}.m3u8`); // playlist is now in quality folder
        
        // Upload the variant playlist (now in quality folder)
        const qualityKey = `${mediaFolder}/hls/${quality.quality}/${quality.quality}.m3u8`;
        const qualityUploadParams = {
          Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
          Key: qualityKey,
          Body: fs.readFileSync(playlistPath),
          ContentType: 'application/vnd.apple.mpegurl'
        };
        
        const qualityS3Result = await s3.upload(qualityUploadParams).promise();
        quality.url = qualityS3Result.Location;
        
        // Upload HLS segments for this quality (init.mp4 + seg_*.m4s)
        if (fs.existsSync(qualityDir)) {
          const segmentFiles = fs.readdirSync(qualityDir);
          for (const segmentFile of segmentFiles) {
            const segmentPath = path.join(qualityDir, segmentFile);
            const segmentKey = `${mediaFolder}/hls/${quality.quality}/${segmentFile}`;
            
            let contentType = 'video/iso.segment';
            if (segmentFile.endsWith('.mp4')) {
              contentType = 'video/mp4';
            }
            
            const segmentUploadParams = {
              Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
              Key: segmentKey,
              Body: fs.readFileSync(segmentPath),
              ContentType: contentType
            };
            
            await s3.upload(segmentUploadParams).promise();
          }
          console.log(`✅ Uploaded ${quality.quality} HLS segments to S3`);
        }
        
        // Clean up local HLS files
        if (fs.existsSync(qualityDir)) {
          fs.rmSync(qualityDir, { recursive: true });
        }
        console.log(`✅ Uploaded ${quality.quality} HLS variant:`, quality.url);
      }
        
        // Step 2: Generate standalone MP4s for downloads (1080p + original)
        console.log('📥 Generating downloadable MP4 versions...');
        const downloadableQualities = [
          { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', resolution: '1080p' }
        ];
        
        const downloadableVideos = [];
        
        for (const quality of downloadableQualities) {
          try {
            const outputPath = `${baseDir}_download_${quality.name}.mp4`;
            
            await new Promise((resolve, reject) => {
              ffmpeg(file.path)
                .size(`${quality.width}x${quality.height}`)
                .videoBitrate(quality.bitrate)
                .audioBitrate('192k')
                .outputOptions([
                  '-preset medium',
                  '-crf 20',
                  '-movflags +faststart',
                  '-pix_fmt yuv420p'
                ])
                .output(outputPath)
                .on('end', () => {
                  console.log(`✅ Generated downloadable ${quality.name}:`, outputPath);
                  resolve();
                })
                .on('error', (error) => {
                  console.error(`❌ Failed to generate ${quality.name}:`, error);
                  resolve(); // Continue with other qualities
                })
                .run();
            });
            
            // Upload to S3
            if (fs.existsSync(outputPath)) {
              const downloadKey = `${mediaFolder}/downloads/${quality.name}.mp4`;
              const downloadUploadParams = {
                Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
                Key: downloadKey,
                Body: fs.readFileSync(outputPath),
                ContentType: 'video/mp4',
                ContentDisposition: `attachment; filename="${quality.name}.mp4"`
              };
              
              const downloadS3Result = await s3.upload(downloadUploadParams).promise();
              downloadableVideos.push({
                quality: quality.name,
                url: downloadS3Result.Location,
                width: quality.width,
                height: quality.height,
                bitrate: quality.bitrate,
                resolution: quality.resolution,
                type: 'download'
              });
              
              // Clean up local file
              fs.unlinkSync(outputPath);
              console.log(`✅ Uploaded downloadable ${quality.name} to S3`);
            }
          } catch (error) {
            console.error(`❌ Error generating downloadable ${quality.name}:`, error);
          }
        }
        
        // Upload original file as download option (preserve source quality)
        console.log('📥 Uploading original as download option...');
        const originalKey = `${mediaFolder}/downloads/original${fileExtension}`;
        const originalUploadParams = {
          Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
          Key: originalKey,
          Body: fs.readFileSync(file.path),
          ContentType: file.mimetype,
          ContentDisposition: `attachment; filename="original${fileExtension}"`
        };
        
        const originalS3Result = await s3.upload(originalUploadParams).promise();
        downloadableVideos.push({
          quality: 'original',
          url: originalS3Result.Location,
          resolution: 'Original Quality',
          type: 'download'
        });
        console.log('✅ Uploaded original for download');
        
        // Store downloadable versions in videoQualities
        videoQualities.downloadableVersions = downloadableVideos;
        
      } catch (error) {
        console.error('❌ Video processing failed:', error);
        // Continue with original file if quality generation fails
      }
    }
    
    // Generate multiple image qualities for images
    let imageQualities = [];
    if (file.mimetype.startsWith('image/')) {
      try {
        console.log('🖼️ Generating multiple image qualities...');
        console.log('🖼️ Generating social media optimized widths: 320w/640w/960w/1280w/1920w with JPG+WebP+HEIF');
        
        // Social media optimized responsive image pipeline (Facebook/Instagram style)
        const qualities = [
          { name: 'blur_placeholder', width: 320, height: 320, quality: 20, resolution: 'BLURRY' }, // LQIP for instant paint
          { name: '320w', width: 320, height: 320, quality: 75, resolution: '320w' }, // Mobile thumbnail
          { name: '640w', width: 640, height: 640, quality: 80, resolution: '640w' }, // Mobile full
          { name: '960w', width: 960, height: 960, quality: 85, resolution: '960w' }, // Tablet
          { name: '1280w', width: 1280, height: 1280, quality: 90, resolution: '1280w' }, // Desktop
          { name: '1920w', width: 1920, height: 1920, quality: 95, resolution: '1920w' } // High-res desktop
        ];

        for (const quality of qualities) {
          try {
            // Skip blur_placeholder for modern formats (keep only JPEG for instant loading)
            if (quality.name === 'blur_placeholder') {
              const qualityPath = `${file.path}_${quality.name}.jpg`;
              
              await sharp(file.path)
                .resize(quality.width, quality.height, { 
                  fit: 'inside',
                  withoutEnlargement: true 
                })
                .jpeg({ quality: quality.quality })
                .toFile(qualityPath);
              
              console.log(`✅ Generated ${quality.name} image quality:`, qualityPath);
              
              // Upload to S3
              const qualityKey = `${mediaFolder}/${quality.name}.jpg`;
              const qualityUploadParams = {
                Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
                Key: qualityKey,
                Body: require('fs').readFileSync(qualityPath),
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000, immutable'
              };
              
              await s3.upload(qualityUploadParams).promise();
              const qualityUrl = `https://d17lfecj9hzae.cloudfront.net/${qualityKey}`;
              
              imageQualities.push({
                quality: quality.name,
                url: qualityUrl,
                width: quality.width,
                height: quality.height,
                quality: quality.quality,
                resolution: quality.resolution
              });
              
              // Clean up local file
              require('fs').unlinkSync(qualityPath);
              continue;
            }

            // Generate social media optimized formats (JPEG, WebP, HEIF)
            // Note: AVIF requires Sharp 0.32+ with libheif support
            const formats = [
              { ext: 'jpg', contentType: 'image/jpeg', options: { quality: quality.quality, progressive: true } },
              { ext: 'webp', contentType: 'image/webp', options: { quality: Math.max(70, quality.quality - 15) } }
            ];
            
            // Try to add HEIF if supported (similar compression to AVIF)
            try {
              const sharp = require('sharp');
              if (sharp.format.heif && sharp.format.heif.output) {
                formats.push({ ext: 'heif', contentType: 'image/heif', options: { quality: Math.max(45, quality.quality - 25) } }); // Social media optimized
                console.log('✅ HEIF support detected - will generate HEIF files');
              } else if (sharp.format.avif && sharp.format.avif.output) {
                formats.push({ ext: 'avif', contentType: 'image/avif', options: { quality: Math.max(45, quality.quality - 25) } }); // Social media optimized
                console.log('✅ AVIF support detected - will generate AVIF files');
              } else {
                console.log('⚠️ Neither AVIF nor HEIF supported - using WebP+JPEG only');
              }
            } catch (error) {
              console.log('⚠️ Error checking format support:', error.message);
            }

            for (const format of formats) {
              try {
                const qualityPath = `${file.path}_${quality.name}.${format.ext}`;
                
                let sharpInstance = sharp(file.path)
                  .resize(quality.width, quality.height, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                  })
                  .toColorspace('srgb'); // Ensure sRGB color space

                // Apply format-specific options
                if (format.ext === 'jpg') {
                  sharpInstance = sharpInstance.jpeg(format.options);
                } else if (format.ext === 'webp') {
                  sharpInstance = sharpInstance.webp(format.options);
                } else if (format.ext === 'avif') {
                  sharpInstance = sharpInstance.avif(format.options);
                }
                
                await sharpInstance.toFile(qualityPath);
                
                console.log(`✅ Generated ${quality.name}.${format.ext} image quality:`, qualityPath);
                
                // Upload to S3 with proper cache headers
                const qualityKey = `${mediaFolder}/${quality.name}.${format.ext}`;
                const qualityUploadParams = {
                  Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
                  Key: qualityKey,
                  Body: require('fs').readFileSync(qualityPath),
                  ContentType: format.contentType,
                  CacheControl: 'public, max-age=31536000, immutable'
                };
                
                await s3.upload(qualityUploadParams).promise();
                
                // Only add one entry per quality (prefer AVIF, fallback to WebP, then JPEG)
                if (!imageQualities.find(q => q.quality === quality.name)) {
                  imageQualities.push({
                    quality: quality.name,                  // Name like 'blur_placeholder', '1920w', etc.
                    url: `https://d17lfecj9hzae.cloudfront.net/${qualityKey}`,
                    width: quality.width,
                    height: quality.height,
                    compressionQuality: quality.quality,    // JPEG/WebP compression quality (20-95)
                    resolution: quality.resolution,         // Human-readable resolution like '1920w', 'BLURRY'
                    formats: {
                      heif: format.ext === 'heif' ? `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/${quality.name}.heif` : undefined,
                      webp: format.ext === 'webp' ? `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/${quality.name}.webp` : undefined,
                      jpg: format.ext === 'jpg' ? `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/${quality.name}.jpg` : undefined
                    }
                  });
                } else {
                  // Update existing entry with format URLs
                  const existing = imageQualities.find(q => q.quality === quality.name);
                  if (existing.formats) {
                    existing.formats[format.ext] = `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/${quality.name}.${format.ext}`;
                  }
                }
                
                // Clean up local file
                require('fs').unlinkSync(qualityPath);
                
              } catch (formatError) {
                console.error(`❌ Failed to generate ${quality.name}.${format.ext}:`, formatError);
                // Continue with other formats even if one fails
              }
            }
            
          } catch (error) {
            console.error(`❌ Failed to generate ${quality.name} image quality:`, error);
          }
        }
        
      } catch (error) {
        console.error('❌ Image quality generation failed:', error);
        // Continue with original file if quality generation fails
      }
    }
    
    // Clean up local file
    require('fs').unlinkSync(file.path);
    
    // Generate public URL (convert S3 to CloudFront)
    const publicUrl = s3Result.Location.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/');
    
    // Get current media count for this project to determine position
    const existingMediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE,
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    }).promise();
    
    const nextPosition = existingMediaResult.Items.length;

    // Create media record
    const mediaRecord = {
      id: mediaId,
      projectId: projectId,
      originalName: fileName,
      fileName: `${baseFileName}${fileExtension}`,
      fileType: file.mimetype.startsWith('video/') ? 'video' : 'image',
      mimeType: file.mimetype,
      s3Key: s3Key,
      s3Url: publicUrl,
      thumbnailUrl: thumbnailUrl, // Include thumbnail URL if generated
      size: file.size,
      uploadDate: new Date().toISOString(),
      isCoverImage: false,
      qualities: file.mimetype.startsWith('video/') && videoQualities.length > 0 
        ? videoQualities.map(q => q.quality) 
        : file.mimetype.startsWith('image/') && imageQualities.length > 0
        ? imageQualities.map(q => q.quality)
        : ['original'],
      videoQualities: videoQualities.length > 0 ? videoQualities : undefined,
      imageQualities: imageQualities.length > 0 ? imageQualities : undefined,
      position: nextPosition,
      urls: {
        original: publicUrl,
        thumbnail: thumbnailUrl || publicUrl,
        ...(file.mimetype.startsWith('video/') && videoQualities.length > 0 && {
          hls: `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/hls/master.m3u8`
        })
      }
    };

    // Save media record to DynamoDB
    await dynamodb.put({
      TableName: MEDIA_TABLE,
      Item: mediaRecord
    }).promise();
    
    // If this is the first media item (position 0), set it as the cover image
    if (nextPosition === 0) {
      await dynamodb.update({
        TableName: PROJECTS_TABLE,
        Key: { id: projectId },
        UpdateExpression: 'SET coverImage = :coverImage',
        ExpressionAttributeValues: {
          ':coverImage': publicUrl
        }
      }).promise();
      console.log('🖼️ Set first media item as cover image:', publicUrl);
    }
    
    // Return data in format expected by frontend
    const files = [{
      type: mediaRecord.fileType,
      url: publicUrl,
      alt: baseFileName,
      quality: 'original',
      size: file.size,
      mediaId: mediaRecord.id
    }];

    console.log('✅ File uploaded and linked to project:', publicUrl);
    
    res.json({
      success: true,
      files: files,
      originalUrl: publicUrl,
      s3Key: s3Key,
      mediaId: mediaRecord.id,
      isCoverImage: nextPosition === 0
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Upload failed' 
    });
  }
});

// Upload media files
app.post('/api/upload-media', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Uploading media file:', req.file?.originalname);
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const mediaData = {
      mediaId: `media_${Date.now()}`,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      s3Key: req.file.key,
      s3Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      urls: {
        original: req.file.location.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/'),
        thumbnail: thumbnailUrl ? thumbnailUrl.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/') : req.file.location.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/') + '_thumb.jpg',
        preview: req.file.location.replace('https://ghostmaker-studio-media.s3.amazonaws.com/', 'https://d17lfecj9hzae.cloudfront.net/') + '_preview.mp4'
      },
      processingStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add HLS master playlist URL for videos
    if (videoQualities.length > 0) {
      const hlsMasterUrl = `https://d17lfecj9hzae.cloudfront.net/${mediaFolder}/hls/master.m3u8`;
      mediaData.urls.hls = hlsMasterUrl;
      mediaData.videoQualities = videoQualities;
      console.log('✅ Added HLS master playlist URL:', hlsMasterUrl);
    }
    
    // Add image qualities for images
    if (imageQualities.length > 0) {
      mediaData.imageQualities = imageQualities;
    }
    
    // In a real app, save to database and trigger video processing if needed
    console.log('✅ Media uploaded:', mediaData.mediaId);
    
    res.json({ success: true, media: mediaData });
  } catch (error) {
    console.error('❌ Media upload failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all media files
app.get('/api/media', async (req, res) => {
  try {
    console.log('🎬 Fetching all media files');
    
    // In a real app, query database for media files
    const media = [
      {
        mediaId: 'media_demo_1',
        fileName: 'hero-video.mp4',
        originalName: 'client_hero_video_final.mp4',
        fileType: 'video',
        mimeType: 'video/mp4',
        fileSize: 15728640,
        duration: 120,
        dimensions: { width: 1920, height: 1080 },
        s3Key: 'projects/demo/video/hero-video.mp4',
        s3Bucket: 'ghostmaker-studio-media',
        urls: {
          original: '/public/images/placeholder-project.jpg',
          thumbnail: '/public/images/placeholder-project.jpg',
          preview: '/public/images/placeholder-project.jpg'
        },
        qualities: {
          '260p': '/public/images/placeholder-project.jpg',
          '480p': '/public/images/placeholder-project.jpg',
          '1080p': '/public/images/placeholder-project.jpg',
          '4k': '/public/images/placeholder-project.jpg'
        },
        processingStatus: 'completed',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z'
      }
    ];
    
    res.json({ success: true, media });
  } catch (error) {
    console.error('❌ Failed to fetch media:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Grid Layout API
app.put('/api/grid-layout', async (req, res) => {
  try {
    const gridLayout = req.body;
    
    console.log('📐 Saving grid layout:', gridLayout);
    
    // Save grid layout to DynamoDB
    await dynamodb.put({
      TableName: PROJECTS_TABLE, // Using projects table to store grid layout
      Item: {
        id: 'grid_layout',
        type: 'grid_layout',
        layout: gridLayout,
        updatedAt: new Date().toISOString()
      }
    }).promise();
    
    console.log('✅ Grid layout saved successfully');
    res.json({ success: true, message: 'Grid layout saved successfully' });
  } catch (error) {
    console.error('❌ Failed to save grid layout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Grid Layout API
app.get('/api/grid-layout', async (req, res) => {
  try {
    const result = await dynamodb.get({
      TableName: PROJECTS_TABLE,
      Key: { id: 'grid_layout' }
    }).promise();
    
    if (result.Item && result.Item.layout) {
      res.json({ success: true, layout: result.Item.layout });
    } else {
      // Return default layout
      res.json({ 
        success: true, 
        layout: { width: 4, height: 5, positions: {} } 
      });
    }
  } catch (error) {
    console.error('❌ Failed to get grid layout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured',
    s3: process.env.S3_BUCKET ? 'configured' : 'not configured'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ========================================
// 🚀 ENTERPRISE MEDIA PIPELINE v3 ENDPOINTS
// ========================================

// Direct upload through server (bypasses CORS issues)
app.post('/api/v3/upload', uploadMemory.single('file'), async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!req.file || !projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing file or projectId' 
      });
    }

    const file = req.file;
    const mediaId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const key = `projects/${projectId}/originals/${mediaId}-${file.originalname}`;
    
    console.log(`📤 Uploading file to S3: ${key}`);
    
    // Upload directly to S3 from server
    const uploadParams = {
      Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      Key: key,
      Body: file.buffer || file.buffer,  // Ensure we have the file buffer
      ContentType: file.mimetype
    };
    
    console.log(`📤 File info: ${file.originalname}, size: ${file.size}, buffer: ${file.buffer ? 'exists' : 'missing'}`);
    
    // Use putObject instead of upload for more control
    const result = await s3.putObject(uploadParams).promise();
    console.log(`✅ File uploaded to S3: ${result.Location}`);
    
    // Store media record in DynamoDB (pending status)
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    await dynamodb.put({
      TableName: process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media',
      Item: {
        id: mediaId,
        projectId: projectId,
        filename: file.originalname,
        originalKey: key,
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        status: 'pending',
        uploadedAt: new Date().toISOString(),
        versionNumber: 1
      }
    }).promise();
    
    res.json({
      success: true,
      mediaId: mediaId,
      key: key,
      message: 'File uploaded successfully'
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get media processing status
app.get('/api/v3/media/:mediaId/status', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { projectId } = req.query; // Get projectId from query params
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId is required' 
      });
    }
    
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media',
      Key: { 
        id: mediaId,
        projectId: projectId 
      }
    }).promise();
    
    if (!result.Item) {
      return res.status(404).json({ 
        success: false, 
        error: 'Media not found' 
      });
    }
    
    res.json({
      success: true,
      media: result.Item
    });
    
  } catch (error) {
    console.error('❌ Media status check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// On-demand image resize proxy
app.get('/img/*', async (req, res) => {
  try {
    const s3Key = req.params[0];
    const { w = '1280', q = '80', f = 'webp' } = req.query;
    
    console.log(`🖼️ Image resize request: ${s3Key} → ${w}w, ${q}q, ${f}`);
    
    const cacheKey = `proxy-cache/${s3Key.replace(/\//g, '_')}_w${w}_q${q}.${f}`;
    const bucket = process.env.S3_BUCKET || 'ghostmaker-studio-media';
    
    // Check cache first
    try {
      const cached = await s3.getObject({ 
        Bucket: bucket, 
        Key: cacheKey 
      }).promise();
      
      console.log(`✅ Cache hit: ${cacheKey}`);
      
      res.setHeader('Content-Type', getMimeType(f));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Cache', 'Hit');
      res.send(cached.Body);
      return;
      
    } catch (cacheError) {
      console.log(`⏭️ Cache miss: ${cacheKey}`);
    }
    
    // Download and process original
    const original = await s3.getObject({ 
      Bucket: bucket, 
      Key: s3Key 
    }).promise();
    
    let image = sharp(original.Body).rotate();
    const metadata = await image.metadata();
    
    // Resize if needed
    if (metadata.width && metadata.width > parseInt(w)) {
      image = image.resize({ 
        width: parseInt(w), 
        withoutEnlargement: true 
      });
    }
    
    // Convert format
    let outputBuffer;
    if (f === 'webp') {
      outputBuffer = await image.webp({ quality: parseInt(q) }).toBuffer();
    } else if (f === 'jpg' || f === 'jpeg') {
      outputBuffer = await image.jpeg({ 
        quality: parseInt(q), 
        mozjpeg: true, 
        progressive: true 
      }).toBuffer();
    } else if (f === 'png') {
      outputBuffer = await image.png({ quality: parseInt(q) }).toBuffer();
    } else {
      outputBuffer = await image.webp({ quality: parseInt(q) }).toBuffer();
    }
    
    // Cache the result (async)
    s3.putObject({
      Bucket: bucket,
      Key: cacheKey,
      Body: outputBuffer,
      ContentType: getMimeType(f),
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise().catch(err => {
      console.warn(`⚠️ Cache write failed: ${err.message}`);
    });
    
    console.log(`✅ Processed: ${s3Key} → ${outputBuffer.length} bytes`);
    
    res.setHeader('Content-Type', getMimeType(f));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Cache', 'Miss');
    res.send(outputBuffer);
    
  } catch (error) {
    console.error('❌ Image resize error:', error);
    
    if (error.code === 'NoSuchKey') {
      res.status(404).send('Image not found');
    } else {
      res.status(500).send(error.message);
    }
  }
});

// Helper function for MIME types
function getMimeType(format) {
  const types = {
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png'
  };
  return types[format] || 'image/webp';
}

// Serve test file
app.get('/test-enterprise-upload.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-enterprise-upload.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GhostMaker Studio server running on port ${PORT}`);
  console.log(`💳 Stripe configured: ${process.env.STRIPE_SECRET_KEY ? '✅ Yes' : '❌ No'}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: public/ and src/`);
});

module.exports = app;
