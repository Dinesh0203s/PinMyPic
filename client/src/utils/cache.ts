// Advanced caching system for production optimization
interface CacheItem<T> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
  size: number;
}

interface CacheOptions {
  maxSize: number; // Maximum cache size in bytes
  maxAge: number; // Maximum age in milliseconds
  maxItems: number; // Maximum number of items
}

export class AdvancedCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private totalSize = 0;
  private options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxSize: 50 * 1024 * 1024, // 50MB default
      maxAge: 30 * 60 * 1000, // 30 minutes default
      maxItems: 1000, // 1000 items default
      ...options
    };

    // Periodic cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  set(key: string, data: T, customTTL?: number): void {
    const size = this.calculateSize(data);
    const now = Date.now();
    
    // Remove existing item if updating
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.totalSize -= existing.size;
    }

    const item: CacheItem<T> = {
      data,
      timestamp: now,
      hits: 0,
      lastAccessed: now,
      size
    };

    // Check if we need to make space
    this.makeSpace(size);

    this.cache.set(key, item);
    this.totalSize += size;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - item.timestamp > this.options.maxAge) {
      this.delete(key);
      return null;
    }

    // Update access statistics
    item.hits++;
    item.lastAccessed = now;

    return item.data;
  }

  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.totalSize -= item.size;
      return this.cache.delete(key);
    }
    return false;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if expired
    if (Date.now() - item.timestamp > this.options.maxAge) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  // LRU eviction with size consideration
  private makeSpace(requiredSize: number): void {
    // If single item is too large, don't cache it
    if (requiredSize > this.options.maxSize * 0.5) {
      return;
    }

    // Evict items if we exceed limits
    while (
      this.totalSize + requiredSize > this.options.maxSize ||
      this.cache.size >= this.options.maxItems
    ) {
      const lruKey = this.findLRU();
      if (lruKey) {
        this.delete(lruKey);
      } else {
        break; // Safety break
      }
    }
  }

  private findLRU(): string | null {
    let lruKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((item, key) => {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        lruKey = key;
      }
    });

    return lruKey;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > this.options.maxAge) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));
  }

  private calculateSize(data: T): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      const str = String(data);
      return str.length * 2; // Rough estimate for UTF-16
    }
  }

  getStats() {
    const items = Array.from(this.cache.values());
    
    return {
      size: this.cache.size,
      totalSize: this.totalSize,
      totalHits: items.reduce((sum, item) => sum + item.hits, 0),
      averageAge: items.length > 0 ? 
        (Date.now() - items.reduce((sum, item) => sum + item.timestamp, 0) / items.length) : 0,
      memoryUsage: `${(this.totalSize / 1024 / 1024).toFixed(2)}MB`
    };
  }
}

// Global cache instances
export const apiCache = new AdvancedCache({
  maxSize: 20 * 1024 * 1024, // 20MB for API responses
  maxAge: 10 * 60 * 1000, // 10 minutes
  maxItems: 500
});

export const imageCache = new AdvancedCache({
  maxSize: 100 * 1024 * 1024, // 100MB for image data
  maxAge: 60 * 60 * 1000, // 1 hour
  maxItems: 200
});

export const userCache = new AdvancedCache({
  maxSize: 5 * 1024 * 1024, // 5MB for user data
  maxAge: 30 * 60 * 1000, // 30 minutes
  maxItems: 100
});