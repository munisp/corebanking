import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingDashboardService } from "../services/billingDashboardService";
import { billingAccountRepository } from "../repositories/billingAccountRepository";

export const billingDashboardController = {
  async getDashboard(req: Request, res: Response) {
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const data = await billingDashboardService.getDashboard(tenantId);
    return res.status(httpStatus.OK).json(data);
  },

  async getExtendedDashboard(req: Request, res: Response) {
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const data = await billingDashboardService.getExtendedDashboard(tenantId);
    return res.status(httpStatus.OK).json(data);
  },

  async getStatus(req: Request, res: Response) {
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (!tenantId) {
      return res.status(httpStatus.BAD_REQUEST).json({ status: "inactive", message: "Missing tenant id" });
    }

    const accounts = await billingAccountRepository.findByTenant(tenantId);
    const account = accounts[0];
    if (!account) {
      return res.status(httpStatus.OK).json({ status: "inactive", tenantId });
    }

    const status = account.status === "active" ? "active" : account.status === "suspended" ? "suspended" : "inactive";
    return res.status(httpStatus.OK).json({ status, tenantId });
  },
};
