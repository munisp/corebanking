import { billingUsageEventRepository } from "../repositories/billingUsageEventRepository";
import { billingRatedEventRepository } from "../repositories/billingRatedEventRepository";
import { billingRateCardRepository } from "../repositories/billingRateCardRepository";
import { billingRateCardLineRepository } from "../repositories/billingRateCardLineRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { BillingUsageEvent } from "../models/BillingUsageEvent";
import { generateId, currentPeriodKey } from "../utils/id";
import logger from "../config/logger.config";

export const billingRatingService = {
  async rateEvent(event: BillingUsageEvent): Promise<void> {
    try {
      const account = event.billingAccountId
        ? await billingAccountRepository.findById(event.billingAccountId)
        : null;

      if (!account) {
        await billingUsageEventRepository.updateStatus(event.id, "ignored");
        return;
      }

      const rateCardId = account.defaultRateCardId;
      if (!rateCardId) {
        await billingUsageEventRepository.updateStatus(event.id, "ignored");
        return;
      }

      const line = await billingRateCardLineRepository.findByMeter(rateCardId, event.meterKey);
      if (!line) {
        await billingUsageEventRepository.updateStatus(event.id, "ignored");
        return;
      }

      const quantity = event.quantity;
      const billableUnits = Math.max(0, quantity - line.includedUnits);
      let amount = billableUnits * Number(line.unitPrice);

      if (line.minimumCharge !== null && amount < Number(line.minimumCharge)) {
        amount = Number(line.minimumCharge);
      }
      if (line.maximumCharge !== null && amount > Number(line.maximumCharge)) {
        amount = Number(line.maximumCharge);
      }

      const periodKey = currentPeriodKey();

      await billingRatedEventRepository.save({
        id: generateId("rev"),
        usageEventId: event.id,
        rateCardId,
        rateCardLineId: line.id,
        billingPeriodKey: periodKey,
        quantityRated: quantity,
        billableUnits,
        amountAccrued: amount,
        currency: event.currency,
        ratingExplanation: { quantity, billableUnits, unitPrice: line.unitPrice, chargeType: line.chargeType },
        ratedAt: new Date(),
      });

      await billingUsageEventRepository.updateStatus(event.id, "rated");
      await this.updateAccrualSnapshot(account.id, account.tenantId, periodKey, event.meterKey, event.productKey, quantity, amount);
    } catch (err) {
      logger.error("[billingRatingService] Failed to rate event", { eventId: event.id, err });
      await billingUsageEventRepository.updateStatus(event.id, "failed");
    }
  },

  async updateAccrualSnapshot(
    billingAccountId: string,
    tenantId: string,
    periodKey: string,
    meterKey: string,
    productKey: string,
    quantity: number,
    amount: number,
  ): Promise<void> {
    const existing = await billingAccrualSnapshotRepository
      .findByAccount(billingAccountId, periodKey)
      .then((list) => list.find((s) => s.meterKey === meterKey && s.productKey === productKey));

    if (existing) {
      existing.ratedEventCount += 1;
      existing.usageQuantity = Number(existing.usageQuantity) + quantity;
      existing.accruedAmount = Number(existing.accruedAmount) + amount;
      existing.lastRatedAt = new Date();
      await billingAccrualSnapshotRepository.upsert(existing);
    } else {
      await billingAccrualSnapshotRepository.upsert({
        id: generateId("sn"),
        tenantId,
        billingAccountId,
        billingPeriodKey: periodKey,
        meterKey,
        productKey,
        ratedEventCount: 1,
        usageQuantity: quantity,
        accruedAmount: amount,
        unratedEventCount: 0,
        lastRatedAt: new Date(),
        snapshotStatus: "healthy",
      });
    }
  },

  async processAllPending(): Promise<number> {
    const pending = await billingUsageEventRepository.findPending();
    await Promise.all(pending.map((e) => this.rateEvent(e)));
    return pending.length;
  },
};
