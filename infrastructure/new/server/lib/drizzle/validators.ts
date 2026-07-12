/**
 * Zod Validators Derived from Drizzle Schema
 *
 * Uses drizzle-zod to auto-generate Zod schemas from Drizzle table definitions.
 * This ensures API input validation is always in sync with the database schema.
 *
 * Usage:
 *   import { insertCustomerSchema, selectCustomerSchema } from './validators';
 *   const parsed = insertCustomerSchema.parse(req.body);
 *
 * Note: drizzle-zod is a peer dependency. Install with:
 *   pnpm add drizzle-zod zod
 */
import { z } from "zod";

// ── Manual Zod Schemas (until drizzle-zod is installed) ───────────────────────
// These are hand-crafted to match the Drizzle schema exactly.
// Once `drizzle-zod` is available, replace with createInsertSchema(table).

// ── Common Field Validators ───────────────────────────────────────────────────

export const tenantIdSchema = z
  .string()
  .min(1, "tenantId is required")
  .max(64, "tenantId must be ≤ 64 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "tenantId must be alphanumeric with dashes/underscores");

export const uuidSchema = z
  .string()
  .uuid("Must be a valid UUID");

export const currencySchema = z
  .string()
  .length(3, "Currency must be a 3-letter ISO 4217 code")
  .toUpperCase();

export const amountSchema = z
  .number()
  .positive("Amount must be positive")
  .finite("Amount must be finite")
  .multipleOf(0.01, "Amount must have at most 2 decimal places");

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{6,14}$/, "Must be a valid international phone number");

export const emailSchema = z
  .string()
  .email("Must be a valid email address")
  .max(320, "Email must be ≤ 320 characters");

export const isoDateSchema = z
  .string()
  .datetime({ offset: true, message: "Must be a valid ISO 8601 datetime" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

// ── Customer Validators ───────────────────────────────────────────────────────

export const insertCustomerSchema = z.object({
  customerId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  name: z.string().min(1).max(191),
  segment: z.string().min(1).max(96),
  tier: z.string().min(1).max(64),
  location: z.string().min(1).max(128),
  relationshipManager: z.string().min(1).max(128),
  risk: z.enum(["low", "medium", "high", "critical"]),
});

export const updateCustomerSchema = insertCustomerSchema.partial().omit({
  customerId: true,
  tenantId: true,
});

// ── Account Validators ────────────────────────────────────────────────────────

export const insertAccountSchema = z.object({
  accountId: z.string().min(1).max(64),
  customerId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  accountName: z.string().min(1).max(191),
  accountType: z.enum(["savings", "current", "domiciliary", "corporate", "joint", "fixed_deposit"]),
  currency: currencySchema,
  balance: amountSchema.default(0),
});

export const updateAccountSchema = insertAccountSchema.partial().omit({
  accountId: true,
  tenantId: true,
});

// ── Transaction Validators ────────────────────────────────────────────────────

export const insertTransactionSchema = z.object({
  transactionId: z.string().min(1).max(64),
  accountId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  type: z.enum(["credit", "debit", "reversal", "fee", "interest"]),
  amount: amountSchema,
  currency: currencySchema,
  narration: z.string().max(512).optional(),
  reference: z.string().max(128).optional(),
  channel: z.string().max(64).optional(),
});

// ── Loan Validators ───────────────────────────────────────────────────────────

export const insertLoanSchema = z.object({
  loanId: z.string().min(1).max(64),
  customerId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  loanType: z.enum(["personal", "mortgage", "auto", "business", "education", "agri", "microfinance"]),
  principalAmount: amountSchema,
  interestRate: z.number().min(0).max(100),
  tenorMonths: z.number().int().positive(),
  currency: currencySchema,
});

// ── Billing Validators ────────────────────────────────────────────────────────

export const insertBillingUsageEventSchema = z.object({
  usageEventId: z.string().min(1).max(64),
  idempotencyKey: z.string().min(1).max(128),
  tenantId: tenantIdSchema,
  billingAccountId: z.string().min(1).max(64),
  meterKey: z.string().min(1).max(96),
  quantity: z.number().positive(),
  occurredAt: isoDateSchema,
  metadata: z.record(z.unknown()).optional(),
});

// ── KYC Validators ────────────────────────────────────────────────────────────

export const insertKycVerificationSchema = z.object({
  verificationId: z.string().min(1).max(64),
  customerId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  verificationType: z.enum(["bvn", "nin", "passport", "drivers_license", "utility_bill", "bank_statement"]),
  documentReference: z.string().max(128).optional(),
  provider: z.string().max(64).optional(),
});

// ── Escrow Validators ─────────────────────────────────────────────────────────

export const insertEscrowAccountSchema = z.object({
  escrowId: z.string().min(1).max(64),
  tenantId: tenantIdSchema,
  escrowType: z.enum(["property", "trade", "milestone", "general"]),
  amount: amountSchema,
  currency: currencySchema,
  condition: z.string().max(512),
});

// ── Middleware Event Validators ───────────────────────────────────────────────

export const insertDaprEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  tenantId: tenantIdSchema.optional(),
  pubsubName: z.string().min(1).max(128),
  topic: z.string().min(1).max(256),
  payload: z.record(z.unknown()),
  correlationId: z.string().max(128).optional(),
});

export const insertTemporalWorkflowSchema = z.object({
  workflowId: z.string().min(1).max(256),
  tenantId: tenantIdSchema.optional(),
  workflowType: z.string().min(1).max(128),
  taskQueue: z.string().min(1).max(128),
  input: z.record(z.unknown()).optional(),
});

export const insertFluvioEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  tenantId: tenantIdSchema.optional(),
  topic: z.string().min(1).max(256),
  partition: z.number().int().min(0).default(0),
  payload: z.record(z.unknown()),
  key: z.string().max(256).optional(),
});

// ── Validation Helper ─────────────────────────────────────────────────────────

/**
 * Validates request body against a Zod schema.
 * Returns { success, data, errors } for clean error handling.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Returns 422 Unprocessable Entity on validation failure.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates req.query against a Zod schema.
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(422).json({
        error: "Query validation failed",
        details: result.error.flatten(),
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}
