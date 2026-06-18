-- Migration: 001_create_unit_test_runner_tables
-- Service: unit-test-runner-py
-- Created: 2026-06-09
-- Description: Initial schema for unit-test-runner-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS unit_test_runner_records (
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
CREATE TABLE IF NOT EXISTS unit_test_runner_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES unit_test_runner_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS unit_test_runner_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_tenant ON unit_test_runner_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_status ON unit_test_runner_records(status);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_type ON unit_test_runner_records(type);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_created ON unit_test_runner_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_reference ON unit_test_runner_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_audit_record ON unit_test_runner_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_audit_created ON unit_test_runner_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_test_runner_idempotency_expires ON unit_test_runner_idempotency(expires_at);

-- Row-level security
ALTER TABLE unit_test_runner_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY unit_test_runner_tenant_isolation ON unit_test_runner_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_unit_test_runner_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unit_test_runner_updated
    BEFORE UPDATE ON unit_test_runner_records
    FOR EACH ROW EXECUTE FUNCTION update_unit_test_runner_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_unit_test_runner_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM unit_test_runner_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
