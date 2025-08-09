import { QueryClient } from '@tanstack/react-query';
import { apiCache } from '@/utils/cache';

// Enhanced Query Client with production optimizations
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 30 * 60 * 1000, // 30 minutes - cache longer in production
      refetchOnWindowFocus: false, // Disable refetch on focus for performance
      refetchOnReconnect: 'always', // Refetch when connection restored
      refetchOnMount: true,
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for network/server errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      networkMode: 'always', // Try to fetch even when offline (will use cache)
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
      networkMode: 'online', // Only try mutations when online
    },
  },
});

// Enhanced fetch function with caching
async function apiRequest(url: string, options: RequestInit = {}): Promise<any> {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  
  // Check cache for GET requests
  if (!options.method || options.method === 'GET') {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Cache successful GET responses
    if ((!options.method || options.method === 'GET') && data) {
      apiCache.set(cacheKey, data);
    }

    return data;
  } catch (error: any) {
    // Check cache as fallback for network errors
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Using cached data due to network error');
        return cached;
      }
    }
    
    throw error;
  }
}

// Set the default query function
queryClient.setDefaultOptions({
  queries: {
    queryFn: async ({ queryKey }) => {
      const url = queryKey[0] as string;
      return apiRequest(url);
    },
  },
});

// Network status monitoring
let isOnline = navigator.onLine;

const updateOnlineStatus = () => {
  const wasOffline = !isOnline;
  isOnline = navigator.onLine;
  
  if (wasOffline && isOnline) {
    // Refetch failed queries when coming back online
    queryClient.refetchQueries({
      predicate: (query) => query.state.status === 'error'
    });
  }
};

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Connection-aware settings
if ('connection' in navigator) {
  const connection = (navigator as any).connection;
  
  const updateConnectionStrategy = () => {
    const effectiveType = connection.effectiveType;
    
    // Adjust cache times based on connection speed
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      queryClient.setDefaultOptions({
        queries: {
          staleTime: 10 * 60 * 1000, // Longer stale time for slow connections
          gcTime: 60 * 60 * 1000, // Keep cache longer
        }
      });
    } else if (effectiveType === '4g') {
      queryClient.setDefaultOptions({
        queries: {
          staleTime: 2 * 60 * 1000, // Shorter stale time for fast connections
          gcTime: 15 * 60 * 1000,
        }
      });
    }
  };

  connection.addEventListener('change', updateConnectionStrategy);
  updateConnectionStrategy();
}

export { apiRequest };