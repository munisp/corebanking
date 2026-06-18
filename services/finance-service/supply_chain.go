package main

import (
	"fmt"
	"math"
	"time"
)

// ==================== MODELS ====================

// Invoice represents a trade invoice
type Invoice struct {
	ID              string
	TenantID        string
	InvoiceNumber   string
	SupplierID      string
	BuyerID         string
	InvoiceDate     time.Time
	DueDate         time.Time
	InvoiceAmount   float64
	Currency        string
	Status          string // "pending", "verified", "discounted", "paid", "overdue"
	PaymentTerms    int    // days
	GoodsDescription string
	PurchaseOrderRef string
	VerificationStatus string // "pending", "verified", "rejected"
	VerifiedBy      string
	VerifiedAt      *time.Time
	CreatedAt       time.Time
}

// InvoiceDiscounting represents a discounting transaction
type InvoiceDiscounting struct {
	ID                string
	TenantID          string
	InvoiceID         string
	SupplierID        string
	BuyerID           string
	InvoiceAmount     float64
	DiscountRate      float64 // Annual rate
	DaysToMaturity    int
	DiscountAmount    float64
	AdvanceAmount     float64 // Amount paid to supplier
	AdvancePercentage float64 // Typically 80-90%
	Fee               float64
	TotalCost         float64
	Status            string // "pending", "approved", "disbursed", "settled"
	RequestDate       time.Time
	DisbursementDate  *time.Time
	SettlementDate    *time.Time
}

// Supplier represents a supplier in the supply chain
type Supplier struct {
	ID              string
	TenantID        string
	BusinessName    string
	RegistrationNo  string
	TaxID           string
	BankAccount     string
	CreditRating    string // "AAA", "AA", "A", "BBB", "BB", "B"
	CreditLimit     float64
	OutstandingAmount float64
	Status          string // "active", "suspended", "blocked"
	KYCVerified     bool
	CreatedAt       time.Time
}

// Buyer represents a buyer in the supply chain
type Buyer struct {
	ID              string
	TenantID        string
	BusinessName    string
	RegistrationNo  string
	TaxID           string
	CreditLimit     float64
	UsedCredit      float64
	AvailableCredit float64
	PaymentHistory  []PaymentRecord
	Status          string
	KYCVerified     bool
	CreatedAt       time.Time
}

// PaymentRecord represents buyer's payment history
type PaymentRecord struct {
	InvoiceID   string
	Amount      float64
	DueDate     time.Time
	PaidDate    time.Time
	DaysLate    int
	Status      string // "on_time", "late", "defaulted"
}

// ==================== INVOICE VERIFIER ====================

type InvoiceVerifier struct{}

func NewInvoiceVerifier() *InvoiceVerifier {
	return &InvoiceVerifier{}
}

// VerifyInvoice performs comprehensive invoice verification
func (v *InvoiceVerifier) VerifyInvoice(invoice *Invoice) (bool, []string, error) {
	issues := []string{}

	// 1. Validate invoice data completeness
	if invoice.InvoiceNumber == "" {
		issues = append(issues, "Missing invoice number")
	}

	if invoice.InvoiceAmount <= 0 {
		issues = append(issues, "Invalid invoice amount")
	}

	// 2. Verify supplier exists and is active
	supplier, err := v.getSupplier(invoice.SupplierID)
	if err != nil {
		issues = append(issues, "Supplier not found")
	} else if supplier.Status != "active" {
		issues = append(issues, fmt.Sprintf("Supplier status is %s", supplier.Status))
	} else if !supplier.KYCVerified {
		issues = append(issues, "Supplier KYC not verified")
	}

	// 3. Verify buyer exists and has credit limit
	buyer, err := v.getBuyer(invoice.BuyerID)
	if err != nil {
		issues = append(issues, "Buyer not found")
	} else if buyer.Status != "active" {
		issues = append(issues, fmt.Sprintf("Buyer status is %s", buyer.Status))
	} else if !buyer.KYCVerified {
		issues = append(issues, "Buyer KYC not verified")
	}

	// 4. Check buyer credit limit
	if buyer != nil {
		if buyer.AvailableCredit < invoice.InvoiceAmount {
			issues = append(issues, fmt.Sprintf("Buyer credit limit exceeded (available: %.2f, required: %.2f)",
				buyer.AvailableCredit, invoice.InvoiceAmount))
		}
	}

	// 5. Validate payment terms
	if invoice.PaymentTerms < 0 || invoice.PaymentTerms > 180 {
		issues = append(issues, "Invalid payment terms (must be 0-180 days)")
	}

	// 6. Check for duplicate invoice
	isDuplicate := v.checkDuplicate(invoice.InvoiceNumber, invoice.SupplierID)
	if isDuplicate {
		issues = append(issues, "Duplicate invoice number")
	}

	// 7. Verify purchase order reference
	if invoice.PurchaseOrderRef != "" {
		poValid := v.verifyPurchaseOrder(invoice.PurchaseOrderRef, invoice.BuyerID)
		if !poValid {
			issues = append(issues, "Invalid purchase order reference")
		}
	}

	isValid := len(issues) == 0

	if isValid {
		invoice.VerificationStatus = "verified"
		now := time.Now()
		invoice.VerifiedAt = &now
	} else {
		invoice.VerificationStatus = "rejected"
	}

	return isValid, issues, nil
}

