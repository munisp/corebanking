package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	reconciliationRuns = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tigerbeetle_reconciliation_runs_total",
			Help: "Total number of reconciliation runs",
		},
		[]string{"status"},
	)

	discrepanciesFound = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tigerbeetle_discrepancies_found_total",
			Help: "Total number of discrepancies found",
		},
		[]string{"type", "severity"},
	)

	reconciliationDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "tigerbeetle_reconciliation_duration_seconds",
			Help:    "Duration of reconciliation runs",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300},
		},
	)

	accountsReconciled = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "tigerbeetle_accounts_reconciled",
			Help: "Number of accounts reconciled in last run",
		},
	)

	lastReconciliationTime = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "tigerbeetle_last_reconciliation_timestamp",
			Help: "Timestamp of last reconciliation run",
		},
	)
)

func init() {
	prometheus.MustRegister(reconciliationRuns)
	prometheus.MustRegister(discrepanciesFound)
	prometheus.MustRegister(reconciliationDuration)
	prometheus.MustRegister(accountsReconciled)
	prometheus.MustRegister(lastReconciliationTime)
}

// DiscrepancyType represents the type of discrepancy found
type DiscrepancyType string

const (
	DiscrepancyBalanceMismatch    DiscrepancyType = "balance_mismatch"
	DiscrepancyMissingInTB        DiscrepancyType = "missing_in_tigerbeetle"
	DiscrepancyMissingInPostgres  DiscrepancyType = "missing_in_postgres"
	DiscrepancyPendingMismatch    DiscrepancyType = "pending_balance_mismatch"
	DiscrepancyTransactionMissing DiscrepancyType = "transaction_missing"
)

// DiscrepancySeverity represents the severity of a discrepancy
type DiscrepancySeverity string

const (
	SeverityCritical DiscrepancySeverity = "critical" // Immediate attention required
	SeverityHigh     DiscrepancySeverity = "high"     // Should be resolved within hours
	SeverityMedium   DiscrepancySeverity = "medium"   // Should be resolved within a day
	SeverityLow      DiscrepancySeverity = "low"      // Minor discrepancy, can wait
)

// Discrepancy represents a reconciliation discrepancy
type Discrepancy struct {
	ID               string              `json:"id"`
	ReconciliationID string              `json:"reconciliation_id"`
	AccountID        string              `json:"account_id"`
	TenantID         string              `json:"tenant_id"`
	Type             DiscrepancyType     `json:"type"`
	Severity         DiscrepancySeverity `json:"severity"`
	TigerBeetleValue float64             `json:"tigerbeetle_value"`
	PostgresValue    float64             `json:"postgres_value"`
	Difference       float64             `json:"difference"`
	Description      string              `json:"description"`
	Status           string              `json:"status"` // open, investigating, resolved, ignored
	CreatedAt        time.Time           `json:"created_at"`
	ResolvedAt       *time.Time          `json:"resolved_at,omitempty"`
	ResolvedBy       string              `json:"resolved_by,omitempty"`
	ResolutionNotes  string              `json:"resolution_notes,omitempty"`
	AutoResolved     bool                `json:"auto_resolved"`
}

// ReconciliationRun represents a single reconciliation run
type ReconciliationRun struct {
	ID                 string        `json:"id"`
	StartTime          time.Time     `json:"start_time"`
	EndTime            *time.Time    `json:"end_time,omitempty"`
	Status             string        `json:"status"` // running, completed, failed
	TotalAccounts      int           `json:"total_accounts"`
	AccountsReconciled int           `json:"accounts_reconciled"`
	DiscrepanciesFound int           `json:"discrepancies_found"`
	AutoResolved       int           `json:"auto_resolved"`
	Duration           float64       `json:"duration_seconds"`
	Discrepancies      []Discrepancy `json:"discrepancies,omitempty"`
	Error              string        `json:"error,omitempty"`
}

// ReconciliationConfig holds configuration for the reconciliation service
type ReconciliationConfig struct {
	PostgresURL            string
	TigerBeetleAddr        string
	ReconciliationInterval time.Duration
	BatchSize              int
	ToleranceAmount        float64 // Small differences below this are auto-resolved
	AlertWebhookURL        string
	EnableAutoHealing      bool
}

