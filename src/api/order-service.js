// Order Management Service for GhostMaker Studio
// Handles order workflow, status updates, and timeline tracking

import DatabaseService from './database.js';

class OrderService {
  constructor() {
    this.db = DatabaseService;
    this.statusFlow = [
      'content_pending',
      'content_being_created', 
      'first_draft_done',
      'revision',
      'order_complete'
    ];
  }

  // Order Workflow Management
  async startOrder(orderId) {
    const order = await this.db.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    await this.db.updateOrderStatus(orderId, 'content_being_created', {
      startedAt: new Date().toISOString()
    });

    // Notify client
    await this.notifyStatusChange(orderId, 'content_being_created');
    
    return await this.db.getOrder(orderId);
  }

  async submitFirstDraft(orderId, files, notes = '') {
    await this.db.updateOrderStatus(orderId, 'first_draft_done', {
      firstDraftFiles: files,
      firstDraftNotes: notes,
      firstDraftSubmittedAt: new Date().toISOString()
    });

    // Notify client
    await this.notifyStatusChange(orderId, 'first_draft_done');
    await this.sendDraftReadyEmail(orderId);

    return await this.db.getOrder(orderId);
  }

  async startRevision(orderId, revisionNumber = 1) {
    const status = revisionNumber === 1 ? 'first_revision' : 'revision';
    
    await this.db.updateOrderStatus(orderId, status, {
      revisionNumber,
      revisionStartedAt: new Date().toISOString()
    });

    // Notify client
    await this.notifyStatusChange(orderId, status);
    
    return await this.db.getOrder(orderId);
  }

  async submitRevision(orderId, files, notes = '') {
    const order = await this.db.getOrder(orderId);
    const revisionNumber = (order.revisionNumber || 0) + 1;

    await this.db.updateOrderStatus(orderId, 'revision_submitted', {
      revisionNumber,
      [`revision${revisionNumber}Files`]: files,
      [`revision${revisionNumber}Notes`]: notes,
      [`revision${revisionNumber}SubmittedAt`]: new Date().toISOString()
    });

    // Notify client
    await this.notifyStatusChange(orderId, 'revision_submitted');
    await this.sendDraftReadyEmail(orderId, revisionNumber);

    return await this.db.getOrder(orderId);
  }

  async completeOrder(orderId) {
    await this.db.updateOrderStatus(orderId, 'order_complete', {
      completedAt: new Date().toISOString()
    });

    // Send final delivery email
    await this.sendOrderCompleteEmail(orderId);

    return await this.db.getOrder(orderId);
  }

  // Queue Management
  async getQueuePosition(orderId) {
    const allOrders = await this.db.queryItems('ghostmaker-orders', 'status', 'content_pending');
    const sortedOrders = allOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const position = sortedOrders.findIndex(order => order.orderId === orderId) + 1;
    
    if (position === 0) {
      return null; // Order not in queue
    }

    // Estimate start time based on historical data
    const avgProcessingTime = await this.getAverageProcessingTime();
    const estimatedStartTime = new Date();
    estimatedStartTime.setHours(estimatedStartTime.getHours() + (position * avgProcessingTime));

    return {
      position,
      estimatedStartTime: estimatedStartTime.toISOString(),
      estimatedStartDays: Math.ceil((position * avgProcessingTime) / 24)
    };
  }

  async getAverageProcessingTime() {
    // Get historical data for average processing time
    const analytics = await this.db.getAnalytics();
    // Mock calculation - replace with real analytics
    return 8; // 8 hours average
  }

  // Timeline and Analytics
  async getOrderTimeline(orderId) {
    const order = await this.db.getOrder(orderId);
    if (!order) return null;

    const timeline = [];
    
    // Order placed
    if (order.timeline.orderPlaced) {
      timeline.push({
        event: 'Order Placed',
        timestamp: order.timeline.orderPlaced,
        status: 'completed'
      });
    }

    // Creator started
    if (order.timeline.creatorStarted) {
      timeline.push({
        event: 'Work Started',
        timestamp: order.timeline.creatorStarted,
        status: 'completed',
        duration: this.calculateDuration(order.timeline.orderPlaced, order.timeline.creatorStarted)
      });
    }

    // First draft
    if (order.timeline.firstDraftSubmitted) {
      timeline.push({
        event: 'First Draft Ready',
        timestamp: order.timeline.firstDraftSubmitted,
        status: 'completed',
        duration: this.calculateDuration(order.timeline.creatorStarted, order.timeline.firstDraftSubmitted)
      });
    }

    // Current status
    timeline.push({
      event: this.getStatusDisplayName(order.status),
      timestamp: new Date().toISOString(),
      status: order.status === 'order_complete' ? 'completed' : 'current'
    });

    return timeline;
  }

  // Communication
  async notifyStatusChange(orderId, newStatus) {
    const order = await this.db.getOrder(orderId);
    
    // Send push notification to creator's mobile device
    const message = `Order #${orderId} - Status: ${this.getStatusDisplayName(newStatus)}`;
    await this.db.sendNotification({
      orderId,
      from: 'system',
      content: message
    });
  }

  async sendDraftReadyEmail(orderId, revisionNumber = 1) {
    const order = await this.db.getOrder(orderId);
    const isFirstDraft = revisionNumber === 1;
    
    await fetch('/api/emails/draft-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: order.email,
        orderId: order.orderId,
        service: order.service,
        revisionNumber,
        isFirstDraft,
        files: isFirstDraft ? order.firstDraftFiles : order[`revision${revisionNumber}Files`]
      })
    });
  }

  async sendOrderCompleteEmail(orderId) {
    const order = await this.db.getOrder(orderId);
    
    await fetch('/api/emails/order-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: order.email,
        orderId: order.orderId,
        service: order.service,
        finalFiles: order.finalFiles || order.firstDraftFiles
      })
    });
  }

  // Helper Methods
  getStatusDisplayName(status) {
    const statusNames = {
      'content_pending': 'Content Pending...',
      'content_being_created': 'Content Being Created',
      'first_draft_done': 'First Draft Done',
      'revision': 'Revision in Progress',
      'order_complete': 'Order Complete'
    };
    return statusNames[status] || status;
  }

  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end - start) / (1000 * 60 * 60);
    
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  }

  // Analytics
  async getOrderAnalytics() {
    const orders = await this.db.queryItems('ghostmaker-orders', 'status', 'order_complete');
    
    const analytics = {
      totalOrders: orders.length,
      averageCompletionTime: 0,
      averageRevisionCount: 0,
      serviceBreakdown: {},
      timelineData: []
    };

    // Calculate averages and breakdowns
    orders.forEach(order => {
      // Service breakdown
      analytics.serviceBreakdown[order.service] = (analytics.serviceBreakdown[order.service] || 0) + 1;
      
      // Timeline data for performance analysis
      if (order.timeline) {
        analytics.timelineData.push({
          orderId: order.orderId,
          service: order.service,
          orderPlaced: order.timeline.orderPlaced,
          creatorStarted: order.timeline.creatorStarted,
          firstDraftSubmitted: order.timeline.firstDraftSubmitted,
          completed: order.timeline.orderCompleted
        });
      }
    });

    return analytics;
  }
}

export default new OrderService();

