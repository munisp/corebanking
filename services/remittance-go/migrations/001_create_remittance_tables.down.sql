-- Rollback: 001_create_remittance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_remittance_updated ON remittance_records;
DROP FUNCTION IF EXISTS update_remittance_timestamp();
DROP FUNCTION IF EXISTS cleanup_remittance_idempotency();
DROP POLICY IF EXISTS remittance_tenant_isolation ON remittance_records;
DROP TABLE IF EXISTS remittance_idempotency;
DROP TABLE IF EXISTS remittance_audit;
DROP TABLE IF EXISTS remittance_records;
COMMIT;
