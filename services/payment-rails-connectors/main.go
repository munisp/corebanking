// payment-rails-connectors — adapters for NIP, NEFT, RTGS, SWIFT and other payment rails
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
	port := getEnv("PORT", "9170")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "payment-rails-connectors",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"rails": map[string]string{
				"NIP":   "active",
				"NEFT":  "active",
				"RTGS":  "active",
				"SWIFT": "active",
				"SEPA":  "active",
			},
		})
	})

	mux.HandleFunc("/v1/rails/status", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"rails": []map[string]interface{}{
				{"name": "NIP", "provider": "NIBSS", "status": "operational", "latencyMs": 2800, "uptimePct": 99.98},
				{"name": "NEFT", "provider": "CBN", "status": "operational", "latencyMs": 18000, "uptimePct": 99.95},
				{"name": "RTGS", "provider": "CBN", "status": "operational", "latencyMs": 5000, "uptimePct": 99.99},
				{"name": "SWIFT", "provider": "SWIFT-GPI", "status": "operational", "latencyMs": 14400000, "uptimePct": 99.9},
				{"name": "SEPA", "provider": "EBA-CLEARING", "status": "operational", "latencyMs": 3600000, "uptimePct": 99.92},
			},
		})
	})

	mux.HandleFunc("/v1/rails/nip/submit", func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)
		respondJSON(w, 202, map[string]interface{}{
			"rail":        "NIP",
			"sessionCode": "999999" + time.Now().Format("20060102150405"),
			"status":      "processing",
		})
	})

	mux.HandleFunc("/v1/rails/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"totalRoutedToday":     48200,
			"nipVolume":            38000,
			"neftVolume":           4200,
			"rtgsVolume":           200,
			"swiftVolume":          12,
			"avgRoutingDecisionMs": 8,
		})
	})

	log.Printf("[payment-rails-connectors] Payment rails adapter on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
