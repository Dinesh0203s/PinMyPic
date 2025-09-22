#!/usr/bin/env python3
"""
Test script for dynamic batch processing optimization
Demonstrates the improved GPU utilization with dynamic processing
"""

import time
import os
import sys
import logging
from pathlib import Path

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_images(count=64):
    """Create test images for batch processing."""
    import numpy as np
    from PIL import Image
    
    test_images = []
    test_dir = Path("test_images")
    test_dir.mkdir(exist_ok=True)
    
    for i in range(count):
        # Create a simple test image
        img_array = np.random.randint(0, 255, (400, 400, 3), dtype=np.uint8)
        
        # Add some face-like features
        # Eyes
        img_array[150:160, 150:170] = [0, 0, 0]  # Left eye
        img_array[150:160, 230:250] = [0, 0, 0]  # Right eye
        
        # Nose
        img_array[180:200, 190:210] = [128, 128, 128]  # Nose
        
        # Mouth
        img_array[220:230, 170:230] = [255, 0, 0]  # Mouth
        
        # Save image
        img = Image.fromarray(img_array)
        img_path = test_dir / f"test_face_{i:03d}.jpg"
        img.save(img_path, "JPEG", quality=85)
        test_images.append(str(img_path))
    
    return test_images

def test_dynamic_batch_processing():
    """Test the dynamic batch processing performance."""
    try:
        from face_processor import FaceProcessor
        from config import GPU_AVAILABLE, get_config_summary
        
        logger.info("Testing Dynamic Batch Processing")
        logger.info("=" * 50)
        
        # Show configuration
        config = get_config_summary()
        logger.info(f"GPU Available: {config['gpu_available']}")
        logger.info(f"Using GPU: {config['gpu_available']}")
        logger.info(f"Max Workers: {config['max_workers']}")
        logger.info(f"Batch Size: {config['batch_size']}")
        
        # Initialize face processor
        logger.info("Initializing face processor...")
        processor = FaceProcessor()
        
        # Create test images
        logger.info("Creating test images...")
        test_images = create_test_images(64)  # 64 images for testing
        logger.info(f"Created {len(test_images)} test images")
        
        # Test 1: Sequential processing (baseline)
        logger.info("\n1. Testing Sequential Processing (Baseline)")
        start_time = time.time()
        sequential_results = {}
        for i, img_path in enumerate(test_images[:10]):  # Test with 10 images
            faces = processor.process_image_file(img_path)
            sequential_results[img_path] = faces
            if (i + 1) % 5 == 0:
                logger.info(f"  Processed {i + 1}/10 images")
        
        sequential_time = time.time() - start_time
        logger.info(f"Sequential processing: {sequential_time:.2f}s for 10 images")
        logger.info(f"Sequential rate: {10/sequential_time:.1f} images/sec")
        
        # Test 2: Dynamic batch processing
        logger.info("\n2. Testing Dynamic Batch Processing")
        start_time = time.time()
        dynamic_results = processor.process_batch(test_images)
        dynamic_time = time.time() - start_time
        
        logger.info(f"Dynamic batch processing: {dynamic_time:.2f}s for {len(test_images)} images")
        logger.info(f"Dynamic rate: {len(test_images)/dynamic_time:.1f} images/sec")
        
        # Calculate improvement
        if sequential_time > 0:
            improvement = (len(test_images)/dynamic_time) / (10/sequential_time)
            logger.info(f"Performance improvement: {improvement:.1f}x faster")
        
        # Test 3: Memory usage
        logger.info("\n3. Testing Memory Usage")
        if hasattr(processor, '_log_gpu_memory'):
            processor._log_gpu_memory()
        
        # Clean up test images
        logger.info("\nCleaning up test images...")
        import shutil
        shutil.rmtree("test_images", ignore_errors=True)
        
        logger.info("\n" + "=" * 50)
        logger.info("✅ Dynamic batch processing test completed!")
        
        return {
            'sequential_time': sequential_time,
            'dynamic_time': dynamic_time,
            'sequential_rate': 10/sequential_time,
            'dynamic_rate': len(test_images)/dynamic_time,
            'improvement': improvement if sequential_time > 0 else 0
        }
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main test function."""
    logger.info("Dynamic Batch Processing Test")
    logger.info("=" * 50)
    
    results = test_dynamic_batch_processing()
    
    if results:
        logger.info("\n📊 Test Results Summary:")
        logger.info(f"Sequential Rate: {results['sequential_rate']:.1f} images/sec")
        logger.info(f"Dynamic Rate: {results['dynamic_rate']:.1f} images/sec")
        logger.info(f"Performance Improvement: {results['improvement']:.1f}x faster")
        
        if results['improvement'] > 1.5:
            logger.info("🚀 Excellent! Dynamic processing is significantly faster!")
        elif results['improvement'] > 1.1:
            logger.info("✅ Good! Dynamic processing shows improvement!")
        else:
            logger.info("⚠️  Dynamic processing needs optimization")
    else:
        logger.error("❌ Test failed")

if __name__ == "__main__":
    main()




