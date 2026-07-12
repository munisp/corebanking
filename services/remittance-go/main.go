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

type RemittanceTransaction struct {
	ID string `json:"id"`
	Corridor string `json:"corridor"`
	SenderName string `json:"sender_name"`
	ReceiverName string `json:"receiver_name"`
	SendAmount float64 `json:"send_amount"`
	SendCurrency string `json:"send_currency"`
	ReceiveAmount float64 `json:"receive_amount"`
	ReceiveCurrency string `json:"receive_currency"`
	FXRate float64 `json:"fx_rate"`
	Channel string `json:"channel"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []RemittanceTransaction{
		{ID: "REM-001", Corridor: "UK-NG", SenderName: "Chidi Okafor", ReceiverName: "Ngozi Okafor", SendAmount: 1000.0, SendCurrency: "GBP", ReceiveAmount: 2050000.0, ReceiveCurrency: "NGN", FXRate: 2050.0, Channel: "mobile", Status: "completed"},
		{ID: "REM-002", Corridor: "US-NG", SenderName: "Emeka Eze", ReceiverName: "Chioma Eze", SendAmount: 2000.0, SendCurrency: "USD", ReceiveAmount: 3100000.0, ReceiveCurrency: "NGN", FXRate: 1550.0, Channel: "agent", Status: "completed"},
		{ID: "REM-003", Corridor: "AE-NG", SenderName: "Ibrahim Musa", ReceiverName: "Fatima Musa", SendAmount: 5000.0, SendCurrency: "AED", ReceiveAmount: 2125000.0, ReceiveCurrency: "NGN", FXRate: 425.0, Channel: "online", Status: "pending_compliance"},
		{ID: "REM-004", Corridor: "CA-NG", SenderName: "Adaeze Nwankwo", ReceiverName: "Obinna Nwankwo", SendAmount: 3000.0, SendCurrency: "CAD", ReceiveAmount: 3450000.0, ReceiveCurrency: "NGN", FXRate: 1150.0, Channel: "mobile", Status: "completed"},
		{ID: "REM-005", Corridor: "EU-NG", SenderName: "Tunde Bakare", ReceiverName: "Funke Bakare", SendAmount: 1500.0, SendCurrency: "EUR", ReceiveAmount: 2625000.0, ReceiveCurrency: "NGN", FXRate: 1750.0, Channel: "bank_transfer", Status: "processing"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "remittance-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"remittance.inbound","remittance.outbound","remittance.compliance"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"remittance-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"remittance_transactions","remittance_corridors","agent_networks"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"remittance-transactions","remittance-compliance"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "remittance-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"remittance-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "remittance-go", "pubsub": "remittance-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"remittance-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"RemittanceProcessingWorkflow","ComplianceScreeningWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"remittance_inbound","remittance_outbound"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"remittance-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/remittance/transactions"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "remittance-go-waf"},
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
	var totalSend, totalReceive float64
completed := 0
for _, d := range items { totalSend += d.SendAmount; totalReceive += d.ReceiveAmount; if d.Status == "completed" { completed++ } }
stats := map[string]interface{}{"total_transactions": len(items), "completed": completed, "total_receive_ngn": totalReceive}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8181")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/remittance/transactions", listItems)
	http.HandleFunc("/v1/remittance/stats", getStats)
	fmt.Printf("Remittance Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
