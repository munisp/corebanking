package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ============================================================================
// VAN MONETIZATION SERVICE
// Handles pricing tiers, fee calculation, and billing for Virtual Accounts
// ============================================================================

// PricingTier represents a VAN pricing tier
type PricingTier string

const (
	TierBasic      PricingTier = "basic"
	TierStandard   PricingTier = "standard"
	TierPremium    PricingTier = "premium"
	TierEnterprise PricingTier = "enterprise"
)

// FeeType represents different types of VAN fees
type FeeType string

const (
	FeeCreation     FeeType = "creation"
	FeeMonthly      FeeType = "monthly"
	FeeTransaction  FeeType = "transaction"
	FeeSweep        FeeType = "sweep"
	FeeReactivation FeeType = "reactivation"
)

// TierConfig holds configuration for a pricing tier
type TierConfig struct {
	Tier              PricingTier  `json:"tier"`
	Name              string       `json:"name"`
	Description       string       `json:"description"`
	MonthlyFee        float64      `json:"monthly_fee"`
	VANsIncluded      int          `json:"vans_included"`
	MaxVANsPerMonth   int          `json:"max_vans_per_month"`
	RequestsPerMinute int          `json:"requests_per_minute"`
	CreationFee       float64      `json:"creation_fee"`
	TransactionFee    FeeStructure `json:"transaction_fee"`
	SweepFee          FeeStructure `json:"sweep_fee"`
	WebhookRetries    int          `json:"webhook_retries"`
	SupportLevel      string       `json:"support_level"`
	Features          []string     `json:"features"`
}

// FeeStructure defines how fees are calculated
type FeeStructure struct {
	Type       string    `json:"type"` // "flat", "percentage", "tiered"
	FlatAmount float64   `json:"flat_amount,omitempty"`
	Percentage float64   `json:"percentage,omitempty"`
	MinFee     float64   `json:"min_fee,omitempty"`
	MaxFee     float64   `json:"max_fee,omitempty"`
	Tiers      []FeeTier `json:"tiers,omitempty"`
}

// FeeTier defines a tier in tiered fee structure
type FeeTier struct {
	MinAmount  float64 `json:"min_amount"`
	MaxAmount  float64 `json:"max_amount"`
	Percentage float64 `json:"percentage"`
	FlatFee    float64 `json:"flat_fee"`
}

// VANFee represents a calculated fee
type VANFee struct {
	FeeID       string     `json:"fee_id"`
	VANID       string     `json:"van_id,omitempty"`
	TenantID    string     `json:"tenant_id"`
	CustomerID  string     `json:"customer_id"`
	FeeType     FeeType    `json:"fee_type"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"`
	Description string     `json:"description"`
	Reference   string     `json:"reference,omitempty"`
	Status      string     `json:"status"` // pending, charged, failed, waived
	CreatedAt   time.Time  `json:"created_at"`
	ChargedAt   *time.Time `json:"charged_at,omitempty"`
}

