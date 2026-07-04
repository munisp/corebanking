import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingRateCardRepository } from "../repositories/billingRateCardRepository";
import { billingRateCardLineRepository } from "../repositories/billingRateCardLineRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { billingPlanCatalogRepository } from "../repositories/billingPlanCatalogRepository";
import { billingInvoiceRepository } from "../repositories/billingInvoiceRepository";
import { billingInvoiceLineRepository } from "../repositories/billingInvoiceLineRepository";
import { tenantRepository } from "../repositories/tenantRepository";
import { BillingAccount } from "../models/BillingAccount";
import { generateId, currentPeriodKey, generateInvoiceNumber, resolvePeriodBounds } from "../utils/id";

const VAT_RATE = 0.075;

export const billingAccountService = {
  async createOrGetProfile(tenantId: string, plan: string, billingPeriod: string = "monthly"): Promise<BillingAccount> {
    // Ensure tenant exists in billing schema (required by FK constraint)
    const existingTenant = await tenantRepository.findOne({ where: { tenantId } });
    if (!existingTenant) {
      await tenantRepository.save({
        tenantId,
        tenantName: tenantId,
        status: "active",
      });
    }

    const existing = await billingAccountRepository.findByTenant(tenantId);
    if (existing.length > 0) return existing[0];

    const catalogEntry = await billingPlanCatalogRepository.findByPlanAndPeriod(plan, billingPeriod);
    if (!catalogEntry) {
      throw Object.assign(new Error(`No plan catalog entry for plan=${plan} period=${billingPeriod}`), { status: 422 });
    }

    const account = await billingAccountRepository.save({
      id: generateId("ba"),
      tenantId,
      accountName: `${tenantId} billing account`,
      billingModel: "hybrid",
      plan: catalogEntry.plan,
      billingPeriod: catalogEntry.billingPeriod,
      currency: catalogEntry.currency,
      status: "active",
      contractStartAt: new Date(),
      minimumCommitAmount: 0,
    });

    const rateCard = await billingRateCardRepository.save({
      id: generateId("rc"),
      billingAccountId: account.id,
      name: `${plan} / ${billingPeriod} rate card`,
      version: 1,
      status: "active",
      pricingCurrency: catalogEntry.currency,
      createdBy: "billing-service",
      approvalState: "approved",
      effectiveFrom: new Date(),
    });

    await billingRateCardLineRepository.save({
      id: generateId("rcl"),
      rateCardId: rateCard.id,
      meterKey: "plan_base_fee",
      productKey: plan,
      chargeType: "flat",
      unitPrice: catalogEntry.basePrice,
      includedUnits: 0,
    });

    await billingRateCardLineRepository.save({
      id: generateId("rcl"),
      rateCardId: rateCard.id,
      meterKey: "api_call",
      productKey: plan,
      chargeType: "per_unit",
      unitPrice: catalogEntry.overagePricePerCall,
      includedUnits: catalogEntry.includedApiCalls,
    });

    await billingAccountRepository.update(account.id, { defaultRateCardId: rateCard.id });

    await this.createSubscriptionInvoice(account, catalogEntry.basePrice, catalogEntry.currency);

    return { ...account, defaultRateCardId: rateCard.id };
  },

  /**
   * One-time invoice for the plan's base fee, charged at account-creation time for
   * the tenant's chosen period. Built directly (not via billingInvoiceService.generateForAccount,
   * which is accrual-snapshot-driven and always keyed by calendar month) so annual periods
   * are represented correctly without touching the usage-rating pipeline.
   */
  async createSubscriptionInvoice(account: BillingAccount, basePrice: number, currency: string): Promise<void> {
    const { start, end, periodKey } = resolvePeriodBounds(account.billingPeriod);
    const taxAmount = basePrice * VAT_RATE;
    const totalAmount = basePrice + taxAmount;
    const dueAt = new Date(start);
    dueAt.setDate(dueAt.getDate() + 30);

    const invoice = await billingInvoiceRepository.save({
      id: generateId("inv"),
      invoiceNumber: generateInvoiceNumber(),
      tenantId: account.tenantId,
      billingAccountId: account.id,
      billingPeriodKey: periodKey,
      billingPeriodType: account.billingPeriod,
      periodStartAt: start,
      periodEndAt: end,
      currency,
      subtotalAmount: basePrice,
      discountAmount: 0,
      revenueShareAmount: 0,
      minimumCommitAdjustment: 0,
      taxAmount,
      totalAmount,
      status: "draft",
      approvalStatus: "pending",
      generatedAt: new Date(),
      dueAt,
      approvalStepCount: 0,
    });

    await billingInvoiceLineRepository.saveMany([
      {
        id: generateId("il"),
        invoiceId: invoice.id,
        lineType: "usage",
        meterKey: "plan_base_fee",
        productKey: account.plan ?? undefined,
        description: `${account.plan} plan — ${account.billingPeriod} subscription fee`,
        quantity: 1,
        unitPrice: basePrice,
        amount: basePrice,
        metadata: {},
      },
      {
        id: generateId("il"),
        invoiceId: invoice.id,
        lineType: "tax",
        description: "VAT (7.5%)",
        quantity: 1,
        unitPrice: taxAmount,
        amount: taxAmount,
        metadata: {},
      },
    ]);
  },

  async getBillingInfo(tenantId: string) {
    const accounts = await billingAccountRepository.findByTenant(tenantId);
    const account = accounts[0];
    if (!account) {
      return { plan: { name: "none", price: 0, features: [] }, billingCycle: "monthly", nextBillingDate: null, status: "active" };
    }

    const period = currentPeriodKey();
    const accruals = account ? await billingAccrualSnapshotRepository.findByAccount(account.id, period) : [];
    const totalAccrued = accruals.reduce((s, a) => s + Number(a.accruedAmount), 0);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);

    return {
      plan: { name: account.plan ?? account.billingModel, price: totalAccrued, features: [] },
      billingCycle: account.billingPeriod,
      nextBillingDate: nextMonth.toISOString(),
      status: account.status === "active" ? "active" : account.status === "suspended" ? "past_due" : "canceled",
    };
  },
};
