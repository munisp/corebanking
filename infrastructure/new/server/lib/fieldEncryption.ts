// D3: Field-level AES-256-GCM encryption for PII (BVN, phone, email, card numbers)
//
// PL-03 hardening:
//  - FIELD_ENCRYPTION_KEY is MANDATORY (64 hex chars = 32 bytes). The previous
//    `|| crypto.randomBytes(...)` fallback produced a per-pod, per-boot key,
//    making all previously encrypted PII undecryptable after any restart.
//    The process now fails fast at import time if the key is unset/invalid.
//  - Ciphertext is versioned: `<kid>:<iv>:<tag>:<ct>` (all hex) so key rotation
//    can be introduced without ambiguity (kid from FIELD_ENCRYPTION_KEY_ID).
//  - decryptField is FAIL-CLOSED: any malformed input or GCM auth-tag failure
//    throws — ciphertext is never returned in place of plaintext.
import crypto from "crypto";
import type { Express, Request, Response } from "express";

const RAW_KEY = process.env.FIELD_ENCRYPTION_KEY || "";
if (!/^[0-9a-fA-F]{64}$/.test(RAW_KEY)) {
  throw new Error(
    "FIELD_ENCRYPTION_KEY must be set to 64 hex characters (32 bytes for AES-256-GCM). " +
      "Refusing to start with a missing or ephemeral field-encryption key."
  );
}
const ENCRYPTION_KEY = Buffer.from(RAW_KEY, "hex");
const KEY_ID = process.env.FIELD_ENCRYPTION_KEY_ID || "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// PII fields that must be encrypted at rest
const PII_FIELDS = ["bvn", "nin", "phone", "email", "card_number", "pin_block", "ssn", "passport_number", "date_of_birth"];

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${KEY_ID}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptField(ciphertext: string): string {
  const parts = ciphertext.split(":");
  // Accept legacy 3-part (iv:tag:ct, pre-versioning) and current 4-part
  // (kid:iv:tag:ct) formats. Everything else is rejected.
  let kid: string, ivHex: string, tagHex: string, encrypted: string;
  if (parts.length === 4) {
    [kid, ivHex, tagHex, encrypted] = parts;
    if (kid !== KEY_ID) {
      throw new Error(`Unknown field-encryption key id '${kid}' — cannot decrypt (fail closed)`);
    }
  } else if (parts.length === 3) {
    [ivHex, tagHex, encrypted] = parts;
  } else {
    throw new Error("Malformed field ciphertext — refusing to return it as plaintext (fail closed)");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  // GCM auth-tag verification failure throws here — that error propagates.
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskField(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function registerFieldEncryption(app: Express) {
  app.get("/api/platform/encryption/pii-fields", (_: Request, res: Response) => {
    res.json({ pii_fields: PII_FIELDS, algorithm: ALGORITHM, key_length_bits: 256 });
  });

  app.post("/api/platform/encryption/encrypt", (req: Request, res: Response) => {
    const { field, value } = req.body || {};
    if (!field || !value) return res.status(400).json({ error: "field and value required" });
    if (!PII_FIELDS.includes(field)) return res.status(400).json({ error: `Field ${field} is not a PII field`, pii_fields: PII_FIELDS });
    const encrypted = encryptField(value);
    const masked = maskField(value);
    res.json({ field, encrypted, masked, algorithm: ALGORITHM, key_id: KEY_ID });
  });

  app.post("/api/platform/encryption/decrypt", (req: Request, res: Response) => {
    const { field, ciphertext } = req.body || {};
    if (!field || !ciphertext) return res.status(400).json({ error: "field and ciphertext required" });
    try {
      const decrypted = decryptField(ciphertext);
      res.json({ field, decrypted, masked: maskField(decrypted) });
    } catch (err: any) {
      // Fail closed: never echo ciphertext back as if it were plaintext.
      res.status(422).json({ error: "decryption_failed", message: err.message });
    }
  });

  app.get("/api/platform/encryption/key-rotation", (_: Request, res: Response) => {
    // PL-03: the previous hardcoded KEY-001..KEY-003 rotation timeline was
    // fabricated. Only the configured key is known to this process; rotation
    // history must come from the secret manager, not a static array.
    res.json({
      items: [{ id: KEY_ID, status: "active" }],
      total: 1,
      note: "Rotation history is not tracked by this endpoint. Manage rotation via the secret manager and redeploy with FIELD_ENCRYPTION_KEY_ID/KEY.",
    });
  });
}
