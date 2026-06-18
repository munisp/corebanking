-- Rollback: 001_create_nibss_nip_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nibss_nip_engine_updated ON nibss_nip_engine_records;
DROP FUNCTION IF EXISTS update_nibss_nip_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_nibss_nip_engine_idempotency();
DROP POLICY IF EXISTS nibss_nip_engine_tenant_isolation ON nibss_nip_engine_records;
DROP TABLE IF EXISTS nibss_nip_engine_idempotency;
DROP TABLE IF EXISTS nibss_nip_engine_audit;
DROP TABLE IF EXISTS nibss_nip_engine_records;
COMMIT;