// TenantSubscription represents a tenant's VAN subscription
type TenantSubscription struct {
	SubscriptionID    string         `json:"subscription_id"`
	TenantID          string         `json:"tenant_id"`
	Tier              PricingTier    `json:"tier"`
	Status            string         `json:"status"` // active, suspended, cancelled
	VANsUsed          int            `json:"vans_used"`
	VANsLimit         int            `json:"vans_limit"`
	BillingCycleStart time.Time      `json:"billing_cycle_start"`
	BillingCycleEnd   time.Time      `json:"billing_cycle_end"`
	MonthlyFee        float64        `json:"monthly_fee"`
	CustomPricing     *CustomPricing `json:"custom_pricing,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

// CustomPricing for enterprise tier
type CustomPricing struct {
	MonthlyFee        float64      `json:"monthly_fee"`
	CreationFee       float64      `json:"creation_fee"`
	TransactionFee    FeeStructure `json:"transaction_fee"`
	SweepFee          FeeStructure `json:"sweep_fee"`
	VANsIncluded      int          `json:"vans_included"`
	MaxVANsPerMonth   int          `json:"max_vans_per_month"`
	RequestsPerMinute int          `json:"requests_per_minute"`
}

// UsageRecord tracks VAN usage for billing
type UsageRecord struct {
	RecordID      string    `json:"record_id"`
	TenantID      string    `json:"tenant_id"`
	VANID         string    `json:"van_id,omitempty"`
	UsageType     string    `json:"usage_type"` // van_created, payment_received, sweep_executed
	Amount        float64   `json:"amount,omitempty"`
	Quantity      int       `json:"quantity"`
	BillingPeriod string    `json:"billing_period"` // YYYY-MM
	CreatedAt     time.Time `json:"created_at"`
}

// Invoice represents a billing invoice
type Invoice struct {
	InvoiceID     string        `json:"invoice_id"`
	TenantID      string        `json:"tenant_id"`
	BillingPeriod string        `json:"billing_period"`
	Status        string        `json:"status"` // draft, pending, paid, overdue, cancelled
	Subtotal      float64       `json:"subtotal"`
	Tax           float64       `json:"tax"`
	Total         float64       `json:"total"`
	Currency      string        `json:"currency"`
	LineItems     []InvoiceItem `json:"line_items"`
	DueDate       time.Time     `json:"due_date"`
	PaidAt        *time.Time    `json:"paid_at,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
}

// InvoiceItem represents a line item on an invoice
type InvoiceItem struct {
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Amount      float64 `json:"amount"`
	FeeType     FeeType `json:"fee_type"`
}

// Prometheus metrics
var (
	vanFeesCharged = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "van_fees_charged_total",
		Help: "Total VAN fees charged",
	}, []string{"tenant_id", "fee_type"})

	vanFeesAmount = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "van_fees_amount_total",
		Help: "Total VAN fee amounts charged",
	}, []string{"tenant_id", "fee_type"})

	vanSubscriptionsByTier = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "van_subscriptions_by_tier",
		Help: "Number of VAN subscriptions by tier",
	}, []string{"tier"})
)

// MonetizationService handles VAN monetization
type MonetizationService struct {
	mu            sync.RWMutex
	tierConfigs   map[PricingTier]TierConfig
	subscriptions map[string]*TenantSubscription // tenantID -> subscription
	fees          map[string]*VANFee             // feeID -> fee
	usage         map[string][]UsageRecord       // tenantID -> usage records
	invoices      map[string]*Invoice            // invoiceID -> invoice
	billingURL    string
}

// NewMonetizationService creates a new monetization service
func NewMonetizationService(billingURL string) *MonetizationService {
	ms := &MonetizationService{
		tierConfigs:   make(map[PricingTier]TierConfig),
		subscriptions: make(map[string]*TenantSubscription),
		fees:          make(map[string]*VANFee),
		usage:         make(map[string][]UsageRecord),
		invoices:      make(map[string]*Invoice),
		billingURL:    billingURL,
	}
	ms.initializeTierConfigs()
	return ms
}

