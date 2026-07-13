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

type SyndicatedLoan struct {
	ID string `json:"id"`
	FacilityName string `json:"facility_name"`
	Borrower string `json:"borrower"`
	TotalAmount float64 `json:"total_amount"`
	Currency string `json:"currency"`
	LeadArranger string `json:"lead_arranger"`
	ParticipantCount int `json:"participant_count"`
	InterestRate float64 `json:"interest_rate"`
	Tenor string `json:"tenor"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []SyndicatedLoan{}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "syndicated-loans-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"syndication.facilities","syndication.drawdowns","syndication.participations"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"syndicated-loans-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"syndicated_facilities","loan_participants","drawdown_schedules"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"syndicated-loans","syndication-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "syndicated-loans-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"syndicated-loans-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "syndicated-loans-go", "pubsub": "syndicated-loans-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"syndicated-loans-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"SyndicationWorkflow","DrawdownWorkflow","ParticipantSettlement"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"syndication_principal","syndication_interest"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"syndicated-loans-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/syndicated-loans/facilities"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "syndicated-loans-go-waf"},
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
for _, d := range items { total += d.TotalAmount }
stats := map[string]interface{}{"total_facilities": len(items), "total_committed": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8171")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/syndicated-loans/facilities", listItems)
	http.HandleFunc("/v1/syndicated-loans/stats", getStats)
	fmt.Printf("Syndicated Loans Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
