// fraudfusion — ML-driven fraud detection fusion engine for 54Bank
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var startTime = time.Now()

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

type FraudCase struct {
	ID            string  `json:"id"`
	TransactionID string  `json:"transactionId"`
	RiskScore     float64 `json:"riskScore"`
	RiskLevel     string  `json:"riskLevel"`
	Models        []string `json:"models"`
	Action        string  `json:"action"`
	ReviewedAt    string  `json:"reviewedAt,omitempty"`
	Status        string  `json:"status"`
}

var (
	mu      sync.RWMutex
	counter int
	cases   = []FraudCase{
		{ID: "FC-001", TransactionID: "TXN-9991", RiskScore: 0.92, RiskLevel: "HIGH", Models: []string{"velocity", "device", "ml-xgboost"}, Action: "block", Status: "confirmed_fraud"},
		{ID: "FC-002", TransactionID: "TXN-9992", RiskScore: 0.45, RiskLevel: "MEDIUM", Models: []string{"velocity", "ml-xgboost"}, Action: "challenge", Status: "under_review"},
	}
)

func main() {
	port := getEnv("PORT", "9164")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "fraudfusion",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"models":      []string{"velocity-check", "device-fingerprint", "ml-xgboost", "graph-analysis", "behaviour-biometrics"},
			"middleware": map[string]string{
				"kafka":    "fraud.events, fraud.decisions",
				"redis":    "velocity_counters",
				"postgres": "fraud_db",
			},
		})
	})

	mux.HandleFunc("/v1/fraud/score", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransactionID string  `json:"transactionId"`
			Amount        float64 `json:"amount"`
			AccountID     string  `json:"accountId"`
			DeviceID      string  `json:"deviceId"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		mu.Lock()
		counter++
		fc := FraudCase{
			ID:            fmt.Sprintf("FC-%03d", counter+2),
			TransactionID: req.TransactionID,
			RiskScore:     0.12,
			RiskLevel:     "LOW",
			Models:        []string{"velocity", "device", "ml-xgboost"},
			Action:        "allow",
			Status:        "scored",
		}
		cases = append(cases, fc)
		mu.Unlock()
		respondJSON(w, 200, map[string]interface{}{
			"caseId": fc.ID, "riskScore": fc.RiskScore,
			"riskLevel": fc.RiskLevel, "action": fc.Action,
		})
	})

	mux.HandleFunc("/v1/fraud/cases", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"cases": cases, "total": len(cases)})
	})

	mux.HandleFunc("/v1/fraud/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"scoredToday":      128400,
			"blockedToday":     43,
			"falsePositivePct": 0.8,
			"avgScoringMs":     18,
			"modelAccuracy":    97.4,
		})
	})

	log.Printf("[fraudfusion] Fraud fusion engine on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
