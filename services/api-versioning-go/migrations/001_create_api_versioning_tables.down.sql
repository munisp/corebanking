-- Rollback: 001_create_api_versioning_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_api_versioning_updated ON api_versioning_records;
DROP FUNCTION IF EXISTS update_api_versioning_timestamp();
DROP FUNCTION IF EXISTS cleanup_api_versioning_idempotency();
DROP POLICY IF EXISTS api_versioning_tenant_isolation ON api_versioning_records;
DROP TABLE IF EXISTS api_versioning_idempotency;
DROP TABLE IF EXISTS api_versioning_audit;
DROP TABLE IF EXISTS api_versioning_records;
COMMIT;
