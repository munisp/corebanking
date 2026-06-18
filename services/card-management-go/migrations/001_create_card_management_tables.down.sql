-- Rollback: 001_create_card_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_card_management_updated ON card_management_records;
DROP FUNCTION IF EXISTS update_card_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_card_management_idempotency();
DROP POLICY IF EXISTS card_management_tenant_isolation ON card_management_records;
DROP TABLE IF EXISTS card_management_idempotency;
DROP TABLE IF EXISTS card_management_audit;
DROP TABLE IF EXISTS card_management_records;
COMMIT;
