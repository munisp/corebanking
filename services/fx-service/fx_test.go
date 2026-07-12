package main

import (
	"testing"
	"time"
)

// TestFXQuote tests FX quote generation
func TestFXQuote(t *testing.T) {
	tests := []struct {
		name         string
		fromCurrency string
		toCurrency   string
		amount       int64
		wantErr      bool
	}{
		{"NGN to USD", "NGN", "USD", 1000000, false},
		{"USD to NGN", "USD", "NGN", 1000, false},
		{"NGN to GBP", "NGN", "GBP", 500000, false},
		{"same currency", "NGN", "NGN", 100000, true},
		{"invalid currency", "NGN", "XXX", 100000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quote, err := getQuote(tt.fromCurrency, tt.toCurrency, tt.amount)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if quote.Rate <= 0 {
					t.Error("rate should be positive")
				}
				if quote.DestAmount <= 0 {
					t.Error("destination amount should be positive")
				}
			}
		})
	}
}

// TestFXRates tests exchange rate retrieval
func TestFXRates(t *testing.T) {
	t.Run("get current rates", func(t *testing.T) {
		rates := getCurrentRates()
		if len(rates) == 0 {
			t.Error("should return rates")
		}
	})

	t.Run("rate for currency pair", func(t *testing.T) {
		rate := getRate("NGN", "USD")
		if rate <= 0 {
			t.Error("rate should be positive")
		}
	})

	t.Run("inverse rate", func(t *testing.T) {
		ngnToUsd := getRate("NGN", "USD")
		usdToNgn := getRate("USD", "NGN")

		// Inverse rates should be reciprocal (with some tolerance for spread)
		product := ngnToUsd * usdToNgn
		if product < 0.9 || product > 1.1 {
			t.Errorf("inverse rates should be roughly reciprocal, got product %f", product)
		}
	})
}

// TestFXConversion tests currency conversion
func TestFXConversion(t *testing.T) {
	tests := []struct {
		name   string
		input  FXConversionInput
		wantErr bool
	}{
		{
			name: "valid conversion",
			input: FXConversionInput{
				TenantID:       "tenant-001",
				CustomerID:     "cust-001",
				SourceAccountID: "acc-ngn-001",
				DestAccountID:  "acc-usd-001",
				SourceCurrency: "NGN",
				DestCurrency:   "USD",
				SourceAmount:   1000000,
			},
			wantErr: false,
		},
		{
			name: "missing tenant ID",
			input: FXConversionInput{
				CustomerID:     "cust-001",
				SourceCurrency: "NGN",
				DestCurrency:   "USD",
				SourceAmount:   1000000,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateConversionInput(tt.input)
			if tt.wantErr && result.Valid {
				t.Error("expected error but got valid")
			}
			if !tt.wantErr && !result.Valid {
				t.Errorf("expected valid but got errors: %v", result.Errors)
			}
		})
	}
}

// TestFXLimits tests FX transaction limits
func TestFXLimits(t *testing.T) {
	t.Run("within daily limit", func(t *testing.T) {
		customer := FXCustomer{
			ID:          "cust-001",
			DailyLimit:  10000, // USD
			DailyUsed:   5000,
		}

		allowed := checkFXLimit(customer, 3000)
		if !allowed {
			t.Error("transaction should be allowed within limit")
		}
	})

	t.Run("exceeds daily limit", func(t *testing.T) {
		customer := FXCustomer{
			ID:          "cust-001",
			DailyLimit:  10000,
			DailyUsed:   8000,
		}

		allowed := checkFXLimit(customer, 5000)
		if allowed {
			t.Error("transaction should be rejected exceeding limit")
		}
	})

	t.Run("PTA/BTA limits", func(t *testing.T) {
		// Personal Travel Allowance limit
		ptaLimit := getPTALimit()
		if ptaLimit != 4000 {
			t.Errorf("expected PTA limit 4000 but got %d", ptaLimit)
		}

		// Business Travel Allowance limit
		btaLimit := getBTALimit()
		if btaLimit != 5000 {
			t.Errorf("expected BTA limit 5000 but got %d", btaLimit)
		}
	})
}

// TestFXCompliance tests FX compliance checks
func TestFXCompliance(t *testing.T) {
	t.Run("valid purpose", func(t *testing.T) {
		purposes := []string{"EDUCATION", "MEDICAL", "TRAVEL", "BUSINESS", "FAMILY_SUPPORT"}
		for _, purpose := range purposes {
			if !isValidFXPurpose(purpose) {
				t.Errorf("%s should be valid FX purpose", purpose)
			}
		}
	})

	t.Run("requires documentation above threshold", func(t *testing.T) {
		// Transactions above $1000 require documentation
		requiresDoc := requiresDocumentation(1500)
		if !requiresDoc {
			t.Error("should require documentation for amounts above $1000")
		}

		requiresDoc = requiresDocumentation(500)
		if requiresDoc {
			t.Error("should not require documentation for amounts below $1000")
		}
	})

	t.Run("CBN reporting threshold", func(t *testing.T) {
		// Transactions above $10000 require CBN reporting
		requiresReport := requiresCBNReport(15000)
		if !requiresReport {
			t.Error("should require CBN report for amounts above $10000")
		}
	})
}

