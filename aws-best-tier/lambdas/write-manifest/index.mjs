import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const ASSET_TABLE = process.env.ASSET_TABLE;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

export const handler = async (input) => {
  const { meta, image, mcResult } = input;
  const { mediaId, projectId, type } = meta;
  
  console.log(`Writing manifest for ${mediaId}`);
  
  try {
    const processed = {};
    
    if (type === 'image' && image) {
      // Image processing complete
      processed.lqip = image.variants.lqip;
      processed.onDemandResize = true; // Images use on-demand resize
    }
    
    if (type === 'video' && mcResult) {
      // Video processing complete
      const outputPrefix = `processed/${projectId}/${mediaId}/`;
      
      processed.hls = `https://${CLOUDFRONT_DOMAIN}/${outputPrefix}hls/master.m3u8`;
      processed.poster = `https://${CLOUDFRONT_DOMAIN}/${outputPrefix}poster.0000000.jpg`;
      
      // HLS variants
      processed.variants = [
        {
          quality: '1080p',
          url: `https://${CLOUDFRONT_DOMAIN}/${outputPrefix}hls/master_1080p.m3u8`,
          width: 1920,
          height: 1080
        },
        {
          quality: '720p',
          url: `https://${CLOUDFRONT_DOMAIN}/${outputPrefix}hls/master_720p.m3u8`,
          width: 1280,
          height: 720
        },
        {
          quality: '480p',
          url: `https://${CLOUDFRONT_DOMAIN}/${outputPrefix}hls/master_480p.m3u8`,
          width: 854,
          height: 480
        }
      ];
    }
    
    // Update DynamoDB
    await ddb.send(new UpdateCommand({
      TableName: ASSET_TABLE,
      Key: { id: mediaId, projectId },
      UpdateExpression: 'SET #status = :status, processed = :processed, processedAt = :processedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'ready',
        ':processed': processed,
        ':processedAt': new Date().toISOString()
      }
    }));
    
    console.log(`Manifest written for ${mediaId}`);
    
    return {
      mediaId,
      status: 'ready',
      processed
    };
    
  } catch (error) {
    console.error('Failed to write manifest:', error);
    throw error;
  }
};

