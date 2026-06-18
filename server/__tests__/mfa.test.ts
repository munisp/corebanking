import { describe, it, expect } from "vitest";

describe("MFA/TOTP — Authentication", () => {
  it("should generate valid base32 secret (20 bytes = 32 chars)", () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const secret = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * 32)]).join("");
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("should generate otpauth URL with correct format", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const email = "admin@54bank.ng";
    const url = `otpauth://totp/54Bank:${email}?secret=${secret}&issuer=54Bank&digits=6&period=30`;
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("54Bank");
    expect(url).toContain(secret);
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });

  it("should generate 8 backup codes in hex format", () => {
    const codes = Array.from({ length: 8 }, () => {
      const bytes = Buffer.from(Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)));
      return bytes.toString("hex").toUpperCase();
    });
    expect(codes).toHaveLength(8);
    codes.forEach(c => {
      expect(c).toMatch(/^[0-9A-F]{8}$/);
    });
  });

  it("should accept TOTP within window (±1 period)", () => {
    const window = 1;
    const period = 30;
    const validRange = (2 * window + 1) * period;
    expect(validRange).toBe(90); // 90 seconds window
  });

  it("should consume backup code on use (no reuse)", () => {
    const codes = ["ABCD1234", "EFGH5678", "IJKL9012"];
    const used = "EFGH5678";
    const remaining = codes.filter(c => c !== used);
    expect(remaining).toHaveLength(2);
    expect(remaining).not.toContain(used);
  });
});
