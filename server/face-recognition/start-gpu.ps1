# GPU-Only Face Recognition Service Startup Script
# This script starts the face recognition service with GPU acceleration only

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Starting Face Recognition with GPU Only" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Set environment variables for GPU acceleration
$env:CUDA_VISIBLE_DEVICES = "0"
$env:FORCE_CPU = "false"
$env:AUTO_DETECT_GPU = "true"

# Add cuDNN libraries to PATH
$env:PATH += ";C:\Users\Aakash\AppData\Roaming\Python\Python313\site-packages\nvidia\cudnn\bin"

# Set CUDA optimization flags
$env:TF_FORCE_GPU_ALLOW_GROWTH = "true"
$env:CUDA_CACHE_DISABLE = "0"
$env:CUDA_LAUNCH_BLOCKING = "0"
$env:CUDNN_BENCHMARK = "1"

# Set GPU performance settings
$env:GPU_BATCH_SIZE = "64"
$env:GPU_MAX_IMAGE_SIZE = "1920"
$env:ENABLE_MEMORY_OPTIMIZATION = "true"
$env:ENABLE_PARALLEL_PROCESSING = "true"
$env:MAX_WORKERS = "8"

Write-Host "Environment configured for GPU acceleration" -ForegroundColor Green
Write-Host "Starting face recognition service..." -ForegroundColor Yellow
Write-Host ""

# Start the face recognition service
python app.py

Read-Host "Press Enter to exit"




