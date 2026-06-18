-- Rollback: 001_create_saga_coordinator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_saga_coordinator_updated ON saga_coordinator_records;
DROP FUNCTION IF EXISTS update_saga_coordinator_timestamp();
DROP FUNCTION IF EXISTS cleanup_saga_coordinator_idempotency();
DROP POLICY IF EXISTS saga_coordinator_tenant_isolation ON saga_coordinator_records;
DROP TABLE IF EXISTS saga_coordinator_idempotency;
DROP TABLE IF EXISTS saga_coordinator_audit;
DROP TABLE IF EXISTS saga_coordinator_records;
COMMIT;
