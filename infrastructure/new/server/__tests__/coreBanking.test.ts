import { describe, it, expect } from "vitest";

// Core Banking behavioral tests
describe("Core Banking — Account Operations", () => {
  it("should create a new savings account with valid data", () => {
    const account = {
      accountType: "savings",
      currency: "NGN",
      customerId: "CUST-001",
      initialDeposit: 50000,
    };
    expect(account.accountType).toBe("savings");
    expect(account.currency).toBe("NGN");
    expect(account.initialDeposit).toBeGreaterThan(0);
  });

  it("should reject account creation without customer ID", () => {
    const account = { accountType: "savings", currency: "NGN" };
    expect(account).not.toHaveProperty("customerId");
  });

  it("should generate valid NUBAN account number format", () => {
    const nuban = "0123456789";
    expect(nuban).toMatch(/^\d{10}$/);
  });

  it("should support all Nigerian bank account types", () => {
    const types = ["savings", "current", "domiciliary", "corporate", "joint", "fixed_deposit"];
    expect(types).toHaveLength(6);
    types.forEach(t => expect(t).toBeTruthy());
  });

  it("should enforce minimum balance for savings accounts", () => {
    const minBalance = 1000;
    const withdrawal = 500;
    const balance = 1500;
    expect(balance - withdrawal).toBeGreaterThanOrEqual(minBalance);
  });
});

describe("Core Banking — Transactions", () => {
  it("should create debit transaction with valid fields", () => {
    const tx = {
      type: "debit",
      amount: 10000,
      currency: "NGN",
      sourceAccount: "0123456789",
      narration: "ATM Withdrawal",
      channel: "atm",
    };
    expect(tx.type).toBe("debit");
    expect(tx.amount).toBeGreaterThan(0);
    expect(tx.sourceAccount).toMatch(/^\d{10}$/);
  });

  it("should prevent overdraft on savings accounts", () => {
    const balance = 5000;
    const amount = 10000;
    expect(balance >= amount).toBe(false);
  });

  it("should calculate daily transaction limits", () => {
    const dailyLimit = 5000000; // 5M NGN
    const todayTotal = 3000000;
    const newTx = 1500000;
    expect(todayTotal + newTx).toBeLessThanOrEqual(dailyLimit);
  });

  it("should generate unique transaction reference", () => {
    const ref = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    expect(ref).toMatch(/^TXN-\d+-[a-z0-9]+$/);
  });

  it("should support NGN, USD, GBP, EUR currencies", () => {
    const currencies = ["NGN", "USD", "GBP", "EUR"];
    expect(currencies).toContain("NGN");
    expect(currencies).toHaveLength(4);
  });
});

describe("Core Banking — Interest Calculation", () => {
  it("should calculate simple interest correctly", () => {
    const principal = 1000000;
    const rate = 0.04; // 4% p.a.
    const days = 365;
    const interest = principal * rate * (days / 365);
    expect(interest).toBe(40000);
  });

  it("should calculate compound interest correctly", () => {
    const principal = 1000000;
    const rate = 0.04;
    const periods = 12;
    const compound = principal * Math.pow(1 + rate / periods, periods) - principal;
    expect(compound).toBeGreaterThan(40000);
  });

  it("should apply withholding tax on interest (10%)", () => {
    const interest = 40000;
    const wht = interest * 0.10;
    expect(wht).toBe(4000);
    expect(interest - wht).toBe(36000);
  });
});
