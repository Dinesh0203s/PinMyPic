class ImagePreloader {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  private loadingQueue: string[] = [];
  private maxConcurrent: number = 6;
  private currentLoading: number = 0;

  preloadImage(src: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.cache.has(src)) {
      return Promise.resolve(this.cache.get(src)!);
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    // Create new loading promise
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const loadImage = () => {
        this.currentLoading++;
        const img = new Image();
        
        const cleanup = () => {
          this.currentLoading--;
          this.loadingPromises.delete(src);
          this.processQueue();
        };
        
        img.onload = () => {
          this.cache.set(src, img);
          cleanup();
          resolve(img);
        };
        
        img.onerror = () => {
          cleanup();
          reject(new Error(`Failed to load image: ${src}`));
        };
        
        // Set decode hint for better performance
        img.decoding = 'async';
        
        // Add crossorigin for better caching
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
          img.crossOrigin = 'anonymous';
        }
        
        img.src = src;
      };

      // If we're under the concurrent limit, load immediately
      if (this.currentLoading < this.maxConcurrent) {
        loadImage();
      } else {
        // Add to queue based on priority
        if (priority === 'high') {
          this.loadingQueue.unshift(src);
        } else {
          this.loadingQueue.push(src);
        }
        
        // Store the loadImage function for later execution
        this.loadingPromises.set(src, new Promise((res, rej) => {
          (loadImage as any).resolve = res;
          (loadImage as any).reject = rej;
        }));
      }
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  private processQueue(): void {
    if (this.loadingQueue.length === 0 || this.currentLoading >= this.maxConcurrent) {
      return;
    }

    const src = this.loadingQueue.shift();
    if (src && this.loadingPromises.has(src)) {
      const promise = this.loadingPromises.get(src)!;
      // Execute the queued load
      this.preloadImage(src);
    }
  }

  preloadBatch(sources: string[], batchSize: number = 4, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<HTMLImageElement[]> {
    const batches: string[][] = [];
    
    // Split sources into batches
    for (let i = 0; i < sources.length; i += batchSize) {
      batches.push(sources.slice(i, i + batchSize));
    }

    // Process batches with intelligent scheduling
    return batches.reduce(async (prevPromise, batch, batchIndex) => {
      const results = await prevPromise;
      
      // Add delay between batches to prevent overwhelming
      if (batchIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const batchResults = await Promise.allSettled(
        batch.map(src => this.preloadImage(src, priority))
      );
      
      const successResults = batchResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<HTMLImageElement>).value);
      
      return [...results, ...successResults];
    }, Promise.resolve([] as HTMLImageElement[]));
  }

  // Smart preloading based on viewport and user behavior
  smartPreload(sources: string[], options: {
    immediate?: number;
    priority?: 'low' | 'medium' | 'high';
    prefetchOnHover?: boolean;
  } = {}): void {
    const { immediate = 3, priority = 'medium', prefetchOnHover = true } = options;
    
    // Immediately preload first few images
    const immediateImages = sources.slice(0, immediate);
    immediateImages.forEach(src => this.preloadImage(src, 'high'));
    
    // Preload remaining images with lower priority
    const remainingImages = sources.slice(immediate);
    if (remainingImages.length > 0) {
      // Use requestIdleCallback if available for non-critical preloading
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          this.preloadBatch(remainingImages, 2, priority);
        });
      } else {
        setTimeout(() => {
          this.preloadBatch(remainingImages, 2, priority);
        }, 1000);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.loadingQueue = [];
  }

  // Memory management for large galleries
  optimizeCache(maxSize: number = 50): void {
    if (this.cache.size <= maxSize) return;
    
    // Remove oldest entries (simple LRU)
    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, entries.length - maxSize);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  // Get image format support info
  static getFormatSupport(): { webp: boolean; avif: boolean } {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    return {
      webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
      avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
    };
  }

  // Preload with connection awareness
  preloadWithConnectionAwareness(sources: string[], priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const connection = (navigator as any).connection;
    let strategy = 'normal';
    
    if (connection) {
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        strategy = 'minimal';
      } else if (connection.effectiveType === '3g') {
        strategy = 'reduced';
      }
    }
    
    switch (strategy) {
      case 'minimal':
        // Only preload first 2 images on slow connections
        sources.slice(0, 2).forEach(src => this.preloadImage(src, priority));
        break;
      case 'reduced':
        // Preload first 5 images on 3G
        sources.slice(0, 5).forEach(src => this.preloadImage(src, priority));
        break;
      default:
        // Normal preloading with smaller batches
        this.smartPreload(sources, { immediate: 3, priority });
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  isImageCached(src: string): boolean {
    return this.cache.has(src);
  }
}

// Create singleton instance
export const imagePreloader = new ImagePreloader();

// Utility function for image optimization
export const getOptimizedImageUrl = (originalUrl: string, options: {
  thumbnail?: boolean;
  quality?: number;
  format?: 'webp' | 'avif' | 'original';
  download?: boolean;
} = {}) => {
  const { thumbnail = false, quality = 85, format = 'original', download = false } = options;
  
  const url = new URL(originalUrl, window.location.origin);
  
  if (thumbnail) {
    url.searchParams.set('thumbnail', 'true');
  }
  
  if (download) {
    url.searchParams.set('download', 'true');
  }
  
  if (quality !== 85) {
    url.searchParams.set('quality', quality.toString());
  }
  
  if (format !== 'original') {
    url.searchParams.set('format', format);
  }
  
  return url.toString();
};

// Generate display URL (compressed for viewing)
export const getDisplayImageUrl = (originalUrl: string, thumbnail: boolean = true) => {
  // For GridFS images, add thumbnail parameter for better quality
  if (originalUrl.startsWith('/api/images/')) {
    const url = new URL(originalUrl, window.location.origin);
    if (thumbnail) {
      url.searchParams.set('thumbnail', 'true');
    }
    return url.toString();
  }
  return getOptimizedImageUrl(originalUrl, {
    thumbnail: true, // Always use thumbnail for gallery previews
    quality: 90, // Higher quality for better visual appearance
    download: false
  });
};

// Generate download URL (original quality)
export const getDownloadImageUrl = (originalUrl: string) => {
  return getOptimizedImageUrl(originalUrl, {
    download: true
  });
};

