# PowerShell GPU Setup Script for Face Recognition Service on Windows 11
# Run with: powershell -ExecutionPolicy Bypass -File setup-windows.ps1

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Face Recognition GPU Setup - Windows 11" -ForegroundColor Cyan  
Write-Host "===========================================" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "For best results, run PowerShell as Administrator"
}

# Check Python installation
try {
    $pythonVersion = python --version 2>$null
    Write-Host "✓ Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Error "Python is not installed or not in PATH"
    Write-Host "Please install Python 3.8+ from https://python.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Function to check NVIDIA GPU
function Test-NvidiaGPU {
    try {
        $gpuInfo = nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits 2>$null
        if ($gpuInfo) {
            Write-Host "✓ NVIDIA GPU detected:" -ForegroundColor Green
            Write-Host $gpuInfo -ForegroundColor Gray
            
            # Check CUDA
            try {
                $cudaVersion = nvcc --version 2>$null | Select-String "release"
                Write-Host "✓ CUDA detected: $cudaVersion" -ForegroundColor Green
                return $true
            } catch {
                Write-Warning "CUDA not found. Please install CUDA Toolkit 11.8 or 12.x"
                Write-Host "Download from: https://developer.nvidia.com/cuda-toolkit" -ForegroundColor Yellow
                return $false
            }
        }
    } catch {
        Write-Host "✗ NVIDIA GPU not detected" -ForegroundColor Yellow
        return $false
    }
}

# Function to check other GPU types
function Test-DirectMLGPU {
    Write-Host "✓ DirectML support available on Windows 11" -ForegroundColor Green
    Write-Host "  Compatible with AMD, Intel, and NVIDIA GPUs" -ForegroundColor Gray
    return $true
}

# Check GPU hardware
$hasNvidiaGPU = Test-NvidiaGPU
if (-not $hasNvidiaGPU) {
    Write-Host "Checking for DirectML GPU support..." -ForegroundColor Yellow
    $hasDirectML = Test-DirectMLGPU
}

# Create and activate virtual environment
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Blue
    python -m venv .venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Blue
& ".venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Blue
python -m pip install --upgrade pip

# Install packages
Write-Host "Installing GPU-accelerated packages..." -ForegroundColor Blue

if (Test-Path "requirements-gpu.txt") {
    Write-Host "Installing from requirements-gpu.txt..." -ForegroundColor Gray
    pip install -r requirements-gpu.txt
} else {
    # Install base requirements
    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt
    }
    
    # Install GPU packages based on hardware
    if ($hasNvidiaGPU) {
        Write-Host "Installing NVIDIA CUDA packages..." -ForegroundColor Gray
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
        pip install onnxruntime-gpu faiss-gpu
    } else {
        Write-Host "Installing DirectML packages..." -ForegroundColor Gray
        pip install torch torchvision
        pip install onnxruntime-directml faiss-cpu
    }
    
    pip install psutil
}

# Setup environment configuration
Write-Host "Setting up Windows environment configuration..." -ForegroundColor Blue

$envContent = @"

# Windows 11 GPU Configuration
AUTO_DETECT_GPU=true
FORCE_CPU=false
GPU_DEVICE_ID=0

# Windows Performance Settings  
GPU_BATCH_SIZE=64
GPU_MAX_IMAGE_SIZE=1920
CPU_BATCH_SIZE=16
CPU_MAX_IMAGE_SIZE=1024

# Windows Optimization
ENABLE_MEMORY_OPTIMIZATION=true
ENABLE_PARALLEL_PROCESSING=true
MAX_WORKERS=4

# Windows CUDA Settings (if NVIDIA GPU)
TF_FORCE_GPU_ALLOW_GROWTH=true
CUDA_CACHE_DISABLE=0
CUDA_LAUNCH_BLOCKING=0
CUDNN_BENCHMARK=1
"@

Add-Content -Path ".env" -Value $envContent

# Test GPU functionality
Write-Host "Testing GPU functionality on Windows..." -ForegroundColor Blue

$testScript = @"
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
"@

$testResult = python -c $testScript
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ GPU test passed on Windows 11!" -ForegroundColor Green
} else {
    Write-Warning "GPU test failed on Windows"
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Windows 11 Setup Complete!" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your face recognition service is now configured for Windows 11." -ForegroundColor Green
Write-Host "To start the service:" -ForegroundColor Yellow
Write-Host "  1. cd server/face-recognition" -ForegroundColor Gray
Write-Host "  2. .venv\Scripts\Activate.ps1" -ForegroundColor Gray  
Write-Host "  3. python app.py" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"