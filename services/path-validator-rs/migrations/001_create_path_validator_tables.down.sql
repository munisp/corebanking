-- Rollback: 001_create_path_validator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_path_validator_updated ON path_validator_records;
DROP FUNCTION IF EXISTS update_path_validator_timestamp();
DROP FUNCTION IF EXISTS cleanup_path_validator_idempotency();
DROP POLICY IF EXISTS path_validator_tenant_isolation ON path_validator_records;
DROP TABLE IF EXISTS path_validator_idempotency;
DROP TABLE IF EXISTS path_validator_audit;
DROP TABLE IF EXISTS path_validator_records;
COMMIT;
