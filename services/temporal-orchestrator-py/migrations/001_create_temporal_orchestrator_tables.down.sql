-- Rollback: 001_create_temporal_orchestrator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_temporal_orchestrator_updated ON temporal_orchestrator_records;
DROP FUNCTION IF EXISTS update_temporal_orchestrator_timestamp();
DROP FUNCTION IF EXISTS cleanup_temporal_orchestrator_idempotency();
DROP POLICY IF EXISTS temporal_orchestrator_tenant_isolation ON temporal_orchestrator_records;
DROP TABLE IF EXISTS temporal_orchestrator_idempotency;
DROP TABLE IF EXISTS temporal_orchestrator_audit;
DROP TABLE IF EXISTS temporal_orchestrator_records;
COMMIT;
