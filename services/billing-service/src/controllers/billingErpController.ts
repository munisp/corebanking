import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingErpPostingRepository } from "../repositories/billingErpPostingRepository";

export const billingErpController = {
  async list(_req: Request, res: Response) {
    const items = await billingErpPostingRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async resolve(req: Request, res: Response) {
    const { attemptId } = req.params;
    const { status, errorMessage } = req.body;
    const posting = await billingErpPostingRepository.findById(attemptId);
    if (!posting) return res.status(httpStatus.NOT_FOUND).json({ message: "ERP posting not found" });

    await billingErpPostingRepository.update(attemptId, {
      status: status ?? "posted",
      postedAt: status === "posted" ? new Date() : null,
      errorMessage: errorMessage ?? null,
    });

    return res.status(httpStatus.OK).json({ ...posting, status: status ?? "posted" });
  },
};
