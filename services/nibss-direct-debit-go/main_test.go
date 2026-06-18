package main

import "testing"

func TestValidateMandate(t *testing.T) {
	ok, errs := validateMandate("0123456789", "MND001", 50000)
	if !ok { t.Errorf("valid 10-digit NUBAN should pass, errors: %v", errs) }
	ok, _ = validateMandate("short", "MND001", 50000)
	if ok { t.Error("non-10-digit account should fail") }
	ok, _ = validateMandate("0123456789", "", 50000)
	if ok { t.Error("empty mandate ref should fail") }
	ok, _ = validateMandate("0123456789", "MND001", 0)
	if ok { t.Error("zero amount should fail") }
	ok, _ = validateMandate("0123456789", "MND001", -100)
	if ok { t.Error("negative amount should fail") }
}
