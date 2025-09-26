"""
Flask API for face recognition processing.
"""
import os
import json
import sys
import time
import threading
from flask import Flask, request, jsonify
import numpy as np
import cv2
import base64
import requests
import io
from face_processor import FaceProcessor
import logging

# Configure logging - reduced verbosity for performance
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

app = Flask(__name__)
face_processor = None

# Connection pool optimized for RTX 3060
MAX_WORKERS = 24  # Maximum parallel processing for RTX 3060
processing_semaphore = None

def init_semaphore():
    """Initialize semaphore for controlling concurrent processing."""
    global processing_semaphore
    if processing_semaphore is None:
        processing_semaphore = __import__('asyncio').Semaphore(MAX_WORKERS)

def download_models_if_needed():
    """Download models before starting the face processor."""
    try:
        # Import and initialize to trigger model download
        import insightface
        from config import ARCFACE_MODEL_NAME
        
        # Create a temporary face analysis app to trigger model download
        temp_app = insightface.app.FaceAnalysis(
            name=ARCFACE_MODEL_NAME,
            providers=['CPUExecutionProvider']  # Use CPU for model download
        )
        
        # This will download the model if not already cached
        temp_app.prepare(ctx_id=-1, det_size=(640, 640))
        return True
        
    except Exception as e:
        logger.error(f"Failed to download models: {str(e)}")
        return False

def get_face_processor():
    """Get or create face processor instance."""
    global face_processor
    if face_processor is None:
        # Download models first if needed
        if not download_models_if_needed():
            logger.error("Failed to download required models")
            sys.exit(1)
        
        face_processor = FaceProcessor()
    return face_processor

