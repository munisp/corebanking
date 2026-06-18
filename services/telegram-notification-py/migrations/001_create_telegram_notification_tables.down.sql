-- Rollback: 001_create_telegram_notification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_telegram_notification_updated ON telegram_notification_records;
DROP FUNCTION IF EXISTS update_telegram_notification_timestamp();
DROP FUNCTION IF EXISTS cleanup_telegram_notification_idempotency();
DROP POLICY IF EXISTS telegram_notification_tenant_isolation ON telegram_notification_records;
DROP TABLE IF EXISTS telegram_notification_idempotency;
DROP TABLE IF EXISTS telegram_notification_audit;
DROP TABLE IF EXISTS telegram_notification_records;
COMMIT;
