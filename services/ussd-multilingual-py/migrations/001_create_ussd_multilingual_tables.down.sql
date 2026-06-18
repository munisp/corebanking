-- Rollback: 001_create_ussd_multilingual_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ussd_multilingual_updated ON ussd_multilingual_records;
DROP FUNCTION IF EXISTS update_ussd_multilingual_timestamp();
DROP FUNCTION IF EXISTS cleanup_ussd_multilingual_idempotency();
DROP POLICY IF EXISTS ussd_multilingual_tenant_isolation ON ussd_multilingual_records;
DROP TABLE IF EXISTS ussd_multilingual_idempotency;
DROP TABLE IF EXISTS ussd_multilingual_audit;
DROP TABLE IF EXISTS ussd_multilingual_records;
COMMIT;
