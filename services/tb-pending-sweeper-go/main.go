package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"tbclient"
)

// TigerBeetle Pending Transfer Sweeper
// Background goroutine that auto-voids expired pending transfers (>5 min default).
// Prevents funds from being held indefinitely in 2PC pending state.
// Persists sweep results to PostgreSQL for audit trail.

type PendingTransfer struct {
	TransferID  string    `json:"transfer_id"`
	DebitAcct   string    `json:"debit_account_id"`
	CreditAcct  string    `json:"credit_account_id"`
	AmountKobo  int64     `json:"amount_kobo"`
	CreatedAt   time.Time `json:"created_at"`
	TimeoutSecs int       `json:"timeout_secs"`
	Status      string    `json:"status"` // pending, posted, voided, expired
}

type SweepResult struct {
	SweptAt     time.Time `json:"swept_at"`
	TransferID  string    `json:"transfer_id"`
	Action      string    `json:"action"` // voided
	AgeSeconds  float64   `json:"age_seconds"`
}

var (
	db             *sql.DB
	tbClient       *tbclient.Client
	pendingMu      sync.RWMutex
	pendingTxns    map[string]*PendingTransfer
	sweepResults   []SweepResult
	sweepInterval  = 30 * time.Second
	defaultTimeout = 5 * time.Minute
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_pending_transfers (
		transfer_id VARCHAR(128) PRIMARY KEY,
		debit_account_id VARCHAR(64) NOT NULL,
		credit_account_id VARCHAR(64) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		timeout_secs INTEGER NOT NULL DEFAULT 300,
		status VARCHAR(16) NOT NULL DEFAULT 'pending'
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sweep_results (
		id SERIAL PRIMARY KEY,
		swept_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		transfer_id VARCHAR(128) NOT NULL,
		action VARCHAR(16) NOT NULL DEFAULT 'voided',
		age_seconds NUMERIC(10,2) NOT NULL
	)`)
	log.Println("[tb-pending-sweeper] Schema initialized")
}

func loadPending() {
	pendingTxns = make(map[string]*PendingTransfer)
	if db == nil { return }
	rows, err := db.Query(`SELECT transfer_id, debit_account_id, credit_account_id, amount_kobo, created_at, timeout_secs, status
		FROM tb_pending_transfers WHERE status = 'pending'`)
	if err != nil { log.Printf("Load pending error: %v", err); return }
	defer rows.Close()
	count := 0
	for rows.Next() {
		var p PendingTransfer
		if err := rows.Scan(&p.TransferID, &p.DebitAcct, &p.CreditAcct, &p.AmountKobo, &p.CreatedAt, &p.TimeoutSecs, &p.Status); err != nil {
			continue
		}
		pendingTxns[p.TransferID] = &p
		count++
	}
	log.Printf("[tb-pending-sweeper] Loaded %d pending transfers from DB", count)
}

func sweepExpired() int {
	now := time.Now()
	pendingMu.Lock()
	defer pendingMu.Unlock()

	swept := 0
	for id, p := range pendingTxns {
		if p.Status != "pending" { continue }
		timeout := time.Duration(p.TimeoutSecs) * time.Second
		if timeout == 0 { timeout = defaultTimeout }
		age := now.Sub(p.CreatedAt)
		if age > timeout {
			p.Status = "expired"
			result := SweepResult{
				SweptAt:    now,
				TransferID: id,
				Action:     "voided",
				AgeSeconds: age.Seconds(),
			}
			sweepResults = append(sweepResults, result)
			if db != nil {
				db.Exec(`UPDATE tb_pending_transfers SET status = 'expired' WHERE transfer_id = $1`, id)
				db.Exec(`INSERT INTO tb_sweep_results (swept_at, transfer_id, action, age_seconds) VALUES ($1, $2, $3, $4)`,
					result.SweptAt, result.TransferID, result.Action, result.AgeSeconds)
			}
			// Void in TigerBeetle
			if tbClient != nil {
				pendingID := tbclient.NewUint128()
				if err := tbClient.VoidPendingTransfer(pendingID); err != nil {
					log.Printf("[sweeper] TB void failed for %s: %v", id, err)
				}
			}
			log.Printf("[sweeper] voided expired transfer %s (age: %.0fs, timeout: %ds)", id, age.Seconds(), p.TimeoutSecs)
			swept++
		}
	}
	return swept
}

func sweepLoop(ctx context.Context) {
	ticker := time.NewTicker(sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			sweepExpired()
			return
		case <-ticker.C:
			n := sweepExpired()
			if n > 0 {
				log.Printf("[sweeper] swept %d expired transfers", n)
			}
		}
	}
}

func registerPendingHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID  string `json:"transfer_id"`
		DebitAcct   string `json:"debit_account_id"`
		CreditAcct  string `json:"credit_account_id"`
		AmountKobo  int64  `json:"amount_kobo"`
		TimeoutSecs int    `json:"timeout_secs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	if req.TimeoutSecs == 0 { req.TimeoutSecs = 300 }

	p := &PendingTransfer{
		TransferID:  req.TransferID,
		DebitAcct:   req.DebitAcct,
		CreditAcct:  req.CreditAcct,
		AmountKobo:  req.AmountKobo,
		CreatedAt:   time.Now(),
		TimeoutSecs: req.TimeoutSecs,
		Status:      "pending",
	}

	pendingMu.Lock()
	pendingTxns[req.TransferID] = p
	pendingMu.Unlock()

	if db != nil {
		db.Exec(`INSERT INTO tb_pending_transfers (transfer_id, debit_account_id, credit_account_id, amount_kobo, created_at, timeout_secs, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending')
			ON CONFLICT (transfer_id) DO NOTHING`,
			p.TransferID, p.DebitAcct, p.CreditAcct, p.AmountKobo, p.CreatedAt, p.TimeoutSecs)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer": p, "timeout_secs": req.TimeoutSecs})
}

func resolvePendingHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID string `json:"transfer_id"`
		Action     string `json:"action"` // post or void
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	pendingMu.Lock()
	p, ok := pendingTxns[req.TransferID]
	if !ok {
		pendingMu.Unlock()
		http.Error(w, `{"error":"transfer not found"}`, 404)
		return
	}
	if p.Status != "pending" {
		pendingMu.Unlock()
		http.Error(w, fmt.Sprintf(`{"error":"transfer already %s"}`, p.Status), 409)
		return
	}
	p.Status = req.Action + "ed"
	pendingMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_pending_transfers SET status = $1 WHERE transfer_id = $2`, p.Status, req.TransferID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer_id": req.TransferID, "status": p.Status})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	pendingMu.RLock()
	pending, expired, posted, voided := 0, 0, 0, 0
	for _, p := range pendingTxns {
		switch p.Status {
		case "pending": pending++
		case "expired": expired++
		case "posted": posted++
		case "voided": voided++
		}
	}
	pendingMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pending": pending, "expired": expired, "posted": posted, "voided": voided,
		"sweep_interval_secs": sweepInterval.Seconds(),
		"default_timeout_secs": defaultTimeout.Seconds(),
		"total_sweeps": len(sweepResults),
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-pending-sweeper-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-pending-sweeper] TB client init failed: %v", err)
	}
}

func main() {
	initDB()
	initTBClient()
	loadPending()

	ctx, cancel := context.WithCancel(context.Background())
	go sweepLoop(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-sweeper/register", registerPendingHandler)
	mux.HandleFunc("/v1/tb-sweeper/resolve", resolvePendingHandler)
	mux.HandleFunc("/v1/tb-sweeper/status", statusHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" { port = "8301" }

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		log.Printf("[tb-pending-sweeper-go] Starting on :%s (sweep every %v, timeout %v)", port, sweepInterval, defaultTimeout)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	server.Shutdown(shutCtx)
	log.Println("[tb-pending-sweeper-go] Shutdown complete")
}
