/**
 * Face Processing Queue System
 * Handles bulk photo face recognition with proper throttling and error recovery
 */

interface QueueItem {
  photoId: string;
  fileReference: string;
  retryCount: number;
  timestamp: number;
}

class FaceProcessingQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxConcurrent = 3; // Process max 3 photos simultaneously
  private retryAttempts = 3;
  private processingDelay = 500; // 500ms delay between batches
  private activeProcessing = new Set<string>();

  constructor() {
    // Start processing queue on initialization
    this.startProcessing();
  }

  /**
   * Add photo to processing queue
   */
  async addToQueue(photoId: string, fileReference: string): Promise<void> {
    // Check if already in queue or being processed
    if (this.queue.find(item => item.photoId === photoId) || this.activeProcessing.has(photoId)) {
      return;
    }

    this.queue.push({
      photoId,
      fileReference,
      retryCount: 0,
      timestamp: Date.now()
    });

    // Only log if queue is getting large
    if (this.queue.length > 10) {
      console.log(`Face processing queue size: ${this.queue.length}`);
    }
  }

  /**
   * Start the queue processing loop
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.processing) {
      try {
        // Process items in batches up to maxConcurrent
        const itemsToProcess = this.queue.splice(0, this.maxConcurrent);
        
        if (itemsToProcess.length === 0) {
          // No items to process, wait and continue
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Only log for larger batches
        if (itemsToProcess.length > 2) {
          console.log(`Processing ${itemsToProcess.length} photos for face recognition`);
        }

        // Process items in parallel but limited by maxConcurrent
        const processingPromises = itemsToProcess.map(item => this.processItem(item));
        
        await Promise.allSettled(processingPromises);

        // Add delay between batches to prevent overwhelming the service
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        }

      } catch (error) {
        console.error('Error in face processing queue:', error);
        // Continue processing even if there's an error
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Process individual queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { photoId, fileReference, retryCount } = item;
    
    try {
      this.activeProcessing.add(photoId);
      
      // Only log retries
      if (retryCount > 0) {
        console.log(`Retrying face processing for photo ${photoId} (attempt ${retryCount + 1})`);
      }

      // Import the face processing function
      const { processFacePhoto } = await import('./face-recognition-service');
      const { storage } = await import('./storage');
      
      // Process the photo to extract face data
      const faceData = await processFacePhoto(fileReference);
      
      if (faceData && faceData.length > 0) {
        // Only log if multiple faces found (more interesting)
        if (faceData.length > 1) {
          console.log(`Found ${faceData.length} faces in photo ${photoId}`);
        }
        
        // Update the photo with face data
        await storage.updatePhoto(photoId, {
          faceData: faceData,
          isProcessed: true
        });
      } else {
        // Still mark as processed even if no faces found
        await storage.updatePhoto(photoId, {
          isProcessed: true
        });
      }

    } catch (error) {
      console.error(`Error processing photo ${photoId}:`, error);
      
      // Retry logic
      if (retryCount < this.retryAttempts) {
        console.log(`Retrying photo ${photoId} (${retryCount + 1}/${this.retryAttempts})`);
        
        // Add back to queue with incremented retry count
        this.queue.push({
          ...item,
          retryCount: retryCount + 1
        });
      } else {
        console.error(`Failed to process photo ${photoId} after ${this.retryAttempts + 1} attempts`);
        
        // Mark as processed with error to prevent infinite retries
        try {
          const { storage } = await import('./storage');
          await storage.updatePhoto(photoId, {
            isProcessed: true
          });
        } catch (updateError) {
          console.error(`Failed to update photo ${photoId} with error status:`, updateError);
        }
      }
    } finally {
      this.activeProcessing.delete(photoId);
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      activeProcessing: this.activeProcessing.size,
      processing: this.processing,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Update processing parameters
   */
  updateSettings(settings: {
    maxConcurrent?: number;
    processingDelay?: number;
    retryAttempts?: number;
  }) {
    if (settings.maxConcurrent !== undefined) {
      this.maxConcurrent = Math.max(1, Math.min(10, settings.maxConcurrent));
    }
    if (settings.processingDelay !== undefined) {
      this.processingDelay = Math.max(100, settings.processingDelay);
    }
    if (settings.retryAttempts !== undefined) {
      this.retryAttempts = Math.max(0, Math.min(5, settings.retryAttempts));
    }
    
    console.log('Face processing queue settings updated:', {
      maxConcurrent: this.maxConcurrent,
      processingDelay: this.processingDelay,
      retryAttempts: this.retryAttempts
    });
  }

  /**
   * Stop processing (for graceful shutdown)
   */
  stop() {
    console.log('Stopping face processing queue');
    this.processing = false;
  }
}

// Export singleton instance
export const faceProcessingQueue = new FaceProcessingQueue();