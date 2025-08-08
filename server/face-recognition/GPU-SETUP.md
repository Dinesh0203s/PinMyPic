# GPU Acceleration Setup for Face Recognition

This guide explains how to set up GPU acceleration for the face recognition service in PinMyPic.

## Overview

The face recognition service automatically detects available GPU hardware and configures itself for optimal performance. It supports:

- **NVIDIA GPUs** with CUDA
- **AMD GPUs** with DirectML 
- **Intel integrated graphics** with DirectML
- **CPU fallback** when no GPU is available

## Current Status

✅ **Auto-detection enabled** - The service automatically detects GPU availability  
✅ **CPU fallback configured** - Works on any system  
✅ **Memory optimization enabled** - Prevents memory leaks  
✅ **Performance monitoring** - Tracks processing speed and memory usage

## GPU Hardware Requirements

### NVIDIA GPUs (Recommended)
- **GPU**: GTX 1060 6GB or newer, RTX series preferred
- **CUDA**: Version 11.8 or 12.x
- **Memory**: Minimum 4GB VRAM, 8GB+ recommended
- **Drivers**: Latest NVIDIA drivers

### AMD GPUs
- **GPU**: RX 580 or newer
- **Memory**: Minimum 4GB VRAM
- **Drivers**: Latest AMD drivers with DirectML support

### Intel GPUs
- **GPU**: Arc series or recent integrated graphics
- **Drivers**: Latest Intel graphics drivers

## Installation

### Option 1: Automatic Setup (Recommended)

#### Linux/macOS:
```bash
cd server/face-recognition
./setup-gpu.sh
```

#### Windows 11:
```cmd
cd server/face-recognition
setup-windows.bat
```

Or using PowerShell (recommended):
```powershell
cd server/face-recognition
powershell -ExecutionPolicy Bypass -File setup-windows.ps1
```

These scripts will:
1. Detect your GPU hardware
2. Install appropriate GPU packages
3. Configure environment variables
4. Test GPU functionality

### Option 2: Manual Setup

#### For NVIDIA GPUs:

**Linux/macOS:**
```bash
pip install -r requirements-gpu.txt
# Or: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
# pip install onnxruntime-gpu faiss-gpu
```

**Windows 11:**
```cmd
pip install -r requirements-gpu.txt
# Or: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
# pip install onnxruntime-gpu faiss-gpu
```

#### For AMD/Intel GPUs:

**Linux/macOS:**
```bash
pip install onnxruntime-directml
pip install faiss-cpu
```

**Windows 11 (DirectML):**
```cmd
pip install torch torchvision
pip install onnxruntime-directml
pip install faiss-cpu
```

## Environment Configuration

### GPU Environment Variables

Add these to your `.env` file for GPU optimization:

```env
# GPU Detection and Configuration
AUTO_DETECT_GPU=true          # Auto-detect GPU hardware
FORCE_CPU=false               # Set to true to force CPU-only mode
GPU_DEVICE_ID=0               # GPU device ID (0 for first GPU)

# Performance Settings
GPU_BATCH_SIZE=64             # Larger batch size for GPU
GPU_MAX_IMAGE_SIZE=1920       # Higher resolution processing for GPU
CPU_BATCH_SIZE=16             # Smaller batch size for CPU
CPU_MAX_IMAGE_SIZE=1024       # Lower resolution for CPU

# Optimization Flags
ENABLE_MEMORY_OPTIMIZATION=true
ENABLE_PARALLEL_PROCESSING=true
MAX_WORKERS=4                 # Number of parallel workers

# CUDA Optimization (NVIDIA only)
TF_FORCE_GPU_ALLOW_GROWTH=true
CUDA_CACHE_DISABLE=0
CUDA_LAUNCH_BLOCKING=0
CUDNN_BENCHMARK=1
```

### CPU-Only Mode

To force CPU-only mode (useful for debugging):
```env
FORCE_CPU=true
AUTO_DETECT_GPU=false
```

## Performance Comparison

| Hardware | Processing Speed | Memory Usage | Batch Size |
|----------|-----------------|--------------|------------|
| CPU (Modern) | ~2-5 faces/sec | 1-2GB RAM | 16 images |
| GTX 1060 | ~10-15 faces/sec | 4-6GB VRAM | 32 images |
| RTX 3060 | ~20-30 faces/sec | 6-8GB VRAM | 64 images |
| RTX 4070+ | ~40-60 faces/sec | 8-12GB VRAM | 128 images |

