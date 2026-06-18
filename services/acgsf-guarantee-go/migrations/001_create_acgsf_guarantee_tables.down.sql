-- Rollback: 001_create_acgsf_guarantee_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_acgsf_guarantee_updated ON acgsf_guarantee_records;
DROP FUNCTION IF EXISTS update_acgsf_guarantee_timestamp();
DROP FUNCTION IF EXISTS cleanup_acgsf_guarantee_idempotency();
DROP POLICY IF EXISTS acgsf_guarantee_tenant_isolation ON acgsf_guarantee_records;
DROP TABLE IF EXISTS acgsf_guarantee_idempotency;
DROP TABLE IF EXISTS acgsf_guarantee_audit;
DROP TABLE IF EXISTS acgsf_guarantee_records;
COMMIT;
