// 54Bank PWA Service Worker — Offline-First Strategy
const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `54bank-static-${CACHE_VERSION}`;
const API_CACHE = `54bank-api-${CACHE_VERSION}`;
const OFFLINE_QUEUE_KEY = '54bank-offline-queue';

const STATIC_ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'
];

const API_CACHE_PATTERNS = [
  /\/api\/v1\/accounts/,
  /\/api\/v1\/beneficiaries/,
  /\/api\/v1\/profile/,
  /\/api\/v1\/notifications/,
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' || event.request.method === 'PUT') {
    // Queue mutations for offline sync
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        await queueOfflineRequest(event.request);
        return new Response(JSON.stringify({
          status: 'queued', message: 'Request queued for sync when online'
        }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }
  
  if (API_CACHE_PATTERNS.some(p => p.test(url.pathname))) {
    // Network-first for API calls
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === '54bank-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'view-transaction') {
    event.waitUntil(clients.openWindow(data.url || '/transactions'));
  } else if (action === 'approve-transfer') {
    event.waitUntil(
      fetch('/api/v1/transfers/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId: data.transferId })
      }).then(() => self.registration.showNotification('Transfer Approved', {
        body: 'Transfer has been approved successfully',
        icon: '/icons/icon-192.png', tag: 'approval-confirm'
      }))
    );
  } else if (action === 'block-card') {
    event.waitUntil(
      fetch('/api/v1/cards/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: data.cardId })
      }).then(() => self.registration.showNotification('Card Blocked', {
        body: 'Your card has been blocked for security',
        icon: '/icons/icon-192.png', tag: 'card-blocked'
      }))
    );
  } else if (data.url) {
    event.waitUntil(clients.openWindow(data.url));
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});

// ─── Push Notification Handlers for Banking Events ──────────────────────────
self.addEventListener('push', event => {
  // Override default push to handle specific banking event types
  if (!event.data) return;
  
  let data;
  try { data = event.data.json(); } catch { return; }
  
  const type = data.type || 'generic';
  
  const notificationMap = {
    'transaction_credit': {
      icon: '/icons/credit.png',
      actions: [{ action: 'view-transaction', title: 'View Details' }],
      tag: `txn-${data.ref || Date.now()}`,
      requireInteraction: false,
    },
    'transaction_debit': {
      icon: '/icons/debit.png',
      actions: [{ action: 'view-transaction', title: 'View Details' }],
      tag: `txn-${data.ref || Date.now()}`,
      requireInteraction: false,
    },
    'security_alert': {
      icon: '/icons/security.png',
      actions: [
        { action: 'block-card', title: 'Block Card' },
        { action: 'view-transaction', title: 'Review' }
      ],
      tag: 'security-alert',
      requireInteraction: true,
    },
    'maker_checker': {
      icon: '/icons/approval.png',
      actions: [
        { action: 'approve-transfer', title: 'Approve' },
        { action: 'view-transaction', title: 'Review' }
      ],
      tag: `approval-${data.transferId || Date.now()}`,
      requireInteraction: true,
    },
    'loan_reminder': {
      icon: '/icons/loan.png',
      actions: [{ action: 'view-transaction', title: 'Pay Now' }],
      tag: 'loan-reminder',
    },
  };

  const config = notificationMap[type] || {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || '54Bank', {
      body: data.body || '',
      icon: config.icon || '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      actions: config.actions || [],
      tag: config.tag || 'default',
      requireInteraction: config.requireInteraction || false,
      data: { url: data.url, transferId: data.transferId, cardId: data.cardId, type },
      vibrate: type === 'security_alert' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    })
  );
});

// FIX: Service Workers cannot access localStorage. Use IndexedDB instead.
const DB_NAME = '54bank-offline-queue';
const STORE_NAME = 'requests';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function queueOfflineRequest(request) {
  const db = await openQueueDB();
  const body = await request.text();
  const entry = {
    url: request.url, method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body, timestamp: Date.now()
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function processOfflineQueue() {
  const db = await openQueueDB();
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
  const failed = [];
  for (const entry of entries) {
    try {
      await fetch(entry.url, { method: entry.method, headers: entry.headers, body: entry.body });
    } catch { failed.push(entry); }
  }
  // Clear processed, re-queue failures
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  for (const f of failed) { tx.objectStore(STORE_NAME).add(f); }
  await new Promise(r => { tx.oncomplete = r; });
}
