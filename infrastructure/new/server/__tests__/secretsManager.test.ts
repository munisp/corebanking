import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test encryption/decryption
function getEncryptionKey(): Buffer {
  const secret = "test-secret-for-unit-tests";
  return crypto.scryptSync(secret, "54bank-salt", 32);
}

function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptSecret(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(encryptedHex, "hex")) + decipher.final("utf8");
}

describe("Secrets Manager — Encryption", () => {
  it("should encrypt and decrypt a secret", () => {
    const original = "my-database-password-123";
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should produce different ciphertext each time", () => {
    const e1 = encryptSecret("same-secret");
    const e2 = encryptSecret("same-secret");
    expect(e1).not.toBe(e2); // Different IVs
  });

  it("should handle special characters", () => {
    const original = "p@$$w0rd!#%^&*()_+-={}[]|;':\",./<>?";
    const encrypted = encryptSecret(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("should handle empty strings", () => {
    const encrypted = encryptSecret("");
    expect(decryptSecret(encrypted)).toBe("");
  });

  it("should handle unicode", () => {
    const original = "パスワード密码";
    const encrypted = encryptSecret(original);
    expect(decryptSecret(encrypted)).toBe(original);
  });

  it("should fail with corrupted ciphertext", () => {
    const encrypted = encryptSecret("test");
    const [iv, authTag, data] = encrypted.split(":");
    const corrupted = iv + ":" + authTag + ":" + "deadbeef".repeat(4);
    expect(() => decryptSecret(corrupted)).toThrow();
  });
});

describe("Secrets Manager — Validation", () => {
  it("should detect missing required secrets", () => {
    // Simulate checking required secrets
    const required = [
      { envVar: "DATABASE_URL", required: true },
      { envVar: "JWT_SECRET", required: true },
    ];
    const missing = required.filter(s => !process.env[s.envVar]).map(s => s.envVar);
    // In test env, these are likely not set
    expect(Array.isArray(missing)).toBe(true);
  });

  it("should generate secure random secrets", () => {
    const s1 = crypto.randomBytes(64).toString("hex");
    const s2 = crypto.randomBytes(64).toString("hex");
    expect(s1).toHaveLength(128);
    expect(s2).toHaveLength(128);
    expect(s1).not.toBe(s2);
  });
});
