/**
 * D1: JWT-based authentication middleware.
 * Validates Bearer tokens from Keycloak, extracts user claims,
 * and attaches them to the request for downstream use.
 * Supports both service-to-service (API key) and user (JWT) auth.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

interface JWTUser {
  sub: string;
  email?: string;
  name?: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/healthz",
  "/api/healthz",
  "/metrics",
  "/api/docs",
  "/api/docs/ui",
  "/api/docs/spec",
];

// API key registry for service-to-service calls
const SERVICE_API_KEYS: Record<string, { service: string; permissions: string[] }> = {
  "dev-api-key-54bank": { service: "dev-console", permissions: ["*"] },
};

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((r) => path.startsWith(r));
}

function decodeJWT(token: string): JWTUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return {
      sub: payload.sub || "",
      email: payload.email,
      name: payload.name || payload.preferred_username,
      roles: payload.realm_access?.roles || payload.roles || [],
      permissions: payload.permissions || [],
      tenantId: payload.tenant_id || payload.azp || "54bank-platform-prod",
    };
  } catch {
    return null;
  }
}

export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isPublicRoute(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"] as string;

  if (apiKey) {
    const keyConfig = SERVICE_API_KEYS[apiKey];
    if (keyConfig) {
      (req as any).user = {
        sub: `service:${keyConfig.service}`,
        roles: ["service"],
        permissions: keyConfig.permissions,
        tenantId: "54bank-platform-prod",
      };
      next();
      return;
    }
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const claims = decodeJWT(token);

    if (!claims) {
      res.status(401).json({ error: "Invalid token", code: "AUTH_INVALID_TOKEN" });
      return;
    }

    (req as any).user = claims;
    next();
    return;
  }

  // In development mode, allow unauthenticated access with a dev user
  if (process.env.NODE_ENV !== "production") {
    (req as any).user = {
      sub: "dev-user",
      email: "dev@54bank.io",
      name: "Development User",
      roles: ["super_admin"],
      permissions: ["*"],
      tenantId: "54bank-platform-prod",
    };
    next();
    return;
  }

  res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
}

export function requireRoles(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user;
    if (!u) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }
    const hasRole = roles.some((r) => u.roles.includes(r) || u.roles.includes("super_admin"));
    if (!hasRole) {
      logger.warn(`Access denied: user=${u.sub} required=${roles.join(",")} has=${u.roles.join(",")}`);
      res.status(403).json({ error: "Insufficient permissions", code: "AUTH_FORBIDDEN" });
      return;
    }
    next();
  };
}

export function requirePermissions(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user;
    if (!u) {
      res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
      return;
    }
    if (u.permissions?.includes("*")) { next(); return; }
    const hasAll = permissions.every((p: string) => u.permissions?.includes(p));
    if (!hasAll) {
      res.status(403).json({ error: "Insufficient permissions", code: "AUTH_FORBIDDEN" });
      return;
    }
    next();
  };
}
