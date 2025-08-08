// API optimization utilities

import { cachedFetch } from './cacheOptimization';
import { networkManager } from './networkOptimization';

// Optimized API request with automatic retry and caching
export const optimizedApiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  cacheOptions: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    skipCache?: boolean;
  } = {}
): Promise<any> => {
  const { ttl = 5 * 60 * 1000, priority = 'medium', skipCache = false } = cacheOptions;

  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${window.location.origin}/api${url}`;

  try {
    if (skipCache) {
      return await networkManager.priorityRequest(
        () => fetch(fullUrl, options).then(res => res.json()),
        priority
      );
    }

    return await cachedFetch(fullUrl, options, `api:${url}`, ttl);
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
};

// Batch API requests to reduce network calls
export const batchApiRequests = async (
  requests: Array<{
    endpoint: string;
    options?: RequestInit;
    cacheOptions?: any;
  }>
): Promise<any[]> => {
  const results = await Promise.allSettled(
    requests.map(req => 
      optimizedApiRequest(req.endpoint, req.options, req.cacheOptions)
    )
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch request ${index} failed:`, result.reason);
      return null;
    }
  });
};

// Smart polling with exponential backoff
export class SmartPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private currentInterval: number;
  private maxInterval: number;
  private backoffMultiplier: number;

  constructor(
    private pollFn: () => Promise<any>,
    private initialInterval: number = 1000,
    maxInterval: number = 30000,
    backoffMultiplier: number = 1.5
  ) {
    this.currentInterval = initialInterval;
    this.maxInterval = maxInterval;
    this.backoffMultiplier = backoffMultiplier;
  }

  start(): void {
    if (this.intervalId) return;

    const poll = async () => {
      try {
        await this.pollFn();
        // Reset interval on success
        this.currentInterval = this.initialInterval;
      } catch (error) {
        console.warn('Poll failed, increasing interval:', error);
        // Increase interval on failure
        this.currentInterval = Math.min(
          this.currentInterval * this.backoffMultiplier,
          this.maxInterval
        );
      }

      this.intervalId = setTimeout(poll, this.currentInterval);
    };

    poll();
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      this.currentInterval = this.initialInterval;
    }
  }

  updateFunction(newPollFn: () => Promise<any>): void {
    this.pollFn = newPollFn;
  }
}

// Request deduplication for identical API calls
class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Return existing promise if request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request and store promise
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const requestDeduplicator = new RequestDeduplicator();