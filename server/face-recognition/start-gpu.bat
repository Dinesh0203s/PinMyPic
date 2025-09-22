@echo off
REM GPU-Only Face Recognition Service Startup Script
REM This script starts the face recognition service with GPU acceleration only

echo ==========================================
echo   Starting Face Recognition with GPU Only
echo ==========================================

REM Set environment variables for GPU acceleration
set CUDA_VISIBLE_DEVICES=0
set FORCE_CPU=false
set AUTO_DETECT_GPU=true

REM Add cuDNN libraries to PATH
set PATH=%PATH%;C:\Users\Aakash\AppData\Roaming\Python\Python313\site-packages\nvidia\cudnn\bin

REM Set CUDA optimization flags
set TF_FORCE_GPU_ALLOW_GROWTH=true
set CUDA_CACHE_DISABLE=0
set CUDA_LAUNCH_BLOCKING=0
set CUDNN_BENCHMARK=1

REM Set GPU performance settings
set GPU_BATCH_SIZE=64
set GPU_MAX_IMAGE_SIZE=1920
set ENABLE_MEMORY_OPTIMIZATION=true
set ENABLE_PARALLEL_PROCESSING=true
set MAX_WORKERS=8

echo Environment configured for GPU acceleration
echo Starting face recognition service...
echo.

REM Start the face recognition service
python app.py

pause




