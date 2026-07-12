import { AppDataSource } from "../database/dataSource";
import { BillingInvoice } from "../models/BillingInvoice";

export const billingInvoiceRepository = {
  repo: () => AppDataSource.getRepository(BillingInvoice),

  findAll(limit = 50): Promise<BillingInvoice[]> {
    return this.repo().find({ order: { generatedAt: "DESC" }, take: limit });
  },

  findById(id: string): Promise<BillingInvoice | null> {
    return this.repo().findOne({ where: { id } });
  },

  findByAccount(billingAccountId: string): Promise<BillingInvoice[]> {
    return this.repo().find({ where: { billingAccountId }, order: { generatedAt: "DESC" } });
  },

  findByAccountAndPeriod(billingAccountId: string, billingPeriodKey: string): Promise<BillingInvoice | null> {
    return this.repo().findOne({ where: { billingAccountId, billingPeriodKey } });
  },

  findByStatus(status: BillingInvoice["status"]): Promise<BillingInvoice[]> {
    return this.repo().find({ where: { status }, order: { generatedAt: "DESC" } });
  },

  save(invoice: Partial<BillingInvoice>): Promise<BillingInvoice> {
    return this.repo().save(invoice as BillingInvoice);
  },

  update(id: string, data: Partial<BillingInvoice>): Promise<void> {
    return this.repo().update(id, data).then(() => undefined);
  },

  countByStatus(status: BillingInvoice["status"]): Promise<number> {
    return this.repo().count({ where: { status } });
  },
};
