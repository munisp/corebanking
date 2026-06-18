-- Rollback: 001_create_kyc_workflow_orchestration_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_workflow_orchestration_updated ON kyc_workflow_orchestration_records;
DROP FUNCTION IF EXISTS update_kyc_workflow_orchestration_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_workflow_orchestration_idempotency();
DROP POLICY IF EXISTS kyc_workflow_orchestration_tenant_isolation ON kyc_workflow_orchestration_records;
DROP TABLE IF EXISTS kyc_workflow_orchestration_idempotency;
DROP TABLE IF EXISTS kyc_workflow_orchestration_audit;
DROP TABLE IF EXISTS kyc_workflow_orchestration_records;
COMMIT;
