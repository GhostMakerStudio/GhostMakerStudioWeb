// Order Tracking System
// Handles guest order lookup and management

class OrderTracker {
  constructor() {
    this.init();
  }

  async init() {
    this.setupEventListeners();
    
    // Check if user came from email link with tracking token
    const urlParams = new URLSearchParams(window.location.search);
    const trackingToken = urlParams.get('token');
    
    if (trackingToken) {
      await this.loadOrderByToken(trackingToken);
    }
  }

  setupEventListeners() {
    document.getElementById('trackingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.trackOrders();
    });
  }

  async trackOrders() {
    const email = document.getElementById('email').value;
    
    if (!email) {
      this.showError('Please enter your email address');
      return;
    }

    try {
      // In real app, this would call your backend API
      const orders = await this.getOrdersByEmail(email);
      
      if (orders.length === 0) {
        this.showNoOrders(email);
      } else {
        this.displayOrders(orders);
      }
    } catch (error) {
      console.error('Failed to track orders:', error);
      this.showError('Failed to load orders. Please try again.');
    }
  }

  async getOrdersByEmail(email) {
    // Simulate API call to get orders by email
    // In real app, this would query your database
    const mockOrders = [
      {
        orderId: 'order_1234567890',
        email: email,
        service: 'Flyer Design',
        status: 'Content Pending',
        amount: '$5.00',
        createdAt: '2024-01-15',
        timeline: {
          orderPlaced: '2024-01-15T10:30:00Z',
          contentReceived: null,
          creatorStarted: null,
          firstDraftSubmitted: null,
          revisionStarted: null,
          orderCompleted: null
        }
      },
      {
        orderId: 'order_1234567891',
        email: email,
        service: 'Video Production',
        status: 'First Draft Done',
        amount: '$25.00',
        createdAt: '2024-01-20',
        timeline: {
          orderPlaced: '2024-01-20T14:15:00Z',
          contentReceived: '2024-01-20T16:30:00Z',
          creatorStarted: '2024-01-21T09:00:00Z',
          firstDraftSubmitted: '2024-01-22T15:45:00Z',
          revisionStarted: null,
          orderCompleted: null
        }
      }
    ];

    // Filter by email (in real app, this would be done by the database)
    return mockOrders.filter(order => order.email === email);
  }

  displayOrders(orders) {
    const container = document.getElementById('orderResults');
    
    container.innerHTML = `
      <div class="orders-header">
        <h3>Your Orders (${orders.length})</h3>
        <p>Click on an order to view details and timeline</p>
      </div>
      <div class="orders-list">
        ${orders.map(order => this.createOrderCard(order)).join('')}
      </div>
    `;
    
    container.classList.remove('hidden');
  }

  createOrderCard(order) {
    const statusClass = order.status.toLowerCase().replace(/\s+/g, '-');
    
    return `
      <div class="order-card" onclick="orderTracker.showOrderDetails('${order.orderId}')">
        <div class="order-header">
          <div class="order-id">#${order.orderId}</div>
          <div class="order-status ${statusClass}">${order.status}</div>
        </div>
        <div class="order-info">
          <div class="order-service">${order.service}</div>
          <div class="order-amount">${order.amount}</div>
          <div class="order-date">Ordered: ${new Date(order.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="order-timeline">
          ${this.createTimelinePreview(order.timeline)}
        </div>
      </div>
    `;
  }

  createTimelinePreview(timeline) {
    const steps = [
      { key: 'orderPlaced', label: 'Order Placed', icon: '📝' },
      { key: 'contentReceived', label: 'Content Received', icon: '📁' },
      { key: 'creatorStarted', label: 'Creator Started', icon: '🎨' },
      { key: 'firstDraftSubmitted', label: 'First Draft Done', icon: '📋' },
      { key: 'revisionStarted', label: 'Revision Started', icon: '🔄' },
      { key: 'orderCompleted', label: 'Order Complete', icon: '✅' }
    ];

    return steps.map(step => {
      const isCompleted = timeline[step.key] !== null;
      return `
        <div class="timeline-step ${isCompleted ? 'completed' : 'pending'}">
          <span class="step-icon">${step.icon}</span>
          <span class="step-label">${step.label}</span>
        </div>
      `;
    }).join('');
  }

  showOrderDetails(orderId) {
    // In real app, this would show a detailed order view
    alert(`Order Details for ${orderId}\n\nThis would show:\n- Detailed timeline\n- File downloads\n- Communication history\n- Revision requests`);
  }

  showNoOrders(email) {
    const container = document.getElementById('orderResults');
    
    container.innerHTML = `
      <div class="no-orders">
        <h3>No Orders Found</h3>
        <p>No orders found for <strong>${email}</strong></p>
        <p>If you recently placed an order, it may take a few minutes to appear.</p>
        <div class="no-orders-actions">
          <a href="order.html" class="btn btn-primary">Place New Order</a>
          <button onclick="orderTracker.clearForm()" class="btn btn-secondary">Try Different Email</button>
        </div>
      </div>
    `;
    
    container.classList.remove('hidden');
  }

  showError(message) {
    const container = document.getElementById('orderResults');
    
    container.innerHTML = `
      <div class="error-message">
        <h3>Error</h3>
        <p>${message}</p>
        <button onclick="orderTracker.clearForm()" class="btn btn-secondary">Try Again</button>
      </div>
    `;
    
    container.classList.remove('hidden');
  }

  async loadOrderByToken(trackingToken) {
    try {
      console.log('🔍 Loading order by tracking token:', trackingToken);
      
      // In real app, this would call your backend API to:
      // 1. Validate the tracking token
      // 2. Find the order associated with the token
      // 3. Return order details
      
      // Simulate finding order by token
      const order = await this.getOrderByToken(trackingToken);
      
      if (order) {
        // Hide the email form and show the order directly
        document.querySelector('.tracking-form').style.display = 'none';
        this.displayOrders([order]);
      } else {
        this.showError('Invalid or expired tracking link. Please enter your email address to track your order.');
      }
    } catch (error) {
      console.error('Failed to load order by token:', error);
      this.showError('Failed to load order. Please enter your email address to track your order.');
    }
  }

  async getOrderByToken(trackingToken) {
    // Simulate API call to get order by tracking token
    // In real app, this would query your database
    
    // Extract email from token (in real app, this would be done by backend)
    const email = trackingToken.split('_')[0];
    
    const mockOrder = {
      orderId: 'order_1234567890',
      email: email,
      service: 'Flyer Design',
      status: 'Content Pending',
      amount: '$5.00',
      createdAt: '2024-01-15',
      trackingToken: trackingToken,
      timeline: {
        orderPlaced: '2024-01-15T10:30:00Z',
        contentReceived: null,
        creatorStarted: null,
        firstDraftSubmitted: null,
        revisionStarted: null,
        orderCompleted: null
      }
    };
    
    return mockOrder;
  }

  clearForm() {
    document.getElementById('email').value = '';
    document.getElementById('orderResults').classList.add('hidden');
    document.querySelector('.tracking-form').style.display = 'block';
  }
}

// Initialize order tracker
const orderTracker = new OrderTracker();
