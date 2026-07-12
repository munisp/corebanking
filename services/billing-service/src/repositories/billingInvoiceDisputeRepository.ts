import { AppDataSource } from "../database/dataSource";
import { BillingInvoiceDispute } from "../models/BillingInvoiceDispute";

export const billingInvoiceDisputeRepository = {
  repo: () => AppDataSource.getRepository(BillingInvoiceDispute),

  findAll(): Promise<BillingInvoiceDispute[]> {
    return this.repo().find({ order: { openedAt: "DESC" } });
  },

  findById(id: string): Promise<BillingInvoiceDispute | null> {
    return this.repo().findOne({ where: { id } });
  },

  findByInvoice(invoiceId: string): Promise<BillingInvoiceDispute[]> {
    return this.repo().find({ where: { invoiceId } });
  },

  findOpen(): Promise<BillingInvoiceDispute[]> {
    return this.repo().find({ where: { status: "open" }, order: { openedAt: "DESC" } });
  },

  save(dispute: Partial<BillingInvoiceDispute>): Promise<BillingInvoiceDispute> {
    return this.repo().save(dispute as BillingInvoiceDispute);
  },

  update(id: string, data: Partial<BillingInvoiceDispute>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },

  count(): Promise<number> {
    return this.repo().count();
  },
};
