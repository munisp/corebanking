-- Rollback: 001_create_fx_rates_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fx_rates_engine_updated ON fx_rates_engine_records;
DROP FUNCTION IF EXISTS update_fx_rates_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_fx_rates_engine_idempotency();
DROP POLICY IF EXISTS fx_rates_engine_tenant_isolation ON fx_rates_engine_records;
DROP TABLE IF EXISTS fx_rates_engine_idempotency;
DROP TABLE IF EXISTS fx_rates_engine_audit;
DROP TABLE IF EXISTS fx_rates_engine_records;
COMMIT;
