-- Rollback: 001_create_wire_transfer_monitor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_wire_transfer_monitor_updated ON wire_transfer_monitor_records;
DROP FUNCTION IF EXISTS update_wire_transfer_monitor_timestamp();
DROP FUNCTION IF EXISTS cleanup_wire_transfer_monitor_idempotency();
DROP POLICY IF EXISTS wire_transfer_monitor_tenant_isolation ON wire_transfer_monitor_records;
DROP TABLE IF EXISTS wire_transfer_monitor_idempotency;
DROP TABLE IF EXISTS wire_transfer_monitor_audit;
DROP TABLE IF EXISTS wire_transfer_monitor_records;
COMMIT;
