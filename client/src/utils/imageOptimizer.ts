// Image optimization utilities for better performance

export interface ImageOptimizationOptions {
  quality?: number;
  thumbnail?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export const getOptimizedImageUrl = (
  originalUrl: string, 
  options: ImageOptimizationOptions = {}
): string => {
  const { quality = 60, thumbnail = false, maxWidth, maxHeight } = options;
  
  // Check if it's already an API image URL
  if (originalUrl.includes('/api/images/')) {
    const url = new URL(originalUrl, window.location.origin);
    url.searchParams.set('quality', quality.toString());
    url.searchParams.set('thumbnail', thumbnail.toString());
    
    if (maxWidth) url.searchParams.set('width', maxWidth.toString());
    if (maxHeight) url.searchParams.set('height', maxHeight.toString());
    
    return url.toString();
  }
  
  return originalUrl;
};

export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

export const createImageLoadingWrapper = (src: string, alt: string) => {
  const container = document.createElement('div');
  container.className = 'relative';
  
  // Create loading skeleton
  const skeleton = document.createElement('div');
  skeleton.className = 'absolute inset-0 bg-gray-800/50 animate-pulse rounded-lg flex items-center justify-center';
  skeleton.innerHTML = '<div class="text-white text-sm">Loading...</div>';
  
  // Create image
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.className = 'max-w-full max-h-full object-contain transition-all duration-500 opacity-0';
  
  img.onload = () => {
    img.style.opacity = '1';
    skeleton.style.display = 'none';
  };
  
  img.onerror = () => {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Image not available</text></svg>';
    img.style.opacity = '1';
    skeleton.style.display = 'none';
  };
  
  container.appendChild(skeleton);
  container.appendChild(img);
  
  return container;
};

// Performance monitoring for images
export class ImagePerformanceMonitor {
  private static loadTimes: Map<string, number> = new Map();
  
  static startLoading(imageId: string): void {
    this.loadTimes.set(imageId, performance.now());
  }
  
  static endLoading(imageId: string): number {
    const startTime = this.loadTimes.get(imageId);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.loadTimes.delete(imageId);
      return duration;
    }
    return 0;
  }
  
  static getAverageLoadTime(): number {
    if (this.loadTimes.size === 0) return 0;
    const total = Array.from(this.loadTimes.values()).reduce((sum, time) => sum + time, 0);
    return total / this.loadTimes.size;
  }
}