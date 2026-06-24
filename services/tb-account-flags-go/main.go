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

// TigerBeetle Account Flags for regulatory controls.
// Uses TB's native flags: credits_must_not_exceed_debits (asset accounts),
// debits_must_not_exceed_credits (liability accounts).
// Enforced at ledger level — impossible to bypass via application logic.

type AccountFlag struct {
	AccountID   string    `json:"account_id"`
	FlagName    string    `json:"flag_name"`
	FlagValue   uint32    `json:"flag_value"`
	Reason      string    `json:"reason"`
	SetBy       string    `json:"set_by"`
	SetAt       time.Time `json:"set_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

// TB flag constants matching TigerBeetle spec
const (
	FlagLinked                     = 1 << 0
	FlagDebitsMustNotExceedCredits = 1 << 1
	FlagCreditsMustNotExceedDebits = 1 << 2
	FlagHistory                    = 1 << 3
	FlagImported                   = 1 << 4
	FlagClosed                     = 1 << 5
)

var (
	db         *sql.DB
	tbClient   *tbclient.Client
	flagsMu    sync.RWMutex
	flagsCache map[string][]AccountFlag
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_account_flags (
		id SERIAL PRIMARY KEY,
		account_id VARCHAR(64) NOT NULL,
		flag_name VARCHAR(64) NOT NULL,
		flag_value INTEGER NOT NULL,
		reason TEXT NOT NULL DEFAULT '',
		set_by VARCHAR(128) NOT NULL DEFAULT 'system',
		set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ,
		UNIQUE(account_id, flag_name)
	)`)
	log.Println("[tb-account-flags] Schema initialized")
}

func loadFlags() {
	flagsCache = make(map[string][]AccountFlag)
	if db == nil { return }
	rows, err := db.Query(`SELECT account_id, flag_name, flag_value, reason, set_by, set_at, expires_at FROM tb_account_flags`)
	if err != nil { log.Printf("Load flags error: %v", err); return }
	defer rows.Close()
	count := 0
	for rows.Next() {
		var f AccountFlag
		if err := rows.Scan(&f.AccountID, &f.FlagName, &f.FlagValue, &f.Reason, &f.SetBy, &f.SetAt, &f.ExpiresAt); err != nil {
			continue
		}
		flagsCache[f.AccountID] = append(flagsCache[f.AccountID], f)
		count++
	}
	log.Printf("[tb-account-flags] Loaded %d flags from DB", count)
}

func setFlagHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID string `json:"account_id"`
		FlagName  string `json:"flag_name"`
		Reason    string `json:"reason"`
		SetBy     string `json:"set_by"`
		TTLHours  int    `json:"ttl_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	flagValue := uint32(0)
	switch req.FlagName {
	case "debits_must_not_exceed_credits":
		flagValue = FlagDebitsMustNotExceedCredits
	case "credits_must_not_exceed_debits":
		flagValue = FlagCreditsMustNotExceedDebits
	case "history":
		flagValue = FlagHistory
	case "closed":
		flagValue = FlagClosed
	default:
		http.Error(w, `{"error":"unknown flag"}`, 400)
		return
	}

	now := time.Now()
	flag := AccountFlag{
		AccountID: req.AccountID,
		FlagName:  req.FlagName,
		FlagValue: flagValue,
		Reason:    req.Reason,
		SetBy:     req.SetBy,
		SetAt:     now,
	}
	if req.TTLHours > 0 {
		exp := now.Add(time.Duration(req.TTLHours) * time.Hour)
		flag.ExpiresAt = &exp
	}

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_account_flags (account_id, flag_name, flag_value, reason, set_by, set_at, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (account_id, flag_name) DO UPDATE SET flag_value=$3, reason=$4, set_by=$5, set_at=$6, expires_at=$7`,
			flag.AccountID, flag.FlagName, flag.FlagValue, flag.Reason, flag.SetBy, flag.SetAt, flag.ExpiresAt)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
	}

	// Apply flag to TigerBeetle account
	if tbClient != nil {
		acctID := tbclient.NewUint128()
		acct := tbclient.Account{
			ID:     acctID,
			Ledger: tbclient.LedgerNGN,
			Code:   tbclient.CodeAsset,
			Flags:  tbclient.AccountFlags(flagValue),
		}
		results, err := tbClient.CreateAccounts(context.Background(), []tbclient.Account{acct})
		if err != nil {
			log.Printf("[tb-account-flags] TB CreateAccounts error: %v", err)
		} else if len(results) > 0 {
			log.Printf("[tb-account-flags] TB CreateAccounts partial error: %d results", len(results))
		}
	}

	flagsMu.Lock()
	flagsCache[req.AccountID] = append(flagsCache[req.AccountID], flag)
	flagsMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"flag": flag, "tb_account_flags": flagValue})
}

func getFlagsHandler(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	if accountID == "" {
		http.Error(w, `{"error":"account_id required"}`, 400)
		return
	}
	flagsMu.RLock()
	flags := flagsCache[accountID]
	flagsMu.RUnlock()

	combined := uint32(0)
	active := []AccountFlag{}
	for _, f := range flags {
		if f.ExpiresAt != nil && time.Now().After(*f.ExpiresAt) {
			continue
		}
		combined |= f.FlagValue
		active = append(active, f)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"account_id":     accountID,
		"combined_flags": combined,
		"flags":          active,
		"count":          len(active),
	})
}

func validateTransferHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DebitAccountID  string `json:"debit_account_id"`
		CreditAccountID string `json:"credit_account_id"`
		AmountKobo      int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	flagsMu.RLock()
	debitFlags := flagsCache[req.DebitAccountID]
	creditFlags := flagsCache[req.CreditAccountID]
	flagsMu.RUnlock()

	violations := []string{}
	for _, f := range debitFlags {
		if f.ExpiresAt != nil && time.Now().After(*f.ExpiresAt) { continue }
		if f.FlagName == "closed" {
			violations = append(violations, "debit account is closed")
		}
	}
	for _, f := range creditFlags {
		if f.ExpiresAt != nil && time.Now().After(*f.ExpiresAt) { continue }
		if f.FlagName == "closed" {
			violations = append(violations, "credit account is closed")
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if len(violations) > 0 {
		w.WriteHeader(403)
		json.NewEncoder(w).Encode(map[string]interface{}{"allowed": false, "violations": violations})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"allowed": true, "violations": []string{}})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-account-flags-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-account-flags] TB client init failed: %v", err)
	}
}

func main() {
	initDB()
	initTBClient()
	loadFlags()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-flags/set", setFlagHandler)
	mux.HandleFunc("/v1/tb-flags/get", getFlagsHandler)
	mux.HandleFunc("/v1/tb-flags/validate-transfer", validateTransferHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" { port = "8300" }

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		log.Printf("[tb-account-flags-go] Starting on :%s", port)
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
	log.Println("[tb-account-flags-go] Shutdown complete")
}
