import { AppDataSource } from "../database/dataSource";
import { BillingRateCardLine } from "../models/BillingRateCardLine";

export const billingRateCardLineRepository = {
  repo: () => AppDataSource.getRepository(BillingRateCardLine),

  findAll(): Promise<BillingRateCardLine[]> {
    return this.repo().find();
  },

  findByCard(rateCardId: string): Promise<BillingRateCardLine[]> {
    return this.repo().find({ where: { rateCardId } });
  },

  findByMeter(rateCardId: string, meterKey: string): Promise<BillingRateCardLine | null> {
    return this.repo().findOne({ where: { rateCardId, meterKey } });
  },

  save(line: Partial<BillingRateCardLine>): Promise<BillingRateCardLine> {
    return this.repo().save(line as BillingRateCardLine);
  },
};
