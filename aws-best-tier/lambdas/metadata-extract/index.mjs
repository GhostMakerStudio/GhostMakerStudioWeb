import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import sharp from 'sharp';
import { encode } from 'blurhash';
import crypto from 'crypto';

const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const ASSET_TABLE = process.env.ASSET_TABLE;

export const handler = async (input) => {
  const { bucket, key, size } = input;
  
  console.log(`Extracting metadata for ${bucket}/${key}`);
  
  try {
    // Parse file info
    const pathParts = key.split('/');
    const projectId = pathParts[1] || 'unknown';
    const filename = pathParts[pathParts.length - 1];
    const ext = filename.split('.').pop().toLowerCase();
    
    // Determine type
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'gif'];
    const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
    
    let type = 'unknown';
    if (imageExts.includes(ext)) type = 'image';
    else if (videoExts.includes(ext)) type = 'video';
    
    // Get object metadata
    const headCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const headResult = await s3Client.send(headCommand);
    const contentType = headResult.ContentType || 'application/octet-stream';
    
    const mediaId = headResult.Metadata?.mediaid || crypto.randomUUID();
    
    // For images, extract dimensions and generate BlurHash
    let width = null;
    let height = null;
    let blurhash = null;
    let perceptualHash = null;
    
    if (type === 'image' && size < 20 * 1024 * 1024) { // Only process images < 20MB
      try {
        // Download image
        const imageData = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const buffer = Buffer.from(await imageData.Body.transformToByteArray());
        
        // Extract metadata
        const image = sharp(buffer);
        const metadata = await image.metadata();
        width = metadata.width;
        height = metadata.height;
        
        // Generate BlurHash (resize to 32x32 for speed)
        const resized = await image
          .resize(32, 32, { fit: 'inside' })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        blurhash = encode(
          new Uint8ClampedArray(resized.data),
          resized.info.width,
          resized.info.height,
          4,
          3
        );
        
        // Generate simple perceptual hash (for dedupe)
        const phashImage = await sharp(buffer)
          .resize(8, 8, { fit: 'fill' })
          .greyscale()
          .raw()
          .toBuffer();
        
        perceptualHash = crypto.createHash('sha256').update(phashImage).digest('hex').substring(0, 16);
        
        console.log(`Image metadata: ${width}x${height}, blurhash: ${blurhash}`);
        
      } catch (imgError) {
        console.error('Failed to extract image metadata:', imgError);
      }
    }
    
    // Save to DynamoDB
    const assetRecord = {
      id: mediaId,
      projectId,
      filename,
      originalKey: key,
      type,
      contentType,
      size,
      status: 'processing',
      uploadedAt: new Date().toISOString(),
      width,
      height,
      blurhash,
      perceptualHash,
      versionNumber: 1
    };
    
    await ddb.send(new PutCommand({
      TableName: ASSET_TABLE,
      Item: assetRecord
    }));
    
    console.log(`Saved metadata for ${mediaId}`);
    
    return {
      type,
      bucket,
      key,
      mediaId,
      projectId,
      width,
      height,
      blurhash,
      perceptualHash,
      contentType
    };
    
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    throw error;
  }
};

