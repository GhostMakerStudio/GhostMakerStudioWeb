// SIMPLIFIED UPLOAD ENDPOINT FOR SERVER.JS
// Replace your current /api/upload endpoint (lines 1048-1561) with this code

// File Upload to S3 (Simplified - Lambda handles processing)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { projectId, fileName } = req.body;
    const file = req.file;
    
    console.log('📤 Uploading file:', fileName, 'to project:', projectId);
    
    // Generate unique filename with media-specific folder structure
    const timestamp = Date.now();
    const fileExtension = path.extname(fileName);
    const baseFileName = path.basename(fileName, fileExtension);
    const mediaId = `media_${timestamp}`;
    
    // Create media-specific folder structure: projects/{projectId}/media/{mediaId}/
    const mediaFolder = `projects/${projectId}/media/${mediaId}`;
    const s3Key = `${mediaFolder}/${baseFileName}${fileExtension}`;
    
    // Upload original to S3 (Lambda will handle the rest automatically)
    const uploadParams = {
      Bucket: process.env.S3_BUCKET || 'ghostmaker-studio-media',
      Key: s3Key,
      Body: require('fs').createReadStream(file.path), // Stream for better memory usage
      ContentType: file.mimetype
    };

    console.log('☁️ Uploading to S3...');
    const s3Result = await s3.upload(uploadParams).promise();
    console.log('✅ Original uploaded to S3:', s3Result.Location);
    
    // Clean up local file immediately
    require('fs').unlinkSync(file.path);
    
    // Generate public URL (convert S3 to CloudFront)
    const publicUrl = s3Result.Location.replace(
      'https://ghostmaker-studio-media.s3.amazonaws.com/', 
      'https://d17lfecj9hzae.cloudfront.net/'
    );
    
    // Get current media count for this project to determine position
    const existingMediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE,
      FilterExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    }).promise();
    
    const nextPosition = existingMediaResult.Items.length;

    // Create media record with initial data
    // Lambda will update this with thumbnails and quality versions
    const mediaRecord = {
      id: mediaId,
      projectId: projectId,
      originalName: fileName,
      fileName: `${baseFileName}${fileExtension}`,
      fileType: file.mimetype.startsWith('video/') ? 'video' : 'image',
      mimeType: file.mimetype,
      s3Key: s3Key,
      s3Url: publicUrl,
      thumbnailUrl: null, // Will be set by Lambda
      size: file.size,
      uploadDate: new Date().toISOString(),
      isCoverImage: false,
      position: nextPosition,
      processingStatus: 'pending', // Lambda will update to 'processing' then 'completed'
      urls: {
        original: publicUrl,
        thumbnail: null, // Will be set by Lambda
        ...(file.mimetype.startsWith('video/') && {
          hls: null // Will be set by Lambda
        })
      }
    };

    // Save media record to DynamoDB
    await dynamodb.put({
      TableName: MEDIA_TABLE,
      Item: mediaRecord
    }).promise();
    
    console.log('✅ Media record saved to DynamoDB:', mediaId);
    
    // If this is the first media item (position 0), set it as the cover image
    if (nextPosition === 0) {
      await dynamodb.update({
        TableName: PROJECTS_TABLE,
        Key: { id: projectId },
        UpdateExpression: 'SET coverImage = :coverImage',
        ExpressionAttributeValues: {
          ':coverImage': publicUrl
        }
      }).promise();
      console.log('🖼️ Set first media item as cover image:', publicUrl);
    }
    
    // Return response immediately - Lambda will process in background
    console.log('✅ Upload complete! Lambda will process thumbnails and quality versions in background');
    
    res.json({
      success: true,
      files: [{
        type: mediaRecord.fileType,
        url: publicUrl,
        alt: baseFileName,
        quality: 'original',
        size: file.size,
        mediaId: mediaRecord.id
      }],
      originalUrl: publicUrl,
      s3Key: s3Key,
      mediaId: mediaRecord.id,
      isCoverImage: nextPosition === 0,
      processingStatus: 'pending',
      message: 'Upload successful! Processing thumbnails and quality versions in background...'
    });
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path) {
      try {
        require('fs').unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Upload failed' 
    });
  }
});

// NEW ENDPOINT: Check media processing status
app.get('/api/media/:mediaId/status', async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId query parameter required' 
      });
    }
    
    const result = await dynamodb.get({
      TableName: MEDIA_TABLE,
      Key: { 
        id: mediaId,
        projectId: projectId
      }
    }).promise();
    
    if (!result.Item) {
      return res.status(404).json({ 
        success: false, 
        error: 'Media not found' 
      });
    }
    
    res.json({
      success: true,
      status: result.Item.processingStatus || 'unknown',
      thumbnailUrl: result.Item.thumbnailUrl,
      videoQualities: result.Item.videoQualities,
      imageQualities: result.Item.imageQualities,
      urls: result.Item.urls,
      processedAt: result.Item.processedAt,
      processingError: result.Item.processingError
    });
    
  } catch (error) {
    console.error('❌ Failed to get media status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

