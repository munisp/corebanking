import { AppDataSource } from "../database/dataSource";
import { BillingRevenueShareRule } from "../models/BillingRevenueShareRule";

export const billingRevenueShareRuleRepository = {
  repo: () => AppDataSource.getRepository(BillingRevenueShareRule),

  // TS-60: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingRevenueShareRule[]> {
    return this.repo().find({ order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findByAccount(billingAccountId: string, limit = 500, offset = 0): Promise<BillingRevenueShareRule[]> {
    return this.repo().find({ where: { billingAccountId, status: "active" }, take: limit, skip: offset });
  },

  save(rule: Partial<BillingRevenueShareRule>): Promise<BillingRevenueShareRule> {
    return this.repo().save(rule as BillingRevenueShareRule);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
