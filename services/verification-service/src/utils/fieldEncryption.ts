/**
 * M-53: field-level encryption for PII columns at rest.
 *
 * Provides:
 *   - encryptField/decryptField: AES-256-GCM authenticated encryption with a
 *     versioned envelope format ("enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"),
 *     matching the storage contract documented on
 *     entity/KycVerificationWorkflowEntity.ts.
 *   - lookupHash: keyed HMAC-SHA256 of a plaintext value, enabling equality
 *     lookups over encrypted columns without exposing the value to offline
 *     brute-force (the key is required to compute the hash).
 *
 * Key management (fail closed):
 *   The 256-bit key comes from the FIELD_ENCRYPTION_KEY environment variable,
 *   encoded as 64 hex chars, base64 (32 bytes), or a raw 32-character string.
 *   If the variable is unset or malformed, every operation throws — the service
 *   must never silently fall back to plaintext or a hard-coded key.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ENVELOPE_PREFIX = "enc:v1";
const IV_LENGTH_BYTES = 12; // 96-bit nonce, recommended for AES-GCM

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is not set — refusing to encrypt/decrypt PII fields without a configured key.",
    );
  }

  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    const asBase64 = Buffer.from(raw, "base64");
    if (asBase64.length === 32 && asBase64.toString("base64").replace(/=+$/, "") === raw.replace(/=+$/, "")) {
      key = asBase64;
    } else if (Buffer.byteLength(raw, "utf8") === 32) {
      key = Buffer.from(raw, "utf8");
    }
  }

  if (!key || key.length !== 32) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY is malformed — expected 32 bytes as 64 hex chars, base64, or a 32-character string.",
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Encrypt a UTF-8 field value with AES-256-GCM.
 * Returns the versioned envelope string "enc:v1:<iv>:<tag>:<ciphertext>"
 * (all binary parts base64-encoded). A fresh random IV is used per call, so
 * encrypting the same value twice yields different envelopes.
 */
export function encryptField(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt an envelope produced by encryptField.
 * Throws (fails closed) on a malformed envelope, wrong key, or tampered
 * ciphertext — GCM authentication failure is never swallowed.
 */
export function decryptField(envelope: string): string {
  const key = loadKey();
  const parts = envelope.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Malformed field-encryption envelope (expected enc:v1:<iv>:<tag>:<ciphertext>).");
  }
  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const ciphertext = Buffer.from(parts[4], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Keyed HMAC-SHA256 lookup hash (hex) of a plaintext value.
 * Deterministic by construction, so it supports equality queries
 * (e.g. client_app_user_id_hash) over otherwise-encrypted identifiers.
 */
export function lookupHash(value: string): string {
  const key = loadKey();
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
