package main

import "testing"

func TestParseMICR(t *testing.T) {
	bank, branch, serial := parseMICR("044 001 00012345")
	if bank != "044" { t.Errorf("expected bank=044, got %s", bank) }
	if branch != "001" { t.Errorf("expected branch=001, got %s", branch) }
	if serial != "00012345" { t.Errorf("expected serial=00012345, got %s", serial) }
	
	bank, branch, serial = parseMICR("")
	if bank != "" { t.Error("expected empty bank for empty input") }
}

func TestClearingCycle(t *testing.T) {
	if c := clearingCycle(50000000); c != "same_day" { t.Errorf("expected same_day, got %s", c) }
	if c := clearingCycle(5000); c != "t_plus_1" { t.Errorf("expected t_plus_1, got %s", c) }
}

func TestReturnReasonCode(t *testing.T) {
	tests := map[string]string{
		"insufficient_funds": "01", "account_closed": "02",
		"refer_to_drawer": "03", "stale_cheque": "04",
		"payment_stopped": "05", "unknown": "99",
	}
	for reason, expected := range tests {
		if code := returnReasonCode(reason); code != expected {
			t.Errorf("returnReasonCode(%s) = %s, want %s", reason, code, expected)
		}
	}
}

func TestStaleCheque(t *testing.T) {
	if !staleCheque(181) { t.Error("181 days should be stale") }
	if staleCheque(180) { t.Error("180 days should not be stale") }
	if staleCheque(30) { t.Error("30 days should not be stale") }
}
