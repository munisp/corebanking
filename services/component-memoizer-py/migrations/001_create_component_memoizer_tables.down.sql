-- Rollback: 001_create_component_memoizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_component_memoizer_updated ON component_memoizer_records;
DROP FUNCTION IF EXISTS update_component_memoizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_component_memoizer_idempotency();
DROP POLICY IF EXISTS component_memoizer_tenant_isolation ON component_memoizer_records;
DROP TABLE IF EXISTS component_memoizer_idempotency;
DROP TABLE IF EXISTS component_memoizer_audit;
DROP TABLE IF EXISTS component_memoizer_records;
COMMIT;
