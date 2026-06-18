-- Rollback: 001_create_skeleton_loading_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_skeleton_loading_updated ON skeleton_loading_records;
DROP FUNCTION IF EXISTS update_skeleton_loading_timestamp();
DROP FUNCTION IF EXISTS cleanup_skeleton_loading_idempotency();
DROP POLICY IF EXISTS skeleton_loading_tenant_isolation ON skeleton_loading_records;
DROP TABLE IF EXISTS skeleton_loading_idempotency;
DROP TABLE IF EXISTS skeleton_loading_audit;
DROP TABLE IF EXISTS skeleton_loading_records;
COMMIT;