// initializeTierConfigs sets up the default pricing tiers
func (ms *MonetizationService) initializeTierConfigs() {
	ms.tierConfigs = map[PricingTier]TierConfig{
		TierBasic: {
			Tier:              TierBasic,
			Name:              "Basic",
			Description:       "For small businesses and startups",
			MonthlyFee:        5000.00, // ₦5,000/month
			VANsIncluded:      100,
			MaxVANsPerMonth:   100,
			RequestsPerMinute: 60,
			CreationFee:       50.00, // ₦50 per VAN
			TransactionFee: FeeStructure{
				Type:       "percentage",
				Percentage: 0.5,    // 0.5%
				MinFee:     10.00,  // Min ₦10
				MaxFee:     500.00, // Max ₦500
			},
			SweepFee: FeeStructure{
				Type:       "flat",
				FlatAmount: 25.00, // ₦25 per sweep
			},
			WebhookRetries: 3,
			SupportLevel:   "email",
			Features: []string{
				"Basic VAN management",
				"Email support",
				"Standard webhooks",
				"Basic analytics",
			},
		},
		TierStandard: {
			Tier:              TierStandard,
			Name:              "Standard",
			Description:       "For growing businesses",
			MonthlyFee:        25000.00, // ₦25,000/month
			VANsIncluded:      1000,
			MaxVANsPerMonth:   1000,
			RequestsPerMinute: 300,
			CreationFee:       25.00, // ₦25 per VAN (50% discount)
			TransactionFee: FeeStructure{
				Type:       "percentage",
				Percentage: 0.3,    // 0.3%
				MinFee:     5.00,   // Min ₦5
				MaxFee:     300.00, // Max ₦300
			},
			SweepFee: FeeStructure{
				Type:       "flat",
				FlatAmount: 15.00, // ₦15 per sweep
			},
			WebhookRetries: 5,
			SupportLevel:   "priority",
			Features: []string{
				"Advanced VAN management",
				"Priority email support",
				"Enhanced webhooks with retries",
				"Advanced analytics",
				"Bulk VAN creation",
				"Custom labels",
			},
		},
		TierPremium: {
			Tier:              TierPremium,
			Name:              "Premium",
			Description:       "For large enterprises",
			MonthlyFee:        100000.00, // ₦100,000/month
			VANsIncluded:      10000,
			MaxVANsPerMonth:   10000,
			RequestsPerMinute: 1000,
			CreationFee:       10.00, // ₦10 per VAN (80% discount)
			TransactionFee: FeeStructure{
				Type: "tiered",
				Tiers: []FeeTier{
					{MinAmount: 0, MaxAmount: 100000, Percentage: 0.2, FlatFee: 0},
					{MinAmount: 100000, MaxAmount: 1000000, Percentage: 0.15, FlatFee: 0},
					{MinAmount: 1000000, MaxAmount: math.MaxFloat64, Percentage: 0.1, FlatFee: 0},
				},
				MinFee: 2.00,   // Min ₦2
				MaxFee: 200.00, // Max ₦200
			},
			SweepFee: FeeStructure{
				Type:       "flat",
				FlatAmount: 10.00, // ₦10 per sweep
			},
			WebhookRetries: 10,
			SupportLevel:   "dedicated",
			Features: []string{
				"Full VAN management suite",
				"Dedicated account manager",
				"Real-time webhooks",
				"Custom analytics dashboards",
				"Bulk operations",
				"API priority access",
				"Custom integrations",
				"SLA guarantee",
			},
		},
		TierEnterprise: {
			Tier:              TierEnterprise,
			Name:              "Enterprise",
			Description:       "Custom pricing for large organizations",
			MonthlyFee:        0, // Custom pricing
			VANsIncluded:      0, // Unlimited
			MaxVANsPerMonth:   0, // Unlimited
			RequestsPerMinute: 0, // Unlimited
			CreationFee:       0, // Custom
			TransactionFee:    FeeStructure{Type: "custom"},
			SweepFee:          FeeStructure{Type: "custom"},
			WebhookRetries:    0, // Unlimited
			SupportLevel:      "enterprise",
			Features: []string{
				"Unlimited VANs",
				"Custom pricing",
				"Dedicated infrastructure",
				"24/7 enterprise support",
				"Custom SLA",
				"On-premise deployment option",
				"White-label solution",
				"Custom integrations",
				"Compliance assistance",
			},
		},
	}
}

// GetTierConfig returns the configuration for a pricing tier
func (ms *MonetizationService) GetTierConfig(tier PricingTier) (TierConfig, bool) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	config, ok := ms.tierConfigs[tier]
	return config, ok
}

