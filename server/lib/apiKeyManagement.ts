/**
 * API Key Management for Service-to-Service Auth
 * - Key generation, rotation, revocation
 * - Rate limiting per key
 * - Scope-based permissions
 */
import { Request, Response, NextFunction, Express } from "express";
import crypto from "crypto";
import { logger } from "./logger";

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

const apiKeys: Map<string, ApiKey> = new Map();

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): { key: string; prefix: string } {
  const prefix = "54bk_" + crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(32).toString("hex");
  return { key: `${prefix}_${secret}`, prefix };
}

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;
  if (!apiKey) return next();

  const hashed = hashApiKey(apiKey);
  let found: ApiKey | undefined;
  Array.from(apiKeys.values()).some((k) => {
    if (k.hashedKey === hashed && k.active) {
      found = k;
      return true;
    }
    return false;
  });

  if (!found) {
    return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
  }

  if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
    return res.status(401).json({ error: "API key expired", code: "KEY_EXPIRED" });
  }

  // Rate limiting
  const now = Date.now();
  if (now - found.windowStart > 60000) {
    found.requestCount = 0;
    found.windowStart = now;
  }
  found.requestCount++;
  if (found.requestCount > found.rateLimit) {
    return res.status(429).json({ error: "Rate limit exceeded", retryAfter: 60 });
  }

  found.lastUsed = new Date().toISOString();
  (req as any).apiKey = found;
  (req as any).user = { id: 0, openId: found.id, name: found.name, email: "", role: "service" };
  next();
}

export function registerApiKeyRoutes(app: Express) {
  // POST /api/auth/api-keys — generate new API key
  app.post("/api/auth/api-keys", (req: Request, res: Response) => {
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

    apiKeys.set(id, {
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

    logger.info(`API key created: ${name} (${prefix})`);
    return res.status(201).json({ id, key, prefix, name, scopes, rateLimit, expiresAt });
  });

  // GET /api/auth/api-keys — list API keys
  app.get("/api/auth/api-keys", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    const keys = Array.from(apiKeys.values()).map(k => ({
      id: k.id, name: k.name, scopes: k.scopes, rateLimit: k.rateLimit,
      createdAt: k.createdAt, expiresAt: k.expiresAt, lastUsed: k.lastUsed,
      active: k.active, requestCount: k.requestCount,
    }));
    return res.json({ keys, total: keys.length });
  });

  // DELETE /api/auth/api-keys/:id — revoke API key
  app.delete("/api/auth/api-keys/:id", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    const key = apiKeys.get(req.params.id);
    if (!key) return res.status(404).json({ error: "Key not found" });
    key.active = false;
    logger.info(`API key revoked: ${key.name}`);
    return res.json({ revoked: true, name: key.name });
  });

  // POST /api/auth/api-keys/:id/rotate — rotate API key
  app.post("/api/auth/api-keys/:id/rotate", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }

    const old = apiKeys.get(req.params.id);
    if (!old) return res.status(404).json({ error: "Key not found" });

    const { key, prefix } = generateApiKey();
    old.hashedKey = hashApiKey(key);
    logger.info(`API key rotated: ${old.name}`);
    return res.json({ id: old.id, key, prefix, name: old.name });
  });

  logger.info("API key routes registered: create, list, revoke, rotate");
}
