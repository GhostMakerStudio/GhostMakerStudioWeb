// Environment Variables Loader for GhostMaker Studio
// Loads environment variables for frontend use

class EnvLoader {
  constructor() {
    this.env = {};
    this.loadEnvironment();
  }

  async loadEnvironment() {
    try {
      // Try to load from .env file (for development)
      const response = await fetch('/.env');
      if (response.ok) {
        const envText = await response.text();
        this.parseEnvFile(envText);
      }
    } catch (error) {
      console.log('Using default environment configuration');
    }
  }

  parseEnvFile(envText) {
    const lines = envText.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          this.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }

  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }

  // Get AWS configuration
  getAWSConfig() {
    return {
      region: this.get('AWS_REGION', 'us-east-1'),
      userPoolId: this.get('COGNITO_USER_POOL_ID', 'us-east-1_DE8JEJjRR'),
      userPoolWebClientId: this.get('COGNITO_APP_CLIENT_ID', '2m882pr96ggop57pvpslualkp'),
      identityPoolId: `us-east-1:${this.get('AWS_ACCESS_KEY_ID', '').substring(0, 12)}`,
      bucket: this.get('S3_BUCKET_DEV', 'ghostmaker-studio-dev')
    };
  }

  // Get Stripe configuration
  getStripeConfig() {
    return {
      publishableKey: this.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_...'),
      secretKey: this.get('STRIPE_SECRET_KEY', 'sk_test_...')
    };
  }

  // Get current environment
  getCurrentEnvironment() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    } else if (hostname.includes('dev.')) {
      return 'staging';
    } else {
      return 'production';
    }
  }
}

// Create global instance
window.envLoader = new EnvLoader();

export default window.envLoader;

