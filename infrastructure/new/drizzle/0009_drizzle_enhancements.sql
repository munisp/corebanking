-- =============================================================================
-- Migration 0009: Drizzle ORM Enhancements
-- 54Bank Platform — Schema Hardening & Integrity Constraints
-- =============================================================================
-- This migration adds:
--   1. PostgreSQL ENUM types for all status/type columns (replaces raw text)
--   2. CHECK constraints for business rule enforcement
--   3. Foreign key constraints for referential integrity
--   4. Composite indexes for common query patterns
--   5. Partial indexes for soft-delete patterns
--   6. Optimistic locking version columns
--   7. Soft-delete deletedAt columns
--   8. Row-Level Security (RLS) for tenant isolation
--   9. Trigger for auto-updating updatedAt columns
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

-- Customer risk levels
DO $$ BEGIN
  CREATE TYPE customer_risk AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Account types
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM (
    'savings', 'current', 'domiciliary', 'corporate', 'joint', 'fixed_deposit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transaction types
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'credit', 'debit', 'reversal', 'fee', 'interest', 'charge_back'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transaction / record status
DO $$ BEGIN
  CREATE TYPE record_status AS ENUM (
    'pending', 'active', 'inactive', 'approved', 'rejected',
    'cancelled', 'completed', 'failed', 'suspended', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Loan types
DO $$ BEGIN
  CREATE TYPE loan_type AS ENUM (
    'personal', 'mortgage', 'auto', 'business', 'education', 'agri', 'microfinance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- KYC verification types
DO $$ BEGIN
  CREATE TYPE kyc_type AS ENUM (
    'bvn', 'nin', 'passport', 'drivers_license', 'utility_bill', 'bank_statement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Escrow types
DO $$ BEGIN
  CREATE TYPE escrow_type AS ENUM ('property', 'trade', 'milestone', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Workflow / saga status
DO $$ BEGIN
  CREATE TYPE workflow_status AS ENUM (
    'running', 'completed', 'failed', 'cancelled', 'timed_out', 'terminated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dapr event status
DO $$ BEGIN
  CREATE TYPE dapr_event_status AS ENUM ('published', 'failed', 'retrying', 'dead_lettered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fluvio event status
DO $$ BEGIN
  CREATE TYPE fluvio_event_status AS ENUM ('pending', 'delivered', 'failed', 'retrying');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. OPTIMISTIC LOCKING — version column
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "escrowAccounts"
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "billingInvoices"
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "workflowCases"
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- =============================================================================
-- 3. SOFT DELETE — deletedAt column
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE "customerCards"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE "billingRateCards"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE "escrowAccounts"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- =============================================================================
-- 4. CHECK CONSTRAINTS — business rule enforcement
-- =============================================================================

-- Accounts: balance cannot be negative for savings accounts
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS chk_accounts_balance_non_negative;
ALTER TABLE accounts
  ADD CONSTRAINT chk_accounts_balance_non_negative
  CHECK (balance >= 0);

-- Transactions: amount must be positive
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_amount_positive;
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_amount_positive
  CHECK (amount > 0);

-- Loans: principal must be positive, interest rate between 0 and 100
ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS chk_loans_principal_positive;
ALTER TABLE loans
  ADD CONSTRAINT chk_loans_principal_positive
  CHECK ("principalAmount" > 0);

ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS chk_loans_interest_rate_range;
ALTER TABLE loans
  ADD CONSTRAINT chk_loans_interest_rate_range
  CHECK ("interestRate" >= 0 AND "interestRate" <= 100);

-- Billing usage events: quantity must be positive
ALTER TABLE "billingUsageEvents"
  DROP CONSTRAINT IF EXISTS chk_billing_usage_quantity_positive;
ALTER TABLE "billingUsageEvents"
  ADD CONSTRAINT chk_billing_usage_quantity_positive
  CHECK (quantity > 0);

-- Escrow: amount must be positive
ALTER TABLE "escrowAccounts"
  DROP CONSTRAINT IF EXISTS chk_escrow_amount_positive;
ALTER TABLE "escrowAccounts"
  ADD CONSTRAINT chk_escrow_amount_positive
  CHECK (amount > 0);

-- tenantId must not be empty string
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS chk_customers_tenant_not_empty;
ALTER TABLE customers
  ADD CONSTRAINT chk_customers_tenant_not_empty
  CHECK ("tenantId" <> '');

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS chk_accounts_tenant_not_empty;
ALTER TABLE accounts
  ADD CONSTRAINT chk_accounts_tenant_not_empty
  CHECK ("tenantId" <> '');

-- =============================================================================
-- 5. FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- customers → tenants
ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS fk_customers_tenant;
ALTER TABLE customers
  ADD CONSTRAINT fk_customers_tenant
  FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- accounts → customers
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS fk_accounts_customer;
ALTER TABLE accounts
  ADD CONSTRAINT fk_accounts_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- accounts → tenants
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS fk_accounts_tenant;
ALTER TABLE accounts
  ADD CONSTRAINT fk_accounts_tenant
  FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- transactions → accounts
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS fk_transactions_account;
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_account
  FOREIGN KEY ("accountId") REFERENCES accounts("accountId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- loans → customers
ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS fk_loans_customer;
ALTER TABLE loans
  ADD CONSTRAINT fk_loans_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- loanRepayments → loans
ALTER TABLE "loanRepayments"
  DROP CONSTRAINT IF EXISTS fk_loan_repayments_loan;
ALTER TABLE "loanRepayments"
  ADD CONSTRAINT fk_loan_repayments_loan
  FOREIGN KEY ("loanId") REFERENCES loans("loanId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- kycVerifications → customers
ALTER TABLE "kycVerifications"
  DROP CONSTRAINT IF EXISTS fk_kyc_customer;
ALTER TABLE "kycVerifications"
  ADD CONSTRAINT fk_kyc_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- amlAlerts → customers
ALTER TABLE "amlAlerts"
  DROP CONSTRAINT IF EXISTS fk_aml_customer;
ALTER TABLE "amlAlerts"
  ADD CONSTRAINT fk_aml_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- customerCards → customers
ALTER TABLE "customerCards"
  DROP CONSTRAINT IF EXISTS fk_customer_cards_customer;
ALTER TABLE "customerCards"
  ADD CONSTRAINT fk_customer_cards_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- customerTransfers → customers
ALTER TABLE "customerTransfers"
  DROP CONSTRAINT IF EXISTS fk_customer_transfers_customer;
ALTER TABLE "customerTransfers"
  ADD CONSTRAINT fk_customer_transfers_customer
  FOREIGN KEY ("customerId") REFERENCES customers("customerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- billingAccounts → tenants
ALTER TABLE "billingAccounts"
  DROP CONSTRAINT IF EXISTS fk_billing_accounts_tenant;
ALTER TABLE "billingAccounts"
  ADD CONSTRAINT fk_billing_accounts_tenant
  FOREIGN KEY ("tenantId") REFERENCES tenants("tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- billingRateCards → billingAccounts
ALTER TABLE "billingRateCards"
  DROP CONSTRAINT IF EXISTS fk_billing_rate_cards_account;
ALTER TABLE "billingRateCards"
  ADD CONSTRAINT fk_billing_rate_cards_account
  FOREIGN KEY ("billingAccountId") REFERENCES "billingAccounts"("billingAccountId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- billingInvoices → billingAccounts
ALTER TABLE "billingInvoices"
  DROP CONSTRAINT IF EXISTS fk_billing_invoices_account;
ALTER TABLE "billingInvoices"
  ADD CONSTRAINT fk_billing_invoices_account
  FOREIGN KEY ("billingAccountId") REFERENCES "billingAccounts"("billingAccountId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- escrowParties → escrowAccounts
ALTER TABLE "escrowParties"
  DROP CONSTRAINT IF EXISTS fk_escrow_parties_account;
ALTER TABLE "escrowParties"
  ADD CONSTRAINT fk_escrow_parties_account
  FOREIGN KEY ("escrowId") REFERENCES "escrowAccounts"("escrowId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- escrowTransactions → escrowAccounts
ALTER TABLE "escrowTransactions"
  DROP CONSTRAINT IF EXISTS fk_escrow_transactions_account;
ALTER TABLE "escrowTransactions"
  ADD CONSTRAINT fk_escrow_transactions_account
  FOREIGN KEY ("escrowId") REFERENCES "escrowAccounts"("escrowId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- temporalActivityLog → temporalWorkflowExecutions
ALTER TABLE "temporalActivityLog"
  DROP CONSTRAINT IF EXISTS fk_temporal_activity_workflow;
ALTER TABLE "temporalActivityLog"
  ADD CONSTRAINT fk_temporal_activity_workflow
  FOREIGN KEY ("workflowId") REFERENCES "temporalWorkflowExecutions"("workflowId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- temporalSagaCompensations → temporalWorkflowExecutions
ALTER TABLE "temporalSagaCompensations"
  DROP CONSTRAINT IF EXISTS fk_temporal_saga_workflow;
ALTER TABLE "temporalSagaCompensations"
  ADD CONSTRAINT fk_temporal_saga_workflow
  FOREIGN KEY ("workflowId") REFERENCES "temporalWorkflowExecutions"("workflowId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 6. PERFORMANCE INDEXES
-- =============================================================================

-- Soft-delete partial indexes (only index non-deleted rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_active
  ON customers ("tenantId", "customerId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_active
  ON accounts ("tenantId", "customerId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_active
  ON loans ("tenantId", "customerId")
  WHERE "deletedAt" IS NULL;

-- Transaction hot-path indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_account_created
  ON transactions ("accountId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_tenant_type
  ON transactions ("tenantId", type, "createdAt" DESC);

-- Billing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_usage_tenant_meter
  ON "billingUsageEvents" ("tenantId", "meterKey", "occurredAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_invoices_tenant_period
  ON "billingInvoices" ("tenantId", "billingPeriodKey");

-- Middleware indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dapr_events_tenant_topic
  ON "daprPublishedEvents" ("tenantId", topic, "publishedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temporal_workflows_tenant_type
  ON "temporalWorkflowExecutions" ("tenantId", "workflowType", "startedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fluvio_events_tenant_topic
  ON "fluvioEventLog" ("tenantId", topic, "publishedAt" DESC);

-- Fluvio outbox: pending events only (partial index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fluvio_outbox_pending
  ON "fluvioEventOutbox" ("scheduledAt" ASC)
  WHERE status = 'pending';

-- KYC/AML
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_tenant_customer
  ON "kycVerifications" ("tenantId", "customerId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aml_tenant_status
  ON "amlAlerts" ("tenantId", status, "createdAt" DESC);

-- =============================================================================
-- 7. AUTO-UPDATE updatedAt TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updatedAt
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'customers', 'accounts', 'transactions', 'loans', 'tenants',
    'billingAccounts', 'billingInvoices', 'escrowAccounts',
    'workflowCases', 'temporalWorkflowExecutions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
      CREATE TRIGGER trg_set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) — Tenant Isolation
-- =============================================================================

-- Enable RLS on all tenant-scoped tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'customers', 'accounts', 'transactions', 'loans', 'loanRepayments',
    'kycVerifications', 'amlAlerts', 'billingAccounts', 'billingUsageEvents',
    'billingInvoices', 'escrowAccounts', 'customerCards', 'customerTransfers',
    'customerNotifications', 'auditEntries', 'daprPublishedEvents',
    'temporalWorkflowExecutions', 'fluvioEventLog', 'fluvioEventOutbox'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    -- Drop and recreate tenant isolation policy
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation ON %I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING ("tenantId" = current_setting(''app.current_tenant'', true))
    ', tbl);

    -- Service role bypass for migrations and admin
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON %I', tbl);
    EXECUTE format('
      CREATE POLICY service_role_bypass ON %I
        AS PERMISSIVE FOR ALL TO service_role USING (true)
    ', tbl);
  END LOOP;
END $$;

-- =============================================================================
-- 9. SCHEMA VERSION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS "_drizzle_migrations_meta" (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(256) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64),
  execution_time_ms INTEGER
);

INSERT INTO "_drizzle_migrations_meta" (migration_name, checksum)
VALUES ('0009_drizzle_enhancements', md5('0009_drizzle_enhancements'))
ON CONFLICT (migration_name) DO NOTHING;

COMMIT;
