#!/bin/bash
# AWS SAM Deployment Script for GhostMaker Studio Enterprise Media Pipeline

set -e

echo "🚀 GhostMaker Studio - Enterprise Media Pipeline Deployment"
echo "============================================================"
echo ""

# Check prerequisites
command -v sam >/dev/null 2>&1 || { echo "❌ AWS SAM CLI not installed. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not installed. Install: https://aws.amazon.com/cli/"; exit 1; }

# Check AWS credentials
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured"; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Install dependencies for all Lambda functions
echo "📦 Installing Lambda dependencies..."
for dir in lambdas/*/; do
  if [ -f "${dir}package.json" ]; then
    echo "  → $(basename $dir)"
    (cd "$dir" && npm install --production --quiet)
  fi
done

echo "✅ Dependencies installed"
echo ""

# Build SAM application
echo "🔨 Building SAM application..."
sam build

echo "✅ Build complete"
echo ""

# Deploy
echo "📤 Deploying to AWS..."
echo ""
echo "You will be prompted for deployment parameters."
echo "Press Enter to accept defaults or provide custom values."
echo ""

sam deploy \
  --guided \
  --capabilities CAPABILITY_IAM \
  --tags Project=GhostMakerStudio Environment=production

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Note the ApiBaseUrl from the outputs above"
echo "  2. Add to your .env file: SAM_API_URL=<ApiBaseUrl>"
echo "  3. Update server.js with the integration code (see server/integration-example.js)"
echo "  4. Test with: npm start"
echo ""

