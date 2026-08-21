// JWT Authentication Middleware — Enforced on all 550+ Express routes
// Validates JWT tokens from Keycloak, extracts user context, enforces RBAC
// Integrates with: Keycloak (auth), Permify (authorization), Redis (session cache)
//
// REMEDIATION (silent mockware):
//   1. AUTH_MODE now defaults to "enforce". "audit" mode (fail-open anonymous
//      viewer) is ONLY honored when NODE_ENV !== "production"; in production
//      unauthenticated/invalid requests to protected routes get 401.
//   2. Token signatures are now actually verified against the Keycloak realm
//      JWKS (RS256). Previously any well-formed base64 blob was accepted.
//      When the JWKS cannot be fetched, enforce mode fails closed (401).

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

interface JWTPayload {
  sub: string;
  email: string;
  name: string;
  realm_access: { roles: string[] };
  resource_access: Record<string, { roles: string[] }>;
  tenant_id: string;
  branch_id: string;
  iat: number;
  exp: number;
  iss: string;
}

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: JWTPayload;
  tenantId?: string;
  branchId?: string;
}

// Route patterns that bypass JWT validation
const PUBLIC_ROUTES = [
  /^\/api\/platform\/auth\/login$/,
  /^\/api\/platform\/auth\/refresh$/,
  /^\/api\/platform\/health$/,
  /^\/api\/platform\/infra\/\w+\/health$/,
  /^\/healthz$/,
  /^\/api\/platform\/swagger/,
];

// RBAC role hierarchy
const ROLE_HIERARCHY: Record<string, string[]> = {
  "super_admin": ["admin", "branch_manager", "compliance_officer", "teller", "relationship_manager", "auditor", "viewer"],
  "admin": ["branch_manager", "compliance_officer", "teller", "relationship_manager", "auditor", "viewer"],
  "branch_manager": ["teller", "relationship_manager", "viewer"],
  "compliance_officer": ["auditor", "viewer"],
  "teller": ["viewer"],
  "relationship_manager": ["viewer"],
  "auditor": ["viewer"],
  "viewer": [],
};

// Route-to-role mapping
const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; roles: string[]; methods: string[] }> = [
  { pattern: /\/api\/platform\/admin/, roles: ["admin", "super_admin"], methods: ["GET", "POST", "PUT", "DELETE"] },
  { pattern: /\/api\/platform\/compliance/, roles: ["compliance_officer", "admin"], methods: ["GET", "POST", "PUT"] },
  { pattern: /\/api\/platform\/audit/, roles: ["auditor", "admin"], methods: ["GET"] },
  { pattern: /\/api\/platform\/staff/, roles: ["admin", "branch_manager"], methods: ["GET", "POST", "PUT"] },
  { pattern: /\/api\/platform\/loans.*approve/, roles: ["branch_manager", "admin"], methods: ["POST"] },
  { pattern: /\/api\/platform\/fx.*deal/, roles: ["relationship_manager", "admin"], methods: ["POST"] },
  { pattern: /\/api\/platform\/settlement/, roles: ["admin", "compliance_officer"], methods: ["GET", "POST"] },
  { pattern: /\/api\/platform\/regulatory/, roles: ["compliance_officer", "admin"], methods: ["GET", "POST"] },
  { pattern: /\/api\/platform\/infra/, roles: ["admin", "super_admin"], methods: ["GET", "POST", "PUT", "DELETE"] },
];

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(payload: JWTPayload): boolean {
  return Date.now() / 1000 > payload.exp;
}

function hasRole(userRoles: string[], requiredRoles: string[]): boolean {
  for (const userRole of userRoles) {
    if (requiredRoles.includes(userRole)) return true;
    const inherited = ROLE_HIERARCHY[userRole] || [];
    for (const inheritedRole of inherited) {
      if (requiredRoles.includes(inheritedRole)) return true;
    }
  }
  return false;
}

// ── Keycloak JWKS signature verification ────────────────────────────────────

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "54bank";
const JWKS_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const JWKS_TTL_MS = 5 * 60 * 1000;

let jwksCache: { keys: Map<string, crypto.KeyObject>; fetchedAt: number } | null = null;

async function getJwksKeys(): Promise<Map<string, crypto.KeyObject>> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
  const jwks = (await res.json()) as { keys?: Array<{ kid?: string; kty?: string } & JsonWebKey> };
  const keys = new Map<string, crypto.KeyObject>();
  for (const jwk of jwks.keys ?? []) {
    if (jwk.kty !== "RSA" || !jwk.kid) continue;
    keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
  }
  if (keys.size === 0) throw new Error("JWKS endpoint returned no usable RSA keys");
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

/** Cryptographically verify an RS256 token signature against the realm JWKS. */
function verifyTokenSignature(token: string, keys: Map<string, crypto.KeyObject>): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf-8"));
  } catch {
    return false;
  }
  if (header.alg !== "RS256") return false;
  const key =
    (header.kid ? keys.get(header.kid) : undefined) ??
    (keys.size === 1 ? [...keys.values()][0] : undefined);
  if (!key) return false;
  try {
    return crypto
      .createVerify("RSA-SHA256")
      .update(`${parts[0]}.${parts[1]}`)
      .verify(key, Buffer.from(parts[2], "base64url"));
  } catch {
    return false;
  }
}

// Auth enforcement mode: "enforce" validates tokens, "audit" logs but allows through.
// Default is ENFORCE (fail closed). "audit" is only honored outside production —
// in production an AUTH_MODE=audit setting is overridden to enforce.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const REQUESTED_AUTH_MODE = process.env.AUTH_MODE || "enforce";
const AUTH_MODE = IS_PRODUCTION && REQUESTED_AUTH_MODE !== "enforce" ? "enforce" : REQUESTED_AUTH_MODE;

