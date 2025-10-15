import { MediaConvertClient, CreateJobCommand, DescribeEndpointsCommand } from '@aws-sdk/client-mediaconvert';

let mediaconvert = null;
const MEDIACONVERT_ROLE = process.env.MEDIACONVERT_ROLE;
const BUCKET = process.env.MEDIA_BUCKET;

async function getMediaConvert() {
  if (mediaconvert) return mediaconvert;
  
  const tempClient = new MediaConvertClient({});
  const endpoints = await tempClient.send(new DescribeEndpointsCommand({}));
  const endpoint = endpoints.Endpoints[0].Url;
  
  mediaconvert = new MediaConvertClient({ endpoint });
  return mediaconvert;
}

export const handler = async (input) => {
  const { bucket, key, mediaId, projectId } = input.meta;
  
  console.log(`Submitting MediaConvert job for ${key}`);
  
  try {
    const mc = await getMediaConvert();
    
    const inputPath = `s3://${bucket}/${key}`;
    const outputPath = `s3://${BUCKET}/processed/${projectId}/${mediaId}/`;
    
    const jobSettings = {
      Role: MEDIACONVERT_ROLE,
      Settings: {
        TimecodeConfig: { Source: 'ZEROBASED' },
        OutputGroups: [
          {
            Name: 'HLS',
            OutputGroupSettings: {
              Type: 'HLS_GROUP_SETTINGS',
              HlsGroupSettings: {
                Destination: `${outputPath}hls/`,
                SegmentLength: 4,
                MinSegmentLength: 0,
                DirectoryStructure: 'SINGLE_DIRECTORY',
                ManifestDurationFormat: 'INTEGER',
                ClientCache: 'ENABLED',
                StreamInfResolution: 'INCLUDE',
                CodecSpecification: 'RFC_4281',
                OutputSelection: 'MANIFESTS_AND_SEGMENTS',
                ProgramDateTime: 'EXCLUDE',
                SegmentControl: 'SEGMENTED_FILES'
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
                      MaxBitrate: 8500000,
                      GopSize: 2,
                      GopSizeUnits: 'SECONDS',
                      CodecProfile: 'HIGH'
                    }
                  }
                },
                AudioDescriptions: [{
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 160000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000
                    }
                  }
                }]
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
                      MaxBitrate: 4500000,
                      GopSize: 2,
                      GopSizeUnits: 'SECONDS',
                      CodecProfile: 'HIGH'
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
                }]
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
                      QvbrSettings: { QvbrQualityLevel: 6 },
                      MaxBitrate: 2000000,
                      GopSize: 2,
                      GopSizeUnits: 'SECONDS',
                      CodecProfile: 'MAIN'
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
                }]
              }
            ]
          },
          // Thumbnail
          {
            Name: 'Thumbnail',
            OutputGroupSettings: {
              Type: 'FILE_GROUP_SETTINGS',
              FileGroupSettings: {
                Destination: `${outputPath}`
              }
            },
            Outputs: [{
              NameModifier: '_poster',
              VideoDescription: {
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: 'FRAME_CAPTURE',
                  FrameCaptureSettings: {
                    FramerateNumerator: 1,
                    FramerateDenominator: 60,
                    MaxCaptures: 1,
                    Quality: 85
                  }
                }
              },
              ContainerSettings: {
                Container: 'RAW'
              }
            }]
          }
        ],
        Inputs: [{
          FileInput: inputPath,
          AudioSelectors: {
            'Audio Selector 1': { DefaultSelection: 'DEFAULT' }
          },
          VideoSelector: {}
        }]
      },
      UserMetadata: {
        projectId,
        mediaId,
        bucket
      }
    };
    
    const command = new CreateJobCommand(jobSettings);
    const job = await mc.send(command);
    
    console.log(`MediaConvert job created: ${job.Job.Id}`);
    
    return {
      jobId: job.Job.Id,
      status: job.Job.Status
    };
    
  } catch (error) {
    console.error('MediaConvert job creation failed:', error);
    throw error;
  }
};

