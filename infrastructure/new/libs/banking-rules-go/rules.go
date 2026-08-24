// Package bankingrules provides shared Nigerian banking domain logic.
// All monetary amounts are in kobo (int64) to avoid float precision errors.
package bankingrules

import (
	"fmt"
	"strings"
	"time"
)

// ─── Monetary Type ──────────────────────────────────────────────────────────

// AmountKobo represents money in smallest unit (kobo = 1/100 Naira).
// NEVER use float64 for money.
type AmountKobo int64

func FromNaira(naira float64) AmountKobo { return AmountKobo(int64(naira * 100)) }
func (a AmountKobo) Naira() float64      { return float64(a) / 100.0 }
func (a AmountKobo) String() string      { return fmt.Sprintf("₦%d.%02d", a/100, abs64(int64(a)%100)) }

func abs64(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

// ─── CBN Tiered KYC Limits ──────────────────────────────────────────────────

type TierLimits struct {
	MaxSingleDebit AmountKobo
	MaxDaily       AmountKobo
	MaxBalance     AmountKobo
	RequiredDocs   []string
}

var CBNTierLimits = map[string]TierLimits{
	"tier1": {MaxSingleDebit: 5_000_000, MaxDaily: 30_000_000, MaxBalance: 30_000_000, RequiredDocs: []string{"phone"}},
	"tier2": {MaxSingleDebit: 20_000_000, MaxDaily: 50_000_000, MaxBalance: 50_000_000, RequiredDocs: []string{"bvn", "phone", "dob"}},
	"tier3": {MaxSingleDebit: 500_000_000, MaxDaily: 1_000_000_000, MaxBalance: 0, RequiredDocs: []string{"bvn", "nin", "address_proof", "passport_photo", "utility_bill"}},
}

// ValidateTierTransaction checks a transaction against CBN tier limits.
func ValidateTierTransaction(tier string, amountKobo AmountKobo, dailyTotalKobo AmountKobo) (bool, string) {
	limits, ok := CBNTierLimits[tier]
	if !ok {
		return false, "unknown KYC tier"
	}
	if amountKobo > limits.MaxSingleDebit {
		return false, fmt.Sprintf("exceeds %s single debit limit %s", tier, limits.MaxSingleDebit)
	}
	if dailyTotalKobo+amountKobo > limits.MaxDaily {
		return false, fmt.Sprintf("exceeds %s daily cumulative limit %s", tier, limits.MaxDaily)
	}
	return true, ""
}

// ─── NUBAN Validation ───────────────────────────────────────────────────────

// ValidateNUBAN validates Nigerian Uniform Bank Account Number with check digit.
func ValidateNUBAN(bankCode, accountNumber string) (bool, string) {
	if len(accountNumber) != 10 {
		return false, "NUBAN must be 10 digits"
	}
	if len(bankCode) != 3 {
		return false, "bank code must be 3 digits"
	}
	serial := bankCode + accountNumber[:9]
	weights := []int{3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3}
	total := 0
	for i := 0; i < len(serial) && i < len(weights); i++ {
		d := int(serial[i] - '0')
		total += d * weights[i]
	}
	checkDigit := (10 - (total % 10)) % 10
	actual := int(accountNumber[9] - '0')
	if checkDigit != actual {
		return false, fmt.Sprintf("NUBAN check digit mismatch: expected %d", checkDigit)
	}
	return true, ""
}

// ─── BVN / NIN Validation ───────────────────────────────────────────────────

func ValidateBVN(bvn string) (bool, string) {
	if len(bvn) != 11 {
		return false, "BVN must be 11 digits"
	}
	for _, c := range bvn {
		if c < '0' || c > '9' {
			return false, "BVN must contain only digits"
		}
	}
	if bvn[:2] == "00" {
		return false, "invalid BVN issuer code"
	}
	return true, ""
}

func ValidateNIN(nin string) (bool, string) {
	if len(nin) != 11 {
		return false, "NIN must be 11 digits"
	}
	for _, c := range nin {
		if c < '0' || c > '9' {
			return false, "NIN must contain only digits"
		}
	}
	return true, ""
}

// ─── NFIU Threshold Reporting ───────────────────────────────────────────────

// CheckNFIUThreshold checks if a transaction triggers a Currency Transaction Report.
func CheckNFIUThreshold(amountKobo AmountKobo, txnType string) (bool, string) {
	switch txnType {
	case "cash_deposit", "cash_withdrawal":
		if amountKobo >= 500_000_000 { // ₦5M
			return true, "NFIU: Cash transaction ≥₦5M requires CTR filing"
		}
	case "transfer", "wire":
		if amountKobo >= 1_000_000_000 { // ₦10M
			return true, "NFIU: Transfer ≥₦10M requires CTR filing"
		}
	}
	return false, ""
}

// ─── AML Risk Scoring ───────────────────────────────────────────────────────

type AMLFactors struct {
	IsPEP             bool
	IsHighRiskCountry bool
	CashIntensive     bool
	IsStructuring     bool
	HasAdverseMedia   bool
	TxnAmountKobo     AmountKobo
	AccountAgeMonths  int
}

// ComputeAMLRiskScore returns score (0-100) and list of triggered indicators.
func ComputeAMLRiskScore(f AMLFactors) (float64, []string) {
	score := 0.0
	var indicators []string
	if f.IsPEP {
		score += 30
		indicators = append(indicators, "PEP_STATUS")
	}
	if f.IsHighRiskCountry {
		score += 25
		indicators = append(indicators, "HIGH_RISK_JURISDICTION")
	}
	if f.CashIntensive {
		score += 15
		indicators = append(indicators, "CASH_INTENSIVE")
	}
	if f.IsStructuring {
		score += 35
		indicators = append(indicators, "STRUCTURING_DETECTED")
	}
	if f.HasAdverseMedia {
		score += 20
		indicators = append(indicators, "ADVERSE_MEDIA")
	}
	if f.TxnAmountKobo > 1_000_000_000 {
		score += 10
		indicators = append(indicators, "HIGH_VALUE_TXN")
	}
	if f.AccountAgeMonths < 3 {
		score += 10
		indicators = append(indicators, "NEW_ACCOUNT")
	}
	if score > 100 {
		score = 100
	}
	return score, indicators
}

// DetectStructuring detects multiple just-below-threshold transactions.
func DetectStructuring(amountsKobo []AmountKobo, thresholdKobo AmountKobo) bool {
	count := 0
	floor := AmountKobo(float64(thresholdKobo) * 0.8)
	for _, a := range amountsKobo {
		if a >= floor && a < thresholdKobo {
			count++
		}
	}
	return count >= 3
}

// ─── Financial Calculations ─────────────────────────────────────────────────

// ComputeEMI calculates Equated Monthly Installment in kobo.
func ComputeEMI(principalKobo AmountKobo, annualRatePct float64, tenorMonths int) AmountKobo {
	if tenorMonths <= 0 {
		return 0
	}
	if annualRatePct == 0 {
		return AmountKobo(int64(principalKobo) / int64(tenorMonths))
	}
	r := annualRatePct / 12.0 / 100.0
	n := float64(tenorMonths)
	p := float64(principalKobo)
	pow := 1.0
	for i := 0; i < tenorMonths; i++ {
		pow *= (1 + r)
	}
	emi := p * r * pow / (pow - 1)
	return AmountKobo(int64(emi + 0.5)) // round
}

// ComputeDTI calculates Debt-to-Income ratio as percentage.
func ComputeDTI(monthlyIncomeKobo, existingDebtKobo, proposedEMIKobo AmountKobo) float64 {
	if monthlyIncomeKobo <= 0 {
		return 100.0
	}
	return float64(existingDebtKobo+proposedEMIKobo) / float64(monthlyIncomeKobo) * 100.0
}

// ComputeDailyAccrual calculates daily interest accrual.
func ComputeDailyAccrual(principalKobo AmountKobo, annualRatePct float64, dayBasis int) AmountKobo {
	if dayBasis <= 0 {
		dayBasis = 365
	}
	daily := float64(principalKobo) * annualRatePct / 100.0 / float64(dayBasis)
	return AmountKobo(int64(daily + 0.5))
}

// ProvisioningRate returns CBN Prudential Guidelines rate based on days past due.
func ProvisioningRate(daysPastDue int) float64 {
	switch {
	case daysPastDue <= 90:
		return 1.0 // Performing
	case daysPastDue <= 180:
		return 10.0 // Watchlist
	case daysPastDue <= 360:
		return 50.0 // Substandard
	case daysPastDue <= 720:
		return 75.0 // Doubtful
	default:
		return 100.0 // Lost
	}
}

// ─── State Machine ──────────────────────────────────────────────────────────

type StateMachine struct {
	Transitions map[string][]string
}

func (sm *StateMachine) CanTransition(from, to string) bool {
	allowed, ok := sm.Transitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// BankingStateMachine provides standard banking transaction state transitions.
var BankingStateMachine = &StateMachine{
	Transitions: map[string][]string{
		"draft":        {"submitted", "cancelled"},
		"submitted":    {"under_review", "rejected", "cancelled"},
		"under_review": {"approved", "rejected"},
		"approved":     {"processing", "cancelled"},
		"processing":   {"completed", "failed"},
		"completed":    {"reversed"},
		"failed":       {"submitted"},
	},
}

// ─── Idempotency ────────────────────────────────────────────────────────────

// IdempotencyStore interface for checking/storing idempotency keys.
type IdempotencyStore interface {
	Check(key string) (response []byte, exists bool, err error)
	Store(key string, response []byte, ttl time.Duration) error
}

// ─── Maker-Checker ──────────────────────────────────────────────────────────

type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending_approval"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
)

type MakerCheckerRequest struct {
	RequestID  string         `json:"request_id"`
	Operation  string         `json:"operation"`
	MakerID    string         `json:"maker_id"`
	CheckerID  string         `json:"checker_id,omitempty"`
	AmountKobo AmountKobo     `json:"amount_kobo"`
	Status     ApprovalStatus `json:"status"`
	Payload    interface{}    `json:"payload"`
	CreatedAt  time.Time      `json:"created_at"`
	DecidedAt  *time.Time     `json:"decided_at,omitempty"`
}

// RequiresMakerChecker determines if operation needs dual authorization.
func RequiresMakerChecker(operation string, amountKobo AmountKobo) bool {
	// CBN requires dual control for transactions > ₦1M
	thresholds := map[string]AmountKobo{
		"transfer":      100_000_000, // ₦1M
		"loan_disburse": 100_000_000,
		"gl_posting":    50_000_000, // ₦500K for GL
		"account_close": 0,          // Always requires checker
	}
	threshold, ok := thresholds[operation]
	if !ok {
		return amountKobo >= 100_000_000 // Default ₦1M
	}
	return amountKobo >= threshold
}

// ─── Audit Trail ────────────────────────────────────────────────────────────

type AuditEntry struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	Service    string    `json:"service"`
	Operation  string    `json:"operation"`
	ActorID    string    `json:"actor_id"`
	EntityID   string    `json:"entity_id"`
	EntityType string    `json:"entity_type"`
	OldState   string    `json:"old_state,omitempty"`
	NewState   string    `json:"new_state,omitempty"`
	IPAddress  string    `json:"ip_address,omitempty"`
	Immutable  bool      `json:"immutable"` // always true
}

// ─── PII Masking (NDPR) ─────────────────────────────────────────────────────

func MaskPII(value, fieldType string) string {
	if len(value) == 0 {
		return "***"
	}
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 {
			return "***" + value[len(value)-4:]
		}
	case "account":
		if len(value) >= 4 {
			return "****" + value[len(value)-4:]
		}
	case "phone":
		if len(value) >= 4 {
			return "+234***" + value[len(value)-4:]
		}
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 && len(parts[0]) > 0 {
			return string(parts[0][0]) + "***@" + parts[1]
		}
	}
	return "***"
}

// ─── Velocity Rules ─────────────────────────────────────────────────────────

type VelocityRule struct {
	MaxAmountKobo AmountKobo
	MaxCount      int
	WindowHours   int
	Description   string
}

var DefaultVelocityRules = []VelocityRule{
	{MaxAmountKobo: 490_000_000, MaxCount: 3, WindowHours: 24, Description: "3x near-threshold in 24h"},
	{MaxAmountKobo: 100_000_000, MaxCount: 10, WindowHours: 1, Description: "10 transfers in 1h"},
	{MaxAmountKobo: 50_000_000, MaxCount: 20, WindowHours: 24, Description: "20 transfers in 24h"},
}
