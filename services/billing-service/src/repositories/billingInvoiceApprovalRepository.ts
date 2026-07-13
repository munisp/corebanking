import { AppDataSource } from "../database/dataSource";
import { BillingInvoiceApproval } from "../models/BillingInvoiceApproval";

export const billingInvoiceApprovalRepository = {
  repo: () => AppDataSource.getRepository(BillingInvoiceApproval),

  findByInvoice(invoiceId: string): Promise<BillingInvoiceApproval[]> {
    return this.repo().find({ where: { invoiceId } });
  },

  findById(id: string): Promise<BillingInvoiceApproval | null> {
    return this.repo().findOne({ where: { id } });
  },

  findAll(limit = 200): Promise<BillingInvoiceApproval[]> {
    return this.repo().find({ take: limit });
  },

  save(approval: Partial<BillingInvoiceApproval>): Promise<BillingInvoiceApproval> {
    return this.repo().save(approval as BillingInvoiceApproval);
  },

  saveMany(approvals: Partial<BillingInvoiceApproval>[]): Promise<BillingInvoiceApproval[]> {
    return this.repo().save(approvals as BillingInvoiceApproval[]);
  },

  update(id: string, data: Partial<BillingInvoiceApproval>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },

  countPending(): Promise<number> {
    return this.repo().count({ where: { status: "pending" } });
  },
};
