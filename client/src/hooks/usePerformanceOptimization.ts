import { useEffect, useCallback, useRef } from 'react';

// Performance monitoring and optimization hooks
export const usePerformanceOptimization = () => {
  const performanceObserver = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    // Monitor performance metrics
    if ('PerformanceObserver' in window) {
      performanceObserver.current = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Log slow operations for optimization
          if (entry.duration > 100) {
            console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });

      try {
        performanceObserver.current.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (e) {
        // Fallback for browsers that don't support all entry types
        console.warn('Performance monitoring not fully supported');
      }
    }

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect();
      }
    };
  }, []);

  // Debounced function factory for expensive operations
  const createDebouncedFunction = useCallback((fn: Function, delay: number = 300) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
  }, []);

  // Memory cleanup for large objects
  const cleanupMemory = useCallback(() => {
    // Force garbage collection if available (dev tools)
    if ((window as any).gc) {
      (window as any).gc();
    }
    
    // Clear inactive image caches periodically
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.usage && estimate.quota) {
          const usagePercent = (estimate.usage / estimate.quota) * 100;
          if (usagePercent > 80) {
            console.warn('High storage usage detected:', usagePercent + '%');
          }
        }
      });
    }
  }, []);

  return {
    createDebouncedFunction,
    cleanupMemory,
  };
};

// Resource preloading hook
export const useResourcePreloader = () => {
  const preloadResource = useCallback((href: string, as: string, type?: string) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    
    // Add to head
    document.head.appendChild(link);
    
    // Cleanup function
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  const preloadImage = useCallback((src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const preloadImages = useCallback(async (srcs: string[]) => {
    try {
      await Promise.all(srcs.map(src => preloadImage(src)));
    } catch (error) {
      console.warn('Some images failed to preload:', error);
    }
  }, [preloadImage]);

  return {
    preloadResource,
    preloadImage,
    preloadImages,
  };
};

// Connection-aware loading hook
export const useConnectionAware = () => {
  const getConnectionType = useCallback(() => {
    const connection = (navigator as any).connection;
    if (!connection) return 'unknown';
    
    return connection.effectiveType || connection.type || 'unknown';
  }, []);

  const shouldReduceQuality = useCallback(() => {
    const connection = (navigator as any).connection;
    if (!connection) return false;
    
    // Reduce quality on slow connections
    return ['slow-2g', '2g', '3g'].includes(connection.effectiveType) || 
           connection.saveData === true;
  }, []);

  const getOptimalImageQuality = useCallback(() => {
    return shouldReduceQuality() ? 60 : 85;
  }, [shouldReduceQuality]);

  const getBatchSize = useCallback(() => {
    return shouldReduceQuality() ? 2 : 5;
  }, [shouldReduceQuality]);

  return {
    getConnectionType,
    shouldReduceQuality,
    getOptimalImageQuality,
    getBatchSize,
  };
};