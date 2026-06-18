-- Rollback: 001_create_federated_learning_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_federated_learning_updated ON federated_learning_records;
DROP FUNCTION IF EXISTS update_federated_learning_timestamp();
DROP FUNCTION IF EXISTS cleanup_federated_learning_idempotency();
DROP POLICY IF EXISTS federated_learning_tenant_isolation ON federated_learning_records;
DROP TABLE IF EXISTS federated_learning_idempotency;
DROP TABLE IF EXISTS federated_learning_audit;
DROP TABLE IF EXISTS federated_learning_records;
COMMIT;
