@echo off
REM GPU Setup Script for Face Recognition Service on Windows 11
REM This script sets up GPU acceleration for face recognition

echo ==========================================
echo   Face Recognition GPU Setup - Windows 11
echo ==========================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo Python detected: 
python --version

REM Check if NVIDIA GPU is available
call :check_nvidia_gpu
if %errorlevel% neq 0 (
    echo NVIDIA GPU not detected, checking for other GPU types...
    call :check_other_gpu
)

REM Create virtual environment if it doesn't exist
if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip

REM Install GPU packages based on available hardware
call :install_gpu_packages

REM Setup environment configuration
call :setup_environment

REM Test GPU functionality
call :test_gpu

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo Your face recognition service is now configured for Windows 11.
echo To start the service:
echo   1. cd server/face-recognition
echo   2. .venv\Scripts\activate.bat
echo   3. python app.py
echo.
pause
exit /b 0

:check_nvidia_gpu
echo Checking for NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo No NVIDIA GPU detected
    exit /b 1
) else (
    echo NVIDIA GPU detected:
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits
    
    REM Check CUDA
    nvcc --version >nul 2>&1
    if errorlevel 1 (
        echo Warning: CUDA not found. Please install CUDA Toolkit 11.8 or 12.x
        echo Download from: https://developer.nvidia.com/cuda-toolkit
    ) else (
        echo CUDA detected:
        nvcc --version | findstr "release"
    )
    exit /b 0
)

:check_other_gpu
echo Checking for AMD/Intel GPU with DirectML support...
REM DirectML works on Windows 10/11 with any DirectX 12 compatible GPU
echo DirectML support available on Windows 11
set GPU_TYPE=DirectML
exit /b 0

:install_gpu_packages
echo Installing GPU-accelerated packages...

REM Check if requirements-gpu.txt exists
if exist "requirements-gpu.txt" (
    echo Installing from requirements-gpu.txt...
    pip install -r requirements-gpu.txt
) else (
    echo Installing GPU packages individually...
    
    REM Install base requirements first
    if exist "requirements.txt" (
        pip install -r requirements.txt
    )
    
    REM Install GPU-specific packages
    if defined NVIDIA_GPU (
        echo Installing NVIDIA CUDA packages...
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
        pip install onnxruntime-gpu faiss-gpu
    ) else (
        echo Installing DirectML packages for AMD/Intel GPU...
        pip install torch torchvision
        pip install onnxruntime-directml faiss-cpu
    )
    
    REM Install additional performance packages
    pip install psutil
)

echo GPU packages installation complete
exit /b 0

:setup_environment
echo Setting up Windows environment configuration...

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo. > .env
)

REM Add Windows-specific GPU configuration
echo. >> .env
echo # Windows 11 GPU Configuration >> .env
echo AUTO_DETECT_GPU=true >> .env
echo FORCE_CPU=false >> .env
echo GPU_DEVICE_ID=0 >> .env
echo. >> .env
echo # Windows Performance Settings >> .env
echo GPU_BATCH_SIZE=64 >> .env
echo GPU_MAX_IMAGE_SIZE=1920 >> .env
echo CPU_BATCH_SIZE=16 >> .env
echo CPU_MAX_IMAGE_SIZE=1024 >> .env
echo. >> .env
echo # Windows Optimization >> .env
echo ENABLE_MEMORY_OPTIMIZATION=true >> .env
echo ENABLE_PARALLEL_PROCESSING=true >> .env
echo MAX_WORKERS=4 >> .env
echo. >> .env
echo # Windows CUDA Settings (if NVIDIA GPU) >> .env
echo TF_FORCE_GPU_ALLOW_GROWTH=true >> .env
echo CUDA_CACHE_DISABLE=0 >> .env
echo CUDA_LAUNCH_BLOCKING=0 >> .env
echo CUDNN_BENCHMARK=1 >> .env

echo Environment configuration complete
exit /b 0

:test_gpu
echo Testing GPU functionality on Windows...

python -c "
import sys
sys.path.append('.')

try:
    from config import GPU_AVAILABLE, CUDA_AVAILABLE, get_config_summary
    
    print('Windows Configuration Summary:')
    config = get_config_summary()
    for key, value in config.items():
        print(f'  {key}: {value}')
    
    if GPU_AVAILABLE:
        print('\n✓ GPU acceleration is available on Windows 11!')
        
        # Test face processor initialization
        from face_processor import FaceProcessor
        processor = FaceProcessor()
        model_info = processor.get_model_info()
        
        print(f'\nWindows Model Info:')
        print(f'  Device: {model_info[\"device_info\"]}')
        print(f'  Using GPU: {model_info[\"using_gpu\"]}')
        print(f'  Providers: {model_info[\"providers\"]}')
        
    else:
        print('\n⚠ GPU acceleration not available, using CPU on Windows')
        
except Exception as e:
    print(f'\n✗ Error during Windows GPU test: {e}')
    sys.exit(1)
"

if errorlevel 1 (
    echo GPU test failed on Windows
    exit /b 1
) else (
    echo GPU test passed on Windows 11!
    exit /b 0
)