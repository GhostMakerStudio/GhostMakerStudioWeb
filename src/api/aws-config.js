// AWS Configuration for GhostMaker Studio
import config from '../../config/environments.js';

// AWS SDK Configuration
const awsConfig = {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_DE8JEJjRR',
    userPoolWebClientId: '2m882pr96ggop57pvpslualkp',
    identityPoolId: 'us-east-1:684637209170',
    mandatorySignIn: false // Allow guest users
  },
  Storage: {
    bucket: 'ghostmaker-studio-dev',
    region: 'us-east-1',
    level: 'public' // Files are publicly accessible
  },
  API: {
    endpoints: [
      {
        name: 'ghostmaker-api',
        endpoint: 'http://localhost:3000/api',
        region: 'us-east-1'
      }
    ]
  }
};

// Database Tables (DynamoDB)
export const TABLES = {
  ORDERS: 'ghostmaker-orders',
  USERS: 'ghostmaker-users',
  MESSAGES: 'ghostmaker-messages',
  ANALYTICS: 'ghostmaker-analytics'
};

// S3 Bucket Structure
export const S3_PATHS = {
  UPLOADS: 'uploads/',
  DELIVERABLES: 'deliverables/',
  PORTFOLIO: 'portfolio/',
  TEMP: 'temp/'
};

export default awsConfig;
