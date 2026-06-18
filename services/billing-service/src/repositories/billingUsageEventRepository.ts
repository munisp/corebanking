import { AppDataSource } from "../database/dataSource";
import { BillingUsageEvent } from "../models/BillingUsageEvent";

export const billingUsageEventRepository = {
  repo: () => AppDataSource.getRepository(BillingUsageEvent),

  findAll(limit = 100): Promise<BillingUsageEvent[]> {
    return this.repo().find({ order: { eventTimestamp: "DESC" }, take: limit });
  },

  findByAccount(billingAccountId: string): Promise<BillingUsageEvent[]> {
    return this.repo().find({ where: { billingAccountId }, order: { eventTimestamp: "DESC" } });
  },

  findPending(): Promise<BillingUsageEvent[]> {
    return this.repo().find({ where: { status: "pending" } });
  },

  findByIdempotencyKey(tenantId: string, key: string): Promise<BillingUsageEvent | null> {
    return this.repo().findOne({ where: { tenantId, idempotencyKey: key } });
  },

  save(event: Partial<BillingUsageEvent>): Promise<BillingUsageEvent> {
    return this.repo().save(event as BillingUsageEvent);
  },

  updateStatus(id: string, status: BillingUsageEvent["status"]): Promise<void> {
    return this.repo().update(id, { status }).then(() => undefined);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
