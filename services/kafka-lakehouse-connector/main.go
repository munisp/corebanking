// kafka-lakehouse-connector — streams Kafka topics into data lakehouse (Delta Lake / Iceberg)
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
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

func main() {
	port := getEnv("PORT", "9165")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "kafka-lakehouse-connector",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"format":      "Delta Lake",
			"middleware": map[string]string{
				"kafka":   getEnv("KAFKA_BROKERS", "kafka:9092"),
				"storage": getEnv("LAKEHOUSE_PATH", "s3://54bank-lakehouse/"),
			},
		})
	})

	mux.HandleFunc("/v1/connector/pipelines", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"pipelines": []map[string]interface{}{
				{"id": "PIPE-001", "topic": "transactions.events", "table": "delta.transactions", "status": "running", "offsetLag": 0},
				{"id": "PIPE-002", "topic": "accounts.events", "table": "delta.accounts", "status": "running", "offsetLag": 0},
				{"id": "PIPE-003", "topic": "fraud.decisions", "table": "delta.fraud_cases", "status": "running", "offsetLag": 2},
			},
			"total": 3,
		})
	})

	mux.HandleFunc("/v1/connector/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"eventsIngested":  9820000,
			"bytesWritten":    "48.2GB",
			"avgLatencyMs":    320,
			"activePipelines": 3,
			"lastFlushAt":     time.Now().UTC().Add(-5 * time.Second).Format(time.RFC3339),
		})
	})

	log.Printf("[kafka-lakehouse-connector] Kafka → Lakehouse connector on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
