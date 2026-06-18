// exchange-rate-service — real-time FX rates and currency conversion for 54Bank
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
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

var rates = map[string]float64{
	"USD/NGN": 1585.50,
	"GBP/NGN": 2015.30,
	"EUR/NGN": 1720.80,
	"USD/GHS": 15.42,
	"USD/KES": 129.75,
	"USD/ZAR": 18.63,
	"USD/XOF": 612.40,
}

func main() {
	port := getEnv("PORT", "9163")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "exchange-rate-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"middleware": map[string]string{
				"redis": "rate_cache (TTL 60s)",
				"fxProvider": getEnv("FX_PROVIDER_URL", "https://api.currencybeacon.com"),
			},
		})
	})

	mux.HandleFunc("/v1/rates/current", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"rates":     rates,
			"updatedAt": time.Now().UTC().Add(-30 * time.Second).Format(time.RFC3339),
			"source":    "CurrencyBeacon + CBN",
		})
	})

	mux.HandleFunc("/v1/rates/convert", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		from := q.Get("from")
		to := q.Get("to")
		pair := from + "/" + to
		rate, ok := rates[pair]
		if !ok {
			respondJSON(w, 404, map[string]string{"error": "pair not found"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"from": from, "to": to,
			"rate":      rate,
			"updatedAt": time.Now().UTC().Format(time.RFC3339),
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
		respondJSON(w, 200, map[string]interface{}{
			"supportedPairs":    len(rates),
			"conversionsToday":  48200,
			"cacheHitRatePct":   94.7,
			"lastRefreshAt":     time.Now().UTC().Add(-30 * time.Second).Format(time.RFC3339),
		})
	})

	log.Printf("[exchange-rate-service] FX rates service on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
