import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingAccountService } from "../services/billingAccountService";

export const billingAccountController = {
  async createProfile(req: Request, res: Response) {
    const tenantId = req.headers["x-tenant-id"] as string;
    const { plan, billingPeriod } = req.body;
    const billing_profile = await billingAccountService.createOrGetProfile(tenantId, plan ?? "standard", billingPeriod ?? "monthly");
    return res.status(httpStatus.OK).json({ billing_profile });
  },

  async getBillingInfo(req: Request, res: Response) {
    const tenantId = req.headers["x-tenant-id"] as string;
    const billing_info = await billingAccountService.getBillingInfo(tenantId);
    return res.status(httpStatus.OK).json({ billing_info });
  },
};
