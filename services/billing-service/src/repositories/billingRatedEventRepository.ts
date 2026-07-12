import { AppDataSource } from "../database/dataSource";
import { BillingRatedEvent } from "../models/BillingRatedEvent";

export const billingRatedEventRepository = {
  repo: () => AppDataSource.getRepository(BillingRatedEvent),

  findAll(limit = 100): Promise<BillingRatedEvent[]> {
    return this.repo().find({ order: { ratedAt: "DESC" }, take: limit });
  },

  findByPeriod(billingPeriodKey: string): Promise<BillingRatedEvent[]> {
    return this.repo().find({ where: { billingPeriodKey }, order: { ratedAt: "DESC" } });
  },

  save(event: Partial<BillingRatedEvent>): Promise<BillingRatedEvent> {
    return this.repo().save(event as BillingRatedEvent);
  },

  sumAmountForPeriod(billingPeriodKey: string): Promise<number> {
    return this.repo()
      .createQueryBuilder("re")
      .select("COALESCE(SUM(re.amount_accrued), 0)", "total")
      .where("re.billing_period_key = :billingPeriodKey", { billingPeriodKey })
      .getRawOne()
      .then((r) => Number(r?.total ?? 0));
  },
};
