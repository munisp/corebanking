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
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "settlement-clearing-go"

type NostroPosition struct {
	PositionID    string    `json:"position_id"`
	BankCode      string    `json:"bank_code"`
	BankName      string    `json:"bank_name"`
	BalanceKobo   int64     `json:"balance_kobo"`
	Currency      string    `json:"currency"`
	MaxLimitKobo  int64     `json:"max_limit_kobo"`
	MinLimitKobo  int64     `json:"min_limit_kobo"`
	LastUpdated   time.Time `json:"last_updated"`
}

type NIPTransfer struct {
	TransferID     string    `json:"transfer_id"`
	SourceBank     string    `json:"source_bank"`
	DestBank       string    `json:"dest_bank"`
	AmountKobo     int64     `json:"amount_kobo"`
	SessionID      string    `json:"session_id"`
	PaymentRef     string    `json:"payment_ref"`
	NarrationCode  string    `json:"narration_code"`
	Status         string    `json:"status"`
	SettlementType string    `json:"settlement_type"`
	CreatedAt      time.Time `json:"created_at"`
}

type SettlementBatch struct {
	BatchID        string    `json:"batch_id"`
	BatchType      string    `json:"batch_type"`
	TotalTransfers int       `json:"total_transfers"`
	TotalKobo      int64     `json:"total_kobo"`
	NetPositions   string    `json:"net_positions"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	SettledAt      *time.Time `json:"settled_at,omitempty"`
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

	schema := `CREATE TABLE IF NOT EXISTS nostro_positions (
		position_id TEXT PRIMARY KEY,
		bank_code TEXT UNIQUE NOT NULL,
		bank_name TEXT NOT NULL,
		balance_kobo BIGINT NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'NGN',
		max_limit_kobo BIGINT NOT NULL DEFAULT 10000000000,
		min_limit_kobo BIGINT NOT NULL DEFAULT 100000000,
		last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE TABLE IF NOT EXISTS nip_transfers (
		transfer_id TEXT PRIMARY KEY,
		source_bank TEXT NOT NULL,
		dest_bank TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		session_id TEXT NOT NULL DEFAULT '',
		payment_ref TEXT NOT NULL DEFAULT '',
		narration_code TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'pending',
		settlement_type TEXT NOT NULL DEFAULT 'RTGS',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_nip_status ON nip_transfers(status);
	CREATE INDEX IF NOT EXISTS idx_nip_source ON nip_transfers(source_bank);

	CREATE TABLE IF NOT EXISTS settlement_batches (
		batch_id TEXT PRIMARY KEY,
		batch_type TEXT NOT NULL,
		total_transfers INTEGER NOT NULL DEFAULT 0,
		total_kobo BIGINT NOT NULL DEFAULT 0,
		net_positions JSONB NOT NULL DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		settled_at TIMESTAMPTZ
	);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	seedNostroPositions()
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func seedNostroPositions() {
	if app.db == nil {
		return
	}
	type seed struct {
		code, name string
		balance    int64
	}
	banks := []seed{
		{"000001", "Access Bank", 500000000000},
		{"000002", "First Bank", 450000000000},
		{"000003", "UBA", 400000000000},
		{"000004", "GTBank", 380000000000},
		{"000005", "Zenith Bank", 520000000000},
		{"000006", "Stanbic IBTC", 200000000000},
		{"000007", "Fidelity Bank", 150000000000},
		{"000008", "Polaris Bank", 120000000000},
		{"000009", "Union Bank", 180000000000},
		{"000010", "Wema Bank", 90000000000},
	}
	for i, b := range banks {
		posID := fmt.Sprintf("NOS-%03d", i+1)
		app.db.Exec(`INSERT INTO nostro_positions (position_id, bank_code, bank_name, balance_kobo) VALUES ($1, $2, $3, $4) ON CONFLICT (bank_code) DO NOTHING`,
			posID, b.code, b.name, b.balance)
	}
}

func processTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceBank    string `json:"source_bank"`
		DestBank      string `json:"dest_bank"`
		AmountKobo    int64  `json:"amount_kobo"`
		SessionID     string `json:"session_id"`
		PaymentRef    string `json:"payment_ref"`
		NarrationCode string `json:"narration_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.AmountKobo <= 0 {
		respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
		return
	}
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	// Check source bank nostro position
	var sourceBalance int64
	err := app.db.QueryRow(`SELECT balance_kobo FROM nostro_positions WHERE bank_code = $1`, req.SourceBank).Scan(&sourceBalance)
	if err == sql.ErrNoRows {
		respondJSON(w, 404, map[string]string{"error": "source bank not found"})
		return
	}
	if sourceBalance < req.AmountKobo {
		respondJSON(w, 422, map[string]interface{}{
			"error": "insufficient nostro position",
			"available_kobo": sourceBalance, "required_kobo": req.AmountKobo,
		})
		return
	}

	settlementType := "RTGS"
	if req.AmountKobo <= 500000000 { // <= 5M NGN
		settlementType = "NIP"
	}

	transferID := fmt.Sprintf("NIP-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:22]

	tx, err := app.db.Begin()
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "transaction start failed"})
		return
	}

	_, err = tx.Exec(`UPDATE nostro_positions SET balance_kobo = balance_kobo - $1, last_updated = NOW() WHERE bank_code = $2`, req.AmountKobo, req.SourceBank)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "debit failed"})
		return
	}
	_, err = tx.Exec(`UPDATE nostro_positions SET balance_kobo = balance_kobo + $1, last_updated = NOW() WHERE bank_code = $2`, req.AmountKobo, req.DestBank)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "credit failed"})
		return
	}
	_, err = tx.Exec(`INSERT INTO nip_transfers (transfer_id, source_bank, dest_bank, amount_kobo, session_id, payment_ref, narration_code, status, settlement_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'settled', $8)`,
		transferID, req.SourceBank, req.DestBank, req.AmountKobo, req.SessionID, req.PaymentRef, req.NarrationCode, settlementType)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "transfer record failed"})
		return
	}

	if err := tx.Commit(); err != nil {
		respondJSON(w, 500, map[string]string{"error": "commit failed"})
		return
	}

	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": transferID, "status": "settled",
		"settlement_type": settlementType,
		"amount_kobo": req.AmountKobo,
	})
}

func getPositions(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT position_id, bank_code, bank_name, balance_kobo, currency, max_limit_kobo, min_limit_kobo, last_updated FROM nostro_positions ORDER BY bank_code`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	positions := make([]NostroPosition, 0)
	var totalKobo int64
	for rows.Next() {
		var p NostroPosition
		if err := rows.Scan(&p.PositionID, &p.BankCode, &p.BankName, &p.BalanceKobo, &p.Currency, &p.MaxLimitKobo, &p.MinLimitKobo, &p.LastUpdated); err != nil {
			continue
		}
		positions = append(positions, p)
		totalKobo += p.BalanceKobo
	}

	breaches := make([]map[string]interface{}, 0)
	for _, p := range positions {
		if p.BalanceKobo < p.MinLimitKobo {
			breaches = append(breaches, map[string]interface{}{
				"bank_code": p.BankCode, "type": "BELOW_MINIMUM",
				"balance_kobo": p.BalanceKobo, "limit_kobo": p.MinLimitKobo,
			})
		}
	}

	respondJSON(w, 200, map[string]interface{}{
		"positions": positions, "total_nostro_kobo": totalKobo,
		"limit_breaches": breaches,
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
		"settlement_types": []string{"RTGS", "NIP", "DNS"},
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
		port = "9048"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/settlement/transfer", processTransfer)
	mux.HandleFunc("/api/v1/settlement/positions", getPositions)
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
