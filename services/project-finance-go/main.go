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

type ProjectDeal struct {
	ID string `json:"id"`
	ProjectName string `json:"project_name"`
	Sponsor string `json:"sponsor"`
	Sector string `json:"sector"`
	TotalCost float64 `json:"total_cost"`
	DebtEquityRatio string `json:"debt_equity_ratio"`
	Currency string `json:"currency"`
	Tenor string `json:"tenor"`
	DSCR float64 `json:"dscr"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []ProjectDeal{}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "project-finance-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"project.disbursements","project.milestones","project.compliance"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"project-finance-go:cache"}},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": []string{"project_deals","project_milestones","project_disbursements","project_cashflows"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"project-finance","project-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "project-finance-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"project-finance-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "project-finance-go", "pubsub": "project-finance-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"project-finance-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"ProjectDisbursementWorkflow","MilestoneVerificationWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"project_escrow","project_disbursement"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"project-finance-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/project-finance/deals"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "project-finance-go-waf"},
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
for _, d := range items { total += d.TotalCost }
stats := map[string]interface{}{"total_projects": len(items), "total_investment": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8172")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/project-finance/deals", listItems)
	http.HandleFunc("/v1/project-finance/stats", getStats)
	fmt.Printf("Project Finance Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
