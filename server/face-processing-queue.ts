/**
 * Enhanced Face Processing Queue System
 * Handles 100+ concurrent users with proper throttling, priority queuing, and load balancing
 */

interface QueueItem {
  photoId: string;
  fileReference: string;
  retryCount: number;
  timestamp: number;
  userId: string;
  priority: 'high' | 'normal' | 'low';
  userSessionId?: string;
}

interface UserQueueStats {
  userId: string;
  queuedItems: number;
  processingItems: number;
  lastActivity: number;
}

class FaceProcessingQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private maxConcurrent = 20; // Increased to handle large batch uploads
  private retryAttempts = 3;
  private processingDelay = 50; // Minimal delay for maximum throughput
  private activeProcessing = new Set<string>();
  
  // User-based queue management
  private userQueues = new Map<string, QueueItem[]>();
  private userStats = new Map<string, UserQueueStats>();
  private maxItemsPerUser = 10000; // Allow up to 10,000 photos per user
  private userConcurrencyLimit = 20; // Increased concurrent processing per user for large uploads
  
  // Performance monitoring
  private processedCount = 0;
  private errorCount = 0;
  private avgProcessingTime = 0;
  private startTime = Date.now();

  constructor() {
    // Start processing queue on initialization
    this.startProcessing();
    
    // Start periodic cleanup and monitoring
    this.startMaintenanceTasks();
  }

  /**
   * Add photo to processing queue with user-based prioritization
   */
  async addToQueue(
    photoId: string, 
    fileReference: string, 
    userId: string, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    userSessionId?: string
  ): Promise<{ success: boolean; message?: string; queuePosition?: number }> {
    // Check if already in queue or being processed
    if (this.queue.find(item => item.photoId === photoId) || this.activeProcessing.has(photoId)) {
      return { success: false, message: 'Photo already in queue or processing' };
    }

    // Check user queue limits
    const userQueue = this.userQueues.get(userId) || [];
    if (userQueue.length >= this.maxItemsPerUser) {
      return { 
        success: false, 
        message: `User queue limit reached (${this.maxItemsPerUser} items). Please wait for current items to process.` 
      };
    }

    const queueItem: QueueItem = {
      photoId,
      fileReference,
      retryCount: 0,
      timestamp: Date.now(),
      userId,
      priority,
      userSessionId
    };

    // Add to user-specific queue
    if (!this.userQueues.has(userId)) {
      this.userQueues.set(userId, []);
    }
    this.userQueues.get(userId)!.push(queueItem);

    // Add to main queue with priority sorting
    this.insertByPriority(queueItem);

    // Update user stats
    this.updateUserStats(userId);

    const queuePosition = this.getQueuePosition(photoId);
    
    // Enhanced logging for queue management
    if (this.queue.length > 20 || userQueue.length > 5) {
      console.log(`Queue Status - Total: ${this.queue.length}, User ${userId}: ${userQueue.length + 1}, Active: ${this.activeProcessing.size}`);
    }

    return { 
      success: true, 
      queuePosition,
      message: `Added to queue. Position: ${queuePosition}` 
    };
  }

  /**
   * Insert item into queue based on priority
   */
  private insertByPriority(item: QueueItem): void {
    const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[item.priority] < priorityOrder[this.queue[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * Get position of photo in queue
   */
  private getQueuePosition(photoId: string): number {
    return this.queue.findIndex(item => item.photoId === photoId) + 1;
  }

  /**
   * Update user statistics
   */
  private updateUserStats(userId: string): void {
    const userQueue = this.userQueues.get(userId) || [];
    const activeCount = Array.from(this.activeProcessing).filter(id => {
      const item = this.queue.find(q => q.photoId === id);
      return item?.userId === userId;
    }).length;

    this.userStats.set(userId, {
      userId,
      queuedItems: userQueue.length,
      processingItems: activeCount,
      lastActivity: Date.now()
    });
  }

  /**
   * Enhanced queue processing with user-based load balancing
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.processing) {
      try {
        // Calculate available processing slots
        const availableSlots = this.maxConcurrent - this.activeProcessing.size;
        
        if (availableSlots <= 0) {
          // All slots busy, wait briefly
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Get next items with user concurrency limits
        const itemsToProcess = this.getNextItemsForProcessing(availableSlots);
        
        if (itemsToProcess.length === 0) {
          // No items to process, wait and continue
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Enhanced logging with more details
        if (itemsToProcess.length > 1 || this.queue.length > 10) {
          console.log(`Processing ${itemsToProcess.length} photos (${this.activeProcessing.size} active, ${this.queue.length} queued)`);
        }

        // Process items in parallel with proper error handling
        const processingPromises = itemsToProcess.map(item => 
          this.processItem(item).catch(error => {
            console.error(`Error processing item ${item.photoId}:`, error);
            return error; // Return error to prevent unhandled rejection
          })
        );
        
        // Don't wait for all to complete - continue processing immediately
        Promise.allSettled(processingPromises).then(() => {
          // All items processed (successfully or with errors)
        }).catch(error => {
          console.error('Critical error in batch processing:', error);
        });

        // Minimal delay for maximum throughput, only if queue is very large
        if (this.queue.length > 50) {
          await new Promise(resolve => setTimeout(resolve, this.processingDelay));
        }

      } catch (error) {
        console.error('Error in face processing queue:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Get next items respecting user concurrency limits
   */
  private getNextItemsForProcessing(maxItems: number): QueueItem[] {
    const itemsToProcess: QueueItem[] = [];
    const userConcurrency = new Map<string, number>();
    
    // Count current processing per user
    Array.from(this.activeProcessing).forEach(photoId => {
      const item = this.queue.find(q => q.photoId === photoId);
      if (item) {
        userConcurrency.set(item.userId, (userConcurrency.get(item.userId) || 0) + 1);
      }
    });

    // Select items from queue respecting user limits
    for (let i = 0; i < this.queue.length && itemsToProcess.length < maxItems; i++) {
      const item = this.queue[i];
      const currentUserConcurrency = userConcurrency.get(item.userId) || 0;
      
      if (currentUserConcurrency < this.userConcurrencyLimit) {
        itemsToProcess.push(item);
        userConcurrency.set(item.userId, currentUserConcurrency + 1);
        this.queue.splice(i, 1);
        i--; // Adjust index after removal
      }
    }

    return itemsToProcess;
  }

  /**
   * Process individual queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { photoId, fileReference, retryCount, userId } = item;
    const startTime = Date.now();
    
    try {
      this.activeProcessing.add(photoId);
      
      // Remove from user queue when processing starts
      const userQueue = this.userQueues.get(userId);
      if (userQueue) {
        const index = userQueue.findIndex(q => q.photoId === photoId);
        if (index >= 0) {
          userQueue.splice(index, 1);
        }
      }
      
      // Only log retries and important events
      if (retryCount > 0) {
        console.log(`Retrying face processing for photo ${photoId} (attempt ${retryCount + 1}) - User: ${userId}`);
      }

      // Import the face processing function
      const { processFacePhoto } = await import('./face-recognition-service');
      const { storage } = await import('./storage');
      
      // Process the photo to extract face data
      const faceData = await processFacePhoto(fileReference);
      
      if (faceData && faceData.length > 0) {
        // Enhanced logging with user context
        if (faceData.length > 1) {
          console.log(`Found ${faceData.length} faces in photo ${photoId} (User: ${userId})`);
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

      // Update performance metrics
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics(processingTime, true);

      // Clean up local file after successful processing
      try {
        const fs = await import('fs');
        if (fs.existsSync(fileReference) && fileReference.includes('/uploads/')) {
          fs.unlinkSync(fileReference);
          console.log(`Cleaned up local file: ${fileReference}`);
        }
      } catch (cleanupError) {
        console.warn(`Failed to cleanup local file ${fileReference}:`, cleanupError);
      }

    } catch (error) {
      this.errorCount++;
      console.error(`Error processing photo ${photoId} (User: ${userId}):`, error);
      
      // Enhanced retry logic with exponential backoff
      if (retryCount < this.retryAttempts) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s delay
        
        console.log(`Retrying photo ${photoId} in ${backoffDelay}ms (${retryCount + 1}/${this.retryAttempts})`);
        
        // Add back to queue with delay and incremented retry count
        setTimeout(() => {
          this.insertByPriority({
            ...item,
            retryCount: retryCount + 1,
            timestamp: Date.now()
          });
        }, backoffDelay);
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
      
      this.updatePerformanceMetrics(Date.now() - startTime, false);
    } finally {
      this.activeProcessing.delete(photoId);
      this.updateUserStats(userId);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number, success: boolean): void {
    this.processedCount++;
    if (success) {
      this.avgProcessingTime = (this.avgProcessingTime + processingTime) / 2;
    }
  }

  /**
   * Start maintenance tasks for queue optimization
   */
  private startMaintenanceTasks(): void {
    // Clean up old user queues every 5 minutes
    setInterval(() => {
      this.cleanupOldUserQueues();
    }, 5 * 60 * 1000);

    // Log queue statistics every minute if busy
    setInterval(() => {
      if (this.queue.length > 5 || this.activeProcessing.size > 0) {
        this.logQueueStatistics();
      }
    }, 60 * 1000);
  }

  /**
   * Clean up inactive user queues
   */
  private cleanupOldUserQueues(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    Array.from(this.userStats.entries()).forEach(([userId, stats]) => {
      if (now - stats.lastActivity > maxAge && stats.queuedItems === 0 && stats.processingItems === 0) {
        this.userQueues.delete(userId);
        this.userStats.delete(userId);
      }
    });
  }

  /**
   * Log detailed queue statistics
   */
  private logQueueStatistics(): void {
    const runtime = Date.now() - this.startTime;
    const throughput = this.processedCount / (runtime / 1000 / 60); // per minute
    
    console.log(`Queue Stats - Queue: ${this.queue.length}, Active: ${this.activeProcessing.size}, Users: ${this.userStats.size}, Processed: ${this.processedCount}, Errors: ${this.errorCount}, Throughput: ${throughput.toFixed(1)}/min`);
  }

  /**
   * Get comprehensive queue status
   */
  getStatus() {
    const runtime = Date.now() - this.startTime;
    const throughput = this.processedCount / (runtime / 1000 / 60);
    
    return {
      queueSize: this.queue.length,
      activeProcessing: this.activeProcessing.size,
      processing: this.processing,
      maxConcurrent: this.maxConcurrent,
      userConcurrencyLimit: this.userConcurrencyLimit,
      activeUsers: this.userStats.size,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      avgProcessingTime: Math.round(this.avgProcessingTime),
      throughputPerMinute: Math.round(throughput * 100) / 100,
      uptime: Math.round(runtime / 1000)
    };
  }

  /**
   * Get user-specific queue status
   */
  getUserStatus(userId: string) {
    const userQueue = this.userQueues.get(userId) || [];
    const stats = this.userStats.get(userId);
    
    return {
      queuedItems: userQueue.length,
      processingItems: stats?.processingItems || 0,
      maxAllowed: this.maxItemsPerUser,
      position: userQueue.length > 0 ? this.getQueuePosition(userQueue[0].photoId) : null
    };
  }

  /**
   * Update processing parameters for load balancing
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