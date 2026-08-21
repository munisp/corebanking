package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"time"
)

// ==================== REAL INTEGRATION CLIENTS ====================
//
// Doctrine: bank transfers go through the real payments rail; KYC status
// comes from the real KYC service or is "unknown". Nothing is hardcoded.

var supplyChainHTTPClient = &http.Client{Timeout: 15 * time.Second}

func paymentsRailURL() string {
	if v := os.Getenv("PAYMENTS_RAIL_URL"); v != "" {
		return v
	}
	return os.Getenv("PAYMENTS_HUB_URL") // may be empty => transfers fail closed
}

func kycServiceURL() string {
	return os.Getenv("KYC_SERVICE_URL") // may be empty => KYC status "unknown"
}

// getKYCStatus queries the KYC service for an entity's verification status.
// Returns "verified", another provider-reported status, or "unknown" when the
// KYC service is unconfigured/unreachable. Never returns a hardcoded value.
func getKYCStatus(ctx context.Context, entityID string) string {
	base := kycServiceURL()
	if base == "" || entityID == "" {
		return "unknown"
	}
	req, err := http.NewRequestWithContext(ctx, "GET", base+"/v1/kyc/"+entityID, nil)
	if err != nil {
		return "unknown"
	}
	resp, err := supplyChainHTTPClient.Do(req)
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "unknown"
	}
	var body struct {
		Status      string `json:"status"`
		KYCVerified *bool  `json:"kycVerified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "unknown"
	}
	if body.KYCVerified != nil {
		if *body.KYCVerified {
			return "verified"
		}
		return "not_verified"
	}
	if body.Status != "" {
		return body.Status
	}
	return "unknown"
}

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

// getSupplier loads the supplier from Postgres. KYC status is resolved
// against the real KYC service; when it cannot be determined the supplier is
// treated as NOT KYC-verified (fail-closed for financing decisions).
func (v *InvoiceVerifier) getSupplier(supplierID string) (*Supplier, error) {
	if db == nil {
		return nil, fmt.Errorf("supplier store unavailable")
	}
	s := &Supplier{}
	err := db.QueryRow(
		`SELECT supplier_id, COALESCE(business_name,''), COALESCE(registration_no,''),
			COALESCE(tax_id,''), COALESCE(bank_account,''), COALESCE(credit_rating,''),
			COALESCE(credit_limit,0), COALESCE(outstanding_amount,0), COALESCE(status,''), created_at
		 FROM suppliers WHERE supplier_id = $1`, supplierID).
		Scan(&s.ID, &s.BusinessName, &s.RegistrationNo, &s.TaxID, &s.BankAccount,
			&s.CreditRating, &s.CreditLimit, &s.OutstandingAmount, &s.Status, &s.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("supplier %s not found", supplierID)
		}
		return nil, fmt.Errorf("supplier lookup failed: %w", err)
	}
	// KYC from the real KYC service; "unknown" is never treated as verified.
	s.KYCVerified = getKYCStatus(context.Background(), supplierID) == "verified"
	return s, nil
}

// getBuyer loads the buyer (incl. real payment history) from Postgres, with
// KYC resolved via the KYC service (unknown => not verified).
func (v *InvoiceVerifier) getBuyer(buyerID string) (*Buyer, error) {
	if db == nil {
		return nil, fmt.Errorf("buyer store unavailable")
	}
	b := &Buyer{}
	err := db.QueryRow(
		`SELECT buyer_id, COALESCE(business_name,''), COALESCE(registration_no,''),
			COALESCE(tax_id,''), COALESCE(credit_limit,0), COALESCE(used_credit,0), COALESCE(status,''), created_at
		 FROM buyers WHERE buyer_id = $1`, buyerID).
		Scan(&b.ID, &b.BusinessName, &b.RegistrationNo, &b.TaxID,
			&b.CreditLimit, &b.UsedCredit, &b.Status, &b.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("buyer %s not found", buyerID)
		}
		return nil, fmt.Errorf("buyer lookup failed: %w", err)
	}
	b.AvailableCredit = b.CreditLimit - b.UsedCredit

	rows, err := db.Query(
		`SELECT invoice_id, amount, due_date, paid_date, days_late, status
		 FROM buyer_payment_history WHERE buyer_id = $1 ORDER BY paid_date DESC LIMIT 200`, buyerID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pr PaymentRecord
			if rows.Scan(&pr.InvoiceID, &pr.Amount, &pr.DueDate, &pr.PaidDate, &pr.DaysLate, &pr.Status) == nil {
				b.PaymentHistory = append(b.PaymentHistory, pr)
			}
		}
	}
	b.KYCVerified = getKYCStatus(context.Background(), buyerID) == "verified"
	return b, nil
}

// checkDuplicate performs a real duplicate check against stored invoices.
// On lookup error it returns true (fail-closed: block financing rather than
// risk double-financing the same invoice).
func (v *InvoiceVerifier) checkDuplicate(invoiceNumber string, supplierID string) bool {
	if db == nil {
		return true
	}
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM invoices WHERE invoice_number = $1 AND supplier_id = $2`,
		invoiceNumber, supplierID).Scan(&count); err != nil {
		return true
	}
	return count > 0
}

