import { AppDataSource } from "../database/dataSource";
import { BillingRateCard } from "../models/BillingRateCard";

export const billingRateCardRepository = {
  repo: () => AppDataSource.getRepository(BillingRateCard),

  findAll(): Promise<BillingRateCard[]> {
    return this.repo().find({ order: { createdAt: "DESC" } });
  },

  findById(id: string): Promise<BillingRateCard | null> {
    return this.repo().findOne({ where: { id } });
  },

  findByAccount(billingAccountId: string): Promise<BillingRateCard[]> {
    return this.repo().find({ where: { billingAccountId }, order: { version: "DESC" } });
  },

  findActive(): Promise<BillingRateCard[]> {
    return this.repo().find({ where: { status: "active" } });
  },

  save(card: Partial<BillingRateCard>): Promise<BillingRateCard> {
    return this.repo().save(card as BillingRateCard);
  },
};
