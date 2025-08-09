// Service Worker for offline functionality and caching
const CACHE_NAME = 'pinmypic-v1.2.0';
const STATIC_CACHE_NAME = 'pinmypic-static-v1.2.0';
const IMAGE_CACHE_NAME = 'pinmypic-images-v1.2.0';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other critical static assets
];

// Image cache strategy
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first for API, cache first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Image requests - cache first with network fallback
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE_NAME));
    return;
  }

  // Static assets - cache first
  event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
});

// Network first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful API responses (except POST/PUT/DELETE)
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try cache on network failure
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for failed requests
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This feature is not available offline' 
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy (for static assets and images)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return fallback for failed image requests
    if (isImageRequest(request)) {
      return new Response(
        '<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="#9ca3af">Image unavailable</text></svg>',
        {
          headers: { 'Content-Type': 'image/svg+xml' }
        }
      );
    }
    
    throw error;
  }
}

function isImageRequest(request) {
  return IMAGE_EXTENSIONS.some(ext => request.url.includes(ext)) ||
         request.destination === 'image' ||
         request.url.includes('/api/images/');
}

// Background sync for photo uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'photo-upload') {
    event.waitUntil(syncPhotoUploads());
  }
});

async function syncPhotoUploads() {
  // Implementation for syncing failed photo uploads
  // This would require storing failed uploads in IndexedDB
  console.log('Syncing photo uploads...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New photos available!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'pinmypic-notification',
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('PinMyPic', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Cache size management
async function manageCacheSize() {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const requests = await cache.keys();
  
  // Limit image cache to 100 items
  if (requests.length > 100) {
    const requestsToDelete = requests.slice(0, requests.length - 100);
    await Promise.all(
      requestsToDelete.map(request => cache.delete(request))
    );
  }
}

// Periodic cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'MANAGE_CACHE') {
    event.waitUntil(manageCacheSize());
  }
});