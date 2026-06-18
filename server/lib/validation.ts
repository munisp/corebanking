import type { RequestHandler } from "express";
import { z } from "zod";

import { AppError } from "./errorHandler";

export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      next(new AppError(`Validation failed: ${details}`, 400, "VALIDATION_ERROR"));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      next(new AppError(`Query validation failed: ${details}`, 400, "VALIDATION_ERROR"));
      return;
    }
    (req as any).query = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      next(new AppError(`Parameter validation failed: ${details}`, 400, "VALIDATION_ERROR"));
      return;
    }
    (req as any).params = result.data;
    next();
  };
}

// Common schemas for the platform API
export const customerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  segment: z.string().min(1),
  tier: z.string().min(1),
  location: z.string().min(1),
  relationshipManager: z.string().min(1),
  risk: z.string().min(1),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be 11 digits"),
  phone: z.string().min(10).max(15),
  balance: z.number().min(0).optional().default(0),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const transferCreateSchema = z.object({
  customerId: z.string().min(1),
  beneficiaryName: z.string().min(1).max(200),
  amount: z.number().positive("Amount must be positive"),
  narration: z.string().max(200).optional(),
  transferType: z.enum(["bank", "wallet", "workflow"]),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  workflowId: z.string().optional(),
});

export const billingUsageEventSchema = z.object({
  tenantId: z.string().min(1),
  billingAccountId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  sourceService: z.string().min(1),
  sourceEventType: z.string().min(1),
  meterKey: z.string().min(1),
  productKey: z.string().min(1),
  quantity: z.number().int().positive(),
  currency: z.string().length(3).optional().default("NGN"),
  eventTimestamp: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const billingRateCardCreateSchema = z.object({
  billingAccountId: z.string().optional(),
  name: z.string().min(1).max(200),
  pricingCurrency: z.string().length(3).optional().default("NGN"),
  effectiveFrom: z.string().datetime().optional(),
  lines: z.array(z.object({
    meterKey: z.string().min(1),
    productKey: z.string().min(1),
    chargeType: z.enum(["flat", "per_unit", "tiered", "minimum", "percentage"]),
    unitPrice: z.number().min(0),
    includedUnits: z.number().int().min(0).optional().default(0),
    tierStart: z.number().int().min(0).optional(),
    tierEnd: z.number().int().min(0).optional(),
    minimumCharge: z.number().min(0).optional(),
    percentageBasisPoints: z.number().int().min(0).optional(),
  })).optional().default([]),
});

export const partnerOnboardingCreateSchema = z.object({
  partnerName: z.string().min(1).max(200),
  legalEntity: z.string().min(1).max(200),
  region: z.string().min(1),
  requestedModules: z.array(z.string()).min(1),
  branding: z.object({
    displayName: z.string().min(1),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    logoUrl: z.string().url().optional(),
    customDomain: z.string().optional(),
  }).optional(),
});

export const idParamSchema = z.object({
  customerId: z.string().min(1),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
