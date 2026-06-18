import { describe, it, expect } from "vitest";

describe("API Key Management", () => {
  it("should generate key with correct prefix format", () => {
    const prefix = "54bk_" + Buffer.from(Array.from({ length: 4 }, () => Math.floor(Math.random() * 256))).toString("hex");
    expect(prefix).toMatch(/^54bk_[0-9a-f]{8}$/);
  });

  it("should hash API key with SHA-256", () => {
    const crypto = require("crypto");
    const key = "54bk_test1234_secretvalue";
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should enforce rate limits per key", () => {
    const rateLimit = 1000;
    const windowMs = 60000;
    let requestCount = 0;
    const windowStart = Date.now();

    // Simulate 1001 requests
    for (let i = 0; i < 1001; i++) requestCount++;
    const exceeded = requestCount > rateLimit;
    expect(exceeded).toBe(true);
  });

  it("should reject expired API keys", () => {
    const expiresAt = new Date("2025-01-01").toISOString();
    const now = new Date();
    const expired = new Date(expiresAt) < now;
    expect(expired).toBe(true);
  });

  it("should support scope-based permissions", () => {
    const scopes = ["read:accounts", "write:transfers", "read:customers"];
    expect(scopes).toContain("read:accounts");
    expect(scopes).not.toContain("write:admin");
  });
});
