-- =============================================================================
-- Migration 005: W11 Performance Indexes — Drizzle platform schema
-- =============================================================================
-- Wave-11 remediation (findings DI-04, DI-05, DI-07; auditor:
-- work/w11/findings/data-integration.md section A).
--
-- CONVENTION NOTES:
--   * Applied by infrastructure/new/scripts/migrate.sh via `psql -f` per file
--     (autocommit; the runner does NOT wrap files in a transaction).
--   * CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so this
--     file intentionally contains NO BEGIN/COMMIT. Each statement is its own
--     implicit transaction. Mirrors the existing drizzle/indexes.sql pattern.
--   * All statements are idempotent (IF NOT EXISTS) and safe to re-run.
--   * Identifiers below are camelCase + double-quoted because the drizzle
--     tables are camelCase (0007/003 DDL) — do NOT "correct" them to
--     snake_case; that drift is what broke drizzle/indexes.sql (see header
--     annotation there).
--
-- Every index was grep-verified against the DDL and the query that needs it;
-- the comment above each cites the query site and the DDL evidence.
-- =============================================================================

-- W11 perf (DI-04): supports services/gl-engine-go/main.go:562-563
--   (period close: WHERE je."tenantId" = $1 AND je."postingDate" <= $3
--    GROUP BY je."glAccountCode" over full journal history).
--   Existing je_gl_code_idx leads with "glAccountCode" and je_account_idx with
--   "accountId" — neither serves a tenant+date range scan.
--   DDL evidence: "journalEntries" created at
--   drizzle/migrations/003_full_platform_schema.sql:2250,
--   "tenantId" @ :2253, "postingDate" @ :2263.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journalentries_tenant_posting
  ON "journalEntries" ("tenantId", "postingDate");

-- W11 perf (DI-05): supports the transaction-reference lookup loop in
--   services/operations-control-gl-rs/src/main.rs:73-76.
--   NOTE: that query currently reads columns "reference"/"status"/"postedAt"
--   which DO NOT EXIST on "journalEntries" (003:2250-2266 column list) — the
--   query itself is schema-drifted and must be corrected to "transactionRef"
--   (separate code fix, out of scope for this index migration). This index
--   covers the corrected lookup: WHERE "transactionRef" = $1.
--   DDL evidence: "transactionRef" @ drizzle/migrations/003_full_platform_schema.sql:2260.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journalentries_txnref
  ON "journalEntries" ("transactionRef");

-- W11 perf (DI-05): reversal-chain lookups (partial — most rows are not
--   reversals, so the index stays small).
--   DDL evidence: "reversalOf" @ drizzle/migrations/003_full_platform_schema.sql:2262.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journalentries_reversal
  ON "journalEntries" ("reversalOf") WHERE "reversalOf" IS NOT NULL;

-- W11 perf (DI-07): supports
--   infrastructure/new/server/lib/drizzle/preparedStatements.ts:109-120
--   (get_accounts_by_customer: WHERE "customerId" = ? AND "tenantId" = ?
--    ORDER BY "createdAt" DESC).
--   Existing account_customer_idx is ("customerId","status") — wrong second
--   column, forcing filter+sort (0007_core_banking_tables.sql:25).
--   DDL evidence: "accounts" created at
--   drizzle/0007_core_banking_tables.sql:4, "customerId" @ :7,
--   "tenantId" @ :8, "createdAt" @ :21.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_customer_tenant_created
  ON "accounts" ("customerId", "tenantId", "createdAt" DESC);

-- =============================================================================
-- EXCLUDED from this migration (see work/w11/fix-dispositions/data-indexes.md):
--   * DI-08 idx_users_user_id ON users(user_id) — NOT CREATED: the drizzle
--     "users" table (0008_comprehensive_platform_schema.sql:8-19) has columns
--     id,email,username,role,tenant_id,keycloak_id,status,last_signed_in,
--     created_at,updated_at — there is NO "user_id" column (and no "tier").
--     The calling query (services/security-service/transaction_limits.go:624)
--     is broken independently of indexing; creating an index on a nonexistent
--     column would just fail.
-- =============================================================================
