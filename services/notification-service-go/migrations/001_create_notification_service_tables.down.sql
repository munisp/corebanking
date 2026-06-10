-- Rollback: 001_create_notification_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_notification_service_updated ON notification_service_records;
DROP FUNCTION IF EXISTS update_notification_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_notification_service_idempotency();
DROP POLICY IF EXISTS notification_service_tenant_isolation ON notification_service_records;
DROP TABLE IF EXISTS notification_service_idempotency;
DROP TABLE IF EXISTS notification_service_audit;
DROP TABLE IF EXISTS notification_service_records;
COMMIT;
