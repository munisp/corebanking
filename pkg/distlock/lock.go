// Package distlock provides Redis-based distributed locking for concurrent
// account access in the 54Bank platform.
//
// Key properties:
//   - Mutual exclusion: only one holder at a time per resource
//   - Deadlock prevention: locks sorted by resource ID before acquisition
//   - Auto-expiry: TTL prevents orphaned locks from indefinitely blocking
//   - Fencing token: strictly monotonic token (Redis INCR, shared across ALL
//     lock-manager instances) prevents stale lock holders from writing
//   - Reentrant-safe: lock owner tracked by unique holder ID
//   - Redis-backed: survives process restart, works across multiple instances
//
// Fencing tokens are derived from a single Redis INCR counter, so they are
// strictly monotonic across every LockManager instance and process restart.
// Token issuance FAILS CLOSED: if Redis cannot issue a token, Acquire returns
// an error (and releases the lock) rather than falling back to a local,
// non-monotonic counter.
//
// Documented usage for writers (mandatory on money/state-mutation paths):
//
//	lock, err := mgr.Acquire(key, holderID, ttl)
//	if err != nil { ... }
//	defer mgr.Release(lock.Key, holderID)
//	// Before performing the protected write, validate the fence:
//	if err := mgr.CheckFence(lock.Key, lock.Token); err != nil {
//	    return err // stale lock holder — abort the write
//	}
//	// ... perform the write, persisting lock.Token alongside the mutation ...
package distlock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
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
			token, err := m.currentToken(ctx, key)
			if err != nil {
				return nil, fmt.Errorf("fencing token unavailable for %s: %w", key, err)
			}
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

	// Acquired — get strictly monotonic fencing token via Redis INCR.
	// Fail closed: if the token cannot be issued, release the lock and error.
	token, err := m.nextToken(ctx)
	if err != nil {
		m.rdb.Del(ctx, redisKey)
		return nil, fmt.Errorf("fencing token issuance failed for %s (lock released): %w", key, err)
	}
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
// Fail closed: any Redis error or unknown token returns false.
func (m *LockManager) ValidateFencingToken(key string, token int64) bool {
	ctx := context.Background()
	tokenKey := m.prefix + "token:" + key
	val, err := m.rdb.Get(ctx, tokenKey).Int64()
	if err != nil {
		return false
	}
	return val == token
}

// CheckFence validates a fencing token before a protected write. Writers MUST
// call this immediately before mutating the guarded resource; a stale token
// (a newer acquisition has since issued a higher token) or any validation
// failure aborts the write. Returns nil only when token is the latest token
// issued for key.
func (m *LockManager) CheckFence(key string, token int64) error {
	if token <= 0 {
		return fmt.Errorf("invalid fencing token %d for %s", token, key)
	}
	ctx := context.Background()
	tokenKey := m.prefix + "token:" + key
	val, err := m.rdb.Get(ctx, tokenKey).Int64()
	if err != nil {
		return fmt.Errorf("fence check failed for %s (fail closed): %w", key, err)
	}
	if val != token {
		return fmt.Errorf("stale fencing token for %s: have %d, current is %d", key, token, val)
	}
	return nil
}

// Close closes the Redis connection.
func (m *LockManager) Close() error {
	return m.rdb.Close()
}

// nextToken returns the next strictly monotonically increasing fencing token.
// The counter is a single Redis INCR key, so tokens are monotonic across all
// lock-manager instances. There is deliberately NO local fallback: a local
// counter would not be monotonic across instances, which is exactly the
// failure mode fencing tokens exist to prevent.
func (m *LockManager) nextToken(ctx context.Context) (int64, error) {
	counterKey := m.prefix + "__fencing_counter__"
	val, err := m.rdb.Incr(ctx, counterKey).Result()
	if err != nil {
		return 0, fmt.Errorf("redis INCR %s failed: %w", counterKey, err)
	}
	return val, nil
}

// currentToken retrieves the current token for a key.
func (m *LockManager) currentToken(ctx context.Context, key string) (int64, error) {
	tokenKey := m.prefix + "token:" + key
	val, err := m.rdb.Get(ctx, tokenKey).Int64()
	if err != nil {
		return 0, fmt.Errorf("redis GET %s failed: %w", tokenKey, err)
	}
	return val, nil
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
