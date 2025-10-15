// AWS Lambda Function - MediaConvert Job Complete Handler
// Triggered by EventBridge when MediaConvert jobs finish
// Updates DynamoDB with final URLs and status

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';
const PROJECTS_TABLE = process.env.DYNAMODB_PROJECTS_TABLE || 'ghostmaker-projects';
const S3_BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd17lfecj9hzae.cloudfront.net';

exports.handler = async (event) => {
  console.log('✅ MediaConvert job complete event received');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const detail = event.detail;
    const status = detail.status;
    const jobId = detail.jobId;
    const userMetadata = detail.userMetadata || {};
    
    const projectId = userMetadata.projectId;
    const mediaId = userMetadata.mediaId;
    const bucket = userMetadata.bucket || S3_BUCKET;
    
    console.log(`Job ${jobId} status: ${status}`);
    console.log(`Project: ${projectId}, Media: ${mediaId}`);
    
    if (!projectId || !mediaId) {
      console.error('❌ Missing projectId or mediaId in job metadata');
      return { statusCode: 400, body: 'Missing metadata' };
    }
    
    if (status === 'COMPLETE') {
      // Job succeeded - update DynamoDB with URLs
      const mediaFolder = `projects/${projectId}/media/${mediaId}`;
      
      // Find the HLS master playlist
      const hlsMasterUrl = `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master.m3u8`;
      
      // Find thumbnail (MediaConvert creates thumb.0000000.jpg)
      let thumbnailUrl = null;
      try {
        const thumbList = await s3.listObjectsV2({
          Bucket: bucket,
          Prefix: `${mediaFolder}/`,
          MaxKeys: 50
        }).promise();
        
        const thumbFile = thumbList.Contents.find(obj => obj.Key.includes('_thumb.'));
        if (thumbFile) {
          thumbnailUrl = `https://${CLOUDFRONT_DOMAIN}/${thumbFile.Key}`;
        }
      } catch (error) {
        console.warn('⚠️ Failed to find thumbnail:', error.message);
      }
      
      // Build video qualities array
      const videoQualities = [
        {
          quality: '1080p',
          url: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master_1080p.m3u8`,
          width: 1920,
          height: 1080,
          bitrate: '5000k',
          resolution: '1080p',
          isHLS: true
        },
        {
          quality: '720p',
          url: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master_720p.m3u8`,
          width: 1280,
          height: 720,
          bitrate: '2500k',
          resolution: '720p',
          isHLS: true
        },
        {
          quality: '480p',
          url: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/hls/master_480p.m3u8`,
          width: 854,
          height: 480,
          bitrate: '1000k',
          resolution: '480p',
          isHLS: true
        }
      ];
      
      // Add downloadable version
      videoQualities.downloadableVersions = [
        {
          quality: '1080p',
          url: `https://${CLOUDFRONT_DOMAIN}/${mediaFolder}/downloads/master_1080p.mp4`,
          resolution: '1080p',
          type: 'download'
        }
      ];
      
      // Update DynamoDB
      await dynamodb.update({
        TableName: MEDIA_TABLE,
        Key: { id: mediaId, projectId: projectId },
        UpdateExpression: 'SET processingStatus = :status, thumbnailUrl = :thumbnailUrl, videoQualities = :videoQualities, urls.hls = :hlsUrl, urls.thumbnail = :thumbnailUrl, processedAt = :processedAt',
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':thumbnailUrl': thumbnailUrl,
          ':videoQualities': videoQualities,
          ':hlsUrl': hlsMasterUrl,
          ':processedAt': new Date().toISOString()
        }
      }).promise();
      
      console.log(`✅ Updated DynamoDB for media ${mediaId}`);
      
      // Update project cover image if this is the first media (position 0)
      try {
        const mediaItem = await dynamodb.get({
          TableName: MEDIA_TABLE,
          Key: { id: mediaId, projectId: projectId }
        }).promise();
        
        if (mediaItem.Item && mediaItem.Item.position === 0 && thumbnailUrl) {
          await dynamodb.update({
            TableName: PROJECTS_TABLE,
            Key: { id: projectId },
            UpdateExpression: 'SET coverImage = :coverImage',
            ExpressionAttributeValues: {
              ':coverImage': thumbnailUrl
            }
          }).promise();
          
          console.log(`✅ Updated project ${projectId} cover image`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to update project cover image:', error.message);
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Processing complete',
          mediaId: mediaId,
          hlsUrl: hlsMasterUrl,
          thumbnailUrl: thumbnailUrl
        })
      };
      
    } else if (status === 'ERROR' || status === 'CANCELED') {
      // Job failed - update status
      await dynamodb.update({
        TableName: MEDIA_TABLE,
        Key: { id: mediaId, projectId: projectId },
        UpdateExpression: 'SET processingStatus = :status, processingError = :error',
        ExpressionAttributeValues: {
          ':status': 'failed',
          ':error': detail.errorMessage || `Job ${status.toLowerCase()}`
        }
      }).promise();
      
      console.error(`❌ MediaConvert job failed for media ${mediaId}`);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Processing failed',
          mediaId: mediaId,
          error: detail.errorMessage
        })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Unhandled status: ${status}` })
    };
    
  } catch (error) {
    console.error('❌ Failed to handle MediaConvert completion:', error);
    throw error;
  }
};

