-- V003: integer-kobo projection, RLS, audit table, idempotency table
-- Previous: V002 migrated amount VARCHAR → NUMERIC(20,2).
--
-- Reconciliation notes (W7-C-18, applied when this migration was first wired
-- into the startup runner):
--   * The live table is "transaction" (quoted; see models/transaction.py
--     __tablename__), not "transactions" — the original script referenced a
--     table that does not exist and could never have applied.
--   * The SQLAlchemy model owns `amount` as NUMERIC(20,2); dropping it (as
--     the original script did) would break every write path. Instead
--     `amount_kobo` is a STORED generated column: the exact integer
--     minor-unit (kobo) value is always consistent with `amount` and can
--     never drift, with zero application change.

-- ─── 1. Integer-kobo projection of the NUMERIC amount ────────────────────────
ALTER TABLE "transaction"
    ADD COLUMN IF NOT EXISTS amount_kobo BIGINT
    GENERATED ALWAYS AS ((ROUND(amount * 100))::BIGINT) STORED;

-- ─── 2. Optimistic locking version column ─────────────────────────────────────
ALTER TABLE "transaction"
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ─── 3. Soft-delete column (if absent) ────────────────────────────────────────
ALTER TABLE "transaction"
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ─── 4. Row-Level Security ────────────────────────────────────────────────────
-- The service binds the verified tenant to the session via
-- set_config('app.tenant_id', ...) on every checkout (database/setup.py);
-- when no tenant is bound the policy compares against '' and hides all rows
-- (fail closed).
ALTER TABLE "transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'transaction' AND policyname = 'txn_tenant_isolation'
    ) THEN
        CREATE POLICY txn_tenant_isolation ON "transaction"
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
CREATE INDEX IF NOT EXISTS idx_txn_amount_kobo        ON "transaction"(amount_kobo);
CREATE INDEX IF NOT EXISTS idx_txn_tenant_amount_kobo ON "transaction"(tenant_id, amount_kobo);
