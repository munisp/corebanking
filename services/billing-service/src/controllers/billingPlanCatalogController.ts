import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingPlanCatalogRepository } from "../repositories/billingPlanCatalogRepository";

export const billingPlanCatalogController = {
  async list(req: Request, res: Response) {
    const items = await billingPlanCatalogRepository.findAll();
    return res.status(httpStatus.OK).json({ items, total: items.length });
  },
};
