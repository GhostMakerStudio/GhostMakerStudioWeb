import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3 = new S3Client({});
const BUCKET = process.env.MEDIA_BUCKET;

export const handler = async (input) => {
  const { bucket, key, mediaId, project

Id } = input.meta;
  
  console.log(`Generating image variants for ${key}`);
  
  try {
    // Download original
    const original = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const buffer = Buffer.from(await original.Body.transformToByteArray());
    
    // Output folder
    const outputPrefix = `processed/${projectId}/${mediaId}/`;
    
    // Generate LQIP (Low Quality Image Placeholder) - tiny blur for instant loading
    console.log('Generating LQIP...');
    const lqip = await sharp(buffer)
      .resize(20, 20, { fit: 'inside' })
      .jpeg({ quality: 20, progressive: true })
      .toBuffer();
    
    const lqipKey = `${outputPrefix}lqip.jpg`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: lqipKey,
      Body: lqip,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    
    console.log(`LQIP saved: ${lqipKey}`);
    
    // Optional: Generate a few fixed sizes (blur placeholder, thumbnail)
    // Most sizes will be generated on-demand via img-resize function
    
    const variants = {
      lqip: `https://${process.env.CLOUDFRONT_DOMAIN}/${lqipKey}`
    };
    
    return {
      variants,
      outputPrefix
    };
    
  } catch (error) {
    console.error('Image variant generation failed:', error);
    throw error;
  }
};

