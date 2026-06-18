/**
 * B3: In-memory LRU cache with TTL — drop-in Redis replacement for dev
 * Production: swap this for ioredis calls.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern: string): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  stats(): { size: number; maxSize: number; hitRate: string } {
    return { size: this.cache.size, maxSize: this.maxSize, hitRate: "n/a" };
  }
}

export const appCache = new LRUCache(5000);

// Cache TTLs
export const CACHE_TTL = {
  BRANCH_LIST: 5 * 60 * 1000,         // 5 min
  PRODUCT_CATALOG: 5 * 60 * 1000,     // 5 min
  FX_RATES: 60 * 1000,                // 1 min
  BANK_DIRECTORY: 10 * 60 * 1000,     // 10 min
  CUSTOMER_PROFILE: 30 * 1000,        // 30 sec
  AUTH_DECISION: 60 * 1000,           // 1 min
  DASHBOARD_KPI: 15 * 1000,           // 15 sec
  HEALTH_STATUS: 10 * 1000,           // 10 sec
};
