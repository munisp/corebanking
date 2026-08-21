/**
 * C8: Transaction Signing — OTP and HMAC-based transaction authentication
 * Provides multi-factor auth for financial operations above configurable thresholds.
 *
 * Hardening notes:
 *  - OTP codes use crypto.randomInt (CSPRNG), never Math.random().
 *  - Per-user rate limiting: max 5 active OTPs per user, 60s resend cooldown.
 *  - Attempt limiting: max 5 verify attempts per otpId, then the OTP is invalidated.
 *  - OTP TTL: 5 minutes.
 *  - OTP DELIVERY INTEGRATION POINT: this module only generates and verifies
 *    codes. The caller MUST hand the generated code to the notifications /
 *    communication service (e.g. POST to the messaging gateway with the
 *    recipient's registered channel) for out-of-band delivery. This module
 *    deliberately does NOT claim the OTP was "sent" — it returns only the
 *    otpId and TTL; the code never leaves the server in the response.
 *  - HMAC SIGNING KEY: there is NO built-in default signing secret. In
 *    production a missing TX_SIGNING_SECRET throws at module init (fail
 *    closed); in non-production a per-process random key is used with a loud
 *    warning, so signatures never silently rely on a committed default.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Configurable thresholds
const OTP_THRESHOLD = Number(process.env.OTP_THRESHOLD_NGN || "1000000"); // ₦1M

// HMAC signing key — no hardcoded fallback.
const HMAC_SECRET: string = (() => {
  const fromEnv = process.env.TX_SIGNING_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (fromEnv && fromEnv.length > 0) {
    logger.warn("TX_SIGNING_SECRET is shorter than 16 characters — use a longer random secret");
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    // Fail closed: never sign financial transactions with a built-in default.
    throw new Error(
      "TX_SIGNING_SECRET is required in production — refusing to initialize transaction signing",
    );
  }
  // Non-production: per-process random key. Signatures do NOT survive a
  // restart — intentional, since there is no safe shared default.
  const generated = crypto.randomBytes(32).toString("hex");
  logger.warn(
    "TX_SIGNING_SECRET is not set — using a per-process random key. " +
      "Transaction signatures will NOT survive a restart. Set TX_SIGNING_SECRET in any shared environment.",
  );
  return generated;
})();

// OTP security policy
const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ACTIVE_OTPS_PER_USER = 5;
const RESEND_COOLDOWN_MS = 60_000; // 60s resend cooldown per user
const MAX_VERIFY_ATTEMPTS = 5;

// In-memory OTP store (production: Redis with TTL)
const otpStore = new Map<string, { code: string; userId: string; expiresAt: number; attempts: number }>();
// Per-user resend cooldown tracker
const lastOtpRequestAt = new Map<string, number>();

function countActiveOtpsForUser(userId: string, now: number): number {
  let count = 0;
  otpStore.forEach((entry, otpId) => {
    if (entry.expiresAt <= now) {
      otpStore.delete(otpId); // lazy cleanup of expired entries
      return;
    }
    if (entry.userId === userId) count++;
  });
  return count;
}

export function generateOTP(userId: string): { otpId: string; expiresInSeconds: number } {
  const now = Date.now();

  // Resend cooldown: reject rapid successive OTP requests for the same user.
  const lastRequest = lastOtpRequestAt.get(userId);
  if (lastRequest !== undefined && now - lastRequest < RESEND_COOLDOWN_MS) {
    logger.warn("OTP resend cooldown triggered", { userId, retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now - lastRequest)) / 1000) });
    throw new Error(`OTP resend cooldown active. Retry after ${Math.ceil((RESEND_COOLDOWN_MS - (now - lastRequest)) / 1000)} seconds.`);
  }

  // Rate limit: cap the number of concurrently active OTPs per user.
  if (countActiveOtpsForUser(userId, now) >= MAX_ACTIVE_OTPS_PER_USER) {
    logger.warn("OTP active-limit reached for user", { userId, maxActive: MAX_ACTIVE_OTPS_PER_USER });
    throw new Error(`Too many active OTPs for user. Maximum ${MAX_ACTIVE_OTPS_PER_USER} concurrent OTPs allowed.`);
  }

  // CSPRNG 6-digit code — never Math.random() for security tokens.
  const code = String(crypto.randomInt(100000, 1000000));
  const otpId = `otp-${userId}-${now.toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  otpStore.set(otpId, {
    code,
    userId,
    expiresAt: now + OTP_TTL_SECONDS * 1000,
    attempts: 0,
  });
  lastOtpRequestAt.set(userId, now);

  logger.info("OTP generated", { otpId, userId });
  // NOTE: the code is stored server-side only. Delivery to the user happens
  // via the notifications/communication service (see module header); the
  // caller is responsible for dispatch and must not log the code.
  return { otpId, expiresInSeconds: OTP_TTL_SECONDS };
}

export function verifyOTP(otpId: string, code: string): boolean {
  const entry = otpStore.get(otpId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(otpId);
    return false;
  }
  entry.attempts++;
  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(otpId);
    logger.warn("OTP invalidated after too many verify attempts", { otpId, attempts: entry.attempts });
    return false;
  }
  // Constant-time comparison to avoid timing attacks on the code.
  const provided = Buffer.from(code);
  const expected = Buffer.from(entry.code);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;
  otpStore.delete(otpId);
  return true;
}

export function signTransaction(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");
}

export function verifyTransactionSignature(payload: Record<string, unknown>, signature: string): boolean {
  const expected = signTransaction(payload);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Middleware: require OTP for high-value transactions.
 * Checks x-otp-id and x-otp-code headers for amounts above threshold.
 */
export function requireOTPForHighValue(amountField = "amount") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const amount = Number(req.body?.[amountField] || 0);
    if (amount <= OTP_THRESHOLD) {
      next();
      return;
    }

    const otpId = req.headers["x-otp-id"] as string | undefined;
    const otpCode = req.headers["x-otp-code"] as string | undefined;

    if (!otpId || !otpCode) {
      res.status(428).json({
        error: "OTP required for transactions above threshold",
        threshold: OTP_THRESHOLD,
        currency: "NGN",
        message: `Transactions above ₦${OTP_THRESHOLD.toLocaleString()} require OTP verification. Call POST /api/platform/otp/generate first.`,
      });
      return;
    }

    if (!verifyOTP(otpId, otpCode)) {
      res.status(403).json({ error: "Invalid or expired OTP" });
      return;
    }

    logger.info("High-value transaction OTP verified", { amount, otpId });
    next();
  };
}
