import { AppDataSource } from "../database/dataSource";
import { BillingRateCardLine } from "../models/BillingRateCardLine";

export const billingRateCardLineRepository = {
  repo: () => AppDataSource.getRepository(BillingRateCardLine),

  // TS-55: bounded by default (take 500); callers may paginate via limit/offset.
  findAll(limit = 500, offset = 0): Promise<BillingRateCardLine[]> {
    return this.repo().find({ take: limit, skip: offset });
  },

  findByCard(rateCardId: string, limit = 500, offset = 0): Promise<BillingRateCardLine[]> {
    return this.repo().find({ where: { rateCardId }, take: limit, skip: offset });
  },

  findByMeter(rateCardId: string, meterKey: string): Promise<BillingRateCardLine | null> {
    return this.repo().findOne({ where: { rateCardId, meterKey } });
  },

  save(line: Partial<BillingRateCardLine>): Promise<BillingRateCardLine> {
    return this.repo().save(line as BillingRateCardLine);
  },
};
