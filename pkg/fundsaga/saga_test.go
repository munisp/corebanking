package fundsaga

import (
	"context"
	"fmt"
	"math"
	"strings"
	"testing"
)

func TestAmountKobo(t *testing.T) {
	a := NairaToKobo(1000)
	if a != 100000 {
		t.Errorf("NairaToKobo(1000) = %d, want 100000", a)
	}
	if a.Naira() != 1000.0 {
		t.Errorf("AmountKobo(100000).Naira() = %f, want 1000.0", a.Naira())
	}
}

func TestDoubleEntryValidation(t *testing.T) {
	state := &SagaState{
		Legs: []TransferLeg{
			{AccountID: "A", Amount: 50000, Direction: "debit"},
			{AccountID: "B", Amount: 50000, Direction: "credit"},
		},
	}
	step := StepValidateBalances()
	if err := step.Forward(context.Background(), state); err != nil {
		t.Errorf("balanced legs should pass: %v", err)
	}

	// Imbalanced
	state.Legs[1].Amount = 40000
	if err := step.Forward(context.Background(), state); err == nil {
		t.Error("imbalanced legs should fail")
	}
}

func TestSagaCompensation(t *testing.T) {
	compensated := make([]string, 0)
	steps := []SagaStep{
		{
			Name:    "step1",
			Forward: func(ctx context.Context, state *SagaState) error { return nil },
			Compensate: func(ctx context.Context, state *SagaState) error {
				compensated = append(compensated, "step1")
				return nil
			},
		},
		{
			Name:    "step2",
			Forward: func(ctx context.Context, state *SagaState) error { return nil },
			Compensate: func(ctx context.Context, state *SagaState) error {
				compensated = append(compensated, "step2")
				return nil
			},
		},
		{
			Name:    "step3_fails",
			Forward: func(ctx context.Context, state *SagaState) error { return fmt.Errorf("boom") },
			Compensate: func(ctx context.Context, state *SagaState) error {
				compensated = append(compensated, "step3")
				return nil
			},
		},
	}

	state := &SagaState{TransferID: "TEST-1", Metadata: map[string]interface{}{}}
	result, err := ExecuteSaga(context.Background(), steps, state)

	if err == nil {
		t.Fatal("expected saga to fail")
	}
	if result.Status != "compensated" {
		t.Errorf("status = %s, want compensated", result.Status)
	}
	// Compensation should run in reverse: step2, step1 (not step3 — it failed)
	if len(compensated) != 2 {
		t.Fatalf("compensated %d steps, want 2", len(compensated))
	}
	if compensated[0] != "step2" || compensated[1] != "step1" {
		t.Errorf("compensation order = %v, want [step2, step1]", compensated)
	}
}

func TestSagaCompensationFailurePropagates(t *testing.T) {
	steps := []SagaStep{
		{
			Name:    "step1",
			Forward: func(ctx context.Context, state *SagaState) error { return nil },
			Compensate: func(ctx context.Context, state *SagaState) error {
				return fmt.Errorf("void pending transfer failed: cluster unreachable")
			},
		},
		{
			Name:       "step2_fails",
			Forward:    func(ctx context.Context, state *SagaState) error { return fmt.Errorf("boom") },
			Compensate: nil,
		},
	}
	state := &SagaState{TransferID: "TEST-COMP-FAIL", Metadata: map[string]interface{}{}}
	result, err := ExecuteSaga(context.Background(), steps, state)
	if err == nil {
		t.Fatal("expected saga to fail")
	}
	if result.Status != "compensation_failed" {
		t.Errorf("status = %s, want compensation_failed — a failed compensation must never report compensated", result.Status)
	}
	if result.Error == "" || !strings.Contains(result.Error, "compensation step 0") {
		t.Errorf("error %q should carry the compensation failure detail", result.Error)
	}
}

func TestStepIdempotencyKeys(t *testing.T) {
	state := &SagaState{TransferID: "SAGA-1", Metadata: map[string]interface{}{}}
	steps := []SagaStep{
		{Name: "a", Forward: func(ctx context.Context, state *SagaState) error { return nil }},
		{Name: "b", Forward: func(ctx context.Context, state *SagaState) error { return nil }},
	}
	if _, err := ExecuteSaga(context.Background(), steps, state); err != nil {
		t.Fatal(err)
	}
	if len(state.StepKeys) != 2 {
		t.Fatalf("StepKeys = %v, want 2 entries", state.StepKeys)
	}
	if state.StepKeys[0] == state.StepKeys[1] {
		t.Error("step keys must be distinct per step index")
	}
	// Deterministic: same saga identity + step index → same key.
	again := stepIdempotencyKey(&SagaState{TransferID: "SAGA-1"}, 0, "a")
	if again != state.StepKeys[0] {
		t.Errorf("step key not deterministic: %s != %s", again, state.StepKeys[0])
	}
	// Caller-supplied IdempotencyKey takes precedence over TransferID.
	k1 := stepIdempotencyKey(&SagaState{TransferID: "SAGA-1", IdempotencyKey: "caller-key"}, 0, "a")
	k2 := stepIdempotencyKey(&SagaState{TransferID: "SAGA-2", IdempotencyKey: "caller-key"}, 0, "a")
	if k1 != k2 {
		t.Error("IdempotencyKey must drive the step key, not the time-based TransferID")
	}
	if k1 == state.StepKeys[0] {
		t.Error("key with IdempotencyKey should differ from TransferID-derived key")
	}
}

