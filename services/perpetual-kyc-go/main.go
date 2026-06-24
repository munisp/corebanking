package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "perpetual-kyc-go"

// ── Trigger Types ───────────────────────────────────────────────────────────

type ReKYCTrigger string

const (
	TriggerScheduledReview   ReKYCTrigger = "SCHEDULED_REVIEW"
	TriggerAdverseMedia      ReKYCTrigger = "ADVERSE_MEDIA_MATCH"
	TriggerSanctionsHit      ReKYCTrigger = "SANCTIONS_LIST_HIT"
	TriggerJurisdictionChange ReKYCTrigger = "JURISDICTION_CHANGE"
	TriggerLargeDormancyGap  ReKYCTrigger = "LARGE_DORMANCY_GAP"
	TriggerBeneficialOwnerChange ReKYCTrigger = "BENEFICIAL_OWNER_CHANGE"
	TriggerTierEscalation    ReKYCTrigger = "TIER_ESCALATION"
	TriggerRiskScoreIncrease ReKYCTrigger = "RISK_SCORE_INCREASE"
	TriggerPEPStatusChange   ReKYCTrigger = "PEP_STATUS_CHANGE"
	TriggerAddressChange     ReKYCTrigger = "ADDRESS_CHANGE"
)

// CBN periodic review intervals
var reviewIntervals = map[string]time.Duration{
	"high":   180 * 24 * time.Hour,  // 6 months for high-risk
	"medium": 365 * 24 * time.Hour,  // 1 year for medium-risk
	"low":    730 * 24 * time.Hour,  // 2 years for low-risk
}

type ReKYCEvent struct {
	EventID    string       `json:"event_id"`
	CustomerID string       `json:"customer_id"`
	Trigger    ReKYCTrigger `json:"trigger"`
	RiskLevel  string       `json:"risk_level"`
	Details    interface{}  `json:"details"`
	CreatedAt  time.Time    `json:"created_at"`
	Status     string       `json:"status"` // pending, in_progress, completed, escalated
	AssignedTo string       `json:"assigned_to,omitempty"`
	DueDate    time.Time    `json:"due_date"`
}

type CustomerRiskProfile struct {
	CustomerID      string    `json:"customer_id"`
	CurrentTier     string    `json:"current_tier"` // 1, 2, 3
	RiskLevel       string    `json:"risk_level"`   // low, medium, high
	LastReviewDate  time.Time `json:"last_review_date"`
	NextReviewDate  time.Time `json:"next_review_date"`
	IsPEP           bool      `json:"is_pep"`
	IsHighRiskJuris bool      `json:"is_high_risk_jurisdiction"`
	RiskScore       int       `json:"risk_score"`
	TriggerHistory  []string  `json:"trigger_history"`
}

// ── State ───────────────────────────────────────────────────────────────────

type App struct {
	mu       sync.RWMutex
	events   []ReKYCEvent
	profiles map[string]*CustomerRiskProfile
	db       *sql.DB
}

var app = &App{
	events:   make([]ReKYCEvent, 0),
	profiles: make(map[string]*CustomerRiskProfile),
}

// ── Handlers ────────────────────────────────────────────────────────────────

