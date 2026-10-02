import { AppDataSource } from "../database/dataSource";
import { BillingErpPosting } from "../models/BillingErpPosting";

export const billingErpPostingRepository = {
  repo: () => AppDataSource.getRepository(BillingErpPosting),

  // TS-59: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingErpPosting[]> {
    return this.repo().find({ order: { queuedAt: "DESC" }, take: limit, skip: offset });
  },

  findById(id: string): Promise<BillingErpPosting | null> {
    return this.repo().findOne({ where: { id } });
  },

  findQueued(limit = 500, offset = 0): Promise<BillingErpPosting[]> {
    return this.repo().find({ where: { status: "queued" }, order: { queuedAt: "ASC" }, take: limit, skip: offset });
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
