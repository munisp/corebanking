-- Rollback: 001_create_payments_hub_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_payments_hub_updated ON payments_hub_records;
DROP FUNCTION IF EXISTS update_payments_hub_timestamp();
DROP FUNCTION IF EXISTS cleanup_payments_hub_idempotency();
DROP POLICY IF EXISTS payments_hub_tenant_isolation ON payments_hub_records;
DROP TABLE IF EXISTS payments_hub_idempotency;
DROP TABLE IF EXISTS payments_hub_audit;
DROP TABLE IF EXISTS payments_hub_records;
COMMIT;
