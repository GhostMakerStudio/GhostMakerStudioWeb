// FRONTEND EXAMPLE - Async Upload with Status Checking
// Use this in your admin dashboard to show upload progress

class MediaUploader {
  constructor() {
    this.uploadQueue = [];
    this.processingItems = new Map(); // mediaId -> interval
  }

  /**
   * Upload multiple files at once - no waiting!
   */
  async uploadFiles(projectId, files) {
    console.log(`📤 Uploading ${files.length} files...`);
    
    // Upload all files in parallel
    const uploadPromises = Array.from(files).map(file => 
      this.uploadSingleFile(projectId, file)
    );
    
    const results = await Promise.all(uploadPromises);
    
    console.log(`✅ All ${files.length} files uploaded!`);
    console.log('⏳ Processing in background...');
    
    return results;
  }

  /**
   * Upload a single file and start monitoring
   */
  async uploadSingleFile(projectId, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('fileName', file.name);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Uploaded: ${file.name}`);
        
        // Start monitoring processing status
        this.startMonitoring(result.mediaId, projectId, file.name);
        
        return {
          success: true,
          file: file.name,
          mediaId: result.mediaId,
          url: result.originalUrl,
          processingStatus: 'pending'
        };
      } else {
        console.error(`❌ Upload failed: ${file.name}`, result.error);
        return {
          success: false,
          file: file.name,
          error: result.error
        };
      }
    } catch (error) {
      console.error(`❌ Upload error: ${file.name}`, error);
      return {
        success: false,
        file: file.name,
        error: error.message
      };
    }
  }

  /**
   * Start monitoring processing status
   */
  startMonitoring(mediaId, projectId, fileName) {
    // Check status every 5 seconds
    const interval = setInterval(async () => {
      const status = await this.checkStatus(mediaId, projectId);
      
      if (status.status === 'completed') {
        console.log(`✅ Processing complete: ${fileName}`);
        this.onProcessingComplete(mediaId, status);
        clearInterval(interval);
        this.processingItems.delete(mediaId);
      } else if (status.status === 'failed') {
        console.error(`❌ Processing failed: ${fileName}`, status.processingError);
        this.onProcessingFailed(mediaId, status);
        clearInterval(interval);
        this.processingItems.delete(mediaId);
      } else {
        console.log(`⏳ Processing: ${fileName} (${status.status})`);
        this.onProcessingUpdate(mediaId, status);
      }
    }, 5000);

    this.processingItems.set(mediaId, interval);
  }

  /**
   * Check processing status
   */
  async checkStatus(mediaId, projectId) {
    try {
      const response = await fetch(`/api/media/${mediaId}/status?projectId=${projectId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to check status:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Callback when processing completes
   */
  onProcessingComplete(mediaId, data) {
    console.log('Processing complete:', {
      mediaId,
      thumbnailUrl: data.thumbnailUrl,
      videoQualities: data.videoQualities,
      imageQualities: data.imageQualities
    });

    // Update UI - show thumbnail and quality options
    this.updateMediaCard(mediaId, {
      status: 'completed',
      thumbnailUrl: data.thumbnailUrl,
      qualities: data.videoQualities || data.imageQualities
    });

    // Refresh project to show new media
    if (typeof window.loadProjects === 'function') {
      window.loadProjects();
    }
  }

  /**
   * Callback when processing fails
   */
  onProcessingFailed(mediaId, data) {
    console.error('Processing failed:', mediaId, data.processingError);

    // Update UI - show error
    this.updateMediaCard(mediaId, {
      status: 'failed',
      error: data.processingError
    });
  }

  /**
   * Callback for processing updates
   */
  onProcessingUpdate(mediaId, data) {
    // Update UI - show processing status
    this.updateMediaCard(mediaId, {
      status: data.status || 'processing'
    });
  }

  /**
   * Update media card in UI
   */
  updateMediaCard(mediaId, data) {
    const card = document.querySelector(`[data-media-id="${mediaId}"]`);
    if (!card) return;

    if (data.status === 'completed') {
      // Update thumbnail
      if (data.thumbnailUrl) {
        const img = card.querySelector('img');
        if (img) img.src = data.thumbnailUrl;
      }

      // Remove processing indicator
      const spinner = card.querySelector('.processing-spinner');
      if (spinner) spinner.remove();

      // Add quality badge
      if (data.qualities && data.qualities.length > 0) {
        const badge = document.createElement('div');
        badge.className = 'quality-badge';
        badge.textContent = `${data.qualities.length} qualities`;
        card.appendChild(badge);
      }

      card.classList.remove('processing');
      card.classList.add('completed');

    } else if (data.status === 'failed') {
      const spinner = card.querySelector('.processing-spinner');
      if (spinner) {
        spinner.innerHTML = '❌ Failed';
        spinner.className = 'processing-error';
      }

      card.classList.remove('processing');
      card.classList.add('failed');

    } else {
      // Still processing
      if (!card.querySelector('.processing-spinner')) {
        const spinner = document.createElement('div');
        spinner.className = 'processing-spinner';
        spinner.innerHTML = '⏳ Processing...';
        card.appendChild(spinner);
      }

      card.classList.add('processing');
    }
  }

  /**
   * Stop monitoring all
   */
  stopAllMonitoring() {
    this.processingItems.forEach((interval, mediaId) => {
      clearInterval(interval);
    });
    this.processingItems.clear();
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Initialize uploader
const uploader = new MediaUploader();

// Example 1: Upload single file
document.querySelector('#fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const projectId = 'proj_123';
  
  const result = await uploader.uploadSingleFile(projectId, file);
  console.log('Upload result:', result);
});

// Example 2: Upload multiple files at once
document.querySelector('#multiFileInput').addEventListener('change', async (e) => {
  const files = e.target.files;
  const projectId = 'proj_123';
  
  // Upload all files in parallel - no waiting!
  const results = await uploader.uploadFiles(projectId, files);
  console.log(`Uploaded ${results.filter(r => r.success).length} of ${files.length} files`);
});

// Example 3: Drag and drop upload
const dropZone = document.querySelector('#dropZone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  const projectId = 'proj_123';
  
  console.log(`📥 Dropped ${files.length} files`);
  
  // Upload all at once
  const results = await uploader.uploadFiles(projectId, files);
  
  console.log('Upload complete!', results);
});

// ============================================
// HTML EXAMPLE
// ============================================

/*
<style>
.media-card {
  position: relative;
  border: 1px solid #ccc;
  padding: 10px;
  margin: 10px;
  border-radius: 8px;
}

.media-card.processing {
  border-color: #ffa500;
  background: #fff8e1;
}

.media-card.completed {
  border-color: #4caf50;
}

.media-card.failed {
  border-color: #f44336;
  background: #ffebee;
}

.processing-spinner {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 165, 0, 0.9);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.processing-error {
  background: rgba(244, 67, 54, 0.9);
}

.quality-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
}

#dropZone {
  border: 2px dashed #ccc;
  padding: 40px;
  text-align: center;
  cursor: pointer;
}

#dropZone.drag-over {
  border-color: #4caf50;
  background: #f1f8e9;
}
</style>

<div id="dropZone">
  <p>📁 Drag and drop files here or click to upload</p>
  <input type="file" id="multiFileInput" multiple hidden>
</div>

<div class="media-grid">
  <div class="media-card" data-media-id="media_123">
    <img src="/placeholder.jpg" alt="Media">
    <div class="processing-spinner">⏳ Processing...</div>
  </div>
</div>
*/

