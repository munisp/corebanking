-- Rollback: 001_create_pkce_auth_flow_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pkce_auth_flow_updated ON pkce_auth_flow_records;
DROP FUNCTION IF EXISTS update_pkce_auth_flow_timestamp();
DROP FUNCTION IF EXISTS cleanup_pkce_auth_flow_idempotency();
DROP POLICY IF EXISTS pkce_auth_flow_tenant_isolation ON pkce_auth_flow_records;
DROP TABLE IF EXISTS pkce_auth_flow_idempotency;
DROP TABLE IF EXISTS pkce_auth_flow_audit;
DROP TABLE IF EXISTS pkce_auth_flow_records;
COMMIT;
