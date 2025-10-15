@echo off
REM Lambda Deployment Script for Windows

echo Installing dependencies...
call npm install

echo.
echo Packaging Image Processor...
powershell -Command "Compress-Archive -Path imageProcessor.js, node_modules -DestinationPath imageProcessor.zip -Force"

echo.
echo Packaging Video Processor...
powershell -Command "Compress-Archive -Path videoProcessor.js, node_modules -DestinationPath videoProcessor.zip -Force"

echo.
echo Lambda packages created:
echo    - imageProcessor.zip
echo    - videoProcessor.zip
echo.
echo Upload these files to AWS Lambda in the AWS Console
pause

