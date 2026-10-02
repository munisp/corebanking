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
import { kvGetJson, kvSetJson, kvSetNX, kvDel, kvGet, kvIncrWindow } from "./redisKv";

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

// OTP store — redis-backed (W12 C3-P1-B2, c3-1031/c3-1032).
// Keys (register pattern otp:{tenant}:{phone}; this module has no tenant
// context, so tenant="platform" and subject=userId/otpId):
//   otp:platform:{otpId}            JSON {code,userId,expiresAt,attempts}, TTL 300s
//   otp:cooldown:platform:{userId}  resend cooldown marker, TTL 60s (preserves
//                                   the previous RESEND_COOLDOWN_MS lifetime)
//   otp:active:platform:{userId}    counter of concurrently active OTPs, TTL 300s
// OTP state now survives restarts and is consistent across replicas;
// previously a restart silently invalidated outstanding OTPs (or, worse,
// reset the resend-cooldown / active-count anti-abuse limits).
// FAIL MODE: redis down => generate/verify THROW and callers fail closed —
// an OTP check is never silently skipped.
interface OtpEntry {
  code: string;
  userId: string;
  expiresAt: number;
  attempts: number;
}

const otpKey = (otpId: string) => `otp:platform:${otpId}`;
const otpCooldownKey = (userId: string) => `otp:cooldown:platform:${userId}`;
const otpActiveKey = (userId: string) => `otp:active:platform:${userId}`;

async function countActiveOtpsForUser(userId: string): Promise<number> {
  const raw = await kvGet(otpActiveKey(userId));
  return raw ? parseInt(raw, 10) : 0;
}

export async function generateOTP(userId: string): Promise<{ otpId: string; expiresInSeconds: number }> {
  const now = Date.now();

  // Resend cooldown: reject rapid successive OTP requests for the same user.
  const cooldownSet = await kvSetNX(otpCooldownKey(userId), String(now), RESEND_COOLDOWN_MS / 1000);
  if (!cooldownSet) {
    logger.warn("OTP resend cooldown triggered", { userId, retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000) });
    throw new Error(`OTP resend cooldown active. Retry after ${Math.ceil(RESEND_COOLDOWN_MS / 1000)} seconds.`);
  }

  // Rate limit: cap the number of concurrently active OTPs per user.
  if ((await countActiveOtpsForUser(userId)) >= MAX_ACTIVE_OTPS_PER_USER) {
    logger.warn("OTP active-limit reached for user", { userId, maxActive: MAX_ACTIVE_OTPS_PER_USER });
    throw new Error(`Too many active OTPs for user. Maximum ${MAX_ACTIVE_OTPS_PER_USER} concurrent OTPs allowed.`);
  }

  // CSPRNG 6-digit code — never Math.random() for security tokens.
  const code = String(crypto.randomInt(100000, 1000000));
  const otpId = `otp-${userId}-${now.toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const entry: OtpEntry = {
    code,
    userId,
    expiresAt: now + OTP_TTL_SECONDS * 1000,
    attempts: 0,
  };
  await kvSetJson(otpKey(otpId), entry, OTP_TTL_SECONDS);
  // Track the active-OTP count for this user (key expires with the OTP window).
  await kvIncrWindow(otpActiveKey(userId), OTP_TTL_SECONDS);

  logger.info("OTP generated", { otpId, userId });
  // NOTE: the code is stored server-side only. Delivery to the user happens
  // via the notifications/communication service (see module header); the
  // caller is responsible for dispatch and must not log the code.
  return { otpId, expiresInSeconds: OTP_TTL_SECONDS };
}

async function decrementActiveOtps(userId: string): Promise<void> {
  const key = otpActiveKey(userId);
  try {
    const raw = await kvGet(key);
    const n = raw ? parseInt(raw, 10) : 0;
    if (n <= 1) await kvDel(key);
    else await kvSetJson(key, n - 1, OTP_TTL_SECONDS);
  } catch (err) {
    logger.warn("OTP active-count decrement failed (non-fatal)", { error: String(err) });
  }
}

export async function verifyOTP(otpId: string, code: string): Promise<boolean> {
  const key = otpKey(otpId);
  const entry = await kvGetJson<OtpEntry>(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    await kvDel(key);
    await decrementActiveOtps(entry.userId);
    return false;
  }
  entry.attempts++;
  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    await kvDel(key);
    await decrementActiveOtps(entry.userId);
    logger.warn("OTP invalidated after too many verify attempts", { otpId, attempts: entry.attempts });
    return false;
  }
  // Constant-time comparison to avoid timing attacks on the code.
  const provided = Buffer.from(code);
  const expected = Buffer.from(entry.code);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    // Persist the incremented attempt counter so attempts are enforced
    // across replicas/restarts.
    await kvSetJson(key, entry, Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000)));
    return false;
  }
  await kvDel(key);
  await decrementActiveOtps(entry.userId);
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
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    let otpValid = false;
    try {
      otpValid = await verifyOTP(otpId, otpCode);
    } catch (err) {
      // FAIL CLOSED: OTP state lives in redis; if it is unreachable the OTP
      // cannot be verified and the high-value transaction must not proceed.
      logger.error("OTP verification state unavailable — failing closed", { error: String(err) });
      res.status(503).json({ error: "OTP verification unavailable", code: "OTP_STATE_UNAVAILABLE" });
      return;
    }
    if (!otpValid) {
      res.status(403).json({ error: "Invalid or expired OTP" });
      return;
    }

    logger.info("High-value transaction OTP verified", { amount, otpId });
    next();
  };
}
