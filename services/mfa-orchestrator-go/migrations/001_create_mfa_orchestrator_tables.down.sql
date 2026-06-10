-- Rollback: 001_create_mfa_orchestrator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mfa_orchestrator_updated ON mfa_orchestrator_records;
DROP FUNCTION IF EXISTS update_mfa_orchestrator_timestamp();
DROP FUNCTION IF EXISTS cleanup_mfa_orchestrator_idempotency();
DROP POLICY IF EXISTS mfa_orchestrator_tenant_isolation ON mfa_orchestrator_records;
DROP TABLE IF EXISTS mfa_orchestrator_idempotency;
DROP TABLE IF EXISTS mfa_orchestrator_audit;
DROP TABLE IF EXISTS mfa_orchestrator_records;
COMMIT;
