#!/bin/bash

# Setup script for GPU-accelerated similarity calculation
# This script installs the necessary dependencies for GPU face similarity

echo "Setting up GPU-accelerated similarity calculation..."

# Check if CUDA is available
if command -v nvidia-smi &> /dev/null; then
    echo "✅ NVIDIA GPU detected"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits
else
    echo "⚠️  NVIDIA GPU not detected - will use CPU fallback"
fi

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
echo "Python version: $python_version"

# Install CuPy for GPU acceleration
echo "Installing CuPy for GPU acceleration..."

# Try different CuPy versions based on CUDA version
if command -v nvidia-smi &> /dev/null; then
    cuda_version=$(nvidia-smi | grep "CUDA Version" | awk '{print $9}' | cut -d. -f1,2)
    echo "CUDA version: $cuda_version"
    
    if [[ "$cuda_version" == "12."* ]]; then
        echo "Installing CuPy for CUDA 12.x..."
        pip install cupy-cuda12x>=12.0.0
    elif [[ "$cuda_version" == "11."* ]]; then
        echo "Installing CuPy for CUDA 11.x..."
        pip install cupy-cuda11x>=12.0.0
    else
        echo "Installing CuPy for CUDA 10.x..."
        pip install cupy-cuda102>=12.0.0
    fi
else
    echo "Installing CuPy CPU version (no GPU detected)..."
    pip install cupy-cpu>=12.0.0
fi

# Install PyTorch with CUDA support (alternative GPU backend)
echo "Installing PyTorch with CUDA support..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install other GPU dependencies
echo "Installing additional GPU dependencies..."
pip install -r requirements-gpu.txt

# Test GPU availability
echo "Testing GPU availability..."
python3 -c "
try:
    import cupy as cp
    print('✅ CuPy GPU test:')
    test_array = cp.array([1, 2, 3])
    result = cp.linalg.norm(test_array)
    print(f'   CuPy GPU calculation successful: {result}')
except Exception as e:
    print(f'❌ CuPy GPU test failed: {e}')

try:
    import torch
    print('✅ PyTorch GPU test:')
    if torch.cuda.is_available():
        device = torch.device('cuda')
        test_tensor = torch.tensor([1, 2, 3], device=device)
        result = torch.norm(test_tensor)
        print(f'   PyTorch GPU calculation successful: {result.item()}')
    else:
        print('   PyTorch CUDA not available')
except Exception as e:
    print(f'❌ PyTorch GPU test failed: {e}')
"

echo "GPU similarity setup completed!"
echo "Run 'python test_gpu_similarity.py' to test performance"