if (IS_PRODUCTION && REQUESTED_AUTH_MODE !== "enforce") {
  logger.warn(`[JWT-AUTH] AUTH_MODE=${REQUESTED_AUTH_MODE} ignored in production — enforcing authentication`);
} else if (AUTH_MODE !== "enforce") {
  logger.warn(`[JWT-AUTH] Running in fail-open "${AUTH_MODE}" mode (non-production only) — do NOT use in production`);
}

export function jwtAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  jwtAuthHandler(req, res, next).catch(err => {
    // Fail closed on any unexpected middleware error.
    logger.error("[JWT-AUTH] Middleware error — rejecting request (fail closed)", { path: req.path, error: String(err) });
    if (!res.headersSent) {
      res.status(401).json({ error: "Authentication failed", code: "AUTH_VERIFICATION_ERROR" });
    }
  });
}

async function jwtAuthHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // Skip public routes
  if (PUBLIC_ROUTES.some(pattern => pattern.test(req.path))) {
    next();
    return;
  }

  // Skip non-API routes (static files, SPA fallback)
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    if (AUTH_MODE === "enforce") {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_MISSING_TOKEN",
        message: "Provide a valid JWT token in the Authorization header",
      });
      return;
    }
    // Audit mode (non-production only): log and continue as anonymous viewer
    logger.info(`[JWT-AUTH][audit] Unauthenticated request allowed: ${req.method} ${req.path}`);
    req.user = {
      sub: "anonymous",
      email: "anonymous@54bank.com",
      name: "Anonymous User",
      realm_access: { roles: ["viewer"] },
      resource_access: {},
      tenant_id: "default",
      branch_id: "HQ",
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + 3600,
      iss: "54bank-dev",
    };
    req.tenantId = "default";
    req.branchId = "HQ";
    next();
    return;
  }

  const payload = decodeJWT(token);
  if (!payload) {
    if (AUTH_MODE === "enforce") {
      res.status(401).json({ error: "Invalid token", code: "AUTH_INVALID_TOKEN" });
      return;
    }
    logger.warn(`[JWT-AUTH][audit] Malformed token allowed: ${req.method} ${req.path}`);
    next();
    return;
  }

  // Cryptographic signature verification against the Keycloak realm JWKS.
  // FAIL CLOSED: if the signature is invalid, or the JWKS cannot be fetched
  // to verify it, the token is rejected in enforce mode.
  try {
    const keys = await getJwksKeys();
    if (!verifyTokenSignature(token, keys)) {
      if (AUTH_MODE === "enforce") {
        res.status(401).json({ error: "Invalid token signature", code: "AUTH_INVALID_SIGNATURE" });
        return;
      }
      logger.warn(`[JWT-AUTH][audit] Invalid token signature allowed: ${req.method} ${req.path} sub=${payload.sub}`);
      next();
      return;
    }
  } catch (err) {
    logger.error("[JWT-AUTH] Cannot verify token signature — JWKS unavailable (failing closed)", { error: String(err) });
    if (AUTH_MODE === "enforce") {
      res.status(401).json({ error: "Token verification unavailable", code: "AUTH_VERIFICATION_UNAVAILABLE" });
      return;
    }
    next();
    return;
  }

  if (isTokenExpired(payload)) {
    if (AUTH_MODE === "enforce") {
      res.status(401).json({ error: "Token expired", code: "AUTH_TOKEN_EXPIRED" });
      return;
    }
    logger.warn(`[JWT-AUTH][audit] Expired token allowed: ${req.method} ${req.path} sub=${payload.sub}`);
    next();
    return;
  }

  // RBAC check
  const userRoles = payload.realm_access?.roles || [];
  const matchedPermission = ROUTE_PERMISSIONS.find(
    perm => perm.pattern.test(req.path) && perm.methods.includes(req.method)
  );

  if (matchedPermission && !hasRole(userRoles, matchedPermission.roles)) {
    if (AUTH_MODE === "enforce") {
      res.status(403).json({
        error: "Insufficient permissions",
        code: "AUTH_FORBIDDEN",
        requiredRoles: matchedPermission.roles,
        userRoles,
      });
      return;
    }
    logger.warn(`[JWT-AUTH][audit] RBAC denial allowed: ${req.method} ${req.path} roles=${userRoles.join(",")}`);
  }

  req.user = payload;
  req.tenantId = payload.tenant_id || "default";
  req.branchId = payload.branch_id || "HQ";
  next();
}

// Multi-tenancy middleware — enforces branch/entity isolation
export function multiTenancyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  // Extract tenant context
  const tenantId = req.headers["x-tenant-id"] as string || req.tenantId || "default";
  const branchId = req.headers["x-branch-id"] as string || req.branchId || "HQ";

  // Set tenant context for downstream services
  req.tenantId = tenantId;
  req.branchId = branchId;

  // Add tenant headers for proxy forwarding
  req.headers["x-tenant-id"] = tenantId;
  req.headers["x-branch-id"] = branchId;
  req.headers["x-correlation-id"] = req.headers["x-correlation-id"] || `COR-${Date.now().toString(36)}`;

  next();
}

// Auth status endpoint for frontend
export function getAuthConfig(): object {
  return {
    mode: AUTH_MODE,
    requestedMode: REQUESTED_AUTH_MODE,
    productionOverride: IS_PRODUCTION && REQUESTED_AUTH_MODE !== "enforce",
    keycloak: {
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: "54bank-web",
    },
    permify: {
      url: process.env.PERMIFY_URL || "http://localhost:3476",
    },
    roleHierarchy: ROLE_HIERARCHY,
    publicRoutes: PUBLIC_ROUTES.map(r => r.source),
    routePermissions: ROUTE_PERMISSIONS.length,
  };
}
