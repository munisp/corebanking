/**
 * DB-First Middleware — intercepts all /api/platform/* routes and serves data from Postgres.
 * Falls back to in-memory seed data if DB is unavailable or table is empty.
 *
 * Strategy:
 *   1. Map the incoming route path to the corresponding Drizzle table
 *   2. Query Postgres via the generic repository
 *   3. If DB returns data, send it; otherwise pass to next() for seed fallback
 */

import { getDb } from "../db";
import { sql, count } from "drizzle-orm";
import { logger } from "./logger";
import * as schema from "../../drizzle/schema";

// Build a mapping from URL path segments to schema tables
// e.g. "/api/platform/escrow/accounts" => schema.escrowAccounts
const tableMapping: Record<string, any> = {};

// Dynamically build mapping from all exported pgTables
for (const [key, value] of Object.entries(schema)) {
  if (value && typeof value === "object" && (value as any)[Symbol.for("drizzle:Name")]) {
    // Convert camelCase to kebab URL segments
    const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    tableMapping[key] = value;
    tableMapping[kebab] = value;
    // Also map the SQL table name
    const sqlName = (value as any)[Symbol.for("drizzle:Name")];
    if (sqlName) tableMapping[sqlName] = value;
  }
}

// Route-to-table overrides for platform routes that don't match naming conventions
const routeOverrides: Record<string, keyof typeof schema> = {
  "escrow/accounts": "escrowAccounts",
  "escrow/parties": "escrowParties",
  "escrow/transactions": "escrowTransactions",
  "escrow/milestones": "escrowMilestones",
  "escrow/disputes": "escrowDisputes",
  "escrow/documents": "escrowDocuments",
  "escrow/fees": "escrowFees",
  "escrow/interest": "escrowInterestAccruals",
  "escrow/regulatory": "escrowRegulatoryReports",
  "escrow/audit": "escrowAuditLog",
  "core-banking/customers": "customers",
  "core-banking/accounts": "accounts",
  "core-banking/transactions": "transactions",
  "core-banking/loans": "loans",
  "core-banking/transfers": "transfers",
  "payments/nip": "nipTransactions",
  "payments/swift": "swiftMessages",
  "payments/settlements": "settlements",
  "cards/transactions": "cardTransactions",
  "treasury/fx-deals": "fxTrades",
  "treasury/nostro": "nostroAccounts",
  "accounting/gl-accounts": "glAccounts",
  "accounting/journal-entries": "journalEntries",
  "accounting/trial-balances": "trialBalances",
  "risk-compliance/aml-alerts": "amlAlerts",
  "risk-compliance/kyc-verifications": "kycVerifications",
  "kyc-kyb/identity-profiles": "identityProfiles",
  "agriculture-banking/farmers": "farmers",
  "agriculture-banking/agri-loans": "agriLoans",
  "agriculture-banking/crop-insurance": "cropInsurancePolicies",
  "agriculture-banking/value-chain": "valueChainContracts",
  "billing/accounts": "billingAccounts",
  "billing/invoices": "billingInvoices",
  "billing/usage-events": "billingUsageEvents",
  "agent-banking/agents": "agentBankingAgents",
  "lending/groups": "lendingGroups",
  "lending/mortgage-applications": "mortgageApplications",
  "lending/education-loans": "educationLoans",
  "workflows/cases": "workflowCases",
  "teller/sessions": "tellerSessions",
  "teller/transactions": "tellerTransactions",
  "teller/vault-operations": "vaultOperations",
  "islamic/murabaha": "murabahaContracts",
  "islamic/ijara": "ijaraContracts",
  "islamic/mudarabah": "mudarabahContracts",
  "trade/letters-of-credit": "lettersOfCredit",
  "trade/warehouse-receipts": "warehouseReceipts",
  "trade/bank-guarantees": "bankGuarantees",
  "dispute/cases": "disputeCases",
  "reconciliation/runs": "reconciliationRuns",
  "regulatory/reports": "regulatoryReports",
  "erpnext/sync-jobs": "erpnextSyncJobs",
  "tenants": "tenants",
};

function resolveTable(pathSegments: string): any {
  // Try explicit override first
  if (routeOverrides[pathSegments]) {
    return (schema as any)[routeOverrides[pathSegments]];
  }

  // Convert path to camelCase and look up
  const camel = pathSegments
    .split("/")
    .pop()!
    .replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());

  return (schema as any)[camel] || null;
}

export function createDbFirstMiddleware() {
  return async (req: any, res: any, next: any) => {
    // Only intercept GET requests to /api/platform/*
    if (req.method !== "GET" || !req.path.startsWith("/api/platform/")) {
      return next();
    }

    const db = await getDb();
    if (!db) {
      return next(); // No DB, fall through to seed data
    }

    // Extract the path after /api/platform/
    const subPath = req.path.replace("/api/platform/", "").replace(/\/$/, "");

    // Try to resolve to a schema table
    const table = resolveTable(subPath);
    if (!table) {
      return next(); // No matching table, fall through
    }

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = (page - 1) * limit;

      const [items, totalResult] = await Promise.all([
        db.select().from(table).limit(limit).offset(offset),
        db.select({ count: count() }).from(table),
      ]);

      const total = totalResult[0]?.count ?? 0;

      if (total === 0) {
        return next(); // Empty table, fall through to seed data
      }

      res.json({
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        source: "postgres",
      });
    } catch (error) {
      logger.warn(`[dbFirst] Query failed for ${subPath}, falling back to seed`, { error: String(error) });
      return next(); // Query error, fall through
    }
  };
}
