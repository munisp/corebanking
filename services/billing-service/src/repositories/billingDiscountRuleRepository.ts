import { AppDataSource } from "../database/dataSource";
import { BillingDiscountRule } from "../models/BillingDiscountRule";

export const billingDiscountRuleRepository = {
  repo: () => AppDataSource.getRepository(BillingDiscountRule),

  findAll(): Promise<BillingDiscountRule[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findByAccount(billingAccountId: string): Promise<BillingDiscountRule[]> {
    return this.repo().find({ where: { billingAccountId, status: "active" } });
  },

  save(rule: Partial<BillingDiscountRule>): Promise<BillingDiscountRule> {
    return this.repo().save(rule as BillingDiscountRule);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
