// Login Page JavaScript
// Handles user authentication and form submission

class LoginPage {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin(e);
      });
    }
  }

  async handleLogin(event) {
    const form = event.target;
    const formData = new FormData(form);
    
    const loginData = {
      email: formData.get('email'),
      password: formData.get('password'),
      rememberMe: formData.get('rememberMe') === 'on'
    };

    // Show loading state
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.classList.add('loading');
    submitButton.disabled = true;

    try {
      // Clear any previous error messages
      this.clearMessages();

      // For now, simulate login (replace with real authentication)
      const response = await this.simulateLogin(loginData);
      
      if (response.success) {
        this.showSuccess('Login successful! Redirecting...');
        
        // Store login state
        if (loginData.rememberMe) {
          localStorage.setItem('user', JSON.stringify(response.user));
        } else {
          sessionStorage.setItem('user', JSON.stringify(response.user));
        }
        
        // Redirect to dashboard or intended page
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1500);
        
      } else {
        this.showError(response.error || 'Login failed');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      this.showError('An error occurred during login. Please try again.');
    } finally {
      // Reset button state
      submitButton.classList.remove('loading');
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  async simulateLogin(loginData) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple validation (replace with real authentication)
    if (loginData.email === 'admin@ghostmakerstudio.com' && loginData.password === 'admin123') {
      return {
        success: true,
        user: {
          id: 'user_123',
          email: loginData.email,
          name: 'Admin User',
          role: 'admin'
        }
      };
    } else {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }
  }

  showError(message) {
    const form = document.getElementById('loginForm');
    const existingError = form.querySelector('.error-message');
    
    if (existingError) {
      existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    form.insertBefore(errorDiv, form.firstChild);
  }

  showSuccess(message) {
    const form = document.getElementById('loginForm');
    const existingSuccess = form.querySelector('.success-message');
    
    if (existingSuccess) {
      existingSuccess.remove();
    }
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    
    form.insertBefore(successDiv, form.firstChild);
  }

  clearMessages() {
    const form = document.getElementById('loginForm');
    const errorMessage = form.querySelector('.error-message');
    const successMessage = form.querySelector('.success-message');
    
    if (errorMessage) errorMessage.remove();
    if (successMessage) successMessage.remove();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LoginPage();
});










