-- Rollback: 001_create_egress_controller_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_egress_controller_updated ON egress_controller_records;
DROP FUNCTION IF EXISTS update_egress_controller_timestamp();
DROP FUNCTION IF EXISTS cleanup_egress_controller_idempotency();
DROP POLICY IF EXISTS egress_controller_tenant_isolation ON egress_controller_records;
DROP TABLE IF EXISTS egress_controller_idempotency;
DROP TABLE IF EXISTS egress_controller_audit;
DROP TABLE IF EXISTS egress_controller_records;
COMMIT;
