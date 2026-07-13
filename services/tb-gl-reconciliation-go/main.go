package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"tbclient"
)

var serviceName = "tb-gl-reconciliation-go"

type AccountBalance struct {
	AccountID     string  `json:"account_id"`
	GLBalanceKobo int64   `json:"gl_balance_kobo"`
	TBBalanceKobo int64   `json:"tb_balance_kobo"`
	DriftKobo     int64   `json:"drift_kobo"`
	DriftPct      float64 `json:"drift_pct"`
	Status        string  `json:"status"`
}

type ReconciliationRun struct {
	RunID         string           `json:"run_id"`
	StartedAt     time.Time        `json:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at,omitempty"`
	Status        string           `json:"status"`
	TotalAccounts int              `json:"total_accounts"`
	Matched       int              `json:"matched"`
	Drifted       int              `json:"drifted"`
	MissingInGL   int              `json:"missing_in_gl"`
	MissingInTB   int              `json:"missing_in_tb"`
	MaxDriftKobo  int64            `json:"max_drift_kobo"`
	Balances      []AccountBalance `json:"balances,omitempty"`
	Alerts        []string         `json:"alerts,omitempty"`
}

type App struct {
	db       *sql.DB
	tbClient *tbclient.Client
}

var app = &App{}

const (
	DriftThresholdKobo = 100
	DriftThresholdPct  = 0.0001
	AlertThresholdKobo = 10000
	CriticalDriftKobo  = 100000
)

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

	schema := `CREATE TABLE IF NOT EXISTS reconciliation_runs (
		run_id TEXT PRIMARY KEY,
		started_at TIMESTAMPTZ NOT NULL,
		completed_at TIMESTAMPTZ,
		status TEXT NOT NULL DEFAULT 'running',
		total_accounts INTEGER NOT NULL DEFAULT 0,
		matched INTEGER NOT NULL DEFAULT 0,
		drifted INTEGER NOT NULL DEFAULT 0,
		missing_in_gl INTEGER NOT NULL DEFAULT 0,
		missing_in_tb INTEGER NOT NULL DEFAULT 0,
		max_drift_kobo BIGINT NOT NULL DEFAULT 0,
		balances JSONB NOT NULL DEFAULT '[]',
		alerts JSONB NOT NULL DEFAULT '[]'
	);
	CREATE INDEX IF NOT EXISTS idx_recon_status ON reconciliation_runs(status);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func reconcile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GLAccounts []struct {
			AccountID   string `json:"account_id"`
			BalanceKobo int64  `json:"balance_kobo"`
		} `json:"gl_accounts"`
		TBAccounts []struct {
			AccountID     string `json:"account_id"`
			DebitsPosted  int64  `json:"debits_posted"`
			CreditsPosted int64  `json:"credits_posted"`
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
	for id := range glMap {
		allAccounts[id] = true
	}
	for id := range tbMap {
		allAccounts[id] = true
	}
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
				if absDrift < 0 {
					absDrift = -absDrift
				}
				if absDrift > run.MaxDriftKobo {
					run.MaxDriftKobo = absDrift
				}
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

	if app.db != nil {
		balancesJSON, _ := json.Marshal(run.Balances)
		alertsJSON, _ := json.Marshal(run.Alerts)
		_, err := app.db.Exec(`INSERT INTO reconciliation_runs (run_id, started_at, completed_at, status, total_accounts, matched, drifted, missing_in_gl, missing_in_tb, max_drift_kobo, balances, alerts)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			run.RunID, run.StartedAt, run.CompletedAt, run.Status, run.TotalAccounts, run.Matched, run.Drifted, run.MissingInGL, run.MissingInTB, run.MaxDriftKobo, string(balancesJSON), string(alertsJSON))
		if err != nil {
			log.Printf("[%s] INSERT run failed: %v", serviceName, err)
		}
	}

	respondJSON(w, 200, run)
}

func getHistory(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT run_id, started_at, completed_at, status, total_accounts, matched, drifted, missing_in_gl, missing_in_tb, max_drift_kobo, alerts
		FROM reconciliation_runs ORDER BY started_at DESC LIMIT 50`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	type RunSummary struct {
		RunID         string     `json:"run_id"`
		StartedAt     time.Time  `json:"started_at"`
		CompletedAt   *time.Time `json:"completed_at"`
		Status        string     `json:"status"`
		TotalAccounts int        `json:"total_accounts"`
		Matched       int        `json:"matched"`
		Drifted       int        `json:"drifted"`
		MissingInGL   int        `json:"missing_in_gl"`
		MissingInTB   int        `json:"missing_in_tb"`
		MaxDriftKobo  int64      `json:"max_drift_kobo"`
		Alerts        []string   `json:"alerts"`
	}

	runs := make([]RunSummary, 0)
	for rows.Next() {
		var rs RunSummary
		var alertsJSON string
		if err := rows.Scan(&rs.RunID, &rs.StartedAt, &rs.CompletedAt, &rs.Status, &rs.TotalAccounts, &rs.Matched, &rs.Drifted, &rs.MissingInGL, &rs.MissingInTB, &rs.MaxDriftKobo, &alertsJSON); err != nil {
			continue
		}
		json.Unmarshal([]byte(alertsJSON), &rs.Alerts)
		runs = append(runs, rs)
	}
	respondJSON(w, 200, map[string]interface{}{"total_runs": len(runs), "runs": runs})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
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

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	app.tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[%s] TB client init failed: %v", serviceName, err)
	}
}

func main() {
	initDB()
	initTBClient()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9043"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/reconciliation/run", reconcile)
	mux.HandleFunc("/api/v1/reconciliation/history", getHistory)
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
