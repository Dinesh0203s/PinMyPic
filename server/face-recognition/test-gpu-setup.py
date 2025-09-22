#!/usr/bin/env python3
"""
GPU Setup Test Script for Face Recognition Service
This script tests the GPU configuration and provides detailed diagnostics.
"""

import sys
import os
import time
import traceback

def test_imports():
    """Test if all required packages can be imported."""
    print("=" * 50)
    print("Testing Package Imports")
    print("=" * 50)
    
    packages = [
        ('numpy', 'NumPy'),
        ('cv2', 'OpenCV'),
        ('insightface', 'InsightFace'),
        ('onnxruntime', 'ONNX Runtime'),
        ('torch', 'PyTorch'),
        ('faiss', 'FAISS'),
    ]
    
    results = {}
    for package, name in packages:
        try:
            __import__(package)
            print(f"✓ {name}: Available")
            results[package] = True
        except ImportError as e:
            print(f"✗ {name}: Not available - {e}")
            results[package] = False
    
    return results

def test_cuda_availability():
    """Test CUDA availability through PyTorch."""
    print("\n" + "=" * 50)
    print("Testing CUDA Availability")
    print("=" * 50)
    
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"PyTorch CUDA Available: {cuda_available}")
        
        if cuda_available:
            device_count = torch.cuda.device_count()
            print(f"CUDA Devices: {device_count}")
            
            for i in range(device_count):
                device_name = torch.cuda.get_device_name(i)
                device_props = torch.cuda.get_device_properties(i)
                memory_gb = device_props.total_memory / (1024**3)
                print(f"  Device {i}: {device_name} ({memory_gb:.1f} GB)")
        else:
            print("CUDA not available - check NVIDIA drivers and CUDA installation")
        
        return cuda_available
    except Exception as e:
        print(f"Error testing CUDA: {e}")
        return False

def test_onnx_providers():
    """Test ONNX Runtime providers."""
    print("\n" + "=" * 50)
    print("Testing ONNX Runtime Providers")
    print("=" * 50)
    
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        print(f"Available Providers: {providers}")
        
        gpu_providers = [p for p in providers if 'CUDA' in p or 'GPU' in p or 'DML' in p]
        if gpu_providers:
            print(f"GPU Providers: {gpu_providers}")
            return True
        else:
            print("No GPU providers available")
            return False
    except Exception as e:
        print(f"Error testing ONNX providers: {e}")
        return False

def test_environment_variables():
    """Test environment variables."""
    print("\n" + "=" * 50)
    print("Testing Environment Variables")
    print("=" * 50)
    
    env_vars = [
        'CUDA_VISIBLE_DEVICES',
        'FORCE_CPU',
        'AUTO_DETECT_GPU',
        'TF_FORCE_GPU_ALLOW_GROWTH',
        'CUDA_CACHE_DISABLE',
        'CUDA_LAUNCH_BLOCKING',
        'CUDNN_BENCHMARK',
        'GPU_BATCH_SIZE',
        'GPU_MAX_IMAGE_SIZE',
        'ENABLE_MEMORY_OPTIMIZATION',
        'ENABLE_PARALLEL_PROCESSING',
        'MAX_WORKERS'
    ]
    
    for var in env_vars:
        value = os.getenv(var, 'Not set')
        print(f"{var}: {value}")

def test_face_processor():
    """Test face processor initialization."""
    print("\n" + "=" * 50)
    print("Testing Face Processor")
    print("=" * 50)
    
    try:
        from config import GPU_AVAILABLE, CUDA_AVAILABLE, ONNX_GPU_AVAILABLE, get_config_summary
        from face_processor import FaceProcessor
        
        print("Configuration Summary:")
        config = get_config_summary()
        for key, value in config.items():
            print(f"  {key}: {value}")
        
        print(f"\nGPU Available: {GPU_AVAILABLE}")
        print(f"CUDA Available: {CUDA_AVAILABLE}")
        print(f"ONNX GPU Available: {ONNX_GPU_AVAILABLE}")
        
        print("\nInitializing Face Processor...")
        start_time = time.time()
        processor = FaceProcessor()
        init_time = time.time() - start_time
        
        print(f"✓ Face Processor initialized in {init_time:.2f}s")
        
        model_info = processor.get_model_info()
        print(f"Device: {model_info['device_info']}")
        print(f"Using GPU: {model_info['using_gpu']}")
        print(f"Providers: {model_info['providers']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Face Processor initialization failed: {e}")
        traceback.print_exc()
        return False

def test_gpu_memory():
    """Test GPU memory if available."""
    print("\n" + "=" * 50)
    print("Testing GPU Memory")
    print("=" * 50)
    
    try:
        import torch
        if torch.cuda.is_available():
            device = torch.cuda.current_device()
            allocated = torch.cuda.memory_allocated(device)
            reserved = torch.cuda.memory_reserved(device)
            total = torch.cuda.get_device_properties(device).total_memory
            
            print(f"GPU Memory Status:")
            print(f"  Allocated: {allocated / 1024**2:.1f} MB")
            print(f"  Reserved: {reserved / 1024**2:.1f} MB")
            print(f"  Total: {total / 1024**2:.1f} MB")
            print(f"  Free: {(total - allocated) / 1024**2:.1f} MB")
            return True
        else:
            print("CUDA not available for memory testing")
            return False
    except Exception as e:
        print(f"Error testing GPU memory: {e}")
        return False

def main():
    """Run all tests."""
    print("Face Recognition GPU Setup Test")
    print("=" * 50)
    
    # Test imports
    import_results = test_imports()
    
    # Test CUDA
    cuda_available = test_cuda_availability()
    
    # Test ONNX providers
    onnx_gpu_available = test_onnx_providers()
    
    # Test environment variables
    test_environment_variables()
    
    # Test face processor
    processor_works = test_face_processor()
    
    # Test GPU memory
    memory_works = test_gpu_memory()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary")
    print("=" * 50)
    
    all_packages = all(import_results.values())
    gpu_working = cuda_available or onnx_gpu_available
    
    print(f"All packages imported: {'✓' if all_packages else '✗'}")
    print(f"CUDA available: {'✓' if cuda_available else '✗'}")
    print(f"ONNX GPU available: {'✓' if onnx_gpu_available else '✗'}")
    print(f"GPU acceleration working: {'✓' if gpu_working else '✗'}")
    print(f"Face processor working: {'✓' if processor_works else '✗'}")
    print(f"GPU memory accessible: {'✓' if memory_works else '✗'}")
    
    if all_packages and processor_works:
        print("\n🎉 Face recognition service is ready!")
        if gpu_working:
            print("🚀 GPU acceleration is enabled!")
        else:
            print("⚠️  Running on CPU (GPU not available)")
    else:
        print("\n❌ Setup issues detected. Check the errors above.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())




