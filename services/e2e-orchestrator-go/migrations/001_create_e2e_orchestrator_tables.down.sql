-- Rollback: 001_create_e2e_orchestrator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_e2e_orchestrator_updated ON e2e_orchestrator_records;
DROP FUNCTION IF EXISTS update_e2e_orchestrator_timestamp();
DROP FUNCTION IF EXISTS cleanup_e2e_orchestrator_idempotency();
DROP POLICY IF EXISTS e2e_orchestrator_tenant_isolation ON e2e_orchestrator_records;
DROP TABLE IF EXISTS e2e_orchestrator_idempotency;
DROP TABLE IF EXISTS e2e_orchestrator_audit;
DROP TABLE IF EXISTS e2e_orchestrator_records;
COMMIT;
