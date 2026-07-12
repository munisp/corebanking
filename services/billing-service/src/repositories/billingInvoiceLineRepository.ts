import { AppDataSource } from "../database/dataSource";
import { BillingInvoiceLine } from "../models/BillingInvoiceLine";

export const billingInvoiceLineRepository = {
  repo: () => AppDataSource.getRepository(BillingInvoiceLine),

  findByInvoice(invoiceId: string): Promise<BillingInvoiceLine[]> {
    return this.repo().find({ where: { invoiceId } });
  },

  findAll(limit = 200): Promise<BillingInvoiceLine[]> {
    return this.repo().find({ take: limit });
  },

  save(line: Partial<BillingInvoiceLine>): Promise<BillingInvoiceLine> {
    return this.repo().save(line as BillingInvoiceLine);
  },

  saveMany(lines: Partial<BillingInvoiceLine>[]): Promise<BillingInvoiceLine[]> {
    return this.repo().save(lines as BillingInvoiceLine[]);
  },
};
