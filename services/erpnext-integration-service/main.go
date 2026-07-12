package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	ServiceName    = "erpnext-integration-service"
	ServiceVersion = "1.0.0"
)

var (
	integrationService *ERPNextIntegrationService
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using environment variables")
	}

	log.Printf("Starting %s v%s", ServiceName, ServiceVersion)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var err error
	integrationService, err = NewERPNextIntegrationService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}
	defer integrationService.Close()

	router := mux.NewRouter()
	setupRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8118"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Server listening on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}

func setupRoutes(router *mux.Router) {
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/ready", readyHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Dapr pub/sub endpoints
	router.HandleFunc("/dapr/subscribe", subscribeHandler).Methods("GET")
	router.HandleFunc("/events/transaction", handleTransactionEvent).Methods("POST")
	router.HandleFunc("/events/loan", handleLoanEvent).Methods("POST")
	router.HandleFunc("/events/account", handleAccountEvent).Methods("POST")
	router.HandleFunc("/events/payment", handlePaymentEvent).Methods("POST")
	router.HandleFunc("/events/savings", handleSavingsEvent).Methods("POST")
	router.HandleFunc("/events/mortgage", handleMortgageEvent).Methods("POST")
	router.HandleFunc("/events/lpo", handleLpoEvent).Methods("POST")

	api := router.PathPrefix("/api/v1").Subrouter()
	api.Use(TenantMiddleware)
	api.Use(AuthMiddleware)

	api.HandleFunc("/connections", listConnectionsHandler).Methods("GET")
	api.HandleFunc("/connections", createConnectionHandler).Methods("POST")
	api.HandleFunc("/connections/{id}", getConnectionHandler).Methods("GET")
	api.HandleFunc("/connections/{id}", updateConnectionHandler).Methods("PUT")
	api.HandleFunc("/connections/{id}", deleteConnectionHandler).Methods("DELETE")
	api.HandleFunc("/connections/{id}/test", testConnectionHandler).Methods("POST")
	api.HandleFunc("/connections/{id}/sync", triggerSyncHandler).Methods("POST")

	api.HandleFunc("/oauth/authorize", oauthAuthorizeHandler).Methods("GET")
	api.HandleFunc("/oauth/callback", oauthCallbackHandler).Methods("GET")
	api.HandleFunc("/oauth/token", oauthTokenHandler).Methods("POST")
	api.HandleFunc("/oauth/refresh", oauthRefreshHandler).Methods("POST")

	api.HandleFunc("/bank-accounts", listBankAccountsHandler).Methods("GET")
	api.HandleFunc("/bank-accounts/{id}/transactions", getBankTransactionsHandler).Methods("GET")
	api.HandleFunc("/bank-accounts/{id}/balance", getBankBalanceHandler).Methods("GET")

	api.HandleFunc("/reconciliation/auto", autoReconcileHandler).Methods("POST")
	api.HandleFunc("/reconciliation/manual", manualReconcileHandler).Methods("POST")
	api.HandleFunc("/reconciliation/status", reconciliationStatusHandler).Methods("GET")
	api.HandleFunc("/reconciliation/unmatched", unmatchedTransactionsHandler).Methods("GET")

	api.HandleFunc("/payments", listPaymentsHandler).Methods("GET")
	api.HandleFunc("/payments", initiatePaymentHandler).Methods("POST")
	api.HandleFunc("/payments/{id}", getPaymentHandler).Methods("GET")
	api.HandleFunc("/payments/{id}/status", getPaymentStatusHandler).Methods("GET")
	api.HandleFunc("/payments/bulk", bulkPaymentHandler).Methods("POST")

	api.HandleFunc("/invoices", listInvoicesHandler).Methods("GET")
	api.HandleFunc("/invoices/{id}/match", matchInvoicePaymentHandler).Methods("POST")
	api.HandleFunc("/invoices/auto-match", autoMatchInvoicesHandler).Methods("POST")

	api.HandleFunc("/loans", listLoansHandler).Methods("GET")
	api.HandleFunc("/loans/{id}", getLoanHandler).Methods("GET")
	api.HandleFunc("/loans/{id}/schedule", getLoanScheduleHandler).Methods("GET")
	api.HandleFunc("/loans/{id}/payment", makeLoanPaymentHandler).Methods("POST")

	api.HandleFunc("/cash-position", getCashPositionHandler).Methods("GET")
	api.HandleFunc("/cash-forecast", getCashForecastHandler).Methods("GET")

	api.HandleFunc("/webhooks", listWebhooksHandler).Methods("GET")
	api.HandleFunc("/webhooks", createWebhookHandler).Methods("POST")
	api.HandleFunc("/webhooks/{id}", deleteWebhookHandler).Methods("DELETE")

	webhooks := router.PathPrefix("/webhooks").Subrouter()
	webhooks.HandleFunc("/erpnext/{connection_id}", erpnextWebhookHandler).Methods("POST")
	webhooks.HandleFunc("/bank/{connection_id}", bankWebhookHandler).Methods("POST")

	api.HandleFunc("/sync/accounts", syncAccountsHandler).Methods("POST")
	api.HandleFunc("/sync/transactions", syncTransactionsHandler).Methods("POST")
	api.HandleFunc("/sync/invoices", syncInvoicesHandler).Methods("POST")
	api.HandleFunc("/sync/status", getSyncStatusHandler).Methods("GET")
	api.HandleFunc("/sync/history", getSyncHistoryHandler).Methods("GET")

	api.HandleFunc("/mappings/accounts", listAccountMappingsHandler).Methods("GET")
	api.HandleFunc("/mappings/accounts", createAccountMappingHandler).Methods("POST")
	api.HandleFunc("/mappings/accounts/{id}", updateAccountMappingHandler).Methods("PUT")
	api.HandleFunc("/mappings/accounts/{id}", deleteAccountMappingHandler).Methods("DELETE")

	api.HandleFunc("/reports/reconciliation", reconciliationReportHandler).Methods("GET")
	api.HandleFunc("/reports/cash-flow", cashFlowReportHandler).Methods("GET")
	api.HandleFunc("/reports/payment-summary", paymentSummaryReportHandler).Methods("GET")

	// Configuration management endpoints
	api.HandleFunc("/config/sync", getSyncConfigHandler).Methods("GET")
	api.HandleFunc("/config/sync", updateSyncConfigHandler).Methods("PUT")
	api.HandleFunc("/config/retry-policy", getRetryPolicyConfigHandler).Methods("GET")
	api.HandleFunc("/config/retry-policy", updateRetryPolicyConfigHandler).Methods("PUT")
	api.HandleFunc("/config/notifications", getNotificationConfigHandler).Methods("GET")
	api.HandleFunc("/config/notifications", updateNotificationConfigHandler).Methods("PUT")
	api.HandleFunc("/config/security", getSecurityConfigHandler).Methods("GET")
	api.HandleFunc("/config/security", updateSecurityConfigHandler).Methods("PUT")

	// Audit logs and monitoring
	api.HandleFunc("/audit-logs", getAuditLogsHandler).Methods("GET")
	api.HandleFunc("/dashboard/metrics", getDashboardMetricsHandler).Methods("GET")
	api.HandleFunc("/exceptions", listExceptionsHandler).Methods("GET")
	api.HandleFunc("/exceptions/{id}", updateExceptionHandler).Methods("PUT")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": ServiceName,
		"version": ServiceVersion,
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	if integrationService == nil {
		http.Error(w, "Service not ready", http.StatusServiceUnavailable)
		return
	}

	health := integrationService.HealthCheck()
	w.Header().Set("Content-Type", "application/json")

	if !health.DatabaseHealthy {
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	json.NewEncoder(w).Encode(health)
}

func TenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		ctx := context.WithValue(r.Context(), "tenant_id", tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		customerID := r.Header.Get("X-Customer-ID")
		if customerID == "" {
			http.Error(w, "Customer ID required", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), "customer_id", customerID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getTenantID(ctx context.Context) string {
	if v := ctx.Value("tenant_id"); v != nil {
		return v.(string)
	}
	return "default"
}

func getCustomerID(ctx context.Context) string {
	if v := ctx.Value("customer_id"); v != nil {
		return v.(string)
	}
	return ""
}
