/**
 * API response optimizations for production deployment
 */

import type { Request, Response, NextFunction } from 'express';

// Response compression and optimization
export class APIOptimizer {
  // Optimize JSON responses
  static optimizeJSON(data: any, options: {
    removeEmpty?: boolean;
    compactArrays?: boolean;
    maxDepth?: number;
  } = {}): any {
    const { removeEmpty = true, compactArrays = true, maxDepth = 10 } = options;
    
    const optimize = (obj: any, depth: number = 0): any => {
      if (depth > maxDepth) return obj;
      
      if (Array.isArray(obj)) {
        const optimized = obj.map(item => optimize(item, depth + 1));
        return compactArrays ? optimized.filter(item => item !== null && item !== undefined) : optimized;
      }
      
      if (obj && typeof obj === 'object') {
        const optimized: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
          const optimizedValue = optimize(value, depth + 1);
          
          if (removeEmpty) {
            // Skip empty values
            if (optimizedValue === null || optimizedValue === undefined || optimizedValue === '') {
              continue;
            }
            
            // Skip empty arrays and objects
            if (Array.isArray(optimizedValue) && optimizedValue.length === 0) {
              continue;
            }
            
            if (typeof optimizedValue === 'object' && Object.keys(optimizedValue).length === 0) {
              continue;
            }
          }
          
          optimized[key] = optimizedValue;
        }
        
        return optimized;
      }
      
      return obj;
    };
    
    return optimize(data);
  }

  // Paginate large datasets efficiently
  static paginateResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total?: number
  ): {
    data: T[];
    pagination: {
      current: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    const totalItems = total || data.length;
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      data: paginatedData,
      pagination: {
        current: page,
        limit,
        total: totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Optimize database queries for API endpoints
  static optimizeQuery(query: any): any {
    const optimized: any = {};
    
    // Convert string booleans
    Object.entries(query).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (value === 'true') {
          optimized[key] = true;
        } else if (value === 'false') {
          optimized[key] = false;
        } else if (!isNaN(Number(value))) {
          optimized[key] = Number(value);
        } else {
          optimized[key] = value;
        }
      } else {
        optimized[key] = value;
      }
    });
    
    return optimized;
  }
}

// Response caching middleware
export function createResponseCache(ttl: number = 300000) { // 5 minutes default
  const cache = new Map<string, { data: any; timestamp: number; etag: string }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      // Check if client has the same version
      if (req.headers['if-none-match'] === cached.etag) {
        return res.status(304).end();
      }
      
      res.set('ETag', cached.etag);
      res.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
      return res.json(cached.data);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      const etag = `"${Date.now()}-${JSON.stringify(data).length}"`;
      cache.set(key, {
        data: APIOptimizer.optimizeJSON(data),
        timestamp: Date.now(),
        etag
      });
      
      res.set('ETag', etag);
      res.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
      
      return originalJson(data);
    };
    
    next();
  };
}

// Batch request handler
export class BatchRequestHandler {
  static async handleBatchRequests<T>(
    requests: Array<() => Promise<T>>,
    options: {
      concurrency?: number;
      failFast?: boolean;
      timeout?: number;
    } = {}
  ): Promise<Array<T | Error>> {
    const { concurrency = 5, failFast = false, timeout = 30000 } = options;
    const results: Array<T | Error> = [];
    
    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (request, index) => {
        try {
          // Add timeout to each request
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), timeout);
          });
          
          const result = await Promise.race([request(), timeoutPromise]);
          return { index: i + index, result, error: null };
        } catch (error) {
          if (failFast) throw error;
          return { index: i + index, result: null, error: error as Error };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { index, result: data, error } = result.value;
          results[index] = error || data;
        } else {
          results[i] = result.reason;
        }
      });
    }
    
    return results;
  }
}

// API response formatter
export function formatAPIResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  metadata?: any
): {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: any;
  timestamp: string;
} {
  const response: any = {
    success,
    timestamp: new Date().toISOString()
  };
  
  if (success && data !== undefined) {
    response.data = APIOptimizer.optimizeJSON(data);
  }
  
  if (!success && error) {
    response.error = error;
  }
  
  if (metadata) {
    response.metadata = metadata;
  }
  
  return response;
}

// Field selection middleware (like GraphQL field selection)
export function createFieldSelector() {
  return (req: Request, res: Response, next: NextFunction) => {
    const fields = req.query.fields as string;
    
    if (fields) {
      const selectedFields = fields.split(',').map(f => f.trim());
      
      // Override res.json to filter fields
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        const filteredData = filterFields(data, selectedFields);
        return originalJson(filteredData);
      };
    }
    
    next();
  };
}

function filterFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) {
    return data.map(item => filterFields(item, fields));
  }
  
  if (data && typeof data === 'object') {
    const filtered: any = {};
    
    fields.forEach(field => {
      if (field.includes('.')) {
        // Handle nested fields
        const [parent, ...rest] = field.split('.');
        if (data[parent]) {
          if (!filtered[parent]) filtered[parent] = {};
          const nestedFiltered = filterFields(data[parent], [rest.join('.')]);
          filtered[parent] = { ...filtered[parent], ...nestedFiltered };
        }
      } else if (data.hasOwnProperty(field)) {
        filtered[field] = data[field];
      }
    });
    
    return filtered;
  }
  
  return data;
}

// Request deduplication
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();
  
  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  clear(): void {
    this.pendingRequests.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();