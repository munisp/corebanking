package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	"temporal-access-service/models"
)

// PGPolicyStore is the Postgres authority for access policies (W13-RISK-19).
//
// Authorization policies were previously persisted ONLY to Redis with no TTL
// (Set ttl=0) — a Redis restart or eviction wiped access policies fleet-wide.
// Postgres is now the system of record; Redis serves only as a TTL'd cache
// (see store.go). Grants remain Redis-only with TTL/fail-closed semantics,
// which is acceptable by design.
type PGPolicyStore struct {
	db *sql.DB
}

// NewPGPolicyStore opens the Postgres policy store and ensures the schema.
func NewPGPolicyStore(databaseURL string) (*PGPolicyStore, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	store := &PGPolicyStore{db: db}
	if err := store.EnsureSchema(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ensure policy schema: %w", err)
	}
	return store, nil
}

// EnsureSchema creates the access_policies authority table (idempotent DDL —
// this service's DDL mechanism is ensure-on-boot, matching fleet Go idiom).
func (s *PGPolicyStore) EnsureSchema(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS access_policies (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    data        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_policies_tenant ON access_policies (tenant_id);
`)
	if err != nil {
		return fmt.Errorf("create access_policies table: %w", err)
	}
	return nil
}

// Close closes the underlying pool.
func (s *PGPolicyStore) Close() error { return s.db.Close() }

// SavePolicy upserts a policy into the Postgres authority.
func (s *PGPolicyStore) SavePolicy(ctx context.Context, policy *models.AccessPolicy) error {
	data, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("marshal policy: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `
INSERT INTO access_policies (id, tenant_id, data, updated_at)
VALUES ($1, $2, $3::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, data = EXCLUDED.data, updated_at = NOW()
`, policy.ID, policy.TenantID, string(data))
	if err != nil {
		return fmt.Errorf("save policy (pg authority): %w", err)
	}
	return nil
}

// GetPolicy loads a policy from the Postgres authority. Returns
// ("", nil-not-found) semantics via an error containing "not found".
func (s *PGPolicyStore) GetPolicy(ctx context.Context, policyID string) (*models.AccessPolicy, error) {
	var data []byte
	err := s.db.QueryRowContext(ctx,
		`SELECT data FROM access_policies WHERE id = $1`, policyID).Scan(&data)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("policy not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get policy (pg authority): %w", err)
	}
	var policy models.AccessPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("unmarshal policy: %w", err)
	}
	return &policy, nil
}

// DeletePolicy removes a policy from the Postgres authority.
func (s *PGPolicyStore) DeletePolicy(ctx context.Context, policyID string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM access_policies WHERE id = $1`, policyID)
	if err != nil {
		return fmt.Errorf("delete policy (pg authority): %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("policy not found")
	}
	return nil
}

// ListPoliciesByTenant lists all policies for a tenant from the authority.
func (s *PGPolicyStore) ListPoliciesByTenant(ctx context.Context, tenantID string) ([]*models.AccessPolicy, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT data FROM access_policies WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list policies (pg authority): %w", err)
	}
	defer rows.Close()

	policies := make([]*models.AccessPolicy, 0)
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&data); err != nil {
			return nil, fmt.Errorf("scan policy: %w", err)
		}
		var policy models.AccessPolicy
		if err := json.Unmarshal(data, &policy); err != nil {
			return nil, fmt.Errorf("unmarshal policy: %w", err)
		}
		policies = append(policies, &policy)
	}
	return policies, rows.Err()
}
