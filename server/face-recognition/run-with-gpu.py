#!/usr/bin/env python3
"""
GPU-Enabled Face Recognition Service Runner
This script sets up the environment and starts the face recognition service with GPU acceleration.
"""

import os
import sys
import subprocess
import time

def setup_environment():
    """Set up environment variables for GPU acceleration."""
    print("Setting up GPU environment...")
    
    # GPU Configuration
    os.environ['CUDA_VISIBLE_DEVICES'] = '0'
    os.environ['FORCE_CPU'] = 'false'
    os.environ['AUTO_DETECT_GPU'] = 'true'
    
    # CUDA Optimization Flags
    os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
    os.environ['CUDA_CACHE_DISABLE'] = '0'
    os.environ['CUDA_LAUNCH_BLOCKING'] = '0'
    os.environ['CUDNN_BENCHMARK'] = '1'
    
    # GPU Performance Settings
    os.environ['GPU_BATCH_SIZE'] = '64'
    os.environ['GPU_MAX_IMAGE_SIZE'] = '1920'
    os.environ['ENABLE_MEMORY_OPTIMIZATION'] = 'true'
    os.environ['ENABLE_PARALLEL_PROCESSING'] = 'true'
    os.environ['MAX_WORKERS'] = '8'
    
    # Add cuDNN to PATH if it exists
    cudnn_path = r"C:\Users\Aakash\AppData\Roaming\Python\Python313\site-packages\nvidia\cudnn\bin"
    if os.path.exists(cudnn_path):
        current_path = os.environ.get('PATH', '')
        if cudnn_path not in current_path:
            os.environ['PATH'] = current_path + ';' + cudnn_path
            print(f"Added cuDNN to PATH: {cudnn_path}")
    
    print("✓ Environment configured for GPU acceleration")

def check_dependencies():
    """Check if required packages are installed."""
    print("Checking dependencies...")
    
    required_packages = [
        'numpy', 'cv2', 'insightface', 'onnxruntime', 'torch', 'faiss'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ {package}")
        except ImportError:
            print(f"✗ {package} - Missing")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\nMissing packages: {missing_packages}")
        print("Install them with: pip install -r requirements-gpu.txt")
        return False
    
    print("✓ All dependencies available")
    return True

def test_gpu_setup():
    """Test GPU setup before starting service."""
    print("Testing GPU setup...")
    
    try:
        from config import GPU_AVAILABLE, CUDA_AVAILABLE, ONNX_GPU_AVAILABLE
        from face_processor import FaceProcessor
        
        print(f"GPU Available: {GPU_AVAILABLE}")
        print(f"CUDA Available: {CUDA_AVAILABLE}")
        print(f"ONNX GPU Available: {ONNX_GPU_AVAILABLE}")
        
        if GPU_AVAILABLE:
            print("✓ GPU acceleration detected")
            
            # Test face processor initialization
            print("Testing face processor initialization...")
            processor = FaceProcessor()
            model_info = processor.get_model_info()
            
            print(f"Device: {model_info['device_info']}")
            print(f"Using GPU: {model_info['using_gpu']}")
            print(f"Providers: {model_info['providers']}")
            
            return True
        else:
            print("⚠️  GPU not available, will use CPU")
            return True
            
    except Exception as e:
        print(f"✗ GPU setup test failed: {e}")
        return False

def start_service():
    """Start the face recognition service."""
    print("\n" + "="*50)
    print("Starting Face Recognition Service")
    print("="*50)
    
    try:
        # Import and run the Flask app
        from app import app
        
        print("Service starting on http://localhost:5001")
        print("Health check: http://localhost:5001/health")
        print("Status: http://localhost:5001/status")
        print("\nPress Ctrl+C to stop the service")
        
        # Run the Flask app
        app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
        
    except KeyboardInterrupt:
        print("\nService stopped by user")
    except Exception as e:
        print(f"Error starting service: {e}")
        return 1
    
    return 0

def main():
    """Main function to run the service."""
    print("Face Recognition Service - GPU Enabled")
    print("="*50)
    
    # Setup environment
    setup_environment()
    
    # Check dependencies
    if not check_dependencies():
        print("Please install missing dependencies and try again.")
        return 1
    
    # Test GPU setup
    if not test_gpu_setup():
        print("GPU setup test failed. Check your CUDA installation.")
        return 1
    
    # Start service
    return start_service()

if __name__ == "__main__":
    sys.exit(main())




