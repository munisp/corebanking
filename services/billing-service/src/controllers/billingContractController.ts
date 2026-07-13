import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingContractOverrideRepository } from "../repositories/billingContractOverrideRepository";
import { billingDiscountRuleRepository } from "../repositories/billingDiscountRuleRepository";
import { billingRevenueShareRuleRepository } from "../repositories/billingRevenueShareRuleRepository";
import { billingAccrualSnapshotRepository } from "../repositories/billingAccrualSnapshotRepository";
import { generateId, currentPeriodKey } from "../utils/id";

export const billingContractController = {
  async listOverrides(_req: Request, res: Response) {
    const items = await billingContractOverrideRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async createOverride(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const item = await billingContractOverrideRepository.save({
      id: generateId("co"),
      billingAccountId: req.body.billingAccountId,
      tenantId,
      overrideType: req.body.overrideType,
      meterKey: req.body.meterKey ?? null,
      productKey: req.body.productKey ?? null,
      valueNumber: req.body.valueNumber ?? null,
      valueText: req.body.valueText ?? null,
      effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(),
      effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
      status: req.body.status ?? "draft",
      createdBy: (req.headers["x-actor-id"] as string) ?? "system",
      notes: req.body.notes ?? null,
    });
    return res.status(httpStatus.CREATED).json(item);
  },

  async listDiscounts(_req: Request, res: Response) {
    const items = await billingDiscountRuleRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async createDiscount(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const item = await billingDiscountRuleRepository.save({
      id: generateId("dr"),
      billingAccountId: req.body.billingAccountId,
      tenantId,
      name: req.body.name,
      discountType: req.body.discountType ?? "percentage",
      meterKey: req.body.meterKey ?? null,
      productKey: req.body.productKey ?? null,
      percentage: req.body.percentage ?? null,
      fixedAmount: req.body.fixedAmount ?? null,
      thresholdAmount: req.body.thresholdAmount ?? null,
      effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(),
      effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
      status: req.body.status ?? "draft",
      createdBy: (req.headers["x-actor-id"] as string) ?? "system",
    });
    return res.status(httpStatus.CREATED).json(item);
  },

  async listRevenueShare(_req: Request, res: Response) {
    const items = await billingRevenueShareRuleRepository.findAll();
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async createRevenueShare(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const item = await billingRevenueShareRuleRepository.save({
      id: generateId("rs"),
      billingAccountId: req.body.billingAccountId,
      tenantId,
      name: req.body.name,
      target: req.body.target ?? "platform",
      percentage: req.body.percentage ?? 0,
      beneficiaryName: req.body.beneficiaryName,
      settlementLedgerCode: req.body.settlementLedgerCode ?? null,
      effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(),
      effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : null,
      status: req.body.status ?? "draft",
      createdBy: (req.headers["x-actor-id"] as string) ?? "system",
    });
    return res.status(httpStatus.CREATED).json(item);
  },

  async listAccruals(_req: Request, res: Response) {
    const items = await billingAccrualSnapshotRepository.findAll(100);
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },
};
