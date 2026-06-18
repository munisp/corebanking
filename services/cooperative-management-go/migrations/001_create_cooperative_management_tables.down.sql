-- Rollback: 001_create_cooperative_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cooperative_management_updated ON cooperative_management_records;
DROP FUNCTION IF EXISTS update_cooperative_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_cooperative_management_idempotency();
DROP POLICY IF EXISTS cooperative_management_tenant_isolation ON cooperative_management_records;
DROP TABLE IF EXISTS cooperative_management_idempotency;
DROP TABLE IF EXISTS cooperative_management_audit;
DROP TABLE IF EXISTS cooperative_management_records;
COMMIT;
