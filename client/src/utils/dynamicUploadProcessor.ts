/**
 * Dynamic Upload Processor
 * Processes files continuously without waiting for batch completion
 * Similar to GPU dynamic batch processing but for frontend uploads
 */

export interface DynamicUploadItem {
  file: File;
  uploadFile: any; // UploadFile type from PhotoUploadDialog
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export interface DynamicUploadStats {
  total: number;
  completed: number;
  uploading: number;
  pending: number;
  errors: number;
  throughput: number; // files per second
}

export class DynamicUploadProcessor {
  private uploadQueue: DynamicUploadItem[] = [];
  private activeUploads = new Set<string>();
  private maxConcurrent: number;
  private uploadFunction: (uploadFile: any) => Promise<void>;
  private updateFunction: (updater: (prev: any[]) => any[]) => void;
  private onProgress?: (stats: DynamicUploadStats) => void;
  private startTime: number = 0;
  private completedCount: number = 0;

  constructor(
    maxConcurrent: number = 8,
    uploadFunction: (uploadFile: any) => Promise<void>,
    updateFunction: (updater: (prev: any[]) => any[]) => void,
    onProgress?: (stats: DynamicUploadStats) => void
  ) {
    this.maxConcurrent = maxConcurrent;
    this.uploadFunction = uploadFunction;
    this.updateFunction = updateFunction;
    this.onProgress = onProgress;
  }

  /**
   * Start dynamic processing of upload files
   */
  async processDynamicUploads(uploadFiles: any[]): Promise<void> {
    this.startTime = Date.now();
    this.completedCount = 0;
    
    // Initialize queue with all files
    this.uploadQueue = uploadFiles.map(uf => ({
      file: uf.file,
      uploadFile: uf,
      id: uf.id,
      status: 'pending' as const,
      progress: 0
    }));


    // Start processing with max concurrent uploads
    const promises: Promise<void>[] = [];
    for (let i = 0; i < Math.min(this.maxConcurrent, this.uploadQueue.length); i++) {
      promises.push(this.processNextUpload());
    }

    // Wait for all uploads to complete
    await Promise.all(promises);

    const totalTime = (Date.now() - this.startTime) / 1000;
    const throughput = this.completedCount / totalTime;
    
  }

  /**
   * Process next available upload in queue
   */
  private async processNextUpload(): Promise<void> {
    while (this.uploadQueue.length > 0 || this.activeUploads.size > 0) {
      // Find next pending file
      const nextItem = this.uploadQueue.find(item => item.status === 'pending');
      
      if (!nextItem) {
        // No pending files, wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Check if we're at max concurrent limit
      if (this.activeUploads.size >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Start processing this file
      this.activeUploads.add(nextItem.id);
      nextItem.status = 'uploading';

      try {
        // Update UI to show uploading
        this.updateFunction(prev => prev.map(f => 
          f.id === nextItem.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
        ));

        // Process the upload
        await this.uploadFunction(nextItem.uploadFile);

        // Mark as completed
        nextItem.status = 'completed';
        nextItem.progress = 100;
        this.completedCount++;

        // Update UI to show completed
        this.updateFunction(prev => prev.map(f => 
          f.id === nextItem.id ? { ...f, status: 'completed' as const, progress: 100 } : f
        ));

        // Remove from queue
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== nextItem.id);

        // Update progress stats
        this.updateProgressStats();

      } catch (error) {
        console.error(`Upload failed for ${nextItem.file.name}:`, error);
        
        // Mark as error
        nextItem.status = 'error';
        nextItem.error = error instanceof Error ? error.message : 'Upload failed';

        // Update UI to show error
        this.updateFunction(prev => prev.map(f => 
          f.id === nextItem.id ? { 
            ...f, 
            status: 'error' as const, 
            error: nextItem.error 
          } : f
        ));

        // Remove from queue
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== nextItem.id);

        // Update progress stats
        this.updateProgressStats();
      } finally {
        // Remove from active uploads
        this.activeUploads.delete(nextItem.id);
      }
    }
  }

  /**
   * Update progress statistics
   */
  private updateProgressStats(): void {
    if (!this.onProgress) return;

    const total = this.uploadQueue.length + this.completedCount;
    const completed = this.completedCount;
    const uploading = this.activeUploads.size;
    const pending = this.uploadQueue.filter(item => item.status === 'pending').length;
    const errors = this.uploadQueue.filter(item => item.status === 'error').length;
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const throughput = completed / Math.max(elapsed, 1);

    this.onProgress({
      total,
      completed,
      uploading,
      pending,
      errors,
      throughput
    });
  }

  /**
   * Get current processing statistics
   */
  getStats(): DynamicUploadStats {
    const total = this.uploadQueue.length + this.completedCount;
    const completed = this.completedCount;
    const uploading = this.activeUploads.size;
    const pending = this.uploadQueue.filter(item => item.status === 'pending').length;
    const errors = this.uploadQueue.filter(item => item.status === 'error').length;
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const throughput = completed / Math.max(elapsed, 1);

    return {
      total,
      completed,
      uploading,
      pending,
      errors,
      throughput
    };
  }

  /**
   * Stop processing (for cleanup)
   */
  stop(): void {
    this.uploadQueue = [];
    this.activeUploads.clear();
  }
}

/**
 * Upload Queue Manager
 * Manages dynamic upload processing with intelligent concurrency
 */
export class UploadQueueManager {
  private processors = new Map<string, DynamicUploadProcessor>();
  private globalMaxConcurrent: number = 16; // Increased for better performance

  /**
   * Start dynamic processing for a set of files
   */
  async startDynamicProcessing(
    uploadFiles: any[],
    uploadFunction: (uploadFile: any) => Promise<void>,
    updateFunction: (updater: (prev: any[]) => any[]) => void,
    onProgress?: (stats: DynamicUploadStats) => void,
    sessionId?: string
  ): Promise<void> {
    const id = sessionId || `upload_${Date.now()}`;
    
    // Calculate optimal concurrency based on file count and size
    const maxConcurrent = this.calculateOptimalConcurrency(uploadFiles);
    
    const processor = new DynamicUploadProcessor(
      maxConcurrent,
      uploadFunction,
      updateFunction,
      onProgress
    );

    this.processors.set(id, processor);

    try {
      await processor.processDynamicUploads(uploadFiles);
    } finally {
      this.processors.delete(id);
    }
  }

  /**
   * Calculate optimal concurrency based on file characteristics
   */
  private calculateOptimalConcurrency(files: any[]): number {
    const totalSize = files.reduce((sum, file) => sum + file.file.size, 0);
    const avgSize = totalSize / files.length;
    
    // Adjust concurrency based on file size and count
    if (files.length <= 10) return Math.min(8, this.globalMaxConcurrent);
    if (files.length <= 50) return Math.min(12, this.globalMaxConcurrent);
    if (files.length <= 100) return Math.min(16, this.globalMaxConcurrent);
    
    // For large files, reduce concurrency
    if (avgSize > 10 * 1024 * 1024) { // > 10MB average
      return Math.min(8, this.globalMaxConcurrent);
    }
    
    return this.globalMaxConcurrent;
  }

  /**
   * Stop all processing
   */
  stopAll(): void {
    this.processors.forEach(processor => processor.stop());
    this.processors.clear();
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): { activeProcessors: number; totalConcurrent: number } {
    let totalConcurrent = 0;
    this.processors.forEach(processor => {
      const stats = processor.getStats();
      totalConcurrent += stats.uploading;
    });

    return {
      activeProcessors: this.processors.size,
      totalConcurrent
    };
  }
}

// Global instance
export const uploadQueueManager = new UploadQueueManager();




