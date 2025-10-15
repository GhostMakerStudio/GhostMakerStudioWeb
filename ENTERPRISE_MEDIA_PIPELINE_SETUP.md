# 🚀 Enterprise Media Pipeline - Complete Setup Guide

## What You're Getting

A **production-grade, enterprise-level media processing system** that handles:

✅ **Instant uploads** (100 files at once, no waiting)  
✅ **BlurHash placeholders** (perceived instant loading)  
✅ **On-demand image resize** (save storage, serve perfect sizes)  
✅ **HLS video streaming** (Netflix-quality adaptive bitrate)  
✅ **Automatic thumbnails** (images + videos)  
✅ **Version management** (track draft revisions)  
✅ **Global CDN delivery** (CloudFront)  
✅ **Deduplication** (perceptual hash)  
✅ **Auto-archival** (originals → Glacier after 90 days)  

**This is the same stack used by Netflix, Instagram, and YouTube.**

---

## 📋 Prerequisites

### 1. Install AWS SAM CLI

**Windows:**
```powershell
# Using Chocolatey
choco install aws-sam-cli

# Or download installer:
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
```

**Mac:**
```bash
brew install aws-sam-cli
```

**Verify:**
```bash
sam --version
# Should show: SAM CLI, version 1.x.x
```

### 2. Install AWS CLI (if not already installed)

**Windows:**
```powershell
# Using Chocolatey
choco install awscli

# Or download installer:
# https://aws.amazon.com/cli/
```

**Verify:**
```bash
aws --version
# Should show: aws-cli/2.x.x
```

### 3. Configure AWS Credentials

```bash
aws configure

# You'll be prompted for:
# AWS Access Key ID: (your key)
# AWS Secret Access Key: (your secret)
# Default region: us-east-1
# Default output format: json
```

---

## 🚀 Step 1: Deploy AWS Infrastructure

### Option A: Automated Deployment (Recommended)

**Windows:**
```powershell
cd aws-best-tier
.\deploy.bat
```

**Mac/Linux:**
```bash
cd aws-best-tier
chmod +x deploy.sh
./deploy.sh
```

### Option B: Manual Deployment

```bash
cd aws-best-tier

# Install Lambda dependencies
cd lambdas/presign-upload && npm install --production && cd ../..
cd lambdas/on-object-created && npm install --production && cd ../..
cd lambdas/metadata-extract && npm install --production && cd ../..
cd lambdas/image-variants && npm install --production && cd ../..
cd lambdas/submit-mediaconvert && npm install --production && cd ../..
cd lambdas/wait-mediaconvert && npm install --production && cd ../..
cd lambdas/write-manifest && npm install --production && cd ../..
cd lambdas/notify-status && npm install --production && cd ../..
cd lambdas/img-resize && npm install --production && cd ../..

# Build
sam build

# Deploy
sam deploy --guided \
  --capabilities CAPABILITY_IAM \
  --tags Project=GhostMakerStudio Environment=production
```

### Deployment Prompts

You'll be asked:

```
Stack Name: ghostmaker-media-pipeline
AWS Region: us-east-1
Parameter BucketName: ghostmaker-studio-media
Parameter GlacierAfterDays: 90
Parameter AllowedOrigins: *
Parameter ProjectTableName: ghostmaker-projects
Parameter AssetTableName: ghostmaker-media
Confirm changes before deploy: Y
Allow SAM CLI IAM role creation: Y
Save arguments to configuration file: Y
```

### 📝 Save the Outputs!

After deployment, you'll see:

```
Outputs
-------
Key: ApiBaseUrl
Value: https://abc123xyz.execute-api.us-east-1.amazonaws.com

Key: BucketNameOut
Value: ghostmaker-studio-media

Key: AssetTableOut
Value: ghostmaker-media
```

**Copy the `ApiBaseUrl`** - you'll need it next!

---

## 🔧 Step 2: Update Your Express Server

