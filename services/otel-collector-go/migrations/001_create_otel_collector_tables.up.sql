-- Migration: 001_create_otel_collector_tables
-- Service: otel-collector-go
-- Created: 2026-06-09
-- Description: Initial schema for otel-collector-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS otel_collector_records (
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
CREATE TABLE IF NOT EXISTS otel_collector_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES otel_collector_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS otel_collector_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otel_collector_tenant ON otel_collector_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_otel_collector_status ON otel_collector_records(status);
CREATE INDEX IF NOT EXISTS idx_otel_collector_type ON otel_collector_records(type);
CREATE INDEX IF NOT EXISTS idx_otel_collector_created ON otel_collector_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otel_collector_reference ON otel_collector_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otel_collector_audit_record ON otel_collector_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_otel_collector_audit_created ON otel_collector_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otel_collector_idempotency_expires ON otel_collector_idempotency(expires_at);

-- Row-level security
ALTER TABLE otel_collector_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY otel_collector_tenant_isolation ON otel_collector_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_otel_collector_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_otel_collector_updated
    BEFORE UPDATE ON otel_collector_records
    FOR EACH ROW EXECUTE FUNCTION update_otel_collector_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_otel_collector_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM otel_collector_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
