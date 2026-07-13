import { popApiCallCount } from "../lib/meteringRedisClient";
import { billingUsageEventRepository } from "../repositories/billingUsageEventRepository";
import { billingRatingService } from "./billingRatingService";
import { BillingAccount } from "../models/BillingAccount";
import { generateId } from "../utils/id";

export const billingMeteringService = {
  /**
   * Flushes the gateway's per-tenant API-call counter for the given period into a
   * BillingUsageEvent and rates it in-process. Called once per period, gated by the
   * caller (billingInvoiceService) checking no invoice exists yet for this period —
   * safe to call multiple times otherwise since a zero count is a no-op.
   */
  async flushApiCallUsage(account: BillingAccount, periodKey: string): Promise<void> {
    const count = await popApiCallCount(account.tenantId, periodKey);
    if (count <= 0) return;

    const event = await billingUsageEventRepository.save({
      id: generateId("ue"),
      idempotencyKey: `api_call_flush:${account.id}:${periodKey}`,
      tenantId: account.tenantId,
      billingAccountId: account.id,
      sourceService: "apisix-gateway",
      sourceEventType: "api_call_count",
      meterKey: "api_call",
      productKey: account.plan ?? "standard",
      quantity: count,
      currency: account.currency,
      eventTimestamp: new Date(),
      payload: { periodKey, flushedAt: new Date().toISOString() },
      status: "pending",
    });

    await billingRatingService.rateEvent(event);
  },
};
