-- Rollback: 001_create_kyc_event_consumer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_event_consumer_updated ON kyc_event_consumer_records;
DROP FUNCTION IF EXISTS update_kyc_event_consumer_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_event_consumer_idempotency();
DROP POLICY IF EXISTS kyc_event_consumer_tenant_isolation ON kyc_event_consumer_records;
DROP TABLE IF EXISTS kyc_event_consumer_idempotency;
DROP TABLE IF EXISTS kyc_event_consumer_audit;
DROP TABLE IF EXISTS kyc_event_consumer_records;
COMMIT;