func TestP2PTransferSaga(t *testing.T) {
	steps, state := P2PTransferSaga("sender-001", "receiver-002", 500000)
	if len(steps) != 8 {
		t.Errorf("P2P saga has %d steps, want 8", len(steps))
	}
	if len(state.Legs) != 2 {
		t.Errorf("P2P saga has %d legs, want 2", len(state.Legs))
	}
	// Verify double-entry balance
	var totalDebit, totalCredit AmountKobo
	for _, leg := range state.Legs {
		if leg.Direction == "debit" {
			totalDebit += leg.Amount
		} else {
			totalCredit += leg.Amount
		}
	}
	if totalDebit != totalCredit {
		t.Errorf("imbalanced: debit=%d credit=%d", totalDebit, totalCredit)
	}
}

func TestBulkSalarySaga(t *testing.T) {
	employees := []string{"emp-1", "emp-2", "emp-3"}
	amounts := []AmountKobo{5000000, 7500000, 3000000}
	steps, state := BulkSalarySaga("company-001", employees, amounts)

	if len(steps) != 7 {
		t.Errorf("salary saga has %d steps, want 7", len(steps))
	}

	// Verify double-entry: company debit = sum of employee credits
	var totalDebit, totalCredit AmountKobo
	for _, leg := range state.Legs {
		if leg.Direction == "debit" {
			totalDebit += leg.Amount
		} else {
			totalCredit += leg.Amount
		}
	}
	if totalDebit != totalCredit {
		t.Errorf("salary imbalanced: debit=%d credit=%d", totalDebit, totalCredit)
	}
	expectedTotal := AmountKobo(5000000 + 7500000 + 3000000)
	if totalDebit != expectedTotal {
		t.Errorf("total debit = %d, want %d", totalDebit, expectedTotal)
	}
}

func TestCrossBorderRemittanceSaga(t *testing.T) {
	// FX rate: 1 NGN = 0.0013 USD → 13 basis points of minor units, resolved
	// from the configured rate source (never caller-supplied).
	ConfigureFXRateSource(testFXRateProvider)
	defer ConfigureFXRateSource(nil)

	steps, state, err := CrossBorderRemittanceSaga("sender", "beneficiary", 10000000, "USD")
	if err != nil {
		t.Fatalf("remittance saga construction failed: %v", err)
	}

	if len(steps) != 9 {
		t.Errorf("remittance saga has %d steps, want 9", len(steps))
	}

	// Verify legs include nostro/vostro with explicit per-side currencies
	hasNostro, hasVostro := false, false
	for _, leg := range state.Legs {
		if leg.AccountID == "nostro-USD" {
			hasNostro = true
			if leg.Currency != "NGN" {
				t.Errorf("nostro leg currency = %s, want NGN (send side)", leg.Currency)
			}
			if leg.Amount != 10000000 {
				t.Errorf("nostro leg amount = %d, want 10000000", leg.Amount)
			}
		}
		if leg.AccountID == "vostro-USD" {
			hasVostro = true
			if leg.Currency != "USD" {
				t.Errorf("vostro leg currency = %s, want USD (receive side)", leg.Currency)
			}
			// 10000000 kobo * 13 / 10000 = 13000 minor units
			if leg.Amount != 13000 {
				t.Errorf("vostro leg amount = %d, want 13000", leg.Amount)
			}
		}
	}
	if !hasNostro || !hasVostro {
		t.Error("remittance saga missing nostro/vostro legs")
	}

	// The leg set must validate: balanced per currency (NGN side and USD side).
	if err := StepValidateBalances().Forward(context.Background(), state); err != nil {
		t.Errorf("cross-border legs should balance per currency: %v", err)
	}
}

func TestCrossBorderRemittanceSagaFailsFastWithoutRateSource(t *testing.T) {
	ConfigureFXRateSource(nil)
	if _, _, err := CrossBorderRemittanceSaga("sender", "beneficiary", 10000000, "USD"); err == nil {
		t.Fatal("expected fail-fast when no FX rate source is configured")
	}
}

func TestPerCurrencyBalanceValidation(t *testing.T) {
	// Numerically "balanced" but currency-mixed leg set: 100 NGN debit vs
	// 100 USD credit must NOT pass — totals per currency differ.
	state := &SagaState{
		Legs: []TransferLeg{
			{AccountID: "A", Amount: 100, Direction: "debit", Currency: "NGN"},
			{AccountID: "B", Amount: 100, Direction: "credit", Currency: "USD"},
		},
	}
	if err := StepValidateBalances().Forward(context.Background(), state); err == nil {
		t.Error("mixed-currency leg set must fail per-currency balance validation")
	}
}

func TestConvertAmountKoboOverflow(t *testing.T) {
	// Overflow-safe conversion: huge amounts must error, never wrap.
	if _, err := convertAmountKobo(AmountKobo(math.MaxInt64-1), 90000); err == nil {
		t.Error("expected overflow error for near-MaxInt64 amount")
	}
	// Round-to-zero must error (non-positive receive amount is refused).
	if _, err := convertAmountKobo(AmountKobo(100), 1); err == nil {
		t.Error("expected round-to-zero error for tiny converted amount")
	}
	// Happy path: 1,000,000 * 13 / 10000 = 1300.
	got, err := convertAmountKobo(AmountKobo(1000000), 13)
	if err != nil || got != 1300 {
		t.Errorf("convertAmountKobo(1000000, 13) = %d, %v; want 1300, nil", got, err)
	}
}

func TestSortStrings(t *testing.T) {
	input := []string{"charlie", "alpha", "bravo"}
	sorted := sortStrings(input)
	if sorted[0] != "alpha" || sorted[1] != "bravo" || sorted[2] != "charlie" {
		t.Errorf("sortStrings = %v, want [alpha bravo charlie]", sorted)
	}
	// Original unchanged
	if input[0] != "charlie" {
		t.Error("sortStrings mutated original")
	}
}
