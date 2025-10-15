# 🗄️ GhostMaker Studio CMS Database Schema

## **📁 Projects Table (`ghostmaker-projects`)**
```json
{
  "projectId": "proj_1234567890",
  "title": "Client Website Redesign",
  "description": "Complete website redesign with modern UI/UX",
  "category": "web_development",
  "status": "published", // draft, published, archived
  "featured": true,
  "order": 1,
  "thumbnail": {
    "url": "https://s3.../thumbnails/proj_1234567890_thumb.jpg",
    "alt": "Website redesign preview"
  },
  "tags": ["web", "ui", "ux", "responsive"],
  "client": "Acme Corp",
  "year": 2024,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "publishedAt": "2024-01-15T10:30:00Z"
}
```

## **🎬 Media Files Table (`ghostmaker-media`)**
```json
{
  "mediaId": "media_1234567890",
  "projectId": "proj_1234567890",
  "fileName": "hero-video.mp4",
  "originalName": "client_hero_video_final.mp4",
  "fileType": "video", // image, video, audio, document
  "mimeType": "video/mp4",
  "fileSize": 15728640, // bytes
  "duration": 120, // seconds (for video/audio)
  "dimensions": {
    "width": 1920,
    "height": 1080
  },
  "s3Key": "projects/proj_1234567890/video/hero-video.mp4",
  "s3Bucket": "ghostmaker-studio-media",
  "urls": {
    "original": "https://s3.../hero-video.mp4",
    "thumbnail": "https://s3.../hero-video_thumb.jpg",
    "preview": "https://s3.../hero-video_preview.mp4"
  },
  "qualities": {
    "260p": "https://s3.../hero-video_260p.mp4",
    "480p": "https://s3.../hero-video_480p.mp4", 
    "1080p": "https://s3.../hero-video_1080p.mp4",
    "4k": "https://s3.../hero-video_4k.mp4"
  },
  "processingStatus": "completed", // pending, processing, completed, failed
  "processingJobId": "job_1234567890",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## **📝 Content Blocks Table (`ghostmaker-content-blocks`)**
```json
{
  "blockId": "block_1234567890",
  "projectId": "proj_1234567890",
  "type": "hero_video", // hero_video, image_gallery, text_block, before_after
  "order": 1,
  "title": "Hero Section",
  "content": {
    "text": "Welcome to our amazing website",
    "videoId": "media_1234567890",
    "imageIds": ["media_1234567891", "media_1234567892"],
    "settings": {
      "autoplay": true,
      "muted": true,
      "loop": true
    }
  },
  "visibility": "public", // public, private, admin_only
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## **🎨 Portfolio Categories Table (`ghostmaker-categories`)**
```json
{
  "categoryId": "cat_1234567890",
  "name": "Web Development",
  "slug": "web-development",
  "description": "Custom websites and web applications",
  "icon": "💻",
  "color": "#3b82f6",
  "order": 1,
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## **⚙️ Site Settings Table (`ghostmaker-site-settings`)**
```json
{
  "settingId": "site_settings",
  "siteTitle": "GhostMaker Studio",
  "siteDescription": "Professional Creative Services",
  "heroTitle": "Professional Creative Services",
  "heroSubtitle": "Video production, graphic design, and web applications that bring your vision to life",
  "contactEmail": "hello@ghostmakerstudio.com",
  "socialLinks": {
    "instagram": "https://instagram.com/ghostmakerstudio",
    "linkedin": "https://linkedin.com/company/ghostmakerstudio",
    "youtube": "https://youtube.com/@ghostmakerstudio"
  },
  "analytics": {
    "googleAnalytics": "GA_MEASUREMENT_ID",
    "facebookPixel": "FB_PIXEL_ID"
  },
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## **🔧 Processing Jobs Table (`ghostmaker-processing-jobs`)**
```json
{
  "jobId": "job_1234567890",
  "mediaId": "media_1234567890",
  "type": "video_transcoding",
  "status": "completed", // pending, processing, completed, failed
  "progress": 100,
  "inputFile": "original_video.mp4",
  "outputFiles": {
    "260p": "video_260p.mp4",
    "480p": "video_480p.mp4",
    "1080p": "video_1080p.mp4",
    "4k": "video_4k.mp4",
    "thumbnail": "video_thumb.jpg",
    "preview": "video_preview.mp4"
  },
  "errorMessage": null,
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:35:00Z",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## **🔗 Relationships:**
- **Projects** → **Media Files** (1:many)
- **Projects** → **Content Blocks** (1:many)
- **Projects** → **Categories** (many:1)
- **Media Files** → **Processing Jobs** (1:many)
- **Orders** → **Projects** (1:1) - for client work

## **📊 Indexes for Performance:**
- `projectId` on media_files, content_blocks
- `status` on projects (for filtering)
- `featured` on projects (for homepage)
- `fileType` on media_files (for filtering)
- `processingStatus` on media_files (for processing queue)

## **🚀 Smart Loading Strategy:**
- **Lazy Loading**: Load thumbnails first, full images on scroll
- **Progressive Enhancement**: Start with 260p video, upgrade to higher quality
- **CDN Integration**: All media served through CloudFront
- **Compression**: Automatic image optimization and video compression
- **Caching**: Aggressive caching for static content, smart invalidation



