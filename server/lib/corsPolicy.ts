/**
 * CORS Policy Module
 * - Environment-specific origin whitelists
 * - Preflight caching
 * - Credential support
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const ALLOWED_ORIGINS: Record<string, string[]> = {
  production: [
    "https://app.54bank.ng",
    "https://admin.54bank.ng",
    "https://api.54bank.ng",
    "https://partner.54bank.ng",
  ],
  staging: [
    "https://staging.54bank.ng",
    "https://staging-admin.54bank.ng",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  development: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ],
};

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-API-Key, X-Request-Id, X-CSRF-Token, Idempotency-Key";
const MAX_AGE = "86400"; // 24 hours preflight cache

export function corsMiddleware() {
  const env = process.env.NODE_ENV || "development";
  const origins = ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else if (!origin && env !== "production") {
      // Allow same-origin requests in non-production
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    res.setHeader("Access-Control-Max-Age", MAX_AGE);
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  };
}
