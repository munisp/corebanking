-- Rollback: 001_create_open_banking_baas_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_open_banking_baas_updated ON open_banking_baas_records;
DROP FUNCTION IF EXISTS update_open_banking_baas_timestamp();
DROP FUNCTION IF EXISTS cleanup_open_banking_baas_idempotency();
DROP POLICY IF EXISTS open_banking_baas_tenant_isolation ON open_banking_baas_records;
DROP TABLE IF EXISTS open_banking_baas_idempotency;
DROP TABLE IF EXISTS open_banking_baas_audit;
DROP TABLE IF EXISTS open_banking_baas_records;
COMMIT;
