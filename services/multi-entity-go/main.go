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

type BankEntity struct {
	ID string `json:"id"`
	EntityName string `json:"entity_name"`
	EntityType string `json:"entity_type"`
	Country string `json:"country"`
	RegNumber string `json:"reg_number"`
	Currency string `json:"currency"`
	TotalAssets float64 `json:"total_assets"`
	Subsidiary bool `json:"is_subsidiary"`
	ParentEntity string `json:"parent_entity"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []BankEntity{
		{ID: "ENT-001", EntityName: "54Bank Nigeria Ltd", EntityType: "commercial_bank", Country: "NG", RegNumber: "RC-123456", Currency: "NGN", TotalAssets: 2500000000000.0, Subsidiary: false, ParentEntity: "", Status: "active"},
		{ID: "ENT-002", EntityName: "54Bank Ghana Ltd", EntityType: "commercial_bank", Country: "GH", RegNumber: "GH-CB-0045", Currency: "GHS", TotalAssets: 500000000.0, Subsidiary: true, ParentEntity: "ENT-001", Status: "active"},
		{ID: "ENT-003", EntityName: "54Bank Kenya Ltd", EntityType: "commercial_bank", Country: "KE", RegNumber: "KE-CBK-0078", Currency: "KES", TotalAssets: 750000000.0, Subsidiary: true, ParentEntity: "ENT-001", Status: "active"},
		{ID: "ENT-004", EntityName: "54Capital Asset Mgmt", EntityType: "asset_management", Country: "NG", RegNumber: "SEC-AM-0012", Currency: "NGN", TotalAssets: 150000000000.0, Subsidiary: true, ParentEntity: "ENT-001", Status: "active"},
		{ID: "ENT-005", EntityName: "54Insurance Ltd", EntityType: "insurance", Country: "NG", RegNumber: "NAICOM-0034", Currency: "NGN", TotalAssets: 50000000000.0, Subsidiary: true, ParentEntity: "ENT-001", Status: "active"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "multi-entity-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"entity.config","entity.intercompany","entity.consolidation"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"multi-entity-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"bank_entities","entity_config","intercompany_transactions","consolidated_reports"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"entity-config","entity-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "multi-entity-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"multi-entity-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "multi-entity-go", "pubsub": "multi-entity-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"multi-entity-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"ConsolidationWorkflow","IntercompanySettlementWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"entity_intercompany","entity_consolidated"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"multi-entity-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/entities"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "multi-entity-go-waf"},
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
subs := 0
for _, d := range items { total += d.TotalAssets; if d.Subsidiary { subs++ } }
stats := map[string]interface{}{"total_entities": len(items), "subsidiaries": subs, "total_group_assets": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8184")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/entities", listItems)
	http.HandleFunc("/v1/entities/stats", getStats)
	fmt.Printf("Multi-Entity Management Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
