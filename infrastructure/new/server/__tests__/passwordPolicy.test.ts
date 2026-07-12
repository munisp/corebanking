import { describe, it, expect } from "vitest";

describe("Password Policy", () => {
  function validatePassword(pw: string) {
    const errors: string[] = [];
    if (pw.length < 8) errors.push("min_length");
    if (!/[A-Z]/.test(pw)) errors.push("uppercase");
    if (!/[a-z]/.test(pw)) errors.push("lowercase");
    if (!/\d/.test(pw)) errors.push("digit");
    if (!/[!@#$%^&*]/.test(pw)) errors.push("special");
    return { valid: errors.length === 0, errors };
  }

  it("should accept strong password", () => {
    expect(validatePassword("Str0ng!Pass").valid).toBe(true);
  });

  it("should reject short password", () => {
    const result = validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("min_length");
  });

  it("should reject missing uppercase", () => {
    const result = validatePassword("str0ng!pass");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("uppercase");
  });

  it("should reject missing digit", () => {
    const result = validatePassword("StrongPass!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("digit");
  });

  it("should reject missing special char", () => {
    const result = validatePassword("Str0ngPass1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("special");
  });

  it("should calculate password strength score", () => {
    const score = (pw: string) => {
      let s = 0;
      if (pw.length >= 8) s += 20;
      if (pw.length >= 12) s += 10;
      if (/[A-Z]/.test(pw)) s += 15;
      if (/[a-z]/.test(pw)) s += 15;
      if (/\d/.test(pw)) s += 15;
      if (/[!@#$%^&*]/.test(pw)) s += 15;
      return s;
    };
    expect(score("Str0ng!Password")).toBe(90);
    expect(score("weak")).toBe(15);
  });
});
