package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

const serviceName = "identity-verification-service"

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	defaultProviderURL := getenv("IDENTITY_PROVIDER_URL", "https://identity.default.internal")
	defaultProviderKey := getenv("IDENTITY_PROVIDER_KEY", "identity-default-key")
	defaultTenantID := getenv("DEFAULT_TENANT_ID", "tenant-default")
	defaultWebhookSecret := getenv("IDENTITY_WEBHOOK_SECRET", "identity-webhook-secret")
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
				"provider_url":    defaultProviderURL,
				"provider_key":    defaultProviderKey,
				"tenant_id":       defaultTenantID,
				"webhook_secret":  defaultWebhookSecret,
				"seed_file":       seedFile,
			},
		})
	})
	mux.HandleFunc("/bootstrap", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "bootstrap-ready",
			"service": serviceName,
			"defaults": map[string]string{
				"provider_url":    defaultProviderURL,
				"provider_key":    defaultProviderKey,
				"tenant_id":       defaultTenantID,
				"webhook_secret":  defaultWebhookSecret,
				"seed_file":       seedFile,
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
