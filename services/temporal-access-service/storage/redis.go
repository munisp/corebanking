package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"temporal-access-service/models"
)

// RedisStore handles Redis storage operations
type RedisStore struct {
	client *redis.Client
}

// NewRedisStore creates a new Redis store
func NewRedisStore(addr, password string) (*RedisStore, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
		MaxRetries:   3,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &RedisStore{client: client}, nil
}

// Close closes the Redis connection
func (s *RedisStore) Close() error {
	return s.client.Close()
}

// Grant operations

// SaveGrant saves a temporal grant to Redis
func (s *RedisStore) SaveGrant(ctx context.Context, grant *models.TemporalGrant) error {
	data, err := json.Marshal(grant)
	if err != nil {
		return fmt.Errorf("marshal grant: %w", err)
	}

	// Calculate TTL
	ttl := time.Until(grant.ExpiresAt)
	if ttl <= 0 {
		return fmt.Errorf("grant already expired")
	}

	// Save grant with TTL
	key := fmt.Sprintf("grant:%s", grant.ID)
	if err := s.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("save grant: %w", err)
	}

	// Add to tenant index with TTL
	tenantKey := fmt.Sprintf("tenant:%s:grants", grant.TenantID)
	if err := s.client.SAdd(ctx, tenantKey, grant.ID).Err(); err != nil {
		return fmt.Errorf("add to tenant index: %w", err)
	}
	// Set expiry on index set to match grant TTL (add buffer for cleanup)
	s.client.Expire(ctx, tenantKey, ttl+24*time.Hour)

	// Add to subject index with TTL
	subjectKey := fmt.Sprintf("subject:%s:%s:grants", grant.TenantID, grant.SubjectID)
	if err := s.client.SAdd(ctx, subjectKey, grant.ID).Err(); err != nil {
		return fmt.Errorf("add to subject index: %w", err)
	}
	// Set expiry on index set to match grant TTL (add buffer for cleanup)
	s.client.Expire(ctx, subjectKey, ttl+24*time.Hour)

	// Add to resource index with TTL
	resourceKey := fmt.Sprintf("resource:%s:%s:%s:grants", grant.TenantID, grant.ResourceType, grant.ResourceID)
	if err := s.client.SAdd(ctx, resourceKey, grant.ID).Err(); err != nil {
		return fmt.Errorf("add to resource index: %w", err)
	}
	// Set expiry on index set to match grant TTL (add buffer for cleanup)
	s.client.Expire(ctx, resourceKey, ttl+24*time.Hour)

	return nil
}

// GetGrant retrieves a grant by ID
func (s *RedisStore) GetGrant(ctx context.Context, grantID string) (*models.TemporalGrant, error) {
	key := fmt.Sprintf("grant:%s", grantID)
	data, err := s.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, fmt.Errorf("grant not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get grant: %w", err)
	}

	var grant models.TemporalGrant
	if err := json.Unmarshal(data, &grant); err != nil {
		return nil, fmt.Errorf("unmarshal grant: %w", err)
	}

	return &grant, nil
}

// DeleteGrant deletes a grant
func (s *RedisStore) DeleteGrant(ctx context.Context, grantID string) error {
	// Get grant first to clean up indexes
	grant, err := s.GetGrant(ctx, grantID)
	if err != nil {
		return err
	}

	// Delete from Redis
	key := fmt.Sprintf("grant:%s", grantID)
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("delete grant: %w", err)
	}

	// Remove from indexes
	tenantKey := fmt.Sprintf("tenant:%s:grants", grant.TenantID)
	s.client.SRem(ctx, tenantKey, grantID)

	subjectKey := fmt.Sprintf("subject:%s:%s:grants", grant.TenantID, grant.SubjectID)
	s.client.SRem(ctx, subjectKey, grantID)

	resourceKey := fmt.Sprintf("resource:%s:%s:%s:grants", grant.TenantID, grant.ResourceType, grant.ResourceID)
	s.client.SRem(ctx, resourceKey, grantID)

	return nil
}

