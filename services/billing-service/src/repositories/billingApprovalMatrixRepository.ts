import { AppDataSource } from "../database/dataSource";
import { BillingApprovalMatrix } from "../models/BillingApprovalMatrix";

export const billingApprovalMatrixRepository = {
  repo: () => AppDataSource.getRepository(BillingApprovalMatrix),

  // TS-57: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findActive(limit = 500, offset = 0): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ where: { status: "active" }, order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  findByAccount(billingAccountId: string, limit = 500, offset = 0): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ where: { billingAccountId }, order: { createdAt: "DESC" }, take: limit, skip: offset });
  },

  save(matrix: Partial<BillingApprovalMatrix>): Promise<BillingApprovalMatrix> {
    return this.repo().save(matrix as BillingApprovalMatrix);
  },

  count(): Promise<number> {
    return this.repo().count({ where: { status: "active" } });
  },
};
