-- Rollback: 001_create_payment_investigation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_payment_investigation_updated ON payment_investigation_records;
DROP FUNCTION IF EXISTS update_payment_investigation_timestamp();
DROP FUNCTION IF EXISTS cleanup_payment_investigation_idempotency();
DROP POLICY IF EXISTS payment_investigation_tenant_isolation ON payment_investigation_records;
DROP TABLE IF EXISTS payment_investigation_idempotency;
DROP TABLE IF EXISTS payment_investigation_audit;
DROP TABLE IF EXISTS payment_investigation_records;
COMMIT;
