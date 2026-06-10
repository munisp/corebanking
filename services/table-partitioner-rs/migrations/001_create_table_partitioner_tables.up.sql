-- Migration: 001_create_table_partitioner_tables
-- Service: table-partitioner-rs
-- Created: 2026-06-09
-- Description: Initial schema for table-partitioner-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS table_partitioner_records (
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
CREATE TABLE IF NOT EXISTS table_partitioner_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES table_partitioner_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS table_partitioner_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_partitioner_tenant ON table_partitioner_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_status ON table_partitioner_records(status);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_type ON table_partitioner_records(type);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_created ON table_partitioner_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_reference ON table_partitioner_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_partitioner_audit_record ON table_partitioner_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_audit_created ON table_partitioner_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_partitioner_idempotency_expires ON table_partitioner_idempotency(expires_at);

-- Row-level security
ALTER TABLE table_partitioner_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY table_partitioner_tenant_isolation ON table_partitioner_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_table_partitioner_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_table_partitioner_updated
    BEFORE UPDATE ON table_partitioner_records
    FOR EACH ROW EXECUTE FUNCTION update_table_partitioner_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_table_partitioner_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM table_partitioner_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
