@echo off
REM AWS SAM Deployment Script for GhostMaker Studio Enterprise Media Pipeline (Windows)

echo.
echo ================================================================================================
echo GhostMaker Studio - Enterprise Media Pipeline Deployment
echo ================================================================================================
echo.

REM Check prerequisites
where sam >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo X AWS SAM CLI not installed. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
    exit /b 1
)

where aws >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo X AWS CLI not installed. Install: https://aws.amazon.com/cli/
    exit /b 1
)

REM Check AWS credentials
aws sts get-caller-identity >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo X AWS credentials not configured
    exit /b 1
)

echo [OK] Prerequisites check passed
echo.

REM Install dependencies for all Lambda functions
echo [Step 1/3] Installing Lambda dependencies...
for /d %%D in (lambdas\*) do (
    if exist "%%D\package.json" (
        echo   - Installing %%~nxD...
        cd %%D
        call npm install --production --quiet
        cd ..\..
    )
)

echo [OK] Dependencies installed
echo.

REM Build SAM application
echo [Step 2/3] Building SAM application...
call sam build

if %ERRORLEVEL% NEQ 0 (
    echo X Build failed
    exit /b 1
)

echo [OK] Build complete
echo.

REM Deploy
echo [Step 3/3] Deploying to AWS...
echo.
echo You will be prompted for deployment parameters.
echo Press Enter to accept defaults or provide custom values.
echo.

call sam deploy --guided --capabilities CAPABILITY_IAM --tags Project=GhostMakerStudio Environment=production

if %ERRORLEVEL% NEQ 0 (
    echo X Deployment failed
    exit /b 1
)

echo.
echo ================================================================================================
echo [SUCCESS] Deployment complete!
echo ================================================================================================
echo.
echo Next steps:
echo   1. Note the ApiBaseUrl from the outputs above
echo   2. Add to your .env file: SAM_API_URL=^<ApiBaseUrl^>
echo   3. Update server.js with the integration code (see server\integration-example.js)
echo   4. Test with: npm start
echo.
pause