// verifyPurchaseOrder verifies the PO exists for the buyer in Postgres.
// Lookup errors fail closed (PO treated as invalid).
func (v *InvoiceVerifier) verifyPurchaseOrder(poRef string, buyerID string) bool {
	if db == nil {
		return false
	}
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM purchase_orders WHERE po_ref = $1 AND buyer_id = $2 AND status IN ('approved','issued')`,
		poRef, buyerID).Scan(&count); err != nil {
		return false
	}
	return count > 0
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

	// Execute bank transfer via the real payments rail. On any failure the
	// discounting stays "approved" and the caller maps this to 502.
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

// executeBankTransfer executes a real transfer through the payments rail
// (PAYMENTS_RAIL_URL / PAYMENTS_HUB_URL). It returns true only when the rail
// confirms the transfer. When the rail is unconfigured, unreachable, or
// rejects the transfer, it returns false + error — no success is simulated.
func (de *DisbursementEngine) executeBankTransfer(accountNumber string, amount float64, narration string) (bool, error) {
	base := paymentsRailURL()
	if base == "" {
		return false, fmt.Errorf("payments rail unconfigured (set PAYMENTS_RAIL_URL or PAYMENTS_HUB_URL)")
	}
	payload, err := json.Marshal(map[string]interface{}{
		"accountNumber": accountNumber,
		"amount":        amount,
		"currency":      "NGN",
		"narration":     narration,
		"source":        "finance-service/supply-chain",
	})
	if err != nil {
		return false, err
	}
	resp, err := supplyChainHTTPClient.Post(base+"/v1/transfers", "application/json", bytes.NewReader(payload))
	if err != nil {
		return false, fmt.Errorf("payments rail call failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusAccepted {
		return false, fmt.Errorf("payments rail returned status %d", resp.StatusCode)
	}
	var result struct {
		Success       *bool  `json:"success"`
		Status        string `json:"status"`
		TransferID    string `json:"transferId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("payments rail returned invalid JSON: %w", err)
	}
	switch {
	case result.Success != nil:
		if !*result.Success {
			return false, fmt.Errorf("payments rail rejected transfer (status=%s)", result.Status)
		}
		return true, nil
	case result.Status != "":
		if result.Status == "success" || result.Status == "completed" || result.Status == "accepted" {
			return true, nil
		}
		return false, fmt.Errorf("payments rail transfer status: %s", result.Status)
	default:
		// A rail that cannot state its outcome must not be treated as success.
		return false, fmt.Errorf("payments rail response contained no transfer outcome")
	}
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
		// Transfer remaining amount to supplier via the real payments rail.
		// On failure the discounting is NOT marked settled.
		supplier, err := NewInvoiceVerifier().getSupplier(discounting.SupplierID)
		if err != nil || supplier.BankAccount == "" {
			return fmt.Errorf("cannot settle: supplier account unavailable: %v", err)
		}
		de := NewDisbursementEngine()
		ok, err := de.executeBankTransfer(
			supplier.BankAccount,
			remainingAmount,
			fmt.Sprintf("Residual settlement for invoice %s", discounting.InvoiceID),
		)
		if err != nil || !ok {
			return fmt.Errorf("residual settlement transfer failed: %w", err)
		}
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
