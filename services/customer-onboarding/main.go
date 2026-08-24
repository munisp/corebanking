package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

const serviceName = "customer-onboarding"

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// main wires the Go companion executable for customer-onboarding. The service
// API itself is Python (main.py, see Dockerfile); this binary exposes the
// conventional health/readiness/bootstrap probes and reports the lakehouse
// publishing defaults consumed by lakehouse_publisher.go. Mirrors the sibling
// hybrid-service template (services/identity-verification-service/main.go).
func main() {
	lakehouseURL := getenv("LAKEHOUSE_API_URL", "http://lakehouse-api:8000")
	seedFile := getenv("SEED_FILE", "seed_data.json")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "healthy",
			"service": serviceName,
		})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ready",
			"service": serviceName,
			"defaults": map[string]string{
				"lakehouse_api_url": lakehouseURL,
				"seed_file":         seedFile,
			},
		})
	})
	mux.HandleFunc("/bootstrap", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "bootstrap-ready",
			"service": serviceName,
			"defaults": map[string]string{
				"lakehouse_api_url": lakehouseURL,
				"seed_file":         seedFile,
			},
		})
	})

	port := getenv("PORT", "8080")
	log.Printf("%s listening on :%s", serviceName, port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
