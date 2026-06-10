-- Migration: 001_create_goaml_integration_tables
-- Service: goaml-integration-go
-- Created: 2026-06-09
-- Description: Initial schema for goaml-integration-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS goaml_integration_records (
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
CREATE TABLE IF NOT EXISTS goaml_integration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES goaml_integration_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS goaml_integration_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goaml_integration_tenant ON goaml_integration_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_status ON goaml_integration_records(status);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_type ON goaml_integration_records(type);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_created ON goaml_integration_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_reference ON goaml_integration_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goaml_integration_audit_record ON goaml_integration_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_audit_created ON goaml_integration_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goaml_integration_idempotency_expires ON goaml_integration_idempotency(expires_at);

-- Row-level security
ALTER TABLE goaml_integration_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY goaml_integration_tenant_isolation ON goaml_integration_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_goaml_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_goaml_integration_updated
    BEFORE UPDATE ON goaml_integration_records
    FOR EACH ROW EXECUTE FUNCTION update_goaml_integration_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_goaml_integration_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM goaml_integration_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
