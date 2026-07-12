import { Request, Response } from "express";
import httpStatus from "http-status";
import { billingUsageEventRepository } from "../repositories/billingUsageEventRepository";
import { billingAccountRepository } from "../repositories/billingAccountRepository";
import { billingRatingService } from "../services/billingRatingService";
import { generateId } from "../utils/id";

export const billingUsageEventController = {
  async list(req: Request, res: Response) {
    const items = await billingUsageEventRepository.findAll(100);
    return res.status(httpStatus.OK).json({ asOf: new Date().toISOString(), items, total: items.length });
  },

  async create(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const { idempotencyKey, sourceService, sourceEventType, meterKey, productKey, quantity, unitAmount, currency, eventTimestamp, correlationId, resourceId, payload } = req.body;

    const key = idempotencyKey ?? generateId("ik");
    const existing = tenantId ? await billingUsageEventRepository.findByIdempotencyKey(tenantId, key) : null;
    if (existing) return res.status(httpStatus.OK).json(existing);

    const event = await billingUsageEventRepository.save({
      id: generateId("ue"),
      idempotencyKey: key,
      tenantId,
      billingAccountId: req.body.billingAccountId ?? null,
      sourceService,
      sourceEventType,
      meterKey,
      productKey,
      quantity: quantity ?? 1,
      unitAmount: unitAmount ?? null,
      currency: currency ?? "NGN",
      eventTimestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
      correlationId: correlationId ?? null,
      actorId: (req.headers["x-actor-id"] as string) ?? null,
      resourceId: resourceId ?? null,
      payload: payload ?? {},
      status: "pending",
    });

    billingRatingService.rateEvent(event).catch(() => undefined);

    return res.status(httpStatus.CREATED).json(event);
  },

  async ingest(req: Request, res: Response) {
    const tenantId = (req.headers["x-tenant-id"] as string) || req.body.tenantId;
    const { billingAccountId, sourceService, sourceEventType, meterKey, productKey, quantity, currency, actorId, resourceId, correlationId, bridge, payload } = req.body;

    const key = generateId("ik");
    const event = await billingUsageEventRepository.save({
      id: generateId("ue"),
      idempotencyKey: key,
      tenantId,
      billingAccountId: billingAccountId ?? null,
      sourceService,
      sourceEventType,
      meterKey,
      productKey,
      quantity: quantity ?? 1,
      unitAmount: null,
      currency: currency ?? "NGN",
      eventTimestamp: new Date(),
      correlationId: correlationId ?? null,
      actorId: actorId ?? null,
      resourceId: resourceId ?? null,
      payload: { ...payload, bridge: bridge ?? "direct" },
      status: "pending",
    });

    billingRatingService.rateEvent(event).catch(() => undefined);

    return res.status(httpStatus.CREATED).json(event);
  },
};
