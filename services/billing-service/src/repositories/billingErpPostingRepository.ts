import { AppDataSource } from "../database/dataSource";
import { BillingErpPosting } from "../models/BillingErpPosting";

export const billingErpPostingRepository = {
  repo: () => AppDataSource.getRepository(BillingErpPosting),

  findAll(): Promise<BillingErpPosting[]> {
    return this.repo().find({ order: { queuedAt: "DESC" } });
  },

  findById(id: string): Promise<BillingErpPosting | null> {
    return this.repo().findOne({ where: { id } });
  },

  findQueued(): Promise<BillingErpPosting[]> {
    return this.repo().find({ where: { status: "queued" }, order: { queuedAt: "ASC" } });
  },

  save(posting: Partial<BillingErpPosting>): Promise<BillingErpPosting> {
    return this.repo().save(posting as BillingErpPosting);
  },

  update(id: string, data: Partial<BillingErpPosting>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },

  countQueued(): Promise<number> {
    return this.repo().count({ where: { status: "queued" } });
  },
};
