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

type LeaseContract struct {
	ID string `json:"id"`
	LeaseType string `json:"lease_type"`
	Lessee string `json:"lessee"`
	AssetDescription string `json:"asset_description"`
	AssetValue float64 `json:"asset_value"`
	Currency string `json:"currency"`
	MonthlyRental float64 `json:"monthly_rental"`
	TenorMonths int `json:"tenor_months"`
	ResidualValue float64 `json:"residual_value"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []LeaseContract{}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "leasing-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"leasing.contracts","leasing.payments","leasing.assets"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"leasing-go:cache"}},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": []string{"lease_contracts","lease_payments","leased_assets"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"leasing-contracts","leasing-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "leasing-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"leasing-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "leasing-go", "pubsub": "leasing-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"leasing-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"LeasePaymentWorkflow","AssetReturnWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"lease_receivable","lease_deposit"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"leasing-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/leasing/contracts"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "leasing-go-waf"},
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
	var total float64
for _, d := range items { total += d.AssetValue }
stats := map[string]interface{}{"total_contracts": len(items), "total_asset_value": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8173")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/leasing/contracts", listItems)
	http.HandleFunc("/v1/leasing/stats", getStats)
	fmt.Printf("Leasing Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
