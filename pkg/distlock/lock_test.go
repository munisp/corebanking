package distlock

import (
	"os"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// H-40 remediation: every test in this file previously did
//
//	if err != nil { t.Skipf("Redis not available: %v", err) }
//
// which meant the entire suite silently "passed" without Redis — the exact
// certification-theater pattern from the audit. Worse, for a lock manager on
// money-movement paths the *fail-closed* behavior (no Redis ⇒ no lock) is the
// security-critical property and it was never asserted.
//
// The suite is now split in two:
//  1. Always-run unit tests asserting fail-closed behavior and argument
//     validation (no Redis needed — a dead address is used on purpose).
//  2. Redis-backed behavior tests, gated behind an explicit opt-in
//     (DISTLOCK_INTEGRATION=1). They still skip without a live Redis, but the
//     fail-closed contract is proven by the always-run tests above, so the
//     suite can no longer report green while proving nothing.
// ---------------------------------------------------------------------------

// deadManager returns a LockManager pointed at a port where nothing listens.
func deadManager() *LockManager {
	return NewLockManagerWithConfig(Config{
		RedisAddr: "127.0.0.1:1",
		KeyPrefix: "test:distlock:dead:",
	})
}

func TestAcquireFailsClosedWithoutRedis(t *testing.T) {
	mgr := deadManager()
	defer mgr.Close()

	lock, err := mgr.Acquire("account-001", "holder-A", 10*time.Second)
	if err == nil {
		t.Fatal("Acquire must fail when Redis is unreachable — a distributed lock may never be issued fail-open")
	}
	if lock != nil {
		t.Errorf("no lock object may be returned on failure, got %+v", lock)
	}
}

func TestAcquireMultiFailsClosedWithoutRedis(t *testing.T) {
	mgr := deadManager()
	defer mgr.Close()

	locks, err := mgr.AcquireMulti([]string{"A", "B"}, "holder-X", 10*time.Second)
	if err == nil {
		t.Fatal("AcquireMulti must fail when Redis is unreachable")
	}
	if len(locks) != 0 {
		t.Errorf("partial lock set returned on failure: %v", locks)
	}
}

func TestFencingValidationFailsClosedWithoutRedis(t *testing.T) {
	mgr := deadManager()
	defer mgr.Close()

	if mgr.ValidateFencingToken("account-001", 1) {
		t.Error("ValidateFencingToken must return false when the token store is unreachable")
	}
	if err := mgr.CheckFence("account-001", 1); err == nil {
		t.Error("CheckFence must error (fail closed) when the token store is unreachable")
	}
}

func TestCheckFenceRejectsNonPositiveTokens(t *testing.T) {
	mgr := deadManager() // never touches Redis for token <= 0
	defer mgr.Close()

	if err := mgr.CheckFence("account-001", 0); err == nil {
		t.Error("CheckFence must reject token 0")
	}
	if err := mgr.CheckFence("account-001", -7); err == nil {
		t.Error("CheckFence must reject negative tokens")
	}
}

func TestAcquireRejectsInvalidTTL(t *testing.T) {
	mgr := deadManager() // TTL validation happens before any Redis call
	defer mgr.Close()

	if _, err := mgr.Acquire("k", "h", 0); err == nil {
		t.Error("Acquire must reject zero TTL")
	}
	if _, err := mgr.Acquire("k", "h", -time.Second); err == nil {
		t.Error("Acquire must reject negative TTL")
	}
	if _, err := mgr.Acquire("k", "h", 6*time.Minute); err == nil {
		t.Error("Acquire must reject TTL above the 5-minute ceiling")
	}
}

func TestSortStringsOrdersAndDoesNotMutate(t *testing.T) {
	input := []string{"C", "A", "B"}
	sorted := sortStrings(input)
	if len(sorted) != 3 || sorted[0] != "A" || sorted[1] != "B" || sorted[2] != "C" {
		t.Errorf("sortStrings = %v, want [A B C]", sorted)
	}
	if input[0] != "C" {
		t.Error("sortStrings must not mutate its input (lock-ordering safety)")
	}
}

// ---------------------------------------------------------------------------
// Redis-backed behavior tests (opt-in: DISTLOCK_INTEGRATION=1 and a reachable
// Redis at DISTLOCK_TEST_REDIS_ADDR, default localhost:6379).
// ---------------------------------------------------------------------------

func integrationManager(t *testing.T, prefix string) *LockManager {
	t.Helper()
	if os.Getenv("DISTLOCK_INTEGRATION") != "1" {
		t.Skip("set DISTLOCK_INTEGRATION=1 to run Redis-backed distlock tests")
	}
	addr := os.Getenv("DISTLOCK_TEST_REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	mgr := NewLockManagerWithConfig(Config{RedisAddr: addr, KeyPrefix: prefix})
	t.Cleanup(func() { mgr.Close() })

	// A wrong address is a hard failure in an explicitly enabled integration
	// run — never a silent skip.
	if _, err := mgr.Acquire("probe", "probe", 10*time.Second); err != nil {
		mgr.Close()
		t.Fatalf("DISTLOCK_INTEGRATION=1 but Redis at %s is unreachable: %v", addr, err)
	}
	if err := mgr.Release("probe", "probe"); err != nil {
		t.Fatalf("probe release failed: %v", err)
	}
	return mgr
}

func TestAcquireRelease(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:")

	lock, err := mgr.Acquire("account-001", "holder-A", 10*time.Second)
	if err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	if lock.Key != "account-001" {
		t.Errorf("expected key account-001, got %s", lock.Key)
	}
	if lock.Token <= 0 {
		t.Errorf("expected positive fencing token, got %d", lock.Token)
	}

	if err := mgr.Release("account-001", "holder-A"); err != nil {
		t.Errorf("release failed: %v", err)
	}
	if mgr.IsHeld("account-001") {
		t.Error("lock must not be held after release")
	}
}

func TestMutualExclusion(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:")

	if _, err := mgr.Acquire("mutex-key", "holder-A", 10*time.Second); err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
	defer mgr.Release("mutex-key", "holder-A")

	_, err := mgr.Acquire("mutex-key", "holder-B", 10*time.Second)
	if err == nil {
		t.Error("second holder must not acquire a held lock")
	} else if !strings.Contains(err.Error(), "held by") {
		t.Errorf("contention error should name the current holder, got: %v", err)
	}
}

func TestReentrant(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:")

	if _, err := mgr.Acquire("reentrant-key", "holder-A", 10*time.Second); err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	defer mgr.Release("reentrant-key", "holder-A")

	if _, err := mgr.Acquire("reentrant-key", "holder-A", 10*time.Second); err != nil {
		t.Errorf("reentrant acquire by the same holder must succeed, got: %v", err)
	}
}

func TestFencingToken(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:")

	lock, err := mgr.Acquire("fencing-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	defer mgr.Release("fencing-key", "holder-A")

	if !mgr.ValidateFencingToken("fencing-key", lock.Token) {
		t.Error("current fencing token must validate")
	}
	if mgr.ValidateFencingToken("fencing-key", lock.Token+999) {
		t.Error("stale fencing token must not validate")
	}
	if err := mgr.CheckFence("fencing-key", lock.Token); err != nil {
		t.Errorf("CheckFence must accept the current token: %v", err)
	}
	if err := mgr.CheckFence("fencing-key", lock.Token+999); err == nil {
		t.Error("CheckFence must reject a stale token")
	}
}

func TestFencingTokensAreMonotonic(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:mono:")

	first, err := mgr.Acquire("mono-key", "holder-A", 10*time.Second)
	if err != nil {
		t.Fatalf("first acquire failed: %v", err)
	}
	if err := mgr.Release("mono-key", "holder-A"); err != nil {
		t.Fatalf("release failed: %v", err)
	}
	second, err := mgr.Acquire("mono-key", "holder-B", 10*time.Second)
	if err != nil {
		t.Fatalf("second acquire failed: %v", err)
	}
	defer mgr.Release("mono-key", "holder-B")

	if second.Token <= first.Token {
		t.Errorf("fencing tokens must be strictly increasing: first=%d second=%d", first.Token, second.Token)
	}
	// The stale token from the previous holder must not pass a fence check.
	if err := mgr.CheckFence("mono-key", first.Token); err == nil {
		t.Error("CheckFence must reject a superseded token from a previous holder")
	}
}

func TestAcquireMultiSorted(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:multi:")

	locks, err := mgr.AcquireMulti([]string{"C", "A", "B"}, "holder-X", 10*time.Second)
	if err != nil {
		t.Fatalf("multi acquire failed: %v", err)
	}
	defer mgr.ReleaseMulti([]string{"A", "B", "C"}, "holder-X")

	if len(locks) != 3 {
		t.Errorf("expected 3 locks, got %d", len(locks))
	}
	// Deadlock prevention: locks must be acquired in sorted key order.
	for i, want := range []string{"A", "B", "C"} {
		if locks[i].Key != want {
			t.Errorf("lock %d key = %s, want %s (sorted acquisition order)", i, locks[i].Key, want)
		}
	}
}

func TestAcquireMultiRollback(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:rollback:")

	if _, err := mgr.Acquire("B", "blocker", 10*time.Second); err != nil {
		t.Fatalf("blocking acquire failed: %v", err)
	}
	defer mgr.Release("B", "blocker")

	if _, err := mgr.AcquireMulti([]string{"A", "B", "C"}, "holder-X", 10*time.Second); err == nil {
		t.Error("multi-acquire including a held key must fail")
	}
	if mgr.IsHeld("A") {
		t.Error("lock A must have been rolled back after multi-acquire failure")
	}
	if mgr.IsHeld("C") {
		t.Error("lock C must not be held after multi-acquire failure")
	}
}

func TestIsHeld(t *testing.T) {
	mgr := integrationManager(t, "test:distlock:held:")

	if mgr.IsHeld("not-acquired") {
		t.Error("unacquired key must report not held")
	}

	if _, err := mgr.Acquire("held-key", "holder-A", 10*time.Second); err != nil {
		t.Fatalf("acquire failed: %v", err)
	}
	defer mgr.Release("held-key", "holder-A")

	if !mgr.IsHeld("held-key") {
		t.Error("acquired key must report held")
	}
}
