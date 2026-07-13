/**
 * C8: Transaction Signing — OTP and HMAC-based transaction authentication
 * Provides multi-factor auth for financial operations above configurable thresholds.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Configurable thresholds
const OTP_THRESHOLD = Number(process.env.OTP_THRESHOLD_NGN || "1000000"); // ₦1M
const HMAC_SECRET = process.env.TX_SIGNING_SECRET || "54bank-tx-signing-default-key-32chars";

// In-memory OTP store (production: Redis with TTL)
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

export function generateOTP(userId: string): { otpId: string; expiresInSeconds: number } {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const otpId = `otp-${userId}-${Date.now().toString(36)}`;
  const expiresInSeconds = 300; // 5 minutes
  otpStore.set(otpId, {
    code,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    attempts: 0,
  });

  logger.info("OTP generated", { otpId, userId });
  return { otpId, expiresInSeconds };
}

export function verifyOTP(otpId: string, code: string): boolean {
  const entry = otpStore.get(otpId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(otpId);
    return false;
  }
  entry.attempts++;
  if (entry.attempts > 3) {
    otpStore.delete(otpId);
    return false;
  }
  if (entry.code !== code) return false;
  otpStore.delete(otpId);
  return true;
}

export function signTransaction(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHmac("sha256", HMAC_SECRET).update(canonical).digest("hex");
}

export function verifyTransactionSignature(payload: Record<string, unknown>, signature: string): boolean {
  const expected = signTransaction(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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
