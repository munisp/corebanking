-- Rollback: 001_create_telegram_kyc_bot_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_telegram_kyc_bot_updated ON telegram_kyc_bot_records;
DROP FUNCTION IF EXISTS update_telegram_kyc_bot_timestamp();
DROP FUNCTION IF EXISTS cleanup_telegram_kyc_bot_idempotency();
DROP POLICY IF EXISTS telegram_kyc_bot_tenant_isolation ON telegram_kyc_bot_records;
DROP TABLE IF EXISTS telegram_kyc_bot_idempotency;
DROP TABLE IF EXISTS telegram_kyc_bot_audit;
DROP TABLE IF EXISTS telegram_kyc_bot_records;
COMMIT;
