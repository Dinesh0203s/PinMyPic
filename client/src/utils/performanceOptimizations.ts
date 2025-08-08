// Comprehensive performance optimizations

import { networkManager } from './networkOptimization';
import { apiCache } from './cacheOptimization';

// Image loading optimization
export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private loadingImages: Map<string, Promise<HTMLImageElement>> = new Map();
  private intersectionObserver?: IntersectionObserver;

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  constructor() {
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              const src = img.dataset.src;
              if (src) {
                this.loadImage(src).then(loadedImg => {
                  img.src = loadedImg.src;
                  img.classList.add('loaded');
                });
                this.intersectionObserver?.unobserve(img);
              }
            }
          });
        },
        {
          rootMargin: '50px 0px',
          threshold: 0.01,
        }
      );
    }
  }

  async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.loadingImages.has(src)) {
      return this.loadingImages.get(src)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.decoding = 'async';
      img.src = src;
    });

    this.loadingImages.set(src, promise);
    
    try {
      const img = await promise;
      this.loadingImages.delete(src);
      return img;
    } catch (error) {
      this.loadingImages.delete(src);
      throw error;
    }
  }

  observeImage(img: HTMLImageElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(img);
    }
  }
}

// Memory management utilities
export class MemoryManager {
  private static cleanupInterval: NodeJS.Timeout;
  private static memoryThreshold = 50 * 1024 * 1024; // 50MB

  static startMonitoring(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  static stopMonitoring(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private static performCleanup(): void {
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize > this.memoryThreshold) {
      // Clear API cache partially
      apiCache.cleanup();
      
      // Clear image cache if available
      const imageOptimizer = ImageOptimizer.getInstance();
      
      // Force garbage collection in dev tools
      if ((window as any).gc) {
        (window as any).gc();
      }

      console.log('Memory cleanup performed');
    }
  }

  static getMemoryInfo() {
    const memory = (performance as any).memory;
    return memory ? {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
    } : null;
  }
}

// Performance monitoring
export class PerformanceTracker {
  private static marks: Map<string, number> = new Map();

  static mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  static measure(name: string, startMark: string): number | null {
    const start = this.marks.get(startMark);
    if (!start) return null;

    const duration = performance.now() - start;
    console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    
    // Clean up old marks
    this.marks.delete(startMark);
    
    return duration;
  }

  static async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      console.log(`Async Performance: ${name} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.log(`Async Performance (Error): ${name} took ${duration.toFixed(2)}ms`);
      throw error;
    }
  }
}

// Initialize optimizations
export const initializePerformanceOptimizations = async () => {
  // Start memory monitoring
  MemoryManager.startMonitoring();
  
  // Initialize image optimizer
  ImageOptimizer.getInstance();
  
  // Register service worker for caching
  const { registerServiceWorker } = await import('./bundleOptimization');
  await registerServiceWorker();
  
  // Preload critical routes on interaction
  const { preloadCriticalRoutes } = await import('./bundleOptimization');
  preloadCriticalRoutes();
  
  // Set up performance observers
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming;
            console.log('Navigation timing:', {
              DNS: nav.domainLookupEnd - nav.domainLookupStart,
              TCP: nav.connectEnd - nav.connectStart,
              Request: nav.responseStart - nav.requestStart,
              Response: nav.responseEnd - nav.responseStart,
              DOM: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
              Load: nav.loadEventEnd - nav.loadEventStart,
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('Performance observer not fully supported');
    }
  }
  
  console.log('Performance optimizations initialized');
};

// Cleanup function
export const cleanupPerformanceOptimizations = () => {
  MemoryManager.stopMonitoring();
};