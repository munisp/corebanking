import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingRateCardRepository } from "../repositories/billingRateCardRepository";
import { billingRateCardLineRepository } from "../repositories/billingRateCardLineRepository";
import { generateId } from "../utils/id";

export const billingRateCardController = {
  async list(req: Request, res: Response) {
    const items = await billingRateCardRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async create(req: Request, res: Response) {
    const { billingAccountId, name, pricingCurrency } = req.body;
    const card = await billingRateCardRepository.save({
      id: generateId("rc"),
      billingAccountId: billingAccountId ?? null,
      name,
      version: 1,
      status: "draft",
      pricingCurrency: pricingCurrency ?? "NGN",
      createdBy: (req.headers["x-actor-id"] as string) ?? "system",
      approvalState: "pending",
      effectiveFrom: new Date(),
    });
    return res.status(httpStatus.CREATED).json(card);
  },
};
