// Payment System for GhostMaker Studio
// Handles Stripe integration and payment processing

import config from '../../config/environments.js';

class PaymentService {
  constructor() {
    this.stripePublishableKey = config.stripePublishableKey;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Load Stripe.js
    if (!window.Stripe) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => this.setupStripe();
      document.head.appendChild(script);
    } else {
      this.setupStripe();
    }
  }

  setupStripe() {
    this.stripe = window.Stripe(this.stripePublishableKey);
    this.isInitialized = true;
  }

  // Service Pricing
  getServicePrice(service) {
    const prices = {
      flyer: 500, // $5.00 in cents
      video: 2500, // $25.00 in cents
      app: 25000 // $250.00 in cents
    };
    return prices[service] || 0;
  }

  getServiceName(service) {
    const names = {
      flyer: 'Flyer Design',
      video: 'Video Production',
      app: 'Web/Mobile Application'
    };
    return names[service] || 'Unknown Service';
  }

  // Create Payment Intent
  async createPaymentIntent(orderData) {
    const amount = this.getServicePrice(orderData.service);
    
    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          metadata: {
            service: orderData.service,
            email: orderData.email,
            name: orderData.name
          }
        })
      });

      const { clientSecret } = await response.json();
      return clientSecret;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Process Payment
  async processPayment(paymentData) {
    await this.initialize();

    const { clientSecret, orderData } = paymentData;
    
    try {
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: paymentData.cardElement,
          billing_details: {
            name: orderData.name,
            email: orderData.email,
          },
        }
      });

      if (result.error) {
        throw result.error;
      }

      return {
        success: true,
        paymentIntent: result.paymentIntent,
        orderData: {
          ...orderData,
          paymentId: result.paymentIntent.id,
          amount: result.paymentIntent.amount,
          status: 'paid'
        }
      };
    } catch (error) {
      console.error('Payment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Guest Checkout (Auto-create account)
  async processGuestCheckout(paymentData) {
    const paymentResult = await this.processPayment(paymentData);
    
    if (paymentResult.success) {
      // Auto-create guest account
      const guestUser = await this.createGuestAccount(paymentResult.orderData);
      
      // Create order in database
      const order = await this.createOrder({
        ...paymentResult.orderData,
        userId: guestUser.userId,
        type: 'guest'
      });

      // Send confirmation emails
      await this.sendOrderConfirmation(order);
      
      return {
        success: true,
        order,
        user: guestUser,
        redirectUrl: `/order/${order.orderId}`
      };
    }

    return paymentResult;
  }

  async createGuestAccount(orderData) {
    const guestUser = {
      userId: this.generateGuestId(),
      email: orderData.email,
      name: orderData.name,
      type: 'guest',
      createdAt: new Date().toISOString()
    };

    // Save to database
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestUser)
    });

    return guestUser;
  }

  async createOrder(orderData) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    return await response.json();
  }

  async sendOrderConfirmation(order) {
    // Send email to client
    await fetch('/api/emails/order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: order.email,
        orderId: order.orderId,
        service: order.service,
        price: order.price
      })
    });

    // Send notification to creator
    await fetch('/api/emails/order-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.orderId,
        service: order.service,
        clientEmail: order.email,
        price: order.price
      })
    });
  }

  // Helper Methods
  generateGuestId() {
    return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  formatPrice(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // Validate payment form
  validatePaymentForm(formData) {
    const errors = [];

    if (!formData.email || !this.isValidEmail(formData.email)) {
      errors.push('Valid email is required');
    }

    if (!formData.name || formData.name.trim().length < 2) {
      errors.push('Name is required (minimum 2 characters)');
    }

    if (!formData.service || !['flyer', 'video', 'app'].includes(formData.service)) {
      errors.push('Valid service selection is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new PaymentService();

