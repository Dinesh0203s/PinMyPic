#!/bin/bash
# GPU Setup Script for Face Recognition Service
# This script sets up GPU acceleration for face recognition

echo "=========================================="
echo "  Face Recognition GPU Setup"
echo "=========================================="

# Check if NVIDIA GPU is available
check_nvidia_gpu() {
    if command -v nvidia-smi &> /dev/null; then
        echo "✓ NVIDIA GPU detected:"
        nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits
        return 0
    else
        echo "✗ NVIDIA GPU not detected"
        return 1
    fi
}

# Check CUDA installation
check_cuda() {
    if command -v nvcc &> /dev/null; then
        CUDA_VERSION=$(nvcc --version | grep -o 'release [0-9.]*' | cut -d' ' -f2)
        echo "✓ CUDA $CUDA_VERSION detected"
        return 0
    else
        echo "✗ CUDA not found"
        return 1
    fi
}

# Install GPU-accelerated packages
install_gpu_packages() {
    echo "Installing GPU-accelerated Python packages..."
    
    # Create backup of current requirements
    cp requirements.txt requirements-cpu-backup.txt
    
    # Install GPU requirements
    if [ -f "requirements-gpu.txt" ]; then
        echo "Installing from requirements-gpu.txt..."
        pip install -r requirements-gpu.txt
    else
        echo "Installing individual GPU packages..."
        
        # Install GPU-accelerated packages
        pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
        pip install onnxruntime-gpu faiss-gpu
        
        echo "GPU packages installed"
    fi
}

# Set environment variables for GPU acceleration
setup_environment() {
    echo "Setting up GPU environment variables..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        touch .env
    fi
    
    # Add GPU configuration
    cat >> .env << EOF

# GPU Acceleration Configuration
AUTO_DETECT_GPU=true
FORCE_CPU=false
GPU_DEVICE_ID=0

# GPU Performance Settings
GPU_BATCH_SIZE=64
GPU_MAX_IMAGE_SIZE=1920
ENABLE_MEMORY_OPTIMIZATION=true
ENABLE_PARALLEL_PROCESSING=true
MAX_WORKERS=4

# CUDA Optimization Flags
TF_FORCE_GPU_ALLOW_GROWTH=true
CUDA_CACHE_DISABLE=0
CUDA_LAUNCH_BLOCKING=0
CUDNN_BENCHMARK=1
EOF
    
    echo "Environment variables configured"
}

# Test GPU functionality
test_gpu() {
    echo "Testing GPU functionality..."
    
    python3 << 'EOF'
import sys
sys.path.append('.')

try:
    from config import GPU_AVAILABLE, CUDA_AVAILABLE, get_config_summary
    
    print("Configuration Summary:")
    config = get_config_summary()
    for key, value in config.items():
        print(f"  {key}: {value}")
    
    if GPU_AVAILABLE:
        print("\n✓ GPU acceleration is available and configured!")
        
        # Test face processor initialization
        from face_processor import FaceProcessor
        processor = FaceProcessor()
        model_info = processor.get_model_info()
        
        print(f"\nModel Info:")
        print(f"  Device: {model_info['device_info']}")
        print(f"  Using GPU: {model_info['using_gpu']}")
        print(f"  Providers: {model_info['providers']}")
        
    else:
        print("\n⚠ GPU acceleration not available, using CPU")
        
except Exception as e:
    print(f"\n✗ Error during GPU test: {e}")
    sys.exit(1)
EOF
    
    if [ $? -eq 0 ]; then
        echo "✓ GPU test passed!"
    else
        echo "✗ GPU test failed"
        return 1
    fi
}

# Main setup process
main() {
    echo "Starting GPU setup process..."
    
    # Check system requirements
    if check_nvidia_gpu && check_cuda; then
        echo "GPU hardware requirements met"
        
        # Install packages
        install_gpu_packages
        
        # Setup environment
        setup_environment
        
        # Test functionality
        if test_gpu; then
            echo ""
            echo "=========================================="
            echo "  GPU Setup Complete!"
            echo "=========================================="
            echo ""
            echo "Your face recognition service is now configured for GPU acceleration."
            echo "Restart the service to apply changes:"
            echo "  python app.py"
            echo ""
        else
            echo "Setup completed but GPU test failed. Check logs for details."
            exit 1
        fi
    else
        echo ""
        echo "=========================================="
        echo "  GPU Hardware Not Available"
        echo "=========================================="
        echo ""
        echo "No compatible GPU hardware detected."
        echo "The service will continue to use CPU acceleration."
        echo "To enable GPU later:"
        echo "1. Install NVIDIA drivers and CUDA toolkit"
        echo "2. Run this script again"
        echo ""
        
        # Set CPU-only configuration
        export FORCE_CPU=true
        echo "FORCE_CPU=true" >> .env
    fi
}

# Run main function
main "$@"