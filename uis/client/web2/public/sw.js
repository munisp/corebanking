/* eslint-disable no-restricted-globals */
/**
 * Service Worker for PWA Offline Functionality
 * Handles caching, background sync, and offline support
 */

const CACHE_NAME = '54link-pwa-cache-v1';
const OFFLINE_PAGE = '/offline';

// Assets to cache on install
// Don't cache the root HTML page - it's dynamically generated with tenant colors
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Skip API calls - let them fail for offline handling
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return;
  }

  // For HTML pages (navigation requests), use network-first strategy
  // This ensures tenant colors are always fresh and not cached
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML pages - they contain dynamic tenant colors
          return response;
        })
        .catch(() => {
          // If offline, show offline page
          return caches.match(OFFLINE_PAGE) || new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // For other assets (JS, CSS, images), use cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Try network, fallback to offline page if offline
        return fetch(request)
          .then((response) => {
            // Cache successful responses (but not HTML pages)
            if (response.status === 200 && !response.headers.get('content-type')?.includes('text/html')) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // If offline and no cache, return error
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background sync for queued operations
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-pending-transfers') {
    event.waitUntil(syncPendingTransfers());
  }
  
  if (event.tag === 'sync-scheduled-transfers') {
    event.waitUntil(syncScheduledTransfers());
  }
});

// Sync pending transfers
async function syncPendingTransfers() {
  try {
    // This will be handled by the sync service in the app
    // The service worker just triggers the sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_PENDING_TRANSFERS',
      });
    });
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
  }
}

// Sync scheduled transfers
async function syncScheduledTransfers() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_SCHEDULED_TRANSFERS',
      });
    });
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
  }
}

// Message handler for communication with app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