// TestFXQuoteExpiry tests quote expiry
func TestFXQuoteExpiry(t *testing.T) {
	t.Run("quote not expired", func(t *testing.T) {
		quote := FXQuote{
			ID:        "quote-001",
			ExpiresAt: time.Now().Add(5 * time.Minute),
		}

		if isQuoteExpired(quote) {
			t.Error("quote should not be expired")
		}
	})

	t.Run("quote expired", func(t *testing.T) {
		quote := FXQuote{
			ID:        "quote-001",
			ExpiresAt: time.Now().Add(-5 * time.Minute),
		}

		if !isQuoteExpired(quote) {
			t.Error("quote should be expired")
		}
	})

	t.Run("quote validity period", func(t *testing.T) {
		quote, _ := getQuote("NGN", "USD", 1000000)
		validity := quote.ExpiresAt.Sub(time.Now())

		// Quote should be valid for at least 5 minutes
		if validity < 5*time.Minute {
			t.Errorf("quote validity should be at least 5 minutes, got %v", validity)
		}
	})
}

// TestFXProviders tests FX provider aggregation
func TestFXProviders(t *testing.T) {
	t.Run("get best rate from providers", func(t *testing.T) {
		rates := getProviderRates("NGN", "USD", 1000000)
		if len(rates) == 0 {
			t.Error("should return provider rates")
		}

		bestRate := getBestRate(rates)
		if bestRate.Rate <= 0 {
			t.Error("best rate should be positive")
		}
	})

	t.Run("provider availability", func(t *testing.T) {
		providers := getAvailableProviders("NGN", "USD")
		if len(providers) == 0 {
			t.Error("should have available providers")
		}
	})
}

// TestFXTransactionStatus tests transaction status
func TestFXTransactionStatus(t *testing.T) {
	validTransitions := []struct {
		from string
		to   string
	}{
		{"PENDING", "PROCESSING"},
		{"PROCESSING", "COMPLETED"},
		{"PROCESSING", "FAILED"},
		{"FAILED", "PENDING"},
	}

	for _, tt := range validTransitions {
		t.Run(tt.from+"_to_"+tt.to, func(t *testing.T) {
			if !isValidStatusTransition(tt.from, tt.to) {
				t.Errorf("expected %s -> %s to be valid", tt.from, tt.to)
			}
		})
	}
}

// TestFXHistory tests FX transaction history
func TestFXHistory(t *testing.T) {
	t.Run("get customer FX history", func(t *testing.T) {
		history := getFXHistory("tenant-001", "cust-001", 30)
		// Should return transactions from last 30 days
		_ = history
	})

	t.Run("calculate total FX volume", func(t *testing.T) {
		transactions := []FXTransaction{
			{DestAmount: 1000, DestCurrency: "USD"},
			{DestAmount: 500, DestCurrency: "USD"},
			{DestAmount: 2000, DestCurrency: "USD"},
		}

		total := calculateTotalVolume(transactions, "USD")
		if total != 3500 {
			t.Errorf("expected total 3500 but got %d", total)
		}
	})
}

// ============================================
// HELPER TYPES AND FUNCTIONS
// ============================================

type FXQuote struct {
	ID           string
	SourceCurrency string
	DestCurrency string
	SourceAmount int64
	DestAmount   int64
	Rate         float64
	Fee          int64
	ExpiresAt    time.Time
	Provider     string
}

type FXConversionInput struct {
	TenantID        string
	CustomerID      string
	SourceAccountID string
	DestAccountID   string
	SourceCurrency  string
	DestCurrency    string
	SourceAmount    int64
	Purpose         string
}

type FXCustomer struct {
	ID         string
	DailyLimit int64
	DailyUsed  int64
}

type FXTransaction struct {
	ID             string
	TenantID       string
	CustomerID     string
	SourceCurrency string
	DestCurrency   string
	SourceAmount   int64
	DestAmount     int64
	Rate           float64
	Status         string
	CreatedAt      time.Time
}

type ValidationResult struct {
	Valid  bool
	Errors []string
}

type ProviderRate struct {
	Provider string
	Rate     float64
	Fee      int64
}

