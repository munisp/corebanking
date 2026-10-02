import { createHmac, createVerify, timingSafeEqual } from "crypto";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import logger from "../config/logger.config";
import { readEnv } from "../config/readEnv.config";
import { KeycloakAdminApiClient } from "../lib/keycloakAdminApiClient";
import { ApiError } from "./error";

// ─────────────────────────────────────────────────────────────────────────────
// OB-01: Service authentication for every orchestrator onboarding entrypoint.
//
// Two accepted caller classes on non-callback routes:
//   (a) a platform-API JWT (RS256) verified against the tenant realm's active
//       Keycloak public key (cached, same source as provisioning), or
//   (b) the shared service token (env ORCHESTRATOR_SERVICE_TOKEN, fail-fast at
//       boot when unset via EnvSchema).
//
// KYC/KYB callback routes (*/kyc/callback, */kyb/callback) instead require an
// HMAC-SHA256 signature over the raw request body in the
// `x-callback-signature` header, keyed with env CALLBACK_HMAC_SECRET
// (fail-fast at boot when unset).
//
// Tenant identity: for JWT callers the tenant is DERIVED from the verified
// token claims; the caller-supplied x-tenant-id header is only honoured for
// service-token callers.
// ─────────────────────────────────────────────────────────────────────────────

export type CallerType = "jwt" | "service" | "callback";

export interface AuthContext {
  callerType: CallerType;
  /** Verified tenant id (JWT claim) — undefined for service-token callers. */
  tenantId?: string;
  subject?: string;
  roles: string[];
}

const LOCALS_KEY = "orchestratorAuth";

/** Roles accepted for platform-operator-only routes (PL-02 decommission). */
const PLATFORM_OPERATOR_ROLES = new Set([
  "platform_operator",
  "platform-admin",
  "super_admin",
  "superadmin",
]);

// ── Keycloak realm public-key cache (pattern per keycloakAdminApiClient) ────
const PUBLIC_KEY_TTL_MS = 10 * 60 * 1000;
const publicKeyCache = new Map<string, { pem: string; fetchedAt: number }>();

