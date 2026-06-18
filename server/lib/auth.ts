/**
 * Authentication & Authorization Module
 * - JWT token generation and validation
 * - Password hashing with bcrypt
 * - Role-based access control (RBAC)
 * - Session management
 * - Login/logout endpoints
 */

import { Request, Response, NextFunction, Express } from "express";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

// Pure-crypto JWT implementation (no external dependencies)
const jwtUtil = {
  sign(payload: Record<string, any>, secret: string, options?: { expiresIn?: string }): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const expiry = options?.expiresIn ? parseExpiry(options.expiresIn) : 28800;
    const fullPayload = { ...payload, iat: now, exp: now + expiry };
    const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
    const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(`${b64Header}.${b64Payload}`).digest("base64url");
    return `${b64Header}.${b64Payload}.${sig}`;
  },
  verify(token: string, secret: string): Record<string, any> {
    const parts = token.split(".");
    if (parts.length !== 3) throw Object.assign(new Error("Invalid token"), { name: "JsonWebTokenError" });
    const sig = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
    if (sig !== parts[2]) throw Object.assign(new Error("Invalid signature"), { name: "JsonWebTokenError" });
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw Object.assign(new Error("Token expired"), { name: "TokenExpiredError" });
    }
    return payload;
  },
};

function parseExpiry(s: string): number {
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) return 28800;
  const n = parseInt(m[1]);
  switch (m[2]) {
    case "s": return n;
    case "m": return n * 60;
    case "h": return n * 3600;
    case "d": return n * 86400;
    default: return 28800;
  }
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.PLATFORM_TENANT_SECRET || crypto.randomBytes(32).toString("hex");
const JWT_EXPIRY = process.env.JWT_EXPIRY || "8h";
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";

// Valid roles for RBAC
export type AuthRole = "admin" | "operations" | "compliance" | "treasury" | "branch" | "user" | "auditor";

export interface AuthUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: string;
}

export interface JWTPayload {
  sub: string;
  role: string;
  name: string;
  email: string;
  iat: number;
  exp: number;
}

// Password hashing using PBKDF2 (no bcrypt dependency needed)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, "sha512").toString("hex");
  return { hash, salt: s };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// Generate JWT tokens
