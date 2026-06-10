-- Rollback: 001_create_grid_token_card_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_grid_token_card_updated ON grid_token_card_records;
DROP FUNCTION IF EXISTS update_grid_token_card_timestamp();
DROP FUNCTION IF EXISTS cleanup_grid_token_card_idempotency();
DROP POLICY IF EXISTS grid_token_card_tenant_isolation ON grid_token_card_records;
DROP TABLE IF EXISTS grid_token_card_idempotency;
DROP TABLE IF EXISTS grid_token_card_audit;
DROP TABLE IF EXISTS grid_token_card_records;
COMMIT;
