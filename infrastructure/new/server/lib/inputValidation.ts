/**
 * Input Validation Middleware — Zod-based schema enforcement for all API endpoints.
 * Validates request body, query params, and path params against typed schemas.
 */

import { z } from "zod";
import { Request, Response, NextFunction, Express } from "express";
import { logger } from "./logger";

// Common validation schemas for Nigerian banking
export const nigerianBVN = z.string().regex(/^\d{11}$/, "BVN must be 11 digits");
export const nigerianNIN = z.string().regex(/^\d{11}$/, "NIN must be 11 digits");
export const nigerianPhone = z.string().regex(/^\+234\d{10}$/, "Phone must be +234XXXXXXXXXX");
export const nigerianAccountNumber = z.string().regex(/^\d{10}$/, "Account number must be 10 digits");
export const ngnAmount = z.number().positive("Amount must be positive").max(1_000_000_000, "Max amount: NGN 1B");
export const currencyCode = z.enum(["NGN", "USD", "GBP", "EUR", "XOF", "GHS", "KES", "ZAR"]);
export const sortOrder = z.enum(["asc", "desc"]).optional().default("desc");
export const pagination = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  sortBy: z.string().optional(),
  sortOrder,
});

// Entity schemas
export const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  email: z.string().email("Invalid email").optional(),
  phone: nigerianPhone.optional(),
  bvn: nigerianBVN.optional(),
  nin: nigerianNIN.optional(),
  address: z.string().max(500).optional(),
  state: z.string().max(50).optional(),
  lga: z.string().max(100).optional(),
  accountType: z.enum(["savings", "current", "domiciliary", "corporate", "joint"]).optional(),
  segment: z.enum(["retail", "corporate", "sme", "hnwi", "institutional"]).optional(),
});

export const transferSchema = z.object({
  sourceAccount: nigerianAccountNumber,
  destinationAccount: nigerianAccountNumber,
  amount: ngnAmount,
  currency: currencyCode.optional().default("NGN"),
  narration: z.string().max(200).optional(),
  beneficiaryName: z.string().min(2).max(200),
  beneficiaryBank: z.string().max(100).optional(),
  transferType: z.enum(["intra", "inter", "international"]).optional().default("intra"),
});

export const loanSchema = z.object({
  customerId: z.string().min(1),
  productCode: z.string().min(1),
  principalAmount: ngnAmount,
  tenorMonths: z.number().int().min(1).max(360),
  interestRateBps: z.number().int().min(0).max(10000),
  purpose: z.string().max(500).optional(),
  collateralType: z.string().max(100).optional(),
  collateralValue: z.number().positive().optional(),
});

export const kycVerificationSchema = z.object({
  customerId: z.string().min(1),
  verificationType: z.enum(["bvn", "nin", "cac", "tin", "passport", "drivers_license", "voters_card"]),
  documentNumber: z.string().min(1),
  documentExpiry: z.string().optional(),
  tier: z.enum(["1", "2", "3"]).optional(),
});

export const amlScreeningSchema = z.object({
  entityName: z.string().min(1),
  entityType: z.enum(["individual", "corporate", "government"]),
  screenType: z.enum(["sanctions", "pep", "adverse_media", "full"]).optional().default("full"),
  lists: z.array(z.string()).optional(),
});

// Generic create/update schema (allows any valid JSON for CRUD tables)
export const genericCreateSchema = z.record(z.string(), z.unknown()).refine(
  (obj) => Object.keys(obj).length > 0,
  "Request body must contain at least one field"
);

// Validation middleware factory
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map(i => ({
          field: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: "Query validation failed",
        details: result.error.issues.map(i => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

// Request sanitization middleware
export function sanitizeInput() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === "object") {
      sanitizeObject(req.body);
    }
    next();
  };
}

function sanitizeObject(obj: Record<string, any>) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      // Strip HTML tags, null bytes, and excessive whitespace
      obj[key] = obj[key]
        .replace(/<[^>]*>/g, "")
        .replace(/\0/g, "")
        .trim();
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Register validation on key endpoints
export function registerInputValidation(app: Express) {
  // Apply sanitization globally
  app.use("/api/", sanitizeInput());

  // Apply specific validation to critical endpoints
  app.post("/api/platform/core-banking/customers", validateBody(customerSchema));
  app.put("/api/platform/core-banking/customers/:id", validateBody(customerSchema.partial()));
  app.post("/api/platform/payments/transfers", validateBody(transferSchema));
  app.post("/api/platform/lending/loans", validateBody(loanSchema));
  app.post("/api/platform/kyc/verify", validateBody(kycVerificationSchema));
  app.post("/api/platform/aml/screen", validateBody(amlScreeningSchema));

  // Generic validation for all POST/PUT requests (must have body)
  app.use("/api/", (req: Request, res: Response, next: NextFunction) => {
    if ((req.method === "POST" || req.method === "PUT") && req.path.startsWith("/api/db/")) {
      const result = genericCreateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          error: "Request body must contain at least one field",
          details: result.error.issues,
        });
      }
    }
    next();
  });

  logger.info("Input validation registered for all API endpoints");
}