func (v *InvoiceVerifier) getSupplier(supplierID string) (*Supplier, error) {
	// In production, query database
	return &Supplier{
		ID:           supplierID,
		Status:       "active",
		KYCVerified:  true,
		CreditRating: "A",
	}, nil
}

func (v *InvoiceVerifier) getBuyer(buyerID string) (*Buyer, error) {
	// In production, query database
	return &Buyer{
		ID:              buyerID,
		Status:          "active",
		KYCVerified:     true,
		CreditLimit:     10000000.0, // ₦10M
		UsedCredit:      2000000.0,  // ₦2M
		AvailableCredit: 8000000.0,  // ₦8M
	}, nil
}

func (v *InvoiceVerifier) checkDuplicate(invoiceNumber string, supplierID string) bool {
	// In production, check database
	return false
}

func (v *InvoiceVerifier) verifyPurchaseOrder(poRef string, buyerID string) bool {
	// In production, verify PO exists and matches buyer
	return true
}

// ==================== DISCOUNTING ENGINE ====================

type DiscountingEngine struct{}

func NewDiscountingEngine() *DiscountingEngine {
	return &DiscountingEngine{}
}

// CalculateDiscounting calculates invoice discounting terms
func (d *DiscountingEngine) CalculateDiscounting(
	invoice *Invoice,
	supplier *Supplier,
	buyer *Buyer,
) (*InvoiceDiscounting, error) {
	
	// Validate invoice is verified
	if invoice.VerificationStatus != "verified" {
		return nil, fmt.Errorf("invoice must be verified before discounting")
	}

	// Calculate days to maturity
	daysToMaturity := int(invoice.DueDate.Sub(time.Now()).Hours() / 24)
	if daysToMaturity < 0 {
		return nil, fmt.Errorf("invoice is overdue")
	}

	// Determine discount rate based on risk assessment
	discountRate := d.calculateDiscountRate(supplier, buyer, daysToMaturity)

	// Calculate discount amount using simple interest formula
	// Discount = Principal × Rate × Time
	discountAmount := invoice.InvoiceAmount * (discountRate / 100.0) * (float64(daysToMaturity) / 365.0)

	// Calculate advance percentage (typically 80-90% based on risk)
	advancePercentage := d.calculateAdvancePercentage(supplier, buyer)

	// Calculate advance amount
	advanceAmount := invoice.InvoiceAmount * (advancePercentage / 100.0)

	// Calculate processing fee (typically 0.5-2% of invoice amount)
	fee := invoice.InvoiceAmount * 0.01 // 1% processing fee

	// Total cost to supplier
	totalCost := discountAmount + fee

	discounting := &InvoiceDiscounting{
		ID:                d.generateDiscountingID(),
		TenantID:          invoice.TenantID,
		InvoiceID:         invoice.ID,
		SupplierID:        invoice.SupplierID,
		BuyerID:           invoice.BuyerID,
		InvoiceAmount:     invoice.InvoiceAmount,
		DiscountRate:      discountRate,
		DaysToMaturity:    daysToMaturity,
		DiscountAmount:    discountAmount,
		AdvanceAmount:     advanceAmount,
		AdvancePercentage: advancePercentage,
		Fee:               fee,
		TotalCost:         totalCost,
		Status:            "pending",
		RequestDate:       time.Now(),
	}

	return discounting, nil
}

// calculateDiscountRate determines discount rate based on risk factors
func (d *DiscountingEngine) calculateDiscountRate(supplier *Supplier, buyer *Buyer, daysToMaturity int) float64 {
	baseRate := 18.0 // Base annual rate (18%)

	// Adjust based on buyer credit rating
	buyerRiskAdjustment := d.getBuyerRiskAdjustment(buyer)

	// Adjust based on supplier credit rating
	supplierRiskAdjustment := d.getSupplierRiskAdjustment(supplier)

	// Adjust based on tenor (longer tenor = higher risk)
	tenorAdjustment := 0.0
	if daysToMaturity > 90 {
		tenorAdjustment = 2.0
	} else if daysToMaturity > 60 {
		tenorAdjustment = 1.0
	}

	totalRate := baseRate + buyerRiskAdjustment + supplierRiskAdjustment + tenorAdjustment

	// Cap between 15% and 35%
	return math.Max(15.0, math.Min(totalRate, 35.0))
}

