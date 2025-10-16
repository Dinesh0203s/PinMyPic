/**
 * Compression Upload Queue
 * Handles sequential upload of compressed images with queue management
 */

export interface CompressionQueueItem {
  id: string;
  originalFile: File;
  compressedFile?: File;
  status: 'pending' | 'compressing' | 'compressed' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  compressionResult?: {
    compressionRatio: number;
    originalSize: number;
    compressedSize: number;
  };
}

export interface CompressionQueueStats {
  total: number;
  pending: number;
  compressing: number;
  compressed: number;
  uploading: number;
  completed: number;
  error: number;
  currentItem?: CompressionQueueItem;
}

export class CompressionUploadQueue {
  private queue: CompressionQueueItem[] = [];
  private isProcessing = false;
  private currentItem: CompressionQueueItem | null = null;
  private onProgress?: (stats: CompressionQueueStats) => void;
  private onItemUpdate?: (item: CompressionQueueItem) => void;
  private uploadFunction: (file: File) => Promise<void>;
  private compressionOptions: any;
  private activeCompressionTasks: Set<string> = new Set();
  private maxConcurrentCompressions: number;

  constructor(
    uploadFunction: (file: File) => Promise<void>,
    compressionOptions: any = {},
    onProgress?: (stats: CompressionQueueStats) => void,
    onItemUpdate?: (item: CompressionQueueItem) => void
  ) {
    this.uploadFunction = uploadFunction;
    this.compressionOptions = compressionOptions;
    this.onProgress = onProgress;
    this.onItemUpdate = onItemUpdate;
    this.maxConcurrentCompressions = this.getOptimalBatchSize();
  }

