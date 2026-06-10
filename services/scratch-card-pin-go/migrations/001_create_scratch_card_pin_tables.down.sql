-- Rollback: 001_create_scratch_card_pin_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_scratch_card_pin_updated ON scratch_card_pin_records;
DROP FUNCTION IF EXISTS update_scratch_card_pin_timestamp();
DROP FUNCTION IF EXISTS cleanup_scratch_card_pin_idempotency();
DROP POLICY IF EXISTS scratch_card_pin_tenant_isolation ON scratch_card_pin_records;
DROP TABLE IF EXISTS scratch_card_pin_idempotency;
DROP TABLE IF EXISTS scratch_card_pin_audit;
DROP TABLE IF EXISTS scratch_card_pin_records;
COMMIT;