func (d *DiscountingEngine) getBuyerRiskAdjustment(buyer *Buyer) float64 {
	// Analyze buyer's payment history
	if len(buyer.PaymentHistory) == 0 {
		return 5.0 // New buyer premium
	}

	latePayments := 0
	totalPayments := len(buyer.PaymentHistory)

	for _, payment := range buyer.PaymentHistory {
		if payment.Status == "late" {
			latePayments++
		} else if payment.Status == "defaulted" {
			latePayments += 3 // Weight defaults more heavily
		}
	}

	latePaymentRate := float64(latePayments) / float64(totalPayments)

	if latePaymentRate > 0.20 {
		return 8.0 // High risk
	} else if latePaymentRate > 0.10 {
		return 4.0 // Medium risk
	} else if latePaymentRate > 0.05 {
		return 2.0 // Low risk
	}

	return 0.0 // Excellent payment history
}

func (d *DiscountingEngine) getSupplierRiskAdjustment(supplier *Supplier) float64 {
	// Adjust based on supplier credit rating
	ratingAdjustments := map[string]float64{
		"AAA": -2.0, // Discount for excellent rating
		"AA":  -1.0,
		"A":   0.0,
		"BBB": 1.0,
		"BB":  2.0,
		"B":   4.0,
	}

	if adjustment, exists := ratingAdjustments[supplier.CreditRating]; exists {
		return adjustment
	}

	return 3.0 // Default for unrated
}

func (d *DiscountingEngine) calculateAdvancePercentage(supplier *Supplier, buyer *Buyer) float64 {
	baseAdvance := 85.0 // Base 85%

	// Adjust based on buyer reliability
	if len(buyer.PaymentHistory) > 0 {
		latePayments := 0
		for _, payment := range buyer.PaymentHistory {
			if payment.Status != "on_time" {
				latePayments++
			}
		}

		lateRate := float64(latePayments) / float64(len(buyer.PaymentHistory))

		if lateRate > 0.15 {
			baseAdvance -= 10.0 // Reduce to 75%
		} else if lateRate > 0.05 {
			baseAdvance -= 5.0 // Reduce to 80%
		}
	}

	// Adjust based on supplier rating
	if supplier.CreditRating == "AAA" || supplier.CreditRating == "AA" {
		baseAdvance += 5.0 // Increase to 90%
	}

	return math.Max(70.0, math.Min(baseAdvance, 90.0))
}

func (d *DiscountingEngine) generateDiscountingID() string {
	return fmt.Sprintf("DISC%d", time.Now().UnixNano())
}

// ==================== DISBURSEMENT ENGINE ====================

type DisbursementEngine struct{}

func NewDisbursementEngine() *DisbursementEngine {
	return &DisbursementEngine{}
}

// DisburseAdvance disburses advance payment to supplier
func (de *DisbursementEngine) DisburseAdvance(discounting *InvoiceDiscounting, supplier *Supplier) error {
	// Validate discounting is approved
	if discounting.Status != "approved" {
		return fmt.Errorf("discounting must be approved before disbursement")
	}

	// Check supplier account details
	if supplier.BankAccount == "" {
		return fmt.Errorf("supplier bank account not configured")
	}

	// Calculate net disbursement (advance - total cost)
	netDisbursement := discounting.AdvanceAmount - discounting.TotalCost

	if netDisbursement <= 0 {
		return fmt.Errorf("net disbursement amount is invalid")
	}

	// Execute bank transfer
	transferSuccess, err := de.executeBankTransfer(
		supplier.BankAccount,
		netDisbursement,
		fmt.Sprintf("Invoice discounting advance for invoice %s", discounting.InvoiceID),
	)

	if err != nil || !transferSuccess {
		return fmt.Errorf("bank transfer failed: %w", err)
	}

	// Update discounting status
	discounting.Status = "disbursed"
	now := time.Now()
	discounting.DisbursementDate = &now

	return nil
}

func (de *DisbursementEngine) executeBankTransfer(accountNumber string, amount float64, narration string) (bool, error) {
	// In production, integrate with NIBSS or bank API
	// For now, simulate successful transfer
	fmt.Printf("Transferring ₦%.2f to account %s: %s\n", amount, accountNumber, narration)
	return true, nil
}

