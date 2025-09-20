/**
 * Upload Optimization Utilities
 * Helps manage large batch photo uploads efficiently
 */

export interface UploadBatch {
  files: File[];
  batchId: string;
  size: number;
}

export class UploadOptimizer {
  private static instance: UploadOptimizer;
  
  private constructor() {}
  
  static getInstance(): UploadOptimizer {
    if (!UploadOptimizer.instance) {
      UploadOptimizer.instance = new UploadOptimizer();
    }
    return UploadOptimizer.instance;
  }

  /**
   * Creates optimal batches for file uploads based on browser capabilities
   */
  createOptimalBatches(files: File[], maxBatchSize = 20): UploadBatch[] {
    const batches: UploadBatch[] = [];
    
    // Calculate optimal batch size based on total files and memory constraints
    const optimalBatchSize = this.calculateOptimalBatchSize(files.length, maxBatchSize);
    
    for (let i = 0; i < files.length; i += optimalBatchSize) {
      const batchFiles = files.slice(i, i + optimalBatchSize);
      const batchSize = batchFiles.reduce((sum, file) => sum + file.size, 0);
      
      batches.push({
        files: batchFiles,
        batchId: `batch_${i / optimalBatchSize + 1}_${Date.now()}`,
        size: batchSize
      });
    }
    
    return batches;
  }

  /**
   * Calculates optimal batch size based on browser memory and file count
   */
  private calculateOptimalBatchSize(totalFiles: number, maxBatchSize: number): number {
    // Browser memory considerations
    const memoryInfo = (performance as any).memory;
    const availableMemory = memoryInfo ? memoryInfo.jsHeapSizeLimit - memoryInfo.usedJSHeapSize : null;
    
    if (totalFiles <= 20) return Math.min(10, maxBatchSize);
    if (totalFiles <= 50) return Math.min(15, maxBatchSize);
    if (totalFiles <= 100) return Math.min(20, maxBatchSize);
    if (totalFiles <= 500) return Math.min(15, maxBatchSize);
    if (totalFiles <= 1000) return Math.min(12, maxBatchSize);
    if (totalFiles <= 5000) return Math.min(10, maxBatchSize);
    
    // For extremely large uploads (5000+), still maintain good performance
    return Math.min(8, maxBatchSize);
  }

  /**
   * Adds delay between batches to prevent browser freezing
   */
  calculateBatchDelay(fileCount: number): number {
    if (fileCount <= 100) return 0; // No delay for small uploads
    if (fileCount <= 500) return 50; // Minimal delay
    if (fileCount <= 1000) return 100;
    if (fileCount <= 5000) return 150;
    return 200; // Reduced delay even for very large uploads
  }

  /**
   * Cleans up object URLs to prevent memory leaks
   */
  cleanupObjectUrls(urls: string[]): void {
    urls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  /**
   * Estimates total upload time based on file sizes and network conditions
   */
  estimateUploadTime(files: File[], averageSpeed = 1024 * 1024): string {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const estimatedSeconds = totalSize / averageSpeed;
    
    if (estimatedSeconds < 60) {
      return `~${Math.ceil(estimatedSeconds)} seconds`;
    } else if (estimatedSeconds < 3600) {
      return `~${Math.ceil(estimatedSeconds / 60)} minutes`;
    } else {
      return `~${Math.ceil(estimatedSeconds / 3600)} hours`;
    }
  }

  /**
   * Checks if browser can handle the upload size
   */
  canHandleUpload(files: File[]): { canHandle: boolean; reason?: string } {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 100 * 1024 * 1024 * 1024; // 100GB limit
    
    if (totalSize > maxSize) {
      return { 
        canHandle: false, 
        reason: `Total size (${(totalSize / 1024 / 1024 / 1024).toFixed(1)}GB) exceeds 100GB limit` 
      };
    }
    
    if (files.length > 10000) {
      return { 
        canHandle: false, 
        reason: `Too many files (${files.length}). Maximum 10,000 files allowed.` 
      };
    }
    
    return { canHandle: true };
  }
}

/**
 * Memory monitoring utility
 */
export class MemoryMonitor {
  private memoryWarningThreshold = 0.8; // 80% of available memory
  
  /**
   * Checks current memory usage and warns if approaching limits
   */
  checkMemoryUsage(): { usage: number; warning: boolean; critical: boolean } {
    const memoryInfo = (performance as any).memory;
    
    if (!memoryInfo) {
      return { usage: 0, warning: false, critical: false };
    }
    
    const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    
    return {
      usage: usageRatio,
      warning: usageRatio > this.memoryWarningThreshold,
      critical: usageRatio > 0.95
    };
  }

  /**
   * Forces garbage collection if available (Chrome DevTools)
   */
  forceGarbageCollection(): void {
    if ((window as any).gc) {
      (window as any).gc();
    }
  }
}