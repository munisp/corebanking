-- Rollback: 001_create_cloud_kms_bridge_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cloud_kms_bridge_updated ON cloud_kms_bridge_records;
DROP FUNCTION IF EXISTS update_cloud_kms_bridge_timestamp();
DROP FUNCTION IF EXISTS cleanup_cloud_kms_bridge_idempotency();
DROP POLICY IF EXISTS cloud_kms_bridge_tenant_isolation ON cloud_kms_bridge_records;
DROP TABLE IF EXISTS cloud_kms_bridge_idempotency;
DROP TABLE IF EXISTS cloud_kms_bridge_audit;
DROP TABLE IF EXISTS cloud_kms_bridge_records;
COMMIT;
