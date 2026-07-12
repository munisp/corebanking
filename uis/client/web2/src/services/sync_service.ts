/**
 * Background Sync Service
 * Handles syncing of queued operations when connection is restored
 */

import { dbManager, type PendingTransfer } from '../utils/indexedDB';
import { paymentService } from './payment_service';

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: number | null;
}

class SyncService {
  private isSyncing = false;
  private syncListeners: Array<(status: SyncStatus) => void> = [];

  /**
   * Register a listener for sync status updates
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of sync status change
   */
  private notifyListeners(status: SyncStatus): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pending = await dbManager.getPendingTransfersByStatus('pending');
    const failed = await dbManager.getPendingTransfersByStatus('failed');
    
    return {
      isSyncing: this.isSyncing,
      pendingCount: pending.length,
      failedCount: failed.length,
      lastSyncTime: this.getLastSyncTime(),
    };
  }

  /**
   * Sync all pending transfers
   */
  async syncPendingTransfers(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync already in progress');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners(await this.getSyncStatus());

    try {
      // Get both pending and syncing transfers (in case some got stuck)
      const pending = await dbManager.getPendingTransfersByStatus('pending');
      const syncing = await dbManager.getPendingTransfersByStatus('syncing');
      
      // Reset stuck syncing transfers back to pending
      for (const stuckTransfer of syncing) {
        if (stuckTransfer.id) {
          console.log('[SyncService] Resetting stuck syncing transfer:', stuckTransfer.id);
          await dbManager.updateTransferStatus(stuckTransfer.id, 'pending');
        }
      }
      
      // Combine all transfers to sync
      const allTransfers = [...pending, ...syncing];
      
      if (allTransfers.length === 0) {
        console.log('[SyncService] No transfers to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`[SyncService] Starting sync for ${allTransfers.length} transfer(s)`);
      let successCount = 0;
      let failedCount = 0;

      for (const transfer of allTransfers) {
        try {
          await this.syncTransfer(transfer);
          successCount++;
          console.log(`[SyncService] Successfully synced transfer ${transfer.id}`);
        } catch (error) {
          console.error('[SyncService] Failed to sync transfer:', error);
          failedCount++;
          
          // Update retry count
          const retryCount = (transfer.retryCount || 0) + 1;
          if (retryCount >= 3) {
            // After 3 failed attempts, notify user and delete the transfer
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const transferAmount = typeof transfer.amount === 'string' 
              ? parseFloat(transfer.amount) 
              : Number(transfer.amount);
            const payeeInfo = transfer.recipientName || `Account ${transfer.payee || transfer.recipientAccount}`;
            
            // Notify user about the failure
            this.notifyTransferFailure({
              amount: transferAmount,
              recipient: payeeInfo,
              error: errorMessage,
            });
            
            // Delete the failed transfer
            if (transfer.id) {
              await dbManager.deleteTransfer(transfer.id);
              console.log(`[SyncService] Transfer ${transfer.id} deleted after ${retryCount} failed attempts`);
            }
          } else {
            await dbManager.updateTransferStatus(transfer.id!, 'pending', retryCount);
            console.log(`[SyncService] Transfer ${transfer.id} reset to pending (retry ${retryCount}/3)`);
          }
        }
      }

      this.setLastSyncTime(Date.now());
      this.notifyListeners(await this.getSyncStatus());
      
      console.log(`[SyncService] Sync completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
    } finally {
      this.isSyncing = false;
      this.notifyListeners(await this.getSyncStatus());
    }
  }

  /**
   * Sync a single transfer
   */
  private async syncTransfer(transfer: PendingTransfer): Promise<void> {
    if (!transfer.id) {
      throw new Error('Transfer ID is required');
    }

    console.log(`[SyncService] Syncing transfer ${transfer.id}:`, {
      payer: transfer.payer,
      payee: transfer.payee,
      amount: transfer.amount,
      note: transfer.note,
      hasPin: !!transfer.pin,
    });

    // Mark as syncing
    await dbManager.updateTransferStatus(transfer.id, 'syncing');

    try {
      // Use payer from transfer data, fallback to localStorage
      const payerId = transfer.payer || localStorage.getItem('account_id') || '';
      if (!payerId) {
        throw new Error('Payer account ID not found');
      }

      // Use payee from transfer data (new format) or fallback to recipientAccount (legacy)
      const payeeId = transfer.payee || transfer.recipientAccount;
      if (!payeeId) {
        throw new Error('Payee account ID not found');
      }

      // Use note from transfer data (new format) or fallback to narration (legacy)
      const transferNote = transfer.note || transfer.narration || 'Transfer';

      // Get amount as number
      const transferAmount = typeof transfer.amount === 'string' 
        ? parseFloat(transfer.amount) 
        : Number(transfer.amount);

      if (isNaN(transferAmount) || transferAmount <= 0) {
        throw new Error(`Invalid amount: ${transfer.amount}`);
      }

      // Get PIN - required for transfer
      const transferPin = transfer.pin || '';
      if (!transferPin) {
        throw new Error('PIN is required for transfer');
      }

      console.log(`[SyncService] Calling payment service with:`, {
        payerAccountId: String(payerId),
        payeeAccountId: String(payeeId),
        amount: transferAmount,
        note: transferNote,
        pinLength: transferPin.length,
      });

      // Execute the transfer
      const result = await paymentService.transfer({
        payerAccountId: String(payerId),
        payeeAccountId: String(payeeId),
        amount: transferAmount,
        note: transferNote,
        pin: transferPin,
      });

      console.log(`[SyncService] Payment service response:`, result);

      if (result.success) {
        // Delete from pending transfers
        await dbManager.deleteTransfer(transfer.id);
        console.log(`[SyncService] Transfer ${transfer.id} completed and removed from queue`);
      } else {
        throw new Error(result.message || 'Transfer failed');
      }
    } catch (error) {
      console.error(`[SyncService] Error syncing transfer ${transfer.id}:`, error);
      // Don't mark as failed here - let the outer loop handle retry logic
      // Just rethrow so the outer loop can handle it
      throw error;
    }
  }

  /**
   * Sync scheduled transfers that are due
   */
  async syncScheduledTransfers(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners(await this.getSyncStatus());

    try {
      const scheduled = await dbManager.getScheduledTransfers();
      const now = Date.now();
      const due = scheduled.filter(
        (t) => t.status === 'pending' && t.scheduledDate <= now
      );

      let successCount = 0;
      let failedCount = 0;

      for (const transfer of due) {
        try {
          if (!transfer.id) continue;

          await dbManager.updateScheduledTransferStatus(transfer.id, 'syncing');

          const accountId = localStorage.getItem('account_id') || '';
          if (!accountId) {
            throw new Error('Account ID not found');
          }

          const result = await paymentService.transfer({
            payerAccountId: accountId,
            payeeAccountId: transfer.recipientAccount,
            amount: parseFloat(transfer.amount),
            note: transfer.narration,
            pin: '', // PIN should be stored securely
          });

          if (result.success) {
            await dbManager.updateScheduledTransferStatus(transfer.id, 'completed');
            successCount++;
          } else {
            throw new Error(result.message || 'Transfer failed');
          }
        } catch (error) {
          console.error('[SyncService] Failed to sync scheduled transfer:', error);
          failedCount++;
          
          if (transfer.id) {
            const retryCount = (transfer.retryCount || 0) + 1;
            if (retryCount >= 3) {
              await dbManager.updateScheduledTransferStatus(transfer.id, 'failed', retryCount);
            } else {
              await dbManager.updateScheduledTransferStatus(transfer.id, 'pending', retryCount);
            }
          }
        }
      }

      this.setLastSyncTime(Date.now());
      this.notifyListeners(await this.getSyncStatus());
      
      return { success: successCount, failed: failedCount };
    } finally {
      this.isSyncing = false;
      this.notifyListeners(await this.getSyncStatus());
    }
  }

  /**
   * Register background sync
   */
  async registerBackgroundSync(tag: string): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in (self as any).registration) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(tag);
      } catch (error) {
        console.error('[SyncService] Failed to register background sync:', error);
      }
    }
  }

  /**
   * Get last sync time from localStorage
   */
  private getLastSyncTime(): number | null {
    const stored = localStorage.getItem('last_sync_time');
    return stored ? parseInt(stored, 10) : null;
  }

  /**
   * Set last sync time
   */
  private setLastSyncTime(timestamp: number): void {
    localStorage.setItem('last_sync_time', timestamp.toString());
  }

  /**
   * Notify user about transfer failure
   */
  private notifyTransferFailure(data: {
    amount: number;
    recipient: string;
    error: string;
  }): void {
    // Use alert for now - can be replaced with toast notification later
    const message = `Transfer Failed\n\n` +
      `Amount: ₦${data.amount.toLocaleString()}\n` +
      `Recipient: ${data.recipient}\n` +
      `Error: ${data.error}\n\n` +
      `The transfer has been removed from the queue. Please try again.`;
    
    // Store failure notification to show when UI is ready
    const failures = JSON.parse(localStorage.getItem('transfer_failures') || '[]');
    failures.push({
      ...data,
      timestamp: Date.now(),
      message,
    });
    localStorage.setItem('transfer_failures', JSON.stringify(failures));
    
    // Show alert immediately if possible
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        alert(message);
      }, 100);
    }
  }

  /**
   * Get and clear transfer failures
   */
  getTransferFailures(): Array<{
    amount: number;
    recipient: string;
    error: string;
    timestamp: number;
    message: string;
  }> {
    const failures = JSON.parse(localStorage.getItem('transfer_failures') || '[]');
    localStorage.removeItem('transfer_failures');
    return failures;
  }
}

export const syncService = new SyncService();

