"""
Configuration settings for the face recognition system with GPU acceleration support.
"""

import os
import logging

logger = logging.getLogger(__name__)

# Model configuration
ARCFACE_MODEL_NAME = 'buffalo_l'
EMBEDDING_DIMENSION = 512  # buffalo_l produces 512-dimensional embeddings
SIMILARITY_THRESHOLD = 1.2  # Minimum similarity score for matches


def detect_gpu_availability():
    """
    Detect if GPU acceleration is available.
    
    Returns:
        tuple: (has_cuda, has_gpu_onnx, gpu_info)
    """
    has_cuda = False
    has_gpu_onnx = False
    gpu_info = {}

    # Check for CUDA availability (optional dependency)
    try:
        import torch
        has_cuda = torch.cuda.is_available()
        if has_cuda:
            gpu_info['cuda_devices'] = torch.cuda.device_count()
            gpu_info['cuda_device_name'] = torch.cuda.get_device_name(0)
            gpu_info['cuda_memory'] = torch.cuda.get_device_properties(
                0).total_memory
    except ImportError:
        # PyTorch is optional, continue without GPU acceleration
        logger.info("PyTorch not available for CUDA detection - using CPU only")
        has_cuda = False
    except Exception as e:
        logger.warning(f"CUDA detection failed: {e}")
        has_cuda = False

    # Check for ONNX GPU providers
    try:
        import onnxruntime as ort
        available_providers = ort.get_available_providers()
        has_gpu_onnx = 'CUDAExecutionProvider' in available_providers or 'TensorrtExecutionProvider' in available_providers
        gpu_info['onnx_providers'] = available_providers
    except ImportError:
        logger.info("ONNX Runtime not available")
    except Exception as e:
        logger.warning(f"ONNX provider detection failed: {e}")

    return has_cuda, has_gpu_onnx, gpu_info


# GPU configuration with auto-detection
AUTO_DETECT_GPU = os.getenv("AUTO_DETECT_GPU", "true").lower() == "true"
FORCE_CPU = os.getenv("FORCE_CPU", "false").lower() == "true"
GPU_DEVICE_ID = int(os.getenv("GPU_DEVICE_ID", "0"))

# Auto-detect GPU if enabled
if AUTO_DETECT_GPU and not FORCE_CPU:
    has_cuda, has_gpu_onnx, gpu_info = detect_gpu_availability()
    if has_cuda or has_gpu_onnx:
        logger.info(
            f"GPU acceleration detected: CUDA={has_cuda}, ONNX_GPU={has_gpu_onnx}"
        )
        logger.info(f"GPU info: {gpu_info}")
    else:
        logger.info("No GPU acceleration detected, using CPU")
else:
    has_cuda, has_gpu_onnx, gpu_info = False, False, {}
    if FORCE_CPU:
        logger.info("GPU acceleration disabled (FORCE_CPU=true)")

# Set GPU availability flags
GPU_AVAILABLE = (has_cuda or has_gpu_onnx) and not FORCE_CPU
CUDA_AVAILABLE = has_cuda and not FORCE_CPU
ONNX_GPU_AVAILABLE = has_gpu_onnx and not FORCE_CPU

# Processing configuration - adjust batch size based on GPU availability
if GPU_AVAILABLE:
    BATCH_SIZE = int(os.getenv("GPU_BATCH_SIZE", "64"))  # Larger batch for GPU
    MAX_IMAGE_SIZE = int(os.getenv("GPU_MAX_IMAGE_SIZE",
                                   "1920"))  # Higher resolution for GPU
else:
    BATCH_SIZE = int(os.getenv(
        "CPU_BATCH_SIZE", "32"))  # Increased batch for better CPU utilization
    MAX_IMAGE_SIZE = int(os.getenv("CPU_MAX_IMAGE_SIZE",
                                   "1024"))  # Lower resolution for CPU

MIN_FACE_SIZE = int(os.getenv("MIN_FACE_SIZE",
                              "20"))  # Minimum face size for detection


