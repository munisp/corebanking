-- Rollback: 001_create_bvn_nin_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_bvn_nin_verification_updated ON bvn_nin_verification_records;
DROP FUNCTION IF EXISTS update_bvn_nin_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_bvn_nin_verification_idempotency();
DROP POLICY IF EXISTS bvn_nin_verification_tenant_isolation ON bvn_nin_verification_records;
DROP TABLE IF EXISTS bvn_nin_verification_idempotency;
DROP TABLE IF EXISTS bvn_nin_verification_audit;
DROP TABLE IF EXISTS bvn_nin_verification_records;
COMMIT;
