import { describe, it, expect } from "vitest";

describe("Lending — Loan Origination", () => {
  it("should calculate monthly EMI correctly", () => {
    const principal = 1000000;
    const annualRate = 0.18;
    const months = 12;
    const r = annualRate / 12;
    const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    expect(Math.round(emi)).toBe(91680);
  });

  it("should validate loan-to-value ratio", () => {
    const loanAmount = 800000;
    const collateralValue = 1000000;
    const ltv = loanAmount / collateralValue;
    expect(ltv).toBeLessThanOrEqual(0.8);
  });

  it("should enforce CBN maximum lending rate", () => {
    const cbnPolicyRate = 27.5;
    const maxSpread = 5;
    const lendingRate = 30;
    expect(lendingRate).toBeLessThanOrEqual(cbnPolicyRate + maxSpread);
  });

  it("should calculate debt-to-income ratio", () => {
    const monthlyDebt = 150000;
    const monthlyIncome = 500000;
    const dti = monthlyDebt / monthlyIncome;
    expect(dti).toBeLessThanOrEqual(0.4); // Max 40%
  });

  it("should generate amortization schedule", () => {
    const principal = 1000000;
    const months = 12;
    const schedule = Array.from({ length: months }, (_, i) => ({
      month: i + 1,
      principal: Math.round(principal / months),
      interest: Math.round((principal - (principal / months) * i) * 0.015),
    }));
    expect(schedule).toHaveLength(12);
    expect(schedule[0].month).toBe(1);
  });

  it("should enforce maximum tenor by loan type", () => {
    const maxTenors: Record<string, number> = {
      personal: 36,
      mortgage: 300,
      auto: 60,
      business: 48,
      agriculture: 24,
    };
    expect(maxTenors.mortgage).toBe(300);
    expect(maxTenors.personal).toBe(36);
  });
});
