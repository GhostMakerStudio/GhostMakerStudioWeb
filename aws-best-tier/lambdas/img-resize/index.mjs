import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3 = new S3Client({});
const BUCKET = process.env.MEDIA_BUCKET;
const CACHE_PREFIX = process.env.IMAGE_CACHE_PREFIX || 'proxy-cache/';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export const handler = async (event) => {
  console.log('Image resize request:', event.rawPath);
  
  try {
    // Parse path: /img/{key}?w=1280&q=80&f=webp
    const key = decodeURIComponent(event.rawPath.replace(/^\/img\//, ''));
    const params = event.queryStringParameters || {};
    
    const width = parseInt(params.w || '1280', 10);
    const quality = parseInt(params.q || '80', 10);
    const format = (params.f || 'webp').toLowerCase();
    
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX}${key.replace(/\//g, '_')}_w${width}_q${quality}.${format}`;
    
    // Check cache first
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cacheKey }));
      
      // Cache hit! Return cached version
      const cached = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: cacheKey }));
      const buffer = Buffer.from(await cached.Body.transformToByteArray());
      
      console.log(`Cache hit: ${cacheKey}`);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': getMimeType(format),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache': 'Hit'
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    } catch (cacheError) {
      // Cache miss, continue to processing
      console.log(`Cache miss: ${cacheKey}`);
    }
    
    // Download original
    const original = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const buffer = Buffer.from(await original.Body.transformToByteArray());
    
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
    } else if (format === 'avif') {
      outputBuffer = await image.avif({ quality: Math.max(50, quality - 20) }).toBuffer();
    } else if (format === 'jpg' || format === 'jpeg') {
      outputBuffer = await image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
    } else {
      // Default to WebP
      outputBuffer = await image.webp({ quality }).toBuffer();
    }
    
    // Save to cache
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: cacheKey,
      Body: outputBuffer,
      ContentType: getMimeType(format),
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    
    console.log(`Processed and cached: ${cacheKey} (${outputBuffer.length} bytes)`);
    
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
    console.error('Image resize error:', error);
    
    return {
      statusCode: error.Code === 'NoSuchKey' ? 404 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};

function getMimeType(format) {
  const types = {
    'webp': 'image/webp',
    'avif': 'image/avif',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png'
  };
  return types[format] || 'image/webp';
}

