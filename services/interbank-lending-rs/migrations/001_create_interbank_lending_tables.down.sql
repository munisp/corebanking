-- Rollback: 001_create_interbank_lending_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_interbank_lending_updated ON interbank_lending_records;
DROP FUNCTION IF EXISTS update_interbank_lending_timestamp();
DROP FUNCTION IF EXISTS cleanup_interbank_lending_idempotency();
DROP POLICY IF EXISTS interbank_lending_tenant_isolation ON interbank_lending_records;
DROP TABLE IF EXISTS interbank_lending_idempotency;
DROP TABLE IF EXISTS interbank_lending_audit;
DROP TABLE IF EXISTS interbank_lending_records;
COMMIT;
