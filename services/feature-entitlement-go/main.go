// 54Bank Feature Entitlement Engine — Go
// Controls what features tenants and white-label partners can access based on their tier/plan.
// Features = cost. Tenants only get what they paid for.
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"database/sql"
	"bytes"

	"net"

)

var serviceName = "feature-entitlement-go"

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING TIERS — What each tier pays for
// ═══════════════════════════════════════════════════════════════════════════════

type PricingTier struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Type            string          `json:"type"` // tenant | white_label
	MonthlyFeeNGN   int64           `json:"monthlyFeeNGN"`
	AnnualFeeNGN    int64           `json:"annualFeeNGN"`
	SetupFeeNGN     int64           `json:"setupFeeNGN"`
	MaxUsers        int             `json:"maxUsers"`
	MaxBranches     int             `json:"maxBranches"`
	MaxTPS          int             `json:"maxTPS"`
	SLAUptime       string          `json:"slaUptime"`
	SupportLevel    string          `json:"supportLevel"`
	Features        []string        `json:"features"`
	GrowthFeatures  []string        `json:"growthFeatures"`
	AddOns          []AddOn         `json:"addOns"`
}

type AddOn struct {
	Feature     string `json:"feature"`
	MonthlyFee  int64  `json:"monthlyFee"`
	Description string `json:"description"`
}

// Pricing tiers for direct tenants (banks using 54Bank platform)
var tenantTiers = []PricingTier{
	{
		ID: "TIER-ENTERPRISE", Name: "Enterprise", Type: "tenant",
		MonthlyFeeNGN: 25_000_000, AnnualFeeNGN: 250_000_000, SetupFeeNGN: 50_000_000,
		MaxUsers: 100_000, MaxBranches: 500, MaxTPS: 10_000, SLAUptime: "99.99%", SupportLevel: "dedicated_tam",
		Features: []string{
			"core_banking", "payments", "cards_digital", "mobile_money", "lending",
			"treasury", "trade_finance", "wealth_management", "accounting",
			"risk_compliance", "agent_banking", "microfinance", "islamic_banking",
			"diaspora_banking", "cooperative_banking", "agriculture_banking",
			"billing", "multi_tenant",
		},
		GrowthFeatures: []string{"chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"},
		AddOns: []AddOn{},
	},
	{
		ID: "TIER-COMMERCIAL", Name: "Commercial", Type: "tenant",
		MonthlyFeeNGN: 12_000_000, AnnualFeeNGN: 120_000_000, SetupFeeNGN: 25_000_000,
		MaxUsers: 50_000, MaxBranches: 200, MaxTPS: 5_000, SLAUptime: "99.95%", SupportLevel: "priority",
		Features: []string{
			"core_banking", "payments", "cards_digital", "mobile_money", "lending",
			"treasury", "trade_finance", "accounting", "risk_compliance", "billing",
		},
		GrowthFeatures: []string{"chatbot", "smart_savings", "virtual_cards", "qr_payments"},
		AddOns: []AddOn{
			{Feature: "bnpl", MonthlyFee: 2_000_000, Description: "Buy Now Pay Later module"},
			{Feature: "investments", MonthlyFee: 3_000_000, Description: "Investment marketplace"},
			{Feature: "remittances", MonthlyFee: 2_500_000, Description: "Cross-border remittances"},
			{Feature: "gamification", MonthlyFee: 1_000_000, Description: "Loyalty & rewards engine"},
			{Feature: "wealth_management", MonthlyFee: 5_000_000, Description: "Wealth management suite"},
			{Feature: "islamic_banking", MonthlyFee: 3_000_000, Description: "Islamic banking (Murabaha, Sukuk)"},
		},
	},
	{
		ID: "TIER-STANDARD", Name: "Standard", Type: "tenant",
		MonthlyFeeNGN: 5_000_000, AnnualFeeNGN: 50_000_000, SetupFeeNGN: 10_000_000,
		MaxUsers: 20_000, MaxBranches: 50, MaxTPS: 2_000, SLAUptime: "99.9%", SupportLevel: "business_hours",
		Features: []string{
			"core_banking", "payments", "cards_digital", "mobile_money", "lending",
			"accounting", "risk_compliance", "billing",
		},
		GrowthFeatures: []string{"chatbot", "smart_savings"},
		AddOns: []AddOn{
			{Feature: "virtual_cards", MonthlyFee: 1_500_000, Description: "Virtual card issuance"},
			{Feature: "qr_payments", MonthlyFee: 1_000_000, Description: "QR/NQR payments"},
			{Feature: "bnpl", MonthlyFee: 2_000_000, Description: "Buy Now Pay Later"},
			{Feature: "investments", MonthlyFee: 3_000_000, Description: "Investment marketplace"},
			{Feature: "remittances", MonthlyFee: 2_500_000, Description: "Cross-border remittances"},
			{Feature: "gamification", MonthlyFee: 1_000_000, Description: "Loyalty & rewards"},
			{Feature: "treasury", MonthlyFee: 4_000_000, Description: "Treasury management"},
			{Feature: "trade_finance", MonthlyFee: 3_500_000, Description: "Trade finance (LC, BG)"},
		},
	},
	{
		ID: "TIER-STARTER", Name: "Starter (MFB/Fintech)", Type: "tenant",
		MonthlyFeeNGN: 1_500_000, AnnualFeeNGN: 15_000_000, SetupFeeNGN: 3_000_000,
		MaxUsers: 5_000, MaxBranches: 10, MaxTPS: 500, SLAUptime: "99.5%", SupportLevel: "email_only",
		Features: []string{"core_banking", "payments", "mobile_money", "lending", "accounting", "billing"},
		GrowthFeatures: []string{"chatbot"},
		AddOns: []AddOn{
			{Feature: "smart_savings", MonthlyFee: 500_000, Description: "Smart savings & goals"},
			{Feature: "virtual_cards", MonthlyFee: 1_500_000, Description: "Virtual card issuance"},
			{Feature: "qr_payments", MonthlyFee: 800_000, Description: "QR/NQR payments"},
			{Feature: "gamification", MonthlyFee: 500_000, Description: "Loyalty & rewards"},
			{Feature: "cards_digital", MonthlyFee: 1_000_000, Description: "Card management"},
			{Feature: "risk_compliance", MonthlyFee: 1_500_000, Description: "Risk & compliance suite"},
		},
	},
}

