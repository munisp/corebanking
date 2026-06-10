-- Rollback: 001_create_liveness_orchestrator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_liveness_orchestrator_updated ON liveness_orchestrator_records;
DROP FUNCTION IF EXISTS update_liveness_orchestrator_timestamp();
DROP FUNCTION IF EXISTS cleanup_liveness_orchestrator_idempotency();
DROP POLICY IF EXISTS liveness_orchestrator_tenant_isolation ON liveness_orchestrator_records;
DROP TABLE IF EXISTS liveness_orchestrator_idempotency;
DROP TABLE IF EXISTS liveness_orchestrator_audit;
DROP TABLE IF EXISTS liveness_orchestrator_records;
COMMIT;
