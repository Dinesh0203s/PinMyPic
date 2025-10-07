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
   * Start processing the queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const nextItem = this.queue.find(item => item.status === 'pending');
        if (!nextItem) {
          break;
        }

        this.currentItem = nextItem;
        await this.processItem(nextItem);
      }
    } finally {
      this.isProcessing = false;
      this.currentItem = null;
      this.updateStats();
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
