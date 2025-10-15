# AWS Lambda Background Processing - Quick Start

## 🎯 What You're Getting

**Before:** Upload 1 video → wait 5 minutes → upload next → wait 5 minutes...

**After:** Upload 100 videos → ALL done in seconds → Lambda processes in background!

---

## ✅ Quick Setup (30 minutes)

### 1️⃣ Update Your Code (5 min)

```bash
# Open server.js
# Delete lines 1048-1561 (old upload endpoint)
# Replace with code from: server-upload-simplified.js

# Delete these old functions:
# - generateThumbnail
# - generateVideoThumbnail  
# - generateHLSAdaptiveStreaming
# - generateMasterPlaylist
# - generateVideoQualities
```

### 2️⃣ Package Lambda Functions (2 min)

```bash
cd lambda
npm install
deploy.bat    # Windows
# OR
./deploy.sh   # Mac/Linux
```

Creates: `imageProcessor.zip` + `videoProcessor.zip`

### 3️⃣ Deploy to AWS (15 min)

**Image Processor:**
1. AWS Lambda Console → Create function
2. Name: `ghostmaker-image-processor`
3. Runtime: Node.js 18.x
4. Upload `imageProcessor.zip`
5. Memory: 1024 MB, Timeout: 5 min
6. Environment variables:
   - `DYNAMODB_MEDIA_TABLE` = `ghostmaker-media`
   - `S3_BUCKET` = `ghostmaker-studio-media`
   - `CLOUDFRONT_DOMAIN` = `d17lfecj9hzae.cloudfront.net`
7. Add permissions: S3 + DynamoDB
8. Add trigger: S3 bucket → PUT events → prefix: `projects/`

**Video Processor:**
1. AWS Lambda Console → Create function
2. Name: `ghostmaker-video-processor`
3. Runtime: Node.js 18.x
4. Upload `videoProcessor.zip`
5. Memory: 3008 MB, Timeout: 10 min, Ephemeral storage: 2048 MB
6. Same environment variables as above
7. Add permissions: S3 + DynamoDB
8. Add FFmpeg layer: `arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4`
9. Add trigger: S3 bucket → PUT events → prefix: `projects/` → suffix: `.mp4`

### 4️⃣ Test (5 min)

1. Start server: `npm start`
2. Upload an image → Should complete instantly!
3. Wait 10 seconds → Check S3 → See thumbnail + quality versions
4. Upload a video → Should complete instantly!
5. Wait 1-2 minutes → Check S3 → See HLS + downloads

---

## 📊 How It Works

```
USER UPLOADS FILE
       ↓
   Server.js receives file
       ↓
   Uploads ONLY original to S3 (fast!)
       ↓
   Saves record to DynamoDB (status: pending)
       ↓
   Returns SUCCESS immediately ✅
       ↓
   [User can upload next file right away!]
       
   
MEANWHILE, IN THE BACKGROUND:
       
   S3 upload triggers Lambda automatically
       ↓
   Lambda downloads original
       ↓
   Lambda generates:
   - Thumbnails
   - Multiple quality versions
   - HLS streaming (videos)
   - Downloadable versions
       ↓
   Lambda uploads all back to S3
       ↓
   Lambda updates DynamoDB (status: completed)
       ↓
   DONE! ✅
```

---

## 🎨 Frontend Integration

Check processing status:

```javascript
// Upload file
const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Uploaded!', result.mediaId);

// Check status every 5 seconds
const interval = setInterval(async () => {
  const status = await fetch(
    `/api/media/${result.mediaId}/status?projectId=${projectId}`
  );
  const data = await status.json();
  
  if (data.status === 'completed') {
    console.log('Processing done!', data.thumbnailUrl);
    clearInterval(interval);
  }
}, 5000);
```

Full example: See `frontend-upload-example.js`

---

## 💰 Cost

**Free Tier:**
- 1 million Lambda requests/month
- 400,000 GB-seconds compute/month

**For 3,000 uploads/month:** Probably FREE or ~$1-5/month

---

## 🐛 Troubleshooting

**Images not processing?**
- Check Lambda logs: Lambda Console → Monitor → CloudWatch
- Verify permissions: Lambda role needs S3 + DynamoDB access

**Videos not processing?**
- Check FFmpeg layer is attached
- Increase Lambda timeout/memory
- Check CloudWatch logs for errors

**Lambda timeout?**
- Increase timeout (max 15 min)
- Increase memory (faster processing)
- Reduce quality options in Lambda code

---

## 📚 Files Created

- `lambda/imageProcessor.js` - Image processing Lambda
- `lambda/videoProcessor.js` - Video processing Lambda
- `lambda/package.json` - Lambda dependencies
- `lambda/deploy.bat` - Windows deployment script
- `lambda/deploy.sh` - Mac/Linux deployment script
- `server-upload-simplified.js` - New upload endpoint
- `frontend-upload-example.js` - Frontend example
- `AWS_LAMBDA_SETUP_GUIDE.md` - Detailed instructions

---

## 🚀 Next Steps

1. ✅ Follow setup steps above
2. ✅ Test with small files first
3. ✅ Add frontend status checking
4. ✅ Update UI to show "Processing..." badge
5. ✅ Monitor Lambda costs in AWS

---

## ❓ Questions?

**Need detailed setup instructions?**
→ See `AWS_LAMBDA_SETUP_GUIDE.md`

**Need frontend example?**
→ See `frontend-upload-example.js`

**Need help with AWS?**
→ Check CloudWatch logs for errors

---

**That's it! You can now upload 100 files at once without waiting!** 🎉