// GetAllTierConfigs returns all pricing tier configurations
func (ms *MonetizationService) GetAllTierConfigs() []TierConfig {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	configs := make([]TierConfig, 0, len(ms.tierConfigs))
	for _, config := range ms.tierConfigs {
		configs = append(configs, config)
	}
	return configs
}

// CreateSubscription creates a new tenant subscription
func (ms *MonetizationService) CreateSubscription(tenantID string, tier PricingTier, customPricing *CustomPricing) (*TenantSubscription, error) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	if _, exists := ms.subscriptions[tenantID]; exists {
		return nil, fmt.Errorf("subscription already exists for tenant %s", tenantID)
	}

	config, ok := ms.tierConfigs[tier]
	if !ok {
		return nil, fmt.Errorf("invalid tier: %s", tier)
	}

	now := time.Now()
	subscription := &TenantSubscription{
		SubscriptionID:    fmt.Sprintf("sub_%d", now.UnixNano()),
		TenantID:          tenantID,
		Tier:              tier,
		Status:            "active",
		VANsUsed:          0,
		VANsLimit:         config.VANsIncluded,
		BillingCycleStart: now,
		BillingCycleEnd:   now.AddDate(0, 1, 0),
		MonthlyFee:        config.MonthlyFee,
		CustomPricing:     customPricing,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if tier == TierEnterprise && customPricing != nil {
		subscription.MonthlyFee = customPricing.MonthlyFee
		subscription.VANsLimit = customPricing.VANsIncluded
	}

	ms.subscriptions[tenantID] = subscription
	vanSubscriptionsByTier.WithLabelValues(string(tier)).Inc()

	return subscription, nil
}

// GetSubscription returns a tenant's subscription
func (ms *MonetizationService) GetSubscription(tenantID string) (*TenantSubscription, bool) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	sub, ok := ms.subscriptions[tenantID]
	return sub, ok
}

// UpdateSubscriptionTier upgrades or downgrades a subscription
func (ms *MonetizationService) UpdateSubscriptionTier(tenantID string, newTier PricingTier) (*TenantSubscription, error) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	sub, ok := ms.subscriptions[tenantID]
	if !ok {
		return nil, fmt.Errorf("subscription not found for tenant %s", tenantID)
	}

	config, ok := ms.tierConfigs[newTier]
	if !ok {
		return nil, fmt.Errorf("invalid tier: %s", newTier)
	}

	oldTier := sub.Tier
	sub.Tier = newTier
	sub.VANsLimit = config.VANsIncluded
	sub.MonthlyFee = config.MonthlyFee
	sub.UpdatedAt = time.Now()

	vanSubscriptionsByTier.WithLabelValues(string(oldTier)).Dec()
	vanSubscriptionsByTier.WithLabelValues(string(newTier)).Inc()

	return sub, nil
}

// CalculateFee calculates the fee for a given operation
func (ms *MonetizationService) CalculateFee(tenantID string, feeType FeeType, amount float64) (float64, error) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	sub, ok := ms.subscriptions[tenantID]
	if !ok {
		// Default to basic tier pricing
		sub = &TenantSubscription{Tier: TierBasic}
	}

	config := ms.tierConfigs[sub.Tier]

	// Check for custom pricing (enterprise)
	if sub.CustomPricing != nil {
		return ms.calculateCustomFee(sub.CustomPricing, feeType, amount)
	}

	switch feeType {
	case FeeCreation:
		return config.CreationFee, nil
	case FeeMonthly:
		return config.MonthlyFee, nil
	case FeeTransaction:
		return ms.calculateStructuredFee(config.TransactionFee, amount)
	case FeeSweep:
		return ms.calculateStructuredFee(config.SweepFee, amount)
	case FeeReactivation:
		return config.CreationFee * 0.5, nil // 50% of creation fee
	default:
		return 0, fmt.Errorf("unknown fee type: %s", feeType)
	}
}

