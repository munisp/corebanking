-- V003: NUMERIC(20,2) → BIGINT kobo, RLS, audit table, idempotency table
-- Previous: V002 migrated amount VARCHAR → NUMERIC(20,2).
-- This migration converts to integer kobo (×100) — the canonical monetary type.

-- ─── 1. Convert amount column: NUMERIC(20,2) → BIGINT kobo ────────────────────
-- Multiply by 100 and round to nearest kobo before casting.
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;

UPDATE transactions
    SET amount_kobo = ROUND(amount * 100)::BIGINT
    WHERE amount_kobo IS NULL;

ALTER TABLE transactions
    ALTER COLUMN amount_kobo SET NOT NULL,
    ALTER COLUMN amount_kobo SET DEFAULT 0;

-- Drop the old NUMERIC column once backfill is verified.
ALTER TABLE transactions DROP COLUMN IF EXISTS amount;

-- ─── 2. Optimistic locking version column ─────────────────────────────────────
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ─── 3. Soft-delete column (if absent) ────────────────────────────────────────
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── 4. Row-Level Security ────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'transactions' AND policyname = 'txn_tenant_isolation'
    ) THEN
        CREATE POLICY txn_tenant_isolation ON transactions
            USING (tenant_id = current_setting('app.tenant_id', true));
    END IF;
END
$$;

-- ─── 5. Idempotency table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_idempotency (
    idempotency_key TEXT        NOT NULL,
    tenant_id       TEXT        NOT NULL,
    transaction_id  TEXT        NOT NULL,
    response_body   JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    PRIMARY KEY (tenant_id, idempotency_key)
);

ALTER TABLE transaction_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_idempotency FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'transaction_idempotency' AND policyname = 'txn_idempotency_tenant'
    ) THEN
        CREATE POLICY txn_idempotency_tenant ON transaction_idempotency
            USING (tenant_id = current_setting('app.tenant_id', true));
    END IF;
END
$$;

-- ─── 6. Audit table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_audit (
    id               BIGSERIAL   PRIMARY KEY,
    transaction_id   TEXT        NOT NULL,
    tenant_id        TEXT        NOT NULL,
    action           TEXT        NOT NULL,        -- created, reversed, updated
    old_amount_kobo  BIGINT,
    new_amount_kobo  BIGINT,
    old_status       TEXT,
    new_status       TEXT,
    changed_by       TEXT,
    changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata         JSONB       NOT NULL DEFAULT '{}'
);

ALTER TABLE transaction_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_audit FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'transaction_audit' AND policyname = 'txn_audit_tenant'
    ) THEN
        CREATE POLICY txn_audit_tenant ON transaction_audit
            USING (tenant_id = current_setting('app.tenant_id', true));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_txn_audit_txn    ON transaction_audit(transaction_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_audit_tenant ON transaction_audit(tenant_id, changed_at DESC);

-- ─── 7. Performance indexes on amount_kobo ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_amount_kobo        ON transactions(amount_kobo);
CREATE INDEX IF NOT EXISTS idx_txn_tenant_amount_kobo ON transactions(tenant_id, amount_kobo);
