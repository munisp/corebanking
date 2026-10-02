package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local SyndicatedLoan slice was removed; syndicated_facilities is the system of
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
var bootSeeds = []SyndicatedLoan{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[syndicated-loans-go] DATABASE_URL not set — persistent store unavailable (facility endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[syndicated-loans-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[syndicated-loans-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS syndicated_facilities (
		id TEXT PRIMARY KEY,
		facility_name TEXT NOT NULL,
		borrower TEXT NOT NULL,
		total_amount DOUBLE PRECISION NOT NULL CHECK (total_amount >= 0),
		currency TEXT NOT NULL,
		lead_arranger TEXT NOT NULL,
		participant_count INT NOT NULL,
		interest_rate DOUBLE PRECISION NOT NULL,
		tenor TEXT NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[syndicated-loans-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[syndicated-loans-go] seed failed: %v", err)
	}
	log.Printf("[syndicated-loans-go] postgres store ready (table syndicated_facilities)")
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
		if _, err := tx.Exec(`INSERT INTO syndicated_facilities (id, facility_name, borrower, total_amount, currency, lead_arranger, participant_count, interest_rate, tenor, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.FacilityName, r.Borrower, r.TotalAmount, r.Currency, r.LeadArranger, r.ParticipantCount, r.InterestRate, r.Tenor, r.Status); err != nil {
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
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"syndicated-loans-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, facility_name, borrower, total_amount, currency, lead_arranger, participant_count, interest_rate, tenor, status FROM syndicated_facilities ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []SyndicatedLoan{}
	for rows.Next() {
		var r SyndicatedLoan

		if err := rows.Scan(&r.ID, &r.FacilityName, &r.Borrower, &r.TotalAmount, &r.Currency, &r.LeadArranger, &r.ParticipantCount, &r.InterestRate, &r.Tenor, &r.Status); err != nil {
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
	if err := pgDB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM syndicated_facilities`).Scan(&n, &s); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_facilities": n, "total_committed": s})
}
