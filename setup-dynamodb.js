const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB();

async function createTables() {
  try {
    console.log('🚀 Creating DynamoDB tables...');

    // Create Projects table
    const projectsTableParams = {
      TableName: 'ghostmaker-projects',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand billing
      Tags: [
        {
          Key: 'Project',
          Value: 'GhostMaker Studio'
        }
      ]
    };

    try {
      await dynamodb.createTable(projectsTableParams).promise();
      console.log('✅ Created projects table: ghostmaker-projects');
    } catch (error) {
      if (error.code === 'ResourceInUseException') {
        console.log('ℹ️ Projects table already exists');
      } else {
        throw error;
      }
    }

    // Create Media table
    const mediaTableParams = {
      TableName: 'ghostmaker-media',
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }, // Partition key
        { AttributeName: 'projectId', KeyType: 'RANGE' } // Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'projectId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand billing
      Tags: [
        {
          Key: 'Project',
          Value: 'GhostMaker Studio'
        }
      ]
    };

    try {
      await dynamodb.createTable(mediaTableParams).promise();
      console.log('✅ Created media table: ghostmaker-media');
    } catch (error) {
      if (error.code === 'ResourceInUseException') {
        console.log('ℹ️ Media table already exists');
      } else {
        throw error;
      }
    }

    console.log('🎉 DynamoDB tables setup complete!');
    console.log('');
    console.log('📋 Tables created:');
    console.log('- ghostmaker-projects (for project metadata)');
    console.log('- ghostmaker-media (for media file records)');
    console.log('');
    console.log('💡 You can now use DynamoDB instead of JSON files!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  }
}

createTables();








