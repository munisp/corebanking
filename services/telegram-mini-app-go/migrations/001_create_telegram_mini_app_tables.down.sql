-- Rollback: 001_create_telegram_mini_app_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_telegram_mini_app_updated ON telegram_mini_app_records;
DROP FUNCTION IF EXISTS update_telegram_mini_app_timestamp();
DROP FUNCTION IF EXISTS cleanup_telegram_mini_app_idempotency();
DROP POLICY IF EXISTS telegram_mini_app_tenant_isolation ON telegram_mini_app_records;
DROP TABLE IF EXISTS telegram_mini_app_idempotency;
DROP TABLE IF EXISTS telegram_mini_app_audit;
DROP TABLE IF EXISTS telegram_mini_app_records;
COMMIT;
