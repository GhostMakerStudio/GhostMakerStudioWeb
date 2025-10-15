#!/bin/bash
# Lambda Deployment Script

echo "📦 Installing dependencies..."
npm install

echo "📦 Packaging Image Processor..."
zip -r imageProcessor.zip imageProcessor.js node_modules/

echo "📦 Packaging Video Processor..."
zip -r videoProcessor.zip videoProcessor.js node_modules/

echo "✅ Lambda packages created:"
echo "   - imageProcessor.zip"
echo "   - videoProcessor.zip"
echo ""
echo "📤 Upload these files to AWS Lambda in the AWS Console"

