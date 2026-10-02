package main

import (
	"testing"
)

// Rewritten for the MN-21 rework: the in-memory cheque store (insertCheque /
// setStatus / float64 Amount) was deleted; lifecycle state now lives in
// Postgres with TB pending-transfer holds. These tests cover the pure,
// dependency-free helpers of the new implementation. DB/TB paths are covered
// by integration smoke tests against a live cluster.

func TestNgnToKoboHalfUp(t *testing.T) {
	cases := []struct {
		ngn  float64
		want int64
	}{
		{5000.00, 500000},
		{1.006, 101}, // ROUND_HALF_UP, not truncation
		{1.005, 100}, // float64(1.005) == 1.00499… — deprecation path only
		{0.994, 99},
		{0.01, 1},
		{10.0, 1000},
	}
	for _, c := range cases {
		if got := ngnToKoboHalfUp(c.ngn); got != c.want {
			t.Errorf("ngnToKoboHalfUp(%v) = %d, want %d", c.ngn, got, c.want)
		}
	}
}

func TestParseTBAccountIDRoundTrip(t *testing.T) {
	id := detID("chq:test:hold")
	hexID := u128Hex(id)
	if len(hexID) != 32 {
		t.Fatalf("u128Hex produced %d chars, want 32", len(hexID))
	}
	parsed, err := parseTBAccountID(hexID)
	if err != nil {
		t.Fatalf("parseTBAccountID: %v", err)
	}
	if u128Hex(parsed) != hexID {
		t.Errorf("round-trip mismatch: %s vs %s", u128Hex(parsed), hexID)
	}
	if _, err := parseTBAccountID("not-hex!!"); err == nil {
		t.Error("expected error for non-hex account id")
	}
	if _, err := parseTBAccountID(""); err == nil {
		t.Error("expected error for empty account id")
	}
}

func TestDetIDDeterministic(t *testing.T) {
	a := detID("chq:chq_1:hold")
	b := detID("chq:chq_1:hold")
	c := detID("chq:chq_1:post")
	if a != b {
		t.Error("detID not deterministic")
	}
	if a == c {
		t.Error("detID collided for distinct keys")
	}
}

func TestReturnWindowDaysDefault(t *testing.T) {
	t.Setenv("CHEQUE_RETURN_WINDOW_DAYS", "")
	if got := returnWindowDays(); got != 2 {
		t.Errorf("default return window = %d, want 2", got)
	}
	t.Setenv("CHEQUE_RETURN_WINDOW_DAYS", "5")
	if got := returnWindowDays(); got != 5 {
		t.Errorf("return window = %d, want 5", got)
	}
}
