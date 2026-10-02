import { AppDataSource } from "../database/dataSource";
import { BillingAccount } from "../models/BillingAccount";

export const billingAccountRepository = {
  repo: () => AppDataSource.getRepository(BillingAccount),

  // TS-56: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingAccount[]> {
    return this.repo().find({ order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findById(id: string): Promise<BillingAccount | null> {
    return this.repo().findOne({ where: { id } });
  },

  findByTenant(tenantId: string, limit = 500, offset = 0): Promise<BillingAccount[]> {
    return this.repo().find({ where: { tenantId }, order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findActive(limit = 500, offset = 0): Promise<BillingAccount[]> {
    return this.repo().find({ where: { status: "active" }, order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  save(account: Partial<BillingAccount>): Promise<BillingAccount> {
    return this.repo().save(account as BillingAccount);
  },

  update(id: string, data: Partial<BillingAccount>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },
};
