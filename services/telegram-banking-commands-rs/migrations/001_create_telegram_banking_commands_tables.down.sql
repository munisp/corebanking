-- Rollback: 001_create_telegram_banking_commands_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_telegram_banking_commands_updated ON telegram_banking_commands_records;
DROP FUNCTION IF EXISTS update_telegram_banking_commands_timestamp();
DROP FUNCTION IF EXISTS cleanup_telegram_banking_commands_idempotency();
DROP POLICY IF EXISTS telegram_banking_commands_tenant_isolation ON telegram_banking_commands_records;
DROP TABLE IF EXISTS telegram_banking_commands_idempotency;
DROP TABLE IF EXISTS telegram_banking_commands_audit;
DROP TABLE IF EXISTS telegram_banking_commands_records;
COMMIT;
