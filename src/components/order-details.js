// Order Details Page JavaScript
// Handles order tracking, messaging, and file management

import OrderService from '../api/order-service.js';
import DatabaseService from '../api/database.js';

class OrderDetailsPage {
  constructor() {
    this.orderService = OrderService;
    this.db = DatabaseService;
    this.orderId = this.getOrderIdFromUrl();
    this.order = null;
    this.messages = [];
    
    this.init();
  }

  getOrderIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/order\/(.+)$/);
    return match ? match[1] : null;
  }

  async init() {
    if (!this.orderId) {
      this.showError('Order ID not found');
      return;
    }

    await this.loadOrder();
    this.setupEventListeners();
    this.startPolling();
  }

  async loadOrder() {
    try {
      this.order = await this.db.getOrder(this.orderId);
      if (!this.order) {
        this.showError('Order not found');
        return;
      }

      this.updateOrderDisplay();
      await this.loadMessages();
      await this.loadTimeline();
    } catch (error) {
      console.error('Failed to load order:', error);
      this.showError('Failed to load order details');
    }
  }

  updateOrderDisplay() {
    // Update order header
    document.getElementById('orderId').textContent = this.order.orderId;
    document.getElementById('serviceType').textContent = this.getServiceDisplayName(this.order.service);
    document.getElementById('orderDate').textContent = this.formatDate(this.order.createdAt);
    document.getElementById('orderPrice').textContent = this.formatPrice(this.order.price);

    // Update status
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    statusText.textContent = this.getStatusDisplayName(this.order.status);
    statusBadge.className = `status-badge status-${this.order.status}`;

    // Update queue info if pending
    if (this.order.status === 'content_pending') {
      this.updateQueueInfo();
    } else {
      document.getElementById('queueInfo').style.display = 'none';
    }

    // Update project details
    this.updateProjectDetails();
    this.updateFilesDisplay();
  }

  async loadMessages() {
    try {
      this.messages = await this.db.getOrderMessages(this.orderId);
      this.displayMessages();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  displayMessages() {
    const container = document.getElementById('messagesContainer');
    
    if (this.messages.length === 0) {
      container.innerHTML = '<p class="no-messages">No messages yet. Start a conversation!</p>';
      return;
    }

    container.innerHTML = this.messages.map(message => `
      <div class="message ${message.from === 'client' ? 'message-client' : 'message-creator'}">
        <div class="message-header">
          <span class="message-sender">${message.from === 'client' ? 'You' : 'GhostMaker Studio'}</span>
          <span class="message-time">${this.formatTime(message.createdAt)}</span>
        </div>
        <div class="message-content">${message.content}</div>
        ${message.attachments.length > 0 ? this.renderAttachments(message.attachments) : ''}
      </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  renderAttachments(attachments) {
    return `
      <div class="message-attachments">
        ${attachments.map(file => `
          <div class="attachment">
            <span class="attachment-icon">${this.getFileIcon(file.type)}</span>
            <a href="${file.url}" target="_blank" class="attachment-link">${file.name}</a>
          </div>
        `).join('')}
      </div>
    `;
  }

  async loadTimeline() {
    try {
      const timeline = await this.orderService.getOrderTimeline(this.orderId);
      this.displayTimeline(timeline);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    }
  }

  displayTimeline(timeline) {
    const container = document.getElementById('timelineContainer');
    
    container.innerHTML = timeline.map(item => `
      <div class="timeline-item ${item.status}">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <h4>${item.event}</h4>
          <p class="timeline-time">${this.formatDateTime(item.timestamp)}</p>
          ${item.duration ? `<p class="timeline-duration">Duration: ${item.duration}</p>` : ''}
        </div>
      </div>
    `).join('');
  }

  async updateQueueInfo() {
    try {
      const queueInfo = await this.orderService.getQueuePosition(this.orderId);
      if (queueInfo) {
        document.getElementById('queuePosition').textContent = queueInfo.position;
        document.getElementById('estimatedStart').textContent = 
          `${queueInfo.estimatedStartDays} day${queueInfo.estimatedStartDays > 1 ? 's' : ''}`;
        document.getElementById('queueInfo').style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to load queue info:', error);
    }
  }

  updateProjectDetails() {
    const container = document.getElementById('projectDetails');
    container.innerHTML = `
      <div class="project-info">
        <p><strong>Service:</strong> ${this.getServiceDisplayName(this.order.service)}</p>
        <p><strong>Project Description:</strong></p>
        <div class="project-description">${this.order.projectDetails || 'No description provided'}</div>
      </div>
    `;
  }

  updateFilesDisplay() {
    const container = document.getElementById('filesContainer');
    
    const files = [
      ...(this.order.firstDraftFiles || []),
      ...(this.order.revisionFiles || [])
    ];

    if (files.length === 0) {
      container.innerHTML = '<p class="no-files">No files uploaded yet.</p>';
      return;
    }

    container.innerHTML = files.map(file => `
      <div class="file-item">
        <div class="file-icon">${this.getFileIcon(file.type)}</div>
        <div class="file-info">
          <h4>${file.name}</h4>
          <p>Uploaded ${this.formatDate(file.uploadedAt)}</p>
        </div>
        <div class="file-actions">
          <a href="${file.url}" class="btn btn-secondary" download>Download</a>
          <a href="${file.url}" class="btn btn-primary" target="_blank">Preview</a>
        </div>
      </div>
    `).join('');
  }

  setupEventListeners() {
    // Send message
    document.getElementById('sendMessage').addEventListener('click', () => {
      this.sendMessage();
    });

    // File input
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files);
    });

    // Enter key in message input
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  async sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();

    if (!content) return;

    try {
      await this.db.sendMessage({
        orderId: this.orderId,
        from: 'client',
        content,
        attachments: [] // TODO: Handle file attachments
      });

      messageInput.value = '';
      await this.loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Failed to send message');
    }
  }

  handleFileUpload(files) {
    // TODO: Implement file upload to S3
    console.log('Files to upload:', files);
  }

  startPolling() {
    // Poll for order updates every 30 seconds
    setInterval(async () => {
      await this.loadOrder();
    }, 30000);
  }

  // Helper Methods
  getServiceDisplayName(service) {
    const names = {
      flyer: 'Flyer Design',
      video: 'Video Production',
      app: 'Web/Mobile Application'
    };
    return names[service] || service;
  }

  getStatusDisplayName(status) {
    const names = {
      'content_pending': 'Content Pending...',
      'content_being_created': 'Content Being Created',
      'first_draft_done': 'First Draft Ready',
      'revision': 'Revision in Progress',
      'order_complete': 'Order Complete'
    };
    return names[status] || status;
  }

  getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.includes('pdf')) return '📄';
    return '📁';
  }

  formatPrice(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
  }

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString();
  }

  showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
      </div>
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OrderDetailsPage();
});

