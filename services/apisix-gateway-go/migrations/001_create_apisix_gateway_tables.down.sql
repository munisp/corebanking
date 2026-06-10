-- Rollback: 001_create_apisix_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_apisix_gateway_updated ON apisix_gateway_records;
DROP FUNCTION IF EXISTS update_apisix_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_apisix_gateway_idempotency();
DROP POLICY IF EXISTS apisix_gateway_tenant_isolation ON apisix_gateway_records;
DROP TABLE IF EXISTS apisix_gateway_idempotency;
DROP TABLE IF EXISTS apisix_gateway_audit;
DROP TABLE IF EXISTS apisix_gateway_records;
COMMIT;
