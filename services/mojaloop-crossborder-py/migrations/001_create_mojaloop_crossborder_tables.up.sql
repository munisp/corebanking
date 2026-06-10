-- Migration: 001_create_mojaloop_crossborder_tables
-- Service: mojaloop-crossborder-py
-- Created: 2026-06-09
-- Description: Initial schema for mojaloop-crossborder-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS mojaloop_crossborder_records (
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
CREATE TABLE IF NOT EXISTS mojaloop_crossborder_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES mojaloop_crossborder_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS mojaloop_crossborder_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_tenant ON mojaloop_crossborder_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_status ON mojaloop_crossborder_records(status);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_type ON mojaloop_crossborder_records(type);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_created ON mojaloop_crossborder_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_reference ON mojaloop_crossborder_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_audit_record ON mojaloop_crossborder_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_audit_created ON mojaloop_crossborder_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mojaloop_crossborder_idempotency_expires ON mojaloop_crossborder_idempotency(expires_at);

-- Row-level security
ALTER TABLE mojaloop_crossborder_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY mojaloop_crossborder_tenant_isolation ON mojaloop_crossborder_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_mojaloop_crossborder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mojaloop_crossborder_updated
    BEFORE UPDATE ON mojaloop_crossborder_records
    FOR EACH ROW EXECUTE FUNCTION update_mojaloop_crossborder_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_mojaloop_crossborder_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM mojaloop_crossborder_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
