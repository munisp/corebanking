package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local RemittanceTransaction slice was removed; remittance_transactions is the system of
// record. Fail-closed: when DATABASE_URL is unset/unreachable the data
// endpoints return 503 (no in-memory fallback on production paths).
// This service exposes no mutating endpoints (read model: list + stats);
// the former demo fixtures are preserved as idempotent boot seeds
// (INSERT … ON CONFLICT (id) DO NOTHING — natural-key idempotency).

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var pgDB *sql.DB

// bootSeeds preserves the former in-memory demo fixtures as idempotent PG
// seed rows; re-runs are no-ops via ON CONFLICT (id) DO NOTHING.
var bootSeeds = []RemittanceTransaction{

	{ID: "REM-001", Corridor: "UK-NG", SenderName: "Chidi Okafor", ReceiverName: "Ngozi Okafor", SendAmount: 1000.0, SendCurrency: "GBP", ReceiveAmount: 2050000.0, ReceiveCurrency: "NGN", FXRate: 2050.0, Channel: "mobile", Status: "completed"},
	{ID: "REM-002", Corridor: "US-NG", SenderName: "Emeka Eze", ReceiverName: "Chioma Eze", SendAmount: 2000.0, SendCurrency: "USD", ReceiveAmount: 3100000.0, ReceiveCurrency: "NGN", FXRate: 1550.0, Channel: "agent", Status: "completed"},
	{ID: "REM-003", Corridor: "AE-NG", SenderName: "Ibrahim Musa", ReceiverName: "Fatima Musa", SendAmount: 5000.0, SendCurrency: "AED", ReceiveAmount: 2125000.0, ReceiveCurrency: "NGN", FXRate: 425.0, Channel: "online", Status: "pending_compliance"},
	{ID: "REM-004", Corridor: "CA-NG", SenderName: "Adaeze Nwankwo", ReceiverName: "Obinna Nwankwo", SendAmount: 3000.0, SendCurrency: "CAD", ReceiveAmount: 3450000.0, ReceiveCurrency: "NGN", FXRate: 1150.0, Channel: "mobile", Status: "completed"},
	{ID: "REM-005", Corridor: "EU-NG", SenderName: "Tunde Bakare", ReceiverName: "Funke Bakare", SendAmount: 1500.0, SendCurrency: "EUR", ReceiveAmount: 2625000.0, ReceiveCurrency: "NGN", FXRate: 1750.0, Channel: "bank_transfer", Status: "processing"}}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[remittance-go] DATABASE_URL not set — persistent store unavailable (transaction endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[remittance-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[remittance-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS remittance_transactions (
		id TEXT PRIMARY KEY,
		corridor TEXT NOT NULL,
		sender_name TEXT NOT NULL,
		receiver_name TEXT NOT NULL,
		send_amount DOUBLE PRECISION NOT NULL CHECK (send_amount >= 0),
		send_currency TEXT NOT NULL,
		receive_amount DOUBLE PRECISION NOT NULL,
		receive_currency TEXT NOT NULL,
		fx_rate DOUBLE PRECISION NOT NULL,
		channel TEXT NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[remittance-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[remittance-go] seed failed: %v", err)
	}
	log.Printf("[remittance-go] postgres store ready (table remittance_transactions)")
}

// seedRows inserts the boot fixtures in ONE transaction, idempotently.
func seedRows() error {
	if pgDB == nil || len(bootSeeds) == 0 {
		return nil
	}
	tx, err := pgDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, r := range bootSeeds {
		if _, err := tx.Exec(`INSERT INTO remittance_transactions (id, corridor, sender_name, receiver_name, send_amount, send_currency, receive_amount, receive_currency, fx_rate, channel, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.Corridor, r.SenderName, r.ReceiverName, r.SendAmount, r.SendCurrency, r.ReceiveAmount, r.ReceiveCurrency, r.FXRate, r.Channel, r.Status); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func pgPing() bool {
	if pgDB == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return pgDB.PingContext(ctx) == nil
}

func storeUnavailable(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusServiceUnavailable)
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"remittance-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, corridor, sender_name, receiver_name, send_amount, send_currency, receive_amount, receive_currency, fx_rate, channel, status FROM remittance_transactions ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []RemittanceTransaction{}
	for rows.Next() {
		var r RemittanceTransaction

		if err := rows.Scan(&r.ID, &r.Corridor, &r.SenderName, &r.ReceiverName, &r.SendAmount, &r.SendCurrency, &r.ReceiveAmount, &r.ReceiveCurrency, &r.FXRate, &r.Channel, &r.Status); err != nil {
			storeUnavailable(w)
			return
		}

		items = append(items, r)
	}
	if err := rows.Err(); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
}

func getStats(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	var n, c, s float64
	if err := pgDB.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed'), COALESCE(SUM(receive_amount),0) FROM remittance_transactions`).Scan(&n, &c, &s); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_transactions": n, "completed": c, "total_receive_ngn": s})
}
