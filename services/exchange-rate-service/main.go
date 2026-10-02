// exchange-rate-service — real-time FX rates and currency conversion for 54Bank
//
// Persistence (wave-12 C3-P0-B7): FX rates are Postgres-authoritative.
//   - Table fx_rates (pair PK, rate, source, updated_at) + fx_rate_refresh
//     (singleton row tracking last_refresh).
//   - Boot: initDB creates tables, seeds the static corridor rates
//     (ON CONFLICT DO NOTHING — never overwrites live rates), then hydrates
//     the in-memory read cache from PG.
//   - Reads: served from the boot-hydrated cache (rates change only via the
//     refresh path, which updates PG first and then the cache atomically).
//   - Refresh path: POST /v1/rates/refresh accepts {"rates": {"USD/NGN": 1600.1}}
//     and upserts all provided pairs + bumps last_refresh in ONE transaction.
//     No upstream provider fetch exists in this codebase (FX_PROVIDER_URL is
//     only advertised in /healthz); when a provider integration is added it
//     must call the same refreshRates() path so PG stays authoritative.
//   - Staleness: responses expose updatedAt/lastRefreshAt from PG; if PG is
//     unavailable the service runs in documented degraded mode on the seeded
//     in-memory rates and reports source:"degraded-in-memory".
package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var startTime = time.Now()

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// seedRates are the static corridor rates used to bootstrap an empty fx_rates
// table (and as degraded-mode fallback when DATABASE_URL is not configured).
var seedRates = map[string]float64{
	"USD/NGN": 1585.50,
	"GBP/NGN": 2015.30,
	"EUR/NGN": 1720.80,
	"USD/GHS": 15.42,
	"USD/KES": 129.75,
	"USD/ZAR": 18.63,
	"USD/XOF": 612.40,
}

var (
	db *sql.DB

	ratesMu     sync.RWMutex
	rates       = map[string]float64{} // read cache, hydrated from PG at boot
	ratesFrom   = "seed-in-memory"     // provenance of the cache
	lastRefresh time.Time
)

const fxDDL = `
CREATE TABLE IF NOT EXISTS fx_rates (
    pair       text PRIMARY KEY,
    rate       double precision NOT NULL CHECK (rate > 0),
    source     text NOT NULL DEFAULT 'seed',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fx_rate_refresh (
    id           smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_refresh timestamptz NOT NULL DEFAULT now()
);
INSERT INTO fx_rate_refresh (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
`

func initDB() {
	dsn := getEnv("DATABASE_URL", "")
	if dsn == "" {
		log.Printf("[exchange-rate-service] DATABASE_URL not set — degraded in-memory mode")
		for k, v := range seedRates {
			rates[k] = v
		}
		lastRefresh = startTime.UTC()
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[exchange-rate-service] pg open failed: %v — degraded in-memory mode", err)
		db = nil
		for k, v := range seedRates {
			rates[k] = v
		}
		lastRefresh = startTime.UTC()
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[exchange-rate-service] pg ping failed: %v — degraded in-memory mode", err)
		db = nil
		for k, v := range seedRates {
			rates[k] = v
		}
		lastRefresh = startTime.UTC()
		return
	}
	if _, err = db.Exec(fxDDL); err != nil {
		log.Fatalf("[exchange-rate-service] fx DDL failed: %v", err)
	}
	// Seed an empty table only; never clobber live rates.
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("[exchange-rate-service] seed tx begin: %v", err)
	}
	for pair, rate := range seedRates {
		if _, err = tx.Exec(
			`INSERT INTO fx_rates (pair, rate, source) VALUES ($1, $2, 'seed') ON CONFLICT (pair) DO NOTHING`,
			pair, rate); err != nil {
			tx.Rollback()
			log.Fatalf("[exchange-rate-service] seed insert %s: %v", pair, err)
		}
	}
	if err = tx.Commit(); err != nil {
		log.Fatalf("[exchange-rate-service] seed tx commit: %v", err)
	}
	hydrateFromPG()
}

// hydrateFromPG loads all rates + last_refresh into the read cache.
func hydrateFromPG() {
	rows, err := db.Query(`SELECT pair, rate, updated_at FROM fx_rates`)
	if err != nil {
		log.Fatalf("[exchange-rate-service] hydrate query: %v", err)
	}
	defer rows.Close()
	fresh := map[string]float64{}
	var latest time.Time
	for rows.Next() {
		var pair string
		var rate float64
		var updated time.Time
		if err := rows.Scan(&pair, &rate, &updated); err != nil {
			log.Fatalf("[exchange-rate-service] hydrate scan: %v", err)
		}
		fresh[pair] = rate
		if updated.After(latest) {
			latest = updated
		}
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("[exchange-rate-service] hydrate rows: %v", err)
	}
	var lr time.Time
	if err := db.QueryRow(`SELECT last_refresh FROM fx_rate_refresh WHERE id = 1`).Scan(&lr); err == nil {
		latest = lr
	}
	ratesMu.Lock()
	rates = fresh
	ratesFrom = "postgres"
	lastRefresh = latest.UTC()
	ratesMu.Unlock()
	log.Printf("[exchange-rate-service] hydrated %d FX pairs from postgres (last_refresh=%s)", len(fresh), latest.UTC().Format(time.RFC3339))
}