### 1. Install Dependencies

```bash
# In your project root
npm install node-fetch @aws-sdk/client-s3 sharp
```

### 2. Add Environment Variables

Edit `.env`:

```env
# Add these new variables:
SAM_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com
S3_BUCKET=ghostmaker-studio-media
DYNAMODB_MEDIA_TABLE=ghostmaker-media

# Keep your existing AWS variables
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### 3. Update `server.js`

Add these imports at the top:

```javascript
// Add to imports
import { presignUpload, completeUpload, getMediaStatus } from './server/uploadsV2.js';
import { imgResize } from './server/imageProxyLocal.js';
```

Add these routes (AFTER your existing routes):

```javascript
// ==========================================
// V2 ENTERPRISE MEDIA PIPELINE ENDPOINTS
// ==========================================

// Pre-signed multipart upload
app.post('/api/v2/uploads/presign', presignUpload);

// Complete multipart upload
app.post('/api/v2/uploads/complete', completeUpload);

// Get media processing status
app.get('/api/v2/media/:mediaId/status', getMediaStatus);

// On-demand image resize
app.get('/img/*', imgResize);

// ==========================================
// KEEP YOUR OLD /api/upload FOR NOW
// ==========================================
// (existing upload endpoint stays unchanged)
```

### 4. Test Server

```bash
npm start
```

Visit: `http://localhost:3000`

---

## 🎨 Step 3: Update Frontend

### Install Frontend Dependencies

```bash
npm install @aws-sdk/client-s3 blurhash
```

### Example: Multipart Upload Component

Create `src/components/EnterpriseUploader.js`:

```javascript
import { S3Client, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';

class EnterpriseUploader {
  constructor() {
    this.s3 = new S3Client({ region: 'us-east-1' });
  }
  
  async uploadFile(file, projectId) {
    // Step 1: Get presigned URLs
    const presignResponse = await fetch('/api/v2/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        projectId,
        parts: 5
      })
    });
    
    const { bucket, key, uploadId, presignedUrls } = await presignResponse.json();
    
    // Step 2: Upload parts in parallel
    const partSize = Math.ceil(file.size / presignedUrls.length);
    const uploadPromises = presignedUrls.map(async ({ partNumber, url }) => {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunk = file.slice(start, end);
      
      const response = await fetch(url, {
        method: 'PUT',
        body: chunk
      });
      
      return {
        PartNumber: partNumber,
        ETag: response.headers.get('ETag')
      };
    });
    
    const parts = await Promise.all(uploadPromises);
    
    // Step 3: Complete upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });
    
    await this.s3.send(completeCommand);
    
    console.log('✅ Upload complete!', key);
    
    return { bucket, key };
  }
  
  async checkStatus(mediaId, projectId) {
    const response = await fetch(`/api/v2/media/${mediaId}/status?projectId=${projectId}`);
    return response.json();
  }
}

export default new EnterpriseUploader();
```

### Example: Image with BlurHash

```jsx
import { decode } from 'blurhash';

function ImageWithBlurHash({ blurhash, src, width, height }) {
  const [loaded, setLoaded] = useState(false);
  
  // Generate BlurHash placeholder
  const placeholder = useMemo(() => {
    if (!blurhash) return null;
    const pixels = decode(blurhash, 32, 32);
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(32, 32);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  }, [blurhash]);
  
  return (
    <div style={{ position: 'relative' }}>
      {!loaded && placeholder && (
        <img 
          src={placeholder} 
          style={{ 
            filter: 'blur(20px)', 
            position: 'absolute',
            width: '100%',
            height: '100%'
          }} 
        />
      )}
      <img 
        src={`/img/${src}?w=${width}&q=80&f=webp`}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        loading="lazy"
      />
    </div>
  );
}
```

### Example: HLS Video Player

