// ml-security-service — ML-powered threat detection and anomaly scoring for 54Bank
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

type ThreatEvent struct {
	ID         string  `json:"id"`
	EventType  string  `json:"eventType"`
	Source     string  `json:"source"`
	Score      float64 `json:"score"`
	Severity   string  `json:"severity"`
	Model      string  `json:"model"`
	DetectedAt string  `json:"detectedAt"`
	Action     string  `json:"action"`
}

var (
	mu      sync.RWMutex
	counter int
	events  = []ThreatEvent{
		{ID: "TH-001", EventType: "account_takeover", Source: "login-service", Score: 0.94, Severity: "CRITICAL", Model: "lstm-anomaly-v3", DetectedAt: "2026-05-20T06:15:00Z", Action: "block"},
		{ID: "TH-002", EventType: "unusual_transfer_pattern", Source: "payment-service", Score: 0.71, Severity: "HIGH", Model: "isolation-forest-v2", DetectedAt: "2026-05-20T07:30:00Z", Action: "alert"},
	}
)

func main() {
	port := getEnv("PORT", "9167")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "ml-security-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"models": []string{"lstm-anomaly-v3", "isolation-forest-v2", "autoencoder-fraud-v1", "graph-neural-net-v2"},
			"middleware": map[string]string{
				"kafka":   "security.events, security.decisions",
				"redis":   "model_cache, feature_store",
				"mlflow":  getEnv("MLFLOW_URL", "http://mlflow:5000"),
			},
		})
	})

	mux.HandleFunc("/v1/security/score", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			EventType string                 `json:"eventType"`
			Source    string                 `json:"source"`
			Features  map[string]interface{} `json:"features"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		mu.Lock()
		counter++
		ev := ThreatEvent{
			ID:         fmt.Sprintf("TH-%03d", counter+2),
			EventType:  req.EventType,
			Source:     req.Source,
			Score:      0.08,
			Severity:   "LOW",
			Model:      "lstm-anomaly-v3",
			DetectedAt: time.Now().UTC().Format(time.RFC3339),
			Action:     "allow",
		}
		events = append(events, ev)
		mu.Unlock()
		respondJSON(w, 200, map[string]interface{}{
			"threatId": ev.ID, "score": ev.Score,
			"severity": ev.Severity, "action": ev.Action,
		})
	})

	mux.HandleFunc("/v1/security/threats", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"threats": events, "total": len(events)})
	})

	mux.HandleFunc("/v1/security/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"eventsScored":    284000,
			"threatsDetected": 12,
			"criticalAlerts":  2,
			"avgScoringMs":    8,
			"modelVersion":    "lstm-anomaly-v3",
		})
	})

	log.Printf("[ml-security-service] ML security threat detection on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
