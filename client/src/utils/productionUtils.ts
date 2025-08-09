// Production utilities for optimized performance and error handling

// Environment detection
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// Error reporting for production
export const reportError = (error: Error, context?: string) => {
  if (isProduction) {
    // In production, you might want to send errors to a service like Sentry
    console.error('Production error:', error.message, { context, stack: error.stack });
  } else {
    console.error('Development error:', error, { context });
  }
};

// Performance measurement
export const measurePerformance = (name: string, fn: () => void) => {
  if ('performance' in window && 'measure' in performance) {
    performance.mark(`${name}-start`);
    fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    if (measure && isDevelopment) {
      console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  } else {
    fn();
  }
};

// Async performance measurement
export const measureAsyncPerformance = async <T>(
  name: string, 
  fn: () => Promise<T>
): Promise<T> => {
  if ('performance' in window && 'measure' in performance) {
    performance.mark(`${name}-start`);
    try {
      const result = await fn();
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      if (measure && isDevelopment) {
        console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      performance.mark(`${name}-error`);
      performance.measure(`${name}-failed`, `${name}-start`, `${name}-error`);
      throw error;
    }
  } else {
    return await fn();
  }
};

// Memory usage monitoring
export const getMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
    };
  }
  return null;
};

// Connection quality detection
export const getConnectionQuality = (): 'slow' | 'medium' | 'fast' => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    const effectiveType = connection.effectiveType;
    
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'slow';
    } else if (effectiveType === '3g') {
      return 'medium';
    } else {
      return 'fast';
    }
  }
  return 'fast'; // Default to fast if connection API not available
};

// Throttle function for performance
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T => {
  let inThrottle: boolean;
  return ((...args) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
};

// Debounce function for performance
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout;
  return ((...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  }) as T;
};

// Critical resource preloading
export const preloadCriticalResources = () => {
  if (isProduction) {
    // Preload critical CSS
    const criticalStyles = [
      '/assets/critical.css'
    ];
    
    criticalStyles.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = href;
      document.head.appendChild(link);
    });
  }
};

// Lazy loading intersection observer
export const createLazyLoadObserver = (
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
) => {
  if ('IntersectionObserver' in window) {
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry);
        }
      });
    }, {
      rootMargin: '10px',
      threshold: 0.1,
      ...options
    });
  }
  return null;
};

// Production-safe console logging
export const log = {
  info: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args);
    reportError(new Error(message), JSON.stringify(args));
  },
  success: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`✅ ${message}`, ...args);
    }
  }
};

// Safe JSON parsing
export const safeJsonParse = <T = any>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str);
  } catch (error) {
    log.error('JSON parse error:', str);
    return fallback;
  }
};

// Feature detection
export const features = {
  webp: () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  },
  
  serviceWorker: () => 'serviceWorker' in navigator,
  
  intersectionObserver: () => 'IntersectionObserver' in window,
  
  performanceObserver: () => 'PerformanceObserver' in window,
  
  connection: () => 'connection' in navigator,
  
  memory: () => 'memory' in performance
};