  /**
   * Add files to the compression queue
   */
  addFiles(files: File[]): CompressionQueueItem[] {
    const newItems: CompressionQueueItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      originalFile: file,
      status: 'pending',
      progress: 0
    }));

    this.queue.push(...newItems);
    this.updateStats();
    return newItems;
  }

  /**
   * Start processing the queue with dynamic pipeline processing
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Start the dynamic pipeline
      await this.runDynamicPipeline();
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
      this.updateStats();
    }
  }

  /**
   * Run dynamic pipeline - continuously process items as they become available
   */
  private async runDynamicPipeline(): Promise<void> {
    const activePromises = new Map<string, Promise<void>>();
    
    while (this.hasPendingItems() || activePromises.size > 0) {
      // Start new compressions if we have capacity and pending items
      while (activePromises.size < this.maxConcurrentCompressions && this.hasPendingItems()) {
        const nextItem = this.getNextPendingItem();
        if (nextItem) {
          const promise = this.processItemWithDynamicPipeline(nextItem);
          activePromises.set(nextItem.id, promise);
          
          // Remove promise when it completes
          promise.finally(() => {
            activePromises.delete(nextItem.id);
          });
        }
      }
      
      // Wait for at least one compression to complete
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
      
      // Small delay to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Process item with dynamic pipeline - compression and immediate upload
   */
  private async processItemWithDynamicPipeline(item: CompressionQueueItem): Promise<void> {
    try {
      // Add to active compression tasks
      this.activeCompressionTasks.add(item.id);
      
      // Step 1: Compress the image
      await this.compressItem(item);
      
      // Remove from active compression tasks
      this.activeCompressionTasks.delete(item.id);
      
      // Step 2: Immediately upload the compressed image (don't wait for batch)
      await this.uploadItem(item);
      
    } catch (error) {
      this.activeCompressionTasks.delete(item.id);
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      this.onItemUpdate?.(item);
    }
  }

  /**
   * Check if there are pending items
   */
  private hasPendingItems(): boolean {
    return this.queue.some(item => item.status === 'pending');
  }

  /**
   * Check if there are active compressions
   */
  private hasActiveCompressions(): boolean {
    return this.activeCompressionTasks.size > 0;
  }

  /**
   * Get next pending item
   */
  private getNextPendingItem(): CompressionQueueItem | null {
    return this.queue.find(item => item.status === 'pending') || null;
  }


  /**
   * Get optimal batch size based on device capabilities
   */
  private getOptimalBatchSize(): number {
    // Check available memory and CPU cores
    const memory = (navigator as any).deviceMemory || 4; // Default to 4GB
    const cores = navigator.hardwareConcurrency || 4; // Default to 4 cores
    
    // Adjust batch size based on device capabilities
    if (memory >= 8 && cores >= 8) {
      return 4; // High-end devices - process 4 images simultaneously
    } else if (memory >= 4 && cores >= 4) {
      return 3; // Mid-range devices - process 3 images simultaneously
    } else if (memory >= 2 && cores >= 2) {
      return 2; // Lower-end devices - process 2 images simultaneously
    } else {
      return 1; // Very low-end devices - process 1 image at a time
    }
  }

  /**
   * Process a single item through compression and upload
   */
  private async processItem(item: CompressionQueueItem): Promise<void> {
    try {
      // Step 1: Compress the image
      await this.compressItem(item);
      
      // Step 2: Upload the compressed image
      await this.uploadItem(item);
      
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      this.onItemUpdate?.(item);
    }
  }

  /**
   * Compress a single item
   */
  private async compressItem(item: CompressionQueueItem): Promise<void> {
    item.status = 'compressing';
    item.progress = 0;
    this.onItemUpdate?.(item);
    this.updateStats();

    try {
      // Import image compressor dynamically
      const { imageCompressor } = await import('./imageCompression');
      
      const compressionResult = await imageCompressor.compressImage(
        item.originalFile, 
        this.compressionOptions
      );

      item.compressedFile = compressionResult.compressedFile;
      item.compressionResult = {
        compressionRatio: compressionResult.compressionRatio,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize
      };
      
      item.status = 'compressed';
      item.progress = 50;
      this.onItemUpdate?.(item);
      this.updateStats();

    } catch (error) {
      // If compression fails, use original file
      item.compressedFile = item.originalFile;
      item.compressionResult = {
        compressionRatio: 0,
        originalSize: item.originalFile.size,
        compressedSize: item.originalFile.size
      };
      
      item.status = 'compressed';
      item.progress = 50;
      this.onItemUpdate?.(item);
      this.updateStats();
    }
  }

  /**
   * Upload a single item
   */
  private async uploadItem(item: CompressionQueueItem): Promise<void> {
    item.status = 'uploading';
    item.progress = 50;
    this.onItemUpdate?.(item);
    this.updateStats();

    try {
      const fileToUpload = item.compressedFile || item.originalFile;
      await this.uploadFunction(fileToUpload);
      
      item.status = 'completed';
      item.progress = 100;
      this.onItemUpdate?.(item);
      this.updateStats();

    } catch (error) {
      throw error; // Re-throw to be handled by processItem
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): CompressionQueueStats {
    const stats: CompressionQueueStats = {
      total: this.queue.length,
      pending: this.queue.filter(item => item.status === 'pending').length,
      compressing: this.queue.filter(item => item.status === 'compressing').length,
      compressed: this.queue.filter(item => item.status === 'compressed').length,
      uploading: this.queue.filter(item => item.status === 'uploading').length,
      completed: this.queue.filter(item => item.status === 'completed').length,
      error: this.queue.filter(item => item.status === 'error').length,
      currentItem: this.currentItem || undefined
    };

    return stats;
  }

  /**
   * Get dynamic pipeline information
   */
  getPipelineInfo(): {
    maxConcurrentCompressions: number;
    activeCompressions: number;
    isProcessing: boolean;
  } {
    return {
      maxConcurrentCompressions: this.maxConcurrentCompressions,
      activeCompressions: this.activeCompressionTasks.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Update statistics and notify listeners
   */
  private updateStats(): void {
    this.onProgress?.(this.getStats());
  }

  /**
   * Get all items in the queue
   */
  getItems(): CompressionQueueItem[] {
    return [...this.queue];
  }

  /**
   * Clear completed items from the queue
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(item => 
      item.status !== 'completed' && item.status !== 'error'
    );
    this.updateStats();
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.queue = [];
    this.currentItem = null;
    this.updateStats();
  }

  /**
   * Check if queue is processing
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get items by status
   */
  getItemsByStatus(status: CompressionQueueItem['status']): CompressionQueueItem[] {
    return this.queue.filter(item => item.status === status);
  }
}

