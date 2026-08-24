// api-metering — API usage metering and quota enforcement for 54Bank
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

func main() {
	port := getEnv("PORT", "9160")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "api-metering",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"middleware": map[string]string{
				"postgres": getEnv("DATABASE_URL", "postgresql://localhost:5432/metering_db"),
				"redis":    getEnv("REDIS_URL", "redis://localhost:6379"),
			},
		})
	})

	mux.HandleFunc("/v1/metering/usage", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"period":        "2026-05",
			"totalRequests": 14820000,
			"quotaLimit":    20000000,
			"quotaUsedPct":  74.1,
			"topConsumers": []map[string]interface{}{
				{"clientId": "client-001", "requests": 4200000},
				{"clientId": "client-002", "requests": 3100000},
			},
		})
	})

	mux.HandleFunc("/v1/metering/quotas", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"quotas": []map[string]interface{}{
				{"clientId": "client-001", "tier": "enterprise", "limit": 5000000, "used": 4200000},
				{"clientId": "client-002", "tier": "business", "limit": 1000000, "used": 310000},
			},
			"total": 2,
		})
	})

	mux.HandleFunc("/v1/metering/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"requestsToday":   485000,
			"avgLatencyMs":    42,
			"quotaViolations": 0,
			"activeClients":   128,
		})
	})

	log.Printf("[api-metering] API metering service on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