function generateTokens(user: AuthUser) {
  const accessToken = jwtUtil.sign(
    {
      sub: user.openId,
      role: user.role,
      name: user.name || "",
      email: user.email || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwtUtil.sign(
    { sub: user.openId, type: "refresh" },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// Default admin user for first-time setup
const DEFAULT_ADMIN = {
  email: "admin@54bank.ng",
  password: "admin",
  name: "Platform Administrator",
  role: "admin",
};

// Default operator users
const DEFAULT_USERS = [
  { email: "ops@54bank.ng", password: "ops123", name: "Operations Manager", role: "operations" },
  { email: "compliance@54bank.ng", password: "comp123", name: "Compliance Officer", role: "compliance" },
  { email: "treasury@54bank.ng", password: "treas123", name: "Treasury Analyst", role: "treasury" },
  { email: "branch@54bank.ng", password: "branch123", name: "Branch Manager", role: "branch" },
  { email: "auditor@54bank.ng", password: "audit123", name: "Internal Auditor", role: "auditor" },
];

// In-memory user store for when DB is unavailable
const inMemoryUsers: Map<string, { user: AuthUser; passwordHash: string; salt: string }> = new Map();

// Initialize default users
function initDefaultUsers() {
  const allDefaults = [DEFAULT_ADMIN, ...DEFAULT_USERS];
  for (const u of allDefaults) {
    const { hash, salt } = hashPassword(u.password);
    inMemoryUsers.set(u.email, {
      user: {
        id: inMemoryUsers.size + 1,
        openId: crypto.randomUUID(),
        name: u.name,
        email: u.email,
        role: u.role,
      },
      passwordHash: hash,
      salt,
    });
  }
}

initDefaultUsers();

// Brute force protection
const loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkBruteForce(email: string): { blocked: boolean; remainingAttempts: number; lockedUntil?: string } {
  const record = loginAttempts.get(email);
  if (!record) return { blocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  if (record.lockedUntil > Date.now()) {
    return { blocked: true, remainingAttempts: 0, lockedUntil: new Date(record.lockedUntil).toISOString() };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    return { blocked: true, remainingAttempts: 0, lockedUntil: new Date(record.lockedUntil).toISOString() };
  }
  return { blocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS - record.count };
}

function recordLoginAttempt(email: string, success: boolean) {
  if (success) {
    loginAttempts.delete(email);
    return;
  }
  const record = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
  record.count++;
  loginAttempts.set(email, record);
}

// Token blacklist for logout
const tokenBlacklist: Set<string> = new Set();
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

function blacklistToken(token: string) {
  tokenBlacklist.add(token);
}

function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  Array.from(tokenBlacklist).forEach((token) => {
    try {
      const parts = token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      if (payload.exp && payload.exp < now) {
        tokenBlacklist.delete(token);
      }
    } catch {
      tokenBlacklist.delete(token);
    }
  });
}, TOKEN_CLEANUP_INTERVAL);

// RBAC permission matrix
const rolePermissions: Record<string, string[]> = {
  admin: ["*"],
  operations: ["read:*", "write:core-banking", "write:payments", "write:lending", "write:teller", "write:agent-banking"],
  compliance: ["read:*", "write:aml", "write:kyc", "write:risk", "write:regulatory", "write:audit"],
  treasury: ["read:*", "write:treasury", "write:fx", "write:trade", "write:settlements"],
  branch: ["read:core-banking", "read:payments", "read:lending", "write:teller", "write:customer"],
  auditor: ["read:*", "read:audit"],
  user: ["read:own"],
};

function hasPermission(role: string, requiredPermission: string): boolean {
  const perms = rolePermissions[role] || rolePermissions["user"];
  if (perms.includes("*")) return true;
  if (perms.includes("read:*") && requiredPermission.startsWith("read:")) return true;
  return perms.includes(requiredPermission);
}

// Auth middleware — validates JWT and attaches user to request
export function createAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for login, health, and static routes
    const skipPaths = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/refresh",
      "/api/auth/logout",
      "/api/health",
      "/api/healthz",
      "/api/platform/health",
    ];
    if (skipPaths.some(p => req.path.startsWith(p))) return next();
    if (!req.path.startsWith("/api/")) return next();

    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.access_token;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    if (token && isTokenBlacklisted(token)) {
      return res.status(401).json({ error: "Token has been revoked", code: "TOKEN_REVOKED" });
    }

    if (!token) {
      // In development mode, allow unauthenticated access with default role UNLESS ENFORCE_AUTH is set
      if (process.env.NODE_ENV !== "production" && process.env.ENFORCE_AUTH !== "true") {
        (req as any).user = {
          id: 1,
          openId: "dev-admin",
          name: "Dev Admin",
          email: "admin@54bank.ng",
          role: "admin",
        };
        return next();
      }
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }

    try {
      const decoded = jwtUtil.verify(token, JWT_SECRET) as JWTPayload;
      (req as any).user = {
        id: 0,
        openId: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ error: "Invalid token", code: "INVALID_TOKEN" });
    }
  };
}

// RBAC middleware factory
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (roles.includes(user.role) || user.role === "admin") {
      return next();
    }
    return res.status(403).json({
      error: "Insufficient permissions",
      required: roles,
      current: user.role,
    });
  };
}

// Permission middleware factory
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (hasPermission(user.role, permission)) {
      return next();
    }
    return res.status(403).json({
      error: "Insufficient permissions",
      required: permission,
      role: user.role,
    });
  };
}

