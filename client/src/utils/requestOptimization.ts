// Request optimization and batching for production
interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  retries?: number;
}

interface BatchRequestItem {
  id: string;
  url: string;
  options: RequestOptions;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export class RequestOptimizer {
  private static instance: RequestOptimizer;
  private requestQueue: BatchRequestItem[] = [];
  private inFlightRequests = new Map<string, Promise<any>>();
  private batchTimer: number | null = null;
  private readonly BATCH_DELAY = 10; // 10ms batch window
  private readonly MAX_CONCURRENT = 6; // Browser limit
  private activeRequests = 0;

  static getInstance(): RequestOptimizer {
    if (!this.instance) {
      this.instance = new RequestOptimizer();
    }
    return this.instance;
  }

  // Optimized request with deduplication and batching
  async request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    const requestKey = this.getRequestKey(url, options);

    // Check for in-flight duplicate requests
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const requestPromise = this.createOptimizedRequest<T>(url, options);
    this.inFlightRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  // Create optimized request with timeout and retries
  private async createOptimizedRequest<T>(url: string, options: RequestOptions): Promise<T> {
    const {
      timeout = 30000,
      retries = 2,
      priority = 'medium'
    } = options;

    // Wait for available slot if at max concurrent requests
    if (this.activeRequests >= this.MAX_CONCURRENT && priority !== 'high') {
      await this.waitForSlot();
    }

    this.activeRequests++;

    try {
      return await this.executeWithRetry<T>(url, options, retries, timeout);
    } finally {
      this.activeRequests--;
    }
  }

  private async executeWithRetry<T>(
    url: string, 
    options: RequestOptions, 
    retriesLeft: number, 
    timeout: number
  ): Promise<T> {
    try {
      return await this.fetchWithTimeout<T>(url, options, timeout);
    } catch (error: any) {
      if (retriesLeft > 0 && this.shouldRetry(error)) {
        // Exponential backoff
        const delay = Math.min(1000 * (2 ** (options.retries! - retriesLeft)), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry<T>(url, options, retriesLeft - 1, timeout);
      }
      throw error;
    }
  }

  private async fetchWithTimeout<T>(url: string, options: RequestOptions, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, 5xx errors, and timeouts
    return error.name === 'TypeError' || // Network error
           error.name === 'AbortError' || // Timeout
           (error.message && error.message.includes('500')) || // Server error
           (error.message && error.message.includes('502')) || // Bad gateway
           (error.message && error.message.includes('503')); // Service unavailable
  }

  private getRequestKey(url: string, options: RequestOptions): string {
    return `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || {})}`;
  }

  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.activeRequests < this.MAX_CONCURRENT) {
          resolve();
        } else {
          setTimeout(checkSlot, 50);
        }
      };
      checkSlot();
    });
  }

  // Batch similar requests together
  batchRequest<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      
      this.requestQueue.push({
        id,
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Schedule batch processing
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      this.batchTimer = window.setTimeout(() => {
        this.processBatch();
      }, this.BATCH_DELAY);
    });
  }

  private async processBatch(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const batch = [...this.requestQueue];
    this.requestQueue = [];

    // Group similar requests
    const grouped = this.groupSimilarRequests(batch);

    // Process each group
    await Promise.allSettled(
      Object.values(grouped).map(group => this.processBatchGroup(group))
    );
  }

  private groupSimilarRequests(batch: BatchRequestItem[]): Record<string, BatchRequestItem[]> {
    const groups: Record<string, BatchRequestItem[]> = {};

    batch.forEach(item => {
      const groupKey = `${item.options.method || 'GET'}:${item.url.split('?')[0]}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return groups;
  }

  private async processBatchGroup(group: BatchRequestItem[]): Promise<void> {
    // For now, process individually but this could be enhanced for true batching
    await Promise.allSettled(
      group.map(async item => {
        try {
          const result = await this.request(item.url, item.options);
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      })
    );
  }

  // Priority queue for high-priority requests
  priorityRequest<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, priority: 'high' });
  }

  // Cancel pending requests
  cancelPendingRequests(): void {
    this.requestQueue.forEach(item => {
      item.reject(new Error('Request cancelled'));
    });
    this.requestQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Get statistics
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      inFlightRequests: this.inFlightRequests.size,
      maxConcurrent: this.MAX_CONCURRENT
    };
  }
}

export const requestOptimizer = RequestOptimizer.getInstance();

// Utility functions for common use cases
export const optimizedFetch = <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
  return requestOptimizer.request<T>(url, options);
};

export const priorityFetch = <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
  return requestOptimizer.priorityRequest<T>(url, options);
};

export const batchFetch = <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
  return requestOptimizer.batchRequest<T>(url, options);
};