async function getRealmPublicKeyPem(realm: string): Promise<string> {
  const cached = publicKeyCache.get(realm);
  if (cached && Date.now() - cached.fetchedAt < PUBLIC_KEY_TTL_MS) {
    return cached.pem;
  }
  const key = await KeycloakAdminApiClient.get_instance().get_public_rsa_key(realm);
  const pem = `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
  publicKeyCache.set(realm, { pem, fetchedAt: Date.now() });
  return pem;
}

function decodeBase64UrlJson(part: string): any {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function extractRoles(payload: any): string[] {
  const roles = new Set<string>();
  const add = (r: unknown) => {
    if (typeof r === "string" && r) roles.add(r);
  };
  if (Array.isArray(payload?.realm_access?.roles)) {
    payload.realm_access.roles.forEach(add);
  }
  if (payload?.resource_access && typeof payload.resource_access === "object") {
    for (const clientName of Object.keys(payload.resource_access)) {
      const client = payload.resource_access[clientName];
      if (Array.isArray(client?.roles)) client.roles.forEach(add);
    }
  }
  add(payload?.role);
  add(payload?.platform_role);
  add(payload?.tenant_role);
  return [...roles];
}

interface VerifiedJwt {
  tenantId: string;
  subject?: string;
  roles: string[];
}

async function verifyPlatformJwt(token: string): Promise<VerifiedJwt> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");

  const header = decodeBase64UrlJson(parts[0]);
  if (header.alg !== "RS256") throw new Error(`Unsupported JWT alg: ${header.alg}`);

  // Decode (unverified) to locate the tenant realm whose key must verify it.
  const payload = decodeBase64UrlJson(parts[1]);
  const tenantId: string | undefined = payload.tenant_id ?? payload.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("JWT has no tenant_id claim");
  }

  const realm = `54link_${tenantId}`;
  const pem = await getRealmPublicKeyPem(realm);

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(pem, parts[2], "base64url")) {
    throw new Error("JWT signature verification failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("JWT expired");
  }
  if (payload.iss && typeof payload.iss === "string" && !payload.iss.endsWith(`/realms/${realm}`)) {
    throw new Error("JWT issuer does not match tenant realm");
  }

  return { tenantId, subject: payload.sub, roles: extractRoles(payload) };
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function isValidServiceToken(req: Request): boolean {
  const expected = readEnv("ORCHESTRATOR_SERVICE_TOKEN") as string | undefined;
  if (!expected) {
    // Fail-closed: EnvSchema already aborts boot when unset; never allow.
    logger.error("[auth] ORCHESTRATOR_SERVICE_TOKEN unset — refusing service-token auth");
    return false;
  }
  const provided = req.headers["x-service-token"];
  return typeof provided === "string" && safeEqual(provided, expected);
}

function isCallbackRoute(req: Request): boolean {
  // req.path is relative to the mount point (setupRoutes).
  return /^\/(kyc|kyb)\/callback\/?$/.test(req.path);
}

function verifyCallbackSignature(req: Request): boolean {
  const secret = readEnv("CALLBACK_HMAC_SECRET") as string | undefined;
  if (!secret) {
    logger.error("[auth] CALLBACK_HMAC_SECRET unset — refusing callback");
    return false;
  }
  const signature = req.headers["x-callback-signature"];
  if (typeof signature !== "string" || !signature) return false;

  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    logger.error("[auth] raw body unavailable for HMAC verification");
    return false;
  }
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedB64 = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(signature, expectedHex) || safeEqual(signature, expectedB64);
}

function setAuthContext(res: Response, ctx: AuthContext): void {
  res.locals[LOCALS_KEY] = ctx;
}

export function getAuthContext(res: Response): AuthContext | undefined {
  return res.locals[LOCALS_KEY] as AuthContext | undefined;
}

/**
 * OB-01: tenant resolution. JWT callers get the claim-derived tenant;
 * service-token callers may assert a tenant via x-tenant-id.
 * Throws ApiError(400) when no tenant can be established.
 */
export function resolveTenantId(req: Request, res: Response): string {
  const ctx = getAuthContext(res);
  if (ctx?.callerType === "jwt" && ctx.tenantId) return ctx.tenantId;
  if (ctx?.callerType === "service") {
    const headerTenant = req.headers["x-tenant-id"];
    if (typeof headerTenant === "string" && headerTenant) return headerTenant;
  }
  throw new ApiError(httpStatus.BAD_REQUEST, "Tenant ID could not be established from the authenticated caller.");
}

/**
 * Mount-level authentication dispatcher (OB-01): HMAC for KYC/KYB callbacks,
 * JWT-or-service-token for everything else.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (isCallbackRoute(req)) {
      if (!verifyCallbackSignature(req)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or missing callback signature.");
      }
      setAuthContext(res, { callerType: "callback", roles: [] });
      return next();
    }

    if (isValidServiceToken(req)) {
      setAuthContext(res, { callerType: "service", roles: ["service"] });
      return next();
    }

    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      const verified = await verifyPlatformJwt(authorization.slice("Bearer ".length));
      setAuthContext(res, {
        callerType: "jwt",
        tenantId: verified.tenantId,
        subject: verified.subject,
        roles: verified.roles,
      });
      return next();
    }

    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required.");
  } catch (e: any) {
    const status = e instanceof ApiError ? e.statusCode : httpStatus.UNAUTHORIZED;
    logger.warn(`[auth] rejected ${req.method} ${req.baseUrl}${req.path}: ${e.message}`);
    res.status(status).json({ success: false, message: e.message || "Unauthorized" });
    return;
  }
}

/**
 * PL-02: restrict a route to platform operators (JWT callers whose verified
 * token carries a platform-operator role). Service tokens are NOT accepted —
 * decommission is an interactive, audited operator action.
 */
export function requirePlatformOperator(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ctx = getAuthContext(res);
  if (ctx?.callerType === "jwt" && ctx.roles.some((r) => PLATFORM_OPERATOR_ROLES.has(r))) {
    return next();
  }
  res
    .status(httpStatus.FORBIDDEN)
    .json({ success: false, message: "Platform operator role required." });
}
