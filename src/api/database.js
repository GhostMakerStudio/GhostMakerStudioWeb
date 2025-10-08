// Database Layer for GhostMaker Studio
// Handles all DynamoDB operations for orders, users, messages, and analytics

import { TABLES } from './aws-config.js';

class DatabaseService {
  constructor() {
    this.region = 'us-east-1';
    this.endpoint = window.location.hostname === 'localhost' ? 
      'http://localhost:8000' : // Local DynamoDB
      undefined; // Use AWS DynamoDB
  }

  // Order Management
  async createOrder(orderData) {
    const order = {
      orderId: this.generateId(),
      userId: orderData.userId || 'guest',
      email: orderData.email,
      service: orderData.service, // 'flyer', 'video', 'app'
      price: orderData.price,
      status: 'content_pending',
      createdAt: new Date().toISOString(),
      timeline: {
        orderPlaced: new Date().toISOString()
      },
      ...orderData
    };

    // Save to database
    await this.saveItem(TABLES.ORDERS, order);
    
    // Track analytics
    await this.trackEvent('order_placed', {
      orderId: order.orderId,
      service: order.service,
      price: order.price
    });

    return order;
  }

  async updateOrderStatus(orderId, status, additionalData = {}) {
    const updateData = {
      status,
      [`timeline.${this.getTimelineKey(status)}`]: new Date().toISOString(),
      ...additionalData
    };

    await this.updateItem(TABLES.ORDERS, { orderId }, updateData);
    
    // Track status change
    await this.trackEvent('status_changed', {
      orderId,
      newStatus: status
    });
  }

  async getOrder(orderId) {
    return await this.getItem(TABLES.ORDERS, { orderId });
  }

  async getUserOrders(userId) {
    return await this.queryItems(TABLES.ORDERS, 'userId', userId);
  }

  // Message System
  async sendMessage(messageData) {
    const message = {
      messageId: this.generateId(),
      orderId: messageData.orderId,
      from: messageData.from, // 'client' or 'creator'
      content: messageData.content,
      attachments: messageData.attachments || [],
      createdAt: new Date().toISOString(),
      read: false
    };

    await this.saveItem(TABLES.MESSAGES, message);
    
    // Send notification
    await this.sendNotification(message);
    
    return message;
  }

  async getOrderMessages(orderId) {
    return await this.queryItems(TABLES.MESSAGES, 'orderId', orderId);
  }

  // User Management
  async createUser(userData) {
    const user = {
      userId: userData.userId || this.generateId(),
      email: userData.email,
      name: userData.name,
      type: userData.type || 'guest', // 'guest' or 'registered'
      createdAt: new Date().toISOString(),
      ...userData
    };

    await this.saveItem(TABLES.USERS, user);
    return user;
  }

  async getUser(userId) {
    return await this.getItem(TABLES.USERS, { userId });
  }

  // Analytics
  async trackEvent(eventType, eventData) {
    const event = {
      eventId: this.generateId(),
      eventType,
      timestamp: new Date().toISOString(),
      ...eventData
    };

    await this.saveItem(TABLES.ANALYTICS, event);
  }

  async getAnalytics(timeRange = '30d') {
    // Get analytics data for dashboard
    return await this.queryItems(TABLES.ANALYTICS, 'eventType', 'order_placed');
  }

  // Helper Methods
  generateId() {
    return 'ghost_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getTimelineKey(status) {
    const statusMap = {
      'content_pending': 'orderPlaced',
      'content_being_created': 'creatorStarted',
      'first_draft_done': 'firstDraftSubmitted',
      'revision': 'revisionStarted',
      'order_complete': 'orderCompleted'
    };
    return statusMap[status] || status;
  }

  // Database Operations (to be implemented with actual AWS SDK)
  async saveItem(table, item) {
    // Mock implementation - replace with actual DynamoDB call
    console.log(`Saving to ${table}:`, item);
    localStorage.setItem(`${table}_${item.orderId || item.userId || item.messageId}`, JSON.stringify(item));
  }

  async getItem(table, key) {
    // Mock implementation
    const keyValue = Object.values(key)[0];
    const item = localStorage.getItem(`${table}_${keyValue}`);
    return item ? JSON.parse(item) : null;
  }

  async updateItem(table, key, updateData) {
    // Mock implementation
    const keyValue = Object.values(key)[0];
    const existing = await this.getItem(table, key);
    const updated = { ...existing, ...updateData };
    await this.saveItem(table, updated);
  }

  async queryItems(table, indexName, value) {
    // Mock implementation
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(table)) {
        const item = JSON.parse(localStorage.getItem(key));
        if (item[indexName] === value) {
          items.push(item);
        }
      }
    }
    return items;
  }

  async sendNotification(message) {
    // Send push notification to creator's mobile device
    console.log(`Notification: ${message.from} - Order #${message.orderId} - "${message.content}"`);
  }
}

export default new DatabaseService();

