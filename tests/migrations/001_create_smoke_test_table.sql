CREATE TABLE IF NOT EXISTS smoke_test (
    id           SERIAL PRIMARY KEY,
    service_name VARCHAR(255)  NOT NULL,
    status       VARCHAR(50)   NOT NULL,  -- passed | failed | skipped
    error_detail TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smoke_test_service_name ON smoke_test (service_name);
CREATE INDEX IF NOT EXISTS idx_smoke_test_created_at   ON smoke_test (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smoke_test_status       ON smoke_test (status);
