-- Rollback: 001_create_helm_validator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_helm_validator_updated ON helm_validator_records;
DROP FUNCTION IF EXISTS update_helm_validator_timestamp();
DROP FUNCTION IF EXISTS cleanup_helm_validator_idempotency();
DROP POLICY IF EXISTS helm_validator_tenant_isolation ON helm_validator_records;
DROP TABLE IF EXISTS helm_validator_idempotency;
DROP TABLE IF EXISTS helm_validator_audit;
DROP TABLE IF EXISTS helm_validator_records;
COMMIT;
