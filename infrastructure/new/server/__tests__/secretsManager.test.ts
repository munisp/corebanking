import { describe, it, expect, beforeEach, afterEach } from "vitest";

// H-40 remediation: the previous version re-implemented AES-GCM inside the
// test and asserted its own copy round-tripped — production crypto could be
// broken and the suite stayed green. It also contained an assertion that is
// literally always true (`expect(Array.isArray(missing)).toBe(true)`).
// These tests exercise the real lib/secretsManager module.
import { encryptSecret, decryptSecret, validateSecrets, generateSecrets } from "../lib/secretsManager";

describe("Secrets Manager — Encryption (production lib/secretsManager)", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = "h40-test-secret-key-0123456789abcdef";
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("encrypts and decrypts a secret", () => {
    const original = "my-database-password-123";
    expect(decryptSecret(encryptSecret(original))).toBe(original);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const e1 = encryptSecret("same-secret");
    const e2 = encryptSecret("same-secret");
    expect(e1).not.toBe(e2);
    expect(decryptSecret(e1)).toBe("same-secret");
    expect(decryptSecret(e2)).toBe("same-secret");
  });

  it("emits iv:authTag:ciphertext in hex", () => {
    const parts = encryptSecret("x").split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16-byte IV
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte GCM tag
  });

  it("handles special characters, unicode, and empty strings", () => {
    for (const s of ["p@$$w0rd!#%^&*()_+-={}[]|;':\",./<>?", "パスワード密码", ""]) {
      expect(decryptSecret(encryptSecret(s))).toBe(s);
    }
  });

  it("fails decryption with a different key", () => {
    const encrypted = encryptSecret("secret-data");
    process.env.JWT_SECRET = "a-different-key-0123456789abcdef00";
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("fails decryption on corrupted ciphertext (GCM auth tag)", () => {
    const [iv, authTag] = encryptSecret("test").split(":");
    const corrupted = `${iv}:${authTag}:${"deadbeef".repeat(4)}`;
    expect(() => decryptSecret(corrupted)).toThrow();
  });
});

describe("Secrets Manager — Validation (production lib/secretsManager)", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("reports missing required secrets and is invalid", () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    const result = validateSecrets();
    expect(result.valid).toBe(false);
    expect(result.missing.some((m) => m.startsWith("DATABASE_URL"))).toBe(true);
    expect(result.missing.some((m) => m.startsWith("JWT_SECRET"))).toBe(true);
  });

  it("is valid once required secrets are present", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/db";
    process.env.JWT_SECRET = "x".repeat(64);
    const result = validateSecrets();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("warns on placeholder and short JWT secrets", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/db";
    process.env.JWT_SECRET = "REPLACE_ME";
    const result = validateSecrets();
    expect(result.warnings.some((w) => w.includes("REPLACE_ME"))).toBe(true);

    process.env.JWT_SECRET = "short";
    const short = validateSecrets();
    expect(short.warnings.some((w) => w.includes("at least 32 characters"))).toBe(true);
  });
});

describe("Secrets Manager — Generation (production lib/secretsManager)", () => {
  it("generates distinct, full-length random secrets", () => {
    const a = generateSecrets();
    const b = generateSecrets();
    expect(a.JWT_SECRET).toMatch(/^[0-9a-f]{128}$/);
    expect(a.PLATFORM_TENANT_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(a.JWT_SECRET).not.toBe(b.JWT_SECRET);
    expect(a.PLATFORM_TENANT_SECRET).not.toBe(b.PLATFORM_TENANT_SECRET);
  });
});
