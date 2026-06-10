-- Rollback: 001_create_sms_otp_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sms_otp_service_updated ON sms_otp_service_records;
DROP FUNCTION IF EXISTS update_sms_otp_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_sms_otp_service_idempotency();
DROP POLICY IF EXISTS sms_otp_service_tenant_isolation ON sms_otp_service_records;
DROP TABLE IF EXISTS sms_otp_service_idempotency;
DROP TABLE IF EXISTS sms_otp_service_audit;
DROP TABLE IF EXISTS sms_otp_service_records;
COMMIT;
