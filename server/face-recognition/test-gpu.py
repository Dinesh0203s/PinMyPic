#!/usr/bin/env python3
"""
Test script to verify GPU acceleration is working for face recognition.
"""

import os
import sys
import time
import numpy as np
import cv2

# Set environment variables for GPU acceleration
os.environ['CUDA_VISIBLE_DEVICES'] = '0'
os.environ['FORCE_CPU'] = 'false'
os.environ['PATH'] += ';C:\\Users\\Aakash\\AppData\\Roaming\\Python\\Python313\\site-packages\\nvidia\\cudnn\\bin'

def test_gpu_acceleration():
    """Test GPU acceleration for face recognition."""
    print("=" * 50)
    print("  GPU Acceleration Test for Face Recognition")
    print("=" * 50)
    
    try:
        # Import face processor
        from face_processor import FaceProcessor
        
        print("✓ Face processor imported successfully")
        
        # Initialize processor
        print("Initializing face processor...")
        processor = FaceProcessor()
        
        # Get model info
        model_info = processor.get_model_info()
        
        print(f"\n📊 Model Information:")
        print(f"  Device: {model_info['device_info']}")
        print(f"  Using GPU: {model_info['using_gpu']}")
        print(f"  Providers: {model_info['providers']}")
        print(f"  Batch Size: {model_info['batch_size']}")
        print(f"  Max Workers: {model_info['max_workers']}")
        
        # Verify GPU is being used
        if model_info['using_gpu']:
            print(f"\n✅ SUCCESS: GPU acceleration is active!")
            print(f"   Using device: {model_info['device_info']}")
            print(f"   Providers: {', '.join(model_info['providers'])}")
        else:
            print(f"\n❌ WARNING: GPU acceleration is not active")
            print(f"   Using device: {model_info['device_info']}")
            return False
        
        # Test face detection with a simple image
        print(f"\n🧪 Testing face detection...")
        
        # Create a simple test image (640x480 with a face-like pattern)
        test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Add a simple face-like pattern
        cv2.rectangle(test_image, (200, 150), (440, 350), (255, 255, 255), -1)
        cv2.circle(test_image, (250, 200), 20, (0, 0, 0), -1)  # Left eye
        cv2.circle(test_image, (390, 200), 20, (0, 0, 0), -1)  # Right eye
        cv2.ellipse(test_image, (320, 280), (60, 30), 0, 0, 180, (0, 0, 0), 2)  # Mouth
        
        # Test face detection performance
        start_time = time.time()
        faces = processor.detect_faces(test_image)
        processing_time = time.time() - start_time
        
        print(f"  Processing time: {processing_time:.3f} seconds")
        print(f"  Faces detected: {len(faces)}")
        
        # Performance check
        if processing_time < 1.0:  # Should be fast with GPU
            print(f"✅ Performance: Excellent ({processing_time:.3f}s)")
        elif processing_time < 2.0:
            print(f"✅ Performance: Good ({processing_time:.3f}s)")
        else:
            print(f"⚠️  Performance: Slow ({processing_time:.3f}s) - check GPU usage")
        
        # Get performance stats
        stats = processor.get_performance_stats()
        print(f"\n📈 Performance Statistics:")
        print(f"  Total processed: {stats['total_processed']}")
        print(f"  Total faces detected: {stats['total_faces_detected']}")
        print(f"  Average processing time: {stats['average_processing_time']:.3f}s")
        
        if 'faces_per_second' in stats:
            print(f"  Faces per second: {stats['faces_per_second']:.2f}")
        
        print(f"\n🎉 GPU acceleration test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_gpu_acceleration()
    sys.exit(0 if success else 1)




