import { describe, it, expect, beforeAll } from "vitest";

// H-40 remediation: the previous version defined its own validatePassword
// inside the test and asserted against that copy — production could change
// arbitrarily and the test would stay green. These tests import the real
// policy module and assert its actual contract.
//
// W12 C3-P1-B2 (c3-1033): password history is redis-backed. The history test
// is an integration test against a REAL redis (REDIS_URL) — no mock redis —
// and is skipped when no redis is configured.
import { validatePassword, recordPasswordChange } from "../lib/passwordPolicy";
import { getRedis } from "../lib/redisKv";

const REDIS_AVAILABLE = !!process.env.REDIS_URL;

describe("Password Policy (production lib/passwordPolicy)", () => {
  it("accepts a strong password and scores it", async () => {
    const result = await validatePassword("Str0ng!Password99");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["strong", "very_strong"]).toContain(result.strength);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const result = await validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Minimum 8 characters required");
  });

  it("rejects passwords without an uppercase letter", async () => {
    const result = await validatePassword("str0ng!password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one uppercase letter required");
  });

  it("rejects passwords without a digit", async () => {
    const result = await validatePassword("Strong!Password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one digit required");
  });

  it("rejects passwords without a special character", async () => {
    const result = await validatePassword("Str0ngPassword99");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("special character"))).toBe(true);
  });

  it("rejects common passwords even when they meet length/case/digit rules", async () => {
    // "password123" is in the common-password list; any casing must match.
    const result = await validatePassword("Password123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("This password is too common");
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it.skipIf(!REDIS_AVAILABLE)("prevents reuse of the current password (history, real redis)", async () => {
    const userId = "h40-history-user";
    const pw = "Un1que!Passphrase";
    await getRedis().del(`pwd_history:platform:${userId}`);
    expect((await validatePassword(pw, userId)).valid).toBe(true);

    await recordPasswordChange(userId, pw);

    const reuse = await validatePassword(pw, userId);
    expect(reuse.valid).toBe(false);
    expect(reuse.errors.some((e) => e.includes("used recently"))).toBe(true);

    // A genuinely new password remains acceptable for the same user.
    expect((await validatePassword("An0ther!Passphrase", userId)).valid).toBe(true);
  });
});
