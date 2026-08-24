import { describe, it, expect } from "vitest";

// H-40 remediation: the previous version asserted properties of string arrays
// declared in the test itself ("ACCOUNT_TYPES contains the three strings I
// just wrote") — it verified nothing about the actual database schema. These
// tests import the real Drizzle schema and assert that the money-, identity-
// and compliance-critical tables the platform depends on actually exist with
// the expected columns.
import * as schema from "../../drizzle/schema";

const CORE_TABLES = [
  "users", "tenants", "customers",
  "customerTransfers", "customerBillPayments", "customerCards",
  "auditEntries", "operatorActions", "workflowCases",
  "billingAccounts", "billingInvoices", "billingUsageEvents",
  "kycEnforcementVerifications", "livenessChecks",
];

describe("Database Schema (production drizzle/schema)", () => {
  it("all core money/identity tables exist in the schema", () => {
    for (const table of CORE_TABLES) {
      expect(
        (schema as Record<string, unknown>)[table],
        `drizzle schema is missing table export '${table}'`,
      ).toBeDefined();
    }
  });

  it("customerTransfers carries amount, status and beneficiary columns", () => {
    const t = (schema as any).customerTransfers;
    expect(t.amount).toBeDefined();
    expect(t.status).toBeDefined();
    expect(t.transferType).toBeDefined();
    expect(t.beneficiaryName).toBeDefined();
    expect(t.customerId).toBeDefined();
    // Transfer IDs must be unique — replay/duplicate protection at the DB level.
    expect(t.transferId).toBeDefined();
  });

  it("auditEntries is a complete compliance log (actor, action, outcome, severity)", () => {
    const t = (schema as any).auditEntries;
    for (const col of ["actorRole", "actorId", "entityType", "entityId", "action", "outcome", "severity", "timestampAt"]) {
      expect(t[col], `auditEntries missing column '${col}'`).toBeDefined();
    }
  });

  it("billingUsageEvents carries tenant, meter and quantity columns", () => {
    const t = (schema as any).billingUsageEvents;
    expect(t.tenantId).toBeDefined();
    expect(t.meterKey).toBeDefined();
    expect(t.quantity).toBeDefined();
  });
});
