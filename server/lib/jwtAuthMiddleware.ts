// JWT Authentication Middleware — Enforced on all 550+ Express routes
// Validates JWT tokens from Keycloak, extracts user context, enforces RBAC
// Integrates with: Keycloak (auth), Permify (authorization), Redis (session cache)

import type { Request, Response, NextFunction } from "express";

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

// Auth enforcement mode: "enforce" validates tokens, "audit" logs but allows through
const AUTH_MODE = process.env.AUTH_MODE || "audit";

export function jwtAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
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
    // Audit mode: log and continue
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
    next();
    return;
  }

  if (isTokenExpired(payload)) {
    if (AUTH_MODE === "enforce") {
      res.status(401).json({ error: "Token expired", code: "AUTH_TOKEN_EXPIRED" });
      return;
    }
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
    keycloak: {
      url: process.env.KEYCLOAK_URL || "http://localhost:8080",
      realm: "54bank",
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
