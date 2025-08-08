@echo off
REM Quick start script for Face Recognition Service on Windows 11

echo ==========================================
echo   Starting Face Recognition Service
echo ==========================================

REM Check if virtual environment exists
if not exist ".venv" (
    echo Virtual environment not found. Running setup...
    call setup-windows.bat
    if errorlevel 1 (
        echo Setup failed. Please check the logs.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

REM Check if models are downloaded
echo Checking face recognition models...
python download_models.py

REM Start the service
echo Starting Face Recognition Service on Windows 11...
echo Service will be available at: http://localhost:5001
echo.
echo Press Ctrl+C to stop the service
echo.

python app.py

pause