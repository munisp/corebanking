-- Rollback: 001_create_billing_event_processor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_event_processor_updated ON billing_event_processor_records;
DROP FUNCTION IF EXISTS update_billing_event_processor_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_event_processor_idempotency();
DROP POLICY IF EXISTS billing_event_processor_tenant_isolation ON billing_event_processor_records;
DROP TABLE IF EXISTS billing_event_processor_idempotency;
DROP TABLE IF EXISTS billing_event_processor_audit;
DROP TABLE IF EXISTS billing_event_processor_records;
COMMIT;
