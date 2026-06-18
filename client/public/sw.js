/**
 * 54Bank Service Worker — Offline-first with background sync
 * Handles: caching, offline queue, bandwidth detection, sync-when-connected
 */

const CACHE_NAME = '54bank-v1';
const API_CACHE = '54bank-api-v1';
const OFFLINE_QUEUE = '54bank-offline-queue';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

const API_CACHE_PATTERNS = [
  /\/api\/platform\/.*\/overview$/,
  /\/api\/customers$/,
  /\/healthz$/,
];

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Install — cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP
  if (!url.protocol.startsWith('http')) return;

  // API requests
  if (url.pathname.startsWith('/api/')) {
    // Mutations — queue if offline
    if (MUTATION_METHODS.includes(request.method)) {
      event.respondWith(handleMutation(request));
      return;
    }
    // Reads — network-first with cache fallback
    event.respondWith(handleAPIRead(request));
    return;
  }

  // Static assets — cache-first
  event.respondWith(handleStaticAsset(request));
});

async function handleMutation(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Offline — queue the mutation
    const body = await request.clone().text();
    const queueItem = {
      id: crypto.randomUUID(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    };

    const queue = await getOfflineQueue();
    queue.push(queueItem);
    await saveOfflineQueue(queue);

    return new Response(
      JSON.stringify({
        queued: true,
        offlineId: queueItem.id,
        message: 'Operation queued for sync when connection is restored',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleAPIRead(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const shouldCache = API_CACHE_PATTERNS.some((p) => p.test(new URL(request.url).pathname));
      if (shouldCache) {
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-54Bank-Cache', 'offline');
      return new Response(cached.body, { status: cached.status, headers });
    }
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === '54bank-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  const remaining = [];

  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
    } catch {
      remaining.push(item);
    }
  }

  await saveOfflineQueue(remaining);

  // Notify clients
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: '54bank-sync-complete',
      synced: queue.length - remaining.length,
      remaining: remaining.length,
    });
  });
}

// Periodic sync for connection monitoring
self.addEventListener('periodicsync', (event) => {
  if (event.tag === '54bank-heartbeat') {
    event.waitUntil(syncOfflineQueue());
  }
});

// IndexedDB-backed queue (falls back to in-memory)
let memoryQueue = [];

async function getOfflineQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('queue', 'readonly');
      const store = tx.objectStore('queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(memoryQueue);
    });
  } catch {
    return memoryQueue;
  }
}

async function saveOfflineQueue(queue) {
  memoryQueue = queue;
  try {
    const db = await openDB();
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    store.clear();
    queue.forEach((item) => store.put(item));
  } catch {
    // fallback to memory
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('54bank-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
