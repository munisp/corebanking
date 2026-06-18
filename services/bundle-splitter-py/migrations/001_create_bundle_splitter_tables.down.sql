-- Rollback: 001_create_bundle_splitter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_bundle_splitter_updated ON bundle_splitter_records;
DROP FUNCTION IF EXISTS update_bundle_splitter_timestamp();
DROP FUNCTION IF EXISTS cleanup_bundle_splitter_idempotency();
DROP POLICY IF EXISTS bundle_splitter_tenant_isolation ON bundle_splitter_records;
DROP TABLE IF EXISTS bundle_splitter_idempotency;
DROP TABLE IF EXISTS bundle_splitter_audit;
DROP TABLE IF EXISTS bundle_splitter_records;
COMMIT;
