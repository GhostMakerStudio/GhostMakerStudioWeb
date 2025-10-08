// Account Management System
// Handles customer accounts, payment methods, and billing

class AccountManager {
  constructor() {
    this.stripe = null;
    this.customerId = null;
    this.userId = null;
    this.init();
  }

  async init() {
    // Initialize Stripe
    this.stripe = Stripe('pk_test_51SFPAcEPGGa8C63UYWZuluhLjM0xbDs4zcWRWrBJgNjrwwYAsnlrXSBrHA38GosIhO7tvi9GCkPK3fcJyD2k6xNE00EmSS90OU');
    
    // Get user ID from localStorage (in real app, from authentication)
    this.userId = localStorage.getItem('userId') || 'user_' + Date.now();
    
    // Load account data
    await this.loadAccountData();
    this.setupEventListeners();
    this.setupStripeElements();
  }

  setupStripeElements() {
    // Create Stripe Elements
    const elements = this.stripe.elements();
    
    // Create card element
    this.cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#f8fafc',
          '::placeholder': {
            color: '#94a3b8',
          },
        },
        invalid: {
          color: '#ef4444',
        },
      },
    });

    // Mount the card element
    this.cardElement.mount('#card-element');

    // Handle real-time validation errors
    this.cardElement.on('change', ({error}) => {
      const displayError = document.getElementById('card-errors');
      if (error) {
        displayError.textContent = error.message;
      } else {
        displayError.textContent = '';
      }
    });
  }

  async loadAccountData() {
    try {
      // Load customer data from your database
      const customer = await this.getCustomerData();
      this.customerId = customer.stripeCustomerId;
      
      // Update UI
      this.updateAccountInfo(customer);
      await this.loadPaymentMethods();
      await this.loadOrderHistory();
      await this.loadBillingHistory();
    } catch (error) {
      console.error('Failed to load account data:', error);
    }
  }

  async getCustomerData() {
    // In real app, this would call your backend API
    // For now, we'll simulate customer data
    return {
      userId: this.userId,
      email: 'john@example.com',
      name: 'John Doe',
      stripeCustomerId: 'cus_test_1234567890',
      memberSince: 'January 2024',
      totalOrders: 3
    };
  }

  async loadPaymentMethods() {
    try {
      if (!this.customerId) return;

      // Get payment methods from Stripe
      const { data: paymentMethods } = await this.stripe.paymentMethods.list({
        customer: this.customerId,
        type: 'card',
      });

      this.displayPaymentMethods(paymentMethods);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  }

  displayPaymentMethods(paymentMethods) {
    const container = document.getElementById('paymentMethodsList');
    
    if (paymentMethods.length === 0) {
      container.innerHTML = '<p>No payment methods on file</p>';
      return;
    }

    container.innerHTML = paymentMethods.map(pm => `
      <div class="payment-method">
        <div class="card-info">
          <span class="card-brand">${pm.card.brand.toUpperCase()}</span>
          <span class="card-last4">**** **** **** ${pm.card.last4}</span>
          <span class="card-expiry">${pm.card.exp_month}/${pm.card.exp_year}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-small btn-secondary">Edit</button>
          <button class="btn btn-small btn-danger" onclick="accountManager.removePaymentMethod('${pm.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  }

  async addPaymentMethod(formData) {
    try {
      // Create payment method using Stripe Elements
      const { paymentMethod, error } = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.cardElement, // Use Stripe Elements
        billing_details: {
          name: formData.cardholderName,
          email: formData.cardholderEmail,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: this.customerId,
      });

      console.log('✅ Payment method added:', paymentMethod.id);
      
      // Refresh payment methods list
      await this.loadPaymentMethods();
      
      // Close modal
      this.closeModal();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to add payment method:', error);
      return { success: false, error: error.message };
    }
  }

  async removePaymentMethod(paymentMethodId) {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      console.log('✅ Payment method removed');
      
      // Refresh payment methods list
      await this.loadPaymentMethods();
    } catch (error) {
      console.error('Failed to remove payment method:', error);
    }
  }

  async loadOrderHistory() {
    try {
      // In real app, this would call your backend API
      const orders = [
        {
          orderId: 'order_123',
          service: 'Flyer Design',
          amount: '$5.00',
          status: 'Completed',
          date: '2024-01-15'
        },
        {
          orderId: 'order_124',
          service: 'Video Production',
          amount: '$25.00',
          status: 'In Progress',
          date: '2024-01-20'
        }
      ];

      this.displayOrderHistory(orders);
    } catch (error) {
      console.error('Failed to load order history:', error);
    }
  }

  displayOrderHistory(orders) {
    const container = document.getElementById('orderHistory');
    
    container.innerHTML = orders.map(order => `
      <div class="order-item">
        <div class="order-info">
          <span class="order-id">${order.orderId}</span>
          <span class="order-service">${order.service}</span>
          <span class="order-amount">${order.amount}</span>
          <span class="order-status ${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span>
        </div>
        <div class="order-date">${order.date}</div>
      </div>
    `).join('');
  }

  async loadBillingHistory() {
    try {
      // In real app, this would call your backend API
      const billing = [
        {
          date: '2024-01-15',
          description: 'Flyer Design',
          amount: '$5.00',
          status: 'Paid'
        },
        {
          date: '2024-01-20',
          description: 'Video Production',
          amount: '$25.00',
          status: 'Paid'
        }
      ];

      this.displayBillingHistory(billing);
    } catch (error) {
      console.error('Failed to load billing history:', error);
    }
  }

  displayBillingHistory(billing) {
    const container = document.getElementById('billingHistory');
    
    container.innerHTML = billing.map(item => `
      <div class="billing-item">
        <div class="billing-info">
          <span class="billing-date">${item.date}</span>
          <span class="billing-description">${item.description}</span>
          <span class="billing-amount">${item.amount}</span>
          <span class="billing-status">${item.status}</span>
        </div>
      </div>
    `).join('');
  }

  updateAccountInfo(customer) {
    document.getElementById('userEmail').textContent = customer.email;
    document.getElementById('memberSince').textContent = customer.memberSince;
    document.getElementById('totalOrders').textContent = customer.totalOrders;
  }

  setupEventListeners() {
    // Add payment method button
    document.getElementById('addPaymentMethod').addEventListener('click', () => {
      this.openModal();
    });

    // Close modal
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });

    // Payment method form
    document.getElementById('paymentMethodForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddPaymentMethod();
    });
  }

  openModal() {
    document.getElementById('paymentModal').classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    document.getElementById('paymentMethodForm').reset();
  }

  async handleAddPaymentMethod() {
    const formData = {
      cardholderName: document.getElementById('cardholderName').value,
      cardholderEmail: document.getElementById('cardholderEmail').value
    };

    const result = await this.addPaymentMethod(formData);
    
    if (result.success) {
      alert('Payment method added successfully!');
    } else {
      alert('Failed to add payment method: ' + result.error);
    }
  }
}

// Initialize account manager
const accountManager = new AccountManager();
