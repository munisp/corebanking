/**
 * W12-C3-P0 (mfaTotp / offline-PIN class): KMS-envelope encryption for key
 * material at rest (TOTP secrets, backup codes).
 *
 * Design: envelope-encrypt with AES-256-GCM under a master key sourced from
 * the KMS_MASTER_KEY environment variable. Ciphertext format is versioned:
 *   `v1:<kid>:<iv_hex>:<tag_hex>:<ct_hex>`
 * so a later swap to a real KMS (Vault transit / AWS KMS / HSM) only requires
 * replacing `loadMasterKey()` + introducing a `v2:` prefix — the storage
 * schema (opaque ciphertext column) does not change.
 *
 * KMS swap notes:
 *  - Replace loadMasterKey() with a data-key decrypt call against the KMS
 *    (envelope: KMS-wrapped DEK stored alongside ciphertext) and bump the
 *    version prefix. Keep kid for key rotation.
 *  - FAIL-CLOSED: encryption/decryption throw when KMS_MASTER_KEY is unset or
 *    malformed; plaintext is never persisted and malformed ciphertext is
 *    never returned as plaintext.
 *
 * KMS_MASTER_KEY: 64 hex chars (32 bytes) preferred; any other non-empty
 * value is stretched with scrypt (static per-purpose salt) to 32 bytes.
 */
import crypto from "crypto";

const VERSION = "v1";
const KEY_ID = process.env.KMS_MASTER_KEY_ID || "kms-master-1";
const IV_LENGTH = 16; // 128-bit GCM nonce

let cachedKey: Buffer | null = null;

function loadMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.KMS_MASTER_KEY || "";
  if (!raw) {
    throw new Error(
      "KMS_MASTER_KEY is not set — refusing to persist MFA key material unprotected " +
        "(envelope encryption is mandatory; see lib/kmsEnvelope.ts for the KMS swap path)",
    );
  }
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.scryptSync(raw, "54bank-kms-envelope-v1", 32);
  return cachedKey;
}

/** Envelope-encrypt a UTF-8 secret. Throws (fail-closed) if no master key. */
export function envelopeEncrypt(plaintext: string): string {
  const key = loadMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${KEY_ID}:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/** Decrypt envelope ciphertext. Throws on tamper/malformed input (fail-closed). */
export function envelopeDecrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error("Malformed envelope ciphertext — refusing to return plaintext (fail closed)");
  }
  const [, kid, ivHex, tagHex, ctHex] = parts;
  if (kid !== KEY_ID) {
    throw new Error(`Unknown envelope key id '${kid}' — cannot decrypt (fail closed)`);
  }
  const key = loadMasterKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  // GCM auth-tag verification failure throws here — that error propagates.
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
}

/**
 * One-way hash for MFA backup codes. scrypt (node built-in) with per-code
 * salt; format `scrypt:<salt_hex>:<hash_hex>`. NOTE: the C3 plan prefers
 * argon2id — node has no built-in argon2 and the package has no argon2 dep;
 * swap this function for argon2id when the dep lands (hashes are
 * self-describing, so old scrypt entries keep verifying via the prefix).
 */
export function hashBackupCode(code: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(code.toUpperCase(), salt, 32);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyBackupCodeHash(code: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const hash = crypto.scryptSync(code.toUpperCase(), Buffer.from(parts[1], "hex"), 32);
  const expected = Buffer.from(parts[2], "hex");
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}
