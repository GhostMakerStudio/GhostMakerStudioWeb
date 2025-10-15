// Simplified Video Processor Lambda
// Triggers MediaConvert for video processing

const AWS = require('aws-sdk');

const mediaconvert = new AWS.MediaConvert({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd17lfecj9hzae.cloudfront.net';

exports.handler = async (event) => {
  console.log('🎥 ===== VIDEO LAMBDA FUNCTION STARTED =====');
  console.log('🎥 Video processor triggered:', JSON.stringify(event, null, 2));
  
  try {
    // Get S3 object info from event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`📁 Bucket: ${bucket}`);
    console.log(`📁 Key: ${key}`);
    console.log(`🎥 Processing video: ${key}`);
    
    // Skip if not a video or already processed
    if (!key.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      console.log('⏭️ Not a video file, skipping');
      return { statusCode: 200, body: 'Not a video file' };
    }
    
    if (key.includes('/hls/') || key.includes('/processed/')) {
      console.log('⏭️ Skipping already processed file');
      return { statusCode: 200, body: 'Already processed' };
    }
    
    // Extract project info
    const pathParts = key.split('/');
    console.log(`📁 Path parts: ${JSON.stringify(pathParts)}`);
    
    if (pathParts.length < 2) {
      console.log('⏭️ Not a project file');
      return { statusCode: 200, body: 'Not a project file' };
    }
    
    const projectId = pathParts[1] || 'unknown';
    const filename = pathParts[pathParts.length - 1];
    // Extract mediaId from filename (everything before the last dash and file extension)
    const mediaId = filename.replace(/\.[^/.]+$/, '').split('-').slice(0, -1).join('-') || Date.now().toString();
    
    console.log(`📁 Project: ${projectId}`);
    console.log(`📁 Filename: ${filename}`);
    console.log(`📁 Media ID: ${mediaId}`);
    
    // Check if file exists in S3 first
    console.log(`📥 Checking if video exists in S3: ${bucket}/${key}`);
    try {
      await s3.headObject({ Bucket: bucket, Key: key }).promise();
      console.log(`✅ Video file confirmed in S3`);
    } catch (s3Error) {
      console.error(`❌ Video file not found in S3: ${s3Error.message}`);
      return { statusCode: 404, body: 'Video file not found' };
    }
    
    // For now, skip MediaConvert and just mark as ready
    // TODO: Add MediaConvert processing later
    console.log(`🎬 Skipping MediaConvert for now - marking video as ready`);
    
    // Simulate a MediaConvert job ID for now
    const mockJobId = `mock-job-${Date.now()}`;
    console.log(`🎬 Mock MediaConvert job ID: ${mockJobId}`);
    
    // Update DynamoDB with job info
    console.log(`💾 Updating DynamoDB...`);
    const assetRecord = {
      id: mediaId,
      projectId: projectId,
      filename: filename,
      originalKey: key,
      type: 'video',
      status: 'ready', // Mark as ready for now
      mediaconvertJobId: mockJobId,
      uploadedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      versionNumber: 1,
      note: 'MediaConvert processing disabled for now'
    };
    
    console.log(`💾 DynamoDB record: ${JSON.stringify(assetRecord, null, 2)}`);
    
    await dynamodb.put({
      TableName: MEDIA_TABLE,
      Item: assetRecord
    }).promise();
    
    console.log(`✅ DynamoDB updated successfully`);
    console.log(`✅ ===== VIDEO PROCESSING STARTED FOR ${mediaId} =====`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Video processing complete (MediaConvert disabled)',
        mediaId: mediaId,
        jobId: mockJobId
      })
    };
    
  } catch (error) {
    console.error('❌ ===== VIDEO LAMBDA FUNCTION FAILED =====');
    console.error('❌ Video processing failed:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ ===== END ERROR =====');
    
    // Try to update DynamoDB with error status
    try {
      const record = event.Records[0];
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      const pathParts = key.split('/');
      const projectId = pathParts[1] || 'unknown';
      const filename = pathParts[pathParts.length - 1];
      const mediaId = filename.replace(/\.[^/.]+$/, '').split('-').slice(0, -1).join('-') || Date.now().toString();
      
      const errorRecord = {
        id: mediaId,
        projectId: projectId,
        filename: filename,
        originalKey: key,
        type: 'video',
        status: 'error',
        error: error.message,
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        versionNumber: 1
      };
      
      await dynamodb.put({
        TableName: MEDIA_TABLE,
        Item: errorRecord
      }).promise();
      
      console.log(`✅ Error status saved to DynamoDB`);
    } catch (dbError) {
      console.error(`❌ Failed to save error status: ${dbError.message}`);
    }
    
    throw error;
  }
};
