-- MN-17 (S17): Nostro reconciliation break workflow — durable stores.
-- Expand-migrate only: additive tables/columns with backfill; nothing is
-- dropped or destructively altered. Idempotent (IF NOT EXISTS / guarded
-- backfill), applied by reconciliation-engine-rs at startup.

-- Suspense items: discrepancies park here until resolved by recon-engine-rs.
CREATE TABLE IF NOT EXISTS suspense_items (
    id          TEXT PRIMARY KEY,        -- deterministic: SUS-{recon_id}-{account_id}
    gl_code     TEXT NOT NULL,
    gl_name     TEXT NOT NULL,
    amount_kobo BIGINT NOT NULL,         -- integer minor units; never float money
    source      TEXT NOT NULL DEFAULT 'settlement-recon',
    reason      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open',   -- open | resolved
    assigned_to TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Recon breaks: one row per (recon run, account) discrepancy.
CREATE TABLE IF NOT EXISTS recon_breaks (
    id                  TEXT PRIMARY KEY,  -- deterministic: BRK-{recon_id}-{account_id}
    recon_id            TEXT NOT NULL,
    business_date       DATE NOT NULL,
    account_id          TEXT NOT NULL,
    bank_name           TEXT,
    gl_code             TEXT,
    book_balance_kobo   BIGINT NOT NULL,
    statement_balance_kobo BIGINT NOT NULL,
    uncleared_credits_kobo BIGINT NOT NULL DEFAULT 0,
    uncleared_debits_kobo  BIGINT NOT NULL DEFAULT 0,
    difference_kobo     BIGINT NOT NULL,   -- book - (statement - uc + ud)
    status              TEXT NOT NULL DEFAULT 'open',  -- open | resolved
    suspense_item_id    TEXT REFERENCES suspense_items(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recon_breaks_recon ON recon_breaks(recon_id);
CREATE INDEX IF NOT EXISTS idx_recon_breaks_status ON recon_breaks(status);

-- Integer-kobo mirrors of the float balance columns (expand-migrate with
-- backfill). The engine reads ONLY the _kobo columns after this migration.
ALTER TABLE nostro_positions ADD COLUMN IF NOT EXISTS book_balance_kobo BIGINT;
ALTER TABLE nostro_positions ADD COLUMN IF NOT EXISTS statement_balance_kobo BIGINT;
ALTER TABLE nostro_positions ADD COLUMN IF NOT EXISTS uncleared_credits_kobo BIGINT;
ALTER TABLE nostro_positions ADD COLUMN IF NOT EXISTS uncleared_debits_kobo BIGINT;

UPDATE nostro_positions SET book_balance_kobo = round(book_balance * 100)::bigint
    WHERE book_balance_kobo IS NULL AND book_balance IS NOT NULL;
UPDATE nostro_positions SET statement_balance_kobo = round(statement_balance * 100)::bigint
    WHERE statement_balance_kobo IS NULL AND statement_balance IS NOT NULL;
UPDATE nostro_positions SET uncleared_credits_kobo = round(uncleared_credits * 100)::bigint
    WHERE uncleared_credits_kobo IS NULL AND uncleared_credits IS NOT NULL;
UPDATE nostro_positions SET uncleared_debits_kobo = round(uncleared_debits * 100)::bigint
    WHERE uncleared_debits_kobo IS NULL AND uncleared_debits IS NOT NULL;
