/**
 * Service Worker Registration
 */

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[Service Worker] Registered successfully:', registration.scope);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  console.log('[Service Worker] New version available');
                  // Optionally show update notification to user
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_PENDING_TRANSFERS') {
          // Trigger sync in the app
          import('../services/sync_service').then(({ syncService }) => {
            syncService.syncPendingTransfers();
          });
        }
        if (event.data && event.data.type === 'SYNC_SCHEDULED_TRANSFERS') {
          import('../services/sync_service').then(({ syncService }) => {
            syncService.syncScheduledTransfers();
          });
        }
      });
    });
  }
}

export function unregisterServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('[Service Worker] Unregistration failed:', error);
      });
  }
}

