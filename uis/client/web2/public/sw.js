/* eslint-disable no-restricted-globals */
/**
 * Service Worker for PWA Offline Functionality
 * Handles caching, background sync, and offline support.
 *
 * CACHE BUSTING: The CACHE_VERSION below is bumped by the build pipeline
 * (vite-plugin-version-inject or CI sed). When it changes, the activate
 * handler deletes every old cache, guaranteeing users get fresh assets.
 */

const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_NAME = `54link-pwa-cache-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline';

const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
];

// Install — cache static assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete ALL caches that don't match the current version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Purging stale cache:', name);
            return caches.delete(name);
          })
      );
    })
    .then(() => self.clients.claim())
    .then(() => {
      // Notify all open tabs that a new version is active
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Fetch — network-first for HTML, cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) return;

  // HTML navigation — always network-first (never serve stale HTML)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_PAGE) || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Hashed assets under /assets/ — cache-first (immutable filenames)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other assets — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));

      return cached || networkFetch;
    })
  );
});

// Background sync for queued operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-transfers') {
    event.waitUntil(notifyClients('SYNC_PENDING_TRANSFERS'));
  }
  if (event.tag === 'sync-scheduled-transfers') {
    event.waitUntil(notifyClients('SYNC_SCHEDULED_TRANSFERS'));
  }
});

async function notifyClients(type) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type }));
}

// Message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(event.data.urls))
    );
  }
  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
});