// DefaultReconciliationConfig returns sensible defaults
func DefaultReconciliationConfig() ReconciliationConfig {
	return ReconciliationConfig{
		PostgresURL:            os.Getenv("DATABASE_URL"),
		TigerBeetleAddr:        os.Getenv("TIGERBEETLE_ADDRESS"),
		ReconciliationInterval: time.Hour,
		BatchSize:              1000,
		ToleranceAmount:        0.01, // 1 kobo tolerance
		AlertWebhookURL:        os.Getenv("ALERT_WEBHOOK_URL"),
		EnableAutoHealing:      os.Getenv("ENABLE_AUTO_HEALING") == "true",
	}
}

// TigerBeetleReconciliationService manages reconciliation between TigerBeetle and PostgreSQL
type TigerBeetleReconciliationService struct {
	config       ReconciliationConfig
	db           *sql.DB
	stopChan     chan struct{}
	wg           sync.WaitGroup
	running      bool
	runningMutex sync.Mutex
	httpClient   *http.Client
	lakehouse    *LakehousePublisher
}

// NewTigerBeetleReconciliationService creates a new reconciliation service
func NewTigerBeetleReconciliationService(config ReconciliationConfig) (*TigerBeetleReconciliationService, error) {
	db, err := sql.Open("postgres", config.PostgresURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	service := &TigerBeetleReconciliationService{
		config:     config,
		db:         db,
		stopChan:   make(chan struct{}),
		httpClient: &http.Client{Timeout: time.Second * 30},
		lakehouse:  NewLakehousePublisher(),
	}

	if err := service.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	return service, nil
}

// createTables creates the reconciliation tables
func (s *TigerBeetleReconciliationService) createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS reconciliation_runs (
			id VARCHAR(50) PRIMARY KEY,
			start_time TIMESTAMP WITH TIME ZONE NOT NULL,
			end_time TIMESTAMP WITH TIME ZONE,
			status VARCHAR(20) NOT NULL,
			total_accounts INTEGER DEFAULT 0,
			accounts_reconciled INTEGER DEFAULT 0,
			discrepancies_found INTEGER DEFAULT 0,
			auto_resolved INTEGER DEFAULT 0,
			duration_seconds FLOAT,
			error TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
			id VARCHAR(50) PRIMARY KEY,
			reconciliation_id VARCHAR(50) REFERENCES reconciliation_runs(id),
			account_id VARCHAR(50) NOT NULL,
			tenant_id VARCHAR(50),
			type VARCHAR(50) NOT NULL,
			severity VARCHAR(20) NOT NULL,
			tigerbeetle_value DECIMAL(20,4),
			postgres_value DECIMAL(20,4),
			difference DECIMAL(20,4),
			description TEXT,
			status VARCHAR(20) DEFAULT 'open',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			resolved_at TIMESTAMP WITH TIME ZONE,
			resolved_by VARCHAR(100),
			resolution_notes TEXT,
			auto_resolved BOOLEAN DEFAULT FALSE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON reconciliation_discrepancies(status)`,
		`CREATE INDEX IF NOT EXISTS idx_discrepancies_account ON reconciliation_discrepancies(account_id)`,
		`CREATE INDEX IF NOT EXISTS idx_discrepancies_severity ON reconciliation_discrepancies(severity)`,
	}

	for _, query := range queries {
		if _, err := s.db.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

// Start begins the scheduled reconciliation
func (s *TigerBeetleReconciliationService) Start() {
	s.runningMutex.Lock()
	if s.running {
		s.runningMutex.Unlock()
		return
	}
	s.running = true
	s.stopChan = make(chan struct{})
	s.runningMutex.Unlock()

	s.wg.Add(1)
	go s.reconciliationLoop()

	log.Printf("TigerBeetle Reconciliation Service started (interval: %v)", s.config.ReconciliationInterval)
}

// Stop stops the reconciliation service
func (s *TigerBeetleReconciliationService) Stop() {
	s.runningMutex.Lock()
	if !s.running {
		s.runningMutex.Unlock()
		return
	}
	s.running = false
	s.runningMutex.Unlock()

	close(s.stopChan)
	s.wg.Wait()
	log.Println("TigerBeetle Reconciliation Service stopped")
}

// reconciliationLoop runs reconciliation at configured intervals
func (s *TigerBeetleReconciliationService) reconciliationLoop() {
	defer s.wg.Done()

	// Run immediately on start
	s.RunReconciliation(context.Background())

	ticker := time.NewTicker(s.config.ReconciliationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.RunReconciliation(context.Background())
		}
	}
}

// RunReconciliation performs a full reconciliation run
func (s *TigerBeetleReconciliationService) RunReconciliation(ctx context.Context) *ReconciliationRun {
	runID := fmt.Sprintf("REC_%d", time.Now().UnixNano())
	startTime := time.Now()

	run := &ReconciliationRun{
		ID:        runID,
		StartTime: startTime,
		Status:    "running",
	}

	// Insert run record
	s.db.ExecContext(ctx, `
		INSERT INTO reconciliation_runs (id, start_time, status)
		VALUES ($1, $2, $3)
	`, runID, startTime, "running")

	log.Printf("Starting reconciliation run: %s", runID)

	defer func() {
		endTime := time.Now()
		run.EndTime = &endTime
		run.Duration = endTime.Sub(startTime).Seconds()

		// Update run record
		s.db.ExecContext(ctx, `
			UPDATE reconciliation_runs
			SET end_time = $1, status = $2, total_accounts = $3, accounts_reconciled = $4,
				discrepancies_found = $5, auto_resolved = $6, duration_seconds = $7, error = $8
			WHERE id = $9
		`, endTime, run.Status, run.TotalAccounts, run.AccountsReconciled,
			run.DiscrepanciesFound, run.AutoResolved, run.Duration, run.Error, runID)

		// Update metrics
		reconciliationRuns.WithLabelValues(run.Status).Inc()
		reconciliationDuration.Observe(run.Duration)
		accountsReconciled.Set(float64(run.AccountsReconciled))
		lastReconciliationTime.Set(float64(endTime.Unix()))

		log.Printf("Reconciliation run %s completed: %d accounts, %d discrepancies, %.2fs",
			runID, run.AccountsReconciled, run.DiscrepanciesFound, run.Duration)
		if s.lakehouse != nil {
			if err := s.lakehouse.PublishReconciliationRun(ctx, run); err != nil {
				log.Printf("warning: failed to publish reconciliation run %s to lakehouse: %v", runID, err)
			}
		}
	}()

	// Get all accounts from PostgreSQL
	accounts, err := s.getPostgresAccounts(ctx)
	if err != nil {
		run.Status = "failed"
		run.Error = fmt.Sprintf("Failed to get PostgreSQL accounts: %v", err)
		return run
	}
	run.TotalAccounts = len(accounts)

	// Get TigerBeetle balances
	tbBalances, err := s.getTigerBeetleBalances(ctx, accounts)
	if err != nil {
		run.Status = "failed"
		run.Error = fmt.Sprintf("Failed to get TigerBeetle balances: %v", err)
		return run
	}

	// Compare and find discrepancies
	for _, account := range accounts {
		run.AccountsReconciled++

		tbBalance, hasTB := tbBalances[account.AccountID]

		if !hasTB {
			// Account exists in PostgreSQL but not in TigerBeetle
			discrepancy := s.createDiscrepancy(runID, account, DiscrepancyMissingInTB,
				0, account.Balance, "Account exists in PostgreSQL but not in TigerBeetle")
			run.Discrepancies = append(run.Discrepancies, discrepancy)
			run.DiscrepanciesFound++
			discrepanciesFound.WithLabelValues(string(DiscrepancyMissingInTB), string(discrepancy.Severity)).Inc()
			continue
		}

		// Check balance mismatch
		diff := math.Abs(tbBalance - account.Balance)
		if diff > s.config.ToleranceAmount {
			discrepancy := s.createDiscrepancy(runID, account, DiscrepancyBalanceMismatch,
				tbBalance, account.Balance,
				fmt.Sprintf("Balance mismatch: TigerBeetle=%.4f, PostgreSQL=%.4f, Diff=%.4f",
					tbBalance, account.Balance, diff))

			auditResult, auditErr := runRustReconciliationAuditor(buildReconciliationAuditorInput(
				runID,
				account,
				tbBalance,
				account.Balance,
				s.config.ToleranceAmount,
			))
			if auditErr != nil {
				log.Printf("warning: reconciliation auditor unavailable for account %s: %v", account.AccountID, auditErr)
			} else {
				discrepancy.Description = fmt.Sprintf("%s | auditor=%s | reasons=%v", discrepancy.Description, auditResult.Classification, auditResult.Reasons)
				switch auditResult.Severity {
				case "critical":
					discrepancy.Severity = SeverityCritical
				case "high":
					discrepancy.Severity = SeverityHigh
				case "medium":
					discrepancy.Severity = SeverityMedium
				default:
					discrepancy.Severity = SeverityLow
				}
				if s.config.EnableAutoHealing && auditResult.AutoResolvable {
					discrepancy.AutoResolved = true
					discrepancy.Status = "resolved"
					now := time.Now()
					discrepancy.ResolvedAt = &now
					discrepancy.ResolutionNotes = fmt.Sprintf("Auto-resolved by Rust auditor classification: %s", auditResult.Classification)
					run.AutoResolved++
				}
			}

			run.Discrepancies = append(run.Discrepancies, discrepancy)
			run.DiscrepanciesFound++
			discrepanciesFound.WithLabelValues(string(DiscrepancyBalanceMismatch), string(discrepancy.Severity)).Inc()
		}
	}

	// Check for accounts in TigerBeetle but not in PostgreSQL
	pgAccountIDs := make(map[string]bool)
	for _, account := range accounts {
		pgAccountIDs[account.AccountID] = true
	}
	for tbAccountID := range tbBalances {
		if !pgAccountIDs[tbAccountID] {
			discrepancy := Discrepancy{
				ID:               fmt.Sprintf("DISC_%d", time.Now().UnixNano()),
				ReconciliationID: runID,
				AccountID:        tbAccountID,
				Type:             DiscrepancyMissingInPostgres,
				Severity:         SeverityHigh,
				TigerBeetleValue: tbBalances[tbAccountID],
				PostgresValue:    0,
				Difference:       tbBalances[tbAccountID],
				Description:      "Account exists in TigerBeetle but not in PostgreSQL",
				Status:           "open",
				CreatedAt:        time.Now(),
			}
			run.Discrepancies = append(run.Discrepancies, discrepancy)
			run.DiscrepanciesFound++
			discrepanciesFound.WithLabelValues(string(DiscrepancyMissingInPostgres), string(SeverityHigh)).Inc()
		}
	}

	// Save discrepancies
	for _, disc := range run.Discrepancies {
		s.saveDiscrepancy(ctx, disc)
		if s.lakehouse != nil {
			if err := s.lakehouse.PublishDiscrepancy(ctx, disc); err != nil {
				log.Printf("warning: failed to publish discrepancy %s to lakehouse: %v", disc.ID, err)
			}
			if disc.Severity == SeverityCritical || disc.Type == DiscrepancyMissingInTB || disc.Type == DiscrepancyMissingInPostgres {
				settlementNetwork := "internal"
				if disc.Type == DiscrepancyMissingInTB || disc.Type == DiscrepancyMissingInPostgres {
					settlementNetwork = "mojaloop"
				}
				if err := s.lakehouse.PublishSettlementException(ctx, run.ID, disc, settlementNetwork); err != nil {
					log.Printf("warning: failed to publish settlement exception %s to lakehouse: %v", disc.ID, err)
				}
			}
		}
	}

	// Send alerts for critical discrepancies
	criticalCount := 0
	for _, disc := range run.Discrepancies {
		if disc.Severity == SeverityCritical && disc.Status == "open" {
			criticalCount++
		}
	}
	if criticalCount > 0 {
		s.sendAlert(ctx, run, criticalCount)
	}

	run.Status = "completed"
	return run
}

// AccountInfo holds account information from PostgreSQL
type AccountInfo struct {
	AccountID      string
	TenantID       string
	Balance        float64
	PendingBalance float64
	Currency       string
	AccountType    string
}

// getPostgresAccounts retrieves all accounts from PostgreSQL
func (s *TigerBeetleReconciliationService) getPostgresAccounts(ctx context.Context) ([]AccountInfo, error) {
	query := `
		SELECT account_id, COALESCE(tenant_id, ''), balance, COALESCE(pending_balance, 0),
			   COALESCE(currency, 'NGN'), COALESCE(account_type, 'savings')
		FROM accounts
		WHERE status = 'active'
		ORDER BY account_id
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []AccountInfo
	for rows.Next() {
		var account AccountInfo
		if err := rows.Scan(&account.AccountID, &account.TenantID, &account.Balance,
			&account.PendingBalance, &account.Currency, &account.AccountType); err != nil {
			continue
		}
		accounts = append(accounts, account)
	}

	return accounts, nil
}

// getTigerBeetleBalances retrieves balances from the operational ledger path.
// The primary integration point is the ledger-service account balance API, which fronts TigerBeetle.
// If individual account lookups fail, the reconciliation run continues and records resulting discrepancies
// rather than silently pretending every missing response is a perfect balance match.
func (s *TigerBeetleReconciliationService) getTigerBeetleBalances(ctx context.Context, accounts []AccountInfo) (map[string]float64, error) {
	balances := make(map[string]float64)

	ledgerServiceURL := os.Getenv("LEDGER_SERVICE_URL")
	if ledgerServiceURL == "" {
		ledgerServiceURL = "http://ledger-service:8080"
	}

	var failedLookups int
	for _, account := range accounts {
		url := fmt.Sprintf("%s/api/v1/accounts/%s/balance", ledgerServiceURL, account.AccountID)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			failedLookups++
			log.Printf("failed to build TigerBeetle balance request for %s: %v", account.AccountID, err)
			continue
		}

		resp, err := s.httpClient.Do(req)
		if err != nil {
			failedLookups++
			log.Printf("failed to get TigerBeetle balance for %s: %v", account.AccountID, err)
			continue
		}

		if resp.StatusCode == http.StatusOK {
			var result struct {
				Balance float64 `json:"balance"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
				balances[account.AccountID] = result.Balance
			} else {
				failedLookups++
				log.Printf("failed to decode TigerBeetle balance response for %s: %v", account.AccountID, err)
			}
		} else {
			failedLookups++
			log.Printf("ledger-service returned status %d for TigerBeetle balance lookup on %s", resp.StatusCode, account.AccountID)
		}
		resp.Body.Close()
	}

	if failedLookups == len(accounts) && len(accounts) > 0 {
		return balances, fmt.Errorf("all TigerBeetle balance lookups failed via ledger-service")
	}

	return balances, nil
}

// createDiscrepancy creates a new discrepancy record
func (s *TigerBeetleReconciliationService) createDiscrepancy(runID string, account AccountInfo, discType DiscrepancyType,
	tbValue, pgValue float64, description string) Discrepancy {

	diff := math.Abs(tbValue - pgValue)

	// Determine severity based on difference amount
	var severity DiscrepancySeverity
	switch {
	case diff >= 1000000: // 1M+
		severity = SeverityCritical
	case diff >= 100000: // 100K+
		severity = SeverityHigh
	case diff >= 10000: // 10K+
		severity = SeverityMedium
	default:
		severity = SeverityLow
	}

	// Missing accounts are always high severity
	if discType == DiscrepancyMissingInTB || discType == DiscrepancyMissingInPostgres {
		if severity == SeverityLow {
			severity = SeverityMedium
		}
	}

	auditResult, auditErr := runRustReconciliationAuditor(buildReconciliationAuditorInput(runID, account, tbValue, pgValue, s.config.ToleranceAmount))
	if auditErr == nil {
		switch auditResult.Severity {
		case "critical":
			severity = SeverityCritical
		case "high":
			severity = SeverityHigh
		case "medium":
			severity = SeverityMedium
		default:
			severity = SeverityLow
		}
		description = fmt.Sprintf("%s | auditor=%s | reasons=%v", description, auditResult.Classification, auditResult.Reasons)
	} else {
		log.Printf("warning: reconciliation auditor unavailable during discrepancy creation for account %s: %v", account.AccountID, auditErr)
	}

	return Discrepancy{
		ID:               fmt.Sprintf("DISC_%d", time.Now().UnixNano()),
		ReconciliationID: runID,
		AccountID:        account.AccountID,
		TenantID:         account.TenantID,
		Type:             discType,
		Severity:         severity,
		TigerBeetleValue: tbValue,
		PostgresValue:    pgValue,
		Difference:       diff,
		Description:      description,
		Status:           "open",
		CreatedAt:        time.Now(),
	}
}

// saveDiscrepancy saves a discrepancy to the database
func (s *TigerBeetleReconciliationService) saveDiscrepancy(ctx context.Context, disc Discrepancy) error {
	query := `
		INSERT INTO reconciliation_discrepancies (
			id, reconciliation_id, account_id, tenant_id, type, severity,
			tigerbeetle_value, postgres_value, difference, description,
			status, created_at, resolved_at, resolved_by, resolution_notes, auto_resolved
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`
	_, err := s.db.ExecContext(ctx, query,
		disc.ID, disc.ReconciliationID, disc.AccountID, disc.TenantID,
		disc.Type, disc.Severity, disc.TigerBeetleValue, disc.PostgresValue,
		disc.Difference, disc.Description, disc.Status, disc.CreatedAt,
		disc.ResolvedAt, disc.ResolvedBy, disc.ResolutionNotes, disc.AutoResolved)
	return err
}

// sendAlert sends an alert for critical discrepancies
func (s *TigerBeetleReconciliationService) sendAlert(ctx context.Context, run *ReconciliationRun, criticalCount int) {
	if s.config.AlertWebhookURL == "" {
		return
	}

	alert := map[string]interface{}{
		"type":                "tigerbeetle_reconciliation_alert",
		"reconciliation_id":   run.ID,
		"critical_count":      criticalCount,
		"total_discrepancies": run.DiscrepanciesFound,
		"timestamp":           time.Now().Format(time.RFC3339),
		"message":             fmt.Sprintf("TigerBeetle reconciliation found %d critical discrepancies", criticalCount),
	}

	alertJSON, _ := json.Marshal(alert)
	req, _ := http.NewRequestWithContext(ctx, "POST", s.config.AlertWebhookURL,
		bytes.NewReader(alertJSON))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("Failed to send alert: %v", err)
		return
	}
	resp.Body.Close()
	log.Printf("Alert sent for %d critical discrepancies", criticalCount)
}

// HTTP API handlers

// RegisterRoutes registers HTTP routes for the reconciliation service
func (s *TigerBeetleReconciliationService) RegisterRoutes(router *gin.Engine) {
	recon := router.Group("/api/v1/reconciliation")
	{
		recon.POST("/run", s.handleRunReconciliation)
		recon.GET("/runs", s.handleListRuns)
		recon.GET("/runs/:run_id", s.handleGetRun)
		recon.GET("/discrepancies", s.handleListDiscrepancies)
		recon.GET("/discrepancies/:discrepancy_id", s.handleGetDiscrepancy)
		recon.POST("/discrepancies/:discrepancy_id/resolve", s.handleResolveDiscrepancy)
		recon.GET("/overview", s.handleOverview)
		recon.GET("/health", s.handleHealthCheck)
		recon.GET("/metrics", gin.WrapH(promhttp.Handler()))
	}
}

func (s *TigerBeetleReconciliationService) handleRunReconciliation(c *gin.Context) {
	run := s.RunReconciliation(c.Request.Context())
	c.JSON(http.StatusOK, run)
}

func (s *TigerBeetleReconciliationService) handleListRuns(c *gin.Context) {
	limit := c.DefaultQuery("limit", "20")

	rows, err := s.db.QueryContext(c.Request.Context(), `
		SELECT id, start_time, end_time, status, total_accounts, accounts_reconciled,
			   discrepancies_found, auto_resolved, duration_seconds, error
		FROM reconciliation_runs
		ORDER BY start_time DESC
		LIMIT $1
	`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var runs []ReconciliationRun
	for rows.Next() {
		var run ReconciliationRun
		var endTime sql.NullTime
		var errorStr sql.NullString
		rows.Scan(&run.ID, &run.StartTime, &endTime, &run.Status, &run.TotalAccounts,
			&run.AccountsReconciled, &run.DiscrepanciesFound, &run.AutoResolved,
			&run.Duration, &errorStr)
		if endTime.Valid {
			run.EndTime = &endTime.Time
		}
		if errorStr.Valid {
			run.Error = errorStr.String
		}
		runs = append(runs, run)
	}

	c.JSON(http.StatusOK, gin.H{"runs": runs})
}

func (s *TigerBeetleReconciliationService) handleGetRun(c *gin.Context) {
	runID := c.Param("run_id")

	var run ReconciliationRun
	var endTime sql.NullTime
	var errorStr sql.NullString

	err := s.db.QueryRowContext(c.Request.Context(), `
		SELECT id, start_time, end_time, status, total_accounts, accounts_reconciled,
			   discrepancies_found, auto_resolved, duration_seconds, error
		FROM reconciliation_runs WHERE id = $1
	`, runID).Scan(&run.ID, &run.StartTime, &endTime, &run.Status, &run.TotalAccounts,
		&run.AccountsReconciled, &run.DiscrepanciesFound, &run.AutoResolved,
		&run.Duration, &errorStr)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Run not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if endTime.Valid {
		run.EndTime = &endTime.Time
	}
	if errorStr.Valid {
		run.Error = errorStr.String
	}

	c.JSON(http.StatusOK, run)
}

func (s *TigerBeetleReconciliationService) handleListDiscrepancies(c *gin.Context) {
	status := c.DefaultQuery("status", "open")
	severity := c.DefaultQuery("severity", "")
	limit := c.DefaultQuery("limit", "50")

	query := `
		SELECT id, reconciliation_id, account_id, tenant_id, type, severity,
			   tigerbeetle_value, postgres_value, difference, description,
			   status, created_at, resolved_at, resolved_by, resolution_notes, auto_resolved
		FROM reconciliation_discrepancies
		WHERE status = $1
	`
	args := []interface{}{status}

	if severity != "" {
		query += " AND severity = $2"
		args = append(args, severity)
	}

	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := s.db.QueryContext(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var discrepancies []Discrepancy
	for rows.Next() {
		var disc Discrepancy
		var resolvedAt sql.NullTime
		var resolvedBy, resolutionNotes sql.NullString
		rows.Scan(&disc.ID, &disc.ReconciliationID, &disc.AccountID, &disc.TenantID,
			&disc.Type, &disc.Severity, &disc.TigerBeetleValue, &disc.PostgresValue,
			&disc.Difference, &disc.Description, &disc.Status, &disc.CreatedAt,
			&resolvedAt, &resolvedBy, &resolutionNotes, &disc.AutoResolved)
		if resolvedAt.Valid {
			disc.ResolvedAt = &resolvedAt.Time
		}
		if resolvedBy.Valid {
			disc.ResolvedBy = resolvedBy.String
		}
		if resolutionNotes.Valid {
			disc.ResolutionNotes = resolutionNotes.String
		}
		discrepancies = append(discrepancies, disc)
	}

	c.JSON(http.StatusOK, gin.H{"discrepancies": discrepancies})
}

func (s *TigerBeetleReconciliationService) handleGetDiscrepancy(c *gin.Context) {
	discID := c.Param("discrepancy_id")

	var disc Discrepancy
	var resolvedAt sql.NullTime
	var resolvedBy, resolutionNotes sql.NullString

	err := s.db.QueryRowContext(c.Request.Context(), `
		SELECT id, reconciliation_id, account_id, tenant_id, type, severity,
			   tigerbeetle_value, postgres_value, difference, description,
			   status, created_at, resolved_at, resolved_by, resolution_notes, auto_resolved
		FROM reconciliation_discrepancies WHERE id = $1
	`, discID).Scan(&disc.ID, &disc.ReconciliationID, &disc.AccountID, &disc.TenantID,
		&disc.Type, &disc.Severity, &disc.TigerBeetleValue, &disc.PostgresValue,
		&disc.Difference, &disc.Description, &disc.Status, &disc.CreatedAt,
		&resolvedAt, &resolvedBy, &resolutionNotes, &disc.AutoResolved)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Discrepancy not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if resolvedAt.Valid {
		disc.ResolvedAt = &resolvedAt.Time
	}
	if resolvedBy.Valid {
		disc.ResolvedBy = resolvedBy.String
	}
	if resolutionNotes.Valid {
		disc.ResolutionNotes = resolutionNotes.String
	}

	c.JSON(http.StatusOK, disc)
}

func (s *TigerBeetleReconciliationService) handleResolveDiscrepancy(c *gin.Context) {
	discID := c.Param("discrepancy_id")

	var req struct {
		ResolvedBy      string `json:"resolved_by" binding:"required"`
		ResolutionNotes string `json:"resolution_notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := s.db.ExecContext(c.Request.Context(), `
		UPDATE reconciliation_discrepancies
		SET status = 'resolved', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2
		WHERE id = $3 AND status = 'open'
	`, req.ResolvedBy, req.ResolutionNotes, discID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Discrepancy not found or already resolved"})
		return
	}

	if s.lakehouse != nil {
		if err := s.lakehouse.PublishDiscrepancyResolution(c.Request.Context(), discID, req.ResolvedBy, req.ResolutionNotes); err != nil {
			log.Printf("warning: failed to publish discrepancy resolution %s to lakehouse: %v", discID, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "resolved", "discrepancy_id": discID})
}

func (s *TigerBeetleReconciliationService) handleOverview(c *gin.Context) {
	var latestSnapshot struct {
		SnapshotID         string
		State              string
		DiscrepancyCount   int
		AutoResolvedCount  int
		AccountsReconciled int
		LastRunAt          time.Time
	}

	err := s.db.QueryRowContext(c.Request.Context(), `
		SELECT id, status, discrepancies_found, auto_resolved, accounts_reconciled, start_time
		FROM reconciliation_runs
		ORDER BY start_time DESC
		LIMIT 1
	`).Scan(
		&latestSnapshot.SnapshotID,
		&latestSnapshot.State,
		&latestSnapshot.DiscrepancyCount,
		&latestSnapshot.AutoResolvedCount,
		&latestSnapshot.AccountsReconciled,
		&latestSnapshot.LastRunAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{
			"asOf": time.Now().Format(time.RFC3339),
			"latestSnapshot": gin.H{
				"snapshotId":       "none",
				"state":            "idle",
				"discrepancyCount": 0,
				"autoResolvedCount": 0,
				"manualReviewCount": 0,
				"lastRunAt":        nil,
				"summary":          "No reconciliation run has been executed yet.",
			},
			"discrepancies": []Discrepancy{},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rows, err := s.db.QueryContext(c.Request.Context(), `
		SELECT id, reconciliation_id, account_id, tenant_id, type, severity,
		       tigerbeetle_value, postgres_value, difference, description,
		       status, created_at, resolved_at, resolved_by, resolution_notes, auto_resolved
		FROM reconciliation_discrepancies
		WHERE status = 'open'
		ORDER BY created_at DESC
		LIMIT 20
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var discrepancies []gin.H
	manualReviewCount := 0
	for rows.Next() {
		var disc Discrepancy
		var resolvedAt sql.NullTime
		var resolvedBy, resolutionNotes sql.NullString
		if err := rows.Scan(&disc.ID, &disc.ReconciliationID, &disc.AccountID, &disc.TenantID,
			&disc.Type, &disc.Severity, &disc.TigerBeetleValue, &disc.PostgresValue,
			&disc.Difference, &disc.Description, &disc.Status, &disc.CreatedAt,
			&resolvedAt, &resolvedBy, &resolutionNotes, &disc.AutoResolved); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !disc.AutoResolved {
			manualReviewCount++
		}
		discrepancies = append(discrepancies, gin.H{
			"discrepancyId": disc.ID,
			"accountId": disc.AccountID,
			"tenantId": disc.TenantID,
			"type": disc.Type,
			"severity": disc.Severity,
			"difference": disc.Difference,
			"description": disc.Description,
			"status": disc.Status,
			"autoResolved": disc.AutoResolved,
			"createdAt": disc.CreatedAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"asOf": time.Now().Format(time.RFC3339),
		"latestSnapshot": gin.H{
			"snapshotId":        latestSnapshot.SnapshotID,
			"state":             latestSnapshot.State,
			"discrepancyCount":  latestSnapshot.DiscrepancyCount,
			"autoResolvedCount": latestSnapshot.AutoResolvedCount,
			"manualReviewCount": manualReviewCount,
			"accountsReconciled": latestSnapshot.AccountsReconciled,
			"lastRunAt":         latestSnapshot.LastRunAt.Format(time.RFC3339),
			"summary":           fmt.Sprintf("Latest reconciliation run %s processed %d accounts and found %d discrepancies.", latestSnapshot.SnapshotID, latestSnapshot.AccountsReconciled, latestSnapshot.DiscrepancyCount),
		},
		"discrepancies": discrepancies,
	})
}

func (s *TigerBeetleReconciliationService) handleHealthCheck(c *gin.Context) {
	health := map[string]interface{}{
		"healthy": true,
		"service": "tigerbeetle-reconciliation",
	}

	// Check database connection
	if err := s.db.PingContext(c.Request.Context()); err != nil {
		health["healthy"] = false
		health["database_error"] = err.Error()
	}

	// Get last run info
	var lastRunTime sql.NullTime
	var lastRunStatus string
	s.db.QueryRowContext(c.Request.Context(), `
		SELECT start_time, status FROM reconciliation_runs ORDER BY start_time DESC LIMIT 1
	`).Scan(&lastRunTime, &lastRunStatus)

	if lastRunTime.Valid {
		health["last_run_time"] = lastRunTime.Time
		health["last_run_status"] = lastRunStatus
	}

	// Get open discrepancy counts
	var openCount, criticalCount int
	s.db.QueryRowContext(c.Request.Context(), `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE severity = 'critical')
		FROM reconciliation_discrepancies WHERE status = 'open'
	`).Scan(&openCount, &criticalCount)

	health["open_discrepancies"] = openCount
	health["critical_discrepancies"] = criticalCount

	c.JSON(http.StatusOK, health)
}

// Close closes the service and database connection
func (s *TigerBeetleReconciliationService) Close() error {
	s.Stop()
	return s.db.Close()
}

func main() {
	config := DefaultReconciliationConfig()

	service, err := NewTigerBeetleReconciliationService(config)
	if err != nil {
		log.Fatalf("Failed to create reconciliation service: %v", err)
	}
	defer service.Close()

	router := gin.Default()
	service.RegisterRoutes(router)

	// Start background reconciliation
	service.Start()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	log.Printf("TigerBeetle Reconciliation Service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
