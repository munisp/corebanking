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

type FixedAsset struct {
	ID string `json:"id"`
	AssetName string `json:"asset_name"`
	Category string `json:"category"`
	Location string `json:"location"`
	PurchaseValue float64 `json:"purchase_value"`
	Currency string `json:"currency"`
	DepreciationMethod string `json:"depreciation_method"`
	NetBookValue float64 `json:"net_book_value"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []FixedAsset{
		{ID: "FA-001", AssetName: "Victoria Island Head Office", Category: "building", Location: "Lagos", PurchaseValue: 25000000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 20000000000.0, Status: "in_use"},
		{ID: "FA-002", AssetName: "Core Banking System", Category: "software", Location: "Data Center", PurchaseValue: 5000000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 3500000000.0, Status: "in_use"},
		{ID: "FA-003", AssetName: "ATM Fleet (200 units)", Category: "equipment", Location: "Nationwide", PurchaseValue: 3000000000.0, Currency: "NGN", DepreciationMethod: "reducing_balance", NetBookValue: 1800000000.0, Status: "in_use"},
		{ID: "FA-004", AssetName: "Armoured Vehicles (15)", Category: "vehicle", Location: "Various", PurchaseValue: 1500000000.0, Currency: "NGN", DepreciationMethod: "reducing_balance", NetBookValue: 900000000.0, Status: "in_use"},
		{ID: "FA-005", AssetName: "Generator Sets (50 units)", Category: "equipment", Location: "Branches", PurchaseValue: 750000000.0, Currency: "NGN", DepreciationMethod: "straight_line", NetBookValue: 450000000.0, Status: "in_use"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "fixed-assets-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "fixed-assets-go"},
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
	var total, nbv float64
for _, d := range items { total += d.PurchaseValue; nbv += d.NetBookValue }
stats := map[string]interface{}{"total_assets": len(items), "total_purchase_value": total, "total_nbv": nbv}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8191")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/fixed-assets-go/list", listItems)
	http.HandleFunc("/v1/fixed-assets-go/stats", getStats)
	fmt.Printf("Fixed Assets Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