// calculateStructuredFee calculates fee based on fee structure
func (ms *MonetizationService) calculateStructuredFee(structure FeeStructure, amount float64) (float64, error) {
	var fee float64

	switch structure.Type {
	case "flat":
		fee = structure.FlatAmount
	case "percentage":
		fee = amount * (structure.Percentage / 100)
	case "tiered":
		for _, tier := range structure.Tiers {
			if amount >= tier.MinAmount && amount < tier.MaxAmount {
				fee = amount*(tier.Percentage/100) + tier.FlatFee
				break
			}
		}
	case "custom":
		return 0, fmt.Errorf("custom pricing requires enterprise configuration")
	default:
		return 0, fmt.Errorf("unknown fee structure type: %s", structure.Type)
	}

	// Apply min/max caps
	if structure.MinFee > 0 && fee < structure.MinFee {
		fee = structure.MinFee
	}
	if structure.MaxFee > 0 && fee > structure.MaxFee {
		fee = structure.MaxFee
	}

	return math.Round(fee*100) / 100, nil // Round to 2 decimal places
}

// calculateCustomFee calculates fee for enterprise custom pricing
func (ms *MonetizationService) calculateCustomFee(custom *CustomPricing, feeType FeeType, amount float64) (float64, error) {
	switch feeType {
	case FeeCreation:
		return custom.CreationFee, nil
	case FeeMonthly:
		return custom.MonthlyFee, nil
	case FeeTransaction:
		return ms.calculateStructuredFee(custom.TransactionFee, amount)
	case FeeSweep:
		return ms.calculateStructuredFee(custom.SweepFee, amount)
	case FeeReactivation:
		return custom.CreationFee * 0.5, nil
	default:
		return 0, fmt.Errorf("unknown fee type: %s", feeType)
	}
}

// ChargeFee creates and charges a fee
func (ms *MonetizationService) ChargeFee(ctx context.Context, tenantID, customerID, vanID string, feeType FeeType, amount float64, reference string) (*VANFee, error) {
	feeAmount, err := ms.CalculateFee(tenantID, feeType, amount)
	if err != nil {
		return nil, err
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()

	now := time.Now()
	fee := &VANFee{
		FeeID:       fmt.Sprintf("fee_%d", now.UnixNano()),
		VANID:       vanID,
		TenantID:    tenantID,
		CustomerID:  customerID,
		FeeType:     feeType,
		Amount:      feeAmount,
		Currency:    "NGN",
		Description: ms.getFeeDescription(feeType, amount),
		Reference:   reference,
		Status:      "pending",
		CreatedAt:   now,
	}

	// Charge via billing service (async)
	go ms.processFeeCharge(ctx, fee)

	ms.fees[fee.FeeID] = fee

	// Record usage
	ms.recordUsage(tenantID, vanID, string(feeType), feeAmount, 1)

	// Update metrics
	vanFeesCharged.WithLabelValues(tenantID, string(feeType)).Inc()
	vanFeesAmount.WithLabelValues(tenantID, string(feeType)).Add(feeAmount)

	return fee, nil
}

// getFeeDescription returns a human-readable fee description
func (ms *MonetizationService) getFeeDescription(feeType FeeType, amount float64) string {
	switch feeType {
	case FeeCreation:
		return "VAN creation fee"
	case FeeMonthly:
		return "VAN monthly maintenance fee"
	case FeeTransaction:
		return fmt.Sprintf("VAN transaction fee on ₦%.2f", amount)
	case FeeSweep:
		return fmt.Sprintf("VAN sweep fee on ₦%.2f", amount)
	case FeeReactivation:
		return "VAN reactivation fee"
	default:
		return "VAN fee"
	}
}

// processFeeCharge processes the fee charge via billing service
func (ms *MonetizationService) processFeeCharge(ctx context.Context, fee *VANFee) {
	// In production, this would call the billing service
	// For now, we'll simulate the charge
	time.Sleep(100 * time.Millisecond)

	ms.mu.Lock()
	defer ms.mu.Unlock()

	now := time.Now()
	fee.Status = "charged"
	fee.ChargedAt = &now
}

// recordUsage records usage for billing
func (ms *MonetizationService) recordUsage(tenantID, vanID, usageType string, amount float64, quantity int) {
	record := UsageRecord{
		RecordID:      fmt.Sprintf("usage_%d", time.Now().UnixNano()),
		TenantID:      tenantID,
		VANID:         vanID,
		UsageType:     usageType,
		Amount:        amount,
		Quantity:      quantity,
		BillingPeriod: time.Now().Format("2006-01"),
		CreatedAt:     time.Now(),
	}

	ms.usage[tenantID] = append(ms.usage[tenantID], record)
}

// IncrementVANUsage increments the VAN count for a tenant
func (ms *MonetizationService) IncrementVANUsage(tenantID string) error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	sub, ok := ms.subscriptions[tenantID]
	if !ok {
		return fmt.Errorf("subscription not found for tenant %s", tenantID)
	}

	if sub.Tier != TierEnterprise && sub.VANsUsed >= sub.VANsLimit {
		return fmt.Errorf("VAN limit reached for tier %s (limit: %d)", sub.Tier, sub.VANsLimit)
	}

	sub.VANsUsed++
	sub.UpdatedAt = time.Now()

	return nil
}

