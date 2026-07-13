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

type FactoringDeal struct {
	ID string `json:"id"`
	DealType string `json:"deal_type"`
	Seller string `json:"seller"`
	Buyer string `json:"buyer"`
	InvoiceAmount float64 `json:"invoice_amount"`
	AdvanceRate float64 `json:"advance_rate"`
	DiscountRate float64 `json:"discount_rate"`
	Currency string `json:"currency"`
	DueDate string `json:"due_date"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []FactoringDeal{
		{ID: "FC-001", DealType: "recourse", Seller: "Dangote Cement Plc", Buyer: "Julius Berger Nigeria", InvoiceAmount: 250000000.0, AdvanceRate: 85.0, DiscountRate: 2.5, Currency: "NGN", DueDate: "2026-06-15", Status: "active"},
		{ID: "FC-002", DealType: "non_recourse", Seller: "BUA Foods Ltd", Buyer: "Shoprite Nigeria", InvoiceAmount: 150000000.0, AdvanceRate: 80.0, DiscountRate: 3.0, Currency: "NGN", DueDate: "2026-07-01", Status: "active"},
		{ID: "FC-003", DealType: "reverse", Seller: "Nestle Nigeria", Buyer: "Spar Nigeria", InvoiceAmount: 75000000.0, AdvanceRate: 90.0, DiscountRate: 1.8, Currency: "NGN", DueDate: "2026-05-30", Status: "disbursed"},
		{ID: "FC-004", DealType: "recourse", Seller: "Flour Mills Nigeria", Buyer: "Nigerian Bottling Co", InvoiceAmount: 500000000.0, AdvanceRate: 82.0, DiscountRate: 2.2, Currency: "NGN", DueDate: "2026-08-15", Status: "pending"},
		{ID: "FC-005", DealType: "export", Seller: "Olam Nigeria", Buyer: "Cargill International", InvoiceAmount: 5000000.0, AdvanceRate: 88.0, DiscountRate: 1.5, Currency: "USD", DueDate: "2026-06-30", Status: "active"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "factoring-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"factoring.invoices","factoring.payments","factoring.settlements"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"factoring-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"factoring_deals","factoring_invoices","factoring_payments"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"factoring-deals","factoring-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "factoring-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"factoring-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "factoring-go", "pubsub": "factoring-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"factoring-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"FactoringDisbursementWorkflow","InvoiceVerificationWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"factoring_receivables","factoring_cash"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"factoring-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/factoring/deals"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "factoring-go-waf"},
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
for _, d := range items { total += d.InvoiceAmount }
stats := map[string]interface{}{"total_deals": len(items), "total_invoice_value": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8170")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/factoring/deals", listItems)
	http.HandleFunc("/v1/factoring/stats", getStats)
	fmt.Printf("Factoring Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
