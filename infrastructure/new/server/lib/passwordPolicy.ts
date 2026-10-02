/**
 * Password Policy Module
 * - Complexity requirements (uppercase, lowercase, digit, special char)
 * - Minimum length enforcement (12 chars for production)
 * - Common password checking
 * - Password history (prevent reuse)
 * - Password expiry tracking
 */

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "strong" | "very_strong";
  score: number;
}

const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "password1",
  "admin", "letmein", "welcome", "monkey", "dragon", "master",
  "login", "princess", "football", "shadow", "sunshine", "trustno1",
  "iloveyou", "batman", "access", "hello", "charlie", "password123",
]);

// Password history — redis-backed (W12 C3-P1-B2, c3-1033; register had no
// key_pattern for this item — chosen pattern documented here):
//   pwd_history:{tenant}:{userId}  redis LIST of sha256 password hashes,
//                                  capped at the 5 most recent (preserves the
//                                  previous in-memory history length), no TTL
//                                  (password reuse windows are policy-driven,
//                                  not time-driven, matching prior behavior).
// History now survives restarts and is consistent across replicas; previously
// a restart silently let users reuse recent passwords.
import { getRedis } from "./redisKv";

const PASSWORD_HISTORY_DEPTH = 5;

function passwordHash(password: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function getPasswordHistory(userId: string, tenant = "platform"): Promise<string[]> {
  return getRedis().lrange(`pwd_history:${tenant}:${userId}`, 0, -1);
}

export async function validatePassword(password: string, userId?: string): Promise<PasswordValidation> {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) errors.push("Minimum 8 characters required");
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter required");
  else score += 15;

  if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter required");
  else score += 15;

  if (!/\d/.test(password)) errors.push("At least one digit required");
  else score += 15;

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("At least one special character required (!@#$%^&*...)");
  } else {
    score += 15;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
    score = Math.min(score, 10);
  }

  // Check password history (redis-backed; on redis outage the history check
  // cannot run — fail closed by flagging the password as unverifiable rather
  // than silently skipping the reuse check).
  if (userId) {
    try {
      const history = await getPasswordHistory(userId);
      if (history.includes(passwordHash(password))) {
        errors.push("Password was used recently — choose a different one");
      }
    } catch {
      errors.push("Password history unavailable — try again shortly");
    }
  }

  const strength = score >= 80 ? "very_strong" : score >= 60 ? "strong" : score >= 40 ? "fair" : "weak";

  return { valid: errors.length === 0, errors, strength, score };
}

export async function recordPasswordChange(userId: string, password: string, tenant = "platform"): Promise<void> {
  const key = `pwd_history:${tenant}:${userId}`;
  await getRedis().rpush(key, passwordHash(password));
  // Keep only the most recent PASSWORD_HISTORY_DEPTH hashes.
  await getRedis().ltrim(key, -PASSWORD_HISTORY_DEPTH, -1);
}
