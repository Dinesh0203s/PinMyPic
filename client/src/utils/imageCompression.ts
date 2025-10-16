// Client-side image compression utility
export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'webp';
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export class ImageCompressor {
  private static instance: ImageCompressor;

  static getInstance(): ImageCompressor {
    if (!this.instance) {
      this.instance = new ImageCompressor();
    }
    return this.instance;
  }

  /**
   * Compress an image file using HTML5 Canvas
   */
  async compressImage(
    file: File, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const {
      quality = 0.8,
      maxWidth = 4000, // Increased default to allow higher resolution
      maxHeight = 4000, // Increased default to allow higher resolution
      format = 'jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = this.calculateDimensions(
            img.width, 
            img.height, 
            maxWidth, 
            maxHeight
          );

          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;

          // Draw and compress the image
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // Create new file with compressed data
              const compressedFile = new File(
                [blob], 
                file.name, 
                { 
                  type: format === 'webp' ? 'image/webp' : 'image/jpeg',
                  lastModified: Date.now()
                }
              );

              const originalSize = file.size;
              const compressedSize = compressedFile.size;
              const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

              resolve({
                compressedFile,
                originalSize,
                compressedSize,
                compressionRatio
              });
            },
            format === 'webp' ? 'image/webp' : 'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Load the image
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Compress multiple images in batch with multiprocessing
   */
  async compressImages(
    files: File[], 
    options: CompressionOptions = {}
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    // Determine optimal batch size based on device capabilities
    const batchSize = this.getOptimalBatchSize();
    const totalBatches = Math.ceil(files.length / batchSize);
    
    console.log(`Processing ${files.length} images in ${totalBatches} batches of ${batchSize} images each`);
    
    // Process images in parallel batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} images)`);
      
      // Process batch in parallel using Web Workers if available, otherwise Promise.all
      const batchResults = await this.processBatchParallel(batch, options);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to compress image ${batch[index].name}:`, result.reason);
          // Add original file as fallback
          results.push({
            compressedFile: batch[index],
            originalSize: batch[index].size,
            compressedSize: batch[index].size,
            compressionRatio: 0
          });
        }
      });
      
      // Small delay between batches to prevent browser freezing
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Process a batch of images in parallel
   */
  private async processBatchParallel(
    batch: File[], 
    options: CompressionOptions
  ): Promise<PromiseSettledResult<CompressionResult>[]> {
    // Use Promise.allSettled for parallel processing
    const promises = batch.map(file => this.compressImage(file, options));
    return Promise.allSettled(promises);
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
      return 6; // High-end devices
    } else if (memory >= 4 && cores >= 4) {
      return 4; // Mid-range devices
    } else if (memory >= 2 && cores >= 2) {
      return 3; // Lower-end devices
    } else {
      return 2; // Very low-end devices
    }
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   * Uses 64% of original resolution (more than half) for better quality
   */
  private calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    // Calculate 64% of original dimensions (more than half)
    const targetWidth = Math.round(originalWidth * 0.64);
    const targetHeight = Math.round(originalHeight * 0.64);

    let width = targetWidth;
    let height = targetHeight;

    // Ensure we don't exceed the maximum limits
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    // Don't upscale - if original is smaller than 64%, keep original size
    if (width > originalWidth) {
      width = originalWidth;
      height = originalHeight;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }

  /**
   * Check if WebP format is supported
   */
  isWebPSupported(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    try {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get optimal compression settings based on device capabilities
   */
  getOptimalSettings(): CompressionOptions {
    const connection = (navigator as any).connection;
    const isWebPSupported = this.isWebPSupported();
    
    // Adjust quality based on connection speed
    let quality = 0.8;
    if (connection) {
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          quality = 0.5;
          break;
        case '3g':
          quality = 0.6;
          break;
        case '4g':
          quality = 0.8;
          break;
        default:
          quality = 0.8;
      }
    }

    return {
      quality,
      maxWidth: 4000, // Increased to allow higher resolution
      maxHeight: 4000, // Increased to allow higher resolution
      format: isWebPSupported ? 'webp' : 'jpeg'
    };
  }

  /**
   * Get device performance information
   */
  getDevicePerformanceInfo(): {
    memory: number;
    cores: number;
    batchSize: number;
    recommendedParallelProcessing: boolean;
  } {
    const memory = (navigator as any).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const batchSize = this.getOptimalBatchSize();
    
    return {
      memory,
      cores,
      batchSize,
      recommendedParallelProcessing: cores >= 2 && memory >= 2
    };
  }

  /**
   * Get compression performance statistics
   */
  async getCompressionPerformanceStats(files: File[]): Promise<{
    estimatedTime: string;
    batchCount: number;
    batchSize: number;
    totalImages: number;
    deviceInfo: any;
  }> {
    const deviceInfo = this.getDevicePerformanceInfo();
    const batchSize = deviceInfo.batchSize;
    const batchCount = Math.ceil(files.length / batchSize);
    
    // Estimate time based on device capabilities and file sizes
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const avgFileSize = totalSize / files.length;
    
    // Rough estimation: 1MB per second for compression on average device
    const estimatedSeconds = (totalSize / (1024 * 1024)) / deviceInfo.cores;
    const estimatedTime = estimatedSeconds < 60 
      ? `${Math.round(estimatedSeconds)}s`
      : `${Math.round(estimatedSeconds / 60)}m ${Math.round(estimatedSeconds % 60)}s`;
    
    return {
      estimatedTime,
      batchCount,
      batchSize,
      totalImages: files.length,
      deviceInfo
    };
  }
}

// Export singleton instance
export const imageCompressor = ImageCompressor.getInstance();

// Utility function for easy compression
export const compressImageFile = async (
  file: File, 
  options?: CompressionOptions
): Promise<CompressionResult> => {
  return imageCompressor.compressImage(file, options);
};

// Utility function for batch compression
export const compressImageFiles = async (
  files: File[], 
  options?: CompressionOptions
): Promise<CompressionResult[]> => {
  return imageCompressor.compressImages(files, options);
};