// GetUsageSummary returns usage summary for a tenant
func (ms *MonetizationService) GetUsageSummary(tenantID, billingPeriod string) map[string]interface{} {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	records := ms.usage[tenantID]
	summary := map[string]interface{}{
		"tenant_id":      tenantID,
		"billing_period": billingPeriod,
		"vans_created":   0,
		"payments":       0,
		"sweeps":         0,
		"total_fees":     0.0,
	}

	for _, record := range records {
		if record.BillingPeriod == billingPeriod {
			switch record.UsageType {
			case string(FeeCreation):
				summary["vans_created"] = summary["vans_created"].(int) + record.Quantity
			case string(FeeTransaction):
				summary["payments"] = summary["payments"].(int) + record.Quantity
			case string(FeeSweep):
				summary["sweeps"] = summary["sweeps"].(int) + record.Quantity
			}
			summary["total_fees"] = summary["total_fees"].(float64) + record.Amount
		}
	}

	return summary
}

// GenerateInvoice generates an invoice for a billing period
func (ms *MonetizationService) GenerateInvoice(tenantID, billingPeriod string) (*Invoice, error) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	sub, ok := ms.subscriptions[tenantID]
	if !ok {
		return nil, fmt.Errorf("subscription not found for tenant %s", tenantID)
	}

	now := time.Now()
	invoice := &Invoice{
		InvoiceID:     fmt.Sprintf("inv_%d", now.UnixNano()),
		TenantID:      tenantID,
		BillingPeriod: billingPeriod,
		Status:        "draft",
		Currency:      "NGN",
		LineItems:     []InvoiceItem{},
		DueDate:       now.AddDate(0, 0, 14), // Due in 14 days
		CreatedAt:     now,
	}

	// Add monthly subscription fee
	if sub.MonthlyFee > 0 {
		invoice.LineItems = append(invoice.LineItems, InvoiceItem{
			Description: fmt.Sprintf("%s Plan - Monthly Subscription", sub.Tier),
			Quantity:    1,
			UnitPrice:   sub.MonthlyFee,
			Amount:      sub.MonthlyFee,
			FeeType:     FeeMonthly,
		})
	}

	// Add usage-based fees
	records := ms.usage[tenantID]
	feesByType := make(map[FeeType]float64)
	countByType := make(map[FeeType]int)

	for _, record := range records {
		if record.BillingPeriod == billingPeriod {
			feeType := FeeType(record.UsageType)
			feesByType[feeType] += record.Amount
			countByType[feeType] += record.Quantity
		}
	}

	for feeType, amount := range feesByType {
		if feeType == FeeMonthly {
			continue // Already added
		}
		invoice.LineItems = append(invoice.LineItems, InvoiceItem{
			Description: ms.getFeeDescription(feeType, 0),
			Quantity:    countByType[feeType],
			UnitPrice:   amount / float64(countByType[feeType]),
			Amount:      amount,
			FeeType:     feeType,
		})
	}

	// Calculate totals
	for _, item := range invoice.LineItems {
		invoice.Subtotal += item.Amount
	}
	invoice.Tax = invoice.Subtotal * 0.075 // 7.5% VAT
	invoice.Total = invoice.Subtotal + invoice.Tax

	ms.invoices[invoice.InvoiceID] = invoice

	return invoice, nil
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

