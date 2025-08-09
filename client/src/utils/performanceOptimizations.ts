// Comprehensive performance optimizations initialization
import { performanceManager } from './performance';
import { imageOptimizer } from './imageOptimization';

// Register service worker for production caching
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, prompt user to update
              if (confirm('A new version of the app is available. Would you like to update?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Initialize all performance optimizations
export const initializePerformanceOptimizations = async () => {
  // Initialize performance manager
  performanceManager.init();
  
  // Register service worker
  await registerServiceWorker();
  
  // Preload critical resources
  preloadCriticalResources();
  
  // Setup performance monitoring
  setupPerformanceMonitoring();
  
  // Setup connection-aware strategies
  setupConnectionAwareStrategies();
  
  console.log('Performance optimizations initialized');
};

// Preload critical resources based on current page
const preloadCriticalResources = () => {
  const currentPath = window.location.pathname;
  
  // Preload critical fonts
  const fontLinks = [
    { href: '/fonts/inter-var.woff2', type: 'font/woff2' },
  ];
  
  fontLinks.forEach(font => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = font.type;
    link.href = font.href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
  
  // Page-specific resource preloading
  if (currentPath === '/events' || currentPath.includes('/events/')) {
    // Preload event-related resources
    imageOptimizer.preload([
      '/api/images/placeholder-event.webp'
    ], 'medium');
  }
  
  if (currentPath === '/admin') {
    // Preload admin dashboard resources
    const adminResources = [
      '/api/events/all',
      '/api/bookings/all',
      '/api/contacts/all'
    ];
    
    // These will be handled by React Query, just ensure they're prioritized
    adminResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = resource;
      document.head.appendChild(link);
    });
  }
};

// Setup performance monitoring
const setupPerformanceMonitoring = () => {
  // Monitor Core Web Vitals
  if ('web-vitals' in window) {
    // This would require the web-vitals library
    // For now, we'll use basic performance observers
  }
  
  // Monitor Long Tasks
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn('Long task detected:', entry.duration.toFixed(2), 'ms');
          }
        });
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      // PerformanceObserver not supported
    }
  }
  
  // Monitor layout shifts
  if ('PerformanceObserver' in window) {
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        
        if (clsValue > 0.1) { // CLS threshold
          console.warn('Cumulative Layout Shift detected:', clsValue.toFixed(4));
        }
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      // Layout shift observer not supported
    }
  }
};

// Setup connection-aware strategies
const setupConnectionAwareStrategies = () => {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    
    const updateStrategy = () => {
      const effectiveType = connection.effectiveType;
      
      // Adjust image quality based on connection
      const qualityMap: Record<string, number> = {
        'slow-2g': 40,
        '2g': 50,
        '3g': 70,
        '4g': 85
      };
      
      const quality = qualityMap[effectiveType] || 85;
      document.documentElement.style.setProperty('--image-quality', quality.toString());
      
      // Adjust animation preferences
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
    };
    
    connection.addEventListener('change', updateStrategy);
    updateStrategy();
  }
  
  // Handle online/offline states
  const updateOnlineStatus = () => {
    if (navigator.onLine) {
      document.documentElement.classList.remove('offline');
      document.documentElement.classList.add('online');
    } else {
      document.documentElement.classList.add('offline');
      document.documentElement.classList.remove('online');
    }
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
};

// Cleanup function for when the app unmounts
export const cleanupPerformanceOptimizations = () => {
  performanceManager.cleanup();
  imageOptimizer.cleanup();
};