import { MediaConvertClient, GetJobCommand, DescribeEndpointsCommand } from '@aws-sdk/client-mediaconvert';

let mediaconvert = null;

async function getMediaConvert() {
  if (mediaconvert) return mediaconvert;
  
  const tempClient = new MediaConvertClient({});
  const endpoints = await tempClient.send(new DescribeEndpointsCommand({}));
  const endpoint = endpoints.Endpoints[0].Url;
  
  mediaconvert = new MediaConvertClient({ endpoint });
  return mediaconvert;
}

export const handler = async (input) => {
  const jobId = input.mcJob.jobId;
  
  console.log(`Checking MediaConvert job status: ${jobId}`);
  
  try {
    const mc = await getMediaConvert();
    
    const command = new GetJobCommand({ Id: jobId });
    const response = await mc.send(command);
    
    const status = response.Job.Status;
    console.log(`Job ${jobId} status: ${status}`);
    
    return {
      jobId,
      status,
      job: response.Job
    };
    
  } catch (error) {
    console.error('Failed to get MediaConvert job status:', error);
    throw error;
  }
};