// HandleGetPricingTiers returns all pricing tiers
func (ms *MonetizationService) HandleGetPricingTiers(w http.ResponseWriter, r *http.Request) {
	configs := ms.GetAllTierConfigs()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tiers": configs,
	})
}

// HandleGetSubscription returns a tenant's subscription
func (ms *MonetizationService) HandleGetSubscription(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "X-Tenant-ID header required", http.StatusBadRequest)
		return
	}

	sub, ok := ms.GetSubscription(tenantID)
	if !ok {
		http.Error(w, "Subscription not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(sub)
}

// HandleCreateSubscription creates a new subscription
func (ms *MonetizationService) HandleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID      string         `json:"tenant_id"`
		Tier          PricingTier    `json:"tier"`
		CustomPricing *CustomPricing `json:"custom_pricing,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sub, err := ms.CreateSubscription(req.TenantID, req.Tier, req.CustomPricing)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sub)
}

// HandleCalculateFee calculates a fee without charging
func (ms *MonetizationService) HandleCalculateFee(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string  `json:"tenant_id"`
		FeeType  FeeType `json:"fee_type"`
		Amount   float64 `json:"amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	fee, err := ms.CalculateFee(req.TenantID, req.FeeType, req.Amount)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fee_type": req.FeeType,
		"amount":   req.Amount,
		"fee":      fee,
		"currency": "NGN",
	})
}

// HandleGetUsageSummary returns usage summary
func (ms *MonetizationService) HandleGetUsageSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "X-Tenant-ID header required", http.StatusBadRequest)
		return
	}

	billingPeriod := r.URL.Query().Get("period")
	if billingPeriod == "" {
		billingPeriod = time.Now().Format("2006-01")
	}

	summary := ms.GetUsageSummary(tenantID, billingPeriod)
	json.NewEncoder(w).Encode(summary)
}

// HandleGenerateInvoice generates an invoice
func (ms *MonetizationService) HandleGenerateInvoice(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "X-Tenant-ID header required", http.StatusBadRequest)
		return
	}

	billingPeriod := r.URL.Query().Get("period")
	if billingPeriod == "" {
		billingPeriod = time.Now().Format("2006-01")
	}

	invoice, err := ms.GenerateInvoice(tenantID, billingPeriod)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(invoice)
}

// RegisterMonetizationRoutes registers HTTP routes for monetization
func (ms *MonetizationService) RegisterMonetizationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/van/pricing", ms.HandleGetPricingTiers)
	mux.HandleFunc("/api/v1/van/subscription", ms.HandleGetSubscription)
	mux.HandleFunc("/api/v1/van/subscription/create", ms.HandleCreateSubscription)
	mux.HandleFunc("/api/v1/van/fees/calculate", ms.HandleCalculateFee)
	mux.HandleFunc("/api/v1/van/usage", ms.HandleGetUsageSummary)
	mux.HandleFunc("/api/v1/van/invoice", ms.HandleGenerateInvoice)
}
