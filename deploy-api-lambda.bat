@echo off
echo 🚀 Deploying GhostMaker Studio API Lambda Function...

REM Create deployment directory
if not exist "lambda-deploy" mkdir lambda-deploy
cd lambda-deploy

REM Copy Lambda function
copy ..\lambda-server.js .
copy ..\lambda-package.json package.json

REM Install dependencies
echo 📦 Installing dependencies...
npm install --production

REM Create deployment package
echo 📦 Creating deployment package...
powershell -Command "Compress-Archive -Path * -DestinationPath ghostmaker-api-lambda.zip -Force"

REM Deploy to AWS Lambda
echo 🚀 Deploying to AWS Lambda...
aws lambda create-function ^
    --function-name GhostMakerAPI ^
    --runtime nodejs18.x ^
    --role arn:aws:iam::684637209170:role/SimpleMediaProcessorRole ^
    --handler lambda-server.handler ^
    --zip-file fileb://ghostmaker-api-lambda.zip ^
    --timeout 30 ^
    --memory-size 512 ^
    --environment Variables="{DYNAMODB_PROJECTS_TABLE=ghostmaker-projects,DYNAMODB_MEDIA_TABLE=ghostmaker-media}" ^
    --region us-east-1 2>nul || ^
aws lambda update-function-code ^
    --function-name GhostMakerAPI ^
    --zip-file fileb://ghostmaker-api-lambda.zip ^
    --region us-east-1

echo ✅ Lambda function deployed!
echo 📋 Function name: GhostMakerAPI
echo 🔗 Next: Set up API Gateway to route api.ghostmakerstudio.com to this Lambda

cd ..
pause
