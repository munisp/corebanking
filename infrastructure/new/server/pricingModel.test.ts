import { describe, expect, it } from "vitest";

import { calculatePlatformPricing, defaultPricingModelInputs } from "@shared/pricingModel";

describe("calculatePlatformPricing", () => {
  it("returns the approved Mutual Benefits baseline totals when scope stays within included licence bounds", () => {
    const result = calculatePlatformPricing(defaultPricingModelInputs);

    expect(result.year1BaseTotal).toBe(70_000_000);
    expect(result.year1ExpansionTotal).toBe(0);
    expect(result.year1Total).toBe(70_000_000);
    expect(result.renewalBaseTotal).toBe(38_000_000);
    expect(result.years2To5Total).toBe(38_000_000);
    expect(result.fiveYearTotal).toBe(108_000_000);
  });

  it("adds user, customer, branch, and environment expansion charges correctly across renewal years when enabled", () => {
    const result = calculatePlatformPricing({
      ...defaultPricingModelInputs,
      requestedNamedUsers: 201,
      requestedCustomerRecords: 275_001,
      requestedBranches: 28,
      requestedNonProductionEnvironments: 4,
    });

    expect(result.overageBreakdown.additionalUserBlocks).toBe(3);
    expect(result.overageBreakdown.namedUserCharge).toBe(3_750_000);
    expect(result.overageBreakdown.additionalCustomerRecordBlocks).toBe(2);
    expect(result.overageBreakdown.customerRecordCharge).toBe(4_000_000);
    expect(result.overageBreakdown.additionalBranches).toBe(3);
    expect(result.overageBreakdown.branchCharge).toBe(1_050_000);
    expect(result.overageBreakdown.additionalNonProductionEnvironments).toBe(2);
    expect(result.overageBreakdown.environmentCharge).toBe(3_000_000);
    expect(result.year1ExpansionTotal).toBe(11_800_000);
    expect(result.year1Total).toBe(81_800_000);
    expect(result.renewalExpansionAnnual).toBe(11_800_000);
    expect(result.years2To5Total).toBe(85_200_000);
    expect(result.fiveYearTotal).toBe(167_000_000);
  });

  it("can disable recurring renewal overage charges while preserving Year 1 expansion", () => {
    const result = calculatePlatformPricing({
      ...defaultPricingModelInputs,
      requestedBranches: 30,
      applyExpansionChargesToRenewalYears: false,
    });

    expect(result.year1ExpansionTotal).toBe(1_750_000);
    expect(result.renewalExpansionAnnual).toBe(0);
    expect(result.years2To5Total).toBe(38_000_000);
    expect(result.fiveYearTotal).toBe(109_750_000);
  });
});
