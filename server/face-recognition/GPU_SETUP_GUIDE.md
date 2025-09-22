# GPU Setup Guide for Face Recognition Service

## Why Python Works in the CUDA Folder

When you run Python from the `server/face-recognition/` directory, it works because of the comprehensive GPU setup that's configured in this folder.

## Prerequisites

### 1. NVIDIA GPU Requirements

- NVIDIA GPU with CUDA Compute Capability 3.5 or higher
- NVIDIA drivers (latest recommended)
- CUDA Toolkit 11.8 or 12.x
- cuDNN library

### 2. Python Environment

- Python 3.8+ (you're using Python 3.13)
- Virtual environment recommended

## Setup Process

### Step 1: Install CUDA Toolkit

1. Download CUDA Toolkit from NVIDIA website
2. Install with default settings
3. Verify installation: `nvcc --version`

### Step 2: Install cuDNN

1. Download cuDNN from NVIDIA Developer site
2. Extract to CUDA installation directory
3. Add to PATH: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v11.8\bin`

### Step 3: Setup Python Environment

```bash
# Navigate to face-recognition directory
cd server/face-recognition

# Create virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install GPU requirements
pip install -r requirements-gpu.txt
```

### Step 4: Configure Environment Variables

The startup scripts automatically set these, but you can also set them manually:

**Windows (PowerShell):**

```powershell
$env:CUDA_VISIBLE_DEVICES = "0"
$env:FORCE_CPU = "false"
$env:AUTO_DETECT_GPU = "true"
$env:TF_FORCE_GPU_ALLOW_GROWTH = "true"
$env:CUDA_CACHE_DISABLE = "0"
$env:CUDA_LAUNCH_BLOCKING = "0"
$env:CUDNN_BENCHMARK = "1"
```

**Windows (Command Prompt):**

```cmd
set CUDA_VISIBLE_DEVICES=0
set FORCE_CPU=false
set AUTO_DETECT_GPU=true
set TF_FORCE_GPU_ALLOW_GROWTH=true
set CUDA_CACHE_DISABLE=0
set CUDA_LAUNCH_BLOCKING=0
set CUDNN_BENCHMARK=1
```

**Linux/Mac:**

```bash
export CUDA_VISIBLE_DEVICES=0
export FORCE_CPU=false
export AUTO_DETECT_GPU=true
export TF_FORCE_GPU_ALLOW_GROWTH=true
export CUDA_CACHE_DISABLE=0
export CUDA_LAUNCH_BLOCKING=0
export CUDNN_BENCHMARK=1
```

## Running the Service

### Option 1: Use Startup Scripts (Recommended)

```bash
# Windows PowerShell
.\start-gpu.ps1

# Windows Command Prompt
start-gpu.bat

# Linux/Mac
./setup-gpu.sh
```

### Option 2: Manual Startup

```bash
# Set environment variables first, then:
python app.py
```

## Verification

### Check GPU Status

```bash
# Test GPU detection
python -c "from config import GPU_AVAILABLE, CUDA_AVAILABLE; print(f'GPU: {GPU_AVAILABLE}, CUDA: {CUDA_AVAILABLE}')"

# Test face processor
python -c "from face_processor import FaceProcessor; fp = FaceProcessor(); print(fp.get_model_info())"
```

### Health Check

```bash
curl http://localhost:5001/health
curl http://localhost:5001/status
```

## Troubleshooting

### Common Issues

1. **CUDA not detected**

   - Check NVIDIA drivers: `nvidia-smi`
   - Verify CUDA installation: `nvcc --version`
   - Ensure PATH includes CUDA binaries

2. **ONNX Runtime GPU not available**

   - Install: `pip install onnxruntime-gpu`
   - Check providers: `python -c "import onnxruntime; print(onnxruntime.get_available_providers())"`

3. **Memory issues**

   - Reduce batch size in environment variables
   - Enable memory optimization: `ENABLE_MEMORY_OPTIMIZATION=true`

4. **Performance issues**
   - Check GPU utilization: `nvidia-smi`
   - Verify cuDNN installation
   - Ensure proper CUDA version compatibility

### Debug Mode

```bash
# Enable debug logging
set LOG_LEVEL=DEBUG
python app.py
```

## Performance Optimization

### GPU Settings

- **Batch Size**: 64 (GPU) vs 32 (CPU)
- **Image Size**: 1920px (GPU) vs 1024px (CPU)
- **Workers**: 8 (GPU) vs 6 (CPU)
- **Memory**: Automatic growth enabled

### Memory Management

- Automatic GPU memory cleanup
- Optimized image preprocessing
- Parallel processing for batch operations

## Configuration Files

- `config.py`: Main configuration with GPU detection
- `requirements-gpu.txt`: GPU-accelerated dependencies
- `start-gpu.ps1/.bat`: Windows startup scripts
- `setup-gpu.sh`: Linux/Mac setup script

## Why It Works in This Directory

1. **Environment Setup**: All necessary environment variables are configured
2. **Dependencies**: GPU-accelerated packages are installed
3. **Configuration**: Auto-detection and optimization settings
4. **Path Management**: CUDA libraries are in PATH
5. **Model Loading**: InsightFace models are downloaded and cached

The system automatically detects and configures GPU acceleration when run from this directory, providing significant performance improvements for face recognition tasks.




