-- Rollback: 001_create_identity_channels_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_identity_channels_updated ON identity_channels_records;
DROP FUNCTION IF EXISTS update_identity_channels_timestamp();
DROP FUNCTION IF EXISTS cleanup_identity_channels_idempotency();
DROP POLICY IF EXISTS identity_channels_tenant_isolation ON identity_channels_records;
DROP TABLE IF EXISTS identity_channels_idempotency;
DROP TABLE IF EXISTS identity_channels_audit;
DROP TABLE IF EXISTS identity_channels_records;
COMMIT;
