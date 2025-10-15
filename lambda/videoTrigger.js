// AWS Lambda Function - Video Processing Trigger
// Triggers AWS MediaConvert jobs for video processing
// Triggered by S3 uploads

const AWS = require('aws-sdk');
const mediaconvert = new AWS.MediaConvert({ apiVersion: '2017-08-29' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const MEDIA_TABLE = process.env.DYNAMODB_MEDIA_TABLE || 'ghostmaker-media';
const S3_BUCKET = process.env.S3_BUCKET || 'ghostmaker-studio-media';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd17lfecj9hzae.cloudfront.net';
const MEDIACONVERT_ROLE = process.env.MEDIACONVERT_ROLE;
const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT;

// Set MediaConvert endpoint
if (MEDIACONVERT_ENDPOINT) {
  mediaconvert.endpoint = new AWS.Endpoint(MEDIACONVERT_ENDPOINT);
}

exports.handler = async (event) => {
  console.log('🎬 Video trigger Lambda invoked');
  
  try {
    // Get S3 object info from event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Video uploaded: ${key}`);
    
    // Skip if not a video or already processed
    if (!key.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      console.log('⏭️ Not a video file, skipping');
      return { statusCode: 200, body: 'Not a video file' };
    }
    
    if (key.includes('/hls/') || key.includes('/downloads/') || key.includes('/thumb.jpg')) {
      console.log('⏭️ Skipping already processed file');
      return { statusCode: 200, body: 'Already processed' };
    }
    
    // Extract project info
    const pathParts = key.split('/');
    if (pathParts.length < 4 || pathParts[0] !== 'projects') {
      console.log('⏭️ Not a project media file');
      return { statusCode: 200, body: 'Not a project media file' };
    }
    
    const projectId = pathParts[1];
    const mediaId = pathParts[3];
    const fileName = pathParts[pathParts.length - 1];
    
    console.log(`Project: ${projectId}, Media: ${mediaId}, File: ${fileName}`);
    
    // Update DynamoDB status to processing
    await updateProcessingStatus(mediaId, projectId, 'processing');
    
    // Create MediaConvert job
    const inputPath = `s3://${bucket}/${key}`;
    const outputPath = `s3://${bucket}/projects/${projectId}/media/${mediaId}/`;
    
    const jobSettings = createJobSettings(inputPath, outputPath, mediaId);
    
    const createJobParams = {
      Role: MEDIACONVERT_ROLE,
      Settings: jobSettings,
      UserMetadata: {
        projectId: projectId,
        mediaId: mediaId,
        bucket: bucket
      }
    };
    
    console.log('📤 Submitting MediaConvert job...');
    const job = await mediaconvert.createJob(createJobParams).promise();
    
    console.log(`✅ MediaConvert job created: ${job.Job.Id}`);
    
    // Update DynamoDB with job ID
    await dynamodb.update({
      TableName: MEDIA_TABLE,
      Key: { id: mediaId, projectId: projectId },
      UpdateExpression: 'SET mediaConvertJobId = :jobId, processingStatus = :status',
      ExpressionAttributeValues: {
        ':jobId': job.Job.Id,
        ':status': 'processing'
      }
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'MediaConvert job submitted',
        jobId: job.Job.Id,
        mediaId: mediaId
      })
    };
    
  } catch (error) {
    console.error('❌ Failed to create MediaConvert job:', error);
    
    // Update status to failed
    try {
      const key = event.Records[0].s3.object.key;
      const pathParts = key.split('/');
      if (pathParts.length >= 4) {
        const projectId = pathParts[1];
        const mediaId = pathParts[3];
        await updateProcessingStatus(mediaId, projectId, 'failed', error.message);
      }
    } catch (dbError) {
      console.error('Failed to update error status:', dbError);
    }
    
    throw error;
  }
};

// Create MediaConvert job settings
function createJobSettings(inputPath, outputPath, mediaId) {
  return {
    Inputs: [{
      FileInput: inputPath,
      AudioSelectors: {
        'Audio Selector 1': {
          DefaultSelection: 'DEFAULT'
        }
      },
      VideoSelector: {}
    }],
    OutputGroups: [
      // HLS Output Group
      {
        Name: 'HLS',
        OutputGroupSettings: {
          Type: 'HLS_GROUP_SETTINGS',
          HlsGroupSettings: {
            SegmentLength: 2,
            MinSegmentLength: 0,
            Destination: `${outputPath}hls/`,
            SegmentControl: 'SEGMENTED_FILES',
            ManifestDurationFormat: 'INTEGER',
            StreamInfResolution: 'INCLUDE',
            ClientCache: 'ENABLED',
            ProgramDateTime: 'EXCLUDE',
            CodecSpecification: 'RFC_4281',
            OutputSelection: 'MANIFESTS_AND_SEGMENTS',
            TimedMetadataId3Period: 10,
            TimedMetadataId3Frame: 'PRIV',
            CaptionLanguageSetting: 'OMIT',
            SegmentLengthControl: 'GOP_MULTIPLE'
          }
        },
        Outputs: [
          // 1080p
          {
            NameModifier: '_1080p',
            VideoDescription: {
              Width: 1920,
              Height: 1080,
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  QvbrSettings: { QvbrQualityLevel: 8 },
                  MaxBitrate: 6000000,
                  CodecProfile: 'HIGH',
                  GopSize: 60,
                  GopSizeUnits: 'FRAMES',
                  FramerateControl: 'SPECIFIED',
                  FramerateNumerator: 30,
                  FramerateDenominator: 1,
                  SceneChangeDetect: 'TRANSITION_DETECTION'
                }
              }
            },
            AudioDescriptions: [{
              CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                  Bitrate: 128000,
                  CodingMode: 'CODING_MODE_2_0',
                  SampleRate: 48000
                }
              }
            }],
            ContainerSettings: {
              Container: 'M3U8',
              M3u8Settings: {
                AudioFramesPerPes: 4,
                PcrControl: 'PCR_EVERY_PES_PACKET',
                PmtPid: 480,
                VideoPid: 481,
                AudioPids: [482]
              }
            }
          },
          // 720p
          {
            NameModifier: '_720p',
            VideoDescription: {
              Width: 1280,
              Height: 720,
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  QvbrSettings: { QvbrQualityLevel: 7 },
                  MaxBitrate: 3000000,
                  CodecProfile: 'HIGH',
                  GopSize: 60,
                  GopSizeUnits: 'FRAMES',
                  FramerateControl: 'SPECIFIED',
                  FramerateNumerator: 30,
                  FramerateDenominator: 1,
                  SceneChangeDetect: 'TRANSITION_DETECTION'
                }
              }
            },
            AudioDescriptions: [{
              CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                  Bitrate: 128000,
                  CodingMode: 'CODING_MODE_2_0',
                  SampleRate: 48000
                }
              }
            }],
            ContainerSettings: {
              Container: 'M3U8',
              M3u8Settings: {
                AudioFramesPerPes: 4,
                PcrControl: 'PCR_EVERY_PES_PACKET',
                PmtPid: 480,
                VideoPid: 481,
                AudioPids: [482]
              }
            }
          },
          // 480p
          {
            NameModifier: '_480p',
            VideoDescription: {
              Width: 854,
              Height: 480,
              CodecSettings: {
                Codec: 'H_264',
                H264Settings: {
                  RateControlMode: 'QVBR',
                  QvbrSettings: { QvbrQualityLevel: 7 },
                  MaxBitrate: 1200000,
                  CodecProfile: 'MAIN',
                  GopSize: 60,
                  GopSizeUnits: 'FRAMES',
                  FramerateControl: 'SPECIFIED',
                  FramerateNumerator: 30,
                  FramerateDenominator: 1,
                  SceneChangeDetect: 'TRANSITION_DETECTION'
                }
              }
            },
            AudioDescriptions: [{
              CodecSettings: {
                Codec: 'AAC',
                AacSettings: {
                  Bitrate: 96000,
                  CodingMode: 'CODING_MODE_2_0',
                  SampleRate: 48000
                }
              }
            }],
            ContainerSettings: {
              Container: 'M3U8',
              M3u8Settings: {
                AudioFramesPerPes: 4,
                PcrControl: 'PCR_EVERY_PES_PACKET',
                PmtPid: 480,
                VideoPid: 481,
                AudioPids: [482]
              }
            }
          }
        ]
      },
      // Thumbnail Output Group
      {
        Name: 'Thumbnail',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: {
            Destination: `${outputPath}`
          }
        },
        Outputs: [{
          NameModifier: '_thumb',
          VideoDescription: {
            Width: 300,
            Height: 300,
            CodecSettings: {
              Codec: 'FRAME_CAPTURE',
              FrameCaptureSettings: {
                FramerateNumerator: 1,
                FramerateDenominator: 60,
                MaxCaptures: 1,
                Quality: 80
              }
            }
          },
          ContainerSettings: {
            Container: 'RAW'
          }
        }]
      },
      // Downloadable MP4 (1080p)
      {
        Name: 'MP4',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: {
            Destination: `${outputPath}downloads/`
          }
        },
        Outputs: [{
          NameModifier: '_1080p',
          VideoDescription: {
            Width: 1920,
            Height: 1080,
            CodecSettings: {
              Codec: 'H_264',
              H264Settings: {
                RateControlMode: 'QVBR',
                QvbrSettings: { QvbrQualityLevel: 8 },
                MaxBitrate: 5000000,
                CodecProfile: 'HIGH',
                GopSize: 60,
                GopSizeUnits: 'FRAMES',
                FramerateControl: 'SPECIFIED',
                FramerateNumerator: 30,
                FramerateDenominator: 1
              }
            }
          },
          AudioDescriptions: [{
            CodecSettings: {
              Codec: 'AAC',
              AacSettings: {
                Bitrate: 192000,
                CodingMode: 'CODING_MODE_2_0',
                SampleRate: 48000
              }
            }
          }],
          ContainerSettings: {
            Container: 'MP4',
            Mp4Settings: {
              CslgAtom: 'INCLUDE',
              FreeSpaceBox: 'EXCLUDE',
              MoovPlacement: 'PROGRESSIVE_DOWNLOAD'
            }
          }
        }]
      }
    ]
  };
}

// Update processing status
async function updateProcessingStatus(mediaId, projectId, status, errorMessage = null) {
  const updateParams = {
    TableName: MEDIA_TABLE,
    Key: { id: mediaId, projectId: projectId },
    UpdateExpression: 'SET processingStatus = :status',
    ExpressionAttributeValues: {
      ':status': status
    }
  };
  
  if (errorMessage) {
    updateParams.UpdateExpression += ', processingError = :error';
    updateParams.ExpressionAttributeValues[':error'] = errorMessage;
  }
  
  await dynamodb.update(updateParams).promise();
}

