"""
Face processing module using InsightFace and ArcFace embeddings with GPU acceleration.
"""

import numpy as np
import cv2
from typing import List, Tuple, Optional, Dict
import logging
import os
import time
from config import (
    ARCFACE_MODEL_NAME, FORCE_CPU, GPU_DEVICE_ID, GPU_AVAILABLE, CUDA_AVAILABLE,
    ONNX_GPU_AVAILABLE, MIN_FACE_SIZE, BATCH_SIZE, ONNX_PROVIDERS,
    ENABLE_MEMORY_OPTIMIZATION, ENABLE_PARALLEL_PROCESSING, MAX_WORKERS, get_config_summary
)

logger = logging.getLogger(__name__)

class FaceProcessor:
    """Face detection and embedding extraction using InsightFace with GPU acceleration."""
    
    def __init__(self):
        """Initialize the face processor with GPU support."""
        self.app = None
        self.model_loaded = False
        self.using_gpu = False
        self.device_info = ""
        self.processing_stats = {
            'total_processed': 0,
            'total_faces_detected': 0,
            'average_processing_time': 0,
            'gpu_memory_usage': 0
        }
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the InsightFace model with GPU acceleration."""
        try:
            import insightface
            
            # Log configuration summary
            config_summary = get_config_summary()
            logger.info(f"Face processor configuration: {config_summary}")
            
            # Determine device and context
            if FORCE_CPU or not GPU_AVAILABLE:
                ctx_id = -1  # CPU
                self.device_info = "CPU"
                self.using_gpu = False
                providers = ['CPUExecutionProvider']
            else:
                ctx_id = GPU_DEVICE_ID
                self.using_gpu = True
                if CUDA_AVAILABLE:
                    self.device_info = f"GPU {GPU_DEVICE_ID} (CUDA)"
                elif ONNX_GPU_AVAILABLE:
                    self.device_info = f"GPU {GPU_DEVICE_ID} (ONNX)"
                else:
                    self.device_info = f"GPU {GPU_DEVICE_ID}"
                
                # Use the optimized provider configuration
                providers = [p[0] if isinstance(p, tuple) else p for p in ONNX_PROVIDERS]
            
            logger.info(f"Initializing InsightFace model on {self.device_info}")
            logger.info(f"Using providers: {providers}")
            
            # Initialize the face analysis app with optimized settings
            self.app = insightface.app.FaceAnalysis(
                name=ARCFACE_MODEL_NAME,
                providers=providers
            )
            
            # Prepare the model with appropriate detection size
            det_size = (640, 640) if not self.using_gpu else (1024, 1024)
            self.app.prepare(ctx_id=ctx_id, det_size=det_size)
            
            self.model_loaded = True
            logger.info(f"Successfully initialized {ARCFACE_MODEL_NAME} model on {self.device_info}")
            logger.info(f"Detection size: {det_size}")
            
            # Log GPU memory usage if using GPU
            if self.using_gpu:
                self._log_gpu_memory()
            
        except Exception as e:
            logger.error(f"Failed to initialize face model: {str(e)}")
            # Try fallback to CPU if GPU initialization fails
            if self.using_gpu:
                logger.warning("GPU initialization failed, falling back to CPU")
                self._fallback_to_cpu()
            else:
                raise RuntimeError(f"Model initialization failed: {str(e)}")
    
    def _fallback_to_cpu(self):
        """Fallback to CPU if GPU initialization fails."""
        try:
            import insightface
            
            self.using_gpu = False
            self.device_info = "CPU (fallback)"
            
            logger.info("Initializing fallback CPU model")
            self.app = insightface.app.FaceAnalysis(
                name=ARCFACE_MODEL_NAME,
                providers=['CPUExecutionProvider']
            )
            
            self.app.prepare(ctx_id=-1, det_size=(640, 640))
            self.model_loaded = True
            logger.info("Successfully initialized CPU fallback model")
            
        except Exception as e:
            logger.error(f"CPU fallback also failed: {str(e)}")
            raise RuntimeError(f"Both GPU and CPU initialization failed: {str(e)}")
    
    def _log_gpu_memory(self):
        """Log GPU memory usage if available."""
        try:
            if CUDA_AVAILABLE:
                import torch
                if torch.cuda.is_available():
                    allocated = torch.cuda.memory_allocated(GPU_DEVICE_ID)
                    reserved = torch.cuda.memory_reserved(GPU_DEVICE_ID)
                    total = torch.cuda.get_device_properties(GPU_DEVICE_ID).total_memory
                    
                    self.processing_stats['gpu_memory_usage'] = {
                        'allocated_mb': allocated / 1024 / 1024,
                        'reserved_mb': reserved / 1024 / 1024,
                        'total_mb': total / 1024 / 1024,
                        'utilization_percent': (allocated / total) * 100
                    }
                    
                    logger.info(f"GPU Memory - Allocated: {allocated/1024/1024:.1f}MB, "
                              f"Reserved: {reserved/1024/1024:.1f}MB, "
                              f"Total: {total/1024/1024:.1f}MB")
        except Exception as e:
            logger.debug(f"Could not log GPU memory: {e}")
    
    def _optimize_image_for_processing(self, image: np.ndarray) -> np.ndarray:
        """Optimize image for face detection based on device capabilities."""
        height, width = image.shape[:2]
        
        # Determine maximum size based on device
        if self.using_gpu:
            max_dim = 1920  # Higher resolution for GPU
        else:
            max_dim = 1024  # Lower resolution for CPU
        
        # Resize if needed
        if max(height, width) > max_dim:
            scale = max_dim / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
            logger.debug(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Apply additional optimizations for GPU
        if self.using_gpu and ENABLE_MEMORY_OPTIMIZATION:
            # Ensure optimal memory layout
            image = np.ascontiguousarray(image)
        
        return image
    
    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """
        Detect faces in an image with GPU acceleration support.
        
        Args:
            image: Input image in RGB format
            
        Returns:
            List of face detection results
        """
        if not self.model_loaded:
            raise RuntimeError("Face model not loaded")
        
        start_time = time.time()
        
        try:
            # Optimize image for processing
            optimized_image = self._optimize_image_for_processing(image)
            
            # Detect faces
            faces = self.app.get(optimized_image)
            
            # Filter faces by minimum size and process results
            valid_faces = []
            filtered_count = 0
            for face in faces:
                bbox = face.bbox.astype(int)
                width = bbox[2] - bbox[0]
                height = bbox[3] - bbox[1]
                
                if width >= MIN_FACE_SIZE and height >= MIN_FACE_SIZE:
                    face_info = {
                        'bbox': (int(bbox[0]), int(bbox[1]), int(width), int(height)),
                        'confidence': float(face.det_score),
                        'embedding': face.embedding.tolist(),  # Convert to list for JSON serialization
                        'landmarks': face.kps.tolist() if hasattr(face, 'kps') else None,
                        'age': int(face.age) if hasattr(face, 'age') else None,
                        'gender': 'M' if hasattr(face, 'gender') and face.gender == 1 else 'F' if hasattr(face, 'gender') else None
                    }
                    valid_faces.append(face_info)
                else:
                    filtered_count += 1
            
            if len(valid_faces) > 0:
                logger.info(f"Face detection successful: {len(valid_faces)} valid faces found")
                if filtered_count > 0:
                    logger.info(f"Filtered out {filtered_count} faces (too small, min size: {MIN_FACE_SIZE}px)")
            else:
                logger.info("No faces detected in image")
            
            # Update processing statistics
            processing_time = time.time() - start_time
            self.processing_stats['total_processed'] += 1
            self.processing_stats['total_faces_detected'] += len(valid_faces)
            
            # Calculate running average of processing time
            if self.processing_stats['average_processing_time'] == 0:
                self.processing_stats['average_processing_time'] = processing_time
            else:
                self.processing_stats['average_processing_time'] = (
                    self.processing_stats['average_processing_time'] * 0.9 + processing_time * 0.1
                )
            
            logger.info(f"Face processing completed: {len(valid_faces)} faces in {processing_time:.3f}s")
            
            # Clean up GPU memory if enabled
            if self.using_gpu and ENABLE_MEMORY_OPTIMIZATION:
                self._cleanup_gpu_memory()
            
            return valid_faces
            
        except Exception as e:
            logger.error(f"Face detection failed: {str(e)}")
            return []
    
    def process_image_file(self, image_path: str) -> List[Dict]:
        """
        Process a single image file and extract face information with GPU acceleration.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            List of face information dictionaries
        """
        try:
            # Extract filename for logging
            import os
            filename = os.path.basename(image_path)
            logger.info(f"Processing image file: {filename}")
            
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                logger.warning(f"Could not load image: {filename}")
                return []
            
            # Convert BGR to RGB
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect faces using optimized detection
            faces = self.detect_faces(image)
            
            logger.info(f"Face processing complete - File: {filename} | Faces detected: {len(faces)}")
            return faces
            
        except Exception as e:
            filename = os.path.basename(image_path) if 'os' in locals() else image_path
            logger.error(f"Error processing image file {filename}: {str(e)}")
            return []
    
    def process_batch(self, image_paths: List[str]) -> Dict[str, List[Dict]]:
        """
        Process a batch of images with optimized GPU utilization.
        
        Args:
            image_paths: List of image file paths
            
        Returns:
            Dictionary mapping image paths to face detection results
        """
        if not ENABLE_PARALLEL_PROCESSING or not self.using_gpu:
            # Process sequentially for CPU or when parallel processing is disabled
            results = {}
            for image_path in image_paths:
                results[image_path] = self.process_image_file(image_path)
            return results
        
        # Parallel processing for GPU
        import concurrent.futures
        import threading
        
        results = {}
        results_lock = threading.Lock()
        
        def process_single(image_path):
            try:
                faces = self.process_image_file(image_path)
                with results_lock:
                    results[image_path] = faces
            except Exception as e:
                logger.error(f"Error processing {image_path}: {e}")
                with results_lock:
                    results[image_path] = []
        
        # Use thread pool for I/O bound operations with optimized worker count
        max_workers = min(MAX_WORKERS, len(image_paths), 8)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks and process them
            futures = [executor.submit(process_single, image_path) for image_path in image_paths]
            # Wait for all to complete
            concurrent.futures.wait(futures)
        
        return results
    
    def _cleanup_gpu_memory(self):
        """Clean up GPU memory to prevent memory leaks."""
        try:
            if CUDA_AVAILABLE:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
        except Exception as e:
            logger.debug(f"GPU memory cleanup failed: {e}")
    
    def get_model_info(self) -> Dict:
        """
        Get comprehensive information about the loaded model and performance.
        
        Returns:
            Dictionary with model information
        """
        return {
            'model_name': ARCFACE_MODEL_NAME,
            'model_loaded': self.model_loaded,
            'device_info': self.device_info,
            'using_gpu': self.using_gpu,
            'gpu_available': GPU_AVAILABLE,
            'cuda_available': CUDA_AVAILABLE,
            'onnx_gpu_available': ONNX_GPU_AVAILABLE,
            'gpu_device_id': GPU_DEVICE_ID if self.using_gpu else None,
            'embedding_dimension': 512,  # buffalo_l produces 512-dim embeddings
            'batch_size': BATCH_SIZE,
            'max_workers': MAX_WORKERS,
            'providers': [p[0] if isinstance(p, tuple) else p for p in ONNX_PROVIDERS],
            'processing_stats': self.processing_stats,
            'memory_optimization': ENABLE_MEMORY_OPTIMIZATION,
            'parallel_processing': ENABLE_PARALLEL_PROCESSING
        }
    
    def get_performance_stats(self) -> Dict:
        """
        Get detailed performance statistics.
        
        Returns:
            Dictionary with performance metrics
        """
        stats = self.processing_stats.copy()
        
        # Add GPU memory info if available
        if self.using_gpu:
            self._log_gpu_memory()
        
        # Calculate faces per second
        if stats['average_processing_time'] > 0:
            stats['faces_per_second'] = 1.0 / stats['average_processing_time']
        
        return stats