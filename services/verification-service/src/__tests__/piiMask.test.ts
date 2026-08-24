import { describe, expect, it } from "@jest/globals";
import { maskIdentifier } from "../utils/piiMask";

describe("maskIdentifier", () => {
  it("masks all but the last 3 characters by default", () => {
    expect(maskIdentifier("12345678901")).toBe("********901");
  });

  it("is deterministic", () => {
    expect(maskIdentifier("12345678901")).toBe(maskIdentifier("12345678901"));
  });

  it("fully masks identifiers not longer than the visible window", () => {
    expect(maskIdentifier("ab")).toBe("**");
    expect(maskIdentifier("abc")).toBe("***");
  });

  it("renders placeholders for null/undefined/empty without throwing", () => {
    expect(maskIdentifier(null)).toBe("[none]");
    expect(maskIdentifier(undefined)).toBe("[none]");
    expect(maskIdentifier("")).toBe("[empty]");
  });

  it("respects a custom visible window", () => {
    expect(maskIdentifier("12345678901", 4)).toBe("*******8901");
    expect(maskIdentifier("12345678901", 0)).toBe("***********");
  });

  it("never leaks more than the last N characters of the PII", () => {
    const nin = "98765432109";
    const masked = maskIdentifier(nin);
    expect(masked.endsWith("109")).toBe(true);
    expect(masked).not.toContain("98765");
  });
});
