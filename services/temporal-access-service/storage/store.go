package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"temporal-access-service/models"
)

// policyCacheTTL bounds how long a cached policy may be served from Redis
// before re-reading the Postgres authority (W13-RISK-19).
const policyCacheTTL = 5 * time.Minute

// Store composes the Redis store (grants/delegations: TTL'd, fail-closed on
// loss — acceptable) with the Postgres policy authority (W13-RISK-19).
//
// Policy semantics: Postgres is the system of record. Writes go to Postgres
// FIRST and any Postgres error is propagated (fail-closed — a policy write
// that is not durable must never succeed silently). Redis is a TTL'd
// read-through cache only; cache failures never fail the request once the
// authority write succeeded.
type Store struct {
	*RedisStore
	pg *PGPolicyStore
}

// NewStore wraps the Redis store with the Postgres policy authority.
// pg may be nil only when Postgres is not configured; every policy operation
// then fails closed with an explicit error.
func NewStore(redisStore *RedisStore, pg *PGPolicyStore) *Store {
	return &Store{RedisStore: redisStore, pg: pg}
}

// PolicyAuthorityConfigured reports whether the PG authority is available.
func (s *Store) PolicyAuthorityConfigured() bool { return s.pg != nil }

func (s *Store) requirePG() (*PGPolicyStore, error) {
	if s.pg == nil {
		return nil, fmt.Errorf("policy store unavailable: postgres not configured (DATABASE_URL); refusing to persist authorization policies to volatile redis only")
	}
	return s.pg, nil
}

// SavePolicy writes-through to the Postgres authority, then refreshes the
// Redis cache (best-effort, TTL'd).
func (s *Store) SavePolicy(ctx context.Context, policy *models.AccessPolicy) error {
	pg, err := s.requirePG()
	if err != nil {
		return err
	}
	if err := pg.SavePolicy(ctx, policy); err != nil {
		return err // fail-closed: no durable write, no success
	}

	// Best-effort cache refresh (authority already durable).
	if data, err := json.Marshal(policy); err == nil {
		key := fmt.Sprintf("policy:%s", policy.ID)
		s.client.Set(ctx, key, data, policyCacheTTL)
		tenantKey := fmt.Sprintf("tenant:%s:policies", policy.TenantID)
		s.client.SAdd(ctx, tenantKey, policy.ID)
		s.client.Expire(ctx, tenantKey, policyCacheTTL)
	}
	return nil
}

// GetPolicy reads from the Redis cache first, falling back to the Postgres
// authority (and re-caching on hit).
func (s *Store) GetPolicy(ctx context.Context, policyID string) (*models.AccessPolicy, error) {
	key := fmt.Sprintf("policy:%s", policyID)
	data, err := s.client.Get(ctx, key).Bytes()
	if err == nil {
		var policy models.AccessPolicy
		if err := json.Unmarshal(data, &policy); err == nil {
			return &policy, nil
		}
	} else if err != redis.Nil {
		// Cache read error: fall through to the authority rather than failing.
		_ = err
	}

	pg, perr := s.requirePG()
	if perr != nil {
		return nil, perr
	}
	policy, err := pg.GetPolicy(ctx, policyID)
	if err != nil {
		return nil, err
	}
	if data, err := json.Marshal(policy); err == nil {
		s.client.Set(ctx, key, data, policyCacheTTL)
	}
	return policy, nil
}

// DeletePolicy deletes from the Postgres authority first (fail-closed), then
// evicts the cache.
func (s *Store) DeletePolicy(ctx context.Context, policyID string) error {
	pg, err := s.requirePG()
	if err != nil {
		return err
	}
	if err := pg.DeletePolicy(ctx, policyID); err != nil {
		return err
	}

	key := fmt.Sprintf("policy:%s", policyID)
	s.client.Del(ctx, key)
	// Tenant index eviction is best-effort; unknown tenant id here is fine
	// because ListPoliciesByTenant reads from the authority.
	return nil
}

// ListPoliciesByTenant lists policies from the Postgres authority (never the
// cache — list results must reflect durable state).
func (s *Store) ListPoliciesByTenant(ctx context.Context, tenantID string) ([]*models.AccessPolicy, error) {
	pg, err := s.requirePG()
	if err != nil {
		return nil, err
	}
	return pg.ListPoliciesByTenant(ctx, tenantID)
}