def process_worker():
    """Worker thread function to process photos from the queue."""
    import gc
    import threading
    import queue
    
    processor = get_face_processor()
    
    while True:
        try:
            # Get work from queue with timeout
            work_item = app.processing_queue.get(timeout=30)
            if work_item is None:  # Shutdown signal
                break
                
            photo_path, result_queue = work_item
            
            try:
                # Process the photo
                start_time = time.time()
                
                # Handle different types of photo references
                faces = None
                
                if photo_path.startswith('http') and 'cloudinary.com' in photo_path:
                    # Cloudinary URL processing
                    try:
                        response = requests.get(photo_path, timeout=30)
                        response.raise_for_status()
                        
                        image_data = np.frombuffer(response.content, np.uint8)
                        image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
                        if image is not None:
                            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                            faces = processor.detect_faces(image)
                            del image, image_data
                        else:
                            raise Exception('Could not decode Cloudinary image')
                            
                    except Exception as e:
                        result_queue.put(('error', f'Cloudinary processing error: {str(e)}'))
                        continue
                        
                elif len(photo_path) == 24 and all(c in '0123456789abcdef' for c in photo_path.lower()):
                    # GridFS ID processing  
                    try:
                        image_url = f"http://localhost:5000/api/images/{photo_path}"
                        response = requests.get(image_url, timeout=30)
                        response.raise_for_status()
                        
                        image_data = np.frombuffer(response.content, np.uint8)
                        image = cv2.imdecode(image_data, cv2.IMREAD_COLOR)
                        if image is not None:
                            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                            faces = processor.detect_faces(image)
                            del image, image_data
                        else:
                            raise Exception('Could not decode GridFS image')
                            
                    except Exception as e:
                        result_queue.put(('error', f'GridFS processing error: {str(e)}'))
                        continue
                else:
                    # Local file processing
                    try:
                        faces = processor.process_image_file(photo_path)
                    except Exception as e:
                        result_queue.put(('error', f'File processing error: {str(e)}'))
                        continue
                
                processing_time = time.time() - start_time
                filename = photo_path.split('/')[-1] if '/' in photo_path else photo_path
                logger.info(f"Worker processed {filename}: {len(faces)} faces detected in {processing_time:.2f}s")
                
                # Send result back
                result_queue.put(('success', faces or []))
                
            except Exception as e:
                logger.error(f"Worker error processing {photo_path}: {str(e)}")
                result_queue.put(('error', str(e)))
            finally:
                # Clean up memory
                gc.collect()
                app.processing_queue.task_done()
                
        except queue.Empty:
            continue  # Timeout, continue waiting
        except Exception as e:
            logger.error(f"Worker thread error: {str(e)}")
            continue

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with GPU status."""
    try:
        processor = get_face_processor()
        model_info = processor.get_model_info()
        
        return jsonify({
            'status': 'healthy', 
            'service': 'face-recognition',
            'gpu_acceleration': model_info['using_gpu'],
            'device': model_info['device_info'],
            'model_loaded': model_info['model_loaded']
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'service': 'face-recognition'
        }), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get detailed system status including GPU information."""
    try:
        processor = get_face_processor()
        model_info = processor.get_model_info()
        
        # Get GPU similarity calculator info
        from gpu_similarity import get_similarity_calculator
        similarity_calculator = get_similarity_calculator()
        similarity_info = similarity_calculator.get_performance_info()
        
        return jsonify({
            'success': True,
            'model_info': model_info,
            'performance_stats': processor.get_performance_stats(),
            'similarity_calculator': similarity_info
        })
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process-photo', methods=['POST'])
def process_photo():
    """Process a photo and extract face embeddings with resource management."""
    import gc
    import threading
    import queue
    import time
    
    # Global queue for processing requests
    if not hasattr(app, 'processing_queue'):
        app.processing_queue = queue.Queue(maxsize=128)  # Increased queue size for RTX 3060
        app.processing_threads = []
        # Start worker threads
        for i in range(MAX_WORKERS):
            worker = threading.Thread(target=process_worker, daemon=True)
            worker.start()
            app.processing_threads.append(worker)
    
    # Quick queue size check
    if app.processing_queue.qsize() > 100:  # Higher threshold for RTX 3060
        return jsonify({'error': 'Service overloaded, please try again later'}), 503
    
    try:
        data = request.json
        # Support both 'file_reference' (new) and 'photoPath' (legacy) parameters
        photo_path = data.get('file_reference') or data.get('photoPath')
        
        if not photo_path:
            return jsonify({'error': 'file_reference or photoPath is required'}), 400
        

        
        # Create a result queue for this request
        result_queue = queue.Queue()
        
        try:
            # Add work to the processing queue
            app.processing_queue.put((photo_path, result_queue), timeout=5)
        except queue.Full:
            return jsonify({'error': 'Service overloaded, please try again later'}), 503
        
        # Wait for result with timeout
        try:
            status, result = result_queue.get(timeout=120)  # 2 minute timeout
            
            if status == 'success':
                filename = photo_path.split('/')[-1] if '/' in photo_path else photo_path
                face_count = len(result) if result else 0
                return jsonify({'success': True, 'faces': result})
            else:
                return jsonify({'success': False, 'error': result}), 500
                
        except queue.Empty:
            logger.error(f"Processing timeout for {photo_path}")
            return jsonify({'error': 'Processing timeout'}), 504
            
    except Exception as e:
        logger.error(f"Error processing photo: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        # Force garbage collection on error too
        gc.collect()

@app.route('/compare-faces', methods=['POST'])
def compare_faces():
    """Compare a selfie with stored face embeddings using GPU-accelerated similarity calculation."""
    try:
        data = request.json
        selfie_data = data.get('selfieData')  # Base64 encoded image
        embeddings = data.get('embeddings')  # List of stored embeddings to compare against
        
        if not selfie_data or not embeddings:
            return jsonify({'error': 'selfieData and embeddings are required'}), 400
        
        # Decode base64 image
        image_data = base64.b64decode(selfie_data.split(',')[1] if ',' in selfie_data else selfie_data)
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Get face processor
        processor = get_face_processor()
        
        # Detect faces in selfie
        faces = processor.detect_faces(image)
        if not faces:
            return jsonify({'error': 'No face detected in selfie'}), 400
        
        # Use the first face (largest)
        selfie_embedding = np.array(faces[0]['embedding'])
        
        # Prepare stored embeddings for batch processing
        stored_embeddings = np.array([emb['embedding'] for emb in embeddings])
        
        # GPU-accelerated similarity calculation
        from gpu_similarity import calculate_similarities
        similarities = calculate_similarities(selfie_embedding, stored_embeddings)
        
        # Create matches
        matches = []
        for i, similarity in enumerate(similarities):
            matches.append({
                'photoId': embeddings[i]['photoId'],
                'similarity': float(similarity)
            })
        
        # Sort by similarity
        matches.sort(key=lambda x: x['similarity'], reverse=True)
        
        return jsonify({
            'success': True,
            'matches': matches
        })
        
    except Exception as e:
        logger.error(f"Error comparing faces: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Production mode - disable debug and reloader for security
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)