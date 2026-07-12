/**
 * Drizzle Query Cache — 54Bank Platform
 *
 * Two-tier caching layer for Drizzle ORM queries:
 *   L1: In-process LRU cache (sub-millisecond, no network hop)
 *   L2: Redis cache (shared across instances, survives restarts)
 *
 * Cache invalidation strategy:
 *   - Time-based TTL (configurable per query type)
 *   - Tag-based invalidation (invalidate all queries for a tenant/entity)
 *   - Manual invalidation via invalidateByTag()
 *
 * Usage:
 *   const result = await cachedQuery(
 *     'customers:tenant-1:page-1',
 *     () => db.select().from(customers).where(...),
 *     { ttlSeconds: 60, tags: ['customers', 'tenant:tenant-1'] }
 *   );
 */
import { logger } from "../logger";

// ── LRU Cache (L1) ────────────────────────────────────────────────────────────

interface LRUEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class LRUCache<T> {
  private cache = new Map<string, LRUEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (LRU eviction)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number, tags: string[]): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
  }

  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ── Cache Configuration ───────────────────────────────────────────────────────

export interface CacheOptions {
  /** TTL in seconds. Default: 60 */
  ttlSeconds?: number;
  /** Tags for group invalidation (e.g. ['customers', 'tenant:tenant-1']) */
  tags?: string[];
  /** Skip L1 in-process cache (useful for large result sets) */
  skipL1?: boolean;
  /** Skip L2 Redis cache */
  skipL2?: boolean;
}

// Default TTLs by data type (seconds)
export const CACHE_TTL = {
  /** Static reference data — rarely changes */
  REFERENCE: 3600,
  /** Tenant configuration — changes on admin action */
  TENANT_CONFIG: 300,
  /** Customer profile — changes on KYC/update */
  CUSTOMER: 120,
  /** Account balance — changes on every transaction */
  ACCOUNT_BALANCE: 10,
  /** Transaction list — append-only, safe to cache briefly */
  TRANSACTIONS: 30,
  /** Billing usage — aggregated, safe to cache */
  BILLING: 60,
  /** Workflow status — changes frequently */
  WORKFLOW: 5,
  /** Analytics/reporting — expensive queries */
  ANALYTICS: 600,
} as const;

// ── Singleton L1 Cache ────────────────────────────────────────────────────────

const l1Cache = new LRUCache<unknown>(2000);

// ── Redis L2 Cache ────────────────────────────────────────────────────────────

let redisClient: any = null;

async function getRedisClient(): Promise<any | null> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  if (!redisUrl) return null;

  try {
    // Dynamic import to avoid hard dependency
    const { createClient } = await import("redis").catch(() => ({ createClient: null }));
    if (!createClient) return null;

    redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    logger.info("[QueryCache] Redis L2 cache connected");
    return redisClient;
  } catch (error) {
    logger.warn("[QueryCache] Redis L2 unavailable, using L1 only", {
      error: String(error),
    });
    return null;
  }
}

// ── Core Cache Function ───────────────────────────────────────────────────────

