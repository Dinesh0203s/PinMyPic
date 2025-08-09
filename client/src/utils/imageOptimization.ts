// Image optimization utilities for production
interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  lazy?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private loadedImages = new Set<string>();
  private preloadQueue: string[] = [];
  private isProcessingQueue = false;

  static getInstance(): ImageOptimizer {
    if (!this.instance) {
      this.instance = new ImageOptimizer();
    }
    return this.instance;
  }

  // Optimize image URL with parameters
  getOptimizedUrl(src: string, options: ImageOptimizationOptions = {}): string {
    if (!src) return '';

    const {
      quality = 85,
      format = 'webp',
      width,
      height,
      priority = 'medium'
    } = options;

    // For GridFS images, add optimization parameters
    if (src.startsWith('/api/images/')) {
      const url = new URL(src, window.location.origin);
      
      if (quality !== 85) url.searchParams.set('quality', quality.toString());
      if (width) url.searchParams.set('width', width.toString());
      if (height) url.searchParams.set('height', height.toString());
      if (format !== 'jpeg') url.searchParams.set('format', format);
      
      return url.toString();
    }

    return src;
  }

  // Intelligent lazy loading with intersection observer
  setupLazyLoading(img: HTMLImageElement, src: string, options: ImageOptimizationOptions = {}) {
    const { priority = 'medium', lazy = true } = options;

    if (!lazy || priority === 'high') {
      // Load immediately for high priority images
      this.loadImage(img, src, options);
      return;
    }

    // Use intersection observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target as HTMLImageElement, src, options);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    );

    observer.observe(img);
  }

  // Progressive image loading with blur-up technique
  loadProgressively(
    img: HTMLImageElement,
    fullSrc: string,
    thumbnailSrc?: string,
    options: ImageOptimizationOptions = {}
  ) {
    const { priority = 'medium' } = options;

    // Show thumbnail first if available
    if (thumbnailSrc && priority !== 'high') {
      img.src = thumbnailSrc;
      img.style.filter = 'blur(5px)';
      img.style.transition = 'filter 0.3s ease';

      // Load full image
      const fullImage = new Image();
      fullImage.onload = () => {
        img.src = fullSrc;
        img.style.filter = 'none';
        this.loadedImages.add(fullSrc);
      };
      fullImage.src = this.getOptimizedUrl(fullSrc, options);
    } else {
      // Direct loading for high priority or no thumbnail
      this.loadImage(img, fullSrc, options);
    }
  }

  // Load image with error handling and caching
  private loadImage(img: HTMLImageElement, src: string, options: ImageOptimizationOptions = {}) {
    const optimizedSrc = this.getOptimizedUrl(src, options);

    if (this.loadedImages.has(optimizedSrc)) {
      img.src = optimizedSrc;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const tempImage = new Image();
      
      tempImage.onload = () => {
        img.src = optimizedSrc;
        this.loadedImages.add(optimizedSrc);
        resolve();
      };

      tempImage.onerror = () => {
        // Fallback to original source
        img.src = src;
        reject(new Error(`Failed to load image: ${optimizedSrc}`));
      };

      tempImage.src = optimizedSrc;
    });
  }

  // Preload critical images
  preload(sources: string[], priority: 'high' | 'medium' | 'low' = 'medium') {
    const prioritySources = sources.filter(src => !this.loadedImages.has(src));
    
    if (priority === 'high') {
      // Load immediately
      prioritySources.forEach(src => this.preloadImage(src));
    } else {
      // Add to queue
      this.preloadQueue.push(...prioritySources);
      this.processPreloadQueue();
    }
  }

  private preloadImage(src: string) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);

    // Clean up after a delay
    setTimeout(() => {
      document.head.removeChild(link);
    }, 5000);
  }

  private async processPreloadQueue() {
    if (this.isProcessingQueue || this.preloadQueue.length === 0) return;

    this.isProcessingQueue = true;

    // Process queue in batches to avoid overwhelming the browser
    const batchSize = 3;
    while (this.preloadQueue.length > 0) {
      const batch = this.preloadQueue.splice(0, batchSize);
      
      await Promise.allSettled(
        batch.map(src => this.preloadImage(src))
      );

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessingQueue = false;
  }

  // Format detection for best browser support
  getSupportedFormat(): 'webp' | 'jpeg' {
    // Check WebP support
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    try {
      const webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      return webpSupported ? 'webp' : 'jpeg';
    } catch {
      return 'jpeg';
    }
  }

  // Connection-aware image quality
  getOptimalQuality(): number {
    const connection = (navigator as any).connection;
    
    if (!connection) return 85;

    switch (connection.effectiveType) {
      case 'slow-2g':
        return 50;
      case '2g':
        return 60;
      case '3g':
        return 75;
      case '4g':
        return 85;
      default:
        return 85;
    }
  }

  // Viewport-aware sizing
  getOptimalSize(originalWidth: number, originalHeight: number): { width: number; height: number } {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const viewportWidth = window.innerWidth * devicePixelRatio;
    const viewportHeight = window.innerHeight * devicePixelRatio;

    // Don't upscale images
    const maxWidth = Math.min(originalWidth, viewportWidth);
    const maxHeight = Math.min(originalHeight, viewportHeight);

    // Maintain aspect ratio
    const aspectRatio = originalWidth / originalHeight;
    
    if (maxWidth / aspectRatio <= maxHeight) {
      return {
        width: maxWidth,
        height: Math.round(maxWidth / aspectRatio)
      };
    } else {
      return {
        width: Math.round(maxHeight * aspectRatio),
        height: maxHeight
      };
    }
  }

  // Cleanup
  cleanup() {
    this.loadedImages.clear();
    this.preloadQueue = [];
    this.isProcessingQueue = false;
  }
}

export const imageOptimizer = ImageOptimizer.getInstance();

// Utility functions
export const getDisplayImageUrl = (src: string, isThumbnail = false): string => {
  const quality = imageOptimizer.getOptimalQuality();
  const format = imageOptimizer.getSupportedFormat();
  
  return imageOptimizer.getOptimizedUrl(src, {
    quality: isThumbnail ? Math.max(quality - 20, 40) : quality,
    format,
    lazy: !isThumbnail
  });
};

export const preloadCriticalImages = (sources: string[]) => {
  imageOptimizer.preload(sources, 'high');
};