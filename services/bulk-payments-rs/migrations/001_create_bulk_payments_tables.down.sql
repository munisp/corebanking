-- Rollback: 001_create_bulk_payments_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_bulk_payments_updated ON bulk_payments_records;
DROP FUNCTION IF EXISTS update_bulk_payments_timestamp();
DROP FUNCTION IF EXISTS cleanup_bulk_payments_idempotency();
DROP POLICY IF EXISTS bulk_payments_tenant_isolation ON bulk_payments_records;
DROP TABLE IF EXISTS bulk_payments_idempotency;
DROP TABLE IF EXISTS bulk_payments_audit;
DROP TABLE IF EXISTS bulk_payments_records;
COMMIT;
