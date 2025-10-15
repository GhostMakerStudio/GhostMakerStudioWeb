// On-Demand Image Resize Lambda
// Serves images with dynamic sizing and caching

const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CACHE_PREFIX = 'proxy-cache/';

exports.handler = async (event) => {
  console.log('🖼️ Image resize request:', event.path);
  
  try {
    // Parse path: /img/{key}?w=1280&q=80&f=webp
    const pathMatch = event.path.match(/^\/img\/(.+)$/);
    if (!pathMatch) {
      return { statusCode: 404, body: 'Not found' };
    }
    
    const key = decodeURIComponent(pathMatch[1]);
    const params = event.queryStringParameters || {};
    
    const width = parseInt(params.w || '1280', 10);
    const quality = parseInt(params.q || '80', 10);
    const format = (params.f || 'webp').toLowerCase();
    
    console.log(`Resize: ${key} → ${width}w, ${quality}q, ${format}`);
    
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX}${key.replace(/\//g, '_')}_w${width}_q${quality}.${format}`;
    
    // Check cache first
    try {
      await s3.headObject({ Bucket: BUCKET, Key: cacheKey }).promise();
      
      // Cache hit! Return cached version
      const cached = await s3.getObject({ Bucket: BUCKET, Key: cacheKey }).promise();
      
      console.log(`✅ Cache hit: ${cacheKey}`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': getMimeType(format),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'Hit'
        },
        body: cached.Body.toString('base64'),
        isBase64Encoded: true
      };
    } catch (cacheError) {
      // Cache miss, continue to processing
      console.log(`⏭️ Cache miss: ${cacheKey}`);
    }
    
    // Download original
    const original = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
    const buffer = Buffer.from(original.Body);
    
    // Process image
    let image = sharp(buffer).rotate(); // Auto-rotate based on EXIF
    
    const metadata = await image.metadata();
    
    // Resize if needed
    if (metadata.width && metadata.width > width) {
      image = image.resize({ width, withoutEnlargement: true });
    }
    
    // Convert format
    let outputBuffer;
    if (format === 'webp') {
      outputBuffer = await image.webp({ quality }).toBuffer();
    } else if (format === 'jpg' || format === 'jpeg') {
      outputBuffer = await image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
    } else if (format === 'png') {
      outputBuffer = await image.png({ quality }).toBuffer();
    } else {
      // Default to WebP
      outputBuffer = await image.webp({ quality }).toBuffer();
    }
    
    // Save to cache (async, don't wait)
    s3.putObject({
      Bucket: BUCKET,
      Key: cacheKey,
      Body: outputBuffer,
      ContentType: getMimeType(format),
      CacheControl: 'public, max-age=31536000, immutable'
    }).promise().then(() => {
      console.log(`✅ Cached: ${cacheKey}`);
    }).catch(err => {
      console.warn(`⚠️ Cache write failed: ${err.message}`);
    });
    
    console.log(`✅ Processed: ${key} → ${outputBuffer.length} bytes`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': getMimeType(format),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Cache': 'Miss'
      },
      body: outputBuffer.toString('base64'),
      isBase64Encoded: true
    };
    
  } catch (error) {
    console.error('❌ Image resize error:', error);
    
    if (error.code === 'NoSuchKey') {
      return { statusCode: 404, body: 'Image not found' };
    }
    
    return { statusCode: 500, body: error.message };
  }
};

function getMimeType(format) {
  const types = {
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png'
  };
  return types[format] || 'image/webp';
}



