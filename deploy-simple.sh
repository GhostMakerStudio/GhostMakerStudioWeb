#!/bin/bash

# Simple Lambda Deployment Script
# Deploys Lambda functions directly without SAM

echo "🚀 Deploying Simple Media Pipeline..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
BUCKET="ghostmaker-studio-media-${ACCOUNT_ID}"
TABLE="ghostmaker-media"

echo "Account: $ACCOUNT_ID"
echo "Region: $REGION"
echo "Bucket: $BUCKET"
echo "Table: $TABLE"

# Create S3 bucket if it doesn't exist
echo "📦 Creating S3 bucket..."
aws s3 mb s3://$BUCKET --region $REGION 2>/dev/null || echo "Bucket already exists"

# Create DynamoDB table if it doesn't exist
echo "🗃️ Creating DynamoDB table..."
aws dynamodb create-table \
    --table-name $TABLE \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION 2>/dev/null || echo "Table already exists"

# Wait for table to be active
echo "⏳ Waiting for table to be ready..."
aws dynamodb wait table-exists --table-name $TABLE --region $REGION

# Create IAM role for Lambda
echo "🔐 Creating Lambda execution role..."
cat > lambda-role-trust.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
    --role-name SimpleMediaProcessorRole \
    --assume-role-policy-document file://lambda-role-trust.json \
    --region $REGION 2>/dev/null || echo "Role already exists"

# Attach policies
aws iam attach-role-policy \
    --role-name SimpleMediaProcessorRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
    --role-name SimpleMediaProcessorRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-role-policy \
    --role-name SimpleMediaProcessorRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
    --role-name SimpleMediaProcessorRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonMediaConvertFullAccess

# Wait for role to be ready
sleep 10

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/SimpleMediaProcessorRole"

# Deploy Image Processor
echo "🖼️ Deploying Image Processor..."
cd simple-lambda/image-processor
npm install --production
zip -r image-processor.zip . -x "*.git*" "*.md"
aws lambda create-function \
    --function-name SimpleImageProcessor \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://image-processor.zip \
    --timeout 300 \
    --memory-size 1024 \
    --environment Variables="{S3_BUCKET=$BUCKET,DYNAMODB_MEDIA_TABLE=$TABLE}" \
    --region $REGION 2>/dev/null || \
aws lambda update-function-code \
    --function-name SimpleImageProcessor \
    --zip-file fileb://image-processor.zip \
    --region $REGION
cd ../..

# Deploy Video Processor
echo "🎥 Deploying Video Processor..."
cd simple-lambda/video-processor
npm install --production
zip -r video-processor.zip . -x "*.git*" "*.md"
aws lambda create-function \
    --function-name SimpleVideoProcessor \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://video-processor.zip \
    --timeout 300 \
    --memory-size 512 \
    --environment Variables="{S3_BUCKET=$BUCKET,DYNAMODB_MEDIA_TABLE=$TABLE}" \
    --region $REGION 2>/dev/null || \
aws lambda update-function-code \
    --function-name SimpleVideoProcessor \
    --zip-file fileb://video-processor.zip \
    --region $REGION
cd ../..

# Deploy Image Resize
echo "🔄 Deploying Image Resize..."
cd simple-lambda/image-resize
npm install --production
zip -r image-resize.zip . -x "*.git*" "*.md"
aws lambda create-function \
    --function-name SimpleImageResize \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://image-resize.zip \
    --timeout 30 \
    --memory-size 1024 \
    --environment Variables="{S3_BUCKET=$BUCKET}" \
    --region $REGION 2>/dev/null || \
aws lambda update-function-code \
    --function-name SimpleImageResize \
    --zip-file fileb://image-resize.zip \
    --region $REGION
cd ../..

# Set up S3 event triggers
echo "⚡ Setting up S3 triggers..."

# Image trigger
aws s3api put-bucket-notification-configuration \
    --bucket $BUCKET \
    --notification-configuration '{
        "LambdaConfigurations": [
            {
                "Id": "ImageProcessorTrigger",
                "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:SimpleImageProcessor",
                "Events": ["s3:ObjectCreated:*"],
                "Filter": {
                    "Key": {
                        "FilterRules": [
                            {"Name": "suffix", "Value": ".jpg"},
                            {"Name": "suffix", "Value": ".jpeg"},
                            {"Name": "suffix", "Value": ".png"},
                            {"Name": "suffix", "Value": ".webp"}
                        ]
                    }
                }
            }
        ]
    }' 2>/dev/null || echo "Image trigger already exists"

# Video trigger
aws s3api put-bucket-notification-configuration \
    --bucket $BUCKET \
    --notification-configuration '{
        "LambdaConfigurations": [
            {
                "Id": "VideoProcessorTrigger",
                "LambdaFunctionArn": "arn:aws:lambda:'$REGION':'$ACCOUNT_ID':function:SimpleVideoProcessor",
                "Events": ["s3:ObjectCreated:*"],
                "Filter": {
                    "Key": {
                        "FilterRules": [
                            {"Name": "suffix", "Value": ".mp4"},
                            {"Name": "suffix", "Value": ".mov"},
                            {"Name": "suffix", "Value": ".avi"}
                        ]
                    }
                }
            }
        ]
    }' 2>/dev/null || echo "Video trigger already exists"

# Grant S3 permission to invoke Lambda
aws lambda add-permission \
    --function-name SimpleImageProcessor \
    --principal s3.amazonaws.com \
    --action lambda:InvokeFunction \
    --source-arn arn:aws:s3:::$BUCKET \
    --statement-id s3-trigger-image \
    --region $REGION 2>/dev/null || echo "Permission already exists"

aws lambda add-permission \
    --function-name SimpleVideoProcessor \
    --principal s3.amazonaws.com \
    --action lambda:InvokeFunction \
    --source-arn arn:aws:s3:::$BUCKET \
    --statement-id s3-trigger-video \
    --region $REGION 2>/dev/null || echo "Permission already exists"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Configuration:"
echo "   S3 Bucket: $BUCKET"
echo "   DynamoDB Table: $TABLE"
echo "   Region: $REGION"
echo ""
echo "🔧 Update your .env file with:"
echo "   S3_BUCKET=$BUCKET"
echo "   DYNAMODB_MEDIA_TABLE=$TABLE"
echo "   AWS_REGION=$REGION"
echo ""
echo "🚀 Ready to test!"



