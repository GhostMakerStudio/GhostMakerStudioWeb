// Simple Lambda function for GhostMaker Studio API (without sharp)
// This will handle API requests from your live website

const AWS = require('aws-sdk');

// Configure AWS (use IAM role credentials)
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

// DynamoDB table names
const PROJECTS_TABLE = process.env.DYNAMODB_PROJECTS_TABLE || 'ghostmaker-projects';
const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';

exports.handler = async (event, context) => {
  console.log('🚀 Lambda API Handler:', event.path, event.httpMethod);
  console.log('📊 Event:', JSON.stringify(event, null, 2));
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  try {
    // Handle different API endpoints
    if (event.path === '/api/projects' && event.httpMethod === 'GET') {
      return await handleGetProjects(headers);
    }
    
    if (event.path === '/api/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: 'lambda'
        })
      };
    }

    // 404 for unknown routes
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'API endpoint not found',
        path: event.path,
        method: event.httpMethod
      })
    };

  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};

// Get all projects (copied from server.js)
async function handleGetProjects(headers) {
  try {
    console.log('📁 Fetching all projects from DynamoDB');
    
    // Scan projects table
    const projectsResult = await dynamodb.scan({
      TableName: PROJECTS_TABLE
    }).promise();
    
    // Get all media items
    const mediaResult = await dynamodb.scan({
      TableName: MEDIA_TABLE
    }).promise();
    
    // Group media by project and sort by position
    const mediaByProject = {};
    mediaResult.Items.forEach(media => {
      if (!mediaByProject[media.projectId]) {
        mediaByProject[media.projectId] = [];
      }
      mediaByProject[media.projectId].push(media);
    });
    
    // Sort media by position for each project
    Object.keys(mediaByProject).forEach(projectId => {
      mediaByProject[projectId].sort((a, b) => {
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position;
        }
        if (a.position !== undefined && b.position === undefined) {
          return -1;
        }
        if (a.position === undefined && b.position !== undefined) {
          return 1;
        }
        return new Date(a.uploadDate) - new Date(b.uploadDate);
      });
    });
    
    // Combine projects with their media
    const projects = projectsResult.Items.map(project => {
      const projectMedia = mediaByProject[project.id] || [];
      return {
        ...project,
        content: projectMedia.map(media => ({
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          alt: media.filename,
          quality: media.qualities?.[0] || 'original',
          mediaId: media.id,
          position: media.position,
          videoQualities: media.videoQualities,
          imageQualities: media.imageQualities,
          urls: media.urls
        }))
      };
    });
    
    // Sort projects by position
    projects.sort((a, b) => {
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      if (a.position !== undefined && b.position === undefined) {
        return -1;
      }
      if (a.position === undefined && b.position !== undefined) {
        return 1;
      }
      return new Date(a.date) - new Date(b.date);
    });
    
    console.log('✅ Returning', projects.length, 'projects');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, projects })
    };
  } catch (error) {
    console.error('❌ Failed to fetch projects:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}
