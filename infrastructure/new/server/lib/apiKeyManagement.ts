/**
 * API Key Management for Service-to-Service Auth
 * - Key generation, rotation, revocation
 * - Rate limiting per key
 * - Scope-based permissions
 *
 * W12 C3-P1-B2 (c3-1029): the API-key registry is redis-backed (register had
 * no key_pattern for this item; chosen pattern documented here):
 *   apikey:{id}            JSON ApiKey record (no TTL — expiry is field-driven
 *                          via expiresAt, preserving previous behavior)
 *   apikey:hash:{sha256}   → key id (O(1) credential lookup index)
 *   apikeys:index          SET of key ids (listing)
 *   ratelimit:apikey:{id}  per-key fixed-window counter, TTL 60s
 * Keys now survive restarts and are consistent across replicas; previously a
 * restart silently dropped every issued service credential (or resurrected
 * revoked keys on a stale replica).
 * FAIL MODE: redis down => validateApiKey fails closed (503) — a credential
 * check is never silently skipped.
 */
import { Request, Response, NextFunction, Express } from "express";
import crypto from "crypto";
import { logger } from "./logger";
import { getRedis, kvGet, kvGetJson, kvSetJson, kvDel, kvIncrWindow } from "./redisKv";

interface ApiKey {
  id: string;
  hashedKey: string;
  name: string;
  scopes: string[];
  rateLimit: number; // requests per minute
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
  active: boolean;
  requestCount: number;
  windowStart: number;
}

const KEY_INDEX = "apikeys:index";
const keyById = (id: string) => `apikey:${id}`;
const keyByHash = (hashed: string) => `apikey:hash:${hashed}`;

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): { key: string; prefix: string } {
  const prefix = "54bk_" + crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(32).toString("hex");
  return { key: `${prefix}_${secret}`, prefix };
}

async function putApiKey(record: ApiKey): Promise<void> {
  const r = getRedis();
  await kvSetJson(keyById(record.id), record);
  await r.set(keyByHash(record.hashedKey), record.id);
  await r.sadd(KEY_INDEX, record.id);
}

export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return next();

  const hashed = hashApiKey(apiKey);
  let found: ApiKey | null = null;
  try {
    const id = await kvGet(keyByHash(hashed));
    if (id) {
      const record = await kvGetJson<ApiKey>(keyById(id));
      if (record && record.hashedKey === hashed && record.active) found = record;
    }
  } catch (err) {
    // FAIL CLOSED: credential state unreachable — do not authenticate, and do
    // not fall through to an unauthenticated request either.
    logger.error("[ApiKey] credential lookup failed — failing closed", { error: String(err) });
    return res.status(503).json({ error: "API key state unavailable", code: "APIKEY_STATE_UNAVAILABLE" });
  }

  if (!found) {
    return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
  }

  if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
    return res.status(401).json({ error: "API key expired", code: "KEY_EXPIRED" });
  }

  // Rate limiting (per-key fixed 60s window, redis-backed)
  try {
    const count = await kvIncrWindow(`ratelimit:apikey:${found.id}`, 60);
    if (count > found.rateLimit) {
      return res.status(429).json({ error: "Rate limit exceeded", retryAfter: 60 });
    }
    found.requestCount = count;
  } catch (err) {
    logger.error("[ApiKey] rate-limit counter failed — failing closed", { error: String(err) });
    return res.status(503).json({ error: "API key state unavailable", code: "APIKEY_STATE_UNAVAILABLE" });
  }

  found.lastUsed = new Date().toISOString();
  found.windowStart = Date.now();
  // Persist lastUsed/requestCount best-effort (telemetry, not security state).
  await kvSetJson(keyById(found.id), found).catch((err) => logger.warn("[ApiKey] usage persist failed", { error: String(err) }));
  (req as any).apiKey = found;
  (req as any).user = { id: 0, openId: found.id, name: found.name, email: "", role: "service" };
  next();
}

export function registerApiKeyRoutes(app: Express) {
  // POST /api/auth/api-keys — generate new API key
  app.post("/api/auth/api-keys", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    const { name, scopes = ["read:*"], rateLimit = 1000, expiresInDays } = req.body;
    if (!name) return res.status(400).json({ error: "Key name required" });

    const { key, prefix } = generateApiKey();
    const id = crypto.randomUUID();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    try {
      await putApiKey({
        id,
        hashedKey: hashApiKey(key),
        name,
        scopes,
        rateLimit,
        createdAt: new Date().toISOString(),
        expiresAt,
        lastUsed: null,
        active: true,
        requestCount: 0,
        windowStart: Date.now(),
      });
    } catch (err) {
      logger.error("[ApiKey] create failed", { error: String(err) });
      return res.status(503).json({ error: "API key state unavailable", code: "APIKEY_STATE_UNAVAILABLE" });
    }

    logger.info(`API key created: ${name} (${prefix})`);
    return res.status(201).json({ id, key, prefix, name, scopes, rateLimit, expiresAt });
  });

  // GET /api/auth/api-keys — list API keys
  app.get("/api/auth/api-keys", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    try {
      const ids = await getRedis().smembers(KEY_INDEX);
      const keys: Array<Partial<ApiKey>> = [];
      for (const id of ids) {
        const k = await kvGetJson<ApiKey>(keyById(id));
        if (!k) {
          await getRedis().srem(KEY_INDEX, id);
          continue;
        }
        keys.push({
          id: k.id, name: k.name, scopes: k.scopes, rateLimit: k.rateLimit,
          createdAt: k.createdAt, expiresAt: k.expiresAt, lastUsed: k.lastUsed,
          active: k.active, requestCount: k.requestCount,
        });
      }
      return res.json({ keys, total: keys.length });
    } catch (err) {
      return res.status(503).json({ error: "API key state unavailable", code: "APIKEY_STATE_UNAVAILABLE" });
    }
  });

  // DELETE /api/auth/api-keys/:id — revoke API key
  app.delete("/api/auth/api-keys/:id", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    try {
      const key = await kvGetJson<ApiKey>(keyById(req.params.id));
      if (!key) return res.status(404).json({ error: "Key not found" });
      key.active = false;
      await kvSetJson(keyById(key.id), key);
      logger.info(`API key revoked: ${key.name}`);
      return res.json({ revoked: true, name: key.name });
    } catch (err) {
      // FAIL CLOSED: a revocation that cannot be persisted must not pretend success.
      return res.status(503).json({ error: "API key revocation unavailable", code: "REVOCATION_UNAVAILABLE" });
    }
  });

  // POST /api/auth/api-keys/:id/rotate — rotate API key
  app.post("/api/auth/api-keys/:id/rotate", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    try {
      const old = await kvGetJson<ApiKey>(keyById(req.params.id));
      if (!old) return res.status(404).json({ error: "Key not found" });

      const { key, prefix } = generateApiKey();
      await kvDel(keyByHash(old.hashedKey));
      old.hashedKey = hashApiKey(key);
      await putApiKey(old);
      logger.info(`API key rotated: ${old.name}`);
      return res.json({ id: old.id, key, prefix, name: old.name });
    } catch (err) {
      return res.status(503).json({ error: "API key state unavailable", code: "APIKEY_STATE_UNAVAILABLE" });
    }
  });

  logger.info("API key routes registered: create, list, revoke, rotate");
}
