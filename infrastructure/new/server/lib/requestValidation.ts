/**
 * D2: Express middleware for input validation on all API routes.
 * Uses Zod schemas for type-safe request validation with structured error responses.
 * G6: Structured error responses with error codes.
 */

import { z, type ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

// G6: Structured error response format
export interface APIError {
  error: string;
  code: string;
  details?: Array<{ field: string; message: string }>;
  requestId?: string;
  timestamp: string;
}

export function formatError(
  message: string,
  code: string,
  details?: Array<{ field: string; message: string }>,
  requestId?: string,
): APIError {
  return {
    error: message,
    code,
    details,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

// D2: Validation middleware factory
export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string }> = [];

    try {
      if (schema.body) schema.body.parse(req.body);
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(
          ...e.issues.map((issue: z.ZodIssue) => ({
            field: `body.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      }
    }

    try {
      if (schema.query) schema.query.parse(req.query);
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(
          ...e.issues.map((issue: z.ZodIssue) => ({
            field: `query.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      }
    }

    try {
      if (schema.params) schema.params.parse(req.params);
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(
          ...e.issues.map((issue: z.ZodIssue) => ({
            field: `params.${issue.path.join(".")}`,
            message: issue.message,
          })),
        );
      }
    }

    if (errors.length > 0) {
      const requestId = (req.headers["x-correlation-id"] as string) || "";
      res.status(400).json(formatError("Validation failed", "VALIDATION_ERROR", errors, requestId));
      return;
    }
    next();
  };
}

// Common validation schemas for banking operations
export const schemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).default("desc").optional(),
  }),

  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  bvn: z.string().regex(/^\d{11}$/, "BVN must be exactly 11 digits"),
  currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
  amount: z.number().positive("Amount must be positive"),

  transfer: z.object({
    sourceAccountNumber: z.string().regex(/^\d{10}$/),
    destinationAccountNumber: z.string().regex(/^\d{10}$/),
    amount: z.number().positive().max(100_000_000, "Maximum transfer amount is ₦100M"),
    currency: z.enum(["NGN", "USD", "GBP", "EUR"]).default("NGN"),
    narration: z.string().min(1).max(200),
    channel: z.enum(["nip", "neft", "rtgs", "internal", "ussd", "mobile", "internet_banking"]).optional(),
  }),

  customerCreate: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\+234\d{10}$/, "Phone must be Nigerian format +234XXXXXXXXXX"),
    bvn: z.string().regex(/^\d{11}$/).optional(),
    segment: z.enum(["Retail", "Corporate", "Trade", "Agriculture", "Public sector"]).optional(),
    tier: z.enum(["Tier 1", "Tier 2", "Tier 3"]).optional(),
  }),

  loanApplication: z.object({
    customerId: z.string().min(1),
    productType: z.enum(["personal_loan", "mortgage", "auto_loan", "education", "agriculture", "sme"]),
    amount: z.number().positive().max(500_000_000),
    tenorMonths: z.number().int().min(1).max(360),
    purpose: z.string().min(5).max(500),
  }),

  cardAction: z.object({
    cardId: z.string().min(1),
    reason: z.string().min(3).max(200).optional(),
  }),
};
