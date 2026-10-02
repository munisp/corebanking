import { AppDataSource } from "../database/dataSource";
import { BillingPlanCatalog } from "../models/BillingPlanCatalog";

export const billingPlanCatalogRepository = {
  repo: () => AppDataSource.getRepository(BillingPlanCatalog),

  // TS-58: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingPlanCatalog[]> {
    return this.repo().find({ order: { plan: "ASC", billingPeriod: "ASC" }, take: limit, skip: offset });
  },

  findByPlanAndPeriod(plan: string, billingPeriod: string): Promise<BillingPlanCatalog | null> {
    return this.repo().findOne({ where: { plan: plan as BillingPlanCatalog["plan"], billingPeriod: billingPeriod as BillingPlanCatalog["billingPeriod"] } });
  },

  save(entry: Partial<BillingPlanCatalog>): Promise<BillingPlanCatalog> {
    return this.repo().save(entry as BillingPlanCatalog);
  },
};
