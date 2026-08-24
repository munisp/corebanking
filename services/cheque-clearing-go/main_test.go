package main

import (
	"testing"
	"time"
)

// Rewritten: parseMICR/clearingCycle/returnReasonCode/staleCheque no longer exist
// in this service (the current implementation keeps cheque lifecycle state in the
// in-memory store below). These tests cover the real current domain functions.

func seedTestCheque(id, tenant, status string, amount float64) *Cheque {
	c := &Cheque{
		ID: id, TenantID: tenant, ChequeNumber: "00012345", Amount: amount,
		Currency: "NGN", DrawerAccount: "0012345678", PayeeAccount: "3034567890",
		BankCode: "044", BranchCode: "001", Status: status,
		PresentedAt: time.Now(), CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	insertCheque(c)
	return c
}

func TestSetStatusClearsCheque(t *testing.T) {
	c := seedTestCheque("chq_t1", "tenant-t", "pending", 5000)
	if !setStatus(c.ID, "cleared", "") {
		t.Fatal("setStatus returned false for existing cheque")
	}
	got, ok := getCheque(c.ID)
	if !ok || got.Status != "cleared" {
		t.Fatalf("expected cleared status, got %v (ok=%v)", got.Status, ok)
	}
	if got.ClearedAt == nil {
		t.Error("cleared cheque should have ClearedAt set")
	}
}

func TestSetStatusDishonorReason(t *testing.T) {
	c := seedTestCheque("chq_t2", "tenant-t", "clearing", 1000)
	if !setStatus(c.ID, "dishonored", "insufficient_funds") {
		t.Fatal("setStatus returned false")
	}
	got, _ := getCheque(c.ID)
	if got.DishonorReason != "insufficient_funds" {
		t.Errorf("expected dishonor reason recorded, got %q", got.DishonorReason)
	}
	if setStatus("chq_missing", "cleared", "") {
		t.Error("setStatus should return false for unknown id")
	}
}

func TestListChequesFiltersAndPagination(t *testing.T) {
	seedTestCheque("chq_t3a", "tenant-l", "pending", 100)
	seedTestCheque("chq_t3b", "tenant-l", "cleared", 200)
	seedTestCheque("chq_t3c", "other-tenant", "pending", 300)
	items, total := listCheques("tenant-l", "", 1, 10)
	if total != 2 || len(items) != 2 {
		t.Errorf("expected 2 tenant-l cheques, got total=%d len=%d", total, len(items))
	}
	items, total = listCheques("tenant-l", "pending", 1, 10)
	if total != 1 || len(items) != 1 {
		t.Errorf("expected 1 pending tenant-l cheque, got total=%d len=%d", total, len(items))
	}
	items, total = listCheques("tenant-l", "", 2, 1)
	if total != 2 || len(items) != 1 {
		t.Errorf("expected page 2 with 1 item, got total=%d len=%d", total, len(items))
	}
}

func TestChequeStats(t *testing.T) {
	stats := chequeStats("tenant-l")
	if stats["total"].(int) != 2 {
		t.Errorf("expected total=2, got %v", stats["total"])
	}
	if stats["total_amount"].(float64) != 300 {
		t.Errorf("expected total_amount=300, got %v", stats["total_amount"])
	}
	byStatus := stats["by_status"].(map[string]int)
	if byStatus["pending"] != 1 || byStatus["cleared"] != 1 {
		t.Errorf("unexpected by_status: %v", byStatus)
	}
}
