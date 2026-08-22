import { describe, it, expect } from "vitest";

// H-40 remediation: the previous version defined its own validatePassword
// inside the test and asserted against that copy — production could change
// arbitrarily and the test would stay green. These tests import the real
// policy module and assert its actual contract.
import { validatePassword, recordPasswordChange } from "../lib/passwordPolicy";

describe("Password Policy (production lib/passwordPolicy)", () => {
  it("accepts a strong password and scores it", () => {
    const result = validatePassword("Str0ng!Password99");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["strong", "very_strong"]).toContain(result.strength);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Minimum 8 characters required");
  });

  it("rejects passwords without an uppercase letter", () => {
    const result = validatePassword("str0ng!password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one uppercase letter required");
  });

  it("rejects passwords without a digit", () => {
    const result = validatePassword("Strong!Password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one digit required");
  });

  it("rejects passwords without a special character", () => {
    const result = validatePassword("Str0ngPassword99");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("special character"))).toBe(true);
  });

  it("rejects common passwords even when they meet length/case/digit rules", () => {
    // "password123" is in the common-password list; any casing must match.
    const result = validatePassword("Password123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("This password is too common");
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it("prevents reuse of the current password (history)", () => {
    const userId = "h40-history-user";
    const pw = "Un1que!Passphrase";
    expect(validatePassword(pw, userId).valid).toBe(true);

    recordPasswordChange(userId, pw);

    const reuse = validatePassword(pw, userId);
    expect(reuse.valid).toBe(false);
    expect(reuse.errors.some((e) => e.includes("used recently"))).toBe(true);

    // A genuinely new password remains acceptable for the same user.
    expect(validatePassword("An0ther!Passphrase", userId).valid).toBe(true);
  });
});
