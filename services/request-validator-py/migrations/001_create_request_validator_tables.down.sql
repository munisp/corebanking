-- Rollback: 001_create_request_validator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_request_validator_updated ON request_validator_records;
DROP FUNCTION IF EXISTS update_request_validator_timestamp();
DROP FUNCTION IF EXISTS cleanup_request_validator_idempotency();
DROP POLICY IF EXISTS request_validator_tenant_isolation ON request_validator_records;
DROP TABLE IF EXISTS request_validator_idempotency;
DROP TABLE IF EXISTS request_validator_audit;
DROP TABLE IF EXISTS request_validator_records;
COMMIT;
