-- 006 (W13-RISK-3): deprecate the dead account_balances table created in
-- 002_business_logic_fixes.sql.
--
-- Verification finding: account_balances (account_id PK, balance_kobo,
-- version, tier) has NO writer anywhere in the tree (grep-verified: no
-- INSERT, no ORM entity mapping) and no live reader of its shape:
--   * chart-of-accounts-service reads gold.account_balances in the LAKEHOUSE
--     (external system, Dremio/gold dataset), not this PG table;
--   * the TigerBeetle Postgres-shadow balance state lives in the `accounts`
--     table (available_balance / tigerbeetle_account_id — see
--     server/lib/databasePersistence.ts CORE_TABLES); the reconciliation
--     endpoint (server/lib/tigerbeetleLedger.ts) queries that shape;
--   * the tb_to_pg sync job in tigerbeetlePostgresSync.ts is declarative
--     config metadata only (no executable consumer).
-- The table is therefore genuinely dead: balance authority is TigerBeetle,
-- with `accounts` as the PG shadow. Kept (not dropped) for safety; marked
-- DEPRECATED. Do not write new code against it.

COMMENT ON TABLE account_balances IS
    'DEPRECATED (W13-RISK-3): dead table — no writer and no live reader of '
    'this shape. Balance authority is TigerBeetle; the PG shadow is the '
    'accounts table (available_balance/tigerbeetle_account_id). Lakehouse '
    'balance reads use gold.account_balances (external dataset). Kept for '
    'backward compatibility only; do not write new rows here.';
