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
      maxWidth = 1920,
      maxHeight = 1080,
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
   * Compress multiple images in batch
   */
  async compressImages(
    files: File[], 
    options: CompressionOptions = {}
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    // Process images in batches to avoid overwhelming the browser
    const batchSize = 3;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(file => this.compressImage(file, options))
      );

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
    }

    return results;
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if image is too large
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
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
      maxWidth: 1920,
      maxHeight: 1080,
      format: isWebPSupported ? 'webp' : 'jpeg'
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