/**
 * Executes a query with two-tier caching.
 * Returns cached result if available, otherwise executes the query and caches it.
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const ttl = options.ttlSeconds ?? 60;
  const tags = options.tags ?? [];

  // L1 check
  if (!options.skipL1) {
    const l1Hit = l1Cache.get(cacheKey) as T | null;
    if (l1Hit !== null) {
      logger.debug(`[QueryCache] L1 HIT: ${cacheKey}`);
      return l1Hit;
    }
  }

  // L2 check (Redis)
  if (!options.skipL2) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(`qcache:${cacheKey}`);
        if (cached) {
          const parsed = JSON.parse(cached) as T;
          // Backfill L1
          if (!options.skipL1) {
            l1Cache.set(cacheKey, parsed, Math.min(ttl, 30), tags);
          }
          logger.debug(`[QueryCache] L2 HIT: ${cacheKey}`);
          return parsed;
        }
      }
    } catch (error) {
      logger.warn(`[QueryCache] L2 read failed for ${cacheKey}`, {
        error: String(error),
      });
    }
  }

  // Cache miss — execute query
  logger.debug(`[QueryCache] MISS: ${cacheKey}`);
  const result = await queryFn();

  // Store in L1
  if (!options.skipL1) {
    l1Cache.set(cacheKey, result, ttl, tags);
  }

  // Store in L2 (Redis)
  if (!options.skipL2) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.setEx(`qcache:${cacheKey}`, ttl, JSON.stringify(result));
        // Store tag → key mappings for group invalidation
        for (const tag of tags) {
          await redis.sAdd(`qcache:tag:${tag}`, `qcache:${cacheKey}`);
          await redis.expire(`qcache:tag:${tag}`, ttl + 60);
        }
      }
    } catch (error) {
      logger.warn(`[QueryCache] L2 write failed for ${cacheKey}`, {
        error: String(error),
      });
    }
  }

  return result;
}

// ── Cache Invalidation ────────────────────────────────────────────────────────

/**
 * Invalidates all cache entries with the given tag.
 * Use after mutations: invalidateByTag('tenant:tenant-1') clears all
 * cached queries for that tenant.
 */
export async function invalidateByTag(tag: string): Promise<void> {
  // L1 invalidation
  const l1Count = l1Cache.invalidateByTag(tag);

  // L2 invalidation
  try {
    const redis = await getRedisClient();
    if (redis) {
      const keys = await redis.sMembers(`qcache:tag:${tag}`);
      if (keys.length > 0) {
        await redis.del([...keys, `qcache:tag:${tag}`]);
      }
      logger.debug(`[QueryCache] Invalidated tag '${tag}': L1=${l1Count}, L2=${keys.length}`);
    }
  } catch (error) {
    logger.warn(`[QueryCache] L2 tag invalidation failed for '${tag}'`, {
      error: String(error),
    });
  }
}

/**
 * Invalidates a specific cache key.
 */
export async function invalidateKey(cacheKey: string): Promise<void> {
  l1Cache.invalidate(cacheKey);
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(`qcache:${cacheKey}`);
    }
  } catch (error) {
    logger.warn(`[QueryCache] L2 key invalidation failed for '${cacheKey}'`, {
      error: String(error),
    });
  }
}

/**
 * Invalidates all cache entries for a tenant.
 * Call this after any write operation that affects tenant data.
 */
export async function invalidateTenant(tenantId: string): Promise<void> {
  await invalidateByTag(`tenant:${tenantId}`);
}

/**
 * Returns cache statistics for monitoring.
 */
export function getCacheStats(): {
  l1Size: number;
  l1MaxSize: number;
} {
  return {
    l1Size: l1Cache.size,
    l1MaxSize: 2000,
  };
}

// ── Cache Key Builders ────────────────────────────────────────────────────────

export const cacheKey = {
  customerById: (tenantId: string, customerId: string) =>
    `customer:${tenantId}:${customerId}`,
  customersByTenant: (tenantId: string, page: number, limit: number) =>
    `customers:${tenantId}:p${page}:l${limit}`,
  accountById: (tenantId: string, accountId: string) =>
    `account:${tenantId}:${accountId}`,
  accountsByCustomer: (tenantId: string, customerId: string) =>
    `accounts:${tenantId}:${customerId}`,
  transactionsByAccount: (accountId: string, page: number) =>
    `txns:${accountId}:p${page}`,
  loansByCustomer: (tenantId: string, customerId: string) =>
    `loans:${tenantId}:${customerId}`,
  billingUsage: (tenantId: string, meterKey: string, period: string) =>
    `billing:${tenantId}:${meterKey}:${period}`,
  workflowsByTenant: (tenantId: string, type: string) =>
    `workflows:${tenantId}:${type}`,
};
