import { AppDataSource } from "../database/dataSource";
import { BillingDiscountRule } from "../models/BillingDiscountRule";

export const billingDiscountRuleRepository = {
  repo: () => AppDataSource.getRepository(BillingDiscountRule),

  // TS-60: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingDiscountRule[]> {
    return this.repo().find({ order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findByAccount(billingAccountId: string, limit = 500, offset = 0): Promise<BillingDiscountRule[]> {
    return this.repo().find({ where: { billingAccountId, status: "active" }, take: limit, skip: offset });
  },

  save(rule: Partial<BillingDiscountRule>): Promise<BillingDiscountRule> {
    return this.repo().save(rule as BillingDiscountRule);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
