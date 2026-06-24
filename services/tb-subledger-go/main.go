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
)

// TigerBeetle Sub-Ledger per Product
// Each banking product (savings, current, fixed deposit, loan) gets its own
// TB ledger ID. Enables product-level P&L, trial balance, and regulatory
// reporting without SQL aggregation.

type SubLedger struct {
	LedgerID    uint32    `json:"ledger_id"`
	ProductType string    `json:"product_type"`
	ProductName string    `json:"product_name"`
	Currency    string    `json:"currency"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	AccountCount int      `json:"account_count"`
}

type SubLedgerAccount struct {
	AccountID    string `json:"account_id"`
	LedgerID     uint32 `json:"ledger_id"`
	CustomerID   string `json:"customer_id"`
	DebitBalance int64  `json:"debit_balance_kobo"`
	CreditBalance int64 `json:"credit_balance_kobo"`
}

// Predefined TB ledger IDs per product type
var productLedgers = map[string]uint32{
	"savings":        1001,
	"current":        1002,
	"fixed_deposit":  1003,
	"loan":           1004,
	"overdraft":      1005,
	"treasury":       1006,
	"escrow":         1007,
	"nostro":         1008,
	"vostro":         1009,
	"suspense":       1010,
}

var (
	db         *sql.DB
	ledgersMu  sync.RWMutex
	ledgers    map[uint32]*SubLedger
	accounts   map[string]*SubLedgerAccount
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sub_ledgers (
		ledger_id INTEGER PRIMARY KEY,
		product_type VARCHAR(32) NOT NULL,
		product_name VARCHAR(128) NOT NULL,
		currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
		description TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		account_count INTEGER NOT NULL DEFAULT 0
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sub_ledger_accounts (
		account_id VARCHAR(64) PRIMARY KEY,
		ledger_id INTEGER NOT NULL REFERENCES tb_sub_ledgers(ledger_id),
		customer_id VARCHAR(64) NOT NULL,
		debit_balance_kobo BIGINT NOT NULL DEFAULT 0,
		credit_balance_kobo BIGINT NOT NULL DEFAULT 0
	)`)
	// Seed default ledgers
	for prodType, ledgerID := range productLedgers {
		db.Exec(`INSERT INTO tb_sub_ledgers (ledger_id, product_type, product_name, currency, description)
			VALUES ($1, $2, $3, 'NGN', $4)
			ON CONFLICT (ledger_id) DO NOTHING`,
			ledgerID, prodType, fmt.Sprintf("54Bank %s Ledger", prodType),
			fmt.Sprintf("TB sub-ledger for %s product accounts", prodType))
	}
	log.Println("[tb-subledger] Schema initialized with default ledgers")
}

func loadLedgers() {
	ledgers = make(map[uint32]*SubLedger)
	accounts = make(map[string]*SubLedgerAccount)
	if db == nil {
		for prodType, ledgerID := range productLedgers {
			ledgers[ledgerID] = &SubLedger{
				LedgerID: ledgerID, ProductType: prodType,
				ProductName: fmt.Sprintf("54Bank %s Ledger", prodType),
				Currency: "NGN", CreatedAt: time.Now(),
			}
		}
		return
	}
	rows, err := db.Query(`SELECT ledger_id, product_type, product_name, currency, description, created_at, account_count FROM tb_sub_ledgers`)
	if err != nil { log.Printf("Load ledgers error: %v", err); return }
	defer rows.Close()
	for rows.Next() {
		var l SubLedger
		if err := rows.Scan(&l.LedgerID, &l.ProductType, &l.ProductName, &l.Currency, &l.Description, &l.CreatedAt, &l.AccountCount); err != nil {
			continue
		}
		ledgers[l.LedgerID] = &l
	}
	log.Printf("[tb-subledger] Loaded %d sub-ledgers from DB", len(ledgers))
}

func listLedgersHandler(w http.ResponseWriter, r *http.Request) {
	ledgersMu.RLock()
	list := make([]*SubLedger, 0, len(ledgers))
	for _, l := range ledgers {
		list = append(list, l)
	}
	ledgersMu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ledgers": list, "count": len(list)})
}

func assignAccountHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID   string `json:"account_id"`
		ProductType string `json:"product_type"`
		CustomerID  string `json:"customer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	ledgerID, ok := productLedgers[req.ProductType]
	if !ok {
		http.Error(w, `{"error":"unknown product type"}`, 400)
		return
	}

	acct := &SubLedgerAccount{
		AccountID:  req.AccountID,
		LedgerID:   ledgerID,
		CustomerID: req.CustomerID,
	}

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_sub_ledger_accounts (account_id, ledger_id, customer_id)
			VALUES ($1, $2, $3) ON CONFLICT (account_id) DO UPDATE SET ledger_id=$2`,
			acct.AccountID, acct.LedgerID, acct.CustomerID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
		db.Exec(`UPDATE tb_sub_ledgers SET account_count = (SELECT COUNT(*) FROM tb_sub_ledger_accounts WHERE ledger_id = $1) WHERE ledger_id = $1`, ledgerID)
	}

	ledgersMu.Lock()
	accounts[req.AccountID] = acct
	ledgersMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"account": acct,
		"ledger":  ledgers[ledgerID],
	})
}

func productTrialBalanceHandler(w http.ResponseWriter, r *http.Request) {
	productType := r.URL.Query().Get("product_type")
	ledgerID, ok := productLedgers[productType]
	if !ok {
		http.Error(w, `{"error":"unknown product type"}`, 400)
		return
	}

	ledgersMu.RLock()
	totalDebits := int64(0)
	totalCredits := int64(0)
	acctCount := 0
	for _, a := range accounts {
		if a.LedgerID == ledgerID {
			totalDebits += a.DebitBalance
			totalCredits += a.CreditBalance
			acctCount++
		}
	}
	ledgersMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"product_type":      productType,
		"ledger_id":         ledgerID,
		"total_debits_kobo": totalDebits,
		"total_credits_kobo": totalCredits,
		"net_balance_kobo":  totalDebits - totalCredits,
		"account_count":     acctCount,
		"balanced":          totalDebits == totalCredits,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-subledger-go"}`))
}

func main() {
	initDB()
	loadLedgers()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-subledger/ledgers", listLedgersHandler)
	mux.HandleFunc("/v1/tb-subledger/assign", assignAccountHandler)
	mux.HandleFunc("/v1/tb-subledger/trial-balance", productTrialBalanceHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" { port = "8302" }

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		log.Printf("[tb-subledger-go] Starting on :%s with %d product ledgers", port, len(productLedgers))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Println("[tb-subledger-go] Shutdown complete")
}
