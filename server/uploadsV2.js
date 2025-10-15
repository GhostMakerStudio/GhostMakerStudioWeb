// V2 Upload Endpoints - Enterprise Media Pipeline Integration
// Connects Express server to AWS SAM infrastructure

import fetch from 'node-fetch';

const SAM_API = process.env.SAM_API_URL;

/**
 * Get pre-signed multipart upload URLs
 * POST /api/v2/uploads/presign
 */
export async function presignUpload(req, res) {
  try {
    const { filename, contentType, projectId, mediaId, parts = 5 } = req.body;
    
    if (!filename || !contentType) {
      return res.status(400).json({ 
        success: false, 
        error: 'filename and contentType required' 
      });
    }
    
    console.log(`📤 Requesting presigned upload for: ${filename}`);
    
    const response = await fetch(`${SAM_API}/uploads/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        contentType,
        projectId,
        mediaId,
        parts
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Presign failed:', data);
      return res.status(response.status).json({ success: false, error: data.error });
    }
    
    console.log(`✅ Presigned URLs generated for: ${filename}`);
    
    res.json({
      success: true,
      ...data
    });
    
  } catch (error) {
    console.error('❌ Presign upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Complete multipart upload
 * POST /api/v2/uploads/complete
 */
export async function completeUpload(req, res) {
  try {
    const { bucket, key, uploadId, parts } = req.body;
    
    // AWS SDK handles completion client-side, but we can track it here
    console.log(`✅ Upload completed: ${key}`);
    
    res.json({ success: true, message: 'Upload complete, processing started' });
    
  } catch (error) {
    console.error('❌ Complete upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get media processing status
 * GET /api/v2/media/:mediaId/status?projectId=xxx
 */
export async function getMediaStatus(req, res) {
  try {
    const { mediaId } = req.params;
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId query parameter required' 
      });
    }
    
    // Query DynamoDB directly (you already have this set up)
    const AWS = require('aws-sdk');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    const result = await dynamodb.get({
      TableName: process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media',
      Key: { id: mediaId, projectId }
    }).promise();
    
    if (!result.Item) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    
    res.json({
      success: true,
      status: result.Item.status || 'unknown',
      blurhash: result.Item.blurhash,
      processed: result.Item.processed,
      width: result.Item.width,
      height: result.Item.height,
      processedAt: result.Item.processedAt
    });
    
  } catch (error) {
    console.error('❌ Get media status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