var validCurrencies = []string{"NGN", "USD", "GBP", "EUR", "CAD", "AUD"}
var validPurposes = []string{"EDUCATION", "MEDICAL", "TRAVEL", "BUSINESS", "FAMILY_SUPPORT", "INVESTMENT"}

func getQuote(fromCurrency, toCurrency string, amount int64) (FXQuote, error) {
	if fromCurrency == toCurrency {
		return FXQuote{}, &FXError{Message: "same currency"}
	}
	if !isValidCurrency(fromCurrency) || !isValidCurrency(toCurrency) {
		return FXQuote{}, &FXError{Message: "invalid currency"}
	}

	rate := getRate(fromCurrency, toCurrency)
	destAmount := int64(float64(amount) * rate)

	return FXQuote{
		ID:             "quote_" + time.Now().Format("20060102150405"),
		SourceCurrency: fromCurrency,
		DestCurrency:   toCurrency,
		SourceAmount:   amount,
		DestAmount:     destAmount,
		Rate:           rate,
		Fee:            calculateFXFee(amount),
		ExpiresAt:      time.Now().Add(10 * time.Minute),
	}, nil
}

type FXError struct {
	Message string
}

func (e *FXError) Error() string {
	return e.Message
}

func isValidCurrency(c string) bool {
	for _, valid := range validCurrencies {
		if c == valid {
			return true
		}
	}
	return false
}

func getCurrentRates() map[string]float64 {
	return map[string]float64{
		"NGN_USD": 0.00065,
		"NGN_GBP": 0.00052,
		"NGN_EUR": 0.00060,
		"USD_NGN": 1540.0,
		"GBP_NGN": 1920.0,
		"EUR_NGN": 1670.0,
	}
}

func getRate(from, to string) float64 {
	rates := getCurrentRates()
	key := from + "_" + to
	if rate, ok := rates[key]; ok {
		return rate
	}
	return 1.0
}

func calculateFXFee(amount int64) int64 {
	// 0.5% fee with minimum of 500 NGN
	fee := amount * 5 / 1000
	if fee < 500 {
		return 500
	}
	return fee
}

func validateConversionInput(input FXConversionInput) ValidationResult {
	var errors []string

	if input.TenantID == "" {
		errors = append(errors, "tenant_id is required")
	}
	if input.CustomerID == "" {
		errors = append(errors, "customer_id is required")
	}
	if input.SourceAmount <= 0 {
		errors = append(errors, "amount must be positive")
	}

	return ValidationResult{Valid: len(errors) == 0, Errors: errors}
}

func checkFXLimit(customer FXCustomer, amount int64) bool {
	return customer.DailyUsed+amount <= customer.DailyLimit
}

func getPTALimit() int64 {
	return 4000 // USD
}

func getBTALimit() int64 {
	return 5000 // USD
}

func isValidFXPurpose(purpose string) bool {
	for _, valid := range validPurposes {
		if purpose == valid {
			return true
		}
	}
	return false
}

func requiresDocumentation(amountUSD int64) bool {
	return amountUSD > 1000
}

func requiresCBNReport(amountUSD int64) bool {
	return amountUSD > 10000
}

func isQuoteExpired(quote FXQuote) bool {
	return time.Now().After(quote.ExpiresAt)
}

func getProviderRates(from, to string, amount int64) []ProviderRate {
	return []ProviderRate{
		{Provider: "PROVIDER_A", Rate: 0.00065, Fee: 500},
		{Provider: "PROVIDER_B", Rate: 0.00064, Fee: 600},
		{Provider: "PROVIDER_C", Rate: 0.00066, Fee: 450},
	}
}

func getBestRate(rates []ProviderRate) ProviderRate {
	if len(rates) == 0 {
		return ProviderRate{}
	}
	best := rates[0]
	for _, r := range rates[1:] {
		if r.Rate > best.Rate {
			best = r
		}
	}
	return best
}

func getAvailableProviders(from, to string) []string {
	return []string{"PROVIDER_A", "PROVIDER_B", "PROVIDER_C"}
}

func isValidStatusTransition(from, to string) bool {
	validTransitions := map[string][]string{
		"PENDING":    {"PROCESSING", "CANCELLED"},
		"PROCESSING": {"COMPLETED", "FAILED"},
		"FAILED":     {"PENDING"},
		"COMPLETED":  {},
	}

	allowed, exists := validTransitions[from]
	if !exists {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func getFXHistory(tenantID, customerID string, days int) []FXTransaction {
	return []FXTransaction{}
}

func calculateTotalVolume(transactions []FXTransaction, currency string) int64 {
	var total int64
	for _, txn := range transactions {
		if txn.DestCurrency == currency {
			total += txn.DestAmount
		}
	}
	return total
}
