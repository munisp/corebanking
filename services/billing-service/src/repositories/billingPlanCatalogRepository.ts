import { AppDataSource } from "../database/dataSource";
import { BillingPlanCatalog } from "../models/BillingPlanCatalog";

export const billingPlanCatalogRepository = {
  repo: () => AppDataSource.getRepository(BillingPlanCatalog),

  findAll(): Promise<BillingPlanCatalog[]> {
    return this.repo().find({ order: { plan: "ASC", billingPeriod: "ASC" } });
  },

  findByPlanAndPeriod(plan: string, billingPeriod: string): Promise<BillingPlanCatalog | null> {
    return this.repo().findOne({ where: { plan: plan as BillingPlanCatalog["plan"], billingPeriod: billingPeriod as BillingPlanCatalog["billingPeriod"] } });
  },

  save(entry: Partial<BillingPlanCatalog>): Promise<BillingPlanCatalog> {
    return this.repo().save(entry as BillingPlanCatalog);
  },
};
