-- Rollback: 001_create_materialized_view_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_materialized_view_engine_updated ON materialized_view_engine_records;
DROP FUNCTION IF EXISTS update_materialized_view_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_materialized_view_engine_idempotency();
DROP POLICY IF EXISTS materialized_view_engine_tenant_isolation ON materialized_view_engine_records;
DROP TABLE IF EXISTS materialized_view_engine_idempotency;
DROP TABLE IF EXISTS materialized_view_engine_audit;
DROP TABLE IF EXISTS materialized_view_engine_records;
COMMIT;
