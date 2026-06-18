import { AppDataSource } from "../database/dataSource";
import { BillingContractOverride } from "../models/BillingContractOverride";

export const billingContractOverrideRepository = {
  repo: () => AppDataSource.getRepository(BillingContractOverride),

  findAll(): Promise<BillingContractOverride[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findByAccount(billingAccountId: string): Promise<BillingContractOverride[]> {
    return this.repo().find({ where: { billingAccountId, status: "active" } });
  },

  save(override: Partial<BillingContractOverride>): Promise<BillingContractOverride> {
    return this.repo().save(override as BillingContractOverride);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
