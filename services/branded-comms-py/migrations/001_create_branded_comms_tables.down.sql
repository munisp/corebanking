-- Rollback: 001_create_branded_comms_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_branded_comms_updated ON branded_comms_records;
DROP FUNCTION IF EXISTS update_branded_comms_timestamp();
DROP FUNCTION IF EXISTS cleanup_branded_comms_idempotency();
DROP POLICY IF EXISTS branded_comms_tenant_isolation ON branded_comms_records;
DROP TABLE IF EXISTS branded_comms_idempotency;
DROP TABLE IF EXISTS branded_comms_audit;
DROP TABLE IF EXISTS branded_comms_records;
COMMIT;
