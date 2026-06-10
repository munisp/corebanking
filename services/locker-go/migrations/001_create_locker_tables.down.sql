-- Rollback: 001_create_locker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_locker_updated ON locker_records;
DROP FUNCTION IF EXISTS update_locker_timestamp();
DROP FUNCTION IF EXISTS cleanup_locker_idempotency();
DROP POLICY IF EXISTS locker_tenant_isolation ON locker_records;
DROP TABLE IF EXISTS locker_idempotency;
DROP TABLE IF EXISTS locker_audit;
DROP TABLE IF EXISTS locker_records;
COMMIT;
