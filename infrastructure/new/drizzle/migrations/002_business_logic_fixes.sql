-- 002: Business logic quality fixes
-- Adds: immutable audit trail, versioned balance locking, idempotency store

-- ─── Immutable Audit Trail ──────────────────────────────────────────────────
-- Append-only table. Application MUST NOT issue DELETE or UPDATE on this table.
CREATE TABLE IF NOT EXISTS audit_trail (
    id              TEXT PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    service         TEXT NOT NULL,
    operation       TEXT NOT NULL,
    actor_id        TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    entity_type     TEXT NOT NULL DEFAULT '',
    old_state       TEXT DEFAULT '',
    new_state       TEXT DEFAULT '',
    ip_address      TEXT DEFAULT '',
    checksum        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NOTE: audit_trail is created by 001_initial_schema.sql with a different
-- column set (resource_id/resource_type/created_at), so the entity_id/service/
-- timestamp indexes below cannot be created here. They are created in
-- 004_reconcile_audit_trail.sql after the missing columns are added.

-- Prevent UPDATE/DELETE via a rule (PostgreSQL enforcement of immutability)
CREATE OR REPLACE RULE no_update_audit AS ON UPDATE TO audit_trail DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS ON DELETE TO audit_trail DO INSTEAD NOTHING;

-- ─── Account Balances with Optimistic Locking ───────────────────────────────
-- Version field enables SELECT FOR UPDATE + optimistic lock checks.
CREATE TABLE IF NOT EXISTS account_balances (
    account_id      TEXT PRIMARY KEY,
    balance_kobo    BIGINT NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'NGN',
    version         BIGINT NOT NULL DEFAULT 1,
    tier            TEXT NOT NULL DEFAULT 'tier1',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_balances_status ON account_balances (status);

-- ─── Idempotency Store ──────────────────────────────────────────────────────
-- Persists idempotency keys to prevent duplicate financial operations.
CREATE TABLE IF NOT EXISTS idempotency_store (
    idempotency_key TEXT PRIMARY KEY,
    service         TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    status_code     INTEGER NOT NULL,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_store (expires_at);

-- ─── Maker-Checker Requests ─────────────────────────────────────────────────
-- Tracks dual-authorization requests per CBN guidelines.
CREATE TABLE IF NOT EXISTS maker_checker_requests (
    request_id      TEXT PRIMARY KEY,
    operation       TEXT NOT NULL,
    maker_id        TEXT NOT NULL,
    checker_id      TEXT,
    amount_kobo     BIGINT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending_approval',
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ,
    decision_notes  TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_maker_checker_status ON maker_checker_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maker_checker_maker ON maker_checker_requests (maker_id, status);
