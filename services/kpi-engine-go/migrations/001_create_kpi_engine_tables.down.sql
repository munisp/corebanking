-- Rollback: 001_create_kpi_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kpi_engine_updated ON kpi_engine_records;
DROP FUNCTION IF EXISTS update_kpi_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_kpi_engine_idempotency();
DROP POLICY IF EXISTS kpi_engine_tenant_isolation ON kpi_engine_records;
DROP TABLE IF EXISTS kpi_engine_idempotency;
DROP TABLE IF EXISTS kpi_engine_audit;
DROP TABLE IF EXISTS kpi_engine_records;
COMMIT;
