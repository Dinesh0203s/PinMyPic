"""
GPU-accelerated similarity calculation utilities for face recognition.
Provides both GPU and CPU fallback implementations for cosine similarity.
"""

import numpy as np
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

# Try to import CuPy for GPU acceleration
try:
    import cupy as cp
    CUPY_AVAILABLE = True
    logger.info("CuPy available for GPU-accelerated similarity calculations")
except ImportError:
    CUPY_AVAILABLE = False
    logger.warning("CuPy not available, falling back to CPU similarity calculations")

# Try to import PyTorch for alternative GPU acceleration
try:
    import torch
    TORCH_AVAILABLE = True
    logger.info("PyTorch available for GPU-accelerated similarity calculations")
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available for GPU similarity calculations")


class GPUSimilarityCalculator:
    """GPU-accelerated similarity calculator with CPU fallback."""
    
    def __init__(self):
        self.gpu_available = self._check_gpu_availability()
        self.device = self._get_best_device()
        logger.info(f"Similarity calculator initialized - GPU: {self.gpu_available}, Device: {self.device}")
    
    def _check_gpu_availability(self) -> bool:
        """Check if GPU acceleration is available."""
        if CUPY_AVAILABLE:
            try:
                # Test CuPy GPU availability
                test_array = cp.array([1, 2, 3])
                _ = cp.linalg.norm(test_array)
                return True
            except Exception as e:
                logger.warning(f"CuPy GPU test failed: {e}")
                return False
        
        if TORCH_AVAILABLE:
            try:
                # Test PyTorch GPU availability
                return torch.cuda.is_available()
            except Exception as e:
                logger.warning(f"PyTorch GPU test failed: {e}")
                return False
        
        return False
    
    def _get_best_device(self) -> str:
        """Get the best available device for calculations."""
        if CUPY_AVAILABLE and self.gpu_available:
            return "cupy"
        elif TORCH_AVAILABLE and torch.cuda.is_available():
            return "torch"
        else:
            return "numpy"
    
    def cosine_similarity_batch(self, query_embedding: np.ndarray, 
                               stored_embeddings: np.ndarray) -> np.ndarray:
        """
        Calculate cosine similarity between a query embedding and multiple stored embeddings.
        
        Args:
            query_embedding: Single embedding vector (512 dimensions)
            stored_embeddings: Array of stored embeddings (N x 512)
            
        Returns:
            Array of similarity scores (N,)
        """
        if self.device == "cupy" and CUPY_AVAILABLE:
            return self._cupy_cosine_similarity(query_embedding, stored_embeddings)
        elif self.device == "torch" and TORCH_AVAILABLE:
            return self._torch_cosine_similarity(query_embedding, stored_embeddings)
        else:
            return self._numpy_cosine_similarity(query_embedding, stored_embeddings)
    
    def _cupy_cosine_similarity(self, query_embedding: np.ndarray, 
                              stored_embeddings: np.ndarray) -> np.ndarray:
        """CuPy GPU-accelerated cosine similarity calculation."""
        try:
            # Move arrays to GPU
            query_gpu = cp.array(query_embedding, dtype=cp.float32)
            stored_gpu = cp.array(stored_embeddings, dtype=cp.float32)
            
            # Calculate cosine similarity
            # Normalize vectors
            query_norm = cp.linalg.norm(query_gpu)
            stored_norms = cp.linalg.norm(stored_gpu, axis=1)
            
            # Calculate dot products
            dot_products = cp.dot(query_gpu, stored_gpu.T)
            
            # Calculate cosine similarity
            similarities = dot_products / (query_norm * stored_norms)
            
            # Move result back to CPU
            return cp.asnumpy(similarities)
            
        except Exception as e:
            logger.error(f"CuPy similarity calculation failed: {e}")
            # Fallback to NumPy
            return self._numpy_cosine_similarity(query_embedding, stored_embeddings)
    
    def _torch_cosine_similarity(self, query_embedding: np.ndarray, 
                                stored_embeddings: np.ndarray) -> np.ndarray:
        """PyTorch GPU-accelerated cosine similarity calculation."""
        try:
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            
            # Move to GPU
            query_tensor = torch.tensor(query_embedding, dtype=torch.float32, device=device)
            stored_tensor = torch.tensor(stored_embeddings, dtype=torch.float32, device=device)
            
            # Calculate cosine similarity using PyTorch
            similarities = torch.nn.functional.cosine_similarity(
                query_tensor.unsqueeze(0), 
                stored_tensor, 
                dim=1
            )
            
            # Move result back to CPU
            return similarities.cpu().numpy()
            
        except Exception as e:
            logger.error(f"PyTorch similarity calculation failed: {e}")
            # Fallback to NumPy
            return self._numpy_cosine_similarity(query_embedding, stored_embeddings)
    
    def _numpy_cosine_similarity(self, query_embedding: np.ndarray, 
                                stored_embeddings: np.ndarray) -> np.ndarray:
        """NumPy CPU-based cosine similarity calculation."""
        try:
            # Calculate cosine similarity
            query_norm = np.linalg.norm(query_embedding)
            stored_norms = np.linalg.norm(stored_embeddings, axis=1)
            
            # Calculate dot products
            dot_products = np.dot(query_embedding, stored_embeddings.T)
            
            # Calculate cosine similarity
            similarities = dot_products / (query_norm * stored_norms)
            
            return similarities
            
        except Exception as e:
            logger.error(f"NumPy similarity calculation failed: {e}")
            # Return zeros as fallback
            return np.zeros(len(stored_embeddings))
    
    def get_performance_info(self) -> dict:
        """Get information about the similarity calculator performance."""
        return {
            'gpu_available': self.gpu_available,
            'device': self.device,
            'cupy_available': CUPY_AVAILABLE,
            'torch_available': TORCH_AVAILABLE,
            'torch_cuda_available': TORCH_AVAILABLE and torch.cuda.is_available() if TORCH_AVAILABLE else False
        }


# Global instance for easy access
_similarity_calculator = None

def get_similarity_calculator() -> GPUSimilarityCalculator:
    """Get or create the global similarity calculator instance."""
    global _similarity_calculator
    if _similarity_calculator is None:
        _similarity_calculator = GPUSimilarityCalculator()
    return _similarity_calculator


def calculate_similarities(query_embedding: np.ndarray, 
                          stored_embeddings: np.ndarray) -> np.ndarray:
    """
    Calculate cosine similarities between query and stored embeddings.
    
    Args:
        query_embedding: Single embedding vector
        stored_embeddings: Array of stored embeddings
        
    Returns:
        Array of similarity scores
    """
    calculator = get_similarity_calculator()
    return calculator.cosine_similarity_batch(query_embedding, stored_embeddings)



