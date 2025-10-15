// Local On-Demand Image Resize Proxy
// Use this during development before deploying to Lambda/CloudFront

import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CACHE_PREFIX = 'proxy-cache/';

/**
 * On-demand image resize endpoint
 * GET /img/{key}?w=1280&q=80&f=webp
 */
export async function imgResize(req, res) {
  try {
    // Parse path and query params
    const s3Key = req.params[0]; // matches /img/* route
    const { w = '1280', q = '80', f = 'webp' } = req.query;
    
    const width = parseInt(w, 10);
    const quality = parseInt(q, 10);
    const format = f.toLowerCase();
    
    console.log(`🖼️ Image resize request: ${s3Key} (${width}w, ${quality}q, ${format})`);
    
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX}${s3Key.replace(/\//g, '_')}_w${width}_q${quality}.${format}`;
    
    // Check cache first
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cacheKey }));
      
      const cached = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: cacheKey }));
      const chunks = [];
      for await (const chunk of cached.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      console.log(`✅ Cache hit: ${cacheKey}`);
      
      res.setHeader('Content-Type', getMimeType(format));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Cache', 'Hit');
      return res.send(buffer);
      
    } catch (cacheError) {
      // Cache miss, continue to processing
      console.log(`⏭️ Cache miss: ${cacheKey}`);
    }
    
    // Download original from S3
    const original = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    const chunks = [];
    for await (const chunk of original.Body) {
      chunks.push(chunk);
    }
    const originalBuffer = Buffer.concat(chunks);
    
    // Process image
    let image = sharp(originalBuffer).rotate(); // Auto-rotate based on EXIF
    
    const metadata = await image.metadata();
    
    // Resize if needed
    if (metadata.width && metadata.width > width) {
      image = image.resize({ width, withoutEnlargement: true });
    }
    
    // Convert format and encode
    const outputBuffer = await encodeImage(image, format, quality);
    
    // Save to cache (async, don't wait)
    s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: cacheKey,
      Body: outputBuffer,
      ContentType: getMimeType(format),
      CacheControl: 'public, max-age=31536000, immutable'
    })).then(() => {
      console.log(`✅ Cached: ${cacheKey}`);
    }).catch(err => {
      console.warn(`⚠️ Cache write failed: ${err.message}`);
    });
    
    console.log(`✅ Processed: ${s3Key} → ${outputBuffer.length} bytes`);
    
    res.setHeader('Content-Type', getMimeType(format));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Cache', 'Miss');
    res.send(outputBuffer);
    
  } catch (error) {
    console.error('❌ Image resize error:', error);
    
    if (error.Code === 'NoSuchKey' || error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.status(500).json({ error: error.message });
  }
}

async function encodeImage(image, format, quality) {
  if (format === 'webp') {
    return image.webp({ quality }).toBuffer();
  } else if (format === 'avif') {
    return image.avif({ quality: Math.max(50, quality - 20) }).toBuffer();
  } else if (format === 'jpg' || format === 'jpeg') {
    return image.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
  } else if (format === 'png') {
    return image.png({ quality }).toBuffer();
  } else {
    // Default to WebP
    return image.webp({ quality }).toBuffer();
  }
}

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

