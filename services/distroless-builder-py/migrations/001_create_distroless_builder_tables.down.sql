-- Rollback: 001_create_distroless_builder_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_distroless_builder_updated ON distroless_builder_records;
DROP FUNCTION IF EXISTS update_distroless_builder_timestamp();
DROP FUNCTION IF EXISTS cleanup_distroless_builder_idempotency();
DROP POLICY IF EXISTS distroless_builder_tenant_isolation ON distroless_builder_records;
DROP TABLE IF EXISTS distroless_builder_idempotency;
DROP TABLE IF EXISTS distroless_builder_audit;
DROP TABLE IF EXISTS distroless_builder_records;
COMMIT;