// ==================== SETTLEMENT ENGINE ====================

type SettlementEngine struct{}

func NewSettlementEngine() *SettlementEngine {
	return &SettlementEngine{}
}

// SettleInvoice settles invoice when buyer pays
func (se *SettlementEngine) SettleInvoice(discounting *InvoiceDiscounting, paymentAmount float64) error {
	// Validate discounting is disbursed
	if discounting.Status != "disbursed" {
		return fmt.Errorf("discounting must be disbursed before settlement")
	}

	// Validate payment amount
	expectedAmount := discounting.InvoiceAmount
	if math.Abs(paymentAmount-expectedAmount) > 0.01 {
		return fmt.Errorf("payment amount mismatch (expected: %.2f, received: %.2f)",
			expectedAmount, paymentAmount)
	}

	// Calculate remaining amount to supplier (if any)
	remainingAmount := discounting.InvoiceAmount - discounting.AdvanceAmount

	if remainingAmount > 0 {
		// Transfer remaining amount to supplier
		// In production, execute bank transfer
		fmt.Printf("Transferring remaining ₦%.2f to supplier\n", remainingAmount)
	}

	// Update discounting status
	discounting.Status = "settled"
	now := time.Now()
	discounting.SettlementDate = &now

	return nil
}

// ==================== CREDIT LIMIT MANAGER ====================

type CreditLimitManager struct{}

func NewCreditLimitManager() *CreditLimitManager {
	return &CreditLimitManager{}
}

// UpdateCreditLimit updates buyer's credit limit based on performance
func (clm *CreditLimitManager) UpdateCreditLimit(buyer *Buyer) error {
	// Analyze payment history
	if len(buyer.PaymentHistory) < 5 {
		// Not enough history to adjust
		return nil
	}

	onTimePayments := 0
	totalPayments := len(buyer.PaymentHistory)

	for _, payment := range buyer.PaymentHistory {
		if payment.Status == "on_time" {
			onTimePayments++
		}
	}

	onTimeRate := float64(onTimePayments) / float64(totalPayments)

	// Adjust credit limit based on performance
	if onTimeRate >= 0.95 {
		// Excellent performance - increase by 20%
		newLimit := buyer.CreditLimit * 1.20
		buyer.CreditLimit = math.Min(newLimit, 50000000.0) // Cap at ₦50M
	} else if onTimeRate >= 0.85 {
		// Good performance - increase by 10%
		newLimit := buyer.CreditLimit * 1.10
		buyer.CreditLimit = math.Min(newLimit, 50000000.0)
	} else if onTimeRate < 0.70 {
		// Poor performance - decrease by 20%
		buyer.CreditLimit = buyer.CreditLimit * 0.80
	}

	// Update available credit
	buyer.AvailableCredit = buyer.CreditLimit - buyer.UsedCredit

	return nil
}

// AllocateCredit allocates credit for a new invoice
func (clm *CreditLimitManager) AllocateCredit(buyer *Buyer, amount float64) error {
	if buyer.AvailableCredit < amount {
		return fmt.Errorf("insufficient credit limit")
	}

	buyer.UsedCredit += amount
	buyer.AvailableCredit -= amount

	return nil
}

// ReleaseCredit releases allocated credit when invoice is settled
func (clm *CreditLimitManager) ReleaseCredit(buyer *Buyer, amount float64) error {
	buyer.UsedCredit -= amount
	buyer.AvailableCredit += amount

	// Ensure available credit doesn't exceed limit
	if buyer.AvailableCredit > buyer.CreditLimit {
		buyer.AvailableCredit = buyer.CreditLimit
	}

	return nil
}

// ==================== EARLY PAYMENT DISCOUNT ====================

type EarlyPaymentCalculator struct{}

func NewEarlyPaymentCalculator() *EarlyPaymentCalculator {
	return &EarlyPaymentCalculator{}
}

// CalculateEarlyPaymentDiscount calculates discount for early payment
func (epc *EarlyPaymentCalculator) CalculateEarlyPaymentDiscount(
	invoiceAmount float64,
	dueDate time.Time,
	paymentDate time.Time,
	discountRate float64,
) float64 {
	
	// Calculate days early
	daysEarly := int(dueDate.Sub(paymentDate).Hours() / 24)

	if daysEarly <= 0 {
		return 0.0 // No discount for on-time or late payment
	}

	// Calculate discount (simple interest)
	discount := invoiceAmount * (discountRate / 100.0) * (float64(daysEarly) / 365.0)

	return discount
}
