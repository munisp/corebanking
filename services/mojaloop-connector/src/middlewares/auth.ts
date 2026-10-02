import { createPublicKey, createVerify, KeyObject, timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import createLogger from "../config/logger.config";
import { extract_name_form_path } from "../utils/helpers";

const logger = createLogger(extract_name_form_path(__filename));

// ─────────────────────────────────────────────────────────────────────────────
// W12-B5-P0-A: route authentication for previously unauthenticated mutating
// routes (w12 findings/b3-exposure.json: POST /quotes, POST /parties/lookup).
//
// Port of the canonical services/orchestrator-service/src/middlewares/auth.ts
// pattern, adapted to this codebase (no KeycloakAdminApiClient here): RS256
// bearer tokens are verified against the fleet Keycloak realm JWKS — exactly
// like the Go fleet template's jwtAuthMiddleware.
//
// Two accepted caller classes:
//   (a) Bearer JWT (RS256) verified against the realm JWKS at
//       KEYCLOAK_REALM_URL (default http://keycloak:8080/realms/54bank);
//       kid-keyed public-key cache with refresh-on-miss; exp enforced; iss
//       enforced when KEYCLOAK_ISSUER is set.
//   (b) Shared service token: x-service-token header, timing-safe compared
//       against env SERVICE_AUTH_TOKEN. FAIL-CLOSED: when the env var is
//       unset, service-token auth is always refused.
// ─────────────────────────────────────────────────────────────────────────────

const JWKS_TTL_MS = 5 * 60 * 1000;

interface Jwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

const jwksCache = new Map<string, { key: KeyObject; fetchedAt: number }>();

function realmUrl(): string {
  return process.env.KEYCLOAK_REALM_URL || "http://keycloak:8080/realms/54bank";
}

async function fetchJwks(): Promise<void> {
  const res = await fetch(`${realmUrl()}/protocol/openid-connect/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const now = Date.now();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== "RSA" || !jwk.kid) continue;
    jwksCache.set(jwk.kid, {
      key: createPublicKey({ key: jwk as any, format: "jwk" }),
      fetchedAt: now,
    });
  }
}

async function keyForKid(kid: string): Promise<KeyObject> {
  const cached = jwksCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.key;
  await fetchJwks();
  const refreshed = jwksCache.get(kid);
  if (!refreshed) throw new Error("unknown signing key");
  return refreshed.key;
}

function decodeBase64UrlJson(part: string): any {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function verifyBearerJwt(token: string): Promise<void> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const header = decodeBase64UrlJson(parts[0]);
  if (header.alg !== "RS256") throw new Error(`Unsupported JWT alg: ${header.alg}`);

  const key = await keyForKid(header.kid);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(key, parts[2], "base64url")) {
    throw new Error("JWT signature verification failed");
  }

  const payload = decodeBase64UrlJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("JWT expired");
  }
  const expectedIss = process.env.KEYCLOAK_ISSUER;
  if (expectedIss && payload.iss !== expectedIss) {
    throw new Error("JWT issuer mismatch");
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function isValidServiceToken(req: Request): boolean {
  const expected = process.env.SERVICE_AUTH_TOKEN;
  if (!expected) {
    // Fail-closed: never allow service-token auth when unconfigured.
    return false;
  }
  const provided = req.headers["x-service-token"];
  return typeof provided === "string" && safeEqual(provided, expected);
}

/**
 * Route-level authentication (W12-B5-P0-A): verified RS256 Keycloak bearer
 * JWT, or the shared service token. Fails closed with 401 otherwise.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (isValidServiceToken(req)) {
      return next();
    }
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      await verifyBearerJwt(authorization.slice("Bearer ".length));
      return next();
    }
    throw new Error("Authentication required.");
  } catch (e: any) {
    logger.warn(`[auth] rejected ${req.method} ${req.baseUrl}${req.path}: ${e.message}`);
    res
      .status(httpStatus.UNAUTHORIZED)
      .json({ success: false, message: e.message || "Unauthorized" });
  }
}
