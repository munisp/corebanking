-- Rollback: 001_create_sri_validator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sri_validator_updated ON sri_validator_records;
DROP FUNCTION IF EXISTS update_sri_validator_timestamp();
DROP FUNCTION IF EXISTS cleanup_sri_validator_idempotency();
DROP POLICY IF EXISTS sri_validator_tenant_isolation ON sri_validator_records;
DROP TABLE IF EXISTS sri_validator_idempotency;
DROP TABLE IF EXISTS sri_validator_audit;
DROP TABLE IF EXISTS sri_validator_records;
COMMIT;
