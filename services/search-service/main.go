package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

type seedEnvelope struct {
	Records []map[string]interface{} `json:"records"`
}

func main() {
	service := NewUnifiedSearchService()
	defer service.Stop()

	router := mux.NewRouter()
	router.HandleFunc("/health", healthHandler).Methods(http.MethodGet)
	router.HandleFunc("/ready", readyHandler(service)).Methods(http.MethodGet)
	router.HandleFunc("/bootstrap", bootstrapHandler(service)).Methods(http.MethodPost)
	service.RegisterRoutes(router)

	server := &http.Server{
		Addr:              ":" + getEnvOrDefault("PORT", "8094"),
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("search-service listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("search-service failed: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("search-service shutdown error: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "search-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func readyHandler(service *UnifiedSearchService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		_, statusCode, err := service.doOpenSearchRequest(ctx, http.MethodGet, "/", nil)
		dependencyState := "ready"
		ready := err == nil && statusCode < 500
		if !ready {
			dependencyState = "degraded"
		}

		response := map[string]interface{}{
			"status":             map[bool]string{true: "ready", false: "degraded"}[ready],
			"service":            "search-service",
			"opensearch_url":     service.opensearchURL,
			"opensearch_state":   dependencyState,
			"index_queue_depth":  len(service.indexQueue),
			"timestamp":          time.Now().UTC().Format(time.RFC3339),
		}
		if err != nil {
			response["detail"] = err.Error()
		}

		status := http.StatusOK
		if !ready {
			status = http.StatusServiceUnavailable
		}
		writeJSON(w, status, response)
	}
}

func bootstrapHandler(service *UnifiedSearchService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		seedPath := getEnvOrDefault("SEED_FILE", filepath.Join(".", "seed_data.json"))
		payload, err := os.ReadFile(seedPath)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{
				"status":  "seed-not-found",
				"service": "search-service",
				"detail":  err.Error(),
			})
			return
		}

		var envelope seedEnvelope
		if err := json.Unmarshal(payload, &envelope); err == nil && len(envelope.Records) > 0 {
			count := queueSeedRecords(service, envelope.Records)
			writeJSON(w, http.StatusAccepted, map[string]interface{}{
				"status":          "bootstrap-queued",
				"service":         "search-service",
				"queued_documents": count,
				"seed_file":       seedPath,
			})
			return
		}

		var generic map[string]interface{}
		if err := json.Unmarshal(payload, &generic); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"status":  "invalid-seed",
				"service": "search-service",
				"detail":  err.Error(),
			})
			return
		}

		queued := 0
		for key, value := range generic {
			records, ok := value.([]interface{})
			if !ok {
				continue
			}
			indexName := normalizeSeedIndex(key)
			for _, raw := range records {
				doc, ok := raw.(map[string]interface{})
				if !ok {
					continue
				}
				id := extractDocumentID(doc)
				tenantID, _ := doc["tenant_id"].(string)
				if id == "" || tenantID == "" {
					continue
				}
				service.indexQueue <- &IndexRequest{Index: indexName, ID: id, TenantID: tenantID, Document: doc}
				queued++
			}
		}

		writeJSON(w, http.StatusAccepted, map[string]interface{}{
			"status":           "bootstrap-queued",
			"service":          "search-service",
			"queued_documents": queued,
			"seed_file":        seedPath,
		})
	}
}

func queueSeedRecords(service *UnifiedSearchService, records []map[string]interface{}) int {
	queued := 0
	for _, record := range records {
		indexName, _ := record["index"].(string)
		if indexName == "" {
			indexName = normalizeSeedIndex(stringValue(record["resource_type"]))
		}
		if indexName == "" {
			indexName = IndexDocuments
		}
		id := extractDocumentID(record)
		tenantID, _ := record["tenant_id"].(string)
		if id == "" || tenantID == "" {
			continue
		}
		doc := record
		if nested, ok := record["document"].(map[string]interface{}); ok {
			doc = nested
			if _, exists := doc["tenant_id"]; !exists {
				doc["tenant_id"] = tenantID
			}
		}
		service.indexQueue <- &IndexRequest{Index: indexName, ID: id, TenantID: tenantID, Document: doc}
		queued++
	}
	return queued
}

func extractDocumentID(document map[string]interface{}) string {
	candidates := []string{"id", "document_id", "customer_id", "account_id", "transaction_id", "loan_id", "ticket_number", "reference"}
	for _, candidate := range candidates {
		if value := stringValue(document[candidate]); value != "" {
			return value
		}
	}
	return ""
}

func normalizeSeedIndex(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.TrimSuffix(value, "_records")
	value = strings.TrimSuffix(value, "records")
	value = strings.ReplaceAll(value, "-", "_")
	value = strings.ReplaceAll(value, " ", "_")
	mapping := map[string]string{
		"customer":       IndexCustomers,
		"customers":      IndexCustomers,
		"account":        IndexAccounts,
		"accounts":       IndexAccounts,
		"transaction":    IndexTransactions,
		"transactions":   IndexTransactions,
		"loan":           IndexLoans,
		"loans":          IndexLoans,
		"dispute":        IndexDisputes,
		"disputes":       IndexDisputes,
		"document":       IndexDocuments,
		"documents":      IndexDocuments,
		"employee":       IndexEmployees,
		"employees":      IndexEmployees,
		"product":        IndexProducts,
		"products":       IndexProducts,
		"notification":   IndexNotifications,
		"notifications":  IndexNotifications,
		"trade_finance":  IndexTradeFinance,
		"tradefinance":   IndexTradeFinance,
	}
	if mapped, ok := mapping[value]; ok {
		return mapped
	}
	return value
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	if result, ok := value.(string); ok {
		return result
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
