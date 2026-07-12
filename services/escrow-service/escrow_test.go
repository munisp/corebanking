package main

import (
	"fmt"
	"testing"
	"time"
)

// ============================================
// ESCROW SERVICE UNIT TESTS
// ============================================

func TestEscrowCreation(t *testing.T) {
	tests := []struct {
		name        string
		input       CreateEscrowInput
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid goods escrow",
			input: CreateEscrowInput{
				TenantID:    "tenant-001",
				BuyerID:     "buyer-001",
				SellerID:    "seller-001",
				EscrowType:  "GOODS",
				Amount:      50000.00,
				Currency:    "NGN",
				Description: "Purchase of electronics",
				ExpiryDays:  30,
			},
			expectError: false,
		},
		{
			name: "valid service escrow",
			input: CreateEscrowInput{
				TenantID:    "tenant-001",
				BuyerID:     "buyer-002",
				SellerID:    "seller-002",
				EscrowType:  "SERVICE",
				Amount:      100000.00,
				Currency:    "NGN",
				Description: "Software development project",
				ExpiryDays:  90,
			},
			expectError: false,
		},
		{
			name: "valid real estate escrow",
			input: CreateEscrowInput{
				TenantID:    "tenant-001",
				BuyerID:     "buyer-003",
				SellerID:    "seller-003",
				EscrowType:  "REAL_ESTATE",
				Amount:      50000000.00,
				Currency:    "NGN",
				Description: "Property purchase",
				ExpiryDays:  180,
			},
			expectError: false,
		},
		{
			name: "missing tenant ID",
			input: CreateEscrowInput{
				BuyerID:    "buyer-001",
				SellerID:   "seller-001",
				EscrowType: "GOODS",
				Amount:     50000.00,
				Currency:   "NGN",
			},
			expectError: true,
			errorMsg:    "tenant_id is required",
		},
		{
			name: "same buyer and seller",
			input: CreateEscrowInput{
				TenantID:   "tenant-001",
				BuyerID:    "user-001",
				SellerID:   "user-001",
				EscrowType: "GOODS",
				Amount:     50000.00,
				Currency:   "NGN",
			},
			expectError: true,
			errorMsg:    "buyer and seller cannot be the same",
		},
		{
			name: "negative amount",
			input: CreateEscrowInput{
				TenantID:   "tenant-001",
				BuyerID:    "buyer-001",
				SellerID:   "seller-001",
				EscrowType: "GOODS",
				Amount:     -1000.00,
				Currency:   "NGN",
			},
			expectError: true,
			errorMsg:    "amount must be positive",
		},
		{
			name: "invalid escrow type",
			input: CreateEscrowInput{
				TenantID:   "tenant-001",
				BuyerID:    "buyer-001",
				SellerID:   "seller-001",
				EscrowType: "INVALID",
				Amount:     50000.00,
				Currency:   "NGN",
			},
			expectError: true,
			errorMsg:    "invalid escrow type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateEscrowInput(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("expected error containing '%s', got nil", tt.errorMsg)
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestEscrowTypeValidation(t *testing.T) {
	validTypes := []string{"GOODS", "SERVICE", "REAL_ESTATE", "VEHICLE", "FREELANCE", "ECOMMERCE", "CONSTRUCTION", "LPO"}
	invalidTypes := []string{"INVALID", "goods", "service", ""}

	for _, escrowType := range validTypes {
		if !isValidEscrowType(escrowType) {
			t.Errorf("expected %s to be valid escrow type", escrowType)
		}
	}

	for _, escrowType := range invalidTypes {
		if isValidEscrowType(escrowType) {
			t.Errorf("expected %s to be invalid escrow type", escrowType)
		}
	}
}

func TestEscrowStatusTransitions(t *testing.T) {
	tests := []struct {
		name          string
		currentStatus string
		newStatus     string
		isValid       bool
	}{
		{"created to funded", "CREATED", "FUNDED", true},
		{"funded to active", "FUNDED", "ACTIVE", true},
		{"active to completed", "ACTIVE", "COMPLETED", true},
		{"active to disputed", "ACTIVE", "DISPUTED", true},
		{"disputed to resolved", "DISPUTED", "RESOLVED", true},
		{"created to completed", "CREATED", "COMPLETED", false},
		{"completed to active", "COMPLETED", "ACTIVE", false},
		{"cancelled to funded", "CANCELLED", "FUNDED", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid := isValidStatusTransition(tt.currentStatus, tt.newStatus)
			if valid != tt.isValid {
				t.Errorf("expected transition %s -> %s to be %v, got %v",
					tt.currentStatus, tt.newStatus, tt.isValid, valid)
			}
		})
	}
}

func TestMilestoneValidation(t *testing.T) {
	tests := []struct {
		name        string
		milestones  []MilestoneInput
		totalAmount float64
		expectError bool
	}{
		{
			name: "valid milestones equal total",
			milestones: []MilestoneInput{
				{Name: "Phase 1", Amount: 30000, Sequence: 1},
				{Name: "Phase 2", Amount: 40000, Sequence: 2},
				{Name: "Phase 3", Amount: 30000, Sequence: 3},
			},
			totalAmount: 100000,
			expectError: false,
		},
		{
			name: "milestones exceed total",
			milestones: []MilestoneInput{
				{Name: "Phase 1", Amount: 60000, Sequence: 1},
				{Name: "Phase 2", Amount: 60000, Sequence: 2},
			},
			totalAmount: 100000,
			expectError: true,
		},
		{
			name: "milestones below total",
			milestones: []MilestoneInput{
				{Name: "Phase 1", Amount: 30000, Sequence: 1},
				{Name: "Phase 2", Amount: 30000, Sequence: 2},
			},
			totalAmount: 100000,
			expectError: true,
		},
		{
			name: "duplicate sequences",
			milestones: []MilestoneInput{
				{Name: "Phase 1", Amount: 50000, Sequence: 1},
				{Name: "Phase 2", Amount: 50000, Sequence: 1},
			},
			totalAmount: 100000,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateMilestones(tt.milestones, tt.totalAmount)
			if tt.expectError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestEscrowFeeCalculation(t *testing.T) {
	tests := []struct {
		name        string
		amount      float64
		escrowType  string
		expectedFee float64
	}{
		{"goods small", 10000, "GOODS", 150},               // 1.5% min 100
		{"goods medium", 100000, "GOODS", 1500},            // 1.5%
		{"service small", 50000, "SERVICE", 1000},          // 2%
		{"real estate", 50000000, "REAL_ESTATE", 250000},   // 0.5%
		{"construction", 10000000, "CONSTRUCTION", 100000}, // 1%
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fee := calculateEscrowFee(tt.amount, tt.escrowType)
			if fee != tt.expectedFee {
				t.Errorf("expected fee %f, got %f", tt.expectedFee, fee)
			}
		})
	}
}

func TestDisputeResolutionValidation(t *testing.T) {
	tests := []struct {
		name         string
		resolution   string
		buyerAmount  float64
		sellerAmount float64
		escrowAmount float64
		expectError  bool
	}{
		{"full refund to buyer", "BUYER_WINS", 100000, 0, 100000, false},
		{"full release to seller", "SELLER_WINS", 0, 100000, 100000, false},
		{"split 50-50", "SPLIT", 50000, 50000, 100000, false},
		{"invalid split exceeds total", "SPLIT", 60000, 60000, 100000, true},
		{"invalid split below total", "SPLIT", 30000, 30000, 100000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateDisputeResolution(tt.resolution, tt.buyerAmount, tt.sellerAmount, tt.escrowAmount)
			if tt.expectError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestEscrowExpiryCheck(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name       string
		expiryDate time.Time
		isExpired  bool
	}{
		{"not expired", now.AddDate(0, 0, 30), false},
		{"expired yesterday", now.AddDate(0, 0, -1), true},
		{"expires today", now, true},
		{"expires in 1 hour", now.Add(time.Hour), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expired := isEscrowExpired(tt.expiryDate)
			if expired != tt.isExpired {
				t.Errorf("expected expired=%v, got %v", tt.isExpired, expired)
			}
		})
	}
}

func TestReferenceNumberGeneration(t *testing.T) {
	ref1 := generateEscrowReference()
	// ref2 := generateEscrowReference()

	if len(ref1) < 10 {
		t.Errorf("reference number too short: %s", ref1)
	}

	if ref1[:4] != "ESC-" {
		t.Errorf("expected prefix ESC-, got %s", ref1[:4])
	}

	// Allow for same-millisecond generation
	time.Sleep(time.Millisecond * 10)
	ref3 := generateEscrowReference()

	if ref1 == ref3 {
		t.Error("reference numbers should be unique")
	}
}

// ============================================
// HELPER FUNCTIONS FOR TESTS
// ============================================

type CreateEscrowInput struct {
	TenantID    string
	BuyerID     string
	SellerID    string
	EscrowType  string
	Amount      float64
	Currency    string
	Description string
	ExpiryDays  int
}

type MilestoneInput struct {
	Name     string
	Amount   float64
	Sequence int
}

func validateEscrowInput(input CreateEscrowInput) error {
	if input.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if input.BuyerID == "" {
		return fmt.Errorf("buyer_id is required")
	}
	if input.SellerID == "" {
		return fmt.Errorf("seller_id is required")
	}
	if input.BuyerID == input.SellerID {
		return fmt.Errorf("buyer and seller cannot be the same")
	}
	if input.Amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	if !isValidEscrowType(input.EscrowType) {
		return fmt.Errorf("invalid escrow type")
	}
	return nil
}

func isValidEscrowType(escrowType string) bool {
	validTypes := map[string]bool{
		"GOODS": true, "SERVICE": true, "REAL_ESTATE": true,
		"VEHICLE": true, "FREELANCE": true, "ECOMMERCE": true,
		"CONSTRUCTION": true, "LPO": true,
	}
	return validTypes[escrowType]
}

func isValidStatusTransition(current, new string) bool {
	validTransitions := map[string][]string{
		"CREATED":  {"FUNDED", "CANCELLED"},
		"FUNDED":   {"ACTIVE", "CANCELLED", "REFUNDED"},
		"ACTIVE":   {"COMPLETED", "DISPUTED", "CANCELLED"},
		"DISPUTED": {"RESOLVED", "CANCELLED"},
		"RESOLVED": {"COMPLETED", "REFUNDED"},
	}

	allowed, exists := validTransitions[current]
	if !exists {
		return false
	}

	for _, status := range allowed {
		if status == new {
			return true
		}
	}
	return false
}

func validateMilestones(milestones []MilestoneInput, totalAmount float64) error {
	if len(milestones) == 0 {
		return nil
	}

	var sum float64
	sequences := make(map[int]bool)

	for _, m := range milestones {
		if sequences[m.Sequence] {
			return fmt.Errorf("duplicate sequence number: %d", m.Sequence)
		}
		sequences[m.Sequence] = true
		sum += m.Amount
	}

	if sum != totalAmount {
		return fmt.Errorf("milestone amounts (%f) must equal total amount (%f)", sum, totalAmount)
	}

	return nil
}

func calculateEscrowFee(amount float64, escrowType string) float64 {
	feeRates := map[string]float64{
		"GOODS":        0.015, // 1.5%
		"SERVICE":      0.02,  // 2%
		"REAL_ESTATE":  0.005, // 0.5%
		"VEHICLE":      0.01,  // 1%
		"FREELANCE":    0.025, // 2.5%
		"ECOMMERCE":    0.02,  // 2%
		"CONSTRUCTION": 0.01,  // 1%
		"LPO":          0.015, // 1.5%
	}

	rate, exists := feeRates[escrowType]
	if !exists {
		rate = 0.02 // default 2%
	}

	fee := amount * rate
	minFee := 100.0

	if fee < minFee {
		return minFee
	}
	return fee
}

func validateDisputeResolution(resolution string, buyerAmount, sellerAmount, escrowAmount float64) error {
	total := buyerAmount + sellerAmount

	if resolution == "SPLIT" && total != escrowAmount {
		return fmt.Errorf("split amounts (%f) must equal escrow amount (%f)", total, escrowAmount)
	}

	return nil
}

func isEscrowExpired(expiryDate time.Time) bool {
	return time.Now().After(expiryDate) || time.Now().Equal(expiryDate)
}

func generateEscrowReference() string {
	return fmt.Sprintf("ESC-%s", time.Now().Format("20060102150405"))
}
