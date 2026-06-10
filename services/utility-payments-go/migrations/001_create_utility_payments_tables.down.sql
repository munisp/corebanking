-- Rollback: 001_create_utility_payments_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_utility_payments_updated ON utility_payments_records;
DROP FUNCTION IF EXISTS update_utility_payments_timestamp();
DROP FUNCTION IF EXISTS cleanup_utility_payments_idempotency();
DROP POLICY IF EXISTS utility_payments_tenant_isolation ON utility_payments_records;
DROP TABLE IF EXISTS utility_payments_idempotency;
DROP TABLE IF EXISTS utility_payments_audit;
DROP TABLE IF EXISTS utility_payments_records;
COMMIT;
