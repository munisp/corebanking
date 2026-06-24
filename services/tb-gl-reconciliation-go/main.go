package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
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

var serviceName = "tb-gl-reconciliation-go"

// ── Reconciliation Types ────────────────────────────────────────────────────

type AccountBalance struct {
	AccountID     string `json:"account_id"`
	GLBalanceKobo int64  `json:"gl_balance_kobo"`
	TBBalanceKobo int64  `json:"tb_balance_kobo"`
	DriftKobo     int64  `json:"drift_kobo"`
	DriftPct      float64 `json:"drift_pct"`
	Status        string `json:"status"` // matched, drifted, missing_in_gl, missing_in_tb
}

type ReconciliationRun struct {
	RunID        string    `json:"run_id"`
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	Status       string    `json:"status"` // running, completed, failed
	TotalAccounts int      `json:"total_accounts"`
	Matched      int       `json:"matched"`
	Drifted      int       `json:"drifted"`
	MissingInGL  int       `json:"missing_in_gl"`
	MissingInTB  int       `json:"missing_in_tb"`
	MaxDriftKobo int64     `json:"max_drift_kobo"`
	Balances     []AccountBalance `json:"balances,omitempty"`
	Alerts       []string  `json:"alerts,omitempty"`
}

type App struct {
	mu   sync.RWMutex
	runs []ReconciliationRun
	db   *sql.DB
}

var app = &App{runs: make([]ReconciliationRun, 0)}

// ── Drift Detection Thresholds ──────────────────────────────────────────────

const (
	DriftThresholdKobo  = 100     // 1 Naira absolute drift
	DriftThresholdPct   = 0.0001  // 0.01% relative drift
	AlertThresholdKobo  = 10000   // 100 Naira — escalate to compliance
	CriticalDriftKobo   = 100000  // 1000 Naira — halt and investigate
)

func reconcile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GLAccounts []struct {
			AccountID string `json:"account_id"`
			BalanceKobo int64 `json:"balance_kobo"`
		} `json:"gl_accounts"`
		TBAccounts []struct {
			AccountID string `json:"account_id"`
			DebitsPosted int64 `json:"debits_posted"`
			CreditsPosted int64 `json:"credits_posted"`
		} `json:"tb_accounts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	run := ReconciliationRun{
		RunID:     fmt.Sprintf("RECON-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:24],
		StartedAt: time.Now(),
		Status:    "running",
	}

	glMap := make(map[string]int64)
	for _, a := range req.GLAccounts {
		glMap[a.AccountID] = a.BalanceKobo
	}
	tbMap := make(map[string]int64)
	for _, a := range req.TBAccounts {
		tbMap[a.AccountID] = a.CreditsPosted - a.DebitsPosted
	}

	allAccounts := make(map[string]bool)
	for id := range glMap { allAccounts[id] = true }
	for id := range tbMap { allAccounts[id] = true }

	run.TotalAccounts = len(allAccounts)

	for id := range allAccounts {
		glBal, hasGL := glMap[id]
		tbBal, hasTB := tbMap[id]

		var ab AccountBalance
		ab.AccountID = id

		if !hasGL {
			ab.Status = "missing_in_gl"
			ab.TBBalanceKobo = tbBal
			run.MissingInGL++
			run.Alerts = append(run.Alerts, fmt.Sprintf("MISSING_IN_GL: account %s exists in TigerBeetle but not GL", id))
		} else if !hasTB {
			ab.Status = "missing_in_tb"
			ab.GLBalanceKobo = glBal
			run.MissingInTB++
			run.Alerts = append(run.Alerts, fmt.Sprintf("MISSING_IN_TB: account %s exists in GL but not TigerBeetle", id))
		} else {
			ab.GLBalanceKobo = glBal
			ab.TBBalanceKobo = tbBal
			ab.DriftKobo = glBal - tbBal
			if glBal != 0 {
				ab.DriftPct = math.Abs(float64(ab.DriftKobo)) / math.Abs(float64(glBal))
			}
			if ab.DriftKobo == 0 {
				ab.Status = "matched"
				run.Matched++
			} else {
				ab.Status = "drifted"
				run.Drifted++
				absDrift := ab.DriftKobo
				if absDrift < 0 { absDrift = -absDrift }
				if absDrift > run.MaxDriftKobo { run.MaxDriftKobo = absDrift }
				
				severity := "INFO"
				if absDrift >= CriticalDriftKobo {
					severity = "CRITICAL"
				} else if absDrift >= AlertThresholdKobo {
					severity = "WARNING"
				}
				run.Alerts = append(run.Alerts, fmt.Sprintf("%s: account %s drift=%d kobo (GL=%d, TB=%d)", severity, id, ab.DriftKobo, glBal, tbBal))
			}
		}
		run.Balances = append(run.Balances, ab)
	}

	now := time.Now()
	run.CompletedAt = &now
	run.Status = "completed"
	if run.Drifted > 0 && run.MaxDriftKobo >= CriticalDriftKobo {
		run.Status = "completed_with_critical_drift"
	}

	app.mu.Lock()
	app.runs = append(app.runs, run)
	app.mu.Unlock()

	respondJSON(w, 200, run)
}

func getHistory(w http.ResponseWriter, r *http.Request) {
	app.mu.RLock()
	defer app.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"total_runs": len(app.runs), "runs": app.runs})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName, "version": "1.0.0",
		"thresholds": map[string]interface{}{
			"drift_kobo": DriftThresholdKobo, "drift_pct": DriftThresholdPct,
			"alert_kobo": AlertThresholdKobo, "critical_kobo": CriticalDriftKobo,
		},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9043" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/reconciliation/run", reconcile)
	mux.HandleFunc("/api/v1/reconciliation/history", getHistory)
	
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

func init() { _ = sql.Drivers }
