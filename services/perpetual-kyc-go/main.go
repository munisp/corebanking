package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "perpetual-kyc-go"

type ReKYCTrigger string

const (
	TriggerScheduledReview       ReKYCTrigger = "SCHEDULED_REVIEW"
	TriggerAdverseMedia          ReKYCTrigger = "ADVERSE_MEDIA_MATCH"
	TriggerSanctionsHit          ReKYCTrigger = "SANCTIONS_LIST_HIT"
	TriggerJurisdictionChange    ReKYCTrigger = "JURISDICTION_CHANGE"
	TriggerLargeDormancyGap      ReKYCTrigger = "LARGE_DORMANCY_GAP"
	TriggerBeneficialOwnerChange ReKYCTrigger = "BENEFICIAL_OWNER_CHANGE"
	TriggerTierEscalation        ReKYCTrigger = "TIER_ESCALATION"
	TriggerRiskScoreIncrease     ReKYCTrigger = "RISK_SCORE_INCREASE"
	TriggerPEPStatusChange       ReKYCTrigger = "PEP_STATUS_CHANGE"
	TriggerAddressChange         ReKYCTrigger = "ADDRESS_CHANGE"
)

var reviewIntervals = map[string]time.Duration{
	"high":   180 * 24 * time.Hour,
	"medium": 365 * 24 * time.Hour,
	"low":    730 * 24 * time.Hour,
}

type ReKYCEvent struct {
	EventID    string       `json:"event_id"`
	CustomerID string       `json:"customer_id"`
	Trigger    ReKYCTrigger `json:"trigger"`
	RiskLevel  string       `json:"risk_level"`
	Details    string       `json:"details"`
	CreatedAt  time.Time    `json:"created_at"`
	Status     string       `json:"status"`
	AssignedTo string       `json:"assigned_to,omitempty"`
	DueDate    time.Time    `json:"due_date"`
}

type CustomerRiskProfile struct {
	CustomerID      string    `json:"customer_id"`
	CurrentTier     string    `json:"current_tier"`
	RiskLevel       string    `json:"risk_level"`
	LastReviewDate  time.Time `json:"last_review_date"`
	NextReviewDate  time.Time `json:"next_review_date"`
	IsPEP           bool      `json:"is_pep"`
	IsHighRiskJuris bool      `json:"is_high_risk_jurisdiction"`
	RiskScore       int       `json:"risk_score"`
	TriggerHistory  string    `json:"trigger_history"`
}

type App struct {
	db *sql.DB
}

