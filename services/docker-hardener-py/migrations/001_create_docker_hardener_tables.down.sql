-- Rollback: 001_create_docker_hardener_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_docker_hardener_updated ON docker_hardener_records;
DROP FUNCTION IF EXISTS update_docker_hardener_timestamp();
DROP FUNCTION IF EXISTS cleanup_docker_hardener_idempotency();
DROP POLICY IF EXISTS docker_hardener_tenant_isolation ON docker_hardener_records;
DROP TABLE IF EXISTS docker_hardener_idempotency;
DROP TABLE IF EXISTS docker_hardener_audit;
DROP TABLE IF EXISTS docker_hardener_records;
COMMIT;
