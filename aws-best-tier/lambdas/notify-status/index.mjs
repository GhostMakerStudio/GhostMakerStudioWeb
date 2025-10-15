export const handler = async (input) => {
  console.log('Notification event:', JSON.stringify(input, null, 2));
  
  const { meta, manifest, error } = input;
  
  if (error) {
    console.error('Processing failed:', error);
    // TODO: Send failure notification (SNS, WebSocket, etc.)
    return {
      status: 'failed',
      mediaId: meta?.mediaId,
      error: error.Error || error.Cause || 'Unknown error'
    };
  }
  
  if (manifest) {
    console.log(`Processing complete for ${manifest.mediaId}`);
    // TODO: Send success notification (SNS, WebSocket, etc.)
    // Could trigger:
    // - Email to client
    // - WebSocket message to connected users
    // - SNS topic for webhooks
    return {
      status: 'success',
      mediaId: manifest.mediaId,
      processed: manifest.processed
    };
  }
  
  return { status: 'ok' };
};

