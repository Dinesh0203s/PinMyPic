"""
Dynamic Batch Processor for GPU-accelerated Face Recognition
Processes images as they complete, maximizing GPU utilization
"""

import asyncio
import threading
import queue
import time
import logging
from typing import List, Dict, Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import GPU_AVAILABLE, DYNAMIC_BATCH_SIZE, MAX_CONCURRENT_IMAGES

logger = logging.getLogger(__name__)

class DynamicBatchProcessor:
    """
    Dynamic batch processor that processes images as they complete,
    maximizing GPU utilization without waiting for entire batches.
    """
    
    def __init__(self, face_processor):
        self.face_processor = face_processor
        self.processing_queue = queue.Queue()
        self.results = {}
        self.results_lock = threading.Lock()
        self.completed_count = 0
        self.total_count = 0
        self.start_time = None
        self.processing = False
        
    def process_dynamic_batch(self, image_paths: List[str], 
                            progress_callback: Optional[Callable] = None) -> Dict[str, List[Dict]]:
        """
        Process images dynamically - as soon as one completes, start the next.
        
        Args:
            image_paths: List of image file paths
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dictionary mapping image paths to face detection results
        """
        if not GPU_AVAILABLE:
            # Fallback to sequential processing for CPU
            return self._process_sequential(image_paths)
        
        self.total_count = len(image_paths)
        self.completed_count = 0
        self.start_time = time.time()
        self.results = {}
        self.processing = True
        
        logger.info(f"Starting dynamic batch processing: {self.total_count} images")
        
        # Add all images to processing queue
        for image_path in image_paths:
            self.processing_queue.put(image_path)
        
        # Process with optimized thread pool for 80% GPU usage
        max_workers = min(MAX_CONCURRENT_IMAGES, self.total_count, 16)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all worker tasks
            futures = []
            for _ in range(max_workers):
                future = executor.submit(self._worker_task)
                futures.append(future)
            
            # Wait for all workers to complete
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"Worker task failed: {e}")
        
        processing_time = time.time() - self.start_time
        throughput = self.total_count / processing_time if processing_time > 0 else 0
        
        logger.info(f"Dynamic batch completed: {self.completed_count}/{self.total_count} "
                   f"images in {processing_time:.2f}s ({throughput:.1f} images/sec)")
        
        return self.results
    
    def _worker_task(self):
        """Worker task that processes images from the queue."""
        while self.processing and not self.processing_queue.empty():
            try:
                # Get next image from queue
                image_path = self.processing_queue.get_nowait()
                
                # Process the image
                start_time = time.time()
                faces = self.face_processor.process_image_file(image_path)
                processing_time = time.time() - start_time
                
                # Store result
                with self.results_lock:
                    self.results[image_path] = faces
                    self.completed_count += 1
                
                # Log progress
                if self.completed_count % 10 == 0 or self.completed_count == self.total_count:
                    elapsed = time.time() - self.start_time
                    rate = self.completed_count / elapsed if elapsed > 0 else 0
                    logger.info(f"Progress: {self.completed_count}/{self.total_count} "
                              f"({rate:.1f} images/sec)")
                
                # Clean up GPU memory after each image
                if hasattr(self.face_processor, '_cleanup_gpu_memory'):
                    self.face_processor._cleanup_gpu_memory()
                
            except queue.Empty:
                break
            except Exception as e:
                logger.error(f"Error processing image: {e}")
                with self.results_lock:
                    self.completed_count += 1
                continue
    
    def _process_sequential(self, image_paths: List[str]) -> Dict[str, List[Dict]]:
        """Fallback sequential processing for CPU."""
        results = {}
        for i, image_path in enumerate(image_paths):
            try:
                results[image_path] = self.face_processor.process_image_file(image_path)
                if (i + 1) % 10 == 0:
                    logger.info(f"Sequential progress: {i + 1}/{len(image_paths)}")
            except Exception as e:
                logger.error(f"Error processing {image_path}: {e}")
                results[image_path] = []
        return results
    
    def stop_processing(self):
        """Stop the dynamic processing."""
        self.processing = False

# Global instance for easy access
_dynamic_processor = None

def get_dynamic_processor(face_processor):
    """Get or create the dynamic batch processor."""
    global _dynamic_processor
    if _dynamic_processor is None:
        _dynamic_processor = DynamicBatchProcessor(face_processor)
    return _dynamic_processor
