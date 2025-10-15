# AWS Lambda Background Processing - Setup Guide

## What This Does

Instead of your website waiting 5+ minutes to process each video/image upload, it now:
1. ✅ **Uploads the original file instantly** (1-5 seconds)
2. ✅ **Returns success to user immediately**
3. ✅ **AWS Lambda processes everything in the background** (thumbnails, HLS, quality versions)
4. ✅ **You can upload 100 files at once** - no waiting!

---

## Step 1: Update Your Server Code

### 1.1 Replace Upload Endpoint

Open `server.js` and find the `/api/upload` endpoint (around line 1048).

**Delete lines 1048-1561** (the entire current upload endpoint)

**Replace with** the code from `server-upload-simplified.js`

### 1.2 Remove Old Processing Functions

You can now **delete** these functions from `server.js` (they're no longer needed):
- `generateThumbnail` (lines 34-49)
- `generateVideoThumbnail` (lines 51-69)
- `generateHLSAdaptiveStreaming` (lines 71-182)
- `generateMasterPlaylist` (lines 184-200)
- `generateVideoQualities` (lines 202-252)

---

## Step 2: Create Lambda Functions in AWS Console

### 2.1 Package Lambda Functions

Open PowerShell/Terminal in the `lambda/` folder and run:

```bash
cd lambda
npm install
```

**For Windows:**
```bash
deploy.bat
```

**For Mac/Linux:**
```bash
chmod +x deploy.sh
./deploy.sh
```

This creates:
- `imageProcessor.zip`
- `videoProcessor.zip`

### 2.2 Create Image Processor Lambda

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Click **"Create function"**
3. Choose **"Author from scratch"**
4. Fill in:
   - **Function name:** `ghostmaker-image-processor`
   - **Runtime:** Node.js 18.x
   - **Architecture:** x86_64
5. Click **"Create function"**

6. **Upload Code:**
   - Click **"Upload from"** → **".zip file"**
   - Select `imageProcessor.zip`
   - Click **"Save"**

7. **Configure Settings:**
   - Go to **"Configuration"** → **"General configuration"**
   - Click **"Edit"**
   - Set:
     - **Memory:** 1024 MB
     - **Timeout:** 5 minutes
   - Click **"Save"**

8. **Set Environment Variables:**
   - Go to **"Configuration"** → **"Environment variables"**
   - Click **"Edit"** → **"Add environment variable"**
   - Add these:
     - `DYNAMODB_MEDIA_TABLE` = `ghostmaker-media`
     - `S3_BUCKET` = `ghostmaker-studio-media`
     - `CLOUDFRONT_DOMAIN` = `d17lfecj9hzae.cloudfront.net`
   - Click **"Save"**

9. **Add Permissions:**
   - Go to **"Configuration"** → **"Permissions"**
   - Click on the **Role name** (opens IAM)
   - Click **"Add permissions"** → **"Attach policies"**
   - Search and attach:
     - `AmazonS3FullAccess`
     - `AmazonDynamoDBFullAccess`
   - Click **"Add permissions"**

### 2.3 Create Video Processor Lambda

**Repeat Step 2.2** but with these changes:
- **Function name:** `ghostmaker-video-processor`
- **Upload:** `videoProcessor.zip`
- **Memory:** 3008 MB (video processing needs more)
- **Timeout:** 10 minutes
- **Ephemeral storage:** 2048 MB (videos are large)

**To set Ephemeral storage:**
- Go to **"Configuration"** → **"General configuration"**
- Click **"Edit"**
- Set **Ephemeral storage** to 2048 MB

**Important for Video Lambda:**
- Go to **"Layers"** tab
- Click **"Add a layer"**
- Choose **"Specify an ARN"**
- Enter: `arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4`
  - (Replace `us-east-1` with your region if different)
  - This adds FFmpeg to your Lambda
- Click **"Add"**

**If FFmpeg layer doesn't work**, you'll need to:
1. Build a custom Lambda layer with FFmpeg
2. OR use AWS MediaConvert (paid service)
3. OR deploy video processing to an EC2 instance

---

## Step 3: Connect S3 to Lambda (Auto-Trigger)

### 3.1 Image Processing Trigger

1. Open `ghostmaker-image-processor` Lambda
2. Click **"Add trigger"**
3. Choose **"S3"**
4. Configure:
   - **Bucket:** `ghostmaker-studio-media`
   - **Event type:** `PUT`
   - **Prefix:** `projects/`
   - **Suffix:** Leave empty (processes all images)
   - Check **"I acknowledge..."**
5. Click **"Add"**

### 3.2 Video Processing Trigger

1. Open `ghostmaker-video-processor` Lambda
2. Click **"Add trigger"**
3. Choose **"S3"**
4. Configure:
   - **Bucket:** `ghostmaker-studio-media`
   - **Event type:** `PUT`
   - **Prefix:** `projects/`
   - **Suffix:** `.mp4` (only videos)
5. Click **"Add"**

**Note:** You can add multiple triggers for different video formats:
- `.mp4`
- `.mov`
- `.avi`
- `.webm`

---

## Step 4: Update DynamoDB Table

Your Lambda functions need to update the media table with a composite key.

### 4.1 Check Your Table Keys

1. Go to [DynamoDB Console](https://console.aws.amazon.com/dynamodb)
2. Click on `ghostmaker-media` table
3. Go to **"Indexes"** tab
4. Your **Partition key** should be: `id`
5. Your **Sort key** should be: `projectId`

**If your table doesn't have this:**

You need to recreate it or migrate. The Lambda code expects:
- **Partition key:** `id` (String)
- **Sort key:** `projectId` (String)

---

## Step 5: Test the System

### 5.1 Upload a Test Image

1. Start your server: `npm start`
2. Go to admin dashboard
3. Upload a small image file
4. You should get **instant success response**
5. Check S3 bucket after 10-20 seconds - you'll see:
   ```
   projects/
     └── proj_xxx/
         └── media/
             └── media_123456/
                 ├── original.jpg
                 ├── thumb.jpg
                 ├── 320w.jpg
                 ├── 320w.webp
                 ├── 640w.jpg
                 ├── 640w.webp
                 └── ... (all quality versions)
   ```

### 5.2 Upload a Test Video

1. Upload a short video (10-30 seconds)
2. Should get instant success
3. Check S3 after 1-2 minutes:
   ```
   projects/
     └── proj_xxx/
         └── media/
             └── media_789012/
                 ├── original.mp4
                 ├── thumb.jpg
                 ├── hls/
                 │   ├── master.m3u8
                 │   ├── 480p/
                 │   ├── 720p/
                 │   └── 1080p/
                 └── downloads/
                     ├── 1080p.mp4
                     └── original.mp4
   ```

### 5.3 Monitor Lambda Processing

**View Lambda Logs:**
1. Go to Lambda Console
2. Click on your function
3. Go to **"Monitor"** tab
4. Click **"View CloudWatch logs"**
5. Click on latest log stream
6. You'll see processing steps and any errors

---

## Step 6: Check Processing Status (Frontend)

You can poll the new endpoint to check if Lambda finished:

```javascript
async function checkProcessingStatus(mediaId, projectId) {
  const response = await fetch(`/api/media/${mediaId}/status?projectId=${projectId}`);
  const data = await response.json();
  
  console.log('Processing status:', data.status);
  // Status values: 'pending', 'processing', 'completed', 'failed'
  
  if (data.status === 'completed') {
    console.log('Thumbnail:', data.thumbnailUrl);
    console.log('Video qualities:', data.videoQualities);
    console.log('Image qualities:', data.imageQualities);
  }
  
  if (data.status === 'failed') {
    console.error('Processing failed:', data.processingError);
  }
}

// Example: Check status every 5 seconds
const mediaId = 'media_1234567890';
const projectId = 'proj_xyz';
const checkInterval = setInterval(async () => {
  const response = await fetch(`/api/media/${mediaId}/status?projectId=${projectId}`);
  const data = await response.json();
  
  if (data.status === 'completed' || data.status === 'failed') {
    clearInterval(checkInterval);
    console.log('Processing finished:', data);
  }
}, 5000);
```

---

## Troubleshooting

### Images Not Processing

**Check Lambda Logs:**
1. Lambda Console → `ghostmaker-image-processor`
2. Monitor → CloudWatch logs
3. Look for errors

**Common Issues:**
- Sharp not installed: Redeploy with `npm install sharp`
- Permissions: Make sure Lambda role has S3 and DynamoDB access
- DynamoDB key mismatch: Check table has `id` + `projectId` keys

### Videos Not Processing

**Check if FFmpeg is available:**
1. Lambda Console → `ghostmaker-video-processor`
2. Test with this code:
   ```javascript
   const { spawn } = require('child_process');
   exports.handler = async () => {
     return new Promise((resolve) => {
       const ffmpeg = spawn('ffmpeg', ['-version']);
       ffmpeg.stdout.on('data', (data) => console.log(data.toString()));
       ffmpeg.on('close', () => resolve({ statusCode: 200 }));
     });
   };
   ```

**If FFmpeg missing:**
- Add FFmpeg Lambda layer (see Step 2.3)
- OR use AWS MediaConvert instead
- OR deploy video processing to EC2

### Lambda Timeout

**If processing takes too long:**
1. Increase timeout (max 15 minutes)
2. Increase memory (more memory = faster processing)
3. Reduce quality options in Lambda code

### High AWS Costs

**Optimization tips:**
- Use S3 Lifecycle policies (move old files to Glacier)
- Enable CloudFront caching (reduce S3 requests)
- Set Lambda memory to minimum needed
- Use Lambda reserved concurrency to limit parallel executions

---

## Cost Estimate

### AWS Lambda Free Tier:
- **1 million requests/month FREE**
- **400,000 GB-seconds compute FREE**

### Example Monthly Cost (after free tier):

**100 uploads/day = 3,000/month**
- Image processing: ~10 seconds each = 30,000 seconds
- Video processing: ~120 seconds each = 360,000 seconds
- Total: ~390,000 seconds (within free tier!)

**Estimated cost: $0-5/month** for typical usage

---

## Next Steps

1. ✅ Test with small files first
2. ✅ Monitor Lambda logs
3. ✅ Add frontend polling for processing status
4. ✅ Update UI to show "Processing..." status
5. ✅ Add webhook/SNS notification when processing completes (optional)

---

## Summary

**Before:**
- Upload 1 file → Wait 5 minutes → Upload next → Wait 5 minutes...
- Server does all processing
- Can't upload multiple files

**After:**
- Upload 100 files → All done in seconds!
- Lambda processes in background
- Users never wait
- Infinitely scalable

🎉 **You're done!** Your media processing is now fully automated and scalable.

