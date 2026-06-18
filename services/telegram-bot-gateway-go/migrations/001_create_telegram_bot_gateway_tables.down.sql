-- Rollback: 001_create_telegram_bot_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_telegram_bot_gateway_updated ON telegram_bot_gateway_records;
DROP FUNCTION IF EXISTS update_telegram_bot_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_telegram_bot_gateway_idempotency();
DROP POLICY IF EXISTS telegram_bot_gateway_tenant_isolation ON telegram_bot_gateway_records;
DROP TABLE IF EXISTS telegram_bot_gateway_idempotency;
DROP TABLE IF EXISTS telegram_bot_gateway_audit;
DROP TABLE IF EXISTS telegram_bot_gateway_records;
COMMIT;
