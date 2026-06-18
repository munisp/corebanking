/**
 * MFA / TOTP Authentication Module
 * - Time-based One-Time Password (RFC 6238)
 * - QR code generation for authenticator apps
 * - Backup recovery codes
 * - MFA enrollment and verification
 */
import { Request, Response, Express } from "express";
import crypto from "crypto";
import { logger } from "./logger";

// TOTP constants
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // Accept tokens ±1 period

// In-memory MFA state (replace with DB in production)
const mfaSecrets: Map<string, { secret: string; enabled: boolean; backupCodes: string[] }> = new Map();

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

export function registerMfaRoutes(app: Express) {
  // POST /api/auth/mfa/enroll — start MFA enrollment
  app.post("/api/auth/mfa/enroll", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const secret = generateBase32Secret();
    const backupCodes = generateBackupCodes();
    mfaSecrets.set(user.openId, { secret, enabled: false, backupCodes });

    const otpauthUrl = `otpauth://totp/54Bank:${user.email}?secret=${secret}&issuer=54Bank&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    logger.info(`MFA enrollment started for ${user.email}`);
    return res.json({
      secret,
      otpauthUrl,
      backupCodes,
      qrCodeUrl: `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(otpauthUrl)}`,
    });
  });

  // POST /api/auth/mfa/verify — verify TOTP and enable MFA
  app.post("/api/auth/mfa/verify", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "TOTP token required" });

    const mfa = mfaSecrets.get(user.openId);
    if (!mfa) return res.status(400).json({ error: "MFA not enrolled" });

    if (verifyTOTP(mfa.secret, token)) {
      mfa.enabled = true;
      logger.info(`MFA enabled for ${user.email}`);
      return res.json({ verified: true, mfaEnabled: true });
    }

    return res.status(401).json({ error: "Invalid TOTP token" });
  });

  // POST /api/auth/mfa/validate — validate TOTP during login
  app.post("/api/auth/mfa/validate", (req: Request, res: Response) => {
    const { userId, token, backupCode } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const mfa = mfaSecrets.get(userId);
    if (!mfa || !mfa.enabled) {
      return res.json({ valid: true, mfaRequired: false });
    }

    if (token && verifyTOTP(mfa.secret, token)) {
      return res.json({ valid: true });
    }

    if (backupCode) {
      const idx = mfa.backupCodes.indexOf(backupCode.toUpperCase());
      if (idx >= 0) {
        mfa.backupCodes.splice(idx, 1);
        logger.info(`Backup code used for ${userId}, ${mfa.backupCodes.length} remaining`);
        return res.json({ valid: true, backupCodesRemaining: mfa.backupCodes.length });
      }
    }

    return res.status(401).json({ error: "Invalid MFA token or backup code" });
  });

  // GET /api/auth/mfa/status — check MFA status
  app.get("/api/auth/mfa/status", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const mfa = mfaSecrets.get(user.openId);
    return res.json({
      enrolled: !!mfa,
      enabled: mfa?.enabled ?? false,
      backupCodesRemaining: mfa?.backupCodes.length ?? 0,
    });
  });

  // DELETE /api/auth/mfa/disable — disable MFA
  app.delete("/api/auth/mfa/disable", (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    mfaSecrets.delete(user.openId);
    logger.info(`MFA disabled for ${user.email}`);
    return res.json({ mfaEnabled: false });
  });

  logger.info("MFA/TOTP routes registered: enroll, verify, validate, status, disable");
}
