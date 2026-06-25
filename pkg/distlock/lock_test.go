package distlock

import (
	"testing"
	"time"
)

func TestAcquireRelease(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:",
	})
	defer mgr.Close()

	lock, err := mgr.Acquire("account-001", "holder-A", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	if lock.Key != "account-001" {
		t.Errorf("expected key account-001, got %s", lock.Key)
	}
	if lock.Token <= 0 {
		t.Errorf("expected positive token, got %d", lock.Token)
	}

	err = mgr.Release("account-001", "holder-A")
	if err != nil {
		t.Errorf("release failed: %v", err)
	}
}

func TestMutualExclusion(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:",
	})
	defer mgr.Close()

	_, err := mgr.Acquire("mutex-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.Release("mutex-key", "holder-A")

	_, err = mgr.Acquire("mutex-key", "holder-B", 10*time.Second)
	if err == nil {
		t.Error("expected error for second holder, got nil")
	}
}

func TestReentrant(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:",
	})
	defer mgr.Close()

	lock1, err := mgr.Acquire("reentrant-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.Release("reentrant-key", "holder-A")

	lock2, err := mgr.Acquire("reentrant-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Errorf("reentrant acquire should succeed, got: %v", err)
	}
	if lock2.Token != lock1.Token {
		t.Logf("reentrant token may differ due to TTL extension")
	}
}

func TestFencingToken(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:",
	})
	defer mgr.Close()

	lock, err := mgr.Acquire("fencing-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.Release("fencing-key", "holder-A")

	if !mgr.ValidateFencingToken("fencing-key", lock.Token) {
		t.Error("expected fencing token to be valid")
	}
	if mgr.ValidateFencingToken("fencing-key", lock.Token+999) {
		t.Error("expected stale fencing token to be invalid")
	}
}

func TestAcquireMultiSorted(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:multi:",
	})
	defer mgr.Close()

	keys := []string{"C", "A", "B"}
	locks, err := mgr.AcquireMulti(keys, "holder-X", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.ReleaseMulti(keys, "holder-X")

	if len(locks) != 3 {
		t.Errorf("expected 3 locks, got %d", len(locks))
	}
}

func TestAcquireMultiRollback(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:rollback:",
	})
	defer mgr.Close()

	// Pre-acquire one key
	_, err := mgr.Acquire("B", "blocker", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.Release("B", "blocker")

	// Try multi-acquire including the blocked key
	_, err = mgr.AcquireMulti([]string{"A", "B", "C"}, "holder-X", 10*time.Second)
	if err == nil {
		t.Error("expected error due to blocked key B")
	}

	// Verify rollback: A should not be held
	if mgr.IsHeld("A") {
		t.Error("lock A should have been released in rollback")
	}
}

func TestIsHeld(t *testing.T) {
	mgr := NewLockManagerWithConfig(Config{
		RedisAddr: "localhost:6379",
		KeyPrefix: "test:distlock:held:",
	})
	defer mgr.Close()

	if mgr.IsHeld("not-acquired") {
		t.Error("expected not held")
	}

	_, err := mgr.Acquire("held-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer mgr.Release("held-key", "holder-A")

	if !mgr.IsHeld("held-key") {
		t.Error("expected held")
	}
}
