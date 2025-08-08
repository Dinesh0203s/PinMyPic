import { useState, useEffect, useCallback, useRef } from 'react';
import { imagePreloader } from '@/utils/imagePreloader';

// Define ImagePreloader class for static methods
class ImagePreloader {
  static getFormatSupport(): { webp: boolean; avif: boolean } {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    return {
      webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
      avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
    };
  }
}

interface UseImageOptimizationOptions {
  preloadBatchSize?: number;
  cacheMaxSize?: number;
  connectionAware?: boolean;
  performanceMonitoring?: boolean;
}

interface ImageOptimizationState {
  isOptimizing: boolean;
  cacheSize: number;
  loadedImages: number;
  averageLoadTime: number;
  connectionType: string;
  formatSupport: { webp: boolean; avif: boolean };
}

export const useImageOptimization = (options: UseImageOptimizationOptions = {}) => {
  const {
    preloadBatchSize = 5,
    cacheMaxSize = 100,
    connectionAware = true,
    performanceMonitoring = true
  } = options;

  const [state, setState] = useState<ImageOptimizationState>({
    isOptimizing: false,
    cacheSize: 0,
    loadedImages: 0,
    averageLoadTime: 0,
    connectionType: 'unknown',
    formatSupport: { webp: false, avif: false }
  });

  const intervalRef = useRef<NodeJS.Timeout | undefined>();

  // Initialize optimization state
  useEffect(() => {
    const formatSupport = ImagePreloader.getFormatSupport();
    const connection = (navigator as any).connection;
    
    setState(prev => ({
      ...prev,
      formatSupport,
      connectionType: connection?.effectiveType || 'unknown'
    }));

    // Monitor cache size periodically
    if (performanceMonitoring) {
      intervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          cacheSize: imagePreloader.getCacheSize()
        }));
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [performanceMonitoring]);

  // Smart preload function
  const preloadImages = useCallback(async (
    imageSources: string[], 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    setState(prev => ({ ...prev, isOptimizing: true }));

    try {
      if (connectionAware) {
        await imagePreloader.preloadWithConnectionAwareness(imageSources, priority);
      } else {
        await imagePreloader.preloadBatch(imageSources, preloadBatchSize, priority);
      }
      
      // Optimize cache size
      imagePreloader.optimizeCache(cacheMaxSize);
      
    } catch (error) {
      console.error('Error preloading images:', error);
    } finally {
      setState(prev => ({ ...prev, isOptimizing: false }));
    }
  }, [connectionAware, preloadBatchSize, cacheMaxSize]);

  // Clear cache and reset state
  const clearCache = useCallback(() => {
    imagePreloader.clearCache();
    setState(prev => ({
      ...prev,
      cacheSize: 0,
      loadedImages: 0,
      averageLoadTime: 0
    }));
  }, []);

  // Get optimization recommendations
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (state.averageLoadTime > 2000) {
      recommendations.push('Consider reducing image quality or implementing progressive loading');
    }
    
    if (state.cacheSize > cacheMaxSize * 0.9) {
      recommendations.push('Cache is nearly full, consider clearing old entries');
    }
    
    if (state.connectionType === 'slow-2g' || state.connectionType === '2g') {
      recommendations.push('Slow connection detected, reducing preload aggressive behavior');
    }
    
    if (!state.formatSupport.webp) {
      recommendations.push('WebP not supported, fallback to JPEG optimization');
    }
    
    return recommendations;
  }, [state, cacheMaxSize]);

  return {
    state,
    preloadImages,
    clearCache,
    getRecommendations,
    isOptimizing: state.isOptimizing
  };
};