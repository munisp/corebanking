// IndexedDB utility for managing offline data

// Get tenant ID from localStorage or use default
const getTenantId = () => {
  try {
    return localStorage.getItem('tenant_id') || '54link-dev';
  } catch {
    return '54link-dev';
  }
};

const DB_NAME = `${getTenantId()}-db`;
const DB_VERSION = 3; // Incremented for card storage
const PENDING_TRANSFERS_STORE = 'pending-transfers';
const CACHED_DATA_STORE = 'cached-data';
const CARDS_STORE = 'cards';
const SCHEDULED_TRANSFERS_STORE = 'scheduled-transfers';

export interface PendingTransfer {
  id?: number;
  payer: string | number; // Payer account ID
  payee: string | number; // Payee account ID
  amount: string | number; // Transfer amount
  note: string; // Transfer note/narration
  pin: string; // PIN for offline transfer (unencrypted for now)
  // Legacy fields for backward compatibility
  recipientName?: string;
  recipientAccount?: string;
  bankCode?: string;
  bankName?: string;
  narration?: string;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount?: number;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;

  // Initialize and open database
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create pending transfers store
        if (!db.objectStoreNames.contains(PENDING_TRANSFERS_STORE)) {
          const transferStore = db.createObjectStore(PENDING_TRANSFERS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          transferStore.createIndex('timestamp', 'timestamp', { unique: false });
          transferStore.createIndex('status', 'status', { unique: false });
        }

        // Create cached data store
        if (!db.objectStoreNames.contains(CACHED_DATA_STORE)) {
          db.createObjectStore(CACHED_DATA_STORE, { keyPath: 'key' });
        }

        // Create cards store for offline card access
        if (!db.objectStoreNames.contains(CARDS_STORE)) {
          const cardsStore = db.createObjectStore(CARDS_STORE, { keyPath: 'id' });
          cardsStore.createIndex('userId', 'userId', { unique: false });
          cardsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create scheduled transfers store
        if (!db.objectStoreNames.contains(SCHEDULED_TRANSFERS_STORE)) {
          const scheduledStore = db.createObjectStore(SCHEDULED_TRANSFERS_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          scheduledStore.createIndex('scheduledDate', 'scheduledDate', { unique: false });
          scheduledStore.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  // Add pending transfer
  async addPendingTransfer(transfer: PendingTransfer): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      
      const transferData: PendingTransfer = {
        ...transfer,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      };

      const request = store.add(transferData);

      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending transfers
  async getPendingTransfers(): Promise<PendingTransfer[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readonly');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get pending transfers by status
  async getPendingTransfersByStatus(status: 'pending' | 'syncing' | 'failed'): Promise<PendingTransfer[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readonly');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Update transfer status
  async updateTransferStatus(id: number, status: 'pending' | 'syncing' | 'failed', retryCount?: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const transfer = getRequest.result;
        if (transfer) {
          transfer.status = status;
          if (retryCount !== undefined) {
            transfer.retryCount = retryCount;
          }
          const updateRequest = store.put(transfer);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Transfer not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Delete transfer
  async deleteTransfer(id: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all pending transfers
  async clearPendingTransfers(): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_TRANSFERS_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache data (generic)
  async cacheData(key: string, data: unknown): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHED_DATA_STORE], 'readwrite');
      const store = transaction.objectStore(CACHED_DATA_STORE);
      const request = store.put({ key, data, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  async getCachedData(key: string): Promise<unknown> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHED_DATA_STORE], 'readonly');
      const store = transaction.objectStore(CACHED_DATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
  }

  // Card storage methods
  async saveCards(cards: Array<{ id: string; encryptedData: string; userId: string }>): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CARDS_STORE], 'readwrite');
      const store = transaction.objectStore(CARDS_STORE);
      
      // Clear existing cards for this user
      const userId = cards[0]?.userId;
      if (userId) {
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => {
          const existingCards = request.result;
          existingCards.forEach((card) => {
            store.delete(card.id);
          });
          
          // Add new cards
          const addPromises = cards.map((card) => {
            return new Promise<void>((resolveAdd, rejectAdd) => {
              const addRequest = store.put({
                id: card.id,
                encryptedData: card.encryptedData,
                userId: card.userId,
                timestamp: Date.now(),
              });
              addRequest.onsuccess = () => resolveAdd();
              addRequest.onerror = () => rejectAdd(addRequest.error);
            });
          });
          
          Promise.all(addPromises)
            .then(() => resolve())
            .catch(reject);
        };
        request.onerror = () => reject(request.error);
      } else {
        resolve();
      }
    });
  }

  async getCards(userId: string): Promise<Array<{ id: string; encryptedData: string; userId: string; timestamp: number }>> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CARDS_STORE], 'readonly');
      const store = transaction.objectStore(CARDS_STORE);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearCards(userId?: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CARDS_STORE], 'readwrite');
      const store = transaction.objectStore(CARDS_STORE);
      
      if (userId) {
        const index = store.index('userId');
        const request = index.getAll(userId);
        request.onsuccess = () => {
          const cards = request.result;
          const deletePromises = cards.map((card) => {
            return new Promise<void>((resolveDelete, rejectDelete) => {
              const deleteRequest = store.delete(card.id);
              deleteRequest.onsuccess = () => resolveDelete();
              deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
            });
          });
          Promise.all(deletePromises)
            .then(() => resolve())
            .catch(reject);
        };
        request.onerror = () => reject(request.error);
      } else {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }
    });
  }

  // Scheduled transfer methods
  async addScheduledTransfer(transfer: {
    amount: string;
    recipientName: string;
    recipientAccount: string;
    bankCode: string;
    bankName: string;
    narration: string;
    scheduledDate: number;
    pin?: string;
  }): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULED_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(SCHEDULED_TRANSFERS_STORE);
      
      const transferData = {
        ...transfer,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      };

      const request = store.add(transferData);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getScheduledTransfers(): Promise<Array<{
    id?: number;
    amount: string;
    recipientName: string;
    recipientAccount: string;
    bankCode: string;
    bankName: string;
    narration: string;
    scheduledDate: number;
    status: 'pending' | 'syncing' | 'failed' | 'completed';
    timestamp: number;
    retryCount?: number;
  }>> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULED_TRANSFERS_STORE], 'readonly');
      const store = transaction.objectStore(SCHEDULED_TRANSFERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateScheduledTransferStatus(
    id: number,
    status: 'pending' | 'syncing' | 'failed' | 'completed',
    retryCount?: number
  ): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULED_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(SCHEDULED_TRANSFERS_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const transfer = getRequest.result;
        if (transfer) {
          transfer.status = status;
          if (retryCount !== undefined) {
            transfer.retryCount = retryCount;
          }
          const updateRequest = store.put(transfer);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Scheduled transfer not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteScheduledTransfer(id: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULED_TRANSFERS_STORE], 'readwrite');
      const store = transaction.objectStore(SCHEDULED_TRANSFERS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const dbManager = new IndexedDBManager();
