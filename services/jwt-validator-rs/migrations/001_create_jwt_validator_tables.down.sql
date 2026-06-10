-- Rollback: 001_create_jwt_validator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_jwt_validator_updated ON jwt_validator_records;
DROP FUNCTION IF EXISTS update_jwt_validator_timestamp();
DROP FUNCTION IF EXISTS cleanup_jwt_validator_idempotency();
DROP POLICY IF EXISTS jwt_validator_tenant_isolation ON jwt_validator_records;
DROP TABLE IF EXISTS jwt_validator_idempotency;
DROP TABLE IF EXISTS jwt_validator_audit;
DROP TABLE IF EXISTS jwt_validator_records;
COMMIT;