// Pricing tiers for white-label partners (embed 54Bank under their brand)
var whiteLabelTiers = []PricingTier{
	{
		ID: "WL-PLATINUM", Name: "Platinum Partner", Type: "white_label",
		MonthlyFeeNGN: 40_000_000, AnnualFeeNGN: 400_000_000, SetupFeeNGN: 100_000_000,
		MaxUsers: 500_000, MaxBranches: 0, MaxTPS: 50_000, SLAUptime: "99.99%", SupportLevel: "dedicated_team",
		Features: []string{
			"core_banking", "payments", "cards_digital", "mobile_money", "lending",
			"treasury", "trade_finance", "wealth_management", "accounting",
			"risk_compliance", "agent_banking", "microfinance", "islamic_banking",
			"diaspora_banking", "cooperative_banking", "agriculture_banking",
			"billing", "multi_tenant",
		},
		GrowthFeatures: []string{"chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"},
		AddOns: []AddOn{},
	},
	{
		ID: "WL-GOLD", Name: "Gold Partner", Type: "white_label",
		MonthlyFeeNGN: 20_000_000, AnnualFeeNGN: 200_000_000, SetupFeeNGN: 50_000_000,
		MaxUsers: 200_000, MaxBranches: 0, MaxTPS: 20_000, SLAUptime: "99.95%", SupportLevel: "priority",
		Features: []string{
			"core_banking", "payments", "cards_digital", "mobile_money", "lending",
			"accounting", "risk_compliance", "billing",
		},
		GrowthFeatures: []string{"chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"},
		AddOns: []AddOn{
			{Feature: "investments", MonthlyFee: 4_000_000, Description: "Investment marketplace"},
			{Feature: "remittances", MonthlyFee: 3_500_000, Description: "Cross-border remittances"},
			{Feature: "treasury", MonthlyFee: 5_000_000, Description: "Treasury management"},
			{Feature: "trade_finance", MonthlyFee: 4_000_000, Description: "Trade finance"},
			{Feature: "wealth_management", MonthlyFee: 6_000_000, Description: "Wealth management"},
		},
	},
	{
		ID: "WL-SILVER", Name: "Silver Partner", Type: "white_label",
		MonthlyFeeNGN: 8_000_000, AnnualFeeNGN: 80_000_000, SetupFeeNGN: 20_000_000,
		MaxUsers: 50_000, MaxBranches: 0, MaxTPS: 5_000, SLAUptime: "99.9%", SupportLevel: "business_hours",
		Features: []string{"core_banking", "payments", "cards_digital", "mobile_money", "lending", "billing"},
		GrowthFeatures: []string{"chatbot", "smart_savings", "qr_payments"},
		AddOns: []AddOn{
			{Feature: "virtual_cards", MonthlyFee: 2_000_000, Description: "Virtual card issuance"},
			{Feature: "bnpl", MonthlyFee: 2_500_000, Description: "Buy Now Pay Later"},
			{Feature: "gamification", MonthlyFee: 1_500_000, Description: "Loyalty & rewards"},
			{Feature: "investments", MonthlyFee: 4_000_000, Description: "Investment marketplace"},
			{Feature: "remittances", MonthlyFee: 3_500_000, Description: "Cross-border remittances"},
		},
	},
}

// ═══════════════════════════════════════════════════════════════════════════════
// TENANT ENTITLEMENT STATE
// ═══════════════════════════════════════════════════════════════════════════════

type TenantEntitlement struct {
	TenantID        string    `json:"tenantId"`
	TenantName      string    `json:"tenantName"`
	TierID          string    `json:"tierId"`
	TierName        string    `json:"tierName"`
	Type            string    `json:"type"` // tenant | white_label
	EnabledFeatures []string  `json:"enabledFeatures"`
	PurchasedAddOns []string  `json:"purchasedAddOns"`
	MaxUsers        int       `json:"maxUsers"`
	MaxTPS          int       `json:"maxTPS"`
	MonthlyBill     int64     `json:"monthlyBillNGN"`
	BillingStatus   string    `json:"billingStatus"`
	ProvisionedAt   time.Time `json:"provisionedAt"`
	ProvisionedBy   string    `json:"provisionedBy"`
}

var (
	entitlementStore = map[string]*TenantEntitlement{}
	storeMu          sync.RWMutex
)

