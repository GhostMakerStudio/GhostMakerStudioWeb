// Stripe Configuration
// This file manages Stripe keys for different environments

const StripeConfig = {
  // Get publishable key based on environment
  getPublishableKey: () => {
    // Check if we're in production (Amplify sets window.location.hostname)
    const isProduction = window.location.hostname === 'ghostmakerstudio.com' || 
                        window.location.hostname === 'www.ghostmakerstudio.com';
    
    if (isProduction) {
      // Production key (use live key when ready)
      return 'pk_test_51SFPAcEPGGa8C63UYWZuluhLjM0xbDs4zcWRWrBJgNjrwwYAsnlrXSBrHA38GosIhO7tvi9GCkPK3fcJyD2k6xNE00EmSS90OU';
    } else {
      // Development/test key
      return 'pk_test_51SFPAcEPGGa8C63UYWZuluhLjM0xbDs4zcWRWrBJgNjrwwYAsnlrXSBrHA38GosIhO7tvi9GCkPK3fcJyD2k6xNE00EmSS90OU';
    }
  },
  
  // API endpoint (backend)
  getApiUrl: () => {
    const isProduction = window.location.hostname === 'ghostmakerstudio.com' || 
                        window.location.hostname === 'www.ghostmakerstudio.com';
    
    if (isProduction) {
      return 'https://ghostmakerstudio.com';
    } else {
      return 'http://localhost:3000';
    }
  }
};

// Export for use in other files
window.StripeConfig = StripeConfig;









