import { describe, expect, it } from "vitest";

import {
  buildErpPostingPayload,
  buildIngestionBridgeSummary,
  buildInvoiceApprovalsFromMatrix,
  buildInvoiceExportBundles,
  defaultBillingApprovalMatrices,
} from "../shared/billingAutomation";
import {
  defaultBillingAccounts,
  defaultBillingInvoiceApprovals,
  defaultBillingInvoiceLines,
  defaultBillingInvoices,
  defaultBillingRevenueShareRules,
  defaultBillingUsageEvents,
} from "../shared/billingEngine";

describe("billing automation helpers", () => {
  it("builds export bundles for invoices in json, csv, and html formats", () => {
    const invoice = defaultBillingInvoices[0]!;
    const bundles = buildInvoiceExportBundles(invoice, defaultBillingInvoiceLines, defaultBillingInvoiceApprovals);

    expect(bundles.map((item) => item.format)).toEqual(["json", "csv", "html"]);
    expect(bundles[1]?.body).toContain(invoice.invoiceNumber);
    expect(bundles[2]?.body).toContain("Billing Invoice");
  });

  it("derives approval stages from the active tenant matrix", () => {
    const invoice = { ...defaultBillingInvoices[0]!, totalAmount: 2_000_000 };
    const approvals = buildInvoiceApprovalsFromMatrix({
      invoice,
      matrix: defaultBillingApprovalMatrices[0],
    });

    expect(approvals.length).toBe(3);
    expect(approvals[0]?.actorRole).toBe("operations");
    expect(approvals[1]?.actorRole).toBe("treasury");
    expect(approvals[2]?.actorRole).toBe("compliance");
  });

  it("builds an ERP posting payload with invoice lines and revenue-share metadata", () => {
    const invoice = defaultBillingInvoices[0]!;
    const payload = buildErpPostingPayload({
      invoice,
      account: defaultBillingAccounts[0],
      lines: defaultBillingInvoiceLines,
      revenueShareRules: defaultBillingRevenueShareRules,
    });

    expect(payload.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(Array.isArray(payload.lines)).toBe(true);
    expect(Array.isArray(payload.revenueShares)).toBe(true);
    expect(payload.customer).toBe(defaultBillingAccounts[0]?.accountName);
  });

  it("summarizes middleware-backed usage ingestion by service and meter", () => {
    const summary = buildIngestionBridgeSummary(defaultBillingUsageEvents);

    expect(summary.middleware).toContain("Kafka");
    expect(summary.serviceBreakdown[0]?.eventCount).toBeGreaterThan(0);
    expect(summary.meterBreakdown[0]?.quantity).toBeGreaterThan(0);
    expect(summary.lastIngestedAt).toBeDefined();
  });
});
