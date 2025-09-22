"""
Test script to demonstrate GPU-accelerated similarity calculation performance.
Compares CPU vs GPU performance for face matching.
"""

import numpy as np
import time
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from gpu_similarity import get_similarity_calculator, calculate_similarities


def generate_test_data(num_embeddings=1000, embedding_dim=512):
    """Generate random test embeddings for performance testing."""
    print(f"Generating test data: {num_embeddings} embeddings of dimension {embedding_dim}")
    
    # Generate random embeddings (normalized)
    query_embedding = np.random.randn(embedding_dim).astype(np.float32)
    query_embedding = query_embedding / np.linalg.norm(query_embedding)
    
    stored_embeddings = np.random.randn(num_embeddings, embedding_dim).astype(np.float32)
    # Normalize each embedding
    stored_embeddings = stored_embeddings / np.linalg.norm(stored_embeddings, axis=1, keepdims=True)
    
    return query_embedding, stored_embeddings


def test_performance():
    """Test GPU vs CPU performance for similarity calculation."""
    print("=" * 60)
    print("GPU-Accelerated Face Similarity Performance Test")
    print("=" * 60)
    
    # Get similarity calculator info
    calculator = get_similarity_calculator()
    info = calculator.get_performance_info()
    
    print(f"GPU Available: {info['gpu_available']}")
    print(f"Device: {info['device']}")
    print(f"CuPy Available: {info['cupy_available']}")
    print(f"PyTorch Available: {info['torch_available']}")
    print(f"PyTorch CUDA Available: {info['torch_cuda_available']}")
    print()
    
    # Test different sizes
    test_sizes = [100, 500, 1000, 2000, 5000]
    
    for num_embeddings in test_sizes:
        print(f"Testing with {num_embeddings} stored embeddings...")
        
        # Generate test data
        query_embedding, stored_embeddings = generate_test_data(num_embeddings)
        
        # Test GPU/CPU performance
        start_time = time.time()
        similarities = calculate_similarities(query_embedding, stored_embeddings)
        end_time = time.time()
        
        processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
        throughput = num_embeddings / (end_time - start_time)  # embeddings per second
        
        print(f"  Processing time: {processing_time:.2f} ms")
        print(f"  Throughput: {throughput:.0f} embeddings/sec")
        print(f"  Similarities range: {similarities.min():.3f} to {similarities.max():.3f}")
        print()
        
        # Memory usage info
        if info['device'] == 'cupy':
            try:
                import cupy as cp
                mempool = cp.get_default_memory_pool()
                print(f"  GPU Memory: {mempool.used_bytes() / 1024 / 1024:.1f} MB used")
            except:
                pass
        
        print("-" * 40)


def test_accuracy():
    """Test accuracy of GPU similarity calculation."""
    print("=" * 60)
    print("GPU Similarity Calculation Accuracy Test")
    print("=" * 60)
    
    # Generate test data
    query_embedding, stored_embeddings = generate_test_data(100)
    
    # Calculate similarities
    similarities = calculate_similarities(query_embedding, stored_embeddings)
    
    # Find top matches
    top_indices = np.argsort(similarities)[-5:][::-1]
    
    print("Top 5 matches:")
    for i, idx in enumerate(top_indices):
        print(f"  {i+1}. Index {idx}: {similarities[idx]:.6f}")
    
    print(f"\nSimilarity statistics:")
    print(f"  Mean: {similarities.mean():.6f}")
    print(f"  Std: {similarities.std():.6f}")
    print(f"  Min: {similarities.min():.6f}")
    print(f"  Max: {similarities.max():.6f}")


def benchmark_comparison():
    """Compare different similarity calculation methods."""
    print("=" * 60)
    print("Similarity Calculation Method Comparison")
    print("=" * 60)
    
    # Generate test data
    query_embedding, stored_embeddings = generate_test_data(1000)
    
    # Test different methods
    methods = []
    
    # NumPy method
    start_time = time.time()
    query_norm = np.linalg.norm(query_embedding)
    stored_norms = np.linalg.norm(stored_embeddings, axis=1)
    dot_products = np.dot(query_embedding, stored_embeddings.T)
    numpy_similarities = dot_products / (query_norm * stored_norms)
    numpy_time = time.time() - start_time
    methods.append(("NumPy CPU", numpy_time, numpy_similarities))
    
    # GPU method
    start_time = time.time()
    gpu_similarities = calculate_similarities(query_embedding, stored_embeddings)
    gpu_time = time.time() - start_time
    methods.append(("GPU Accelerated", gpu_time, gpu_similarities))
    
    # Compare results
    print("Method Comparison:")
    for method_name, method_time, method_similarities in methods:
        print(f"  {method_name}: {method_time*1000:.2f} ms")
    
    # Check accuracy
    numpy_sim, gpu_sim = methods[0][2], methods[1][2]
    max_diff = np.abs(numpy_sim - gpu_sim).max()
    print(f"\nMaximum difference between methods: {max_diff:.10f}")
    
    if max_diff < 1e-6:
        print("✅ GPU and CPU results are identical (within numerical precision)")
    else:
        print("⚠️  GPU and CPU results differ - this may indicate an issue")


if __name__ == "__main__":
    print("Starting GPU Similarity Performance Tests...")
    print()
    
    try:
        # Test performance
        test_performance()
        
        # Test accuracy
        test_accuracy()
        
        # Benchmark comparison
        benchmark_comparison()
        
        print("=" * 60)
        print("All tests completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()



