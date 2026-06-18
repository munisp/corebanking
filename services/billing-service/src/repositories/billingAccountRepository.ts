import { AppDataSource } from "../database/dataSource";
import { BillingAccount } from "../models/BillingAccount";

export const billingAccountRepository = {
  repo: () => AppDataSource.getRepository(BillingAccount),

  findAll(): Promise<BillingAccount[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findById(id: string): Promise<BillingAccount | null> {
    return this.repo().findOne({ where: { id } });
  },

  findByTenant(tenantId: string): Promise<BillingAccount[]> {
    return this.repo().find({ where: { tenantId }, order: { createdAt: "DESC" } });
  },

  findActive(): Promise<BillingAccount[]> {
    return this.repo().find({ where: { status: "active" }, order: { createdAt: "DESC" } });
  },

  save(account: Partial<BillingAccount>): Promise<BillingAccount> {
    return this.repo().save(account as BillingAccount);
  },

  update(id: string, data: Partial<BillingAccount>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },
};
