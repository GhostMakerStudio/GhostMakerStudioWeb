// Environment Configuration for GhostMaker Studio
// Three-tier system: local dev, staging, production

const environments = {
  development: {
    name: 'Development',
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
    aws: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_DE8JEJjRR',
      userPoolWebClientId: '2m882pr96ggop57pvpslualkp',
      identityPoolId: 'us-east-1:684637209170',
      bucket: 'ghostmaker-studio-dev',
      apiEndpoint: 'http://localhost:3000/api'
    },
    features: {
      debugMode: true,
      mockPayments: true,
      enableAnalytics: false
    }
  },
  
  staging: {
    name: 'Staging',
    baseUrl: 'https://dev.ghostmakerstudio.com',
    apiUrl: 'https://dev-api.ghostmakerstudio.com',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
    aws: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_DE8JEJjRR',
      userPoolWebClientId: '2m882pr96ggop57pvpslualkp',
      identityPoolId: 'us-east-1:684637209170',
      bucket: 'ghostmaker-studio-staging',
      apiEndpoint: 'https://dev-api.ghostmakerstudio.com'
    },
    features: {
      debugMode: true,
      mockPayments: false,
      enableAnalytics: true
    }
  },
  
  production: {
    name: 'Production',
    baseUrl: 'https://ghostmakerstudio.com',
    apiUrl: 'https://api.ghostmakerstudio.com',
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_...',
    aws: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_DE8JEJjRR',
      userPoolWebClientId: '2m882pr96ggop57pvpslualkp',
      identityPoolId: 'us-east-1:684637209170',
      bucket: 'ghostmaker-studio-prod',
      apiEndpoint: 'https://api.ghostmakerstudio.com'
    },
    features: {
      debugMode: false,
      mockPayments: false,
      enableAnalytics: true
    }
  }
};

// Auto-detect environment based on URL
function getCurrentEnvironment() {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return environments.development;
  } else if (hostname.includes('dev.')) {
    return environments.staging;
  } else {
    return environments.production;
  }
}

// Export current config
const config = getCurrentEnvironment();

export { environments, getCurrentEnvironment, config };
export default config;