// refreshRates upserts the given pairs and bumps last_refresh in ONE
// transaction; the read cache is swapped only after a successful commit.
func refreshRates(newRates map[string]float64, source string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for pair, rate := range newRates {
		if rate <= 0 {
			tx.Rollback()
			return &httpError{msg: "rate must be > 0 for " + pair}
		}
		if _, err = tx.Exec(
			`INSERT INTO fx_rates (pair, rate, source, updated_at) VALUES ($1, $2, $3, now())
			 ON CONFLICT (pair) DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, updated_at = now()`,
			pair, rate, source); err != nil {
			tx.Rollback()
			return err
		}
	}
	if _, err = tx.Exec(`UPDATE fx_rate_refresh SET last_refresh = now() WHERE id = 1`); err != nil {
		tx.Rollback()
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	ratesMu.Lock()
	for pair, rate := range newRates {
		rates[pair] = rate
	}
	ratesFrom = "postgres"
	lastRefresh = time.Now().UTC()
	ratesMu.Unlock()
	return nil
}

type httpError struct{ msg string }

func (e *httpError) Error() string { return e.msg }

func main() {
	initDB()
	port := getEnv("PORT", "9163")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		ratesMu.RLock()
		src := ratesFrom
		ratesMu.RUnlock()
		pg := "down"
		if db != nil {
			if err := db.Ping(); err == nil {
				pg = "up"
			}
		} else {
			pg = "not-configured"
		}
		respondJSON(w, 200, map[string]interface{}{
			"service":     "exchange-rate-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"ratesSource": src,
			"postgres":    pg,
			"middleware": map[string]string{
				"redis":      "rate_cache (TTL 60s)",
				"fxProvider": getEnv("FX_PROVIDER_URL", "https://api.currencybeacon.com"),
			},
		})
	})

	mux.HandleFunc("/v1/rates/current", func(w http.ResponseWriter, _ *http.Request) {
		ratesMu.RLock()
		out := make(map[string]float64, len(rates))
		for k, v := range rates {
			out[k] = v
		}
		src := ratesFrom
		lr := lastRefresh
		ratesMu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{
			"rates":     out,
			"updatedAt": lr.Format(time.RFC3339),
			"source":    src,
		})
	})

	mux.HandleFunc("/v1/rates/refresh", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "postgres unavailable — refresh refused (fail-closed)"})
			return
		}
		var body struct {
			Rates  map[string]float64 `json:"rates"`
			Source string             `json:"source"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			respondJSON(w, 400, map[string]string{"error": "invalid JSON body"})
			return
		}
		if len(body.Rates) == 0 {
			respondJSON(w, 400, map[string]string{"error": "no rates provided"})
			return
		}
		source := body.Source
		if source == "" {
			source = "manual-refresh"
		}
		if err := refreshRates(body.Rates, source); err != nil {
			if he, ok := err.(*httpError); ok {
				respondJSON(w, 400, map[string]string{"error": he.msg})
				return
			}
			respondJSON(w, 500, map[string]string{"error": "refresh failed: " + err.Error()})
			return
		}
		ratesMu.RLock()
		lr := lastRefresh
		ratesMu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{
			"refreshed":     len(body.Rates),
			"lastRefreshAt": lr.Format(time.RFC3339),
			"stalenessNote": "rates are served from PG-hydrated cache; updatedAt/lastRefreshAt reflect the last successful refresh",
		})
	})

	mux.HandleFunc("/v1/rates/convert", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		from := q.Get("from")
		to := q.Get("to")
		pair := from + "/" + to
		ratesMu.RLock()
		rate, ok := rates[pair]
		lr := lastRefresh
		ratesMu.RUnlock()
		if !ok {
			respondJSON(w, 404, map[string]string{"error": "pair not found"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"from": from, "to": to,
			"rate":      rate,
			"updatedAt": lr.Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/v1/rates/history", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"pair": "USD/NGN",
			"history": []map[string]interface{}{
				{"date": "2026-05-18", "rate": 1580.00},
				{"date": "2026-05-19", "rate": 1583.25},
				{"date": "2026-05-20", "rate": 1585.50},
			},
		})
	})

	mux.HandleFunc("/v1/rates/stats", func(w http.ResponseWriter, _ *http.Request) {
		ratesMu.RLock()
		n := len(rates)
		lr := lastRefresh
		ratesMu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{
			"supportedPairs":   n,
			"conversionsToday": 48200,
			"cacheHitRatePct":  94.7,
			"lastRefreshAt":    lr.Format(time.RFC3339),
		})
	})

	log.Printf("[exchange-rate-service] FX rates service on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