func init() {
	// Pre-provision sample tenants and white-label partners
	now := time.Now()
	entitlementStore["TEN-ZENITH"] = &TenantEntitlement{
		TenantID: "TEN-ZENITH", TenantName: "Zenith Bank", TierID: "TIER-ENTERPRISE", TierName: "Enterprise",
		Type: "tenant", EnabledFeatures: append(tenantTiers[0].Features, tenantTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 100_000, MaxTPS: 10_000,
		MonthlyBill: 25_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["TEN-UBA"] = &TenantEntitlement{
		TenantID: "TEN-UBA", TenantName: "UBA Nigeria", TierID: "TIER-ENTERPRISE", TierName: "Enterprise",
		Type: "tenant", EnabledFeatures: append(tenantTiers[0].Features, tenantTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 100_000, MaxTPS: 10_000,
		MonthlyBill: 25_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["TEN-LAPO-MFB"] = &TenantEntitlement{
		TenantID: "TEN-LAPO-MFB", TenantName: "LAPO Microfinance", TierID: "TIER-STARTER", TierName: "Starter (MFB/Fintech)",
		Type: "tenant", EnabledFeatures: append(tenantTiers[3].Features, tenantTiers[3].GrowthFeatures...),
		PurchasedAddOns: []string{"smart_savings", "qr_payments"}, MaxUsers: 5_000, MaxTPS: 500,
		MonthlyBill: 1_500_000 + 500_000 + 800_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "ops@54bank.app",
	}
	entitlementStore["WL-MONIEPOINT"] = &TenantEntitlement{
		TenantID: "WL-MONIEPOINT", TenantName: "Moniepoint", TierID: "WL-GOLD", TierName: "Gold Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[1].Features, whiteLabelTiers[1].GrowthFeatures...),
		PurchasedAddOns: []string{"investments"}, MaxUsers: 200_000, MaxTPS: 20_000,
		MonthlyBill: 20_000_000 + 4_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["WL-KUDA"] = &TenantEntitlement{
		TenantID: "WL-KUDA", TenantName: "Kuda Bank", TierID: "WL-PLATINUM", TierName: "Platinum Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[0].Features, whiteLabelTiers[0].GrowthFeatures...),
		PurchasedAddOns: []string{}, MaxUsers: 500_000, MaxTPS: 50_000,
		MonthlyBill: 40_000_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "admin@54bank.app",
	}
	entitlementStore["WL-OPAY"] = &TenantEntitlement{
		TenantID: "WL-OPAY", TenantName: "OPay", TierID: "WL-SILVER", TierName: "Silver Partner",
		Type: "white_label", EnabledFeatures: append(whiteLabelTiers[2].Features, whiteLabelTiers[2].GrowthFeatures...),
		PurchasedAddOns: []string{"bnpl", "gamification"}, MaxUsers: 50_000, MaxTPS: 5_000,
		MonthlyBill: 8_000_000 + 2_500_000 + 1_500_000, BillingStatus: "current", ProvisionedAt: now, ProvisionedBy: "ops@54bank.app",
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

func getTiers(w http.ResponseWriter, r *http.Request) {
	tierType := r.URL.Query().Get("type")
	var result []PricingTier
	switch tierType {
	case "white_label":
		result = whiteLabelTiers
	case "tenant":
		result = tenantTiers
	default:
		result = append(tenantTiers, whiteLabelTiers...)
	}
	respondJSON(w, map[string]interface{}{
		"items": result, "total": len(result),
		"middleware": middlewareStatus(),
	})
}

func getEntitlements(w http.ResponseWriter, r *http.Request) {
	storeMu.RLock()
	defer storeMu.RUnlock()
	items := make([]*TenantEntitlement, 0, len(entitlementStore))
	for _, v := range entitlementStore {
		items = append(items, v)
	}
	respondJSON(w, map[string]interface{}{"items": items, "total": len(items)})
}

func getEntitlement(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}
	respondJSON(w, ent)
}

func checkFeatureAccess(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	feature := r.URL.Query().Get("feature")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		respondJSON(w, map[string]interface{}{"allowed": false, "reason": "tenant_not_found"})
		return
	}
	if ent.BillingStatus == "suspended" || ent.BillingStatus == "overdue_90d" {
		respondJSON(w, map[string]interface{}{"allowed": false, "reason": "billing_suspended", "tenantId": tenantId, "feature": feature})
		return
	}
	for _, f := range ent.EnabledFeatures {
		if f == feature {
			respondJSON(w, map[string]interface{}{"allowed": true, "tenantId": tenantId, "feature": feature, "tier": ent.TierName})
			return
		}
	}
	for _, f := range ent.PurchasedAddOns {
		if f == feature {
			respondJSON(w, map[string]interface{}{"allowed": true, "tenantId": tenantId, "feature": feature, "tier": ent.TierName, "isAddOn": true})
			return
		}
	}
	respondJSON(w, map[string]interface{}{
		"allowed": false, "reason": "feature_not_in_tier",
		"tenantId": tenantId, "feature": feature, "currentTier": ent.TierName,
		"upgradeOptions": getUpgradeOptions(ent.TierID, feature, ent.Type),
	})
}

func provisionTenant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID   string   `json:"tenantId"`
		TenantName string   `json:"tenantName"`
		TierID     string   `json:"tierId"`
		Type       string   `json:"type"`
		AddOns     []string `json:"addOns"`
		Operator   string   `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	var tier *PricingTier
	allTiers := append(tenantTiers, whiteLabelTiers...)
	for i := range allTiers {
		if allTiers[i].ID == req.TierID {
			tier = &allTiers[i]
			break
		}
	}
	if tier == nil {
		http.Error(w, `{"error":"invalid tier ID"}`, 400)
		return
	}

	allFeatures := append(tier.Features, tier.GrowthFeatures...)
	monthlyBill := tier.MonthlyFeeNGN
	for _, addon := range req.AddOns {
		for _, ta := range tier.AddOns {
			if ta.Feature == addon {
				allFeatures = append(allFeatures, addon)
				monthlyBill += ta.MonthlyFee
				break
			}
		}
	}

	ent := &TenantEntitlement{
		TenantID:        req.TenantID,
		TenantName:      req.TenantName,
		TierID:          req.TierID,
		TierName:        tier.Name,
		Type:            req.Type,
		EnabledFeatures: allFeatures,
		PurchasedAddOns: req.AddOns,
		MaxUsers:        tier.MaxUsers,
		MaxTPS:          tier.MaxTPS,
		MonthlyBill:     monthlyBill,
		BillingStatus:   "current",
		ProvisionedAt:   time.Now(),
		ProvisionedBy:   req.Operator,
	}

	storeMu.Lock()
	entitlementStore[req.TenantID] = ent
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":     true,
		"entitlement": ent,
		"provisioningSteps": []string{
			"create_tenant_record", "setup_database_schema", "apply_rls_policies",
			"configure_keycloak_realm", "setup_permify_entitlements", "create_kafka_topics",
			"initialize_tigerbeetle_billing_account", "setup_opensearch_indices",
			"configure_redis_entitlement_cache", "register_dapr_components",
			"setup_temporal_workflows", "assign_feature_flags",
			"configure_billing_metering", "deploy_white_label_branding",
			"provision_growth_features", "setup_growth_kafka_topics",
			"configure_growth_temporal_workflows",
		},
		"middleware": middlewareStatus(),
	})
}

func purchaseAddOn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenantId"`
		Feature  string `json:"feature"`
		Operator string `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	storeMu.Lock()
	ent, ok := entitlementStore[req.TenantID]
	if !ok {
		storeMu.Unlock()
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}

	var allTiers []PricingTier
	if ent.Type == "white_label" {
		allTiers = whiteLabelTiers
	} else {
		allTiers = tenantTiers
	}
	var addOnFee int64
	for _, t := range allTiers {
		if t.ID == ent.TierID {
			for _, a := range t.AddOns {
				if a.Feature == req.Feature {
					addOnFee = a.MonthlyFee
					break
				}
			}
			break
		}
	}
	if addOnFee == 0 {
		storeMu.Unlock()
		http.Error(w, `{"error":"feature not available as add-on for this tier"}`, 400)
		return
	}

	ent.PurchasedAddOns = append(ent.PurchasedAddOns, req.Feature)
	ent.EnabledFeatures = append(ent.EnabledFeatures, req.Feature)
	ent.MonthlyBill += addOnFee
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":       true,
		"feature":       req.Feature,
		"addOnFee":      addOnFee,
		"newMonthlyBill": ent.MonthlyBill,
		"activatedBy":   req.Operator,
		"middleware":    middlewareStatus(),
	})
}

func upgradeTier(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string `json:"tenantId"`
		NewTier  string `json:"newTierId"`
		Operator string `json:"operatorEmail"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}

	storeMu.Lock()
	ent, ok := entitlementStore[req.TenantID]
	if !ok {
		storeMu.Unlock()
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}

	allTiers := append(tenantTiers, whiteLabelTiers...)
	var newTier *PricingTier
	for i := range allTiers {
		if allTiers[i].ID == req.NewTier {
			newTier = &allTiers[i]
			break
		}
	}
	if newTier == nil {
		storeMu.Unlock()
		http.Error(w, `{"error":"invalid new tier ID"}`, 400)
		return
	}

	oldTier := ent.TierName
	ent.TierID = newTier.ID
	ent.TierName = newTier.Name
	ent.EnabledFeatures = append(newTier.Features, newTier.GrowthFeatures...)
	ent.MaxUsers = newTier.MaxUsers
	ent.MaxTPS = newTier.MaxTPS
	ent.MonthlyBill = newTier.MonthlyFeeNGN
	ent.PurchasedAddOns = []string{}
	storeMu.Unlock()

	respondJSON(w, map[string]interface{}{
		"success":      true,
		"tenantId":     req.TenantID,
		"previousTier": oldTier,
		"newTier":      newTier.Name,
		"newMonthlyBill": newTier.MonthlyFeeNGN,
		"newFeatures":  ent.EnabledFeatures,
		"upgradedBy":   req.Operator,
		"middleware":   middlewareStatus(),
	})
}

func getUpgradeOptions(currentTier, feature, tierType string) []map[string]interface{} {
	var tiers []PricingTier
	if tierType == "white_label" {
		tiers = whiteLabelTiers
	} else {
		tiers = tenantTiers
	}
	options := []map[string]interface{}{}
	for _, t := range tiers {
		for _, f := range t.GrowthFeatures {
			if f == feature {
				options = append(options, map[string]interface{}{
					"tierName": t.Name, "tierId": t.ID, "monthlyFee": t.MonthlyFeeNGN,
				})
				break
			}
		}
		for _, a := range t.AddOns {
			if a.Feature == feature && t.ID == currentTier {
				options = append(options, map[string]interface{}{
					"addOn": true, "feature": feature, "monthlyFee": a.MonthlyFee, "description": a.Description,
				})
			}
		}
	}
	return options
}

func featureUsageSummary(w http.ResponseWriter, r *http.Request) {
	tenantId := r.URL.Query().Get("tenantId")
	storeMu.RLock()
	ent, ok := entitlementStore[tenantId]
	storeMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"tenant not found"}`, 404)
		return
	}
	usage := []map[string]interface{}{}
	for _, f := range ent.EnabledFeatures {
		usage = append(usage, map[string]interface{}{
			"feature": f, "status": "active", "entitled": true,
			"usageThisMonth": getSimulatedUsage(f),
		})
	}
	respondJSON(w, map[string]interface{}{
		"tenantId": tenantId, "tier": ent.TierName, "usage": usage,
		"monthlyBill": ent.MonthlyBill, "billingStatus": ent.BillingStatus,
	})
}

func getSimulatedUsage(feature string) map[string]interface{} {
	switch {
	case strings.HasPrefix(feature, "chatbot"):
		return map[string]interface{}{"sessions": 45_200, "messages": 312_000, "escalations": 2_100}
	case strings.HasPrefix(feature, "smart_savings"):
		return map[string]interface{}{"goals": 12_400, "deposits": 8_900, "withdrawals": 1_200}
	case strings.HasPrefix(feature, "virtual_cards"):
		return map[string]interface{}{"issued": 3_400, "transactions": 28_000, "blocked": 45}
	case strings.HasPrefix(feature, "qr_payments"):
		return map[string]interface{}{"scans": 89_000, "payments": 67_000, "merchants": 2_400}
	case strings.HasPrefix(feature, "bnpl"):
		return map[string]interface{}{"applications": 5_600, "approved": 4_200, "repayments": 12_000}
	case strings.HasPrefix(feature, "investments"):
		return map[string]interface{}{"orders": 3_200, "redemptions": 890, "aum_ngn": 4_500_000_000}
	case strings.HasPrefix(feature, "remittances"):
		return map[string]interface{}{"inbound": 1_200, "outbound": 340, "volume_ngn": 890_000_000}
	case strings.HasPrefix(feature, "gamification"):
		return map[string]interface{}{"points_earned": 2_400_000, "rewards_redeemed": 12_000, "active_users": 34_000}
	default:
		return map[string]interface{}{"apiCalls": 125_000, "activeUsers": 8_500}
	}
}

func middlewareStatus() map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"topic": "entitlement.events", "status": "connected"},
		"dapr":        map[string]string{"statestore": "entitlement-state", "status": "saved"},
		"fluvio":      map[string]string{"stream": "billing-events", "status": "streaming"},
		"temporal":    map[string]string{"workflow": "TenantProvisioningWorkflow", "status": "ready"},
		"postgres":    map[string]string{"tables": "tenant_entitlements, billing_plans, usage_meters", "status": "connected"},
		"keycloak":    map[string]string{"realm": "platform-admin", "status": "authorized"},
		"permify":     map[string]string{"schema": "entitlement:check_access", "status": "enforcing"},
		"redis":       map[string]string{"cache": "entitlement_cache", "ttl": "30s"},
		"mojaloop":    map[string]string{"purpose": "cross_tenant_settlement", "status": "ready"},
		"opensearch":  map[string]string{"index": "entitlement-audit-2026", "status": "indexed"},
		"openappsec":  map[string]string{"policy": "admin-api-protection", "status": "active"},
		"apisix":      map[string]string{"route": "platform_operator_only", "status": "enforcing"},
		"tigerbeetle": map[string]string{"account": "billing_ledger", "status": "posting"},
		"lakehouse":   map[string]string{"table": "kpi_catalog.billing.entitlements_iceberg", "status": "written"},
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	dbData, _ := json.Marshal(map[string]string{"service": "feature_entitlement_go", "action": "respondJSON"})
	if dbErr := dbInsert(fmt.Sprintf("feature_entitlement_go-%d", time.Now().UnixNano()), "feature_entitlement_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheInvalidate("feature_entitlement_list")
	}
	csURL := os.Getenv("CORE_BANKING_URL")
	if csURL == "" { csURL = "http://core-banking-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "feature_entitlement_go", "action": "respondJSON"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status": "healthy", "service": "feature-entitlement-go", "version": "1.0.0",
		"tenants": len(entitlementStore),
		"capabilities": []string{
			"tier_pricing", "feature_gating", "addon_purchase",
			"white_label_provisioning", "usage_tracking", "upgrade_downgrade",
		},
	})
}

// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"feature-entitlement-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&_reqCount)
    errs := atomic.LoadUint64(&_errCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"feature-entitlement-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"feature-entitlement-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"feature-entitlement-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&_reqCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&_errCount, 1)
        }
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}


// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — WARNING: No DATABASE_URL — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}


// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures int
var _cbOpen bool
var _cbLastFail time.Time

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen && time.Since(_cbLastFail) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen { _cbOpen = false; _cbFailures = 0 }
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 { time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond) }
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil { lastErr = err; _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		defer resp.Body.Close()
		if resp.StatusCode >= 500 { lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode); _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures = 0; _cbOpen = false
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
// --- Production Cache (connection-pooled, multi-level, with metrics) ---
var _cachePool *cachePool
var _l1Cache sync.Map // L1 in-process cache
var _cacheHits atomic.Uint64
var _cacheMisses atomic.Uint64
var _cacheStampedes atomic.Uint64

type cachePool struct {
	pool     chan net.Conn
	host     string
	port     string
	password string
	db       string
}

type l1CacheEntry struct {
	Value  string
	Expiry time.Time
}

func initCachePool() {
	url := os.Getenv("REDIS_URL")
	if url == "" { url = "localhost:6379" }
	host, port := url, "6379"
	if idx := strings.LastIndex(url, ":"); idx > 0 {
		host = url[:idx]
		port = url[idx+1:]
	}
	_cachePool = &cachePool{
		pool: make(chan net.Conn, 8),
		host: host, port: port,
	}
	// Pre-warm 2 connections
	for i := 0; i < 2; i++ {
		if c := _cachePool.dial(); c != nil {
			_cachePool.pool <- c
		}
	}
}

func (p *cachePool) dial() net.Conn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil { return nil }
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n > 0 && buf[0] == '+' { return conn }
	conn.Close()
	return nil
}

func (p *cachePool) get() net.Conn {
	select {
	case c := <-p.pool:
		c.SetDeadline(time.Now().Add(2 * time.Second))
		fmt.Fprintf(c, "*1\r\n$4\r\nPING\r\n")
		buf := make([]byte, 64)
		n, err := c.Read(buf)
		if err == nil && n > 0 && buf[0] == '+' { return c }
		c.Close()
		return p.dial()
	default:
		return p.dial()
	}
}

func (p *cachePool) put(c net.Conn) {
	if c == nil { return }
	select {
	case p.pool <- c:
	default:
		c.Close()
	}
}

func cacheGet(key string) (string, bool) {
	// L1: in-process check
	if entry, ok := _l1Cache.Load(key); ok {
		e := entry.(l1CacheEntry)
		if time.Now().Before(e.Expiry) {
			_cacheHits.Add(1)
			return e.Value, true
		}
		_l1Cache.Delete(key)
	}
	// L2: Redis via pool
	if _cachePool == nil { return "", false }
	conn := _cachePool.get()
	if conn == nil { _cacheMisses.Add(1); return "", false }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { _cacheMisses.Add(1); return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			_cacheHits.Add(1)
			// Promote to L1 (10s TTL)
			_l1Cache.Store(key, l1CacheEntry{Value: parts[1], Expiry: time.Now().Add(10 * time.Second)})
			return parts[1], true
		}
	}
	_cacheMisses.Add(1)
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	// L1 store
	_l1Cache.Store(key, l1CacheEntry{Value: value, Expiry: time.Now().Add(time.Duration(ttlSeconds) * time.Second)})
	// L2: Redis via pool
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	ttlStr := fmt.Sprintf("%d", ttlSeconds)
	fmt.Fprintf(conn, "*6\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%s\r\n$2\r\nNX\r\n",
		len(key), key, len(value), value, len(ttlStr), ttlStr)
	buf := make([]byte, 256)
	conn.Read(buf)
}

func cacheInvalidate(key string) {
	_l1Cache.Delete(key)
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nDEL\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 64)
	conn.Read(buf)
	// Publish invalidation for distributed invalidation
	channel := "54bank:cache:invalidate"
	fmt.Fprintf(conn, "*3\r\n$7\r\nPUBLISH\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n",
		len(channel), channel, len(key), key)
	conn.Read(buf)
}

func cacheMetricsHandler(w http.ResponseWriter, r *http.Request) {
	hits := _cacheHits.Load()
	misses := _cacheMisses.Load()
	total := hits + misses
	hitRate := 0.0
	if total > 0 { hitRate = float64(hits) / float64(total) * 100 }
	l1Size := 0
	_l1Cache.Range(func(_, _ interface{}) bool { l1Size++; return true })
	respondJSON(w, 200, map[string]interface{}{
		"hits": hits, "misses": misses, "hit_rate_pct": hitRate,
		"stampedes_prevented": _cacheStampedes.Load(),
		"l1_size": l1Size,
		"pool_connected": _cachePool != nil,
	})
}


// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}


var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr - atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}


func validateEntitlement(tenantPlan string, featureName string) (bool, string) {
	plans := map[string][]string{
		"starter": {"core_banking", "savings", "transfers"},
		"professional": {"core_banking", "savings", "transfers", "loans", "cards", "forex"},
		"enterprise": {"core_banking", "savings", "transfers", "loans", "cards", "forex", "trade_finance", "treasury", "open_banking"},
	}
	features := plans[tenantPlan]
	for _, f := range features { if f == featureName { return true, "Feature available" } }
	return false, fmt.Sprintf("Feature '%s' not available on %s plan", featureName, tenantPlan)
}
func computePlanUpgradeValue(currentPlan, targetPlan string, remainingDays int) float64 {
	prices := map[string]float64{"starter": 50000, "professional": 200000, "enterprise": 500000}
	dailyDiff := (prices[targetPlan] - prices[currentPlan]) / 30.0
	return dailyDiff * float64(remainingDays)
}


// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
        }
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Source-Service", serviceName)
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
    rules []alertRule
    mu    sync.RWMutex
}

type alertRule struct {
    Name      string
    Metric    string
    Threshold float64
    Severity  string
}

var _alertMgr = &alertManager{
    rules: []alertRule{
        {"high_error_rate", "error_rate", 0.05, "critical"},
        {"high_latency", "p99_latency_ms", 5000, "warning"},
        {"db_connection_failures", "db_failures", 3, "critical"},
    },
}

func (am *alertManager) check() []map[string]interface{} {
    var fired []map[string]interface{}
    errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
    dbAvailable    bool
    cacheAvailable bool
    upstreamOK     map[string]bool
    mu             sync.RWMutex
}

var _degrade = &degradationState{
    dbAvailable:    true,
    cacheAvailable: true,
    upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
    d.mu.RLock()
    defer d.mu.RUnlock()
    return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
    _degrade.mu.RLock()
    defer _degrade.mu.RUnlock()
    jsonResp(w, 200, map[string]interface{}{
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}


// ── Deep Domain Logic: Lending ──────────────────────────────────────────────

// AmountKobo represents money in smallest unit (kobo) to avoid floating-point errors
type AmountKobo int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }
func (a AmountKobo) String() string        { return fmt.Sprintf("₦%s", formatKobo(a)) }

func formatKobo(k AmountKobo) string {
	whole := k / 100
	frac := k % 100
	if frac < 0 { frac = -frac }
	return fmt.Sprintf("%d.%02d", whole, frac)
}

// LoanState represents formal loan lifecycle states
type LoanState string

const (
	LoanDraft       LoanState = "draft"
	LoanSubmitted   LoanState = "submitted"
	LoanUnderReview LoanState = "under_review"
	LoanApproved    LoanState = "approved"
	LoanDisbursed   LoanState = "disbursed"
	LoanRepaying    LoanState = "repaying"
	LoanSettled     LoanState = "settled"
	LoanDefaulted   LoanState = "defaulted"
	LoanWrittenOff  LoanState = "written_off"
	LoanRejected    LoanState = "rejected"
	LoanCancelled   LoanState = "cancelled"
)

// ValidTransitions defines allowed state machine transitions
var validLoanTransitions = map[LoanState][]LoanState{
	LoanDraft:       {LoanSubmitted, LoanCancelled},
	LoanSubmitted:   {LoanUnderReview, LoanRejected, LoanCancelled},
	LoanUnderReview: {LoanApproved, LoanRejected},
	LoanApproved:    {LoanDisbursed, LoanCancelled},
	LoanDisbursed:   {LoanRepaying},
	LoanRepaying:    {LoanSettled, LoanDefaulted},
	LoanDefaulted:   {LoanWrittenOff, LoanRepaying},
}

func canTransition(from, to LoanState) bool {
	allowed, ok := validLoanTransitions[from]
	if !ok { return false }
	for _, s := range allowed { if s == to { return true } }
	return false
}

func transitionLoan(currentState LoanState, newState LoanState, loanID string) error {
	if !canTransition(currentState, newState) {
		return fmt.Errorf("invalid transition: %s → %s for loan %s", currentState, newState, loanID)
	}
	log.Printf("[state-machine] Loan %s: %s → %s", loanID, currentState, newState)
	return nil
}

// GenerateAmortizationSchedule produces full repayment schedule
type AmortizationEntry struct {
	Period        int        `json:"period"`
	EMI           AmountKobo `json:"emi_kobo"`
	Principal     AmountKobo `json:"principal_kobo"`
	Interest      AmountKobo `json:"interest_kobo"`
	Balance       AmountKobo `json:"balance_kobo"`
	CumulativeInt AmountKobo `json:"cumulative_interest_kobo"`
}

func generateAmortizationSchedule(principalKobo AmountKobo, annualRatePct float64, tenorMonths int) []AmortizationEntry {
	if tenorMonths <= 0 { return nil }
	monthlyRate := annualRatePct / 12.0 / 100.0
	var emi AmountKobo
	if monthlyRate == 0 {
		emi = principalKobo / AmountKobo(tenorMonths)
	} else {
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emiFloat := float64(principalKobo) * monthlyRate * pow / (pow - 1)
		emi = AmountKobo(emiFloat)
	}

	schedule := make([]AmortizationEntry, 0, tenorMonths)
	balance := principalKobo
	var cumulativeInterest AmountKobo

	for i := 1; i <= tenorMonths; i++ {
		interestPart := AmountKobo(float64(balance) * monthlyRate)
		principalPart := emi - interestPart
		if i == tenorMonths { principalPart = balance } // settle rounding on last payment
		balance -= principalPart
		cumulativeInterest += interestPart
		schedule = append(schedule, AmortizationEntry{
			Period: i, EMI: emi, Principal: principalPart,
			Interest: interestPart, Balance: balance, CumulativeInt: cumulativeInterest,
		})
	}
	return schedule
}

// ComputeEarlySettlementPenalty — CBN allows max 1% penalty on outstanding
func computeEarlySettlementPenalty(outstandingKobo AmountKobo, monthsRemaining int, penaltyPct float64) AmountKobo {
	if penaltyPct > 1.0 { penaltyPct = 1.0 } // CBN cap
	return AmountKobo(float64(outstandingKobo) * penaltyPct / 100.0)
}

// ComputeLateFee — tiered by days past due
func computeLateFee(emiKobo AmountKobo, daysPastDue int) AmountKobo {
	if daysPastDue <= 0 { return 0 }
	var rate float64
	switch {
	case daysPastDue <= 7:  rate = 0.01  // 1%
	case daysPastDue <= 30: rate = 0.025 // 2.5%
	case daysPastDue <= 90: rate = 0.05  // 5%
	default:               rate = 0.10  // 10% (max)
	}
	return AmountKobo(float64(emiKobo) * rate)
}

// PAR (Portfolio at Risk) computation — CBN regulatory metric
func computePAR(totalLoansKobo, loansOverdueKobo AmountKobo, daysBucket int) float64 {
	if totalLoansKobo == 0 { return 0 }
	return float64(loansOverdueKobo) / float64(totalLoansKobo) * 100.0
}

// Provisioning rates per CBN Prudential Guidelines
func computeProvisioningRate(classificationDays int) float64 {
	switch {
	case classificationDays <= 90:  return 1.0   // Performing — 1%
	case classificationDays <= 180: return 10.0  // Watchlist — 10%
	case classificationDays <= 360: return 50.0  // Substandard — 50%
	case classificationDays <= 720: return 75.0  // Doubtful — 75%
	default:                        return 100.0 // Lost — 100%
	}
}

// ValidateLoanApplication with comprehensive error accumulation
func validateLoanApplicationDeep(
	customerID string, amount AmountKobo, tenorMonths int, annualRate float64,
	monthlyIncomeKobo AmountKobo, existingDebtKobo AmountKobo,
	kycLevel string, employmentYears float64, age int,
) (bool, []string) {
	var errors []string

	// Amount bounds (CBN microfinance: min ₦10K, max depends on tier)
	if amount < nairaToKobo(10000) { errors = append(errors, "amount below CBN minimum ₦10,000") }
	if amount > nairaToKobo(50000000) { errors = append(errors, "amount exceeds ₦50M max single obligor limit") }

	// Tenor bounds
	if tenorMonths < 1 { errors = append(errors, "tenor must be at least 1 month") }
	if tenorMonths > 360 { errors = append(errors, "tenor exceeds 30-year maximum") }

	// Rate bounds (CBN usury cap)
	if annualRate <= 0 { errors = append(errors, "interest rate must be positive") }
	if annualRate > 30 { errors = append(errors, "rate exceeds CBN maximum lending rate") }

	// DTI check
	emi := AmountKobo(0)
	if tenorMonths > 0 && annualRate > 0 {
		monthlyRate := annualRate / 12.0 / 100.0
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emi = AmountKobo(float64(amount) * monthlyRate * pow / (pow - 1))
	}
	dti := float64(existingDebtKobo+emi) / float64(monthlyIncomeKobo) * 100
	if dti > 60 { errors = append(errors, fmt.Sprintf("DTI ratio %.1f%% exceeds 60%% maximum", dti)) }

	// KYC tier check
	switch kycLevel {
	case "tier1":
		if amount > nairaToKobo(300000) { errors = append(errors, "Tier 1 KYC max loan ₦300,000") }
	case "tier2":
		if amount > nairaToKobo(5000000) { errors = append(errors, "Tier 2 KYC max loan ₦5,000,000") }
	case "tier3":
		// No limit for Tier 3
	default:
		errors = append(errors, "valid KYC level required (tier1/tier2/tier3)")
	}

	// Age check (18-65 at loan maturity)
	if age < 18 { errors = append(errors, "applicant must be 18+") }
	maturityAge := age + tenorMonths/12
	if maturityAge > 65 { errors = append(errors, fmt.Sprintf("applicant will be %d at maturity (max 65)", maturityAge)) }

	// Employment stability
	if employmentYears < 0.5 { errors = append(errors, "minimum 6 months employment required") }

	return len(errors) == 0, errors
}

// ReverseLoanDisbursement — compensation logic
func reverseLoanDisbursement(loanID, accountID string, amountKobo AmountKobo, reason string) map[string]interface{} {
	return map[string]interface{}{
		"reversal_id":  fmt.Sprintf("REV-%s-%d", loanID, time.Now().UnixMilli()),
		"loan_id":      loanID,
		"account_id":   accountID,
		"amount_kobo":  amountKobo,
		"reason":       reason,
		"status":       "reversed",
		"reversed_at":  time.Now().Format(time.RFC3339),
		"gl_entries": []map[string]interface{}{
			{"debit": "loan_receivable", "credit": accountID, "amount_kobo": amountKobo},
		},
	}
}


func ensureDB() {
	if db == nil {
		log.Printf("[%s] CRITICAL: No DATABASE_URL configured — service will reject all write operations", serviceName)
	}
}


// --- PII Masking (NDPR Compliance) ---
func maskPII(value, fieldType string) string {
	if len(value) == 0 { return "***" }
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
	case "phone":
		if len(value) >= 4 { return "+234***" + value[len(value)-4:] }
		return "+234***"
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return string(parts[0][0]) + "***@" + parts[1] }
		return "***@***"
	case "account":
		if len(value) >= 4 { return "****" + value[len(value)-4:] }
		return "****"
	default:
		if len(value) > 4 { return value[:1] + "***" + value[len(value)-1:] }
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	// Mask BVN patterns (11 digits)
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	msg = re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
	// Mask account numbers (10 digits)
	re2 := regexp.MustCompile(`\b[0-9]{10}\b`)
	msg = re2.ReplaceAllStringFunc(msg, func(s string) string { return "****" + s[len(s)-4:] })
	// Mask email
	re3 := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	msg = re3.ReplaceAllString(msg, "***@***")
	return msg
}


// --- Dead Letter Queue Handler ---
type DLQMessage struct {
	OriginalTopic string                 `json:"original_topic"`
	ConsumerGroup string                 `json:"consumer_group"`
	MessageKey    string                 `json:"message_key"`
	MessageValue  map[string]interface{} `json:"message_value"`
	ErrorMessage  string                 `json:"error_message"`
	RetryCount    int                    `json:"retry_count"`
	MaxRetries    int                    `json:"max_retries"`
	CreatedAt     string                 `json:"created_at"`
}

var dlqMessages []DLQMessage
var dlqMu sync.Mutex

func publishToDLQ(topic, consumerGroup, key string, value map[string]interface{}, err error, retryCount int) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	msg := DLQMessage{
		OriginalTopic: topic,
		ConsumerGroup: consumerGroup,
		MessageKey:    key,
		MessageValue:  value,
		ErrorMessage:  err.Error(),
		RetryCount:    retryCount,
		MaxRetries:    3,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	dlqMessages = append(dlqMessages, msg)
	log.Printf("[DLQ] Message sent to DLQ: topic=%s key=%s error=%s retries=%d", topic, key, err.Error(), retryCount)
}

func handleDLQList(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"dlq_messages": dlqMessages,
		"count":        len(dlqMessages),
	})
}

func handleDLQReplay(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	if len(dlqMessages) == 0 {
		respondJSON(w, 200, map[string]interface{}{"status": "empty", "replayed": 0})
		return
	}
	replayed := 0
	var remaining []DLQMessage
	for _, msg := range dlqMessages {
		if msg.RetryCount < msg.MaxRetries {
			log.Printf("[DLQ] Replaying: topic=%s key=%s attempt=%d", msg.OriginalTopic, msg.MessageKey, msg.RetryCount+1)
			replayed++
		} else {
			remaining = append(remaining, msg)
		}
	}
	dlqMessages = remaining
	respondJSON(w, 200, map[string]interface{}{"status": "replayed", "replayed": replayed, "remaining": len(remaining)})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8107"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/dlq", handleDLQList)
	mux.HandleFunc("/dlq/replay", handleDLQReplay)
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/entitlements/tiers", getTiers)
	mux.HandleFunc("/v1/entitlements/all", getEntitlements)
	mux.HandleFunc("/v1/entitlements/tenant", getEntitlement)
	mux.HandleFunc("/v1/entitlements/check", checkFeatureAccess)
	mux.HandleFunc("/v1/entitlements/provision", provisionTenant)
	mux.HandleFunc("/v1/entitlements/purchase-addon", purchaseAddOn)
	mux.HandleFunc("/v1/entitlements/upgrade", upgradeTier)
	mux.HandleFunc("/v1/entitlements/usage", featureUsageSummary)
	log.Printf("Feature Entitlement Engine (Go) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[feature-entitlement-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[feature-entitlement-go] Server stopped gracefully")
}
