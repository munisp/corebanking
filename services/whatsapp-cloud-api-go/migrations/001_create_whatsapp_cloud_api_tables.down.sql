-- Rollback: 001_create_whatsapp_cloud_api_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_whatsapp_cloud_api_updated ON whatsapp_cloud_api_records;
DROP FUNCTION IF EXISTS update_whatsapp_cloud_api_timestamp();
DROP FUNCTION IF EXISTS cleanup_whatsapp_cloud_api_idempotency();
DROP POLICY IF EXISTS whatsapp_cloud_api_tenant_isolation ON whatsapp_cloud_api_records;
DROP TABLE IF EXISTS whatsapp_cloud_api_idempotency;
DROP TABLE IF EXISTS whatsapp_cloud_api_audit;
DROP TABLE IF EXISTS whatsapp_cloud_api_records;
COMMIT;
