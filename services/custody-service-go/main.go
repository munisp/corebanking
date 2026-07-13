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

type CustodyAccount struct {
	ID              string   `json:"id"`
	AccountName     string   `json:"account_name"`
	ClientName      string   `json:"client_name"`
	ClientID        string   `json:"client_id"`
	AccountType     string   `json:"account_type"`
	Currency        string   `json:"currency"`
	TotalAUM        float64  `json:"total_aum"`
	Securities      int      `json:"securities_count"`
	SettlementType  string   `json:"settlement_type"`
	CSDParticipant  string   `json:"csd_participant"`
	Status          string   `json:"status"`
	CorporateActions []string `json:"pending_corporate_actions"`
}

var (
	mu       sync.RWMutex
	accounts = []CustodyAccount{
		{ID: "CUS-001", AccountName: "Dangote Pension Custody", ClientName: "Dangote Industries Ltd", ClientID: "C-001", AccountType: "pension_fund", Currency: "NGN", TotalAUM: 75000000000, Securities: 45, SettlementType: "T+2", CSDParticipant: "CSCS", Status: "active", CorporateActions: []string{"dividend:DANGCEM", "rights_issue:GTCO"}},
		{ID: "CUS-002", AccountName: "BUA Securities Account", ClientName: "BUA Group", ClientID: "C-002", AccountType: "institutional", Currency: "NGN", TotalAUM: 30000000000, Securities: 28, SettlementType: "T+2", CSDParticipant: "CSCS", Status: "active", CorporateActions: []string{"stock_split:BUACEMENT"}},
		{ID: "CUS-003", AccountName: "FGN Bond Custody", ClientName: "Federal Government of Nigeria", ClientID: "C-003", AccountType: "sovereign", Currency: "NGN", TotalAUM: 500000000000, Securities: 12, SettlementType: "T+0", CSDParticipant: "FMDQ", Status: "active", CorporateActions: []string{"coupon:FGN2030", "coupon:FGN2035"}},
		{ID: "CUS-004", AccountName: "Stanbic ETF Custody", ClientName: "Stanbic IBTC Asset Mgmt", ClientID: "C-004", AccountType: "fund_manager", Currency: "NGN", TotalAUM: 15000000000, Securities: 60, SettlementType: "T+2", CSDParticipant: "CSCS", Status: "active", CorporateActions: []string{}},
		{ID: "CUS-005", AccountName: "Afreximbank Trade Docs", ClientName: "Afreximbank", ClientID: "C-005", AccountType: "correspondent", Currency: "USD", TotalAUM: 200000000, Securities: 8, SettlementType: "T+1", CSDParticipant: "Euroclear", Status: "active", CorporateActions: []string{"maturity:AFREXIM2027"}},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "custody-service-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"custody.settlements", "custody.corporate-actions", "custody.safekeeping"}, "usage": "settlement events and corporate action processing"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"custody:positions", "custody:nav", "custody:settlements"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"custody_accounts", "securities_positions", "corporate_actions", "settlement_instructions"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"custody-transactions", "custody-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "custody-service"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"custody_account", "settlement_instruction", "corporate_action"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "custody-service", "pubsub": "custody-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"settlement-stream", "corporate-action-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"SettlementWorkflow", "CorporateActionWorkflow", "ReconciliationWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "cross-border custody settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"custody_cash", "custody_securities"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"custody_positions_history", "settlement_analytics"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/custody/*"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "custody-waf"},
		},
	})
}

func listAccounts(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": accounts, "total": len(accounts)})
}

func getStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var totalAUM float64
	var totalSecurities int
	for _, a := range accounts { totalAUM += a.TotalAUM; totalSecurities += a.Securities }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_accounts": len(accounts), "total_aum": totalAUM,
		"total_securities": totalSecurities,
	})
}

func main() {
	port := envOr("PORT", "8169")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/custody/accounts", listAccounts)
	http.HandleFunc("/v1/custody/stats", getStats)
	fmt.Printf("Custody Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