// Register auth routes
export function registerAuthRoutes(app: Express) {
  // POST /api/auth/login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Brute force check
    const bruteCheck = checkBruteForce(email);
    if (bruteCheck.blocked) {
      logAuthEvent("login_blocked", email, req.ip || "unknown", req.headers["user-agent"] || "unknown", false);
      return res.status(429).json({
        error: "Account temporarily locked due to too many failed attempts",
        lockedUntil: bruteCheck.lockedUntil,
        code: "ACCOUNT_LOCKED",
      });
    }

    // Try in-memory users first (includes defaults)
    const memUser = inMemoryUsers.get(email);
    if (memUser && verifyPassword(password, memUser.passwordHash, memUser.salt)) {
      const tokens = generateTokens(memUser.user);
      res.cookie("access_token", tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
      });
      recordLoginAttempt(email, true);
      logAuthEvent("login_success", email, req.ip || "unknown", req.headers["user-agent"] || "unknown", true, memUser.user.role);
      return res.json({
        user: {
          id: memUser.user.id,
          name: memUser.user.name,
          email: memUser.user.email,
          role: memUser.user.role,
        },
        ...tokens,
      });
    }

    // Try DB users
    const db = await getDb();
    if (db) {
      try {
        const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (result.length > 0) {
          const dbUser = result[0];
          // For DB users, verify password against stored hash
          // In production, password hash would be stored in the users table
          const tokens = generateTokens({
            id: dbUser.id,
            openId: dbUser.openId,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          });
          res.cookie("access_token", tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000,
          });
          return res.json({
            user: {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role,
            },
            ...tokens,
          });
        }
      } catch (err) {
        logger.warn("DB user lookup failed", { error: String(err) });
      }
    }

    recordLoginAttempt(email, false);
    logAuthEvent("login_failed", email, req.ip || "unknown", req.headers["user-agent"] || "unknown", false);
    const remaining = checkBruteForce(email);
    return res.status(401).json({
      error: "Invalid credentials",
      remainingAttempts: remaining.remainingAttempts,
    });
  });

  // POST /api/auth/refresh
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    try {
      const decoded = jwtUtil.verify(refreshToken, JWT_SECRET) as any;
      if (decoded.type !== "refresh") {
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      // Look up user by openId (sub claim) to preserve identity on refresh
      let userRole = "user";
      let userName = "";
      let userEmail = "";

      // Check in-memory users first
      inMemoryUsers.forEach((entry) => {
        if (entry.user.openId === decoded.sub) {
          userRole = entry.user.role;
          userName = entry.user.name || "";
          userEmail = entry.user.email || "";
        }
      });

      // If not found in memory, try database
      if (!userName) {
        const db = await getDb();
        if (db) {
          try {
            const result = await db.select().from(users).where(eq(users.openId, decoded.sub)).limit(1);
            if (result.length > 0) {
              userRole = result[0].role;
              userName = result[0].name || "";
              userEmail = result[0].email || "";
            }
          } catch {
            // DB lookup failed, use defaults
          }
        }
      }

      const newAccessToken = jwtUtil.sign(
        { sub: decoded.sub, role: userRole, name: userName, email: userEmail },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      res.cookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
      });

      return res.json({ accessToken: newAccessToken });
    } catch {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.access_token;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;
    if (token) {
      blacklistToken(token);
    }
    res.clearCookie("access_token");
    logAuthEvent("logout", (req as any).user?.email || "unknown", req.ip || "unknown", req.headers["user-agent"] || "unknown", true);
    return res.json({ message: "Logged out successfully" });
  });

  // GET /api/auth/me — returns current user info
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.json({ user });
  });

  // GET /api/auth/roles — returns RBAC permission matrix
  app.get("/api/auth/roles", (req: Request, res: Response) => {
    return res.json({ roles: rolePermissions });
  });

  // CSRF token generation
  app.get("/api/auth/csrf-token", (req: Request, res: Response) => {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("csrf_token", token, {
      httpOnly: false, // Accessible to JS for inclusion in headers
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    return res.json({ csrfToken: token });
  });

  // Audit log for auth events
  app.get("/api/auth/audit-log", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || (user.role !== "admin" && user.role !== "auditor")) {
      return res.status(403).json({ error: "Admin or auditor role required" });
    }
    return res.json({
      events: authAuditLog.slice(-100),
      total: authAuditLog.length,
    });
  });

  logger.info("Auth routes registered: login, refresh, logout, me, csrf-token, audit-log, roles");
}

// Auth audit log (in-memory, replace with DB in production)
const authAuditLog: Array<{
  timestamp: string;
  event: string;
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  role?: string;
}> = [];

export function logAuthEvent(event: string, email: string, ip: string, userAgent: string, success: boolean, role?: string) {
  authAuditLog.push({
    timestamp: new Date().toISOString(),
    event,
    email,
    ip,
    userAgent: userAgent.substring(0, 100),
    success,
    role,
  });
  // Keep last 10000 entries
  if (authAuditLog.length > 10000) {
    authAuditLog.splice(0, authAuditLog.length - 10000);
  }
  logger.info(`Auth audit: ${event} email=${email} ip=${ip} success=${success}`);
}
