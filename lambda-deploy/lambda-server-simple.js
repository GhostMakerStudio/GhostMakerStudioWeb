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
  
  // CORS headers - Enhanced for admin panel
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
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
    
    if (event.path === '/api/projects' && event.httpMethod === 'POST') {
      return await handleCreateProject(event, headers);
    }
    
    // Handle project updates and deletions with dynamic path matching
    if (event.path.startsWith('/api/projects/') && event.httpMethod === 'PUT') {
      const projectId = event.path.split('/')[3];
      if (event.path.endsWith('/media-order')) {
        return await handleUpdateMediaOrder(event, headers);
      } else {
        return await handleUpdateProject(event, headers);
      }
    }
    
    if (event.path.startsWith('/api/projects/') && event.httpMethod === 'DELETE') {
      return await handleDeleteProject(event, headers);
    }
    
    // Admin panel endpoints
    if (event.path === '/api/grid-layout' && event.httpMethod === 'GET') {
      return await handleGetGridLayout(headers);
    }
    
    if (event.path === '/api/grid-layout' && event.httpMethod === 'PUT') {
      return await handleSaveGridLayout(event, headers);
    }
    
    if (event.path === '/api/upload' && event.httpMethod === 'POST') {
      return await handleFileUpload(event, headers);
    }
    
    if (event.path === '/api/lambda-upload/prepare' && event.httpMethod === 'POST') {
      return await handleLambdaUploadPrepare(event, headers);
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
    
    // Scan projects table (excluding grid_layout)
    const projectsResult = await dynamodb.scan({
      TableName: PROJECTS_TABLE,
      FilterExpression: 'id <> :gridLayoutId',
      ExpressionAttributeValues: {
        ':gridLayoutId': 'grid_layout'
      }
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

// Grid layout handlers
async function handleGetGridLayout(headers) {
  try {
    console.log('📐 Fetching grid layout from DynamoDB');
    
    // Get grid layout from DynamoDB
    const gridLayoutResult = await dynamodb.get({
      TableName: PROJECTS_TABLE,
      Key: { id: 'grid_layout' }
    }).promise();
    
    if (gridLayoutResult.Item && gridLayoutResult.Item.layout) {
      console.log('✅ Found grid layout in DynamoDB:', gridLayoutResult.Item.layout);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          layout: gridLayoutResult.Item.layout 
        })
      };
    } else {
      // Return default if no layout found
      console.log('⚠️ No grid layout found, returning default');
      const defaultLayout = {
        width: 3,
        height: 3,
        positions: {
          1: 'proj_mgpwwzngscqsw' // Your current project
        },
        sectionTitle: 'Our Work'
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, layout: defaultLayout })
      };
    }
  } catch (error) {
    console.error('❌ Failed to fetch grid layout:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

async function handleSaveGridLayout(event, headers) {
  try {
    console.log('💾 Saving grid layout to DynamoDB');
    const layout = JSON.parse(event.body);
    
    // Save grid layout to DynamoDB
    await dynamodb.put({
      TableName: PROJECTS_TABLE,
      Item: {
        id: 'grid_layout',
        layout: layout,
        updatedAt: new Date().toISOString()
      }
    }).promise();
    
    console.log('✅ Grid layout saved to DynamoDB:', layout);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Grid layout saved successfully' 
      })
    };
  } catch (error) {
    console.error('❌ Failed to save grid layout:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

async function handleFileUpload(event, headers) {
  try {
    console.log('📤 Handling file upload');
    
    // For now, return a mock response
    // In a full implementation, you'd handle actual file uploads
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'File upload endpoint active (mock response)',
        note: 'Full upload implementation needed'
      })
    };
  } catch (error) {
    console.error('❌ Failed to handle file upload:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

async function handleLambdaUploadPrepare(event, headers) {
  try {
    console.log('⚡ Preparing Lambda upload');
    
    // For now, return a mock response
    // In a full implementation, you'd generate presigned URLs
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Lambda upload prepare endpoint active (mock response)',
        note: 'Full presigned URL implementation needed'
      })
    };
  } catch (error) {
    console.error('❌ Failed to prepare Lambda upload:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// 🆕 CREATE PROJECT
async function handleCreateProject(event, headers) {
  try {
    console.log('📝 Creating new project');
    
    const projectData = JSON.parse(event.body);
    console.log('📊 Project data:', projectData);
    
    // Generate unique project ID
    const projectId = projectData.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const project = {
      id: projectId,
      title: projectData.title || 'Untitled Project',
      description: projectData.description || '',
      content: projectData.content || [],
      date: new Date().toISOString(),
      ...projectData
    };
    
    // Save to DynamoDB
    await dynamodb.put({
      TableName: PROJECTS_TABLE,
      Item: project
    }).promise();
    
    console.log('✅ Project created successfully:', projectId);
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        project: project,
        message: 'Project created successfully'
      })
    };
  } catch (error) {
    console.error('❌ Failed to create project:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// 🔄 UPDATE PROJECT
async function handleUpdateProject(event, headers) {
  try {
    const projectId = event.path.split('/')[3];
    console.log('🔄 Updating project:', projectId);
    
    const updateData = JSON.parse(event.body);
    console.log('📊 Update data:', updateData);
    
    // Update the project in DynamoDB
    const updateExpression = 'SET ' + Object.keys(updateData).map(key => `${key} = :${key}`).join(', ');
    const expressionAttributeValues = {};
    Object.keys(updateData).forEach(key => {
      expressionAttributeValues[`:${key}`] = updateData[key];
    });
    
    await dynamodb.update({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues
    }).promise();
    
    console.log('✅ Project updated successfully:', projectId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Project updated successfully'
      })
    };
  } catch (error) {
    console.error('❌ Failed to update project:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// 🗑️ DELETE PROJECT
async function handleDeleteProject(event, headers) {
  try {
    const projectId = event.path.split('/')[3];
    console.log('🗑️ Deleting project:', projectId);
    
    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId }
    }).promise();
    
    console.log('✅ Project deleted successfully:', projectId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Project deleted successfully'
      })
    };
  } catch (error) {
    console.error('❌ Failed to delete project:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// 📋 UPDATE MEDIA ORDER
async function handleUpdateMediaOrder(event, headers) {
  try {
    const projectId = event.path.split('/')[3];
    console.log('📋 Updating media order for project:', projectId);
    
    const { content } = JSON.parse(event.body);
    console.log('📊 New content order:', content);
    
    // Update the project's content array
    await dynamodb.update({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
      UpdateExpression: 'SET content = :content',
      ExpressionAttributeValues: {
        ':content': content
      }
    }).promise();
    
    console.log('✅ Media order updated successfully:', projectId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Media order updated successfully'
      })
    };
  } catch (error) {
    console.error('❌ Failed to update media order:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}
