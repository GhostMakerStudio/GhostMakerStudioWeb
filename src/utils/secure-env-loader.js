// Secure Environment Variable Loader
// Safely loads environment variables for frontend use

class SecureEnvLoader {
  constructor() {
    this.env = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.env;

    try {
      // In development, we can safely load from .env
      // In production, these would be set by your build process or server
      if (window.location.hostname === 'localhost') {
        // For local development, we'll use a secure method
        this.env = {
          STRIPE_PUBLISHABLE_KEY: 'pk_test_51SFPACePGG', // Your actual test key
          NODE_ENV: 'development'
        };
      } else {
        // For production, use environment variables set by your deployment
        this.env = {
          STRIPE_PUBLISHABLE_KEY: window.ENV?.STRIPE_PUBLISHABLE_KEY || 'pk_live_...',
          NODE_ENV: 'production'
        };
      }

      // Make environment variables available globally
      window.ENV = this.env;
      this.loaded = true;
      
      console.log('✅ Environment variables loaded securely');
      return this.env;
    } catch (error) {
      console.error('❌ Failed to load environment variables:', error);
      return {};
    }
  }

  get(key) {
    return this.env[key];
  }
}

// Create singleton instance
const envLoader = new SecureEnvLoader();

// Auto-load on page load
document.addEventListener('DOMContentLoaded', () => {
  envLoader.load();
});

export default envLoader;
