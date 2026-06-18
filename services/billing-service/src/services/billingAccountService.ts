import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingRateCardRepository } from "../repositories/billingRateCardRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { tenantRepository } from "../repositories/tenantRepository";
import { BillingAccount } from "../models/BillingAccount";
import { generateId, currentPeriodKey } from "../utils/id";

export const billingAccountService = {
  async createOrGetProfile(tenantId: string, plan: string): Promise<BillingAccount> {
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

    const account = await billingAccountRepository.save({
      id: generateId("ba"),
      tenantId,
      accountName: `${tenantId} billing account`,
      billingModel: plan === "revenue_share" ? "revenue_share" : plan === "subscription" ? "subscription" : "hybrid",
      currency: "NGN",
      status: "active",
      contractStartAt: new Date(),
      minimumCommitAmount: 0,
    });

    const rateCard = await billingRateCardRepository.save({
      id: generateId("rc"),
      billingAccountId: account.id,
      name: `Default rate card — ${plan}`,
      version: 1,
      status: "active",
      pricingCurrency: "NGN",
      createdBy: "billing-service",
      approvalState: "approved",
      effectiveFrom: new Date(),
    });

    await billingAccountRepository.update(account.id, { defaultRateCardId: rateCard.id });

    return { ...account, defaultRateCardId: rateCard.id };
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
      plan: { name: account.billingModel, price: totalAccrued, features: [] },
      billingCycle: "monthly" as const,
      nextBillingDate: nextMonth.toISOString(),
      status: account.status === "active" ? "active" : account.status === "suspended" ? "past_due" : "canceled",
    };
  },
};
