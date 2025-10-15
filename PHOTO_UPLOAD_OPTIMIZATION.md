# Photo Upload to S3 - Optimization Guide

## Current Issues & Recommended Improvements

### 1. Replace Synchronous File Reads with Streams

**Current (❌ Bad):**
```javascript
Body: require('fs').readFileSync(file.path)
```

**Improved (✅ Good):**
```javascript
Body: fs.createReadStream(file.path)
```

### 2. Use multer-s3 for Direct S3 Uploads

**Install:**
```bash
npm install multer-s3
```

**Implementation:**
```javascript
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();

// Direct S3 upload configuration
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
    acl: 'public-read', // or 'private' if using CloudFront signed URLs
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, {
        fieldName: file.fieldname,
        projectId: req.body.projectId || 'unknown'
      });
    },
    key: function (req, file, cb) {
      const projectId = req.body.projectId;
      const timestamp = Date.now();
      const fileExtension = path.extname(file.originalname);
      const baseFileName = path.basename(file.originalname, fileExtension);
      const mediaId = `media_${timestamp}`;
      
      // Store mediaId in request for later use
      req.mediaId = mediaId;
      
      const s3Key = `projects/${projectId}/media/${mediaId}/${baseFileName}${fileExtension}`;
      cb(null, s3Key);
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});
```

### 3. Improved Upload Endpoint with Better Error Handling

```javascript
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;
  
  try {
    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { projectId, fileName } = req.body;
    const mediaId = req.mediaId;
    
    console.log('✅ File uploaded to S3:', uploadedFile.location);
    
    // CloudFront URL
    const publicUrl = uploadedFile.location.replace(
      'https://ghostmaker-studio-media.s3.amazonaws.com/', 
      'https://d17lfecj9hzae.cloudfront.net/'
    );
    
    // Now process thumbnails and multiple qualities
    // For this, you'll need to download from S3 to a temp location
    // OR use Lambda for async processing
    
    const mediaRecord = {
      id: mediaId,
      projectId: projectId,
      originalName: uploadedFile.originalname,
      fileName: uploadedFile.key.split('/').pop(),
      fileType: uploadedFile.mimetype.startsWith('video/') ? 'video' : 'image',
      mimeType: uploadedFile.mimetype,
      s3Key: uploadedFile.key,
      s3Url: publicUrl,
      size: uploadedFile.size,
      uploadDate: new Date().toISOString(),
      position: 0, // Update based on existing media count
      urls: {
        original: publicUrl
      }
    };
    
    // Save to DynamoDB
    await dynamodb.put({
      TableName: MEDIA_TABLE,
      Item: mediaRecord
    }).promise();
    
    // Trigger async processing for thumbnails/qualities
    // (recommend using AWS Lambda or a background job queue)
    
    res.json({
      success: true,
      mediaId: mediaRecord.id,
      url: publicUrl,
      s3Key: uploadedFile.key
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    
    // Rollback: Delete from S3 if DynamoDB save failed
    if (uploadedFile?.key) {
      try {
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
          Key: uploadedFile.key
        }).promise();
        console.log('🗑️ Rolled back S3 upload:', uploadedFile.key);
      } catch (deleteError) {
        console.error('❌ Failed to rollback S3 upload:', deleteError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Upload failed' 
    });
  }
});
```

### 4. Async Image/Video Processing with AWS Lambda

For production, move heavy processing (thumbnails, multiple qualities) to:
- **AWS Lambda** triggered by S3 events
- **Background job queue** (Bull, BullMQ)
- **Separate worker service**

**Why?**
- Upload endpoints should be fast (< 1s response)
- Video transcoding can take minutes
- Don't block the API server

**Lambda Example:**
```javascript
// lambda/processMedia.js
const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  
  // Download from S3
  const originalImage = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  
  // Generate thumbnail
  const thumbnail = await sharp(originalImage.Body)
    .resize(300, 300, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  // Upload thumbnail back to S3
  const thumbnailKey = key.replace(/\/([^/]+)$/, '/thumb.jpg');
  await s3.putObject({
    Bucket: bucket,
    Key: thumbnailKey,
    Body: thumbnail,
    ContentType: 'image/jpeg'
  }).promise();
  
  // Update DynamoDB with thumbnail URL
  // ...
  
  return { statusCode: 200, body: 'Processed' };
};
```

### 5. Better Error Handling & Cleanup

```javascript
// Add proper cleanup middleware
app.use((error, req, res, next) => {
  // Clean up multer files on error
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Upload failed' 
      : error.message
  });
});
```

### 6. Add Multipart Upload for Large Files (>100MB)

```javascript
const uploadLargeFile = async (filePath, s3Key, fileType) => {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: fileStream,
    ContentType: fileType
  };

  const options = {
    partSize: 10 * 1024 * 1024, // 10 MB parts
    queueSize: 4 // Upload 4 parts in parallel
  };

  return new Promise((resolve, reject) => {
    s3.upload(uploadParams, options)
      .on('httpUploadProgress', (progress) => {
        console.log(`Upload progress: ${Math.round(progress.loaded / progress.total * 100)}%`);
      })
      .send((err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
  });
};
```

### 7. Add Retry Logic

```javascript
const uploadWithRetry = async (params, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await s3.upload(params).promise();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Upload failed, retrying (${i + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
};
```

## Architecture Recommendation

### Current (Synchronous):
```
Client → API Server → S3
         ↓
         Process Images/Videos (blocks request)
         ↓
         DynamoDB
         ↓
         Response (slow)
```

### Recommended (Asynchronous):
```
Client → API Server → S3 (fast upload)
         ↓
         DynamoDB (original only)
         ↓
         Response (< 1s)
         
S3 Event → Lambda/Queue → Process → Update DynamoDB
                           (async, doesn't block user)
```

## Summary of Changes

| Issue | Current | Recommended |
|-------|---------|-------------|
| File reading | `fs.readFileSync()` | `fs.createReadStream()` |
| Upload method | Local → S3 | Direct to S3 with multer-s3 |
| Processing | Synchronous | Asynchronous (Lambda/Queue) |
| Error handling | Basic | Comprehensive with rollback |
| Large files | No optimization | Multipart upload |
| Retry logic | None | Exponential backoff |

## Next Steps

1. Install `multer-s3`: `npm install multer-s3`
2. Replace current multer config with multer-s3
3. Move image/video processing to Lambda or background jobs
4. Add S3 event triggers for Lambda
5. Implement retry logic and better error handling
6. Test with large files (100MB+)
7. Monitor S3/Lambda costs and optimize

## Cost Optimization Tips

- Use S3 Intelligent-Tiering for automatic cost savings
- Set lifecycle policies to move old media to S3 Glacier
- Use CloudFront to reduce S3 GET request costs
- Implement image/video lazy loading on frontend
- Consider WebP/AVIF formats (smaller file sizes)

