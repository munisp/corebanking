-- Rollback: 001_create_whatsapp_notification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_whatsapp_notification_updated ON whatsapp_notification_records;
DROP FUNCTION IF EXISTS update_whatsapp_notification_timestamp();
DROP FUNCTION IF EXISTS cleanup_whatsapp_notification_idempotency();
DROP POLICY IF EXISTS whatsapp_notification_tenant_isolation ON whatsapp_notification_records;
DROP TABLE IF EXISTS whatsapp_notification_idempotency;
DROP TABLE IF EXISTS whatsapp_notification_audit;
DROP TABLE IF EXISTS whatsapp_notification_records;
COMMIT;