// ListGrantsByTenant lists all grants for a tenant
func (s *RedisStore) ListGrantsByTenant(ctx context.Context, tenantID string) ([]*models.TemporalGrant, error) {
	key := fmt.Sprintf("tenant:%s:grants", tenantID)
	grantIDs, err := s.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("get grant IDs: %w", err)
	}

	var grants []*models.TemporalGrant
	for _, id := range grantIDs {
		grant, err := s.GetGrant(ctx, id)
		if err != nil {
			// Grant expired or deleted - remove from index
			s.client.SRem(ctx, key, id)
			continue
		}
		grants = append(grants, grant)
	}

	return grants, nil
}

// ListGrantsBySubject lists all grants for a subject
func (s *RedisStore) ListGrantsBySubject(ctx context.Context, tenantID, subjectID string) ([]*models.TemporalGrant, error) {
	key := fmt.Sprintf("subject:%s:%s:grants", tenantID, subjectID)
	grantIDs, err := s.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("get grant IDs: %w", err)
	}

	var grants []*models.TemporalGrant
	for _, id := range grantIDs {
		grant, err := s.GetGrant(ctx, id)
		if err != nil {
			// Grant expired or deleted - remove from index
			s.client.SRem(ctx, key, id)
			continue
		}
		grants = append(grants, grant)
	}

	return grants, nil
}

// ListGrantsByResource lists all grants for a resource
func (s *RedisStore) ListGrantsByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]*models.TemporalGrant, error) {
	key := fmt.Sprintf("resource:%s:%s:%s:grants", tenantID, resourceType, resourceID)
	grantIDs, err := s.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("get grant IDs: %w", err)
	}

	var grants []*models.TemporalGrant
	for _, id := range grantIDs {
		grant, err := s.GetGrant(ctx, id)
		if err != nil {
			// Grant expired or deleted - remove from index
			s.client.SRem(ctx, key, id)
			continue
		}
		grants = append(grants, grant)
	}

	return grants, nil
}

// IncrementGrantUsage increments the usage count of a grant
func (s *RedisStore) IncrementGrantUsage(ctx context.Context, grantID string) error {
	grant, err := s.GetGrant(ctx, grantID)
	if err != nil {
		return err
	}

	grant.UsageCount++

	// Check max usage
	if grant.MaxUsage != nil && grant.UsageCount >= *grant.MaxUsage {
		grant.Status = "expired"
	}

	return s.SaveGrant(ctx, grant)
}

// Policy operations

// SavePolicy saves an access policy
func (s *RedisStore) SavePolicy(ctx context.Context, policy *models.AccessPolicy) error {
	data, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("marshal policy: %w", err)
	}

	key := fmt.Sprintf("policy:%s", policy.ID)
	if err := s.client.Set(ctx, key, data, 0).Err(); err != nil {
		return fmt.Errorf("save policy: %w", err)
	}

	// Add to tenant index
	tenantKey := fmt.Sprintf("tenant:%s:policies", policy.TenantID)
	if err := s.client.SAdd(ctx, tenantKey, policy.ID).Err(); err != nil {
		return fmt.Errorf("add to tenant index: %w", err)
	}

	return nil
}

// GetPolicy retrieves a policy by ID
func (s *RedisStore) GetPolicy(ctx context.Context, policyID string) (*models.AccessPolicy, error) {
	key := fmt.Sprintf("policy:%s", policyID)
	data, err := s.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, fmt.Errorf("policy not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}

	var policy models.AccessPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("unmarshal policy: %w", err)
	}

	return &policy, nil
}

// DeletePolicy deletes a policy
func (s *RedisStore) DeletePolicy(ctx context.Context, policyID string) error {
	policy, err := s.GetPolicy(ctx, policyID)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("policy:%s", policyID)
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("delete policy: %w", err)
	}

	// Remove from tenant index
	tenantKey := fmt.Sprintf("tenant:%s:policies", policy.TenantID)
	s.client.SRem(ctx, tenantKey, policyID)

	return nil
}

