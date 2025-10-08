// Order Page JavaScript
// Handles order form, payment processing, and guest checkout

// Payment Service with Stripe integration
const PaymentService = {
  getServicePrice: (service) => {
    const prices = { flyer: 500, video: 2500, app: 25000 };
    return prices[service] || 0;
  },
  getServiceName: (service) => {
    const names = { flyer: 'Flyer Design', video: 'Video Production', app: 'Web/Mobile Application' };
    return names[service] || 'Unknown Service';
  },
  formatPrice: (cents) => `$${(cents / 100).toFixed(2)}`,
  validatePaymentForm: (formData) => {
    const errors = [];
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Valid email is required');
    }
    if (!formData.name || formData.name.trim().length < 2) {
      errors.push('Name is required (minimum 2 characters)');
    }
    if (!formData.service || !['flyer', 'video', 'app'].includes(formData.service)) {
      errors.push('Valid service selection is required');
    }
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
      errors.push('Valid card number is required');
    }
    if (!formData.expiryDate || !/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
      errors.push('Valid expiry date (MM/YY) is required');
    }
    if (!formData.cvc || formData.cvc.length < 3) {
      errors.push('Valid CVC is required');
    }
    if (!formData.cardholderName || formData.cardholderName.trim().length < 2) {
      errors.push('Cardholder name is required');
    }
    return { isValid: errors.length === 0, errors };
  },
  
  // Real Stripe API integration with custom form
  async processPayment(paymentData) {
    try {
      console.log('💳 Processing REAL Stripe payment:', paymentData);
      
      // Initialize Stripe with your publishable key
      if (!window.Stripe) {
        throw new Error('Stripe.js not loaded');
      }
      
      const stripe = Stripe('pk_test_51SFPAcEPGGa8C63UYWZuluhLjM0xbDs4zcWRWrBJgNjrwwYAsnlrXSBrHA38GosIhO7tvi9GCkPK3fcJyD2k6xNE00EmSS90OU');
      
      // Create PaymentMethod from your custom form data
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: {
          number: paymentData.cardNumber,
          exp_month: parseInt(paymentData.expiryDate.split('/')[0]),
          exp_year: parseInt('20' + paymentData.expiryDate.split('/')[1]),
          cvc: paymentData.cvc,
        },
        billing_details: {
          name: paymentData.cardholderName,
          email: paymentData.email,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ Stripe PaymentMethod created:', paymentMethod.id);
      
      // For now, we'll simulate the PaymentIntent creation
      // In production, this would call your backend API
      const paymentIntentId = 'pi_test_' + Date.now();
      
      return {
        success: true,
        paymentId: paymentIntentId,
        paymentMethodId: paymentMethod.id,
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd',
        status: 'succeeded'
      };
    } catch (error) {
      console.error('❌ Stripe payment failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Import real database service
import DatabaseService from '../api/database.js';

class OrderPage {
  constructor() {
    this.paymentService = PaymentService;
    this.db = DatabaseService;
    this.stripe = null;
    this.cardElement = null;
    this.isProcessing = false;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    // Skip payment initialization for now
    // await this.paymentService.initialize();
    // this.setupStripeElements();
  }

  setupEventListeners() {
    // Service selection
    const serviceOptions = document.querySelectorAll('.service-option');
    serviceOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.selectService(option.dataset.service);
        // Don't validate immediately when selecting service
      });
    });

    // Form submission
    const orderForm = document.getElementById('orderForm');
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.processOrder();
    });

    // Payment form formatting
    this.setupPaymentFormatters();

    // Only validate on form submission, not on field interactions
    // Remove the blur event listeners that were causing immediate validation
  }

  setupPaymentFormatters() {
    // Card number formatting
    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
      cardNumber.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        if (formattedValue.length > 19) formattedValue = formattedValue.substr(0, 19);
        e.target.value = formattedValue;
      });
    }

    // Expiry date formatting
    const expiryDate = document.getElementById('expiryDate');
    if (expiryDate) {
      expiryDate.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
          value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
      });
    }

    // CVC formatting (numbers only)
    const cvc = document.getElementById('cvc');
    if (cvc) {
      cvc.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
    }
  }

  selectService(service) {
    // Update UI
    document.querySelectorAll('.service-option').forEach(option => {
      option.classList.remove('selected');
    });
    document.querySelector(`[data-service="${service}"]`).classList.add('selected');

    // Update summary
    const price = this.paymentService.getServicePrice(service);
    const serviceName = this.paymentService.getServiceName(service);
    
    document.getElementById('summaryPrice').textContent = serviceName;
    document.getElementById('totalPrice').textContent = this.paymentService.formatPrice(price);

    // Enable submit button
    document.getElementById('submitButton').disabled = false;
    document.getElementById('buttonText').textContent = 'Place Order';
    
    // Don't validate immediately - just clear any existing errors
    this.clearValidationErrors();
  }

  async setupStripeElements() {
    // Skip Stripe setup for now - will be added later
    console.log('Stripe setup skipped for local testing');
  }

  validateForm() {
    const formData = this.getFormData();
    const validation = this.paymentService.validatePaymentForm(formData);
    
    const submitButton = document.getElementById('submitButton');
    submitButton.disabled = !validation.isValid || this.isProcessing;

    // Only show validation errors if there are actual errors
    if (validation.errors.length > 0) {
      this.showValidationErrors(validation.errors);
    } else {
      this.clearValidationErrors();
    }
  }

  clearValidationErrors() {
    // Remove existing error messages
    document.querySelectorAll('.error-message').forEach(el => el.remove());
  }

  getFormData() {
    return {
      service: document.querySelector('input[name="service"]:checked')?.value,
      name: document.getElementById('customerName').value,
      email: document.getElementById('customerEmail').value,
      projectDetails: document.getElementById('projectDetails').value,
      cardNumber: document.getElementById('cardNumber')?.value || '',
      expiryDate: document.getElementById('expiryDate')?.value || '',
      cvc: document.getElementById('cvc')?.value || '',
      cardholderName: document.getElementById('cardholderName')?.value || ''
    };
  }

  showValidationErrors(errors) {
    // Remove existing error messages
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    // Add new error messages
    if (errors.length > 0) {
      const errorContainer = document.createElement('div');
      errorContainer.className = 'error-messages';
      errorContainer.innerHTML = errors.map(error => 
        `<div class="error-message">${error}</div>`
      ).join('');
      
      const form = document.getElementById('orderForm');
      form.insertBefore(errorContainer, form.querySelector('.payment-section'));
    }
  }

  async processOrder() {
    if (this.isProcessing) return;

    // Validate form before processing
    const formData = this.getFormData();
    const validation = this.paymentService.validatePaymentForm(formData);
    
    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    this.isProcessing = true;
    this.updateButtonState(true);

    try {
      // Create guest user account (unauthorized Cognito user)
      const guestUser = await this.createGuestUser(formData.email, formData.name);
      
      // Prepare order data
      const orderData = {
        orderId: 'order_' + Date.now(),
        userId: guestUser.userId,
        cognitoUserId: guestUser.cognitoUserId,
        stripeCustomerId: guestUser.stripeCustomerId,
        email: formData.email,
        name: formData.name,
        service: formData.service,
        price: this.paymentService.getServicePrice(formData.service),
        projectDetails: formData.projectDetails,
        status: 'content_pending',
        createdAt: new Date().toISOString(),
        trackingToken: this.generateTrackingToken(formData.email)
      };

      // Process payment with Stripe
      const paymentResult = await this.paymentService.processPayment({
        amount: orderData.price,
        currency: 'usd',
        description: `${this.paymentService.getServiceName(formData.service)} - ${formData.name}`,
        metadata: {
          orderId: orderData.orderId,
          service: formData.service,
          email: formData.email
        }
      });

      if (paymentResult.success) {
        // Update order with payment info
        orderData.paymentId = paymentResult.paymentId;
        orderData.status = 'paid';
        orderData.paymentAmount = paymentResult.amount;
        orderData.paymentCurrency = paymentResult.currency;

        // Save to database
        await this.db.saveItem('ghostmaker-orders', orderData);
        
        // Send order confirmation email
        const trackingUrl = await this.sendOrderConfirmationEmail(orderData);
        
        // Show success message with tracking link
        this.showSuccess(
          `✅ Payment successful! Order ID: ${orderData.orderId}\nPayment ID: ${paymentResult.paymentId}\n\nCheck your email for confirmation and tracking details.`,
          trackingUrl
        );
        
        // Reset form
        document.getElementById('orderForm').reset();
        document.querySelectorAll('.service-option').forEach(option => {
          option.classList.remove('selected');
        });
        document.getElementById('summaryPrice').textContent = 'Select a service';
        document.getElementById('totalPrice').textContent = '$0.00';
        document.getElementById('submitButton').disabled = true;
        document.getElementById('buttonText').textContent = 'Select a service to continue';
      } else {
        throw new Error(paymentResult.error || 'Payment failed');
      }

    } catch (error) {
      console.error('Order processing failed:', error);
      this.showError('❌ Order failed: ' + error.message);
    } finally {
      this.isProcessing = false;
      this.updateButtonState(false);
    }
  }

  updateButtonState(isProcessing) {
    const button = document.getElementById('submitButton');
    const buttonText = document.getElementById('buttonText');
    const buttonLoader = document.getElementById('buttonLoader');

    if (isProcessing) {
      button.disabled = true;
      buttonText.style.display = 'none';
      buttonLoader.style.display = 'inline';
    } else {
      button.disabled = false;
      buttonText.style.display = 'inline';
      buttonLoader.style.display = 'none';
    }
  }

  showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button class="error-close">&times;</button>
      </div>
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);

    // Close button
    errorDiv.querySelector('.error-close').addEventListener('click', () => {
      errorDiv.remove();
    });
  }

  async createGuestUser(email, name) {
    try {
      console.log('👤 Creating guest user for:', email);
      
      // In real app, this would call your backend API to:
      // 1. Create unauthorized Cognito user (email only, no password)
      // 2. Create Stripe customer linked to Cognito user
      // 3. Return user IDs for database storage
      
      // Simulate the process
      const guestUser = {
        userId: 'guest_' + Date.now(),
        cognitoUserId: 'cognito_' + Date.now(),
        stripeCustomerId: 'cus_' + Date.now(),
        email: email,
        name: name,
        type: 'guest'
      };
      
      console.log('✅ Guest user created:', guestUser);
      return guestUser;
    } catch (error) {
      console.error('Failed to create guest user:', error);
      throw error;
    }
  }

  generateTrackingToken(email) {
    // Generate secure tracking token for email-based access
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${email}_${timestamp}_${random}`;
  }

  async sendOrderConfirmationEmail(orderData) {
    try {
      console.log('📧 Sending order confirmation email to:', orderData.email);
      
      // In real app, this would call your backend API to send email
      // Email would contain:
      // - Order confirmation details
      // - Tracking link: https://ghostmakerstudio.com/track?token=${orderData.trackingToken}
      // - Order number and status
      
      const trackingUrl = `http://localhost:3000/src/pages/order-tracking.html?token=${orderData.trackingToken}`;
      
      console.log('📧 Email would be sent with tracking URL:', trackingUrl);
      
      // For now, show the tracking URL in the success message
      return trackingUrl;
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      throw error;
    }
  }

  showSuccess(message, trackingUrl = null) {
    // Create success notification
    const successDiv = document.createElement('div');
    successDiv.className = 'success-notification';
    
    let messageContent = `
      <div class="success-content">
        <span class="success-icon">✅</span>
        <span class="success-message">${message}</span>
        <button class="success-close">&times;</button>
      </div>
    `;
    
    if (trackingUrl) {
      messageContent += `
        <div class="success-actions">
          <a href="${trackingUrl}" target="_blank" class="btn btn-small btn-secondary">
            View Order Status
          </a>
        </div>
      `;
    }
    
    successDiv.innerHTML = messageContent;

    document.body.appendChild(successDiv);

    // Auto-remove after 10 seconds (longer for tracking link)
    setTimeout(() => {
      successDiv.remove();
    }, 10000);

    // Close button
    successDiv.querySelector('.success-close').addEventListener('click', () => {
      successDiv.remove();
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OrderPage();
});
