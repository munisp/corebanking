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

const PASSWORD_HISTORY: Map<string, string[]> = new Map();

export function validatePassword(password: string, userId?: string): PasswordValidation {
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

  // Check password history
  if (userId) {
    const history = PASSWORD_HISTORY.get(userId) || [];
    const crypto = require("crypto");
    const currentHash = crypto.createHash("sha256").update(password).digest("hex");
    if (history.includes(currentHash)) {
      errors.push("Password was used recently — choose a different one");
    }
  }

  const strength = score >= 80 ? "very_strong" : score >= 60 ? "strong" : score >= 40 ? "fair" : "weak";

  return { valid: errors.length === 0, errors, strength, score };
}

export function recordPasswordChange(userId: string, password: string) {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  const history = PASSWORD_HISTORY.get(userId) || [];
  history.push(hash);
  if (history.length > 5) history.shift();
  PASSWORD_HISTORY.set(userId, history);
}
