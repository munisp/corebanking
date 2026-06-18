import { AppDataSource } from "../database/dataSource";
import { BillingRevenueShareRule } from "../models/BillingRevenueShareRule";

export const billingRevenueShareRuleRepository = {
  repo: () => AppDataSource.getRepository(BillingRevenueShareRule),

  findAll(): Promise<BillingRevenueShareRule[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findByAccount(billingAccountId: string): Promise<BillingRevenueShareRule[]> {
    return this.repo().find({ where: { billingAccountId, status: "active" } });
  },

  save(rule: Partial<BillingRevenueShareRule>): Promise<BillingRevenueShareRule> {
    return this.repo().save(rule as BillingRevenueShareRule);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
