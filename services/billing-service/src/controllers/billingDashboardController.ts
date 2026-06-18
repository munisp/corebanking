import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingDashboardService } from "../services/billingDashboardService";

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
    return res.status(httpStatus.OK).json({ status: "active", tenantId });
  },
};
