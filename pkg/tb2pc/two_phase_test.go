package tb2pc

import (
	"testing"
	"time"
)

func TestCreatePending(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
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
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
	_, err := mgr.CreatePending(NewID(1), NewID(2), 0, 1, 1001)
	if err == nil {
		t.Error("expected error for zero amount")
	}
}

func TestCreatePendingRejectsNegative(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
	_, err := mgr.CreatePending(NewID(1), NewID(2), -100, 1, 1001)
	if err == nil {
		t.Error("expected error for negative amount")
	}
}

func TestPostPending(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
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
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
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
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)
	mgr.VoidPending(pt.Transfer.ID)

	err := mgr.PostPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error posting a voided transfer")
	}
}

func TestExpiredTransfer(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(1 * time.Millisecond)
	pt, _ := mgr.CreatePending(NewID(1), NewID(2), 50000, 1, 1001)

	time.Sleep(50 * time.Millisecond) // let it expire

	err := mgr.PostPending(pt.Transfer.ID)
	if err == nil {
		t.Error("expected error posting an expired transfer")
	}
}

func TestLinkedPending(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
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
	for _, pt := range results {
		if pt.Transfer.Flags&FlagLinked == 0 {
			t.Error("linked flag not set")
		}
		if pt.Transfer.Flags&FlagPending == 0 {
			t.Error("pending flag not set")
		}
	}
}

func TestStats(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
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

func TestNotFoundErrors(t *testing.T) {
	mgr := NewTwoPhaseCommitManager(5 * time.Second)
	err := mgr.PostPending(NewID(999))
	if err == nil {
		t.Error("expected error for non-existent pending ID")
	}
	err = mgr.VoidPending(NewID(999))
	if err == nil {
		t.Error("expected error for non-existent pending ID")
	}
}
