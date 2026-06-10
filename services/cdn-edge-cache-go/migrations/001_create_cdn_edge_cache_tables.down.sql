-- Rollback: 001_create_cdn_edge_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cdn_edge_cache_updated ON cdn_edge_cache_records;
DROP FUNCTION IF EXISTS update_cdn_edge_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_cdn_edge_cache_idempotency();
DROP POLICY IF EXISTS cdn_edge_cache_tenant_isolation ON cdn_edge_cache_records;
DROP TABLE IF EXISTS cdn_edge_cache_idempotency;
DROP TABLE IF EXISTS cdn_edge_cache_audit;
DROP TABLE IF EXISTS cdn_edge_cache_records;
COMMIT;
