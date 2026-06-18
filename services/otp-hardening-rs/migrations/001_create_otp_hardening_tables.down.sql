-- Rollback: 001_create_otp_hardening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_otp_hardening_updated ON otp_hardening_records;
DROP FUNCTION IF EXISTS update_otp_hardening_timestamp();
DROP FUNCTION IF EXISTS cleanup_otp_hardening_idempotency();
DROP POLICY IF EXISTS otp_hardening_tenant_isolation ON otp_hardening_records;
DROP TABLE IF EXISTS otp_hardening_idempotency;
DROP TABLE IF EXISTS otp_hardening_audit;
DROP TABLE IF EXISTS otp_hardening_records;
COMMIT;
