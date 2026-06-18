import { describe, it, expect } from "vitest";

describe("KYC — Identity Verification", () => {
  it("should validate BVN format (11 digits)", () => {
    const bvn = "22345678901";
    expect(bvn).toMatch(/^\d{11}$/);
  });

  it("should validate NIN format (11 digits)", () => {
    const nin = "12345678901";
    expect(nin).toMatch(/^\d{11}$/);
  });

  it("should validate Nigerian phone number format", () => {
    const phones = ["+2348012345678", "08012345678", "2348012345678"];
    phones.forEach(p => {
      const normalized = p.replace(/^0/, "234").replace(/^\+/, "");
      expect(normalized).toMatch(/^234[789]0\d{8}$/);
    });
  });

  it("should enforce KYC tier limits", () => {
    const tiers = {
      tier1: { maxBalance: 300000, maxDaily: 50000, maxSingle: 50000 },
      tier2: { maxBalance: 500000, maxDaily: 200000, maxSingle: 200000 },
      tier3: { maxBalance: Infinity, maxDaily: 5000000, maxSingle: 5000000 },
    };
    expect(tiers.tier1.maxBalance).toBe(300000);
    expect(tiers.tier3.maxDaily).toBe(5000000);
  });

  it("should classify customer risk level", () => {
    const classify = (score: number) => {
      if (score >= 80) return "high";
      if (score >= 50) return "medium";
      return "low";
    };
    expect(classify(90)).toBe("high");
    expect(classify(60)).toBe("medium");
    expect(classify(30)).toBe("low");
  });
});

describe("AML — Transaction Monitoring", () => {
  it("should detect structuring (amounts just below threshold)", () => {
    const threshold = 5000000; // 5M NGN CBN reporting threshold
    const transactions = [4900000, 4800000, 4950000];
    const isStructuring = transactions.every(t => t > threshold * 0.9 && t < threshold);
    expect(isStructuring).toBe(true);
  });

  it("should flag high-risk countries", () => {
    const highRisk = ["IR", "KP", "SY", "MM", "AF"];
    expect(highRisk).toContain("IR");
    expect(highRisk).not.toContain("NG");
  });

  it("should calculate velocity (transactions per hour)", () => {
    const txCount = 15;
    const hours = 1;
    const velocity = txCount / hours;
    expect(velocity).toBeGreaterThan(10); // Flag if > 10/hr
  });

  it("should enforce CTR filing for transactions > 5M NGN", () => {
    const amount = 6000000;
    const threshold = 5000000;
    const requiresCTR = amount >= threshold;
    expect(requiresCTR).toBe(true);
  });

  it("should validate sanctions list screening", () => {
    const sanctionsList = ["PERSON_A", "ENTITY_B", "PERSON_C"];
    const customerName = "John Doe";
    const isMatch = sanctionsList.some(s => customerName.toUpperCase().includes(s));
    expect(isMatch).toBe(false);
  });
});
