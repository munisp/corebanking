import { billingInvoiceRepository } from "../repositories/billingInvoiceRepository";
import { billingInvoiceLineRepository } from "../repositories/billingInvoiceLineRepository";
import { billingInvoiceApprovalRepository } from "../repositories/billingInvoiceApprovalRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingApprovalMatrixRepository } from "../repositories/billingApprovalMatrixRepository";
import { billingDiscountRuleRepository } from "../repositories/billingDiscountRuleRepository";
import { billingRevenueShareRuleRepository } from "../repositories/billingRevenueShareRuleRepository";
import { billingMeteringService } from "./billingMeteringService";
import { BillingInvoice } from "../models/BillingInvoice";
import { BillingInvoiceLine } from "../models/BillingInvoiceLine";
import { BillingInvoiceApproval } from "../models/BillingInvoiceApproval";
import { generateId, generateInvoiceNumber, resolvePeriodBounds, PeriodType } from "../utils/id";

function dueDate(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + 30);
  return d;
}

export const billingInvoiceService = {
  async generateForAccount(
    billingAccountId: string,
    periodType: PeriodType = "monthly",
    useMatrix = false,
  ): Promise<{ invoice: BillingInvoice; lines: BillingInvoiceLine[]; approvals: BillingInvoiceApproval[] }> {
    const account = await billingAccountRepository.findById(billingAccountId);
    if (!account) throw Object.assign(new Error("Billing account not found"), { status: 404 });

    const { start, end, periodKey } = resolvePeriodBounds(periodType);

    const existingInvoice = await billingInvoiceRepository.findByAccountAndPeriod(billingAccountId, periodKey);
    if (existingInvoice) {
      // Idempotent re-call: generate once per period, don't double-invoice.
      const lines = await billingInvoiceLineRepository.findByInvoice(existingInvoice.id);
      const approvals = await billingInvoiceApprovalRepository.findByInvoice(existingInvoice.id);
      return { invoice: existingInvoice, lines, approvals };
    }

    // The gateway's API-call counter is keyed by calendar month (YYYY-MM), matching
    // the "monthly" periodKey format — this flush is a no-op for non-monthly periodTypes.
    await billingMeteringService.flushApiCallUsage(account, periodKey);

    const accruals = await billingAccrualSnapshotRepository.findByAccount(billingAccountId, periodKey);

    let subtotal = accruals.reduce((s, a) => s + Number(a.accruedAmount), 0);

    const discountRules = await billingDiscountRuleRepository.findByAccount(billingAccountId);
    let discountAmount = 0;
    for (const rule of discountRules) {
      if (rule.discountType === "percentage" && rule.percentage) {
        discountAmount += (subtotal * Number(rule.percentage)) / 100;
      } else if (rule.discountType === "fixed" && rule.fixedAmount) {
        discountAmount += Number(rule.fixedAmount);
      }
    }

    const revenueShareRules = await billingRevenueShareRuleRepository.findByAccount(billingAccountId);
    let revenueShareAmount = 0;
    for (const rule of revenueShareRules) {
      revenueShareAmount += (subtotal * Number(rule.percentage)) / 100;
    }

    let minimumCommitAdjustment = 0;
    if (account.minimumCommitAmount && subtotal < Number(account.minimumCommitAmount)) {
      minimumCommitAdjustment = Number(account.minimumCommitAmount) - subtotal;
    }

    const taxRate = 0.075;
    const taxableAmount = subtotal - discountAmount + minimumCommitAdjustment;
    const taxAmount = taxableAmount * taxRate;
    const totalAmount = taxableAmount + taxAmount + revenueShareAmount;

    const invoice = await billingInvoiceRepository.save({
      id: generateId("inv"),
      invoiceNumber: generateInvoiceNumber(),
      tenantId: account.tenantId,
      billingAccountId,
      billingPeriodKey: periodKey,
      billingPeriodType: periodType,
      periodStartAt: start,
      periodEndAt: end,
      currency: account.currency,
      subtotalAmount: subtotal,
      discountAmount,
      revenueShareAmount,
      minimumCommitAdjustment,
      taxAmount,
      totalAmount,
      status: "draft",
      approvalStatus: "pending",
      generatedAt: new Date(),
      dueAt: dueDate(start),
      approvalStepCount: 0,
    });

    const lines: Partial<BillingInvoiceLine>[] = accruals.map((a) => ({
      id: generateId("il"),
      invoiceId: invoice.id,
      lineType: "usage" as const,
      meterKey: a.meterKey,
      productKey: a.productKey,
      description: `Usage: ${a.meterKey} / ${a.productKey} for ${periodKey}`,
      quantity: Number(a.usageQuantity),
      unitPrice: a.usageQuantity > 0 ? Number(a.accruedAmount) / Number(a.usageQuantity) : 0,
      amount: Number(a.accruedAmount),
      metadata: { snapshotId: a.id },
    }));

    if (discountAmount > 0) {
      lines.push({
        id: generateId("il"),
        invoiceId: invoice.id,
        lineType: "discount",
        description: "Applied discount rules",
        quantity: 1,
        unitPrice: -discountAmount,
        amount: -discountAmount,
        metadata: {},
      });
    }

    if (revenueShareAmount > 0) {
      lines.push({
        id: generateId("il"),
        invoiceId: invoice.id,
        lineType: "revenue_share",
        description: "Revenue share allocation",
        quantity: 1,
        unitPrice: revenueShareAmount,
        amount: revenueShareAmount,
        metadata: {},
      });
    }

    if (taxAmount > 0) {
      lines.push({
        id: generateId("il"),
        invoiceId: invoice.id,
        lineType: "tax",
        description: "VAT (7.5%)",
        quantity: 1,
        unitPrice: taxAmount,
        amount: taxAmount,
        metadata: {},
      });
    }

    const savedLines = await billingInvoiceLineRepository.saveMany(lines);

    let savedApprovals: BillingInvoiceApproval[] = [];
    if (useMatrix) {
      const matrices = await billingApprovalMatrixRepository.findByAccount(billingAccountId);
      const activeMatrix = matrices.find((m) => m.status === "active") ?? matrices[0];
      if (activeMatrix?.stages?.length) {
        const approvals: Partial<BillingInvoiceApproval>[] = activeMatrix.stages.map((stage) => ({
          id: generateId("ap"),
          invoiceId: invoice.id,
          stageKey: stage.stageKey,
          actorRole: stage.actorRole,
          status: "pending" as const,
          actedAt: null,
          note: null,
        }));
        savedApprovals = await billingInvoiceApprovalRepository.saveMany(approvals);
        await billingInvoiceRepository.update(invoice.id, {
          status: "pending_approval",
          approvalStepCount: activeMatrix.stages.length,
        });
      }
    }

    return { invoice, lines: savedLines, approvals: savedApprovals };
  },

  async resolveApproval(
    invoiceId: string,
    approvalId: string,
    decision: "approve" | "reject",
    note?: string,
  ): Promise<BillingInvoice> {
    const approval = await billingInvoiceApprovalRepository.findById(approvalId);
    if (!approval || approval.invoiceId !== invoiceId) {
      throw Object.assign(new Error("Approval not found"), { status: 404 });
    }

    await billingInvoiceApprovalRepository.update(approvalId, {
      status: decision === "approve" ? "approved" : "rejected",
      actedAt: new Date(),
      note: note ?? null,
    });

    const allApprovals = await billingInvoiceApprovalRepository.findByInvoice(invoiceId);
    const allApproved = allApprovals.every((a) => a.id === approvalId ? decision === "approve" : a.status === "approved");
    const anyRejected = allApprovals.some((a) => a.id === approvalId ? decision === "reject" : a.status === "rejected");

    if (anyRejected) {
      await billingInvoiceRepository.update(invoiceId, { status: "rejected", approvalStatus: "rejected" });
    } else if (allApproved) {
      await billingInvoiceRepository.update(invoiceId, { status: "approved", approvalStatus: "approved" });
    }

    return billingInvoiceRepository.findById(invoiceId) as Promise<BillingInvoice>;
  },

  async exportInvoice(invoiceId: string, format: "csv" | "json" | "html"): Promise<{ content: string; contentType: string }> {
    const invoice = await billingInvoiceRepository.findById(invoiceId);
    if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

    const lines = await billingInvoiceLineRepository.findByInvoice(invoiceId);
    const approvals = await billingInvoiceApprovalRepository.findByInvoice(invoiceId);
    const payload = { invoice, lines, approvals };

    if (format === "json") {
      return { content: JSON.stringify(payload, null, 2), contentType: "application/json" };
    }

    if (format === "csv") {
      const header = "id,invoice_number,total_amount,status,currency\n";
      const row = `${invoice.id},${invoice.invoiceNumber},${invoice.totalAmount},${invoice.status},${invoice.currency}\n`;
      return { content: header + row, contentType: "text/csv" };
    }

    const html = `<!DOCTYPE html><html><body>
      <h1>Invoice ${invoice.invoiceNumber}</h1>
      <p>Total: ${invoice.currency} ${Number(invoice.totalAmount).toLocaleString()}</p>
      <p>Status: ${invoice.status}</p>
      <p>Due: ${invoice.dueAt}</p>
      <table border="1"><tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
      ${lines.map((l) => `<tr><td>${l.description}</td><td>${l.quantity}</td><td>${l.amount}</td></tr>`).join("")}
      </table>
    </body></html>`;
    return { content: html, contentType: "text/html" };
  },
};
