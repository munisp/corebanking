-- Rollback: 001_create_pos_terminal_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pos_terminal_updated ON pos_terminal_records;
DROP FUNCTION IF EXISTS update_pos_terminal_timestamp();
DROP FUNCTION IF EXISTS cleanup_pos_terminal_idempotency();
DROP POLICY IF EXISTS pos_terminal_tenant_isolation ON pos_terminal_records;
DROP TABLE IF EXISTS pos_terminal_idempotency;
DROP TABLE IF EXISTS pos_terminal_audit;
DROP TABLE IF EXISTS pos_terminal_records;
COMMIT;
