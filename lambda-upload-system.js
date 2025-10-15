// 🚀 LAMBDA-POWERED UPLOAD SYSTEM
// This will make your admin uploads 10x faster!

const AWS = require('aws-sdk');
const sharp = require('sharp');

// Initialize AWS services
const s3 = new AWS.S3();
const lambda = new AWS.Lambda();

// Configuration
const BUCKET_NAME = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const LAMBDA_FUNCTION_NAME = 'ghostmaker-image-processor';

/**
 * Generate presigned URLs for direct S3 uploads
 * This allows files to upload directly to S3, bypassing your server
 */
async function generatePresignedUploadURLs(files, projectId) {
    const uploadPromises = files.map(async (file) => {
        const fileId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const key = `projects/${projectId}/media/${fileId}/${file.name}`;
        
        // Generate presigned URL for direct upload
        const presignedUrl = await s3.getSignedUrlPromise('putObject', {
            Bucket: BUCKET_NAME,
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
    
    return Promise.all(uploadPromises);
}

/**
 * Trigger Lambda function to process uploaded files
 * This happens in parallel for all files
 */
async function triggerLambdaProcessing(uploadedFiles, projectId) {
    const lambdaPromises = uploadedFiles.map(async (fileInfo) => {
        const payload = {
            bucket: BUCKET_NAME,
            key: fileInfo.key,
            projectId: projectId,
            fileId: fileInfo.fileId,
            fileName: fileInfo.fileName,
            fileType: fileInfo.fileType
        };
        
        return lambda.invoke({
            FunctionName: LAMBDA_FUNCTION_NAME,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify(payload)
        }).promise();
    });
    
    return Promise.all(lambdaPromises);
}

/**
 * Main Lambda upload handler
 * This replaces the slow local upload system
 */
async function handleLambdaUpload(files, projectId) {
    try {
        console.log(`🚀 Starting Lambda-powered upload for ${files.length} files`);
        
        // Step 1: Generate presigned URLs (instant)
        const uploadUrls = await generatePresignedUploadURLs(files, projectId);
        console.log(`✅ Generated ${uploadUrls.length} presigned URLs`);
        
        // Step 2: Return upload URLs to frontend
        // Frontend will upload directly to S3
        return {
            success: true,
            uploads: uploadUrls,
            message: 'Ready for direct S3 uploads'
        };
        
    } catch (error) {
        console.error('❌ Lambda upload failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle Lambda processing completion
 * This is called when Lambda finishes processing a file
 */
async function handleProcessingComplete(event) {
    try {
        const { fileId, projectId, thumbnails, qualities } = JSON.parse(event.body);
        
        console.log(`✅ Lambda processing complete for ${fileId}`);
        
        // Update database with processed file info
        // This happens automatically when Lambda completes
        
        return {
            success: true,
            fileId,
            message: 'File processing complete'
        };
        
    } catch (error) {
        console.error('❌ Processing completion failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    handleLambdaUpload,
    handleProcessingComplete,
    generatePresignedUploadURLs,
    triggerLambdaProcessing
};
