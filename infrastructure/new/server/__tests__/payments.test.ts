import { describe, it, expect } from "vitest";

// H-40 remediation: the previous version defined its own calculateFee inside
// the test and asserted against object literals — the real fee engine was
// never exercised. These tests import the production fee/commission engine
// and assert its fee, VAT, cap and tier math (money-critical surface).
import { calculateFee, getFeeSchedules } from "../lib/feeCommissionEngine";

describe("Fee & Commission Engine (production lib/feeCommissionEngine)", () => {
  it("every active schedule has a coherent fee definition", () => {
    const schedules = getFeeSchedules();
    expect(schedules.length).toBeGreaterThanOrEqual(10);
    for (const s of schedules) {
      expect(s.currency).toBe("NGN");
      if (s.feeType === "flat") {
        expect(s.flatAmount).toBeGreaterThan(0);
      } else if (s.feeType === "capped") {
        expect(s.percentage).toBeGreaterThan(0);
        expect(s.cap).toBeGreaterThan(0);
      } else if (s.feeType === "tiered") {
        expect(s.tiers!.length).toBeGreaterThan(0);
      }
    }
  });

  it("flat NIP fee below ₦5,000: ₦10 + 7.5% VAT", () => {
    const r = calculateFee("FS-001", 3000);
    expect(r.feeAmount).toBe(10);
    expect(r.vatAmount).toBe(0.75);
    expect(r.totalCharge).toBe(10.75);
  });

  it("VAT is not applied to VAT-exempt schedules (USSD)", () => {
    const r = calculateFee("FS-004", 10000);
    expect(r.feeAmount).toBe(6.98);
    expect(r.vatAmount).toBe(0);
    expect(r.totalCharge).toBe(6.98);
  });

  it("capped RTGS fee: 0.05% with a ₦5,000 cap", () => {
    // 0.05% of ₦25m = ₦12,500 → capped at ₦5,000.
    const capped = calculateFee("FS-005", 25_000_000);
    expect(capped.feeAmount).toBe(5000);
    expect(capped.vatAmount).toBe(375);
    expect(capped.totalCharge).toBe(5375);

    // 0.05% of ₦1m = ₦500 → below the cap, so the raw percentage applies.
    const below = calculateFee("FS-005", 1_000_000);
    expect(below.feeAmount).toBe(500);
    expect(below.vatAmount).toBe(37.5);
  });

  it("capped POS MDR: 0.5% with a ₦1,000 cap", () => {
    const r = calculateFee("FS-006", 150_000);
    expect(r.feeAmount).toBe(750); // 0.5% of ₦150k, below cap
    expect(r.vatAmount).toBe(56.25);
    expect(r.totalCharge).toBe(806.25);

    const big = calculateFee("FS-006", 1_000_000);
    expect(big.feeAmount).toBe(1000); // capped
  });

  it("tiered LC commission applies marginal rates per tier", () => {
    // ₦100m LC: 1.0% on first ₦50m (₦500k) + 0.75% on next ₦50m (₦375k).
    const r = calculateFee("FS-009", 100_000_000);
    expect(r.feeAmount).toBe(875_000);
    expect(r.vatAmount).toBe(65_625);
    expect(r.totalCharge).toBe(940_625);
  });

  it("unknown schedule id charges nothing", () => {
    const r = calculateFee("FS-DOES-NOT-EXIST", 1000);
    expect(r).toEqual({ feeAmount: 0, vatAmount: 0, totalCharge: 0 });
  });

  it("a zero amount charges a zero fee for percentage-based schedules", () => {
    expect(calculateFee("FS-005", 0).totalCharge).toBe(0);
    expect(calculateFee("FS-009", 0).totalCharge).toBe(0);
  });

  it("no fee computation ever returns NaN or negative money", () => {
    for (const id of ["FS-001", "FS-004", "FS-005", "FS-006", "FS-009"]) {
      for (const amount of [0, 1, 999.99, 1_000_000_000]) {
        const r = calculateFee(id, amount);
        expect(Number.isFinite(r.totalCharge)).toBe(true);
        expect(r.totalCharge).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
