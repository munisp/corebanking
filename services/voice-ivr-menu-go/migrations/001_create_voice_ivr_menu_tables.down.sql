-- Rollback: 001_create_voice_ivr_menu_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_ivr_menu_updated ON voice_ivr_menu_records;
DROP FUNCTION IF EXISTS update_voice_ivr_menu_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_ivr_menu_idempotency();
DROP POLICY IF EXISTS voice_ivr_menu_tenant_isolation ON voice_ivr_menu_records;
DROP TABLE IF EXISTS voice_ivr_menu_idempotency;
DROP TABLE IF EXISTS voice_ivr_menu_audit;
DROP TABLE IF EXISTS voice_ivr_menu_records;
COMMIT;
