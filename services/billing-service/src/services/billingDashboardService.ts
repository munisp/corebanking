import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingRateCardRepository } from "../repositories/billingRateCardRepository";
import { billingRateCardLineRepository } from "../repositories/billingRateCardLineRepository";
import { billingUsageEventRepository } from "../repositories/billingUsageEventRepository";
import { billingRatedEventRepository } from "../repositories/billingRatedEventRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { billingInvoiceRepository } from "../repositories/billingInvoiceRepository";
import { billingInvoiceLineRepository } from "../repositories/billingInvoiceLineRepository";
import { billingInvoiceApprovalRepository } from "../repositories/billingInvoiceApprovalRepository";
import { billingContractOverrideRepository } from "../repositories/billingContractOverrideRepository";
import { billingDiscountRuleRepository } from "../repositories/billingDiscountRuleRepository";
import { billingRevenueShareRuleRepository } from "../repositories/billingRevenueShareRuleRepository";
import { billingApprovalMatrixRepository } from "../repositories/billingApprovalMatrixRepository";
import { billingInvoiceDisputeRepository } from "../repositories/billingInvoiceDisputeRepository";
import { billingErpPostingRepository } from "../repositories/billingErpPostingRepository";
import { currentPeriodKey } from "../utils/id";

export const billingDashboardService = {
  async getDashboard(tenantId?: string) {
    const periodKey = currentPeriodKey();

    const [
      accounts,
      rateCards,
      rateCardLines,
      usageEvents,
      ratedEvents,
      accruals,
      invoices,
      invoiceLines,
      invoiceApprovals,
      contractOverrides,
      discountRules,
      revenueShareRules,
    ] = await Promise.all([
      billingAccountRepository.findAll(),
      billingRateCardRepository.findAll(),
      billingRateCardLineRepository.findAll(),
      billingUsageEventRepository.findAll(50),
      billingRatedEventRepository.findAll(50),
      billingAccrualSnapshotRepository.findAll(50),
      billingInvoiceRepository.findAll(20),
      billingInvoiceLineRepository.findAll(100),
      billingInvoiceApprovalRepository.findAll(100),
      billingContractOverrideRepository.findAll(),
      billingDiscountRuleRepository.findAll(),
      billingRevenueShareRuleRepository.findAll(),
    ]);

    const totalAccruedAmount = accruals.reduce((s, a) => s + Number(a.accruedAmount), 0);
    const pendingApprovalCount = invoices.filter((i) => i.status === "pending_approval").length;
    const issuedAmount = invoices.filter((i) => i.status === "issued").reduce((s, i) => s + Number(i.totalAmount), 0);

    const topMeters = Object.values(
      accruals.reduce<Record<string, { meterKey: string; productKey: string; accruedAmount: number; usageQuantity: number }>>((acc, a) => {
        const key = `${a.meterKey}:${a.productKey}`;
        if (!acc[key]) acc[key] = { meterKey: a.meterKey, productKey: a.productKey, accruedAmount: 0, usageQuantity: 0 };
        acc[key].accruedAmount += Number(a.accruedAmount);
        acc[key].usageQuantity += Number(a.usageQuantity);
        return acc;
      }, {}),
    ).slice(0, 5);

    const liveSeries = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const pk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const periodAccrued = accruals.filter((a) => a.billingPeriodKey === pk).reduce((s, a) => s + Number(a.accruedAmount), 0);
      const periodInvoiced = invoices.filter((inv) => inv.billingPeriodKey === pk).reduce((s, inv) => s + Number(inv.totalAmount), 0);
      return { periodKey: pk, accruedAmount: periodAccrued, usageEventCount: usageEvents.filter((e) => e.eventTimestamp >= d).length, invoiceAmount: periodInvoiced };
    });

    return {
      asOf: new Date().toISOString(),
      summary: {
        billingPeriodKey: periodKey,
        currency: "NGN",
        totalAccruedAmount,
        ratedEventCount: ratedEvents.length,
        unratedEventCount: usageEvents.filter((e) => e.status === "pending").length,
        usageEventCount: usageEvents.length,
        draftInvoiceCount: invoices.filter((i) => i.status === "draft").length,
        pendingApprovalInvoiceCount: pendingApprovalCount,
        issuedInvoiceAmount: issuedAmount,
        topMeters,
        thresholdAlerts: [],
        liveSeries,
        contractSummary: {
          overrideCount: contractOverrides.length,
          discountRuleCount: discountRules.length,
          revenueShareRuleCount: revenueShareRules.length,
        },
      },
      accounts,
      rateCards,
      rateCardLines,
      usageEvents,
      ratedEvents,
      accruals,
      invoices,
      invoiceLines,
      invoiceApprovals,
      contractOverrides,
      discountRules,
      revenueShareRules,
      middleware: ["Kafka", "Dapr", "TigerBeetle", "Redis"],
    };
  },

  async getExtendedDashboard(tenantId?: string) {
    const base = await this.getDashboard(tenantId);

    const [disputes, approvalMatrices, erpPostings] = await Promise.all([
      billingInvoiceDisputeRepository.findAll(),
      billingApprovalMatrixRepository.findAll(),
      billingErpPostingRepository.findAll(),
    ]);

    const [disputeCount, matrixCount, queuedErpPostings] = await Promise.all([
      billingInvoiceDisputeRepository.count(),
      billingApprovalMatrixRepository.count(),
      billingErpPostingRepository.countQueued(),
    ]);

    const recentEvents = base.usageEvents.slice(0, 10);
    type ServiceBucket = { sourceService: string; eventCount: number; quantity: number };
    const serviceBreakdown = Object.values(
      recentEvents.reduce((acc: Record<string, ServiceBucket>, e) => {
        if (!acc[e.sourceService]) acc[e.sourceService] = { sourceService: e.sourceService, eventCount: 0, quantity: 0 };
        acc[e.sourceService].eventCount += 1;
        acc[e.sourceService].quantity += e.quantity;
        return acc;
      }, {} as Record<string, ServiceBucket>),
    );

    type MeterBucket = { meterKey: string; productKey: string; eventCount: number; quantity: number };
    const meterBreakdown = Object.values(
      recentEvents.reduce((acc: Record<string, MeterBucket>, e) => {
        const key = `${e.meterKey}:${e.productKey}`;
        if (!acc[key]) acc[key] = { meterKey: e.meterKey, productKey: e.productKey, eventCount: 0, quantity: 0 };
        acc[key].eventCount += 1;
        acc[key].quantity += e.quantity;
        return acc;
      }, {} as Record<string, MeterBucket>),
    );

    const lastEvent = recentEvents[0];

    return {
      ...base,
      liveIngestion: {
        middleware: ["Kafka", "Dapr", "TigerBeetle", "Redis", "Fluvio"] as any,
        lastIngestedAt: lastEvent?.ingestedAt?.toISOString(),
        serviceBreakdown,
        meterBreakdown,
      },
      disputes,
      approvalMatrices,
      erpPostings,
      controls: {
        overrideCount: base.contractOverrides.length,
        discountRuleCount: base.discountRules.length,
        revenueShareRuleCount: base.revenueShareRules.length,
        disputeCount,
        matrixCount,
        queuedErpPostings,
        issuedInvoices: base.invoices.filter((i) => i.status === "issued").length,
      },
    };
  },
};
