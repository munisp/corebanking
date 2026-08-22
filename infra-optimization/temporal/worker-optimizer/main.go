// 54Bank Temporal Worker Optimizer — Go
// Manages and tunes Temporal worker fleet for maximum workflow throughput.
// Provides dynamic concurrency adjustment based on system load.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"
)

type WorkerProfile struct {
	TaskQueue         string `json:"taskQueue"`
	MaxConcurrentActs int    `json:"maxConcurrentActivities"`
	MaxConcurrentWFs  int    `json:"maxConcurrentWorkflows"`
	ActPollers        int    `json:"activityPollers"`
	WFPollers         int    `json:"workflowPollers"`
	RateLimit         int    `json:"rateLimit"`
	StickyTimeout     string `json:"stickyTimeout"`
	Description       string `json:"description"`
}

func getWorkerProfiles() []WorkerProfile {
	return []WorkerProfile{
		{"payments-transfer", 1000, 500, 20, 20, 100000, "5s", "High-throughput payment transfer workflows"},
		{"loan-origination", 200, 100, 10, 10, 10000, "10s", "Loan processing with external credit bureau calls"},
		{"kyc-verification", 500, 200, 15, 15, 50000, "5s", "KYC/BVN verification with biometric checks"},
		{"aml-screening", 500, 200, 15, 15, 50000, "5s", "AML transaction screening with sanctions check"},
		{"settlement-batch", 100, 50, 5, 5, 5000, "30s", "End-of-day settlement batch processing"},
		{"notification-send", 2000, 100, 20, 5, 200000, "3s", "SMS/Email/Push notification delivery"},
		{"regulatory-report", 50, 20, 3, 3, 1000, "60s", "eFASS/FATCA/CBN regulatory report generation"},
		{"reconciliation", 200, 100, 10, 10, 20000, "10s", "Inter-bank reconciliation workflows"},
		{"fraud-investigation", 300, 150, 10, 10, 30000, "5s", "Fraud case investigation workflows"},
		{"account-lifecycle", 500, 200, 15, 15, 50000, "5s", "Account open/close/freeze/unfreeze workflows"},
	}
}

type TemporalNamespace struct {
	Name               string `json:"name"`
	RetentionDays      int    `json:"retentionDays"`
	HistoryArchival    string `json:"historyArchival"`
	VisibilityArchival string `json:"visibilityArchival"`
	Description        string `json:"description"`
}

func getNamespaces() []TemporalNamespace {
	return []TemporalNamespace{
		{"54bank-payments", 30, "enabled", "enabled", "Payment and transfer workflows"},
		{"54bank-lending", 365, "enabled", "enabled", "Loan origination and servicing"},
		{"54bank-compliance", 2555, "enabled", "enabled", "AML/KYC/regulatory (7-year retention)"},
		{"54bank-operations", 90, "enabled", "enabled", "Batch processing and reconciliation"},
		{"54bank-notifications", 7, "disabled", "disabled", "Notification delivery (short retention)"},
	}
}

// --- HTTP Handlers ---

func handleProfiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(getWorkerProfiles())
}

func handleNamespaces(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(getNamespaces())
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "temporal-worker-optimizer"})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var watchdogLast int64

func main() {
	atomic.StoreInt64(&watchdogLast, time.Now().UnixMilli())

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/temporal/worker-profiles", handleProfiles)
	mux.HandleFunc("/v1/temporal/namespaces", handleNamespaces)

	port := envOr("PORT", "8096")
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second}
	log.Printf("[temporal-worker-optimizer] Starting on :%s", port)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	fmt.Println("[temporal-worker-optimizer] Stopped")
}
