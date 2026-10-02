package main

// ── Postgres persistence (W12-B5P1H: money-path in-memory → Postgres) ──────
// The process-local FixedAsset slice was removed; fixed_assets is the system of
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
var bootSeeds = []FixedAsset{

	{ID: "FA-001", AssetName: "Victoria Island Head Office", Category: "building", Location: "Lagos", PurchaseValue: 25000000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 20000000000.0, Status: "in_use"},
	{ID: "FA-002", AssetName: "Core Banking System", Category: "software", Location: "Data Center", PurchaseValue: 5000000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 3500000000.0, Status: "in_use"},
	{ID: "FA-003", AssetName: "ATM Fleet (200 units)", Category: "equipment", Location: "Nationwide", PurchaseValue: 3000000000.0, Currency: "NGN", DepreciationMethod: "reducing_balance", NetBookValue: 1800000000.0, Status: "in_use"},
	{ID: "FA-004", AssetName: "Armoured Vehicles (15)", Category: "vehicle", Location: "Various", PurchaseValue: 1500000000.0, Currency: "NGN", DepreciationMethod: "reducing_balance", NetBookValue: 900000000.0, Status: "in_use"},
	{ID: "FA-005", AssetName: "Generator Sets (50 units)", Category: "equipment", Location: "Branches", PurchaseValue: 750000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 450000000.0, Status: "in_use"}}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[fixed-assets-go] DATABASE_URL not set — persistent store unavailable (asset endpoints will 503)")
		return
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[fixed-assets-go] postgres open failed: %v — endpoints will 503", err)
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[fixed-assets-go] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS fixed_assets (
		id TEXT PRIMARY KEY,
		asset_name TEXT NOT NULL,
		category TEXT NOT NULL,
		location TEXT NOT NULL,
		purchase_value DOUBLE PRECISION NOT NULL CHECK (purchase_value >= 0),
		currency TEXT NOT NULL,
		depreciation_method TEXT NOT NULL,
		net_book_value DOUBLE PRECISION NOT NULL,
		status TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[fixed-assets-go] schema init failed: %v — endpoints will 503", err)
		db.Close()
		return
	}
	pgDB = db
	if err := seedRows(); err != nil {
		log.Printf("[fixed-assets-go] seed failed: %v", err)
	}
	log.Printf("[fixed-assets-go] postgres store ready (table fixed_assets)")
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
		if _, err := tx.Exec(`INSERT INTO fixed_assets (id, asset_name, category, location, purchase_value, currency, depreciation_method, net_book_value, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
			r.ID, r.AssetName, r.Category, r.Location, r.PurchaseValue, r.Currency, r.DepreciationMethod, r.NetBookValue, r.Status); err != nil {
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
	fmt.Fprintf(w, `{"error":"store_unavailable","service":"fixed-assets-go"}`)
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	if pgDB == nil {
		storeUnavailable(w)
		return
	}
	rows, err := pgDB.Query(`SELECT id, asset_name, category, location, purchase_value, currency, depreciation_method, net_book_value, status FROM fixed_assets ORDER BY id`)
	if err != nil {
		storeUnavailable(w)
		return
	}
	defer rows.Close()
	items := []FixedAsset{}
	for rows.Next() {
		var r FixedAsset

		if err := rows.Scan(&r.ID, &r.AssetName, &r.Category, &r.Location, &r.PurchaseValue, &r.Currency, &r.DepreciationMethod, &r.NetBookValue, &r.Status); err != nil {
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
	var n, s, v float64
	if err := pgDB.QueryRow(`SELECT COUNT(*), COALESCE(SUM(purchase_value),0), COALESCE(SUM(net_book_value),0) FROM fixed_assets`).Scan(&n, &s, &v); err != nil {
		storeUnavailable(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_assets": n, "total_purchase_value": s, "total_nbv": v})
}
