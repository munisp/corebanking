import { useEffect, useState } from 'react';
import { syncService, type SyncStatus } from '../services/sync_service';

/**
 * Hook to get and monitor sync status
 */
export const useSyncStatus = () => {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Get initial status
    syncService.getSyncStatus().then(setStatus);

    // Subscribe to status changes
    const unsubscribe = syncService.onSyncStatusChange(setStatus);

    // Poll for status updates every 5 seconds
    const interval = setInterval(() => {
      syncService.getSyncStatus().then(setStatus);
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return status;
};

