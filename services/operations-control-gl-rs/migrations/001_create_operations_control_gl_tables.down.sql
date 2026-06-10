-- Rollback: 001_create_operations_control_gl_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_operations_control_gl_updated ON operations_control_gl_records;
DROP FUNCTION IF EXISTS update_operations_control_gl_timestamp();
DROP FUNCTION IF EXISTS cleanup_operations_control_gl_idempotency();
DROP POLICY IF EXISTS operations_control_gl_tenant_isolation ON operations_control_gl_records;
DROP TABLE IF EXISTS operations_control_gl_idempotency;
DROP TABLE IF EXISTS operations_control_gl_audit;
DROP TABLE IF EXISTS operations_control_gl_records;
COMMIT;
