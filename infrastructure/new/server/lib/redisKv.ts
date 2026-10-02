/**
 * redisKv — shared ioredis singleton + typed KV helpers for security state.
 *
 * W12 C3-P1-B2: replaces the per-process in-memory Maps that previously held
 * session/auth security state (token blacklist, login attempts, PKCE flows,
 * OTPs, session registries, lockouts, idempotency entries, API keys, password
 * history). Those maps were per-replica, so security limits multiplied by
 * replica count and all state vanished on restart. All of that state now
 * lives in redis (REDIS_URL) and is shared across replicas.
 *
 * Failure contract: the helpers in this module THROW when redis is
 * unreachable. They deliberately do not silently degrade to memory — each
 * caller decides per-control whether to fail closed (503 on security state:
 * sessions, lockouts, OTP, token blacklist, idempotency) or fail open with a
 * loud log (rate limiting, which is not a revocation control).
 *
 * The client is configured so an outage surfaces as an immediate rejection
 * rather than a hang: commands are not queued while disconnected and each
 * command is retried at most once.
 */

import Redis from "ioredis";
import type { Request } from "express";
import { logger } from "./logger";

let client: Redis | null = null;

/**
 * getRedis returns the process-wide ioredis singleton, creating it on first
 * use. The connection is lazy (first command connects) so importing this
 * module never crashes a process that has no redis configured.
 */
export function getRedis(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    client = new Redis(url, {
      lazyConnect: true,
      // Fail fast on outage — callers need an immediate throw to apply their
      // fail-open/fail-closed policy, not a stalled offline queue.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 3000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    client.on("error", (err) => {
      logger.warn("[redisKv] redis client error", { error: String(err) });
    });
  }
  return client;
}

/** kvGet returns the raw string value for key, or null when absent. Throws on outage. */
export async function kvGet(key: string): Promise<string | null> {
  return getRedis().get(key);
}

/**
 * kvSetNX sets key to value with a TTL only when the key does not already
 * exist (SET key value EX ttl NX). Returns true when the key was created.
 * Throws on outage.
 */
export async function kvSetNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const res = await getRedis().set(key, value, "EX", Math.max(1, Math.ceil(ttlSeconds)), "NX");
  return res === "OK";
}

/**
 * kvSetJson stores obj JSON-serialized at key. When ttlSeconds is given the
 * key expires after that many seconds. Throws on outage.
 */
export async function kvSetJson(key: string, obj: unknown, ttlSeconds?: number): Promise<void> {
  const payload = JSON.stringify(obj);
  if (ttlSeconds !== undefined) {
    await getRedis().set(key, payload, "EX", Math.max(1, Math.ceil(ttlSeconds)));
  } else {
    await getRedis().set(key, payload);
  }
}

/** kvGetJson reads and JSON-parses key, or returns null when absent. Throws on outage. */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

/**
 * kvGetJsonSliding reads and JSON-parses key and, when present, refreshes its
 * TTL to slidingTtlSeconds (sliding expiration for session-style entries).
 * Returns null when absent. Throws on outage.
 */
export async function kvGetJsonSliding<T>(key: string, slidingTtlSeconds: number): Promise<T | null> {
  const r = getRedis();
  const raw = await r.get(key);
  if (raw === null) return null;
  await r.expire(key, Math.max(1, Math.ceil(slidingTtlSeconds)));
  return JSON.parse(raw) as T;
}

/** kvDel deletes key. Throws on outage. */
export async function kvDel(key: string): Promise<void> {
  await getRedis().del(key);
}

/**
 * kvIncrWindow atomically increments the fixed-window counter at key and
 * sets the window TTL on the first increment (INCR + EXPIRE via Lua, so the
 * counter and its expiry can never drift apart). Returns the post-increment
 * count. Throws on outage — callers on rate-limit paths catch and fail open
 * (logged); callers on security paths (login attempts, OTP counts) catch and
 * fail closed.
 */
const INCR_WINDOW_LUA = `local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c`;

export async function kvIncrWindow(key: string, windowSeconds: number): Promise<number> {
  const res = await getRedis().eval(INCR_WINDOW_LUA, 1, key, Math.max(1, Math.ceil(windowSeconds)));
  return Number(res);
}

/**
 * tenantOf extracts the tenant scoping key for a request. Prefers the
 * explicit x-tenant-id header, then any tenantId attached by upstream auth
 * middleware, then "default" — matching the convention used across the
 * monolith (see lib/jwtAuthMiddleware.ts, lib/databasePersistence.ts).
 */
export function tenantOf(req: Request): string {
  const header = req.headers["x-tenant-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromReq = (req as Request & { tenantId?: string }).tenantId;
  return fromHeader || fromReq || "default";
}