```jsx
import Hls from 'hls.js';

function VideoPlayer({ hlsUrl, poster }) {
  const videoRef = useRef();
  
  useEffect(() => {
    if (!hlsUrl) return;
    
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = hlsUrl;
    }
  }, [hlsUrl]);
  
  return (
    <video 
      ref={videoRef} 
      controls 
      poster={poster}
      style={{ width: '100%', maxWidth: '100%' }}
    >
      Your browser doesn't support video playback.
    </video>
  );
}
```

---

## 🧪 Step 4: Test the System

### Test 1: Upload an Image

```bash
# From frontend
const uploader = new EnterpriseUploader();
await uploader.uploadFile(imageFile, 'proj_123');

# Check processing status after 10 seconds
const status = await uploader.checkStatus(mediaId, 'proj_123');
console.log(status); // Should show: { status: 'ready', blurhash: '...', processed: {...} }
```

### Test 2: View Processed Image

```html
<!-- Original -->
<img src="/img/originals/proj_123/media_123-photo.jpg?w=1920&q=90&f=jpg" />

<!-- Responsive -->
<img src="/img/originals/proj_123/media_123-photo.jpg?w=640&q=80&f=webp" />

<!-- Thumbnail -->
<img src="/img/originals/proj_123/media_123-photo.jpg?w=300&q=70&f=webp" />
```

### Test 3: Upload a Video

```bash
await uploader.uploadFile(videoFile, 'proj_123');

# Wait 2-5 minutes for MediaConvert to process
const status = await uploader.checkStatus(mediaId, 'proj_123');
console.log(status.processed.hls); // HLS master playlist URL
```

---

## 📊 Monitoring & Debugging

### View Step Functions Executions

```bash
# AWS Console → Step Functions → ghostmaker-media-pipeline-AssetPipeline

# Or via CLI:
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:xxx:stateMachine:AssetPipeline
```

### View Lambda Logs

```bash
# AWS Console → CloudWatch → Log Groups

# Or via CLI:
aws logs tail /aws/lambda/ghostmaker-media-pipeline-MetadataExtractFn --follow
```

### View MediaConvert Jobs

```bash
# AWS Console → MediaConvert → Jobs

# Or via CLI:
aws mediaconvert list-jobs --endpoint-url https://xxx.mediaconvert.us-east-1.amazonaws.com
```

---

## 💰 Cost Estimates

### Current Month (Free Tier Active):
- **Lambda:** FREE (under 1M requests)
- **S3:** FREE (under 5GB)
- **MediaConvert:** $0.015/minute
- **Step Functions:** FREE (under 4K state transitions)
- **DynamoDB:** FREE (under 25GB)
- **CloudFront:** FREE (under 1TB transfer)

**Estimated:** $0-5/month for 100 videos

### After Free Tier:
- **Storage (100GB):** $2.30/month
- **MediaConvert (500 min):** $7.50/month
- **Lambda:** $1/month
- **CloudFront (500GB):** FREE
- **DynamoDB:** FREE

**Estimated:** $10-15/month

---

## 🎯 Next Steps

1. ✅ Deploy AWS infrastructure
2. ✅ Update Express server
3. ✅ Test image uploads
4. ✅ Test video uploads
5. ⏭️ Add client authentication (Cognito)
6. ⏭️ Add version management UI
7. ⏭️ Add review/approval workflow
8. ⏭️ Add real-time notifications (WebSocket)

---

## 🆘 Troubleshooting

### "SAM CLI not found"
Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### "AWS credentials not configured"
Run: `aws configure`

### "Images not resizing"
Check Lambda logs: `aws logs tail /aws/lambda/ghostmaker-media-pipeline-ImgResizeFn --follow`

### "Videos not processing"
Check MediaConvert jobs in AWS Console → MediaConvert → Jobs

### "Step Functions failing"
Check execution logs in AWS Console → Step Functions → Executions

---

## 🎉 You're Done!

You now have a **production-grade, enterprise-level media pipeline** that scales to millions of files!

**Questions?** Check the AWS Console logs or contact support.

