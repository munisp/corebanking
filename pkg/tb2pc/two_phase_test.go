package tb2pc

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/munisp/corebanking/pkg/tbclient"
)

// recordingPoster is a test double for the cluster. Production code uses
// *tbclient.Client against a real TigerBeetle cluster.
type recordingPoster struct {
	transfers [][]tbclient.Transfer
	err       error
}

func (r *recordingPoster) CreateTransfers(ctx context.Context, transfers []tbclient.Transfer) ([]tbclient.CreateTransferResult, error) {
	if r.err != nil {
		return nil, r.err
	}
	r.transfers = append(r.transfers, transfers)
	return nil, nil
}

func newTestManager(timeout time.Duration) (*TwoPhaseCommitManager, *recordingPoster) {
	poster := &recordingPoster{}
	return newManagerWithPoster(timeout, poster), poster
}

func TestUnavailableManagerFailsFast(t *testing.T) {
	mgr := newManagerWithPoster(5*time.Second, nil)
	if mgr.Available() {
		t.Fatal("manager without cluster must not be available")
	}
	if _, err := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001); !errors.Is(err, ErrTigerBeetleUnavailable) {
		t.Errorf("CreatePending err = %v, want ErrTigerBeetleUnavailable", err)
	}
	if err := mgr.PostPending(NewID(1)); !errors.Is(err, ErrTigerBeetleUnavailable) {
		t.Errorf("PostPending err = %v, want ErrTigerBeetleUnavailable", err)
	}
	if err := mgr.VoidPending(NewID(1)); !errors.Is(err, ErrTigerBeetleUnavailable) {
		t.Errorf("VoidPending err = %v, want ErrTigerBeetleUnavailable", err)
	}
	if _, err := mgr.CreateLinkedPending([]Transfer{{DebitAccountID: NewID(1), CreditAccountID: NewID(2), Amount: 100, Ledger: 1, Code: 1}}); !errors.Is(err, ErrTigerBeetleUnavailable) {
		t.Errorf("CreateLinkedPending err = %v, want ErrTigerBeetleUnavailable", err)
	}
}

func TestClusterErrorPropagates(t *testing.T) {
	poster := &recordingPoster{err: errors.New("connection refused")}
	mgr := newManagerWithPoster(5*time.Second, poster)
	if _, err := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001); err == nil {
		t.Fatal("expected cluster error to propagate")
	}
	if len(mgr.pending) != 0 {
		t.Error("no pending record may exist when the cluster call failed")
	}
}

func TestCreatePending(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	pt, err := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)
	if err != nil {
		t.Fatal(err)
	}
	if pt.Status != "pending" {
		t.Errorf("status = %s, want pending", pt.Status)
	}
	if pt.Transfer.Amount != 50000 {
		t.Errorf("amount = %d, want 50000", pt.Transfer.Amount)
	}
	if pt.Transfer.Flags&FlagPending == 0 {
		t.Error("pending flag not set")
	}
}

func TestCreatePendingRejectsZero(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	_, err := mgr.CreatePending(NewID(1), NewID(2), 0, 1, 1001)
	if err == nil {
		t.Error("expected error for zero amount")
	}
}

func TestCreatePendingRejectsNegative(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	_, err := mgr.CreatePending(NewID(1), NewID(2), -100, 1, 1001)
	if err == nil {
		t.Error("expected error for negative amount")
	}
}

func TestPostPending(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)

	err := mgr.PostPending(pt.Transfer.ID)
	if err != nil {
		t.Fatal(err)
	}
	if pt.Status != "posted" {
		t.Errorf("status = %s, want posted", pt.Status)
	}

	// Double-post should fail
	err = mgr.PostPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error on double-post")
	}
}

func TestVoidPending(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)

	err := mgr.VoidPending(pt.Transfer.ID)
	if err != nil {
		t.Fatal(err)
	}
	if pt.Status != "voided" {
		t.Errorf("status = %s, want voided", pt.Status)
	}

	// Cannot void after void
	err = mgr.VoidPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error on double-void")
	}
}

