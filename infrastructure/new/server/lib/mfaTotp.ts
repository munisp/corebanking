/**
 * MFA / TOTP Authentication Module
 * - Time-based One-Time Password (RFC 6238)
 * - QR code generation for authenticator apps
 * - Backup recovery codes
 * - MFA enrollment and verification
 *
 * W12-C3-P0 (top-risk #3): TOTP secrets + backup codes were held in a
 * process-memory Map — restart un-enrolled every user, and replicas disagreed.
 * Per the C3 plan §3.5 they now persist to `postgres:mfa_secrets` with the
 * secret ENVELOPE-ENCRYPTED (lib/kmsEnvelope.ts, AES-256-GCM under
 * KMS_MASTER_KEY, structured for a later Vault/KMS swap) and backup codes
 * one-way hashed (scrypt, self-describing format, argon2id swap documented).
 * Plain PG storage of the secret was rejected by the plan.
 */
import { Request, Response, Express } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { exec, ensureTables } from "./pgJsonStore";
import { envelopeEncrypt, envelopeDecrypt, hashBackupCode, verifyBackupCodeHash } from "./kmsEnvelope";

// TOTP constants
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // Accept tokens ±1 period

const MFA_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS mfa_secrets (
    user_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '',
    secret_ciphertext TEXT NOT NULL,
    backup_code_hashes JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mfa_secrets_tenant ON mfa_secrets(tenant_id)`,
];

function ensure(): Promise<void> {
  return ensureTables("mfaTotp", MFA_DDL);
}

interface MfaRecord {
  secret: string;
  enabled: boolean;
  backupCodeHashes: string[];
}

function tenantOf(req: Request): string {
  return (req.headers["x-tenant-id"] as string) ?? "";
}

async function loadMfa(userId: string): Promise<MfaRecord | null> {
  const rows = await exec<{
    secret_ciphertext: string; backup_code_hashes: string[] | string; enabled: boolean;
  }>(sql`SELECT secret_ciphertext, backup_code_hashes, enabled FROM mfa_secrets WHERE user_id = ${userId}`);
  if (rows.length === 0) return null;
  const r = rows[0];
  const hashes = typeof r.backup_code_hashes === "string" ? JSON.parse(r.backup_code_hashes) : r.backup_code_hashes;
  return {
    secret: envelopeDecrypt(r.secret_ciphertext),
    enabled: r.enabled,
    backupCodeHashes: Array.isArray(hashes) ? hashes : [],
  };
}

async function saveMfa(userId: string, tenantId: string, rec: MfaRecord): Promise<void> {
  await exec(
    sql`INSERT INTO mfa_secrets (user_id, tenant_id, secret_ciphertext, backup_code_hashes, enabled, enrolled_at, rotated_at)
        VALUES (${userId}, ${tenantId}, ${envelopeEncrypt(rec.secret)}, ${JSON.stringify(rec.backupCodeHashes)}::jsonb, ${rec.enabled}, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          secret_ciphertext = EXCLUDED.secret_ciphertext,
          backup_code_hashes = EXCLUDED.backup_code_hashes,
          enabled = EXCLUDED.enabled,
          rotated_at = NOW()`,
  );
}

async function deleteMfa(userId: string): Promise<void> {
  await exec(sql`DELETE FROM mfa_secrets WHERE user_id = ${userId}`);
}

function generateBase32Secret(): string {
  const bytes = crypto.randomBytes(20);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % 32];
  }
  return result;
}

function hmacSha1(key: Buffer, message: Buffer): Buffer {
  return crypto.createHmac("sha1", key).update(message).digest();
}

function base32Decode(encoded: string): Buffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of encoded.toUpperCase()) {
    const val = chars.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, time?: number): string {
  const t = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(t / TOTP_PERIOD);
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(0, 0);
  msg.writeUInt32BE(counter, 4);
  const hash = hmacSha1(key, msg);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = ((hash[offset] & 0x7f) << 24 | hash[offset + 1] << 16 | hash[offset + 2] << 8 | hash[offset + 3]) % Math.pow(10, TOTP_DIGITS);
  return code.toString().padStart(TOTP_DIGITS, "0");
}

function verifyTOTP(secret: string, token: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    if (generateTOTP(secret, now + i * TOTP_PERIOD) === token) return true;
  }
  return false;
}

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

function dbUnavailable(res: Response, err: unknown) {
  logger.error("mfaTotp: store unavailable", { error: String(err) });
  return res.status(503).json({ error: "mfa_store_unavailable", message: "MFA store (Postgres/KMS envelope) unavailable; refusing to fall back to memory" });
}

export function registerMfaRoutes(app: Express) {
  // POST /api/auth/mfa/enroll — start MFA enrollment
  app.post("/api/auth/mfa/enroll", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    try {
      await ensure();
      const secret = generateBase32Secret();
      const backupCodes = generateBackupCodes();
      await saveMfa(user.openId, tenantOf(req), {
        secret,
        enabled: false,
        backupCodeHashes: backupCodes.map(hashBackupCode),
      });

      const otpauthUrl = `otpauth://totp/54Bank:${user.email}?secret=${secret}&issuer=54Bank&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

      logger.info(`MFA enrollment started for ${user.email}`);
      return res.json({
        secret,
        otpauthUrl,
        backupCodes,
        qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(otpauthUrl)}`,
      });
    } catch (err) { return dbUnavailable(res, err); }
  });

  // POST /api/auth/mfa/verify — verify TOTP and enable MFA
  app.post("/api/auth/mfa/verify", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "TOTP token required" });

    try {
      await ensure();
      const mfa = await loadMfa(user.openId);
      if (!mfa) return res.status(400).json({ error: "MFA not enrolled" });

      if (verifyTOTP(mfa.secret, token)) {
        mfa.enabled = true;
        await saveMfa(user.openId, tenantOf(req), mfa);
        logger.info(`MFA enabled for ${user.email}`);
        return res.json({ verified: true, mfaEnabled: true });
      }

      return res.status(401).json({ error: "Invalid TOTP token" });
    } catch (err) { return dbUnavailable(res, err); }
  });

  // POST /api/auth/mfa/validate — validate TOTP during login
  app.post("/api/auth/mfa/validate", async (req: Request, res: Response) => {
    const { userId, token, backupCode } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    try {
      await ensure();
      const mfa = await loadMfa(userId);
      if (!mfa || !mfa.enabled) {
        return res.json({ valid: true, mfaRequired: false });
      }

      if (token && verifyTOTP(mfa.secret, token)) {
        return res.json({ valid: true });
      }

      if (backupCode) {
        const idx = mfa.backupCodeHashes.findIndex((h) => verifyBackupCodeHash(backupCode, h));
        if (idx >= 0) {
          mfa.backupCodeHashes.splice(idx, 1);
          await saveMfa(userId, tenantOf(req), mfa);
          logger.info(`Backup code used for ${userId}, ${mfa.backupCodeHashes.length} remaining`);
          return res.json({ valid: true, backupCodesRemaining: mfa.backupCodeHashes.length });
        }
      }

      return res.status(401).json({ error: "Invalid MFA token or backup code" });
    } catch (err) { return dbUnavailable(res, err); }
  });

  // GET /api/auth/mfa/status — check MFA status
  app.get("/api/auth/mfa/status", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    try {
      await ensure();
      const mfa = await loadMfa(user.openId);
      return res.json({
        enrolled: !!mfa,
        enabled: mfa?.enabled ?? false,
        backupCodesRemaining: mfa?.backupCodeHashes.length ?? 0,
      });
    } catch (err) { return dbUnavailable(res, err); }
  });

  // DELETE /api/auth/mfa/disable — disable MFA
  app.delete("/api/auth/mfa/disable", async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    try {
      await ensure();
      await deleteMfa(user.openId);
      logger.info(`MFA disabled for ${user.email}`);
      return res.json({ mfaEnabled: false });
    } catch (err) { return dbUnavailable(res, err); }
  });

  logger.info("MFA/TOTP routes registered: enroll, verify, validate, status, disable");
}