// ListPoliciesByTenant lists all policies for a tenant
func (s *RedisStore) ListPoliciesByTenant(ctx context.Context, tenantID string) ([]*models.AccessPolicy, error) {
	key := fmt.Sprintf("tenant:%s:policies", tenantID)
	policyIDs, err := s.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("get policy IDs: %w", err)
	}

	var policies []*models.AccessPolicy
	for _, id := range policyIDs {
		policy, err := s.GetPolicy(ctx, id)
		if err != nil {
			continue
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// Delegation operations

// SaveDelegation saves a delegation
func (s *RedisStore) SaveDelegation(ctx context.Context, delegation *models.Delegation) error {
	data, err := json.Marshal(delegation)
	if err != nil {
		return fmt.Errorf("marshal delegation: %w", err)
	}

	key := fmt.Sprintf("delegation:%s", delegation.ID)
	
	// Set TTL if expires
	var ttl time.Duration
	if delegation.ExpiresAt != nil {
		ttl = time.Until(*delegation.ExpiresAt)
		if ttl <= 0 {
			ttl = 0
		}
	}

	if err := s.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("save delegation: %w", err)
	}

	// Add to delegator index
	delegatorKey := fmt.Sprintf("delegator:%s:%s:delegations", delegation.TenantID, delegation.DelegatorID)
	if err := s.client.SAdd(ctx, delegatorKey, delegation.ID).Err(); err != nil {
		return fmt.Errorf("add to delegator index: %w", err)
	}

	// Add to delegate index
	delegateKey := fmt.Sprintf("delegate:%s:%s:delegations", delegation.TenantID, delegation.DelegateID)
	if err := s.client.SAdd(ctx, delegateKey, delegation.ID).Err(); err != nil {
		return fmt.Errorf("add to delegate index: %w", err)
	}

	return nil
}

// GetDelegation retrieves a delegation by ID
func (s *RedisStore) GetDelegation(ctx context.Context, delegationID string) (*models.Delegation, error) {
	key := fmt.Sprintf("delegation:%s", delegationID)
	data, err := s.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, fmt.Errorf("delegation not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get delegation: %w", err)
	}

	var delegation models.Delegation
	if err := json.Unmarshal(data, &delegation); err != nil {
		return nil, fmt.Errorf("unmarshal delegation: %w", err)
	}

	return &delegation, nil
}

// ListDelegationsByDelegate lists delegations for a delegate
func (s *RedisStore) ListDelegationsByDelegate(ctx context.Context, tenantID, delegateID string) ([]*models.Delegation, error) {
	key := fmt.Sprintf("delegate:%s:%s:delegations", tenantID, delegateID)
	delegationIDs, err := s.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("get delegation IDs: %w", err)
	}

	var delegations []*models.Delegation
	for _, id := range delegationIDs {
		delegation, err := s.GetDelegation(ctx, id)
		if err != nil {
			continue
		}
		if !delegation.Revoked {
			delegations = append(delegations, delegation)
		}
	}

	return delegations, nil
}

// Audit log operations

// SaveAuditLog saves an audit log entry
func (s *RedisStore) SaveAuditLog(ctx context.Context, log *models.AuditLog) error {
	data, err := json.Marshal(log)
	if err != nil {
		return fmt.Errorf("marshal audit log: %w", err)
	}

	// Use sorted set with timestamp as score
	key := fmt.Sprintf("audit:%s", log.TenantID)
	score := float64(log.Timestamp.Unix())
	
	if err := s.client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: data,
	}).Err(); err != nil {
		return fmt.Errorf("save audit log: %w", err)
	}

	// Trim to keep last 10000 entries per tenant
	s.client.ZRemRangeByRank(ctx, key, 0, -10001)

	return nil
}

// GetAuditLogs retrieves audit logs for a tenant
func (s *RedisStore) GetAuditLogs(ctx context.Context, tenantID string, start, end time.Time, limit int) ([]*models.AuditLog, error) {
	key := fmt.Sprintf("audit:%s", tenantID)
	
	results, err := s.client.ZRevRangeByScore(ctx, key, &redis.ZRangeBy{
		Min:   fmt.Sprintf("%d", start.Unix()),
		Max:   fmt.Sprintf("%d", end.Unix()),
		Count: int64(limit),
	}).Result()
	if err != nil {
		return nil, fmt.Errorf("get audit logs: %w", err)
	}

	var logs []*models.AuditLog
	for _, data := range results {
		var log models.AuditLog
		if err := json.Unmarshal([]byte(data), &log); err != nil {
			continue
		}
		logs = append(logs, &log)
	}

	return logs, nil
}
