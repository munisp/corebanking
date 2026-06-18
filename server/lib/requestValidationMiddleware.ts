// H5: Wire Zod validation schemas as Express middleware on all routes
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

// Common validation schemas for all API endpoints
const commonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});

const commonIdParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

// Validate query parameters on all GET /api/platform/* list endpoints
export function validateQueryMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" || !req.path.startsWith("/api/platform/")) return next();

  const parsed = commonQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_query_params",
      details: parsed.error.issues.map(i => ({ field: i.path.join("."), message: i.message })),
    });
  }
  next();
}

// Validate POST/PUT body is not empty
export function validateBodyNotEmpty(req: Request, res: Response, next: NextFunction) {
  if ((req.method === "POST" || req.method === "PUT") && req.path.startsWith("/api/platform/")) {
    if (!req.body || (typeof req.body === "object" && Object.keys(req.body).length === 0)) {
      // Allow empty body for action endpoints
      if (req.path.includes("/reset") || req.path.includes("/advance") || req.path.includes("/generate")) return next();
      return res.status(400).json({ error: "empty_body", message: "Request body is required" });
    }
  }
  next();
}

// H6: Service discovery helper (replaces hardcoded ports)
export const SERVICE_PORTS: Record<string, number> = {
  "billing-rating": 8086, "billing-analytics": 8087, "account-opening": 8088,
  "billing-ingestor": 8089, "agriculture-banking": 8090, "teller-operations": 8091,
  "islamic-banking": 8092, "trade-finance": 8093, "interest-rate-engine": 8131,
  "cheque-clearing": 8132, "customer-360": 8133, "nibss-direct-debit": 8134,
  "diaspora-banking": 8135, "kyc-aml": 8136, "loan-origination": 8137,
  "account-statement": 8138, "bulk-payments": 8139, "card-management": 8140,
  "savings-products": 8141, "treasury-liquidity": 8142, "agent-banking": 8143,
  "sms-email-gateway": 8144, "risk-scoring": 8145, "regulatory-reporting": 8146,
  "atm-management": 8147, "data-export": 8148, "customer-insights": 8149,
  "salary-processing": 8150, "credit-bureau": 8151, "document-management": 8152,
  "pos-terminal": 8153, "collateral-valuation": 8154, "customer-feedback": 8155,
  "money-market": 8156, "securities-trading": 8157, "supply-chain": 8158,
  "escrow": 8186, "qr-payments": 8187, "chatbot": 8179, "insurance": 8194,
};

export function resolveServicePort(serviceName: string): number {
  const envKey = serviceName.toUpperCase().replace(/-/g, "_") + "_PORT";
  const envPort = process.env[envKey];
  if (envPort) return parseInt(envPort, 10);
  return SERVICE_PORTS[serviceName] || 8080;
}
