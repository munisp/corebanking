import { describe, expect, it, jest } from "@jest/globals";

const TEST_KEY_HEX = "a".repeat(64); // 32 bytes of 0xaa, hex-encoded

describe("fieldEncryption", () => {
  it("fails closed when FIELD_ENCRYPTION_KEY is unset", () => {
    jest.isolateModules(() => {
      delete process.env.FIELD_ENCRYPTION_KEY;
      const { encryptField, lookupHash } = require("../utils/fieldEncryption");
      expect(() => encryptField("12345678901")).toThrow(/FIELD_ENCRYPTION_KEY/);
      expect(() => lookupHash("12345678901")).toThrow(/FIELD_ENCRYPTION_KEY/);
    });
  });

  it("fails closed on a malformed key", () => {
    jest.isolateModules(() => {
      process.env.FIELD_ENCRYPTION_KEY = "too-short";
      const { encryptField } = require("../utils/fieldEncryption");
      expect(() => encryptField("12345678901")).toThrow(/malformed/);
    });
  });

  describe("with a configured key", () => {
    it("encrypts to a versioned AES-256-GCM envelope and decrypts back", () => {
      jest.isolateModules(() => {
        process.env.FIELD_ENCRYPTION_KEY = TEST_KEY_HEX;
        const { encryptField, decryptField } = require("../utils/fieldEncryption");
        const envelope = encryptField("12345678901");
        const parts = envelope.split(":");
        expect(parts[0]).toBe("enc");
        expect(parts[1]).toBe("v1");
        expect(parts).toHaveLength(5);
        expect(envelope).not.toContain("12345678901");
        expect(decryptField(envelope)).toBe("12345678901");
      });
    });

    it("uses a fresh IV per call (same plaintext, different envelopes)", () => {
      jest.isolateModules(() => {
        process.env.FIELD_ENCRYPTION_KEY = TEST_KEY_HEX;
        const { encryptField } = require("../utils/fieldEncryption");
        expect(encryptField("12345678901")).not.toBe(encryptField("12345678901"));
      });
    });

    it("rejects tampered ciphertext (GCM auth failure)", () => {
      jest.isolateModules(() => {
        process.env.FIELD_ENCRYPTION_KEY = TEST_KEY_HEX;
        const { encryptField, decryptField } = require("../utils/fieldEncryption");
        const envelope = encryptField("12345678901");
        const parts = envelope.split(":");
        const ct = Buffer.from(parts[4], "base64");
        ct[0] ^= 0xff;
        parts[4] = ct.toString("base64");
        expect(() => decryptField(parts.join(":"))).toThrow();
      });
    });

    it("lookupHash is deterministic and input-sensitive", () => {
      jest.isolateModules(() => {
        process.env.FIELD_ENCRYPTION_KEY = TEST_KEY_HEX;
        const { lookupHash } = require("../utils/fieldEncryption");
        const h1 = lookupHash("12345678901");
        expect(h1).toMatch(/^[0-9a-f]{64}$/);
        expect(lookupHash("12345678901")).toBe(h1);
        expect(lookupHash("12345678902")).not.toBe(h1);
      });
    });
  });
});