## Testing GPU Acceleration

### Check Status
```bash
curl http://localhost:5001/health
```

Response should include:
```json
{
  "status": "healthy",
  "service": "face-recognition", 
  "gpu_acceleration": true,
  "device": "GPU 0 (CUDA)",
  "model_loaded": true
}
```

### Detailed Status
```bash
curl http://localhost:5001/status
```

This provides comprehensive information about:
- GPU detection results
- Model configuration
- Performance statistics
- Memory usage

### Performance Test
```python
import requests
import time

# Test face detection performance
start_time = time.time()
response = requests.post('http://localhost:5001/process-photo', 
                        json={'photoPath': 'path/to/test/image.jpg'})
processing_time = time.time() - start_time

print(f"Processing time: {processing_time:.3f}s")
print(f"GPU enabled: {response.json().get('gpu_used', False)}")
```

## Troubleshooting

### GPU Not Detected

1. **Check GPU drivers**:
   ```bash
   nvidia-smi  # For NVIDIA
   ```

2. **Verify CUDA installation**:
   ```bash
   nvcc --version
   ```

3. **Check ONNX providers**:
   ```python
   import onnxruntime as ort
   print(ort.get_available_providers())
   ```

### Memory Issues

1. **Reduce batch size**:
   ```env
   GPU_BATCH_SIZE=32  # Lower value
   ```

2. **Enable memory optimization**:
   ```env
   ENABLE_MEMORY_OPTIMIZATION=true
   ```

3. **Lower image resolution**:
   ```env
   GPU_MAX_IMAGE_SIZE=1280
   ```

### Performance Issues

1. **Check for competing processes**:
   ```bash
   nvidia-smi  # Check GPU utilization
   ```

2. **Optimize CUDA settings**:
   ```env
   CUDNN_BENCHMARK=1
   CUDA_LAUNCH_BLOCKING=0
   ```

3. **Monitor memory usage**:
   ```bash
   curl http://localhost:5001/status | jq '.performance_stats'
   ```

## Development vs Production

### Development (Replit Environment)
- Uses CPU-only mode
- Smaller batch sizes (16)
- Lower resolution processing (1024px)
- Suitable for testing and development

### Production with GPU

**Linux/Cloud Deployment:**
- NVIDIA GPUs with CUDA support
- Batch sizes up to 128
- High resolution processing (1920px+)
- 5-10x faster processing

**Windows 11 Desktop:**
- NVIDIA GPUs with CUDA or DirectML
- AMD/Intel GPUs with DirectML
- Batch sizes 32-64
- Enhanced resolution processing
- 3-8x faster processing

## Migration Guide

### Deploying to GPU Environment

#### Linux/Cloud Deployment:
1. **Copy configuration**:
   - `requirements-gpu.txt`
   - `setup-gpu.sh`
   - Updated configuration files

2. **Run setup**:
   ```bash
   ./setup-gpu.sh
   ```

3. **Verify deployment**:
   ```bash
   curl http://localhost:5001/status
   ```

#### Windows 11 Deployment:
1. **Copy configuration**:
   - `requirements-gpu.txt`
   - `setup-windows.bat` / `setup-windows.ps1`
   - `start-windows.bat`
   - Updated configuration files

2. **Run setup**:
   ```cmd
   setup-windows.bat
   ```
   
   Or with PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File setup-windows.ps1
   ```

3. **Start service**:
   ```cmd
   start-windows.bat
   ```

4. **Verify deployment**:
   ```cmd
   curl http://localhost:5001/status
   ```

### Rollback to CPU

1. **Set environment**:
   ```env
   FORCE_CPU=true
   ```

2. **Restart service**:
   ```bash
   python app.py
   ```

## Monitoring and Logs

The service logs GPU status and performance metrics:

```
INFO:face_processor:Face processor configuration: {
  'gpu_available': true,
  'cuda_available': true,
  'device_info': 'GPU 0 (CUDA)',
  'batch_size': 64,
  'providers': ['CUDAExecutionProvider', 'CPUExecutionProvider']
}
```

Monitor performance through the `/status` endpoint for real-time metrics.