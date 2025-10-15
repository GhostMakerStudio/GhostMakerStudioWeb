# 🚀 Enterprise Media Pipeline - Quick Start

## TL;DR - Get Running in 30 Minutes

### 1. Deploy AWS Infrastructure (10 min)

```powershell
cd aws-best-tier
.\deploy.bat
```

**Save the output:** `ApiBaseUrl`

### 2. Update .env (1 min)

```env
SAM_API_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com
S3_BUCKET=ghostmaker-studio-media
DYNAMODB_MEDIA_TABLE=ghostmaker-media
```

### 3. Update server.js (5 min)

```javascript
// Add imports
import { presignUpload, getMediaStatus } from './server/uploadsV2.js';
import { imgResize } from './server/imageProxyLocal.js';

// Add routes
app.post('/api/v2/uploads/presign', presignUpload);
app.get('/api/v2/media/:mediaId/status', getMediaStatus);
app.get('/img/*', imgResize);
```

### 4. Install dependencies (2 min)

```bash
npm install node-fetch @aws-sdk/client-s3 sharp
```

### 5. Test (5 min)

```bash
npm start
```

Upload an image, check status after 10 seconds:

```javascript
const status = await fetch(`/api/v2/media/${mediaId}/status?projectId=${projectId}`);
console.log(await status.json());
// { status: 'ready', blurhash: '...', processed: {...} }
```

### 6. Use on-demand images

```html
<img src="/img/originals/proj_123/media_456-photo.jpg?w=1280&q=80&f=webp" />
```

---

## What You Get

✅ Instant uploads (100 files at once)  
✅ BlurHash placeholders  
✅ On-demand image resize  
✅ HLS video streaming  
✅ Auto thumbnails  
✅ CDN delivery  
✅ Version management ready  

**Cost:** $0-5/month for typical usage

---

## Full Documentation

- **Complete Setup:** See `ENTERPRISE_MEDIA_PIPELINE_SETUP.md`
- **Architecture:** See `aws-best-tier/template.yaml`
- **Integration:** See `server/integration-example.js`

---

## Need Help?

1. Check AWS Console logs (CloudWatch)
2. Check Step Functions executions
3. Check MediaConvert jobs
4. Review `ENTERPRISE_MEDIA_PIPELINE_SETUP.md` troubleshooting section

