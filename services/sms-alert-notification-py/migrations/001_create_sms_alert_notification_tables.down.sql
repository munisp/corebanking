-- Rollback: 001_create_sms_alert_notification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sms_alert_notification_updated ON sms_alert_notification_records;
DROP FUNCTION IF EXISTS update_sms_alert_notification_timestamp();
DROP FUNCTION IF EXISTS cleanup_sms_alert_notification_idempotency();
DROP POLICY IF EXISTS sms_alert_notification_tenant_isolation ON sms_alert_notification_records;
DROP TABLE IF EXISTS sms_alert_notification_idempotency;
DROP TABLE IF EXISTS sms_alert_notification_audit;
DROP TABLE IF EXISTS sms_alert_notification_records;
COMMIT;
