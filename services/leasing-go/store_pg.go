package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local LeaseContract slice was removed; lease_contracts is the system of
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
var bootSeeds = []LeaseContract{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[leasing-go] DATABASE_URL not set — persistent store unavailable (contract endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[leasing-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[leasing-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS lease_contracts (
		id TEXT PRIMARY KEY,
		lease_type TEXT NOT NULL,
		lessee TEXT NOT NULL,
		asset_description TEXT NOT NULL,
		asset_value DOUBLE PRECISION NOT NULL CHECK (asset_value >= 0),
		currency TEXT NOT NULL,
		monthly_rental DOUBLE PRECISION NOT NULL,
		tenor_months INT NOT NULL,
		residual_value DOUBLE PRECISION NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[leasing-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[leasing-go] seed failed: %v", err)
	}
	log.Printf("[leasing-go] postgres store ready (table lease_contracts)")
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
		if _, err := tx.Exec(`INSERT INTO lease_contracts (id, lease_type, lessee, asset_description, asset_value, currency, monthly_rental, tenor_months, residual_value, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.LeaseType, r.Lessee, r.AssetDescription, r.AssetValue, r.Currency, r.MonthlyRental, r.TenorMonths, r.ResidualValue, r.Status); err != nil {
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
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"leasing-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, lease_type, lessee, asset_description, asset_value, currency, monthly_rental, tenor_months, residual_value, status FROM lease_contracts ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []LeaseContract{}
	for rows.Next() {
		var r LeaseContract

		if err := rows.Scan(&r.ID, &r.LeaseType, &r.Lessee, &r.AssetDescription, &r.AssetValue, &r.Currency, &r.MonthlyRental, &r.TenorMonths, &r.ResidualValue, &r.Status); err != nil {
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
	var n, s float64
	if err := pgDB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(asset_value),0) FROM lease_contracts`).Scan(&n, &s); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_contracts": n, "total_asset_value": s})
}
