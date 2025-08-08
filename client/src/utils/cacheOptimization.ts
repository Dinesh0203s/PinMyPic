// Enhanced caching utilities for better performance

interface CacheItem {
  data: any;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheItem> = new Map();
  private maxSize: number = 100;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// API response caching with intelligent invalidation
export const apiCache = CacheManager.getInstance();

// Automatic cleanup every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);

// Enhanced fetch with caching
export const cachedFetch = async (
  url: string, 
  options: RequestInit = {},
  cacheKey?: string,
  ttl: number = 5 * 60 * 1000
): Promise<any> => {
  const key = cacheKey || `fetch:${url}:${JSON.stringify(options)}`;
  
  // Check cache first
  const cached = apiCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache successful responses
    if (response.status === 200) {
      apiCache.set(key, data, ttl);
    }
    
    return data;
  } catch (error) {
    console.error('Cached fetch failed:', error);
    throw error;
  }
};

// Smart cache invalidation for related data
export const invalidateRelatedCache = (pattern: string): void => {
  const cache = apiCache as any;
  const keys = Array.from(cache.cache.keys());
  
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.cache.delete(key);
    }
  });
};