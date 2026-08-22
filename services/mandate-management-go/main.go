package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8221")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mandate.created,mandate.activated,mandate.executed,mandate.cancelled"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "mandate-cache,execution-tracker"},
	"postgres":    map[string]string{"url": os.Getenv("DATABASE_URL"), "tables": "mandates,mandate_executions,mandate_disputes"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "mandate-history"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "operations-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "mandate:create,mandate:activate,mandate:cancel,mandate:dispute"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "mandate-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "mandate-executions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "MandateExecutionWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "nibss-mandate-sync"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "mandate-debit-ledger"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "mandate_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mandates/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type Mandate struct {
	ID           string  `json:"id"`
	AccountNo    string  `json:"accountNumber"`
	AccountName  string  `json:"accountName"`
	Beneficiary  string  `json:"beneficiary"`
	MandateRef   string  `json:"nibssMandateRef"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Frequency    string  `json:"frequency"`
	Status       string  `json:"status"`
	StartDate    string  `json:"startDate"`
	EndDate      string  `json:"endDate"`
	NextExec     string  `json:"nextExecutionDate"`
	TotalExec    int     `json:"totalExecutions"`
	TotalDebited float64 `json:"totalDebited"`
}

var (
	mandates []Mandate
	mu       sync.RWMutex
)

func init() {
	mandates = []Mandate{}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "mandate-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		active := 0; for _, m := range mandates { if m.Status == "active" { active++ } }
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "mandate-management",
			"mandates": map[string]int{"total": len(mandates), "active": active},
			"middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/mandates", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": mandates, "total": len(mandates)}) })
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		active, suspended := 0, 0; totalDebited := 0.0; totalExec := 0
		for _, m := range mandates {
			if m.Status == "active" { active++ }
			if m.Status == "suspended" { suspended++ }
			totalDebited += m.TotalDebited; totalExec += m.TotalExec
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalMandates": len(mandates), "active": active, "suspended": suspended,
			"totalDebited": totalDebited, "totalExecutions": totalExec,
			"types": map[string]int{"direct-debit": 5, "standing-order": 1},
		})
	})

	log.Printf("[mandate-management] Listening on :%s with %d mandates\n", port, len(mandates))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