# Provider configuration for ONNX Runtime
def get_onnx_providers():
    """Get the appropriate ONNX providers based on GPU availability."""
    providers = []

    if ONNX_GPU_AVAILABLE:
        # Add GPU providers in order of preference
        try:
            import onnxruntime as ort
            available_providers = ort.get_available_providers()

            # TensorRT (fastest for NVIDIA GPUs)
            if 'TensorrtExecutionProvider' in available_providers:
                providers.append((
                    'TensorrtExecutionProvider',
                    {
                        'device_id': GPU_DEVICE_ID,
                        'trt_max_workspace_size': 2147483648,  # 2GB
                        'trt_fp16_enable': True,
                    }))

            # CUDA (fallback for NVIDIA GPUs)
            if 'CUDAExecutionProvider' in available_providers:
                providers.append((
                    'CUDAExecutionProvider',
                    {
                        'device_id': GPU_DEVICE_ID,
                        'arena_extend_strategy': 'kNextPowerOfTwo',
                        'gpu_mem_limit': 2 * 1024 * 1024 * 1024,  # 2GB
                        'cudnn_conv_algo_search': 'EXHAUSTIVE',
                        'do_copy_in_default_stream': True,
                    }))

            # DirectML (for AMD GPUs and Intel integrated graphics)
            if 'DmlExecutionProvider' in available_providers:
                providers.append(('DmlExecutionProvider', {
                    'device_id': GPU_DEVICE_ID,
                }))

        except Exception as e:
            logger.warning(f"Error configuring GPU providers: {e}")

    # Always add CPU as fallback with optimized threading
    providers.append((
        'CPUExecutionProvider',
        {
            'arena_extend_strategy': 'kSameAsRequested',
            'intra_op_num_threads': 0,  # Use all available cores
            'inter_op_num_threads': 0,  # Use all available cores
            'enable_cpu_mem_arena': True,
            'enable_memory_pattern': True,
        }))

    return providers


ONNX_PROVIDERS = get_onnx_providers()

# File handling
SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
MAX_IMAGES_TO_PROCESS = int(
    os.getenv("MAX_IMAGES_TO_PROCESS", "2000" if GPU_AVAILABLE else "1000"))

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
SHOW_PROGRESS = os.getenv("SHOW_PROGRESS", "true").lower() == "true"

# Performance optimization settings
ENABLE_MEMORY_OPTIMIZATION = os.getenv("ENABLE_MEMORY_OPTIMIZATION",
                                       "true").lower() == "true"
ENABLE_PARALLEL_PROCESSING = os.getenv("ENABLE_PARALLEL_PROCESSING",
                                       "true").lower() == "true"
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "8" if GPU_AVAILABLE else "6"))

# Performance optimizations
import multiprocessing

CPU_COUNT = multiprocessing.cpu_count()

# Set OpenMP and threading environment variables for better CPU utilization
os.environ.setdefault('OMP_NUM_THREADS', str(CPU_COUNT))
os.environ.setdefault('MKL_NUM_THREADS', str(CPU_COUNT))
os.environ.setdefault('NUMEXPR_NUM_THREADS', str(CPU_COUNT))
os.environ.setdefault('OPENBLAS_NUM_THREADS', str(CPU_COUNT))

# GPU-specific optimizations
if GPU_AVAILABLE:
    # Enable GPU memory growth (for TensorFlow/PyTorch)
    os.environ.setdefault('TF_FORCE_GPU_ALLOW_GROWTH', 'true')
    os.environ.setdefault('CUDA_CACHE_DISABLE', '0')

    # Set CUDA optimization flags
    os.environ.setdefault('CUDA_LAUNCH_BLOCKING', '0')
    os.environ.setdefault('CUDNN_BENCHMARK', '1')


# Export configuration summary
def get_config_summary():
    """Get a summary of the current configuration."""
    return {
        'model_name':
        ARCFACE_MODEL_NAME,
        'gpu_available':
        GPU_AVAILABLE,
        'cuda_available':
        CUDA_AVAILABLE,
        'onnx_gpu_available':
        ONNX_GPU_AVAILABLE,
        'gpu_device_id':
        GPU_DEVICE_ID if GPU_AVAILABLE else None,
        'cpu_cores':
        CPU_COUNT,
        'batch_size':
        BATCH_SIZE,
        'max_image_size':
        MAX_IMAGE_SIZE,
        'onnx_providers':
        [p[0] if isinstance(p, tuple) else p for p in ONNX_PROVIDERS],
        'max_workers':
        MAX_WORKERS,
        'memory_optimization':
        ENABLE_MEMORY_OPTIMIZATION,
        'parallel_processing':
        ENABLE_PARALLEL_PROCESSING,
    }
