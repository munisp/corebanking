import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test the pure-crypto JWT implementation
const JWT_SECRET = "test-secret-key-for-unit-tests-54bank";

const jwtUtil = {
  sign(payload: Record<string, any>, secret: string, options?: { expiresIn?: string }): string {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const expiry = options?.expiresIn === "1h" ? 3600 : 28800;
    const fullPayload = { ...payload, iat: now, exp: now + expiry };
    const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
    const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(`${b64Header}.${b64Payload}`).digest("base64url");
    return `${b64Header}.${b64Payload}.${sig}`;
  },
  verify(token: string, secret: string): Record<string, any> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    const sig = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
    if (sig !== parts[2]) throw new Error("Invalid signature");
    return JSON.parse(Buffer.from(parts[1], "base64url").toString());
  },
};

describe("JWT Authentication", () => {
  it("should generate a valid JWT token", () => {
    const token = jwtUtil.sign({ sub: "user-1", role: "admin" }, JWT_SECRET, { expiresIn: "1h" });
    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify a valid token", () => {
    const token = jwtUtil.sign({ sub: "user-1", role: "admin", name: "Test" }, JWT_SECRET, { expiresIn: "1h" });
    const decoded = jwtUtil.verify(token, JWT_SECRET);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("admin");
    expect(decoded.name).toBe("Test");
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it("should reject tokens with wrong secret", () => {
    const token = jwtUtil.sign({ sub: "user-1" }, JWT_SECRET, { expiresIn: "1h" });
    expect(() => jwtUtil.verify(token, "wrong-secret")).toThrow("Invalid signature");
  });

  it("should reject malformed tokens", () => {
    expect(() => jwtUtil.verify("not.a.token", JWT_SECRET)).toThrow();
    expect(() => jwtUtil.verify("only-one-part", JWT_SECRET)).toThrow();
  });

  it("should include expiry claim", () => {
    const token = jwtUtil.sign({ sub: "user-1" }, JWT_SECRET, { expiresIn: "1h" });
    const decoded = jwtUtil.verify(token, JWT_SECRET);
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
    expect(decoded.exp - decoded.iat).toBe(3600);
  });
});

describe("Password Hashing", () => {
  function hashPassword(password: string, salt?: string) {
    const s = salt || crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, s, 100000, 64, "sha512").toString("hex");
    return { hash, salt: s };
  }

  it("should hash passwords consistently with same salt", () => {
    const salt = crypto.randomBytes(16).toString("hex");
    const h1 = hashPassword("test-password", salt);
    const h2 = hashPassword("test-password", salt);
    expect(h1.hash).toBe(h2.hash);
  });

  it("should produce different hashes for different passwords", () => {
    const salt = crypto.randomBytes(16).toString("hex");
    const h1 = hashPassword("password1", salt);
    const h2 = hashPassword("password2", salt);
    expect(h1.hash).not.toBe(h2.hash);
  });

  it("should produce different salts each time", () => {
    const h1 = hashPassword("test");
    const h2 = hashPassword("test");
    expect(h1.salt).not.toBe(h2.salt);
  });
});

describe("RBAC Permissions", () => {
  const rolePermissions: Record<string, string[]> = {
    admin: ["*"],
    operations: ["read:*", "write:core-banking", "write:payments"],
    compliance: ["read:*", "write:aml", "write:kyc"],
    auditor: ["read:*"],
    user: ["read:own"],
  };

  function hasPermission(role: string, perm: string): boolean {
    const perms = rolePermissions[role] || [];
    if (perms.includes("*")) return true;
    if (perms.includes("read:*") && perm.startsWith("read:")) return true;
    return perms.includes(perm);
  }

  it("admin should have all permissions", () => {
    expect(hasPermission("admin", "read:anything")).toBe(true);
    expect(hasPermission("admin", "write:anything")).toBe(true);
  });

  it("operations should read anything but write only banking", () => {
    expect(hasPermission("operations", "read:aml")).toBe(true);
    expect(hasPermission("operations", "write:core-banking")).toBe(true);
    expect(hasPermission("operations", "write:aml")).toBe(false);
  });

  it("compliance should write AML/KYC but not banking", () => {
    expect(hasPermission("compliance", "write:aml")).toBe(true);
    expect(hasPermission("compliance", "write:kyc")).toBe(true);
    expect(hasPermission("compliance", "write:core-banking")).toBe(false);
  });

  it("auditor should only read", () => {
    expect(hasPermission("auditor", "read:anything")).toBe(true);
    expect(hasPermission("auditor", "write:anything")).toBe(false);
  });
});
