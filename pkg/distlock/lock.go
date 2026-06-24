// Package distlock provides Redis-based distributed locking for concurrent
// account access in the 54Bank platform.
//
// Key properties:
//   - Mutual exclusion: only one holder at a time per resource
//   - Deadlock prevention: locks sorted by resource ID before acquisition
//   - Auto-expiry: TTL prevents orphaned locks from indefinitely blocking
//   - Fencing token: monotonic token prevents stale lock holders from writing
//   - Reentrant-safe: lock owner tracked by unique holder ID
//   - Redis-backed: survives process restart, works across multiple instances
package distlock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

// Lock represents a held distributed lock.
type Lock struct {
	Key       string    `json:"key"`
	HolderID  string    `json:"holder_id"`
	Token     int64     `json:"fencing_token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// LockManager manages distributed locks backed by Redis.
type LockManager struct {
	rdb        *redis.Client
	mu         sync.Mutex // protects local token counter
	token      int64
	prefix     string
	instanceID string
}

// Config configures the Redis connection for the lock manager.
type Config struct {
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	KeyPrefix     string // prefix for all lock keys (default: "distlock:")
}

// NewLockManager creates a new Redis-backed lock manager.
func NewLockManager() *LockManager {
	return NewLockManagerWithConfig(Config{
		RedisAddr: getEnvOrDefault("REDIS_URL", "localhost:6379"),
		KeyPrefix: "distlock:",
	})
}

// NewLockManagerWithConfig creates a lock manager with explicit config.
func NewLockManagerWithConfig(cfg Config) *LockManager {
	if cfg.KeyPrefix == "" {
		cfg.KeyPrefix = "distlock:"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	instanceID := generateInstanceID()

	mgr := &LockManager{
		rdb:        rdb,
		prefix:     cfg.KeyPrefix,
		instanceID: instanceID,
	}

	// Initialize fencing token counter from Redis
	ctx := context.Background()
	val, err := rdb.Get(ctx, cfg.KeyPrefix+"__fencing_counter__").Int64()
	if err == nil {
		mgr.token = val
	}

	return mgr
}

// Acquire attempts to acquire a lock on the given key using Redis SET NX.
// Returns a fencing token on success, error if already held by another holder.
func (m *LockManager) Acquire(key, holderID string, ttl time.Duration) (*Lock, error) {
	if ttl <= 0 {
		return nil, fmt.Errorf("TTL must be positive")
	}
	if ttl > 5*time.Minute {
		return nil, fmt.Errorf("TTL must not exceed 5 minutes (got %v)", ttl)
	}

	ctx := context.Background()
	redisKey := m.prefix + key

	// Try SET NX (atomic acquire)
	lockValue := holderID
	ok, err := m.rdb.SetNX(ctx, redisKey, lockValue, ttl).Result()
	if err != nil {
		return nil, fmt.Errorf("redis SETNX failed: %w", err)
	}

	if !ok {
		// Key exists — check if same holder (reentrant)
		existing, err := m.rdb.Get(ctx, redisKey).Result()
		if err != nil {
			return nil, fmt.Errorf("lock %s held by another process", key)
		}
		if existing == holderID {
			// Reentrant: extend TTL
			m.rdb.Expire(ctx, redisKey, ttl)
			token := m.currentToken(key, ctx)
			return &Lock{
				Key:       key,
				HolderID:  holderID,
				Token:     token,
				ExpiresAt: time.Now().Add(ttl),
			}, nil
		}
		remainTTL, _ := m.rdb.TTL(ctx, redisKey).Result()
		return nil, fmt.Errorf("lock %s held by %s until %v", key, existing, time.Now().Add(remainTTL))
	}

	// Acquired — get monotonic fencing token
	token := m.nextToken(ctx)
	tokenKey := m.prefix + "token:" + key
	m.rdb.Set(ctx, tokenKey, token, ttl+time.Minute) // token persists slightly longer than lock

	return &Lock{
		Key:       key,
		HolderID:  holderID,
		Token:     token,
		ExpiresAt: time.Now().Add(ttl),
	}, nil
}

// AcquireMulti acquires locks on multiple keys in sorted order to prevent deadlocks.
// All locks use the same holderID and TTL.
// If any lock fails, all previously acquired locks are released (all-or-nothing).
func (m *LockManager) AcquireMulti(keys []string, holderID string, ttl time.Duration) ([]*Lock, error) {
	sorted := sortStrings(keys)
	acquired := make([]*Lock, 0, len(sorted))

	for _, key := range sorted {
		lock, err := m.Acquire(key, holderID, ttl)
		if err != nil {
			// Rollback: release all acquired locks
			for _, l := range acquired {
				m.Release(l.Key, holderID)
			}
			return nil, fmt.Errorf("failed to acquire lock on %s: %w (released %d previously acquired)", key, err, len(acquired))
		}
		acquired = append(acquired, lock)
	}

	return acquired, nil
}

// Release releases a lock. Only the holder can release it (verified via Lua script).
func (m *LockManager) Release(key, holderID string) error {
	ctx := context.Background()
	redisKey := m.prefix + key

	// Lua script: atomic check-and-delete (only if holder matches)
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		else
			return 0
		end
	`)

	result, err := script.Run(ctx, m.rdb, []string{redisKey}, holderID).Int64()
	if err != nil {
		return fmt.Errorf("redis release script failed: %w", err)
	}
	if result == 0 {
		// Either already released or held by someone else — both are acceptable
		return nil
	}
	return nil
}

// ReleaseMulti releases multiple locks.
func (m *LockManager) ReleaseMulti(keys []string, holderID string) {
	for _, key := range keys {
		m.Release(key, holderID)
	}
}

// IsHeld checks if a lock is currently held.
func (m *LockManager) IsHeld(key string) bool {
	ctx := context.Background()
	redisKey := m.prefix + key
	exists, err := m.rdb.Exists(ctx, redisKey).Result()
	return err == nil && exists > 0
}

// ValidateFencingToken checks that the token is still the current holder's token.
func (m *LockManager) ValidateFencingToken(key string, token int64) bool {
	ctx := context.Background()
	tokenKey := m.prefix + "token:" + key
	val, err := m.rdb.Get(ctx, tokenKey).Int64()
	if err != nil {
		return false
	}
	return val == token
}

// Close closes the Redis connection.
func (m *LockManager) Close() error {
	return m.rdb.Close()
}

// nextToken returns the next monotonically increasing fencing token (Redis INCR).
func (m *LockManager) nextToken(ctx context.Context) int64 {
	counterKey := m.prefix + "__fencing_counter__"
	val, err := m.rdb.Incr(ctx, counterKey).Result()
	if err != nil {
		// Fallback to local counter if Redis fails
		return atomic.AddInt64(&m.token, 1)
	}
	return val
}

// currentToken retrieves the current token for a key.
func (m *LockManager) currentToken(key string, ctx context.Context) int64 {
	tokenKey := m.prefix + "token:" + key
	val, err := m.rdb.Get(ctx, tokenKey).Int64()
	if err != nil {
		return atomic.LoadInt64(&m.token)
	}
	return val
}

func generateInstanceID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func sortStrings(s []string) []string {
	sorted := make([]string, len(s))
	copy(sorted, s)
	for i := 1; i < len(sorted); i++ {
		for j := i; j > 0 && sorted[j] < sorted[j-1]; j-- {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
		}
	}
	return sorted
}
