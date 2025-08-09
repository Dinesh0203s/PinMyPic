// Performance utilities for production optimization
export class PerformanceManager {
  private static instance: PerformanceManager;
  private observers: Map<string, IntersectionObserver | ResizeObserver> = new Map();
  private memoryCleanupInterval: number | null = null;
  private lastCleanup = Date.now();
  
  static getInstance(): PerformanceManager {
    if (!this.instance) {
      this.instance = new PerformanceManager();
    }
    return this.instance;
  }

  // Initialize performance monitoring
  init() {
    this.setupMemoryManagement();
    this.setupConnectionMonitoring();
    this.setupImagePreloading();
  }

  // Memory management for large image galleries
  private setupMemoryManagement() {
    // Cleanup every 60 seconds
    this.memoryCleanupInterval = window.setInterval(() => {
      this.performMemoryCleanup();
    }, 60000);

    // Cleanup on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performMemoryCleanup();
      }
    });
  }

  private performMemoryCleanup() {
    try {
      // Clean up blob URLs
      this.cleanupBlobUrls();
      
      // Force garbage collection if available (development only)
      if (window.gc && process.env.NODE_ENV === 'development') {
        window.gc();
      }
      
      this.lastCleanup = Date.now();
      console.log('Memory cleanup performed');
    } catch (error) {
      console.warn('Memory cleanup failed:', error);
    }
  }

  private cleanupBlobUrls() {
    // Implementation would track and cleanup blob URLs
    // This is a placeholder for blob URL management
  }

  // Connection-aware loading
  private setupConnectionMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnectionStrategy = () => {
        const effectiveType = connection.effectiveType;
        
        // Adjust quality based on connection speed
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          document.documentElement.setAttribute('data-connection', 'slow');
        } else if (effectiveType === '3g') {
          document.documentElement.setAttribute('data-connection', 'medium');
        } else {
          document.documentElement.setAttribute('data-connection', 'fast');
        }
      };

      connection.addEventListener('change', updateConnectionStrategy);
      updateConnectionStrategy();
    }
  }

  // Intelligent image preloading
  private setupImagePreloading() {
    const preloadedImages = new Set<string>();
    
    this.createIntersectionObserver('preload', (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.preloadSrc;
          
          if (src && !preloadedImages.has(src)) {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'image';
            preloadLink.href = src;
            document.head.appendChild(preloadLink);
            
            preloadedImages.add(src);
          }
        }
      });
    }, { rootMargin: '200px' });
  }

  // Create reusable intersection observers
  createIntersectionObserver(
    key: string,
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    if (this.observers.has(key)) {
      return this.observers.get(key) as IntersectionObserver;
    }

    const observer = new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });

    this.observers.set(key, observer);
    return observer;
  }

  // Optimize image loading based on viewport
  optimizeImageLoading(img: HTMLImageElement, src: string, thumbnailSrc?: string) {
    const connection = (navigator as any).connection;
    const isSlowConnection = connection && 
      (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

    // Use thumbnail for slow connections
    if (isSlowConnection && thumbnailSrc) {
      img.src = thumbnailSrc;
      img.dataset.fullSrc = src;
      
      // Load full image on interaction
      img.addEventListener('click', () => {
        img.src = src;
      }, { once: true });
    } else {
      img.src = src;
    }
  }

  // Batch DOM updates
  batchDOMUpdates(updates: (() => void)[]) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
    }
  }
}

// Performance timing utilities
export const timing = {
  mark: (name: string) => {
    if ('performance' in window) {
      performance.mark(name);
    }
  },

  measure: (name: string, startMark: string, endMark?: string) => {
    if ('performance' in window) {
      performance.measure(name, startMark, endMark);
      return performance.getEntriesByName(name, 'measure')[0];
    }
    return null;
  },

  getMetrics: () => {
    if ('performance' in window) {
      return {
        navigation: performance.getEntriesByType('navigation')[0],
        paint: performance.getEntriesByType('paint'),
        memory: (performance as any).memory
      };
    }
    return null;
  }
};

// Initialize performance manager
export const performanceManager = PerformanceManager.getInstance();