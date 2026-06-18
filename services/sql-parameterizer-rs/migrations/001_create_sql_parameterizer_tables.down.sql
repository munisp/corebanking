-- Rollback: 001_create_sql_parameterizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sql_parameterizer_updated ON sql_parameterizer_records;
DROP FUNCTION IF EXISTS update_sql_parameterizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_sql_parameterizer_idempotency();
DROP POLICY IF EXISTS sql_parameterizer_tenant_isolation ON sql_parameterizer_records;
DROP TABLE IF EXISTS sql_parameterizer_idempotency;
DROP TABLE IF EXISTS sql_parameterizer_audit;
DROP TABLE IF EXISTS sql_parameterizer_records;
COMMIT;
