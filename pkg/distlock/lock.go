// Package distlock provides Redis-based distributed locking for concurrent
// account access in the 54Bank platform.
//
// Key properties:
//   - Mutual exclusion: only one holder at a time per resource
//   - Deadlock prevention: locks sorted by resource ID before acquisition
//   - Auto-expiry: TTL prevents orphaned locks from indefinitely blocking
//   - Fencing token: monotonic token prevents stale lock holders from writing
//   - Reentrant-safe: lock owner tracked by unique holder ID
package distlock

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Lock represents a held distributed lock.
type Lock struct {
	Key       string    `json:"key"`
	HolderID  string    `json:"holder_id"`
	Token     int64     `json:"fencing_token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// LockManager manages distributed locks.
// In production, this backs onto Redis SETNX + PEXPIRE.
// This implementation is an in-process simulation for correctness verification.
type LockManager struct {
	mu     sync.Mutex
	locks  map[string]*Lock
	token  int64
}

// NewLockManager creates a new lock manager.
func NewLockManager() *LockManager {
	mgr := &LockManager{
		locks: make(map[string]*Lock),
	}
	go mgr.cleanupLoop()
	return mgr
}

// Acquire attempts to acquire a lock on the given key.
// Returns a fencing token on success, error if already held by another holder.
func (m *LockManager) Acquire(key, holderID string, ttl time.Duration) (*Lock, error) {
	if ttl <= 0 {
		return nil, fmt.Errorf("TTL must be positive")
	}
	if ttl > 5*time.Minute {
		return nil, fmt.Errorf("TTL must not exceed 5 minutes (got %v)", ttl)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()

	// Check if lock exists and is still valid
	if existing, ok := m.locks[key]; ok {
		if now.Before(existing.ExpiresAt) {
			if existing.HolderID == holderID {
				// Reentrant: extend TTL and return same token
				existing.ExpiresAt = now.Add(ttl)
				return existing, nil
			}
			return nil, fmt.Errorf("lock %s held by %s until %v", key, existing.HolderID, existing.ExpiresAt)
		}
		// Expired — remove and allow new acquisition
		delete(m.locks, key)
	}

	// Acquire new lock with monotonically increasing fencing token
	token := atomic.AddInt64(&m.token, 1)
	lock := &Lock{
		Key:       key,
		HolderID:  holderID,
		Token:     token,
		ExpiresAt: now.Add(ttl),
	}
	m.locks[key] = lock
	return lock, nil
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

// Release releases a lock. Only the holder can release it.
func (m *LockManager) Release(key, holderID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	existing, ok := m.locks[key]
	if !ok {
		return nil // already released or expired
	}
	if existing.HolderID != holderID {
		return fmt.Errorf("lock %s held by %s, not %s", key, existing.HolderID, holderID)
	}

	delete(m.locks, key)
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
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.locks[key]
	return ok && time.Now().Before(existing.ExpiresAt)
}

// ValidateFencingToken checks that the token is still the current holder's token.
// This prevents stale lock holders from performing writes after their lock expired
// and was re-acquired by another process.
func (m *LockManager) ValidateFencingToken(key string, token int64) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.locks[key]
	if !ok {
		return false
	}
	return existing.Token == token && time.Now().Before(existing.ExpiresAt)
}

// cleanupLoop periodically removes expired locks.
func (m *LockManager) cleanupLoop() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		m.mu.Lock()
		for key, lock := range m.locks {
			if now.After(lock.ExpiresAt) {
				delete(m.locks, key)
			}
		}
		m.mu.Unlock()
	}
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
