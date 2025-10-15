// Enhanced Admin Dashboard for GhostMaker Studio CMS
// Handles project management, media uploads, and content management

import DatabaseService from '../api/database.js';

class AdminDashboardEnhanced {
  constructor() {
    this.db = DatabaseService;
    this.currentView = 'projects';
    this.uploadQueue = [];
    this.isUploading = false;
    this.isReorderMode = false;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupNavigation();
    this.loadDashboardData();
    this.loadProjects();
    this.loadMedia();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView(link.getAttribute('href').substring(1));
      });
    });

    // Project Management
    document.getElementById('createProject')?.addEventListener('click', () => {
      this.openProjectModal();
    });
    
    document.getElementById('refreshProjects')?.addEventListener('click', () => {
      this.loadProjects();
    });

    document.getElementById('reorderProjects')?.addEventListener('click', () => {
      this.toggleReorderMode();
    });

    document.getElementById('saveProject')?.addEventListener('click', () => {
      this.saveProject();
    });

    // Media Management
    document.getElementById('uploadMedia')?.addEventListener('click', () => {
      this.openUploadModal();
    });

    document.getElementById('browseFiles')?.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput')?.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });

    document.getElementById('startUpload')?.addEventListener('click', () => {
      this.startUpload();
    });

    // Drag & Drop
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        this.handleFileSelect(e.dataTransfer.files);
      });
    }

    // Modal controls
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.closeModal(e.target.closest('.modal'));
      });
    });

    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });
  }

  setupNavigation() {
    // Set active nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`a[href="#${this.currentView}"]`)?.classList.add('active');
  }

  switchView(viewName) {
    this.currentView = viewName;
    this.setupNavigation();

    // Hide all panels
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
      panel.style.display = 'none';
    });

    // Show selected panel
    const panelMap = {
      'projects': 'projectsPanel',
      'orders': 'ordersPanel',
      'media': 'mediaPanel',
      'analytics': 'analyticsPanel'
    };

    const targetPanel = document.getElementById(panelMap[viewName]);
    if (targetPanel) {
      targetPanel.style.display = 'block';
    }

    // Load data for the view
    switch(viewName) {
      case 'projects':
        this.loadProjects();
        break;
      case 'orders':
        this.loadOrders();
        break;
      case 'media':
        this.loadMedia();
        break;
      case 'analytics':
        this.loadAnalytics();
        break;
    }
  }

  async loadDashboardData() {
    try {
      // Load dashboard stats
      const projects = await this.db.getAllItems('ghostmaker-projects');
      const orders = await this.db.getAllItems('ghostmaker-orders');
      
      // Update stats
      document.getElementById('totalProjects').textContent = projects.length;
      document.getElementById('totalOrders').textContent = orders.length;
      
      const pendingOrders = orders.filter(order => order.status === 'pending');
      document.getElementById('pendingOrders').textContent = pendingOrders.length;
      
      const totalRevenue = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
      document.getElementById('totalRevenue').textContent = `$${(totalRevenue / 100).toFixed(2)}`;
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        this.renderProjects(data.projects);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      this.showError('Failed to load projects');
    }
  }

  renderProjects(projects) {
    const container = document.getElementById('projectsList');
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <h3>No Projects Yet</h3>
          <p>Create your first project to get started</p>
          <button class="btn btn-primary" onclick="document.getElementById('createProject').click()">
            Create Project
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = projects.map(project => `
      <div class="project-card" data-project-id="${project.id}" draggable="${this.isReorderMode}">
        ${this.isReorderMode ? `<div class="project-delete-btn" onclick="adminDashboard.deleteProject('${project.id}')" title="Delete Project">×</div>` : ''}
        <div class="project-thumbnail">
          ${project.coverImage ? 
            `<img src="${project.coverImage}" alt="${project.title}">` :
            `<div class="placeholder-thumbnail">${this.getCategoryIcon(project.category)}</div>`
          }
          <div class="project-status ${project.status}">${project.status}</div>
          ${project.featured ? '<div class="featured-badge">⭐</div>' : ''}
        </div>
        <div class="project-info">
          <h3>${project.title}</h3>
          <p class="project-description">${project.description || 'No description'}</p>
          <div class="project-meta">
            <span class="project-category">${this.formatCategory(project.category)}</span>
            <span class="project-year">${project.year}</span>
            ${project.client ? `<span class="project-client">${project.client}</span>` : ''}
          </div>
          ${!this.isReorderMode ? `
            <div class="project-actions">
              <button class="btn btn-small btn-secondary" onclick="adminDashboard.editProject('${project.id}')">
                Edit
              </button>
              <button class="btn btn-small btn-primary" onclick="adminDashboard.manageProjectMedia('${project.id}')">
                Add Media
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
    
    // Add drag and drop functionality only in reorder mode
    if (this.isReorderMode) {
      this.setupProjectDragAndDrop();
    }
  }

  getCategoryIcon(category) {
    const icons = {
      'web_development': '💻',
      'video_production': '🎥',
      'graphic_design': '🎨',
      'branding': '🎭'
    };
    return icons[category] || '📁';
  }

  formatCategory(category) {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  openProjectModal(projectId = null) {
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    
    if (projectId) {
      // Edit mode - load project data
      this.loadProjectForEdit(projectId);
      modal.querySelector('h2').textContent = 'Edit Project';
    } else {
      // Create mode - reset form
      form.reset();
      modal.querySelector('h2').textContent = 'Create New Project';
    }
    
    modal.style.display = 'block';
  }

  async saveProject() {
    const form = document.getElementById('projectForm');
    const formData = new FormData(form);
    
    const projectData = {
      projectId: `proj_${Date.now()}`,
      title: formData.get('title'),
      description: formData.get('description'),
      category: formData.get('category'),
      client: formData.get('client') || null,
      year: parseInt(formData.get('year')),
      featured: formData.get('featured') === 'on',
      tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
      status: 'draft',
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await this.db.saveItem('ghostmaker-projects', projectData);
      this.closeModal(document.getElementById('projectModal'));
      this.loadProjects();
      this.loadDashboardData();
      this.showSuccess('Project created successfully!');
    } catch (error) {
      console.error('Failed to save project:', error);
      this.showError('Failed to save project');
    }
  }

  handleFileSelect(files) {
    Array.from(files).forEach(file => {
      if (this.isValidFile(file)) {
        this.uploadQueue.push({
          file: file,
          id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'queued'
        });
      }
    });
    
    this.renderUploadQueue();
    this.updateUploadButton();
  }

  isValidFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov', 'video/avi'];
    const maxSize = 500 * 1024 * 1024; // 500MB
    
    if (!validTypes.includes(file.type)) {
      this.showError(`Invalid file type: ${file.type}`);
      return false;
    }
    
    if (file.size > maxSize) {
      this.showError(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 500MB)`);
      return false;
    }
    
    return true;
  }

  renderUploadQueue() {
    const container = document.getElementById('uploadQueue');
    if (!container) return;

    if (this.uploadQueue.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.uploadQueue.map(item => `
      <div class="upload-item" data-upload-id="${item.id}">
        <div class="upload-info">
          <div class="upload-icon">${this.getFileIcon(item.file.type)}</div>
          <div class="upload-details">
            <div class="upload-name">${item.file.name}</div>
            <div class="upload-size">${this.formatFileSize(item.file.size)}</div>
          </div>
        </div>
        <div class="upload-status ${item.status}">${item.status}</div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" style="width: ${item.progress || 0}%"></div>
        </div>
        <button class="upload-remove" onclick="adminDashboard.removeFromQueue('${item.id}')">×</button>
      </div>
    `).join('');
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    return '📄';
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  updateUploadButton() {
    const button = document.getElementById('startUpload');
    button.disabled = this.uploadQueue.length === 0 || this.isUploading;
  }

  async startUpload() {
    if (this.uploadQueue.length === 0 || this.isUploading) return;
    
    this.isUploading = true;
    this.updateUploadButton();
    
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressContainer.style.display = 'block';
    
    try {
      for (let i = 0; i < this.uploadQueue.length; i++) {
        const item = this.uploadQueue[i];
        item.status = 'uploading';
        item.progress = 0;
        this.renderUploadQueue();
        
        await this.uploadFile(item);
        
        const overallProgress = Math.round(((i + 1) / this.uploadQueue.length) * 100);
        progressFill.style.width = `${overallProgress}%`;
        progressText.textContent = `${overallProgress}%`;
      }
      
      this.showSuccess('All files uploaded successfully!');
      this.uploadQueue = [];
      this.renderUploadQueue();
      this.loadMedia();
      
    } catch (error) {
      console.error('Upload failed:', error);
      this.showError('Upload failed: ' + error.message);
    } finally {
      this.isUploading = false;
      this.updateUploadButton();
      progressContainer.style.display = 'none';
    }
  }

  async uploadFile(uploadItem) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', uploadItem.file);
      formData.append('mediaId', `media_${Date.now()}`);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          uploadItem.progress = percentComplete;
          this.renderUploadQueue();
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          uploadItem.status = 'completed';
          resolve();
        } else {
          uploadItem.status = 'failed';
          reject(new Error('Upload failed'));
        }
      });
      
      xhr.addEventListener('error', () => {
        uploadItem.status = 'failed';
        reject(new Error('Upload failed'));
      });
      
      xhr.open('POST', '/api/upload-media');
      xhr.send(formData);
    });
  }

  openUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.style.display = 'block';
  }

  closeModal(modal) {
    modal.style.display = 'none';
  }

  removeFromQueue(uploadId) {
    this.uploadQueue = this.uploadQueue.filter(item => item.id !== uploadId);
    this.renderUploadQueue();
    this.updateUploadButton();
  }

  async loadMedia() {
    try {
      const media = await this.db.getAllItems('ghostmaker-media');
      this.renderMedia(media);
    } catch (error) {
      console.error('Failed to load media:', error);
      this.showError('Failed to load media');
    }
  }

  renderMedia(media) {
    const container = document.getElementById('mediaGrid');
    if (!container) return;

    if (media.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>No Media Files</h3>
          <p>Upload your first media file to get started</p>
          <button class="btn btn-primary" onclick="document.getElementById('uploadMedia').click()">
            Upload Media
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = media.map(item => `
      <div class="media-card" data-media-id="${item.mediaId}">
        <div class="media-thumbnail">
          ${item.fileType === 'image' ? 
            `<img src="${item.urls.thumbnail}" alt="${item.originalName}">` :
            `<video poster="${item.urls.thumbnail}">
               <source src="${item.urls.preview}" type="video/mp4">
             </video>`
          }
          <div class="media-overlay">
            <div class="media-type">${item.fileType}</div>
            <div class="media-status ${item.processingStatus}">${item.processingStatus}</div>
          </div>
        </div>
        <div class="media-info">
          <h4>${item.originalName}</h4>
          <p class="media-meta">
            ${this.formatFileSize(item.fileSize)}
            ${item.dimensions ? ` • ${item.dimensions.width}×${item.dimensions.height}` : ''}
            ${item.duration ? ` • ${Math.round(item.duration)}s` : ''}
          </p>
          <div class="media-actions">
            <button class="btn btn-small btn-secondary" onclick="adminDashboard.previewMedia('${item.mediaId}')">
              Preview
            </button>
            <button class="btn btn-small btn-danger" onclick="adminDashboard.deleteMedia('${item.mediaId}')">
              Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }

  // Toggle reorder mode
  toggleReorderMode() {
    this.isReorderMode = !this.isReorderMode;
    const reorderBtn = document.getElementById('reorderProjects');
    
    if (this.isReorderMode) {
      reorderBtn.textContent = 'Exit Reorder';
      reorderBtn.classList.remove('btn-secondary');
      reorderBtn.classList.add('btn-danger');
      
      // Add reorder mode styling to container
      const container = document.getElementById('projectsList');
      container.classList.add('reorder-mode');
    } else {
      reorderBtn.textContent = 'Reorder Projects';
      reorderBtn.classList.remove('btn-danger');
      reorderBtn.classList.add('btn-secondary');
      
      // Remove reorder mode styling
      const container = document.getElementById('projectsList');
      container.classList.remove('reorder-mode');
    }
    
    // Re-render projects with new mode
    this.loadProjects();
  }

  // Drag and Drop functionality for projects
  setupProjectDragAndDrop() {
    const container = document.getElementById('projectsList');
    if (!container) return;

    let draggedElement = null;

    // Add event listeners to all project cards
    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedElement = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', (e) => {
        card.classList.remove('dragging');
        draggedElement = null;
        // Remove all drag-over classes
        container.querySelectorAll('.project-card').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', (e) => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (draggedElement && draggedElement !== card) {
          this.reorderProjects(draggedElement, card);
        }
      });
    });
  }

  async reorderProjects(draggedCard, targetCard) {
    try {
      const container = document.getElementById('projectsList');
      const allCards = Array.from(container.querySelectorAll('.project-card'));
      
      // Get current order
      const draggedId = draggedCard.getAttribute('data-project-id');
      const targetId = targetCard.getAttribute('data-project-id');
      
      // Find indices
      const draggedIndex = allCards.findIndex(card => card.getAttribute('data-project-id') === draggedId);
      const targetIndex = allCards.findIndex(card => card.getAttribute('data-project-id') === targetId);
      
      // Reorder array
      const newOrder = allCards.map(card => ({
        id: card.getAttribute('data-project-id')
      }));
      
      // Move dragged item to new position
      const [movedItem] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);
      
      // Update positions in database
      const response = await fetch('/api/projects-order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectOrder: newOrder })
      });
      
      if (response.ok) {
        this.showNotification('Project order updated successfully', 'success');
        // Reload projects to reflect new order
        this.loadProjects();
      } else {
        throw new Error('Failed to update project order');
      }
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      this.showNotification('Failed to reorder projects', 'error');
    }
  }

  async deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.showNotification('Project deleted successfully', 'success');
        this.loadProjects(); // Reload the list
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      this.showNotification('Failed to delete project', 'error');
    }
  }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.adminDashboard = new AdminDashboardEnhanced();
});



