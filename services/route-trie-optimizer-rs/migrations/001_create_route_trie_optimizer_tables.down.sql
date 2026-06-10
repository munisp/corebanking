-- Rollback: 001_create_route_trie_optimizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_route_trie_optimizer_updated ON route_trie_optimizer_records;
DROP FUNCTION IF EXISTS update_route_trie_optimizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_route_trie_optimizer_idempotency();
DROP POLICY IF EXISTS route_trie_optimizer_tenant_isolation ON route_trie_optimizer_records;
DROP TABLE IF EXISTS route_trie_optimizer_idempotency;
DROP TABLE IF EXISTS route_trie_optimizer_audit;
DROP TABLE IF EXISTS route_trie_optimizer_records;
COMMIT;
