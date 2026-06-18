// D3: Field-level AES-256 encryption for PII (BVN, phone, email, card numbers)
import crypto from "crypto";
import type { Express, Request, Response } from "express";

const ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// PII fields that must be encrypted at rest
const PII_FIELDS = ["bvn", "nin", "phone", "email", "card_number", "pin_block", "ssn", "passport_number", "date_of_birth"];

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptField(ciphertext: string): string {
  try {
    const [ivHex, tagHex, encrypted] = ciphertext.split(":");
    if (!ivHex || !tagHex || !encrypted) return ciphertext;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return ciphertext;
  }
}

export function maskField(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

interface KeyRotationEntry {
  id: string; keyVersion: number; createdAt: string; expiresAt: string; status: string;
}

const keyRotations: KeyRotationEntry[] = [
  { id: "KEY-001", keyVersion: 1, createdAt: "2025-12-01T00:00:00Z", expiresAt: "2026-03-01T00:00:00Z", status: "retired" },
  { id: "KEY-002", keyVersion: 2, createdAt: "2026-03-01T00:00:00Z", expiresAt: "2026-06-01T00:00:00Z", status: "active" },
  { id: "KEY-003", keyVersion: 3, createdAt: "2026-06-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z", status: "pending" },
];

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
    res.json({ field, encrypted, masked, algorithm: ALGORITHM, key_version: 2 });
  });

  app.post("/api/platform/encryption/decrypt", (req: Request, res: Response) => {
    const { field, ciphertext } = req.body || {};
    if (!field || !ciphertext) return res.status(400).json({ error: "field and ciphertext required" });
    const decrypted = decryptField(ciphertext);
    res.json({ field, decrypted, masked: maskField(decrypted) });
  });

  app.get("/api/platform/encryption/key-rotation", (_: Request, res: Response) => {
    res.json({ items: keyRotations, total: keyRotations.length, rotation_interval_days: 90, next_rotation: "2026-06-01" });
  });
}
