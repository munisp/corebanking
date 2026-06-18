-- Rollback: 001_create_qr_payments_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_qr_payments_updated ON qr_payments_records;
DROP FUNCTION IF EXISTS update_qr_payments_timestamp();
DROP FUNCTION IF EXISTS cleanup_qr_payments_idempotency();
DROP POLICY IF EXISTS qr_payments_tenant_isolation ON qr_payments_records;
DROP TABLE IF EXISTS qr_payments_idempotency;
DROP TABLE IF EXISTS qr_payments_audit;
DROP TABLE IF EXISTS qr_payments_records;
COMMIT;
