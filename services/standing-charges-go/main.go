package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

type StandingCharge struct {
	ID string `json:"id"`
	ChargeName string `json:"charge_name"`
	ChargeType string `json:"charge_type"`
	AccountType string `json:"account_type"`
	Amount float64 `json:"amount"`
	Frequency string `json:"frequency"`
	Currency string `json:"currency"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []StandingCharge{
		{ID: "SC-001", ChargeName: "Account Maintenance Fee", ChargeType: "flat", AccountType: "savings", Amount: 100.0, Frequency: "monthly", Currency: "NGN", Status: "active"},
		{ID: "SC-002", ChargeName: "SMS Alert Charges", ChargeType: "flat", AccountType: "all", Amount: 50.0, Frequency: "monthly", Currency: "NGN", Status: "active"},
		{ID: "SC-003", ChargeName: "Card Maintenance", ChargeType: "flat", AccountType: "current", Amount: 1000.0, Frequency: "annual", Currency: "NGN", Status: "active"},
		{ID: "SC-004", ChargeName: "COT/Turnover Commission", ChargeType: "percentage", AccountType: "current", Amount: 0.5, Frequency: "per_transaction", Currency: "NGN", Status: "active"},
		{ID: "SC-005", ChargeName: "Dormancy Fee", ChargeType: "flat", AccountType: "all", Amount: 500.0, Frequency: "quarterly", Currency: "NGN", Status: "active"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "standing-charges-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "standing-charges-go"},
			"fluvio": map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003")},
			"temporal": map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233")},
			"mojaloop": map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
			"lakehouse": map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
			"apisix": map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080")},
			"openappsec": map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
		},
	})
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
}

func getStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	stats := map[string]interface{}{"total_charges": len(items)}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8197")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/standing-charges-go/list", listItems)
	http.HandleFunc("/v1/standing-charges-go/stats", getStats)
	fmt.Printf("Standing Charges Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
