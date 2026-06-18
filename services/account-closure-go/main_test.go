package main

import "testing"

func TestClosureEligible(t *testing.T) {
	ok, errs := closureEligible(0, false, false)
	if !ok { t.Errorf("zero balance, no holds should be eligible, errors: %v", errs) }
	ok, _ = closureEligible(5000, false, false)
	if !ok { t.Error("positive balance should be eligible (funds swept first)") }
	ok, _ = closureEligible(-1000, false, false)
	if ok { t.Error("negative balance should not be eligible") }
	ok, _ = closureEligible(0, true, false)
	if ok { t.Error("with liens should not be eligible") }
	ok, _ = closureEligible(0, false, true)
	if ok { t.Error("with pending txn should not be eligible") }
}

func TestClosureFee(t *testing.T) {
	if f := closureFee("current"); f != 1000 { t.Errorf("current account fee = %f, want 1000", f) }
	if f := closureFee("savings"); f != 500 { t.Errorf("savings account fee = %f, want 500", f) }
	if f := closureFee("domiciliary"); f != 2000 { t.Errorf("domiciliary fee = %f, want 2000", f) }
}
