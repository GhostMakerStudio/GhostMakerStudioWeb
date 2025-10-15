@echo off
echo 🚀 Deploying GhostMaker Studio Server to EC2...

REM Create deployment package
echo 📦 Creating deployment package...
if not exist "ec2-deploy" mkdir ec2-deploy
cd ec2-deploy

REM Copy server files
copy ..\server.js .
copy ..\package.json .
copy ..\package-lock.json .

REM Install dependencies
echo 📦 Installing dependencies...
npm install --production

REM Create PM2 ecosystem file for process management
echo 📝 Creating PM2 configuration...
echo { > ecosystem.config.js
echo   "apps": [{ >> ecosystem.config.js
echo     "name": "ghostmaker-studio", >> ecosystem.config.js
echo     "script": "server.js", >> ecosystem.config.js
echo     "instances": 1, >> ecosystem.config.js
echo     "exec_mode": "cluster", >> ecosystem.config.js
echo     "env": { >> ecosystem.config.js
echo       "NODE_ENV": "production", >> ecosystem.config.js
echo       "PORT": 3000 >> ecosystem.config.js
echo     } >> ecosystem.config.js
echo   }] >> ecosystem.config.js
echo } >> ecosystem.config.js

REM Create startup script
echo 📝 Creating startup script...
echo #!/bin/bash > start-server.sh
echo cd /home/ec2-user/ghostmaker-studio >> start-server.sh
echo npm install >> start-server.sh
echo pm2 start ecosystem.config.js >> start-server.sh
echo pm2 save >> start-server.sh
echo pm2 startup >> start-server.sh

REM Create ZIP file for deployment
echo 📦 Creating deployment ZIP...
powershell -Command "Compress-Archive -Path * -DestinationPath ghostmaker-server-deploy.zip -Force"

echo ✅ Deployment package created!
echo 📋 Next steps:
echo 1. Upload ghostmaker-server-deploy.zip to your EC2 instance
echo 2. Extract and run: ./start-server.sh
echo 3. Configure Load Balancer to route /api/* to your EC2 server
echo 4. Update Amplify to proxy API calls to your EC2 server

cd ..
pause