func evaluateTrigger(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID string       `json:"customer_id"`
		Trigger    ReKYCTrigger `json:"trigger"`
		Details    interface{}  `json:"details"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	app.mu.Lock()
	defer app.mu.Unlock()

	profile, ok := app.profiles[req.CustomerID]
	if !ok {
		profile = &CustomerRiskProfile{
			CustomerID:     req.CustomerID,
			CurrentTier:    "1",
			RiskLevel:      "low",
			LastReviewDate: time.Now().Add(-365 * 24 * time.Hour),
			NextReviewDate: time.Now().Add(365 * 24 * time.Hour),
			RiskScore:      20,
		}
		app.profiles[req.CustomerID] = profile
	}

	// Determine if re-KYC is required
	requiresReKYC := false
	urgency := "normal"
	
	switch req.Trigger {
	case TriggerSanctionsHit, TriggerPEPStatusChange:
		requiresReKYC = true
		urgency = "critical"
		profile.RiskLevel = "high"
		profile.RiskScore += 40
	case TriggerAdverseMedia:
		requiresReKYC = true
		urgency = "high"
		profile.RiskScore += 25
	case TriggerJurisdictionChange, TriggerBeneficialOwnerChange:
		requiresReKYC = true
		urgency = "high"
		profile.RiskScore += 20
	case TriggerLargeDormancyGap:
		requiresReKYC = true
		urgency = "medium"
		profile.RiskScore += 15
	case TriggerRiskScoreIncrease:
		if profile.RiskScore >= 70 {
			requiresReKYC = true
			urgency = "high"
		}
	case TriggerTierEscalation:
		requiresReKYC = true
		urgency = "normal"
	case TriggerAddressChange:
		requiresReKYC = profile.RiskLevel == "high"
		urgency = "normal"
	case TriggerScheduledReview:
		interval := reviewIntervals[profile.RiskLevel]
		if time.Since(profile.LastReviewDate) >= interval {
			requiresReKYC = true
		}
	}

	if profile.RiskScore >= 70 { profile.RiskLevel = "high" } else if profile.RiskScore >= 40 { profile.RiskLevel = "medium" }

	dueDate := time.Now().Add(7 * 24 * time.Hour) // default 7 days
	if urgency == "critical" { dueDate = time.Now().Add(24 * time.Hour) }
	if urgency == "high" { dueDate = time.Now().Add(3 * 24 * time.Hour) }

	event := ReKYCEvent{
		EventID:    fmt.Sprintf("REKYC-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%s-%d", req.CustomerID, req.Trigger, time.Now().UnixNano())))),
		CustomerID: req.CustomerID,
		Trigger:    req.Trigger,
		RiskLevel:  profile.RiskLevel,
		Details:    req.Details,
		CreatedAt:  time.Now(),
		Status:     "pending",
		DueDate:    dueDate,
	}
	if requiresReKYC {
		event.Status = "requires_review"
	}
	app.events = append(app.events, event)
	profile.TriggerHistory = append(profile.TriggerHistory, string(req.Trigger))
	profile.NextReviewDate = dueDate

	respondJSON(w, 200, map[string]interface{}{
		"event_id":       event.EventID,
		"requires_rekyc": requiresReKYC,
		"urgency":        urgency,
		"risk_level":     profile.RiskLevel,
		"risk_score":     profile.RiskScore,
		"due_date":       dueDate.Format(time.RFC3339),
		"actions":        getRequiredActions(req.Trigger, profile),
	})
}

func getRequiredActions(trigger ReKYCTrigger, profile *CustomerRiskProfile) []string {
	actions := []string{}
	switch trigger {
	case TriggerSanctionsHit:
		actions = append(actions, "FREEZE_ACCOUNT", "NOTIFY_COMPLIANCE_OFFICER", "FILE_STR_IF_CONFIRMED", "ESCALATE_TO_NFIU")
	case TriggerPEPStatusChange:
		actions = append(actions, "ENHANCED_DUE_DILIGENCE", "SENIOR_MANAGEMENT_APPROVAL", "SOURCE_OF_WEALTH_VERIFICATION")
	case TriggerAdverseMedia:
		actions = append(actions, "MANUAL_REVIEW", "UPDATE_RISK_PROFILE", "CONSIDER_ACCOUNT_RESTRICTION")
	case TriggerJurisdictionChange:
		actions = append(actions, "RE_VERIFY_ADDRESS", "CHECK_NEW_JURISDICTION_RISK", "UPDATE_TAX_RESIDENCY")
	case TriggerBeneficialOwnerChange:
		actions = append(actions, "RE_VERIFY_UBO_CHAIN", "UPDATE_OWNERSHIP_RECORDS", "RE_SCREEN_ALL_UBOS")
	case TriggerTierEscalation:
		actions = append(actions, "COLLECT_ADDITIONAL_ID", "VERIFY_BVN_NIN", "UPDATE_KYC_TIER")
	case TriggerLargeDormancyGap:
		actions = append(actions, "VERIFY_CUSTOMER_IDENTITY", "CONFIRM_REACTIVATION_INTENT", "REVIEW_RECENT_ACTIVITY")
	default:
		actions = append(actions, "STANDARD_REVIEW", "UPDATE_RECORDS")
	}
	return actions
}

func getOverdueReviews(w http.ResponseWriter, r *http.Request) {
	app.mu.RLock()
	defer app.mu.RUnlock()
	overdue := []ReKYCEvent{}
	for _, e := range app.events {
		if e.Status != "completed" && time.Now().After(e.DueDate) {
			overdue = append(overdue, e)
		}
	}
	respondJSON(w, 200, map[string]interface{}{"overdue_count": len(overdue), "events": overdue})
}

func getCustomerProfile(w http.ResponseWriter, r *http.Request) {
	customerID := r.URL.Query().Get("customer_id")
	app.mu.RLock()
	defer app.mu.RUnlock()
	if profile, ok := app.profiles[customerID]; ok {
		respondJSON(w, 200, profile)
	} else {
		respondJSON(w, 404, map[string]string{"error": "customer not found"})
	}
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0",
		"triggers_supported": []string{"SCHEDULED_REVIEW", "ADVERSE_MEDIA_MATCH", "SANCTIONS_LIST_HIT", "JURISDICTION_CHANGE", "LARGE_DORMANCY_GAP", "BENEFICIAL_OWNER_CHANGE", "TIER_ESCALATION", "RISK_SCORE_INCREASE", "PEP_STATUS_CHANGE", "ADDRESS_CHANGE"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9041" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/rekyc/evaluate", evaluateTrigger)
	mux.HandleFunc("/api/v1/rekyc/overdue", getOverdueReviews)
	mux.HandleFunc("/api/v1/rekyc/profile", getCustomerProfile)
	
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] ListenAndServe error: %v", serviceName, err)
		}
	}()
	
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	_ = context.Background
	_ = net.Dial
	_ = strings.NewReader
	_ = atomic.AddInt64
	_ = sync.Once{}
}

func init() {
	_ = sql.Drivers
}
