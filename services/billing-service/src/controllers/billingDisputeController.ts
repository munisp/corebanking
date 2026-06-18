import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingInvoiceDisputeRepository } from "../repositories/billingInvoiceDisputeRepository";
import { generateId } from "../utils/id";

export const billingDisputeController = {
  async list(_req: Request, res: Response) {
    const items = await billingInvoiceDisputeRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async create(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const { invoiceId, severity, reasonCode, title, detail, assignedRole } = req.body;
    const dispute = await billingInvoiceDisputeRepository.save({
      id: generateId("dis"),
      invoiceId,
      tenantId,
      status: "open",
      severity: severity ?? "medium",
      reasonCode: reasonCode ?? "usage_dispute",
      title,
      detail: detail ?? "",
      openedBy: (req.headers["x-actor-id"] as string) ?? "system",
      assignedRole: assignedRole ?? "operations",
    });
    return res.status(httpStatus.CREATED).json(dispute);
  },

  async resolve(req: Request, res: Response) {
    const { disputeId } = req.params;
    const { status, resolutionNote } = req.body;
    const dispute = await billingInvoiceDisputeRepository.findById(disputeId);
    if (!dispute) return res.status(httpStatus.NOT_FOUND).json({ message: "Dispute not found" });

    await billingInvoiceDisputeRepository.update(disputeId, {
      status: status ?? "resolved",
      resolutionNote: resolutionNote ?? null,
      updatedAt: new Date(),
    });

    return res.status(httpStatus.OK).json({ ...dispute, status: status ?? "resolved", resolutionNote });
  },
};
