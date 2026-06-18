-- Migration: 001_create_apm_sentry_tables
-- Service: apm-sentry-py
-- Created: 2026-06-09
-- Description: Initial schema for apm-sentry-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS apm_sentry_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'primary',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    amount_kobo BIGINT DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(128) UNIQUE,
    created_by VARCHAR(128),
    updated_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS apm_sentry_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES apm_sentry_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS apm_sentry_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apm_sentry_tenant ON apm_sentry_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_status ON apm_sentry_records(status);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_type ON apm_sentry_records(type);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_created ON apm_sentry_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_reference ON apm_sentry_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apm_sentry_audit_record ON apm_sentry_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_audit_created ON apm_sentry_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apm_sentry_idempotency_expires ON apm_sentry_idempotency(expires_at);

-- Row-level security
ALTER TABLE apm_sentry_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY apm_sentry_tenant_isolation ON apm_sentry_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_apm_sentry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apm_sentry_updated
    BEFORE UPDATE ON apm_sentry_records
    FOR EACH ROW EXECUTE FUNCTION update_apm_sentry_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_apm_sentry_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM apm_sentry_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
