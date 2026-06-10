-- Rollback: 001_create_postgres_query_optimizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_postgres_query_optimizer_updated ON postgres_query_optimizer_records;
DROP FUNCTION IF EXISTS update_postgres_query_optimizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_postgres_query_optimizer_idempotency();
DROP POLICY IF EXISTS postgres_query_optimizer_tenant_isolation ON postgres_query_optimizer_records;
DROP TABLE IF EXISTS postgres_query_optimizer_idempotency;
DROP TABLE IF EXISTS postgres_query_optimizer_audit;
DROP TABLE IF EXISTS postgres_query_optimizer_records;
COMMIT;
