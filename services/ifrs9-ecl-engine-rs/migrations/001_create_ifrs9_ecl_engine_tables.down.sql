-- Rollback: 001_create_ifrs9_ecl_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ifrs9_ecl_engine_updated ON ifrs9_ecl_engine_records;
DROP FUNCTION IF EXISTS update_ifrs9_ecl_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_ifrs9_ecl_engine_idempotency();
DROP POLICY IF EXISTS ifrs9_ecl_engine_tenant_isolation ON ifrs9_ecl_engine_records;
DROP TABLE IF EXISTS ifrs9_ecl_engine_idempotency;
DROP TABLE IF EXISTS ifrs9_ecl_engine_audit;
DROP TABLE IF EXISTS ifrs9_ecl_engine_records;
COMMIT;
