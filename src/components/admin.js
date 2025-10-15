class Admin {
  constructor() {
    this.projects = [];
    this.currentProject = null;
    this.editingProjectId = null; // Track which project we're editing
    this.uploadQueue = [];
    this.uploadProgress = { total: 0, completed: 0, failed: 0, current: null };
    this.isEditingTitle = false;
    this.init();
  }

  async init() {
    await this.loadProjects();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupTitleEditor();
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      this.projects = data.projects || [];
      this.renderProjects();
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  setupEventListeners() {
    // Modal controls
    document.getElementById('addProjectBtn')?.addEventListener('click', () => this.openProjectModal());
    document.getElementById('modalClose')?.addEventListener('click', () => this.closeProjectModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeProjectModal());
    document.getElementById('saveProjectBtn')?.addEventListener('click', () => this.saveProject());

    // Close modal on outside click
    document.getElementById('projectModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'projectModal') {
        this.closeProjectModal();
      }
    });
  }

  setupTitleEditor() {
    const editBtn = document.getElementById('editTitleBtn');
    const titleDisplay = document.getElementById('projectTitleDisplay');
    
    editBtn?.addEventListener('click', () => {
      this.toggleTitleEdit();
    });
  }

  toggleTitleEdit() {
    const titleDisplay = document.getElementById('projectTitleDisplay');
    const editBtn = document.getElementById('editTitleBtn');
    
    if (!this.isEditingTitle) {
      // Enter edit mode
      const currentTitle = titleDisplay.textContent;
      titleDisplay.innerHTML = `
        <input type="text" id="titleInput" value="${currentTitle}" style="
          background: var(--secondary-dark);
          border: 1px solid var(--accent-teal);
          border-radius: 4px;
          color: var(--text-white);
          padding: 4px 8px;
          font-size: 1.5rem;
          font-weight: 600;
          width: 100%;
          outline: none;
        ">
      `;
      editBtn.innerHTML = '✅';
      
      const input = document.getElementById('titleInput');
      input.focus();
      input.select();
      
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.saveTitle();
        }
      });
      
      input.addEventListener('blur', () => {
        setTimeout(() => this.saveTitle(), 100);
      });
      
      this.isEditingTitle = true;
    } else {
      // Exit edit mode
      this.saveTitle();
    }
  }

  saveTitle() {
    const input = document.getElementById('titleInput');
    const titleDisplay = document.getElementById('projectTitleDisplay');
    const editBtn = document.getElementById('editTitleBtn');
    
    if (input) {
      const newTitle = input.value.trim() || 'New Project';
      titleDisplay.textContent = newTitle;
    }
    
    editBtn.innerHTML = '✏️';
    this.isEditingTitle = false;
  }

  setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const coverBox = document.getElementById('coverBox');
    const contentGallery = document.getElementById('contentGallery');
    
    if (!uploadArea || !coverBox) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
      coverBox.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Upload area drag events
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('drag-over');
      }, false);
    });

    uploadArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      this.handleFiles(files);
    }, false);

    // Cover box drag events
    ['dragenter', 'dragover'].forEach(eventName => {
      coverBox.addEventListener(eventName, () => {
        coverBox.classList.add('drag-over-cover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      coverBox.addEventListener(eventName, () => {
        coverBox.classList.remove('drag-over-cover');
      }, false);
    });

    coverBox.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        this.handleCoverUpload(files[0]);
      }
    }, false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleFiles(files) {
    console.log('📁 Files dropped:', files.length);
    this.uploadQueue = Array.from(files);
    this.uploadProgress = { total: files.length, completed: 0, failed: 0, current: null };
    this.showUploadQueue();

    for (let i = 0; i < this.uploadQueue.length; i++) {
      const file = this.uploadQueue[i];
      this.uploadProgress.current = file.name;
      this.updateUploadProgress();

      try {
        await this.uploadFile(file);
        this.uploadProgress.completed++;
      } catch (error) {
        console.error('Upload failed for:', file.name, error);
        this.uploadProgress.failed++;
      }
      this.updateUploadProgress();
      
      // Small delay between uploads
      if (i < this.uploadQueue.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Hide queue after completion
    setTimeout(() => {
      this.hideUploadQueue();
    }, 2000);
  }

  async handleCoverUpload(file) {
    try {
      const uploadResult = await this.uploadFile(file);
      this.setCoverImage(uploadResult);
    } catch (error) {
      console.error('Cover upload failed:', error);
    }
  }

  async uploadFile(file) {
    // Validate file type
    const validTypes = ['image/', 'video/'];
    if (!validTypes.some(type => file.type.startsWith(type))) {
      throw new Error('Invalid file type. Only images and videos are supported.');
    }

    // Generate project ID from title
    const titleDisplay = document.getElementById('projectTitleDisplay');
    const projectTitle = titleDisplay.textContent;
    const projectId = projectTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Create content item placeholder
    const contentItem = this.createUploadPlaceholder(file);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('fileName', file.name);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Update placeholder with actual content
        this.updateContentItem(contentItem, result);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      contentItem.classList.add('upload-failed');
      contentItem.querySelector('.upload-status').textContent = 'Failed';
      throw error;
    }
  }

  createUploadPlaceholder(file) {
    const contentGallery = document.getElementById('contentGallery');
    const uploadArea = document.getElementById('uploadArea');
    
    // Hide upload area if it's the first file
    if (contentGallery.children.length === 1) {
      uploadArea.style.display = 'none';
    }

    const contentItem = document.createElement('div');
    contentItem.className = 'content-item uploading';
    contentItem.draggable = true;
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? 
      `<video src="${URL.createObjectURL(file)}" muted></video>` :
      `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`;

    contentItem.innerHTML = `
      ${preview}
      <div class="upload-status">Uploading...</div>
      <div class="upload-progress-bar">
        <div class="upload-progress-fill"></div>
      </div>
    `;

    // Add drag events for reordering and cover setting
    this.setupContentItemDrag(contentItem);
    
    contentGallery.appendChild(contentItem);
    return contentItem;
  }

  updateContentItem(contentItem, uploadResult) {
    contentItem.classList.remove('uploading');
    contentItem.classList.add('upload-complete');
    
    const file = uploadResult.files[0];
    contentItem.dataset.fileUrl = file.url;
    contentItem.dataset.fileType = file.type;
    contentItem.dataset.mediaId = file.mediaId;
    
    // Update preview
    const preview = file.type === 'video' ? 
      `<video src="${file.url}" muted></video>` :
      `<img src="${file.url}" alt="${file.alt}">`;

    contentItem.innerHTML = `
      ${preview}
      <div class="upload-status">Complete</div>
      <div class="file-overlay">
        <button class="overlay-btn" onclick="this.closest('.content-item').showFullscreen()" title="Preview">👁️</button>
        <button class="overlay-btn" onclick="this.closest('.content-item').setAsCover()" title="Set as Cover">📌</button>
      </div>
    `;

    // Re-setup drag events
    this.setupContentItemDrag(contentItem);
  }

  setupContentItemDrag(contentItem) {
    contentItem.addEventListener('dragstart', (e) => {
      contentItem.classList.add('dragging');
      e.dataTransfer.setData('text/plain', contentItem.dataset.fileUrl);
      e.dataTransfer.setData('file-type', contentItem.dataset.fileType);
    });

    contentItem.addEventListener('dragend', () => {
      contentItem.classList.remove('dragging');
    });

    // Add methods to contentItem
    contentItem.showFullscreen = () => this.showFullscreen(contentItem);
    contentItem.setAsCover = () => this.setAsCover(contentItem);
  }

  setCoverImage(uploadResult) {
    const coverBox = document.getElementById('coverBox');
    const file = uploadResult.files[0];
    
    const preview = file.type === 'video' ? 
      `<video src="${file.url}" muted autoplay loop></video>` :
      `<img src="${file.url}" alt="Cover">`;

    coverBox.innerHTML = `
      ${preview}
      <div class="file-overlay">
        <button class="overlay-btn" onclick="this.closest('.cover-box').showFullscreen()" title="Preview">👁️</button>
      </div>
    `;

    coverBox.dataset.coverUrl = file.url;
    coverBox.dataset.coverType = file.type;
    coverBox.showFullscreen = () => this.showFullscreen(coverBox);
  }

  setAsCover(contentItem) {
    const fileUrl = contentItem.dataset.fileUrl;
    const fileType = contentItem.dataset.fileType;
    
    const coverBox = document.getElementById('coverBox');
    const preview = fileType === 'video' ? 
      `<video src="${fileUrl}" muted autoplay loop></video>` :
      `<img src="${fileUrl}" alt="Cover">`;

    coverBox.innerHTML = `
      ${preview}
      <div class="file-overlay">
        <button class="overlay-btn" onclick="this.closest('.cover-box').showFullscreen()" title="Preview">👁️</button>
      </div>
    `;

    coverBox.dataset.coverUrl = fileUrl;
    coverBox.dataset.coverType = fileType;
    coverBox.showFullscreen = () => this.showFullscreen(coverBox);
  }

  showFullscreen(element) {
    const fileUrl = element.dataset.fileUrl || element.dataset.coverUrl;
    const fileType = element.dataset.fileType || element.dataset.coverType;
    
    if (!fileUrl) return;

    const modal = document.createElement('div');
    modal.className = 'fullscreen-modal';
    modal.innerHTML = `
      <div class="fullscreen-content">
        <button class="close-preview">&times;</button>
        ${fileType === 'video' ? 
          `<video src="${fileUrl}" controls autoplay style="max-width: 90vw; max-height: 90vh;"></video>` :
          `<img src="${fileUrl}" style="max-width: 90vw; max-height: 90vh;">`
        }
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.querySelector('.close-preview').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  showUploadQueue() {
    const queue = document.createElement('div');
    queue.id = 'uploadQueue';
    queue.className = 'upload-queue';
    queue.innerHTML = `
      <div class="queue-header">
        <h3>Uploading Files</h3>
        <button class="close-queue" onclick="this.closest('.upload-queue').remove()">&times;</button>
      </div>
      <div class="queue-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="queueProgressFill"></div>
        </div>
        <div class="progress-text" id="queueProgressText">0 of 0 files uploaded</div>
      </div>
      <div class="queue-items" id="queueItems"></div>
    `;

    document.body.appendChild(queue);
    this.updateQueueItems();
  }

  updateUploadProgress() {
    const progressFill = document.getElementById('queueProgressFill');
    const progressText = document.getElementById('queueProgressText');
    
    if (progressFill && progressText) {
      const percentage = (this.uploadProgress.completed / this.uploadProgress.total) * 100;
      progressFill.style.width = `${percentage}%`;
      
      const current = this.uploadProgress.current ? ` (${this.uploadProgress.current})` : '';
      progressText.textContent = `${this.uploadProgress.completed} of ${this.uploadProgress.total} files uploaded${current}`;
    }
  }

  updateQueueItems() {
    const queueItems = document.getElementById('queueItems');
    if (!queueItems) return;

    queueItems.innerHTML = this.uploadQueue.map(file => `
      <div class="queue-item">
        <span class="file-name">${file.name}</span>
        <span class="file-size">${this.formatFileSize(file.size)}</span>
      </div>
    `).join('');
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  hideUploadQueue() {
    const queue = document.getElementById('uploadQueue');
    if (queue) {
      queue.remove();
    }
  }

  openProjectModal(projectId = null) {
    // Reset editing state
    this.editingProjectId = projectId;
    
    document.getElementById('projectModal').style.display = 'flex';
    
    if (projectId) {
      // Editing existing project
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        document.getElementById('projectTitleDisplay').textContent = project.title;
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('androidLink').value = project.androidLink || '';
        document.getElementById('iosLink').value = project.iosLink || '';
        
        // Set cover image
        if (project.coverImage) {
          document.getElementById('coverBox').innerHTML = `
            <img src="${project.coverImage}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;">
            <div class="file-overlay">
              <button class="overlay-btn" onclick="this.closest('.cover-box').showFullscreen()" title="Preview">👁️</button>
            </div>
          `;
          document.getElementById('coverBox').dataset.coverUrl = project.coverImage;
          document.getElementById('coverBox').dataset.coverType = project.coverImage.includes('video') ? 'video' : 'image';
        } else {
          document.getElementById('coverBox').innerHTML = `
            <div class="cover-placeholder">
              <div class="placeholder-icon">📷</div>
              <p>Drag cover image/video here</p>
            </div>
          `;
        }
        
        // Set content gallery
        if (project.content && project.content.length > 0) {
          let contentHTML = '';
          project.content.forEach(item => {
            contentHTML += `
              <div class="content-item upload-complete" data-file-url="${item.url}" data-file-type="${item.type}" data-media-id="${item.mediaId}">
                ${item.type === 'video' ? 
                  `<video src="${item.url}" muted></video>` :
                  `<img src="${item.url}" alt="${item.alt || 'Content'}">`
                }
                <div class="file-overlay">
                  <button class="overlay-btn" onclick="this.closest('.content-item').showFullscreen()" title="Preview">👁️</button>
                  <button class="overlay-btn" onclick="this.closest('.content-item').setAsCover()" title="Set as Cover">📌</button>
                </div>
              </div>
            `;
          });
          contentHTML += `
            <div class="upload-area" id="uploadArea">
              <div class="upload-placeholder">
                <div class="upload-icon">📁</div>
                <p>Drag more files here to upload</p>
                <small>Images and videos supported</small>
              </div>
            </div>
          `;
          document.getElementById('contentGallery').innerHTML = contentHTML;
        } else {
          document.getElementById('contentGallery').innerHTML = `
            <div class="upload-area" id="uploadArea">
              <div class="upload-placeholder">
                <div class="upload-icon">📁</div>
                <p>Drag files here to upload</p>
                <small>Images and videos supported</small>
              </div>
            </div>
          `;
        }
      }
    } else {
      // Creating new project
      document.getElementById('projectTitleDisplay').textContent = 'New Project';
      document.getElementById('projectDescription').value = '';
      document.getElementById('coverBox').innerHTML = `
        <div class="cover-placeholder">
          <div class="placeholder-icon">📷</div>
          <p>Drag cover image/video here</p>
        </div>
      `;
      document.getElementById('contentGallery').innerHTML = `
        <div class="upload-area" id="uploadArea">
          <div class="upload-placeholder">
            <div class="upload-icon">📁</div>
            <p>Drag files here to upload</p>
            <small>Images and videos supported</small>
          </div>
        </div>
      `;
      document.getElementById('androidLink').value = '';
      document.getElementById('iosLink').value = '';
    }
    
    // Update button text
    const saveBtn = document.getElementById('saveProjectBtn');
    saveBtn.textContent = this.editingProjectId ? 'Update Project' : 'Create Project';
    
    // Re-setup drag and drop for modal
    this.setupDragAndDrop();
  }

  closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
  }

  async saveProject() {
    const title = document.getElementById('projectTitleDisplay').textContent;
    const description = document.getElementById('projectDescription').value;
    const coverBox = document.getElementById('coverBox');
    const contentGallery = document.getElementById('contentGallery');
    const androidLink = document.getElementById('androidLink').value;
    const iosLink = document.getElementById('iosLink').value;

    // Use existing project ID if editing, otherwise generate new one
    const projectId = this.editingProjectId || this.generateUniqueProjectId();

    // Collect content items
    const contentItems = [];
    const contentElements = contentGallery.querySelectorAll('.content-item');
    contentElements.forEach(item => {
      if (item.dataset.fileUrl) {
        contentItems.push({
          type: item.dataset.fileType,
          url: item.dataset.fileUrl,
          mediaId: item.dataset.mediaId
        });
      }
    });

    const projectData = {
      id: projectId,
      title: title,
      description: description,
      coverImage: coverBox.dataset.coverUrl || '',
      content: contentItems,
      androidLink: androidLink,
      iosLink: iosLink,
      updatedAt: new Date().toISOString()
    };

    // Add createdAt only for new projects
    if (!this.editingProjectId) {
      projectData.createdAt = new Date().toISOString();
    }

    try {
      const url = this.editingProjectId ? `/api/projects/${this.editingProjectId}` : '/api/projects';
      const method = this.editingProjectId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        await this.loadProjects();
        this.closeProjectModal();
        console.log(`✅ Project ${this.editingProjectId ? 'updated' : 'created'} successfully!`);
      } else {
        throw new Error('Failed to save project');
      }
    } catch (error) {
      console.error('❌ Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    }
  }

  generateUniqueProjectId() {
    return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  renderProjects() {
    const projectsList = document.getElementById('projectsList');
    if (!projectsList) return;

    if (this.projects.length === 0) {
      projectsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>No projects yet</h3>
          <p>Click "Add New Project" to create your first project</p>
        </div>
      `;
      return;
    }

    projectsList.innerHTML = this.projects.map(project => `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-cover">
          ${project.coverImage ? 
            `<img src="${project.coverImage}" alt="${project.title}">` :
            '<div class="no-cover">No Cover</div>'
          }
        </div>
        <div class="project-info">
          <h3>${project.title}</h3>
          <p>${project.description || 'No description'}</p>
          <div class="project-stats">
            <span>${project.content?.length || 0} items</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="btn btn-sm btn-secondary" onclick="admin.editProject('${project.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="admin.deleteProject('${project.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  async editProject(projectId) {
    this.openProjectModal(projectId);
  }

  async deleteProject(projectId) {
    if (confirm('Are you sure you want to delete this project? This will also delete all associated media files.')) {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          await this.loadProjects(); // Reload projects list
          console.log('✅ Project deleted successfully');
        } else {
          throw new Error('Failed to delete project');
        }
      } catch (error) {
        console.error('❌ Failed to delete project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  }
}

// Initialize admin when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.admin = new Admin();
});