-- Rollback: 001_create_nqr_payments_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nqr_payments_updated ON nqr_payments_records;
DROP FUNCTION IF EXISTS update_nqr_payments_timestamp();
DROP FUNCTION IF EXISTS cleanup_nqr_payments_idempotency();
DROP POLICY IF EXISTS nqr_payments_tenant_isolation ON nqr_payments_records;
DROP TABLE IF EXISTS nqr_payments_idempotency;
DROP TABLE IF EXISTS nqr_payments_audit;
DROP TABLE IF EXISTS nqr_payments_records;
COMMIT;
