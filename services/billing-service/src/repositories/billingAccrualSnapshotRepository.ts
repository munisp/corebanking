import { AppDataSource } from "../database/dataSource";
import { BillingAccrualSnapshot } from "../models/BillingAccrualSnapshot";

export const billingAccrualSnapshotRepository = {
  repo: () => AppDataSource.getRepository(BillingAccrualSnapshot),

  findAll(limit = 100): Promise<BillingAccrualSnapshot[]> {
    return this.repo().find({ order: { updatedAt: "DESC" }, take: limit });
  },

  findByAccount(billingAccountId: string, billingPeriodKey?: string): Promise<BillingAccrualSnapshot[]> {
    const where: any = { billingAccountId };
    if (billingPeriodKey) where.billingPeriodKey = billingPeriodKey;
    return this.repo().find({ where, order: { updatedAt: "DESC" } });
  },

  upsert(snapshot: Partial<BillingAccrualSnapshot>): Promise<BillingAccrualSnapshot> {
    return this.repo().save(snapshot as BillingAccrualSnapshot);
  },

  sumAccruedForAccount(billingAccountId: string, billingPeriodKey: string): Promise<number> {
    return this.repo()
      .createQueryBuilder("s")
      .select("COALESCE(SUM(s.accrued_amount), 0)", "total")
      .where("s.billing_account_id = :billingAccountId AND s.billing_period_key = :billingPeriodKey", {
        billingAccountId,
        billingPeriodKey,
      })
      .getRawOne()
      .then((r) => Number(r?.total ?? 0));
  },
};
