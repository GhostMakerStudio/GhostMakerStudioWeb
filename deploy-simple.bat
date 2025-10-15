@echo off
echo 🚀 Deploying Simple Media Pipeline...

REM Check AWS CLI
where aws >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ AWS CLI not found. Please install it first.
    pause
    exit /b 1
)

REM Get AWS account ID
for /f "tokens=*" %%i in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%i
set REGION=%AWS_REGION%
if "%REGION%"=="" set REGION=us-east-1
set BUCKET=ghostmaker-studio-media-%ACCOUNT_ID%
set TABLE=ghostmaker-media

echo Account: %ACCOUNT_ID%
echo Region: %REGION%
echo Bucket: %BUCKET%
echo Table: %TABLE%

REM Create S3 bucket
echo 📦 Creating S3 bucket...
aws s3 mb s3://%BUCKET% --region %REGION% 2>nul || echo Bucket already exists

REM Create DynamoDB table
echo 🗃️ Creating DynamoDB table...
aws dynamodb create-table --table-name %TABLE% --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --region %REGION% 2>nul || echo Table already exists

echo ⏳ Waiting for table to be ready...
aws dynamodb wait table-exists --table-name %TABLE% --region %REGION%

REM Create IAM role
echo 🔐 Creating Lambda execution role...
echo { "Version": "2012-10-17", "Statement": [ { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" } ] } > lambda-role-trust.json

aws iam create-role --role-name SimpleMediaProcessorRole --assume-role-policy-document file://lambda-role-trust.json --region %REGION% 2>nul || echo Role already exists

REM Attach policies
aws iam attach-role-policy --role-name SimpleMediaProcessorRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name SimpleMediaProcessorRole --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name SimpleMediaProcessorRole --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
aws iam attach-role-policy --role-name SimpleMediaProcessorRole --policy-arn arn:aws:iam::aws:policy/AmazonMediaConvertFullAccess

REM Wait for role
timeout /t 10 /nobreak >nul

set ROLE_ARN=arn:aws:iam::%ACCOUNT_ID%:role/SimpleMediaProcessorRole

REM Deploy Image Processor
echo 🖼️ Deploying Image Processor...
cd simple-lambda\image-processor
call npm install --production
powershell -command "Compress-Archive -Path * -DestinationPath image-processor.zip -Force"
aws lambda create-function --function-name SimpleImageProcessor --runtime nodejs18.x --role %ROLE_ARN% --handler index.handler --zip-file fileb://image-processor.zip --timeout 300 --memory-size 1024 --environment Variables="{S3_BUCKET=%BUCKET%,DYNAMODB_MEDIA_TABLE=%TABLE%}" --region %REGION% 2>nul || aws lambda update-function-code --function-name SimpleImageProcessor --zip-file fileb://image-processor.zip --region %REGION%
cd ..\..

REM Deploy Video Processor
echo 🎥 Deploying Video Processor...
cd simple-lambda\video-processor
call npm install --production
powershell -command "Compress-Archive -Path * -DestinationPath video-processor.zip -Force"
aws lambda create-function --function-name SimpleVideoProcessor --runtime nodejs18.x --role %ROLE_ARN% --handler index.handler --zip-file fileb://video-processor.zip --timeout 300 --memory-size 512 --environment Variables="{S3_BUCKET=%BUCKET%,DYNAMODB_MEDIA_TABLE=%TABLE%}" --region %REGION% 2>nul || aws lambda update-function-code --function-name SimpleVideoProcessor --zip-file fileb://video-processor.zip --region %REGION%
cd ..\..

REM Deploy Image Resize
echo 🔄 Deploying Image Resize...
cd simple-lambda\image-resize
call npm install --production
powershell -command "Compress-Archive -Path * -DestinationPath image-resize.zip -Force"
aws lambda create-function --function-name SimpleImageResize --runtime nodejs18.x --role %ROLE_ARN% --handler index.handler --zip-file fileb://image-resize.zip --timeout 30 --memory-size 1024 --environment Variables="{S3_BUCKET=%BUCKET%}" --region %REGION% 2>nul || aws lambda update-function-code --function-name SimpleImageResize --zip-file fileb://image-resize.zip --region %REGION%
cd ..\..

echo.
echo ✅ Deployment complete!
echo.
echo 📋 Configuration:
echo    S3 Bucket: %BUCKET%
echo    DynamoDB Table: %TABLE%
echo    Region: %REGION%
echo.
echo 🔧 Update your .env file with:
echo    S3_BUCKET=%BUCKET%
echo    DYNAMODB_MEDIA_TABLE=%TABLE%
echo    AWS_REGION=%REGION%
echo.
echo 🚀 Ready to test!

pause



