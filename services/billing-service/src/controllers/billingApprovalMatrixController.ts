import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingApprovalMatrixRepository } from "../repositories/billingApprovalMatrixRepository";
import { generateId } from "../utils/id";

export const billingApprovalMatrixController = {
  async list(_req: Request, res: Response) {
    const items = await billingApprovalMatrixRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async create(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const { billingAccountId, name, status, stages } = req.body;
    const matrix = await billingApprovalMatrixRepository.save({
      id: generateId("am"),
      tenantId,
      billingAccountId: billingAccountId ?? null,
      name,
      status: status ?? "active",
      createdBy: (req.headers["x-actor-id"] as string) ?? "system",
      stages: stages ?? [],
    });
    return res.status(httpStatus.CREATED).json(matrix);
  },
};
