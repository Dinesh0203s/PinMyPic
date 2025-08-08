// Service Worker for caching and performance optimization

const CACHE_NAME = 'pinmypic-v1.0.0';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other static resources
];

const API_CACHE_PATTERNS = [
  /^\/api\/events\/all/,
  /^\/api\/user\/profile/,
  /^\/api\/events\/\d+$/,
];

const IMAGE_CACHE_PATTERNS = [
  /^\/api\/images\//,
  /^\/uploads\//,
  /\.(jpg|jpeg|png|gif|webp|avif)$/i,
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other schemes
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    (async () => {
      try {
        // Strategy 1: Images - Cache First with fallback
        if (IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
          return await cacheFirst(request);
        }

        // Strategy 2: API calls - Network First with cache fallback
        if (url.pathname.startsWith('/api/')) {
          // Cache specific API patterns
          if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
            return await networkFirstWithStaleWhileRevalidate(request);
          }
          // Don't cache other API calls (mutations, etc.)
          return await fetch(request);
        }

        // Strategy 3: Static resources - Stale While Revalidate
        if (STATIC_CACHE_URLS.includes(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
          return await staleWhileRevalidate(request);
        }

        // Default: Network only
        return await fetch(request);
      } catch (error) {
        console.error('Service Worker fetch error:', error);
        return new Response('Network error', { status: 503 });
      }
    })()
  );
});

// Caching strategies
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Image not available', { status: 404 });
  }
}

async function networkFirstWithStaleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Update cache in background
      cache.put(request, response.clone());
      // Add cache timestamp
      const headers = new Headers(response.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    }
    throw new Error('Network response not ok');
  } catch (error) {
    // Fall back to cache
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('sw-from-cache', 'true');
      
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: headers,
      });
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  // Start network request immediately
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }

  // If no cached version, wait for network
  return networkPromise;
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Retry failed requests
      retryFailedRequests()
    );
  }
});

async function retryFailedRequests() {
  // Implementation would depend on storing failed requests
  console.log('Retrying failed requests...');
}

// Push notifications (if needed)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/badge-72x72.png',
      })
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});