import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

export const handler = async (event) => {
  console.log('S3 Object Created event:', JSON.stringify(event, null, 2));
  
  try {
    // EventBridge event structure
    const bucket = event.detail.bucket.name;
    const key = decodeURIComponent(event.detail.object.key.replace(/\+/g, ' '));
    
    console.log(`Starting Step Functions for ${bucket}/${key}`);
    
    const command = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify({
        bucket,
        key,
        size: event.detail.object.size,
        timestamp: event.time
      })
    });
    
    const result = await sfn.send(command);
    
    console.log(`Started execution: ${result.executionArn}`);
    
    return { statusCode: 200, body: JSON.stringify({ executionArn: result.executionArn }) };
    
  } catch (error) {
    console.error('Failed to start Step Functions:', error);
    throw error;
  }
};

