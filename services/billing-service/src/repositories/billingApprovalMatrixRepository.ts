import { AppDataSource } from "../database/dataSource";
import { BillingApprovalMatrix } from "../models/BillingApprovalMatrix";

export const billingApprovalMatrixRepository = {
  repo: () => AppDataSource.getRepository(BillingApprovalMatrix),

  findAll(): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findActive(): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ where: { status: "active" }, order: { createdAt: "DESC" } });
  },

  findByAccount(billingAccountId: string): Promise<BillingApprovalMatrix[]> {
    return this.repo().find({ where: { billingAccountId }, order: { createdAt: "DESC" } });
  },

  save(matrix: Partial<BillingApprovalMatrix>): Promise<BillingApprovalMatrix> {
    return this.repo().save(matrix as BillingApprovalMatrix);
  },

  count(): Promise<number> {
    return this.repo().count({ where: { status: "active" } });
  },
};
