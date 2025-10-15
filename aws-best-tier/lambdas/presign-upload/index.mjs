import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const s3 = new S3Client({});
const BUCKET = process.env.MEDIA_BUCKET;
const UPLOAD_PREFIX = process.env.UPLOAD_PREFIX || 'originals/';

export const handler = async (event) => {
  console.log('Presign upload request:', event.body);
  
  try {
    const { filename, contentType, parts = 5, projectId, mediaId } = JSON.parse(event.body || '{}');
    
    if (!filename || !contentType) {
      return respond(400, { error: 'filename and contentType required' });
    }
    
    // Generate unique key
    const key = `${UPLOAD_PREFIX}${projectId || 'unknown'}/${mediaId || crypto.randomUUID()}-${filename}`;
    
    // Create multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Metadata: {
        projectId: projectId || 'unknown',
        mediaId: mediaId || 'unknown',
        originalFilename: filename
      }
    });
    
    const multipartUpload = await s3.send(createCommand);
    const uploadId = multipartUpload.UploadId;
    
    // Generate presigned URLs for each part
    const presignedUrls = [];
    for (let partNumber = 1; partNumber <= parts; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      });
      
      const url = await getSignedUrl(s3, uploadPartCommand, { expiresIn: 3600 }); // 1 hour
      presignedUrls.push({ partNumber, url });
    }
    
    console.log(`Created multipart upload for ${key} with ${parts} parts`);
    
    return respond(200, {
      bucket: BUCKET,
      key,
      uploadId,
      presignedUrls
    });
    
  } catch (error) {
    console.error('Presign upload error:', error);
    return respond(500, { error: error.message });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}

