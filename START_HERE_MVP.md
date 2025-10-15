# 🚀 START HERE - MVP Build Plan

## **Your Vision:**
Homepage with project tiles → Click to view fullscreen gallery → Admin drag-and-drop to S3 → Smart pre-loading

## **Let's Build This in Order:**

### **STEP 1: AWS Setup (Do This First!)**

You mentioned needing to switch from `amplify-dev` to `ghostmaker-studio` IAM user.

**Do this:**
1. Go to AWS Console → IAM → Users
2. Find or create user: `ghostmaker-studio`
3. Give permissions:
   - AmazonS3FullAccess
   - AmazonDynamoDBFullAccess  
   - CloudWatchLogsFullAccess
4. Create Access Keys
5. Save Access Key ID and Secret Access Key

**Add to your `.env` file:**
```env
AWS_ACCESS_KEY_ID=AKIA...your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
S3_BUCKET=ghostmaker-studio-media
```

### **STEP 2: Create S3 Bucket**

1. AWS Console → S3 → Create Bucket
2. Name: `ghostmaker-studio-media`
3. Region: `us-east-1`
4. **Uncheck** "Block all public access"
5. Create bucket
6. Bucket → Permissions → CORS Configuration:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

### **STEP 3: Today's Build (1-2 hours)**

I'll help you build:
1. ✅ Beautiful homepage project grid
2. ✅ Fullscreen modal viewer with navigation
3. ✅ Basic admin page to create projects
4. ✅ Local file upload (S3 in next step)

### **STEP 4: Tomorrow's Build**

1. Connect S3 uploads
2. Auto-generate thumbnails
3. Organize files in S3

### **STEP 5: This Week**

1. Add smart pre-loading
2. Multiple video qualities
3. Drag-to-reorder content
4. Set cover image

## 🎯 **What We're Building Today:**

```
Homepage:
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Project │  │ Project │  │ Project │
│   #1    │  │   #2    │  │   #3    │
│ [Photo] │  │ [Video] │  │ [Photo] │
│  Title  │  │  Title  │  │  Title  │
└─────────┘  └─────────┘  └─────────┘
    ↓ Click
    ↓
┌────────────────────────────────┐
│  [X]                       ← → │
│  ┌──────────────────────┐      │
│  │                      │      │
│  │   Fullscreen View    │      │
│  │   (Image or Video)   │      │
│  │                      │      │
│  └──────────────────────┘      │
│  Project Title                 │
│  Item 2 of 5                   │
│  [Google Play] [App Store]     │
└────────────────────────────────┘
```

## 📝 **Files I'm Creating:**

1. `src/components/portfolio.js` - Gallery and modal logic
2. `src/styles/portfolio.css` - Beautiful styling
3. `src/pages/projects-admin.html` - Admin panel
4. `src/components/projects-admin.js` - Admin logic

## ⚡ **Quick Start Commands:**

```bash
# Make sure server is running
npm start

# Test these URLs:
http://localhost:3000/              # Homepage with projects
http://localhost:3000/admin         # Admin dashboard  
```

## 🎨 **Example Projects We'll Add:**

1. **StartUp BizDev**
   - Cover: Business photo
   - Content: Screenshots, demo video, app store links

2. **Christian Daily Thoughts**
   - Cover: App icon
   - Content: Screenshots, features, Google Play link

3. **How the Rave Stole Christmas**
   - Cover: Event flyer/video
   - Content: Photos, videos from event

## 🚀 **Ready to Start?**

Say "Let's build!" and I'll create all the files step by step!

I'll explain each file as I create it so you understand exactly what's happening.








