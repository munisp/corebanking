/**
 * Multi-Tenancy Helpers for Drizzle ORM
 *
 * Provides tenant-scoped query utilities, Row-Level Security (RLS) enforcement,
 * and tenant context propagation for the 54Bank platform.
 *
 * Design:
 *   - Every query that touches tenant-scoped data MUST go through withTenant()
 *   - RLS is enforced at the application layer (Drizzle WHERE clause injection)
 *   - PostgreSQL SET LOCAL app.current_tenant is used for DB-level RLS policies
 */
import { sql, eq, and, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { logger } from "../logger";

// ── Tenant Context ────────────────────────────────────────────────────────────

export interface TenantContext {
  tenantId: string;
  tenantName?: string;
  region?: string;
  segment?: string;
}

/**
 * Executes a database operation within a tenant-scoped transaction.
 * Sets PostgreSQL session variable `app.current_tenant` so that any
 * DB-level RLS policies can also enforce tenant isolation.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (db: NonNullable<Awaited<ReturnType<typeof getDb>>>) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return (db as any).transaction(async (tx: any) => {
    // Set PostgreSQL session variable for DB-level RLS policies
    await tx.execute(
      sql`SELECT set_config('app.current_tenant', ${ctx.tenantId}, true)`
    );
    logger.debug(`[MultiTenancy] Tenant context set: ${ctx.tenantId}`);
    return fn(tx);
  });
}

/**
 * Builds a tenant-scoped WHERE clause for any table with a tenantId column.
 * Optionally adds additional conditions.
 */
export function tenantWhere(
  tenantColumn: PgColumn,
  tenantId: string,
  additionalConditions?: SQL
): SQL {
  const tenantCondition = eq(tenantColumn, tenantId);
  return additionalConditions
    ? and(tenantCondition, additionalConditions)!
    : tenantCondition;
}

/**
 * Validates that a tenantId is present and non-empty.
 * Throws if the tenant context is missing (prevents data leakage).
 */
export function assertTenantContext(tenantId: unknown): asserts tenantId is string {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error(
      "TENANT_CONTEXT_MISSING: All data operations require a valid tenantId"
    );
  }
}

/**
 * Extracts tenantId from Express request headers.
 * Supports multiple header conventions used across the platform.
 */
export function extractTenantId(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const candidates = [
    headers["x-tenant-id"],
    headers["x-tenant-name"],
    headers["x-keycloak-realm"],
  ];

  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    if (value && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

// ── PostgreSQL RLS Policy Generator ──────────────────────────────────────────

/**
 * Generates the SQL to enable Row-Level Security on a table and create
 * a tenant isolation policy. Run this in a migration for production hardening.
 *
 * Example output:
 *   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY tenant_isolation ON customers
 *     USING (tenantId = current_setting('app.current_tenant', true));
 */
export function generateRlsPolicy(tableName: string, tenantColumn = "tenantId"): string {
  return `
-- Enable RLS on ${tableName}
ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "${tableName}" FORCE ROW LEVEL SECURITY;

-- Tenant isolation policy
DROP POLICY IF EXISTS tenant_isolation ON "${tableName}";
CREATE POLICY tenant_isolation ON "${tableName}"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING ("${tenantColumn}" = current_setting('app.current_tenant', true));

-- Service role bypass (for migrations and admin operations)
DROP POLICY IF EXISTS service_role_bypass ON "${tableName}";
CREATE POLICY service_role_bypass ON "${tableName}"
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true);
`.trim();
}

/**
 * List of all tenant-scoped tables that should have RLS enabled.
 * Used by the migration generator.
 */
export const TENANT_SCOPED_TABLES = [
  "customers",
  "accounts",
  "transactions",
  "loans",
  "loanRepayments",
  "kycVerifications",
  "amlAlerts",
  "billingAccounts",
  "billingUsageEvents",
  "billingInvoices",
  "escrowAccounts",
  "customerCards",
  "customerTransfers",
  "customerNotifications",
  "auditEntries",
  "daprPublishedEvents",
  "temporalWorkflowExecutions",
  "fluvioEventLog",
  "fluvioEventOutbox",
] as const;

/**
 * Generates a complete RLS migration SQL file for all tenant-scoped tables.
 */
export function generateRlsMigration(): string {
  const policies = TENANT_SCOPED_TABLES.map((t) => generateRlsPolicy(t)).join(
    "\n\n"
  );
  return `-- Auto-generated RLS migration for 54Bank platform
-- Run this migration to enforce tenant isolation at the PostgreSQL level.
-- Requires: SET app.current_tenant = '<tenantId>' before each query session.

${policies}
`;
}
