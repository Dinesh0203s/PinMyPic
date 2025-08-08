// Network optimization utilities

export class NetworkManager {
  private static instance: NetworkManager;
  private requestQueue: Array<() => Promise<any>> = [];
  private isOnline: boolean = navigator.onLine;
  private connectionType: string = 'unknown';
  private maxConcurrentRequests: number = 6;
  private activeRequests: number = 0;

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  constructor() {
    // Monitor connection changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Monitor connection type changes
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', () => {
        this.connectionType = connection.effectiveType || 'unknown';
        this.adjustConcurrency();
      });
      this.connectionType = connection.effectiveType || 'unknown';
      this.adjustConcurrency();
    }
  }

  private adjustConcurrency(): void {
    switch (this.connectionType) {
      case 'slow-2g':
      case '2g':
        this.maxConcurrentRequests = 2;
        break;
      case '3g':
        this.maxConcurrentRequests = 4;
        break;
      case '4g':
      default:
        this.maxConcurrentRequests = 6;
        break;
    }
  }

  async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (!this.isOnline) {
          reject(new Error('Network offline'));
          return;
        }

        if (this.activeRequests >= this.maxConcurrentRequests) {
          // Queue the request
          this.requestQueue.push(execute);
          return;
        }

        this.activeRequests++;
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      execute();
    });
  }

  private processQueue(): void {
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  // Prioritized request handling
  async priorityRequest<T>(requestFn: () => Promise<T>, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<T> {
    if (priority === 'high') {
      // Execute high priority requests immediately
      return this.queueRequest(requestFn);
    }

    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          const result = await this.queueRequest(requestFn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (priority === 'low') {
        // Use requestIdleCallback for low priority
        if ((window as any).requestIdleCallback) {
          (window as any).requestIdleCallback(execute, { timeout: 5000 });
        } else {
          setTimeout(execute, 100);
        }
      } else {
        execute();
      }
    });
  }

  // Batch similar requests
  private batchedRequests: Map<string, {
    requests: Array<{ resolve: Function; reject: Function }>;
    timeout: NodeJS.Timeout;
  }> = new Map();

  async batchRequest<T>(key: string, requestFn: () => Promise<T[]>, delay: number = 50): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const existing = this.batchedRequests.get(key);
      
      if (existing) {
        // Add to existing batch
        existing.requests.push({ resolve, reject });
      } else {
        // Create new batch
        const requests = [{ resolve, reject }];
        const timeout = setTimeout(async () => {
          this.batchedRequests.delete(key);
          try {
            const results = await requestFn();
            requests.forEach(req => req.resolve(results));
          } catch (error) {
            requests.forEach(req => req.reject(error));
          }
        }, delay);

        this.batchedRequests.set(key, { requests, timeout });
      }
    });
  }

  getConnectionInfo() {
    return {
      online: this.isOnline,
      type: this.connectionType,
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.maxConcurrentRequests,
    };
  }
}

export const networkManager = NetworkManager.getInstance();

// Enhanced fetch with network optimization
export const optimizedFetch = async (
  url: string,
  options: RequestInit = {},
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<Response> => {
  return networkManager.priorityRequest(
    () => fetch(url, {
      ...options,
      // Add network-aware headers
      headers: {
        ...options.headers,
        'Connection': 'keep-alive',
        'Cache-Control': networkManager.getConnectionInfo().type === 'slow-2g' ? 'max-age=3600' : 'max-age=300',
      },
    }),
    priority
  );
};