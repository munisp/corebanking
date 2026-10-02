package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local StandingCharge slice was removed; standing_charges is the system of
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
var bootSeeds = []StandingCharge{

	{ID: "SC-001", ChargeName: "Account Maintenance Fee", ChargeType: "flat", AccountType: "savings", Amount: 100.0, Frequency: "monthly", Currency: "NGN", Status: "active"},
	{ID: "SC-002", ChargeName: "SMS Alert Charges", ChargeType: "flat", AccountType: "all", Amount: 50.0, Frequency: "monthly", Currency: "NGN", Status: "active"},
	{ID: "SC-003", ChargeName: "Card Maintenance", ChargeType: "flat", AccountType: "current", Amount: 1000.0, Frequency: "annual", Currency: "NGN", Status: "active"},
	{ID: "SC-004", ChargeName: "COT/Turnover Commission", ChargeType: "percentage", AccountType: "current", Amount: 0.5, Frequency: "per_transaction", Currency: "NGN", Status: "active"},
	{ID: "SC-005", ChargeName: "Dormancy Fee", ChargeType: "flat", AccountType: "all", Amount: 500.0, Frequency: "quarterly", Currency: "NGN", Status: "active"}}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[standing-charges-go] DATABASE_URL not set — persistent store unavailable (charge endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[standing-charges-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[standing-charges-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS standing_charges (
		id TEXT PRIMARY KEY,
		charge_name TEXT NOT NULL,
		charge_type TEXT NOT NULL,
		account_type TEXT NOT NULL,
		amount DOUBLE PRECISION NOT NULL,
		frequency TEXT NOT NULL,
		currency TEXT NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[standing-charges-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[standing-charges-go] seed failed: %v", err)
	}
	log.Printf("[standing-charges-go] postgres store ready (table standing_charges)")
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
		if _, err := tx.Exec(`INSERT INTO standing_charges (id, charge_name, charge_type, account_type, amount, frequency, currency, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.ChargeName, r.ChargeType, r.AccountType, r.Amount, r.Frequency, r.Currency, r.Status); err != nil {
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
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"standing-charges-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, charge_name, charge_type, account_type, amount, frequency, currency, status FROM standing_charges ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []StandingCharge{}
	for rows.Next() {
		var r StandingCharge

		if err := rows.Scan(&r.ID, &r.ChargeName, &r.ChargeType, &r.AccountType, &r.Amount, &r.Frequency, &r.Currency, &r.Status); err != nil {
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
	var n float64
	if err := pgDB.QueryRow(`SELECT COUNT(*) FROM standing_charges`).Scan(&n); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_charges": n})
}
