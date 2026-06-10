-- Rollback: 001_create_csp_nonce_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_csp_nonce_engine_updated ON csp_nonce_engine_records;
DROP FUNCTION IF EXISTS update_csp_nonce_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_csp_nonce_engine_idempotency();
DROP POLICY IF EXISTS csp_nonce_engine_tenant_isolation ON csp_nonce_engine_records;
DROP TABLE IF EXISTS csp_nonce_engine_idempotency;
DROP TABLE IF EXISTS csp_nonce_engine_audit;
DROP TABLE IF EXISTS csp_nonce_engine_records;
COMMIT;
