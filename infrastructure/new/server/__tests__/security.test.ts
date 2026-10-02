import { describe, it, expect, beforeEach, afterEach } from "vitest";

// H-40 remediation: the previous version re-implemented PII encryption, input
// sanitization and brute-force tracking inside the test file and asserted
// against those copies. These tests exercise the real exports of
// lib/securityHardening.
import { encryptPII, decryptPII, recordLoginAttempt } from "../lib/securityHardening";

describe("PII Encryption (production lib/securityHardening)", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "h40-pii-test-key";
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("encrypts and decrypts PII (BVN round-trip)", () => {
    const bvn = "12345678901";
    expect(decryptPII(encryptPII(bvn))).toBe(bvn);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const e1 = encryptPII("same");
    const e2 = encryptPII("same");
    expect(e1).not.toBe(e2);
    expect(decryptPII(e1)).toBe("same");
  });

  it("ciphertext carries iv:authTag:payload segments", () => {
    const parts = encryptPII("data").split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // The plaintext must not appear in the ciphertext.
    expect(encryptPII("BVN-12345678901")).not.toContain("12345678901");
  });

  it("fails decryption with a different key", () => {
    const encrypted = encryptPII("secret-data");
    process.env.ENCRYPTION_KEY = "h40-other-key";
    expect(() => decryptPII(encrypted)).toThrow();
  });

  it("fails decryption on tampered ciphertext (GCM authentication)", () => {
    const [iv, authTag] = encryptPII("amount=100").split(":");
    const tampered = `${iv}:${authTag}:${"00".repeat(9)}`;
    expect(() => decryptPII(tampered)).toThrow();
  });
});

describe("Brute-force Tracking (production lib/securityHardening)", () => {
  // W12 C3-P1-B2 (c3-1027): the tracker is redis-backed (failed_login:* keys).
  // Integration test against a REAL redis (REDIS_URL) — no mock redis —
  // skipped when no redis is configured.
  it.skipIf(!process.env.REDIS_URL)("recordLoginAttempt does not throw on failure or success paths", async () => {
    const ip = "198.51.100.77";
    // Five failures (the lockout threshold) must be recorded without error.
    for (let i = 0; i < 5; i++) {
      await expect(recordLoginAttempt(ip, false)).resolves.not.toThrow();
    }
    // A success clears the record.
    await expect(recordLoginAttempt(ip, true)).resolves.not.toThrow();
  });
});
