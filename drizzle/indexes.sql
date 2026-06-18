-- ─────────────────────────────────────────────────────────────
-- 54Bank Production Indexes
-- Run with: psql $DATABASE_URL -f drizzle/indexes.sql
-- All indexes created CONCURRENTLY to avoid table locks
-- ─────────────────────────────────────────────────────────────

-- ── Core Banking (high-frequency OLTP) ────────────────────

-- accounts: customer lookup + status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_customer_status
  ON accounts (customer_id, status);

-- accounts: optimistic locking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_id_version
  ON accounts (id, version);

-- transactions: time-series queries (BRIN for append-only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_txn_created_brin
  ON transactions USING BRIN (created_at) WITH (pages_per_range = 32);

-- transactions: account lookup with time ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_txn_account_created
  ON transactions (account_id, created_at DESC);

-- transactions: idempotency dedup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_txn_reference_unique
  ON transactions (reference) WHERE reference IS NOT NULL;

-- transactions: status monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_txn_status_partial
  ON transactions (status, created_at DESC) WHERE status IN ('pending', 'processing');

-- transfers: date range reporting (BRIN)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_date_brin
  ON transfers USING BRIN (transfer_date) WITH (pages_per_range = 32);

-- transfers: completed aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_completed
  ON transfers (transfer_date, currency) WHERE status = 'completed';

-- ── Loans & Lending ───────────────────────────────────────

-- loans: payment collection queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_payment_status
  ON loans (next_payment_date, status) WHERE status = 'active';

-- loans: customer portfolio
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_customer
  ON loans (customer_id, status);

-- loan_repayments: loan lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_repayments_loan
  ON loan_repayments (loan_id, payment_date DESC);

-- ── Customers & KYC ──────────────────────────────────────

-- customers: search by name/email (trigram for LIKE queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm
  ON customers USING GIN (name gin_trgm_ops);

-- customers: BVN/NIN lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_bvn
  ON customers (bvn) WHERE bvn IS NOT NULL;

-- kyc_verifications: latest per customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_customer_verified
  ON kyc_verifications (customer_id, verified_at DESC);

-- kyc_tiers: customer tier lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_tiers_customer
  ON kyc_tiers (customer_id, effective_date DESC);

-- ── Audit & Compliance ───────────────────────────────────

-- audit_trail: entity lookup (CRITICAL — most expensive query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_entity_ts
  ON audit_trail (entity_type, entity_id, created_at DESC);

-- audit_entries: operator action tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_entries_operator
  ON audit_entries (operator_id, created_at DESC);

-- aml_alerts: pending risk triage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aml_pending_risk
  ON aml_alerts (risk_score DESC, created_at ASC) WHERE status = 'pending';

-- aml_cases: investigation status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aml_cases_status
  ON aml_cases (status, assigned_to, created_at DESC);

-- sanctions_screenings: customer screening
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sanctions_customer
  ON sanctions_screenings (customer_id, screened_at DESC);

-- ── Ledger & GL ──────────────────────────────────────────

-- journal_entries: account balance calculation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_account
  ON journal_entries (account_id, posted_at DESC);

-- gl_accounts: code lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_gl_code
  ON gl_accounts (account_code);

-- trial_balances: period reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trial_period
  ON trial_balances (period_end, account_id);

-- ── Payments ─────────────────────────────────────────────

-- nip_transactions: reference lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nip_ref
  ON nip_transactions (reference, created_at DESC);

-- settlements: date-based reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlements_date
  ON settlements USING BRIN (settlement_date) WITH (pages_per_range = 16);

-- ── Multi-tenant ─────────────────────────────────────────

-- tenants: tenant ID lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_tenant_id
  ON tenants (tenant_id);

-- tenant_feature_flags: feature lookup per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_flags
  ON tenant_feature_flags (tenant_id, feature_key);

-- ── Cards & Channels ─────────────────────────────────────

-- card_transactions: card + time lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_txn_card_time
  ON card_transactions (card_id, created_at DESC);

-- customer_cards: customer card listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_cards
  ON customer_cards (customer_id, status);

-- ── Agriculture ──────────────────────────────────────────

-- farmers: cooperative membership
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_farmers_cooperative
  ON farmers (cooperative_id, status);

-- agri_loans: season-based lending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agri_loans_season
  ON agri_loans (planting_season, status);

-- crop_insurance_policies: active policies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crop_insurance_active
  ON crop_insurance_policies (farmer_id, status) WHERE status = 'active';

-- ── Session & Security ───────────────────────────────────

-- session_records: user session lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user
  ON session_records (user_id, expires_at DESC);

-- security_events: time-series security log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_events_brin
  ON security_events USING BRIN (created_at) WITH (pages_per_range = 16);

-- ── Billing ──────────────────────────────────────────────

-- billing_usage_events: tenant metering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_usage_tenant
  ON billing_usage_events (tenant_id, event_timestamp DESC);

-- billing_invoices: tenant billing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_billing_invoices_tenant
  ON billing_invoices (tenant_id, period_start DESC);

-- ── Performance: Materialized Views ──────────────────────

-- Daily transaction summary (refresh every 15 min)
-- CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_txn_summary AS
--   SELECT
--     date_trunc('day', created_at) AS txn_date,
--     account_id,
--     COUNT(*) AS txn_count,
--     SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS total_credits,
--     SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS total_debits,
--     currency
--   FROM transactions
--   WHERE created_at > NOW() - INTERVAL '90 days'
--   GROUP BY txn_date, account_id, currency;

-- CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_txn
--   ON mv_daily_txn_summary (txn_date, account_id, currency);

-- ── Table Partitioning (for tables > 10M rows) ──────────

-- Partition transactions by month (run once, then add monthly)
-- ALTER TABLE transactions RENAME TO transactions_old;
-- CREATE TABLE transactions (LIKE transactions_old INCLUDING ALL) PARTITION BY RANGE (created_at);
-- CREATE TABLE transactions_2026_01 PARTITION OF transactions FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... create partitions for each month

-- Partition audit_trail by month
-- ALTER TABLE audit_trail RENAME TO audit_trail_old;
-- CREATE TABLE audit_trail (LIKE audit_trail_old INCLUDING ALL) PARTITION BY RANGE (created_at);

-- ── Enable pg_trgm for text search ──────────────────────
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
