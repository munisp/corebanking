-- Rollback: 001_create_developer_portal_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_developer_portal_updated ON developer_portal_records;
DROP FUNCTION IF EXISTS update_developer_portal_timestamp();
DROP FUNCTION IF EXISTS cleanup_developer_portal_idempotency();
DROP POLICY IF EXISTS developer_portal_tenant_isolation ON developer_portal_records;
DROP TABLE IF EXISTS developer_portal_idempotency;
DROP TABLE IF EXISTS developer_portal_audit;
DROP TABLE IF EXISTS developer_portal_records;
COMMIT;
