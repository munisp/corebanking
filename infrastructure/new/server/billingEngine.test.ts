import { describe, expect, it } from "vitest";

import {
  buildAccrualSnapshots,
  buildBillingDashboard,
  buildInvoices,
  defaultBillingAccounts,
  defaultBillingContractOverrides,
  defaultBillingDiscountRules,
  defaultBillingRateCardLines,
  defaultBillingRateCards,
  defaultBillingRevenueShareRules,
  defaultBillingUsageEvents,
  rateUsageEvent,
  seedRatedEvents,
} from "../shared/billingEngine";

describe("billing engine foundations", () => {
  it("applies active contract overrides when rating usage events", () => {
    const event = defaultBillingUsageEvents.find((item) => item.meterKey === "transfer_posted");
    const account = defaultBillingAccounts[0];
    expect(event).toBeDefined();

    const rated = rateUsageEvent(
      event!,
      account,
      defaultBillingRateCards,
      defaultBillingRateCardLines,
      defaultBillingContractOverrides,
    );

    expect(rated).not.toBeNull();
    expect(rated?.amountAccrued).toBe(53_900);
    expect(rated?.ratingExplanation.unitPrice).toBe(22);
    expect(rated?.billableUnits).toBe(2_450);
  });

  it("builds invoices with discounts, revenue share, and minimum-commit true-up", () => {
    const ratedEvents = seedRatedEvents();
    const accruals = buildAccrualSnapshots(defaultBillingUsageEvents, ratedEvents);
    const generated = buildInvoices({
      accounts: defaultBillingAccounts,
      accruals,
      overrides: defaultBillingContractOverrides,
      discountRules: defaultBillingDiscountRules,
      revenueShareRules: defaultBillingRevenueShareRules,
      generatedAt: "2026-05-05T08:30:00.000Z",
    });

    expect(generated.invoices).toHaveLength(1);
    expect(generated.invoiceApprovals).toHaveLength(3);
    expect(generated.invoiceLines.some((line) => line.lineType === "discount")).toBe(true);
    expect(generated.invoiceLines.some((line) => line.lineType === "revenue_share")).toBe(true);
    expect(generated.invoiceLines.some((line) => line.lineType === "minimum_commit")).toBe(true);
    expect(generated.invoices[0]?.status).toBe("pending_approval");
    expect(generated.invoices[0]?.totalAmount).toBeGreaterThan(0);
  });

  it("summarizes invoices and commercial controls in the billing dashboard", () => {
    const ratedEvents = seedRatedEvents();
    const accruals = buildAccrualSnapshots(defaultBillingUsageEvents, ratedEvents);
    const generated = buildInvoices({
      accounts: defaultBillingAccounts,
      accruals,
      overrides: defaultBillingContractOverrides,
      discountRules: defaultBillingDiscountRules,
      revenueShareRules: defaultBillingRevenueShareRules,
      generatedAt: "2026-05-05T08:30:00.000Z",
    });

    const dashboard = buildBillingDashboard({
      accounts: defaultBillingAccounts,
      rateCards: defaultBillingRateCards,
      rateCardLines: defaultBillingRateCardLines,
      usageEvents: defaultBillingUsageEvents,
      ratedEvents,
      accruals,
      invoices: generated.invoices,
      invoiceLines: generated.invoiceLines,
      invoiceApprovals: generated.invoiceApprovals,
      contractOverrides: defaultBillingContractOverrides,
      discountRules: defaultBillingDiscountRules,
      revenueShareRules: defaultBillingRevenueShareRules,
    });

    expect(dashboard.summary.draftInvoiceCount).toBe(0);
    expect(dashboard.summary.pendingApprovalInvoiceCount).toBe(1);
    expect(dashboard.summary.contractSummary.overrideCount).toBe(defaultBillingContractOverrides.length);
    expect(dashboard.summary.contractSummary.discountRuleCount).toBe(defaultBillingDiscountRules.length);
    expect(dashboard.summary.contractSummary.revenueShareRuleCount).toBe(defaultBillingRevenueShareRules.length);
    expect(dashboard.summary.liveSeries.length).toBeGreaterThan(0);
  });
});