func TestPostAfterVoidFails(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)
	mgr.VoidPending(pt.Transfer.ID)

	err := mgr.PostPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error posting a voided transfer")
	}
}

func TestExpiredTransfer(t *testing.T) {
	mgr, _ := newTestManager(1 * time.Millisecond)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)

	time.Sleep(50 * time.Millisecond) // let it expire

	err := mgr.PostPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error posting an expired transfer")
	}
}

func TestLinkedPending(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	transfers := []Transfer{
		{DebitAccountID: NewID(1), CreditAccountID: NewID(2), Amount: 10000, Ledger: 1, Code: 1001},
		{DebitAccountID: NewID(3), CreditAccountID: NewID(4), Amount: 20000, Ledger: 1, Code: 1001},
	}
	results, err := mgr.CreateLinkedPending(transfers)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("got %d results, want 2", len(results))
	}
	// Real TigerBeetle semantics: every transfer except the last in the
	// chain carries the linked flag; the last closes the chain.
	for i, pt := range results {
		wantLinked := i < len(results)-1
		hasLinked := pt.Transfer.Flags&FlagLinked != 0
		if hasLinked != wantLinked {
			t.Errorf("transfer %d linked=%v, want %v", i, hasLinked, wantLinked)
		}
		if pt.Transfer.Flags&FlagPending == 0 {
			t.Error("pending flag not set")
		}
	}
}

func TestStats(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	pt1, _ := mgr.CreatePending(NewID(1), NewID(2), 10000, 1, 1001)
	pt2, _ := mgr.CreatePending(NewID(3), NewID(4), 20000, 1, 1001)
	mgr.CreatePending(NewID(5), NewID(6), 30000, 1, 1001) // stays pending

	mgr.PostPending(pt1.Transfer.ID)
	mgr.VoidPending(pt2.Transfer.ID)

	stats := mgr.Stats()
	if stats["pending_count"].(int) != 1 {
		t.Errorf("pending_count = %v, want 1", stats["pending_count"])
	}
	if stats["total_posted"].(int64) != 1 {
		t.Errorf("total_posted = %v, want 1", stats["total_posted"])
	}
	if stats["total_voided"].(int64) != 1 {
		t.Errorf("total_voided = %v, want 1", stats["total_voided"])
	}
}

// TestTimeoutNotTruncated guards against the uint32-nanosecond overflow that
// shrank a 60s pending timeout to ~4.2s (60e9 ns mod 2^32 ≈ 4.165e9 ns).
func TestTimeoutNotTruncated(t *testing.T) {
	mgr, poster := newTestManager(60 * time.Second)
	pt, err := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)
	if err != nil {
		t.Fatal(err)
	}
	if pt.Transfer.Timeout != 60*time.Second {
		t.Errorf("transfer timeout = %v, want 60s (uint32-ns truncation regression)", pt.Transfer.Timeout)
	}
	// TimeoutAt must be ~60s in the future, not ~4.2s.
	untilTimeout := time.Until(pt.TimeoutAt)
	if untilTimeout < 55*time.Second || untilTimeout > 61*time.Second {
		t.Errorf("TimeoutAt is %v away, want ~60s", untilTimeout)
	}
	// The cluster-facing timeout (seconds) must be 60.
	if len(poster.transfers) != 1 || len(poster.transfers[0]) != 1 {
		t.Fatalf("expected 1 submitted transfer, got %v", poster.transfers)
	}
	if got := poster.transfers[0][0].Timeout; got != 60 {
		t.Errorf("cluster timeout = %d seconds, want 60", got)
	}
}

func TestNotFoundErrors(t *testing.T) {
	mgr, _ := newTestManager(5 * time.Second)
	err := mgr.PostPending(NewID(999))
	if err == nil {
		t.Error("expected error for non-existent pending ID")
	}
	err = mgr.VoidPending(NewID(999))
	if err == nil {
		t.Error("expected error for non-existent pending ID")
	}
}
