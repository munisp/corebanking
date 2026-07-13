/**
 * Service Worker Registration with cache-busting on deploy.
 *
 * On every page load the browser re-fetches /sw.js (served with
 * Cache-Control: no-cache). If the file changed (new build hash),
 * the browser installs the new SW, which purges all old caches.
 * This module also listens for the SW_UPDATED message and shows
 * a non-intrusive banner prompting the user to reload.
 */

let refreshing = false;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',  // force browser to bypass HTTP cache for sw.js
      });

      // Periodic update check (every 60 s while tab is active)
      setInterval(() => registration.update(), 60_000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type } = event.data ?? {};

      if (type === 'SW_UPDATED') {
        showUpdateBanner();
      }
      if (type === 'SYNC_PENDING_TRANSFERS') {
        import('../services/sync_service').then(({ syncService }) => {
          syncService.syncPendingTransfers();
        });
      }
      if (type === 'SYNC_SCHEDULED_TRANSFERS') {
        import('../services/sync_service').then(({ syncService }) => {
          syncService.syncScheduledTransfers();
        });
      }
    });

    // Reload once when the new SW takes over
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

/**
 * Show a non-intrusive banner at the top of the page prompting
 * the user to reload for the latest version.
 */
function showUpdateBanner(waitingWorker?: ServiceWorker): void {
  if (document.getElementById('sw-update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.setAttribute('role', 'alert');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '99999',
    background: '#1a56db',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  });

  banner.innerHTML = `
    <span>A new version is available.</span>
    <button id="sw-update-btn" style="
      background: #fff; color: #1a56db; border: none; border-radius: 6px;
      padding: 6px 16px; font-weight: 600; cursor: pointer; font-size: 13px;
    ">Reload</button>
    <button id="sw-dismiss-btn" style="
      background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.4);
      border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px;
    ">Later</button>
  `;

  document.body.prepend(banner);

  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });

  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    banner.remove();
  });
}

export function unregisterServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error('[SW] Unregistration failed:', error));
  }
}
