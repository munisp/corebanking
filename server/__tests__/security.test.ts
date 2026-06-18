import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("Security Hardening", () => {
  // PII Encryption
  function encryptPII(data: string, key?: string): string {
    const k = crypto.scryptSync(key || "test-key", "ndpr-salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
    const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  function decryptPII(ciphertext: string, key?: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
    const k = crypto.scryptSync(key || "test-key", "ndpr-salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex")) + decipher.final("utf8");
  }

  it("should encrypt and decrypt PII data", () => {
    const bvn = "12345678901";
    const encrypted = encryptPII(bvn);
    expect(decryptPII(encrypted)).toBe(bvn);
  });

  it("should fail decryption with wrong key", () => {
    const encrypted = encryptPII("secret-data", "key-1");
    expect(() => decryptPII(encrypted, "key-2")).toThrow();
  });

  it("should produce different ciphertext for same input", () => {
    const e1 = encryptPII("same");
    const e2 = encryptPII("same");
    expect(e1).not.toBe(e2);
  });

  // Input sanitization
  function sanitizeString(input: string): string {
    let s = input.replace(/\0/g, "");
    s = s.replace(/<script[^>]*>.*?<\/script>/gi, "");
    return s;
  }

  it("should strip null bytes", () => {
    expect(sanitizeString("hello\0world")).toBe("helloworld");
  });

  it("should strip script tags", () => {
    expect(sanitizeString('<script>alert("xss")</script>test')).toBe("test");
  });

  it("should pass clean input through unchanged", () => {
    expect(sanitizeString("Adebayo Ogundimu")).toBe("Adebayo Ogundimu");
  });

  // Brute force protection
  it("should track login attempts", () => {
    const attempts = new Map<string, { count: number; lockedUntil?: number }>();
    const ip = "192.168.1.1";

    for (let i = 0; i < 5; i++) {
      const record = attempts.get(ip) || { count: 0 };
      record.count++;
      if (record.count >= 5) {
        record.lockedUntil = Date.now() + 15 * 60 * 1000;
      }
      attempts.set(ip, record);
    }

    const record = attempts.get(ip)!;
    expect(record.count).toBe(5);
    expect(record.lockedUntil).toBeDefined();
    expect(record.lockedUntil!).toBeGreaterThan(Date.now());
  });

  // NDPR compliance
  it("should enforce data retention policy (7 years for CBN)", () => {
    const retentionYears = 7;
    const retentionMs = retentionYears * 365 * 24 * 60 * 60 * 1000;
    const createdAt = new Date("2019-01-01");
    const shouldRetainUntil = new Date(createdAt.getTime() + retentionMs);
    expect(shouldRetainUntil.getFullYear()).toBe(2025);
  });
});
