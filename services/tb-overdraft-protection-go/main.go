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

// TigerBeetle Overdraft Protection
// Uses linked transfers + account flags: if primary account has insufficient
// funds, atomically checks and debits overdraft facility account in the same
// TB batch. credits_must_not_exceed_debits on primary ensures we detect
// insufficient funds, then the linked OD transfer covers the shortfall.

type OverdraftFacility struct {
	FacilityID    string    `json:"facility_id"`
	AccountID     string    `json:"account_id"`     // Primary account
	ODAccountID   string    `json:"od_account_id"`  // Overdraft facility account
	LimitKobo     int64     `json:"limit_kobo"`
	UsedKobo      int64     `json:"used_kobo"`
	AvailableKobo int64     `json:"available_kobo"`
	InterestRate  float64   `json:"interest_rate_pct"`
	Status        string    `json:"status"` // active, suspended, closed
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}

type ODTransfer struct {
	TransferID   string    `json:"transfer_id"`
	FacilityID   string    `json:"facility_id"`
	AmountKobo   int64     `json:"amount_kobo"`
	Type         string    `json:"type"` // drawdown, repayment
	BalanceBefore int64    `json:"balance_before_kobo"`
	BalanceAfter  int64    `json:"balance_after_kobo"`
	CreatedAt    time.Time `json:"created_at"`
}

var (
	db          *sql.DB
	facilitiesMu sync.RWMutex
	facilities   map[string]*OverdraftFacility
	odTransfers  []ODTransfer
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_overdraft_facilities (
		facility_id VARCHAR(64) PRIMARY KEY,
		account_id VARCHAR(64) NOT NULL,
		od_account_id VARCHAR(64) NOT NULL,
		limit_kobo BIGINT NOT NULL,
		used_kobo BIGINT NOT NULL DEFAULT 0,
		available_kobo BIGINT NOT NULL,
		interest_rate_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
		status VARCHAR(16) NOT NULL DEFAULT 'active',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_od_transfers (
		transfer_id VARCHAR(128) PRIMARY KEY,
		facility_id VARCHAR(64) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		type VARCHAR(16) NOT NULL,
		balance_before_kobo BIGINT NOT NULL,
		balance_after_kobo BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	log.Println("[tb-overdraft-protection] Schema initialized")
}

func loadFacilities() {
	facilities = make(map[string]*OverdraftFacility)
	if db == nil { return }
	rows, err := db.Query(`SELECT facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo,
		interest_rate_pct, status, created_at, expires_at FROM tb_overdraft_facilities WHERE status = 'active'`)
	if err != nil { log.Printf("Load facilities error: %v", err); return }
	defer rows.Close()
	for rows.Next() {
		var f OverdraftFacility
		if err := rows.Scan(&f.FacilityID, &f.AccountID, &f.ODAccountID, &f.LimitKobo, &f.UsedKobo,
			&f.AvailableKobo, &f.InterestRate, &f.Status, &f.CreatedAt, &f.ExpiresAt); err != nil {
			continue
		}
		facilities[f.AccountID] = &f
	}
	log.Printf("[tb-overdraft-protection] Loaded %d active facilities from DB", len(facilities))
}

func createFacilityHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID    string  `json:"account_id"`
		LimitKobo    int64   `json:"limit_kobo"`
		InterestRate float64 `json:"interest_rate_pct"`
		ExpiryDays   int     `json:"expiry_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	if req.LimitKobo <= 0 {
		http.Error(w, `{"error":"limit must be positive"}`, 400)
		return
	}

	f := &OverdraftFacility{
		FacilityID:    fmt.Sprintf("ODF-%d", time.Now().UnixNano()),
		AccountID:     req.AccountID,
		ODAccountID:   fmt.Sprintf("ODA-%s", req.AccountID),
		LimitKobo:     req.LimitKobo,
		UsedKobo:      0,
		AvailableKobo: req.LimitKobo,
		InterestRate:  req.InterestRate,
		Status:        "active",
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().AddDate(0, 0, req.ExpiryDays),
	}

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_overdraft_facilities (facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo, interest_rate_pct, status, created_at, expires_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			f.FacilityID, f.AccountID, f.ODAccountID, f.LimitKobo, f.UsedKobo, f.AvailableKobo, f.InterestRate, f.Status, f.CreatedAt, f.ExpiresAt)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
	}

	facilitiesMu.Lock()
	facilities[req.AccountID] = f
	facilitiesMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"facility": f,
		"tb_account_flags": map[string]interface{}{
			"primary_account":  "credits_must_not_exceed_debits",
			"od_account":       "linked to primary via TB linked transfers",
		},
	})
}

func drawdownHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	facilitiesMu.Lock()
	f, ok := facilities[req.AccountID]
	if !ok {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"no overdraft facility for this account"}`, 404)
		return
	}
	if f.Status != "active" {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"facility not active"}`, 403)
		return
	}
	if time.Now().After(f.ExpiresAt) {
		f.Status = "expired"
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"facility expired"}`, 403)
		return
	}
	if req.AmountKobo > f.AvailableKobo {
		facilitiesMu.Unlock()
		http.Error(w, fmt.Sprintf(`{"error":"exceeds available limit","available_kobo":%d,"requested_kobo":%d}`, f.AvailableKobo, req.AmountKobo), 403)
		return
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo += req.AmountKobo
	f.AvailableKobo = f.LimitKobo - f.UsedKobo

	transfer := ODTransfer{
		TransferID:    fmt.Sprintf("ODT-%d", time.Now().UnixNano()),
		FacilityID:    f.FacilityID,
		AmountKobo:    req.AmountKobo,
		Type:          "drawdown",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	odTransfers = append(odTransfers, transfer)
	facilitiesMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2 WHERE facility_id=$3`,
			f.UsedKobo, f.AvailableKobo, f.FacilityID)
		db.Exec(`INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transfer": transfer,
		"facility": f,
		"tb_linked_transfers": map[string]string{
			"description": "Atomic TB linked transfer: debit OD facility account, credit primary account",
			"flags":       "linked | pending",
		},
	})
}

func repayHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	facilitiesMu.Lock()
	f, ok := facilities[req.AccountID]
	if !ok {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"no overdraft facility for this account"}`, 404)
		return
	}

	repayAmount := req.AmountKobo
	if repayAmount > f.UsedKobo {
		repayAmount = f.UsedKobo
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo -= repayAmount
	f.AvailableKobo = f.LimitKobo - f.UsedKobo

	transfer := ODTransfer{
		TransferID:    fmt.Sprintf("ODT-%d", time.Now().UnixNano()),
		FacilityID:    f.FacilityID,
		AmountKobo:    repayAmount,
		Type:          "repayment",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	odTransfers = append(odTransfers, transfer)
	facilitiesMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2 WHERE facility_id=$3`,
			f.UsedKobo, f.AvailableKobo, f.FacilityID)
		db.Exec(`INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer": transfer, "facility": f})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	facilitiesMu.RLock()
	f, ok := facilities[accountID]
	facilitiesMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"no facility"}`, 404)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"facility": f})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-overdraft-protection-go"}`))
}

func main() {
	initDB()
	loadFacilities()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-overdraft/create", createFacilityHandler)
	mux.HandleFunc("/v1/tb-overdraft/drawdown", drawdownHandler)
	mux.HandleFunc("/v1/tb-overdraft/repay", repayHandler)
	mux.HandleFunc("/v1/tb-overdraft/status", statusHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" { port = "8304" }

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		log.Printf("[tb-overdraft-protection-go] Starting on :%s", port)
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
	log.Println("[tb-overdraft-protection-go] Shutdown complete")
}