var app = &App{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/corebanking?sslmode=disable"
	}
	var err error
	app.db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB connection failed: %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS rekyc_events (
		event_id TEXT PRIMARY KEY,
		customer_id TEXT NOT NULL,
		trigger TEXT NOT NULL,
		risk_level TEXT NOT NULL,
		details TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		status TEXT NOT NULL DEFAULT 'pending',
		assigned_to TEXT NOT NULL DEFAULT '',
		due_date TIMESTAMPTZ NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_rekyc_customer ON rekyc_events(customer_id);
	CREATE INDEX IF NOT EXISTS idx_rekyc_status ON rekyc_events(status);

	CREATE TABLE IF NOT EXISTS customer_risk_profiles (
		customer_id TEXT PRIMARY KEY,
		current_tier TEXT NOT NULL DEFAULT '1',
		risk_level TEXT NOT NULL DEFAULT 'low',
		last_review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		next_review_date TIMESTAMPTZ NOT NULL,
		is_pep BOOLEAN NOT NULL DEFAULT FALSE,
		is_high_risk_juris BOOLEAN NOT NULL DEFAULT FALSE,
		risk_score INTEGER NOT NULL DEFAULT 20,
		trigger_history TEXT NOT NULL DEFAULT ''
	);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func getOrCreateProfile(customerID string) (*CustomerRiskProfile, error) {
	profile := &CustomerRiskProfile{}
	err := app.db.QueryRow(`SELECT customer_id, current_tier, risk_level, last_review_date, next_review_date, is_pep, is_high_risk_juris, risk_score, trigger_history
		FROM customer_risk_profiles WHERE customer_id = $1`, customerID).Scan(
		&profile.CustomerID, &profile.CurrentTier, &profile.RiskLevel,
		&profile.LastReviewDate, &profile.NextReviewDate, &profile.IsPEP,
		&profile.IsHighRiskJuris, &profile.RiskScore, &profile.TriggerHistory)
	if err == sql.ErrNoRows {
		profile = &CustomerRiskProfile{
			CustomerID:     customerID,
			CurrentTier:    "1",
			RiskLevel:      "low",
			LastReviewDate: time.Now().Add(-365 * 24 * time.Hour),
			NextReviewDate: time.Now().Add(365 * 24 * time.Hour),
			RiskScore:      20,
			TriggerHistory: "",
		}
		_, err = app.db.Exec(`INSERT INTO customer_risk_profiles (customer_id, current_tier, risk_level, last_review_date, next_review_date, risk_score, trigger_history)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			profile.CustomerID, profile.CurrentTier, profile.RiskLevel,
			profile.LastReviewDate, profile.NextReviewDate, profile.RiskScore, profile.TriggerHistory)
		if err != nil {
			return nil, fmt.Errorf("insert profile: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("query profile: %w", err)
	}
	return profile, nil
}

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
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	profile, err := getOrCreateProfile(req.CustomerID)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

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
	case TriggerAddressChange:
		requiresReKYC = profile.RiskLevel == "high"
	case TriggerScheduledReview:
		interval := reviewIntervals[profile.RiskLevel]
		if time.Since(profile.LastReviewDate) >= interval {
			requiresReKYC = true
		}
	}

	if profile.RiskScore >= 70 {
		profile.RiskLevel = "high"
	} else if profile.RiskScore >= 40 {
		profile.RiskLevel = "medium"
	}

	dueDate := time.Now().Add(7 * 24 * time.Hour)
	if urgency == "critical" {
		dueDate = time.Now().Add(24 * time.Hour)
	}
	if urgency == "high" {
		dueDate = time.Now().Add(3 * 24 * time.Hour)
	}

	eventID := fmt.Sprintf("REKYC-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%s-%d", req.CustomerID, req.Trigger, time.Now().UnixNano()))))
	if len(eventID) > 40 {
		eventID = eventID[:40]
	}
	detailsJSON, _ := json.Marshal(req.Details)
	status := "pending"
	if requiresReKYC {
		status = "requires_review"
	}

	_, err = app.db.Exec(`INSERT INTO rekyc_events (event_id, customer_id, trigger, risk_level, details, created_at, status, due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		eventID, req.CustomerID, string(req.Trigger), profile.RiskLevel, string(detailsJSON), time.Now(), status, dueDate)
	if err != nil {
		log.Printf("[%s] INSERT event failed: %v", serviceName, err)
	}

	if profile.TriggerHistory != "" {
		profile.TriggerHistory += "," + string(req.Trigger)
	} else {
		profile.TriggerHistory = string(req.Trigger)
	}
	profile.NextReviewDate = dueDate

	_, err = app.db.Exec(`UPDATE customer_risk_profiles SET risk_level = $1, risk_score = $2, next_review_date = $3, trigger_history = $4 WHERE customer_id = $5`,
		profile.RiskLevel, profile.RiskScore, profile.NextReviewDate, profile.TriggerHistory, profile.CustomerID)
	if err != nil {
		log.Printf("[%s] UPDATE profile failed: %v", serviceName, err)
	}

	respondJSON(w, 200, map[string]interface{}{
		"event_id":       eventID,
		"requires_rekyc": requiresReKYC,
		"urgency":        urgency,
		"risk_level":     profile.RiskLevel,
		"risk_score":     profile.RiskScore,
		"due_date":       dueDate.Format(time.RFC3339),
		"actions":        getRequiredActions(req.Trigger, profile),
	})
}

func getRequiredActions(trigger ReKYCTrigger, profile *CustomerRiskProfile) []string {
	switch trigger {
	case TriggerSanctionsHit:
		return []string{"FREEZE_ACCOUNT", "NOTIFY_COMPLIANCE_OFFICER", "FILE_STR_IF_CONFIRMED", "ESCALATE_TO_NFIU"}
	case TriggerPEPStatusChange:
		return []string{"ENHANCED_DUE_DILIGENCE", "SENIOR_MANAGEMENT_APPROVAL", "SOURCE_OF_WEALTH_VERIFICATION"}
	case TriggerAdverseMedia:
		return []string{"MANUAL_REVIEW", "UPDATE_RISK_PROFILE", "CONSIDER_ACCOUNT_RESTRICTION"}
	case TriggerJurisdictionChange:
		return []string{"RE_VERIFY_ADDRESS", "CHECK_NEW_JURISDICTION_RISK", "UPDATE_TAX_RESIDENCY"}
	case TriggerBeneficialOwnerChange:
		return []string{"RE_VERIFY_UBO_CHAIN", "UPDATE_OWNERSHIP_RECORDS", "RE_SCREEN_ALL_UBOS"}
	case TriggerTierEscalation:
		return []string{"COLLECT_ADDITIONAL_ID", "VERIFY_BVN_NIN", "UPDATE_KYC_TIER"}
	case TriggerLargeDormancyGap:
		return []string{"VERIFY_CUSTOMER_IDENTITY", "CONFIRM_REACTIVATION_INTENT", "REVIEW_RECENT_ACTIVITY"}
	default:
		return []string{"STANDARD_REVIEW", "UPDATE_RECORDS"}
	}
}

func getOverdueReviews(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT event_id, customer_id, trigger, risk_level, details, created_at, status, assigned_to, due_date
		FROM rekyc_events WHERE status != 'completed' AND due_date < NOW() ORDER BY due_date ASC`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	events := make([]ReKYCEvent, 0)
	for rows.Next() {
		var e ReKYCEvent
		if err := rows.Scan(&e.EventID, &e.CustomerID, &e.Trigger, &e.RiskLevel, &e.Details, &e.CreatedAt, &e.Status, &e.AssignedTo, &e.DueDate); err != nil {
			continue
		}
		events = append(events, e)
	}
	respondJSON(w, 200, map[string]interface{}{"overdue_count": len(events), "events": events})
}

func getCustomerProfile(w http.ResponseWriter, r *http.Request) {
	customerID := r.URL.Query().Get("customer_id")
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	profile := &CustomerRiskProfile{}
	err := app.db.QueryRow(`SELECT customer_id, current_tier, risk_level, last_review_date, next_review_date, is_pep, is_high_risk_juris, risk_score, trigger_history
		FROM customer_risk_profiles WHERE customer_id = $1`, customerID).Scan(
		&profile.CustomerID, &profile.CurrentTier, &profile.RiskLevel,
		&profile.LastReviewDate, &profile.NextReviewDate, &profile.IsPEP,
		&profile.IsHighRiskJuris, &profile.RiskScore, &profile.TriggerHistory)
	if err == sql.ErrNoRows {
		respondJSON(w, 404, map[string]string{"error": "customer not found"})
		return
	}
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	triggerList := []string{}
	if profile.TriggerHistory != "" {
		triggerList = strings.Split(profile.TriggerHistory, ",")
	}
	respondJSON(w, 200, map[string]interface{}{
		"customer_id":      profile.CustomerID,
		"current_tier":     profile.CurrentTier,
		"risk_level":       profile.RiskLevel,
		"last_review_date": profile.LastReviewDate,
		"next_review_date": profile.NextReviewDate,
		"is_pep":           profile.IsPEP,
		"is_high_risk_jurisdiction": profile.IsHighRiskJuris,
		"risk_score":       profile.RiskScore,
		"trigger_history":  triggerList,
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
		"triggers_supported": []string{"SCHEDULED_REVIEW", "ADVERSE_MEDIA_MATCH", "SANCTIONS_LIST_HIT", "JURISDICTION_CHANGE", "LARGE_DORMANCY_GAP", "BENEFICIAL_OWNER_CHANGE", "TIER_ESCALATION", "RISK_SCORE_INCREASE", "PEP_STATUS_CHANGE", "ADDRESS_CHANGE"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	initDB()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9041"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/rekyc/evaluate", evaluateTrigger)
	mux.HandleFunc("/api/v1/rekyc/overdue", getOverdueReviews)
	mux.HandleFunc("/api/v1/rekyc/profile", getCustomerProfile)
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] error: %v", serviceName, err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	if app.db != nil {
		app.db.Close()
	}
	log.Printf("[%s] Shutdown complete", serviceName)
}
