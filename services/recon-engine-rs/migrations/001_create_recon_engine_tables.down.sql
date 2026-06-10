-- Rollback: 001_create_recon_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_recon_engine_updated ON recon_engine_records;
DROP FUNCTION IF EXISTS update_recon_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_recon_engine_idempotency();
DROP POLICY IF EXISTS recon_engine_tenant_isolation ON recon_engine_records;
DROP TABLE IF EXISTS recon_engine_idempotency;
DROP TABLE IF EXISTS recon_engine_audit;
DROP TABLE IF EXISTS recon_engine_records;
COMMIT;
