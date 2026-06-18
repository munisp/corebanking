-- Rollback: 001_create_mtls_mesh_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mtls_mesh_updated ON mtls_mesh_records;
DROP FUNCTION IF EXISTS update_mtls_mesh_timestamp();
DROP FUNCTION IF EXISTS cleanup_mtls_mesh_idempotency();
DROP POLICY IF EXISTS mtls_mesh_tenant_isolation ON mtls_mesh_records;
DROP TABLE IF EXISTS mtls_mesh_idempotency;
DROP TABLE IF EXISTS mtls_mesh_audit;
DROP TABLE IF EXISTS mtls_mesh_records;
COMMIT;
