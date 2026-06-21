package distlock

import (
	"sync"
	"testing"
	"time"
)

func TestAcquireRelease(t *testing.T) {
	mgr := NewLockManager()
	lock, err := mgr.Acquire("account:001", "txn-1", time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if lock.Key != "account:001" {
		t.Errorf("key = %s, want account:001", lock.Key)
	}
	if lock.Token <= 0 {
		t.Error("token should be positive")
	}

	err = mgr.Release("account:001", "txn-1")
	if err != nil {
		t.Fatal(err)
	}
}

func TestMutualExclusion(t *testing.T) {
	mgr := NewLockManager()
	_, err := mgr.Acquire("account:001", "txn-1", time.Second)
	if err != nil {
		t.Fatal(err)
	}

	_, err = mgr.Acquire("account:001", "txn-2", time.Second)
	if err == nil {
		t.Error("expected error: lock should be held by txn-1")
	}
}

func TestReentrant(t *testing.T) {
	mgr := NewLockManager()
	lock1, _ := mgr.Acquire("account:001", "txn-1", time.Second)
	lock2, err := mgr.Acquire("account:001", "txn-1", time.Second)
	if err != nil {
		t.Fatal("reentrant lock should succeed")
	}
	if lock1.Token != lock2.Token {
		t.Error("reentrant lock should return same token")
	}
}

func TestAutoExpiry(t *testing.T) {
	mgr := NewLockManager()
	_, err := mgr.Acquire("account:001", "txn-1", 10*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	time.Sleep(50 * time.Millisecond)

	// Lock should have expired; another holder can now acquire
	_, err = mgr.Acquire("account:001", "txn-2", time.Second)
	if err != nil {
		t.Fatalf("should acquire after expiry: %v", err)
	}
}

func TestReleaseByWrongHolder(t *testing.T) {
	mgr := NewLockManager()
	mgr.Acquire("account:001", "txn-1", time.Second)

	err := mgr.Release("account:001", "txn-2")
	if err == nil {
		t.Error("wrong holder should not be able to release")
	}
}

func TestAcquireMultiSorted(t *testing.T) {
	mgr := NewLockManager()
	keys := []string{"account:003", "account:001", "account:002"}
	locks, err := mgr.AcquireMulti(keys, "txn-1", time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if len(locks) != 3 {
		t.Fatalf("got %d locks, want 3", len(locks))
	}
	// Verify tokens are monotonically increasing (sorted acquisition)
	for i := 1; i < len(locks); i++ {
		if locks[i].Token <= locks[i-1].Token {
			t.Error("tokens should be monotonically increasing")
		}
	}
}

func TestAcquireMultiRollback(t *testing.T) {
	mgr := NewLockManager()
	// Pre-lock one key with a different holder
	mgr.Acquire("account:002", "other-txn", time.Second)

	keys := []string{"account:001", "account:002", "account:003"}
	_, err := mgr.AcquireMulti(keys, "txn-1", time.Second)
	if err == nil {
		t.Fatal("should fail because account:002 is locked")
	}

	// account:001 should have been released (rollback)
	if mgr.IsHeld("account:001") {
		t.Error("account:001 should have been released after rollback")
	}
}

func TestFencingToken(t *testing.T) {
	mgr := NewLockManager()
	lock, _ := mgr.Acquire("account:001", "txn-1", time.Second)
	if !mgr.ValidateFencingToken("account:001", lock.Token) {
		t.Error("valid fencing token should pass")
	}
	if mgr.ValidateFencingToken("account:001", lock.Token-1) {
		t.Error("stale fencing token should fail")
	}
}

func TestConcurrentAccess(t *testing.T) {
	mgr := NewLockManager()
	var wg sync.WaitGroup
	successes := int32(0)

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			holderID := "txn-" + string(rune('A'+id%26))
			_, err := mgr.Acquire("account:shared", holderID, 50*time.Millisecond)
			if err == nil {
				// got the lock
				_ = &successes
				time.Sleep(time.Millisecond)
				mgr.Release("account:shared", holderID)
			}
		}(i)
	}
	wg.Wait()
}

func TestTTLTooLong(t *testing.T) {
	mgr := NewLockManager()
	_, err := mgr.Acquire("account:001", "txn-1", 10*time.Minute)
	if err == nil {
		t.Error("TTL > 5 min should be rejected")
	}
}
