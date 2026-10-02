package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local FactoringDeal slice was removed; factoring_deals is the system of
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
var bootSeeds = []FactoringDeal{

	{ID: "FC-001", DealType: "recourse", Seller: "Dangote Cement Plc", Buyer: "Julius Berger Nigeria", InvoiceAmount: 250000000.0, AdvanceRate: 85.0, DiscountRate: 2.5, Currency: "NGN", DueDate: "2026-06-15", Status: "active"},
	{ID: "FC-002", DealType: "non_recourse", Seller: "BUA Foods Ltd", Buyer: "Shoprite Nigeria", InvoiceAmount: 150000000.0, AdvanceRate: 80.0, DiscountRate: 3.0, Currency: "NGN", DueDate: "2026-07-01", Status: "active"},
	{ID: "FC-003", DealType: "reverse", Seller: "Nestle Nigeria", Buyer: "Spar Nigeria", InvoiceAmount: 75000000.0, AdvanceRate: 90.0, DiscountRate: 1.8, Currency: "NGN", DueDate: "2026-05-30", Status: "disbursed"},
	{ID: "FC-004", DealType: "recourse", Seller: "Flour Mills Nigeria", Buyer: "Nigerian Bottling Co", InvoiceAmount: 500000000.0, AdvanceRate: 82.0, DiscountRate: 2.2, Currency: "NGN", DueDate: "2026-08-15", Status: "pending"},
	{ID: "FC-005", DealType: "export", Seller: "Olam Nigeria", Buyer: "Cargill International", InvoiceAmount: 5000000.0, AdvanceRate: 88.0, DiscountRate: 1.5, Currency: "USD", DueDate: "2026-06-30", Status: "active"}}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[factoring-go] DATABASE_URL not set — persistent store unavailable (deal endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[factoring-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[factoring-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS factoring_deals (
		id TEXT PRIMARY KEY,
		deal_type TEXT NOT NULL,
		seller TEXT NOT NULL,
		buyer TEXT NOT NULL,
		invoice_amount DOUBLE PRECISION NOT NULL CHECK (invoice_amount >= 0),
		advance_rate DOUBLE PRECISION NOT NULL,
		discount_rate DOUBLE PRECISION NOT NULL,
		currency TEXT NOT NULL,
		due_date TEXT NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[factoring-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[factoring-go] seed failed: %v", err)
	}
	log.Printf("[factoring-go] postgres store ready (table factoring_deals)")
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
		if _, err := tx.Exec(`INSERT INTO factoring_deals (id, deal_type, seller, buyer, invoice_amount, advance_rate, discount_rate, currency, due_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.DealType, r.Seller, r.Buyer, r.InvoiceAmount, r.AdvanceRate, r.DiscountRate, r.Currency, r.DueDate, r.Status); err != nil {
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
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"factoring-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, deal_type, seller, buyer, invoice_amount, advance_rate, discount_rate, currency, due_date, status FROM factoring_deals ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []FactoringDeal{}
	for rows.Next() {
		var r FactoringDeal

		if err := rows.Scan(&r.ID, &r.DealType, &r.Seller, &r.Buyer, &r.InvoiceAmount, &r.AdvanceRate, &r.DiscountRate, &r.Currency, &r.DueDate, &r.Status); err != nil {
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
	if err := pgDB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(invoice_amount),0) FROM factoring_deals`).Scan(&n, &s); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_deals": n, "total_invoice_value": s})
}
