/**
 * Image processing optimizations for production deployment
 */

import sharp from 'sharp';
import { GridFSBucket } from 'mongodb';

// Optimized image processing settings
export const IMAGE_OPTIMIZATION_CONFIG = {
  // WebP compression for thumbnails
  webp: {
    quality: 85,
    effort: 4, // Balance between compression and speed
    smartSubsample: true
  },
  
  // JPEG fallback for older browsers
  jpeg: {
    quality: 85,
    progressive: true,
    mozjpeg: true
  },
  
  // Thumbnail sizes
  thumbnails: {
    small: { width: 300, height: 200 },
    medium: { width: 600, height: 400 },
    large: { width: 1200, height: 800 }
  },
  
  // Maximum original image size
  maxOriginalSize: {
    width: 4000,
    height: 3000
  }
};

// Optimized image processing pipeline
export class ImageProcessor {
  private gridFS: GridFSBucket;
  
  constructor(gridFS: GridFSBucket) {
    this.gridFS = gridFS;
  }

  async processImageOptimized(buffer: Buffer, filename: string): Promise<{
    original: Buffer;
    thumbnail: Buffer;
    metadata: any;
  }> {
    try {
      // Get image metadata first
      const metadata = await sharp(buffer).metadata();
      
      // Optimize original image if too large
      let originalBuffer = buffer;
      if (metadata.width! > IMAGE_OPTIMIZATION_CONFIG.maxOriginalSize.width ||
          metadata.height! > IMAGE_OPTIMIZATION_CONFIG.maxOriginalSize.height) {
        originalBuffer = await sharp(buffer)
          .resize(
            IMAGE_OPTIMIZATION_CONFIG.maxOriginalSize.width,
            IMAGE_OPTIMIZATION_CONFIG.maxOriginalSize.height,
            { fit: 'inside', withoutEnlargement: true }
          )
          .jpeg(IMAGE_OPTIMIZATION_CONFIG.jpeg)
          .toBuffer();
      }

      // Generate optimized thumbnail
      const thumbnailBuffer = await sharp(buffer)
        .resize(
          IMAGE_OPTIMIZATION_CONFIG.thumbnails.medium.width,
          IMAGE_OPTIMIZATION_CONFIG.thumbnails.medium.height,
          { fit: 'cover', position: 'center' }
        )
        .webp(IMAGE_OPTIMIZATION_CONFIG.webp)
        .toBuffer();

      return {
        original: originalBuffer,
        thumbnail: thumbnailBuffer,
        metadata: {
          ...metadata,
          optimized: true,
          thumbnailFormat: 'webp',
          originalSize: buffer.length,
          compressedSize: originalBuffer.length,
          compressionRatio: Math.round((1 - originalBuffer.length / buffer.length) * 100)
        }
      };
    } catch (error) {
      console.error('Image processing failed:', error);
      // Return original if processing fails
      return {
        original: buffer,
        thumbnail: buffer,
        metadata: { error: 'Processing failed' }
      };
    }
  }

  // Batch image processing with concurrency control
  async processBatchImages(images: Array<{ buffer: Buffer; filename: string }>, concurrency: number = 3): Promise<any[]> {
    const results: any[] = [];
    const batches = this.createBatches(images, concurrency);
    
    for (const batch of batches) {
      const batchPromises = batch.map(img => this.processImageOptimized(img.buffer, img.filename));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({
            filename: batch[index].filename,
            ...result.value
          });
        } else {
          results.push({
            filename: batch[index].filename,
            error: result.reason
          });
        }
      });
      
      // Small delay between batches to prevent overwhelming the system
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  private createBatches<T>(array: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }

  // Generate responsive image variants
  async generateResponsiveVariants(buffer: Buffer): Promise<{
    small: Buffer;
    medium: Buffer;
    large: Buffer;
  }> {
    const { thumbnails } = IMAGE_OPTIMIZATION_CONFIG;
    
    const [small, medium, large] = await Promise.all([
      sharp(buffer)
        .resize(thumbnails.small.width, thumbnails.small.height, { fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer(),
      
      sharp(buffer)
        .resize(thumbnails.medium.width, thumbnails.medium.height, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer(),
      
      sharp(buffer)
        .resize(thumbnails.large.width, thumbnails.large.height, { fit: 'inside' })
        .webp({ quality: 90 })
        .toBuffer()
    ]);
    
    return { small, medium, large };
  }
}

// Memory-efficient image streaming
export class ImageStreamer {
  private gridFS: GridFSBucket;
  
  constructor(gridFS: GridFSBucket) {
    this.gridFS = gridFS;
  }

  async streamOptimizedImage(photoId: string, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): Promise<NodeJS.ReadableStream> {
    try {
      // Try to get pre-generated thumbnail first
      const thumbnailId = `${photoId}_${size}`;
      const thumbnailStream = this.gridFS.openDownloadStreamByName(thumbnailId);
      
      return new Promise((resolve, reject) => {
        thumbnailStream.on('error', async () => {
          // If thumbnail doesn't exist, generate on-demand
          try {
            const originalStream = this.gridFS.openDownloadStreamByName(photoId);
            const chunks: Buffer[] = [];
            
            originalStream.on('data', chunk => chunks.push(chunk));
            originalStream.on('end', async () => {
              const buffer = Buffer.concat(chunks);
              const processor = new ImageProcessor(this.gridFS);
              
              // Generate the requested size
              let optimizedBuffer: Buffer;
              if (size === 'original') {
                optimizedBuffer = buffer;
              } else {
                const variants = await processor.generateResponsiveVariants(buffer);
                optimizedBuffer = variants[size];
              }
              
              // Store for future use
              const uploadStream = this.gridFS.openUploadStream(thumbnailId);
              uploadStream.end(optimizedBuffer);
              
              // Return stream for current request
              const { Readable } = await import('stream');
              const readable = new Readable();
              readable.push(optimizedBuffer);
              readable.push(null);
              
              resolve(readable);
            });
          } catch (genError) {
            reject(genError);
          }
        });
        
        thumbnailStream.on('file', () => resolve(thumbnailStream));
      });
    } catch (error) {
      throw new Error(`Failed to stream image: ${error}`);
    }
  }
}

// Image caching strategy
export class ImageCache {
  private cache = new Map<string, { buffer: Buffer; timestamp: number; size: number }>();
  private maxCacheSize = 100 * 1024 * 1024; // 100MB cache
  private currentCacheSize = 0;
  
  get(key: string): Buffer | null {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < 3600000) { // 1 hour TTL
      return item.buffer;
    }
    
    if (item) {
      this.currentCacheSize -= item.size;
      this.cache.delete(key);
    }
    
    return null;
  }
  
  set(key: string, buffer: Buffer): void {
    const size = buffer.length;
    
    // Don't cache images larger than 10MB
    if (size > 10 * 1024 * 1024) return;
    
    // Evict old items if cache is full
    while (this.currentCacheSize + size > this.maxCacheSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      const oldItem = this.cache.get(oldestKey!);
      if (oldItem) {
        this.currentCacheSize -= oldItem.size;
        this.cache.delete(oldestKey!);
      }
    }
    
    this.cache.set(key, {
      buffer,
      timestamp: Date.now(),
      size
    });
    
    this.currentCacheSize += size;
  }
  
  clear(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
  }
  
  getStats(): { size: number; count: number; maxSize: number } {
    return {
      size: this.currentCacheSize,
      count: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

export const imageCache = new ImageCache();