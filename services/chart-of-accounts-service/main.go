package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	ServiceName    = "chart-of-accounts-service"
	ServiceVersion = "1.0.0"
)

var (
	coaService      *ChartOfAccountsService
	approvalService *ApprovalService
	periodService   *PeriodService
)

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func main() {
	log.Printf("Starting %s v%s", ServiceName, ServiceVersion)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var err error
	coaService, err = NewChartOfAccountsService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}
	defer coaService.Close()

	if coaService.postgres != nil {
		approvalService = NewApprovalService(coaService.postgres, coaService)
		periodService = NewPeriodService(coaService.postgres, coaService)
	}

	// DISABLED: Initialize default CoA asynchronously
	// This can cause blocking issues during startup. Call /api/v1/accounts/initialize-defaults manually instead.
	/*
		if coaService.tigerBeetle != nil {
			go func() {
				log.Printf("Initializing default Chart of Accounts in background...")
				if err := coaService.InitializeDefaultCoA(ctx); err != nil {
					log.Printf("WARNING: Failed to initialize default CoA: %v", err)
				} else {
					log.Printf("Default CoA initialization completed")
				}
			}()
		} else {
			log.Printf("Skipping default CoA initialization - TigerBeetle not connected")
		}
	*/
	log.Printf("Skipping automatic CoA initialization - call /api/v1/accounts/initialize-defaults to initialize")

	router := mux.NewRouter()
	router.Use(auditMiddleware)
	setupRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
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

	api := router.PathPrefix("/api/v1").Subrouter()
	api.Use(TenantIsolationMiddleware)
	// DISABLED: AuditLogMiddleware - causes issues with context ordering
	// api.Use(AuditLogMiddleware)

	readOnly := api.PathPrefix("").Subrouter()
	readOnly.Use(ReadOnlyMiddleware)
	readOnly.HandleFunc("/accounts", listAccountsHandler).Methods("GET")
	readOnly.HandleFunc("/accounts/{id}", getAccountHandler).Methods("GET")
	readOnly.HandleFunc("/accounts/{id}/balance", getAccountBalanceHandler).Methods("GET")
	readOnly.HandleFunc("/accounts/{id}/history", getAccountHistoryHandler).Methods("GET")
	readOnly.HandleFunc("/categories", listCategoriesHandler).Methods("GET")
	readOnly.HandleFunc("/categories/{type}", getCategoryHandler).Methods("GET")
	readOnly.HandleFunc("/hierarchy", getHierarchyHandler).Methods("GET")
	readOnly.HandleFunc("/hierarchy/{parent_id}/children", getChildrenHandler).Methods("GET")
	readOnly.HandleFunc("/journal-entries", listJournalEntriesHandler).Methods("GET")
	readOnly.HandleFunc("/journal-entries/{id}", getJournalEntryHandler).Methods("GET")
	readOnly.HandleFunc("/trial-balance", getTrialBalanceHandler).Methods("GET")
	readOnly.HandleFunc("/balance-sheet", getBalanceSheetHandler).Methods("GET")
	readOnly.HandleFunc("/income-statement", getIncomeStatementHandler).Methods("GET")
	readOnly.HandleFunc("/cbn/mapping", getCBNMappingHandler).Methods("GET")
	readOnly.HandleFunc("/cbn/returns/{return_type}", generateCBNReturnHandler).Methods("GET")
	readOnly.HandleFunc("/cbn/reports", listCBNReportTypesHandler).Methods("GET")
	readOnly.HandleFunc("/cbn/reports/{report_type}", generateCBNReportHandler).Methods("GET")
	readOnly.HandleFunc("/reconciliation/status", getReconciliationStatusHandler).Methods("GET")

	readOnly.HandleFunc("/mappings", listMappingsHandler).Methods("GET")
	readOnly.HandleFunc("/mappings/{key}", getMappingHandler).Methods("GET")

	readOnly.HandleFunc("/approvals/workflows", listWorkflowsHandler).Methods("GET")
	readOnly.HandleFunc("/approvals/workflows/{id}", getWorkflowHandler).Methods("GET")
	readOnly.HandleFunc("/approvals/requests", listApprovalRequestsHandler).Methods("GET")
	readOnly.HandleFunc("/approvals/requests/{id}", getApprovalRequestHandler).Methods("GET")
	readOnly.HandleFunc("/journal-entries/{id}/approval", getJournalWithApprovalHandler).Methods("GET")

	readOnly.HandleFunc("/periods", listPeriodsHandler).Methods("GET")
	readOnly.HandleFunc("/periods/{id}", getPeriodHandler).Methods("GET")
	readOnly.HandleFunc("/periods/{id}/summary", getPeriodSummaryHandler).Methods("GET")

	adminOnly := api.PathPrefix("").Subrouter()
	adminOnly.Use(AdminOnlyMiddleware)
	adminOnly.HandleFunc("/mappings", upsertMappingHandler).Methods("POST", "PUT")
	adminOnly.HandleFunc("/mappings/{key}", deleteMappingHandler).Methods("DELETE")

	adminOnly.HandleFunc("/approvals/workflows", createWorkflowHandler).Methods("POST")
	adminOnly.HandleFunc("/approvals/workflows/defaults", createDefaultWorkflowsHandler).Methods("POST")
	adminOnly.HandleFunc("/approvals/requests/{id}/approve", approveRequestHandler).Methods("POST")
	adminOnly.HandleFunc("/approvals/requests/{id}/reject", rejectRequestHandler).Methods("POST")
	adminOnly.HandleFunc("/approvals/requests/{id}/cancel", cancelRequestHandler).Methods("POST")
	adminOnly.HandleFunc("/journal-entries/{id}/submit", submitForApprovalHandler).Methods("POST")

	adminOnly.HandleFunc("/periods/fiscal-year", createFiscalYearHandler).Methods("POST")
	adminOnly.HandleFunc("/periods/{id}/soft-close", softClosePeriodHandler).Methods("POST")
	adminOnly.HandleFunc("/periods/{id}/hard-close", hardClosePeriodHandler).Methods("POST")
	adminOnly.HandleFunc("/periods/{id}/lock", lockPeriodHandler).Methods("POST")
	adminOnly.HandleFunc("/periods/{id}/reopen", reopenPeriodHandler).Methods("POST")
	adminOnly.HandleFunc("/accounts", createAccountHandler).Methods("POST")
	adminOnly.HandleFunc("/accounts/{id}", updateAccountHandler).Methods("PUT")
	adminOnly.HandleFunc("/accounts/{id}", deleteAccountHandler).Methods("DELETE")
	adminOnly.HandleFunc("/journal-entries", createJournalEntryHandler).Methods("POST")
	adminOnly.HandleFunc("/journal-entries/{id}/reverse", reverseJournalEntryHandler).Methods("POST")
	adminOnly.HandleFunc("/reconciliation/tigerbeetle", reconcileWithTigerBeetleHandler).Methods("POST")
	adminOnly.HandleFunc("/accounts/initialize-defaults", initializeDefaultsHandler).Methods("POST")

	superAdminOnly := api.PathPrefix("/tenants").Subrouter()
	superAdminOnly.Use(SuperAdminOnlyMiddleware)
	superAdminOnly.HandleFunc("", listTenantsHandler).Methods("GET")
	superAdminOnly.HandleFunc("", createTenantHandler).Methods("POST")
	superAdminOnly.HandleFunc("/{tenant_id}/coa", getTenantCoAHandler).Methods("GET")
	superAdminOnly.HandleFunc("/{tenant_id}/coa", createTenantCoAHandler).Methods("POST")
	superAdminOnly.HandleFunc("/{tenant_id}/coa/clone", cloneTenantCoAHandler).Methods("POST")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": ServiceName,
		"version": ServiceVersion,
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	if coaService == nil {
		http.Error(w, "Service not ready", http.StatusServiceUnavailable)
		return
	}

	health := coaService.HealthCheck()
	if !health.TigerBeetleHealthy {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	json.NewEncoder(w).Encode(health)
}

func listAccountsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	accountType := r.URL.Query().Get("type")
	parentID := r.URL.Query().Get("parent_id")
	activeOnly := r.URL.Query().Get("active") != "false"
	includeBalance := r.URL.Query().Get("include_balance") == "true"

	accounts, err := coaService.ListAccounts(ctx, tenantID, accountType, parentID, activeOnly)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Optionally populate balances via a single batch TigerBeetle call
	if includeBalance {
		balances := coaService.GetAccountBalancesBatch(ctx, accounts)
		for i := range accounts {
			if bal, ok := balances[accounts[i].ID]; ok {
				accounts[i].CurrentBalance = &bal.NetBalance
				accounts[i].DebitBalance = &bal.DebitBalance
				accounts[i].CreditBalance = &bal.CreditBalance
			}
		}
	}

	json.NewEncoder(w).Encode(accounts)
}

func createAccountHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	var req CreateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	account, err := coaService.CreateAccount(ctx, tenantID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(account)
}

func getAccountHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	accountID := vars["id"]

	account, err := coaService.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(account)
}

func updateAccountHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	accountID := vars["id"]

	var req UpdateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	account, err := coaService.UpdateAccount(ctx, tenantID, accountID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(account)
}

func deleteAccountHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	accountID := vars["id"]

	if err := coaService.DeleteAccount(ctx, tenantID, accountID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func getAccountBalanceHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	accountID := vars["id"]

	balance, err := coaService.GetAccountBalance(ctx, tenantID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(balance)
}

func getAccountHistoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	accountID := vars["id"]

	history, err := coaService.GetAccountHistory(ctx, tenantID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(history)
}

func listCategoriesHandler(w http.ResponseWriter, r *http.Request) {
	categories := GetAccountCategories()
	json.NewEncoder(w).Encode(categories)
}

func getCategoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	accountType := vars["type"]

	category, exists := GetAccountCategory(AccountType(accountType))
	if !exists {
		http.Error(w, "Category not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(category)
}

func getHierarchyHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	hierarchy, err := coaService.GetAccountHierarchy(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(hierarchy)
}

func getChildrenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	parentID := vars["parent_id"]

	children, err := coaService.GetChildAccounts(ctx, tenantID, parentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(children)
}

func createJournalEntryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	log.Printf("Received request to create journal entry for tenant_id: %s", tenantID)
	if tenantID == "" {
		tenantID = "default"
	}

	var req CreateJournalEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	entry, err := coaService.CreateJournalEntry(ctx, tenantID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}

func listJournalEntriesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	entries, err := coaService.ListJournalEntries(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(entries)
}

func getJournalEntryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	entryID := vars["id"]

	entry, err := coaService.GetJournalEntry(ctx, tenantID, entryID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(entry)
}

func reverseJournalEntryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	entryID := vars["id"]

	reversal, err := coaService.ReverseJournalEntry(ctx, tenantID, entryID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(reversal)
}

func getTrialBalanceHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	asOfDate := r.URL.Query().Get("as_of_date")
	if asOfDate == "" {
		asOfDate = time.Now().Format("2006-01-02")
	}

	trialBalance, err := coaService.GetTrialBalance(ctx, tenantID, asOfDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(trialBalance)
}

func getBalanceSheetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	asOfDate := r.URL.Query().Get("as_of_date")
	if asOfDate == "" {
		asOfDate = time.Now().Format("2006-01-02")
	}

	balanceSheet, err := coaService.GetBalanceSheet(ctx, tenantID, asOfDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(balanceSheet)
}

func getIncomeStatementHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	if startDate == "" {
		startDate = time.Now().AddDate(0, -1, 0).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	incomeStatement, err := coaService.GetIncomeStatement(ctx, tenantID, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(incomeStatement)
}

func getCBNMappingHandler(w http.ResponseWriter, r *http.Request) {
	mapping := GetCBNAccountMapping()
	json.NewEncoder(w).Encode(mapping)
}

func generateCBNReturnHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	returnType := vars["return_type"]

	reportingDate := r.URL.Query().Get("reporting_date")
	if reportingDate == "" {
		reportingDate = time.Now().Format("2006-01-02")
	}

	cbnReturn, err := coaService.GenerateCBNReturn(ctx, tenantID, returnType, reportingDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(cbnReturn)
}

func reconcileWithTigerBeetleHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	result, err := coaService.ReconcileWithTigerBeetle(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func getReconciliationStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	status, err := coaService.GetReconciliationStatus(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(status)
}

func getTenantCoAHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	tenantID := vars["tenant_id"]

	coa, err := coaService.GetTenantCoA(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(coa)
}

func createTenantCoAHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	tenantID := vars["tenant_id"]

	var req CreateTenantCoARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	coa, err := coaService.CreateTenantCoA(ctx, tenantID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(coa)
}

type CreateTenantCoARequest struct {
	BasedOnTemplate string                 `json:"based_on_template"`
	CustomAccounts  []CreateAccountRequest `json:"custom_accounts,omitempty"`
}

func (s *ChartOfAccountsService) GetTenantCoA(ctx context.Context, tenantID string) (*TenantCoA, error) {
	accounts, err := s.ListAccounts(ctx, tenantID, "", "", true)
	if err != nil {
		return nil, err
	}

	return &TenantCoA{
		TenantID:  tenantID,
		Accounts:  accounts,
		CreatedAt: time.Now(),
	}, nil
}

func (s *ChartOfAccountsService) CreateTenantCoA(ctx context.Context, tenantID string, req CreateTenantCoARequest) (*TenantCoA, error) {
	if err := s.initializeTenantCoA(ctx, tenantID); err != nil {
		return nil, fmt.Errorf("failed to initialize tenant CoA: %w", err)
	}

	for _, customAccount := range req.CustomAccounts {
		if _, err := s.CreateAccount(ctx, tenantID, customAccount); err != nil {
			log.Printf("WARNING: Failed to create custom account %s: %v", customAccount.Code, err)
		}
	}

	return s.GetTenantCoA(ctx, tenantID)
}

type TenantCoA struct {
	TenantID  string    `json:"tenant_id"`
	Accounts  []Account `json:"accounts"`
	CreatedAt time.Time `json:"created_at"`
}

func initializeDefaultsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantIDFromContext(ctx)
	if tenantID == "" {
		tenantID = r.Header.Get("X-Tenant-ID")
	}

	if err := coaService.initializeTenantCoA(ctx, tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	accounts, _ := coaService.ListAccounts(ctx, tenantID, "", "", true)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Default accounts initialized",
		"accounts": len(accounts),
	})
}

func listTenantsHandler(w http.ResponseWriter, r *http.Request) {
	tenants := coaService.ListTenants()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenants": tenants,
	})
}

func createTenantHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		TenantID      string `json:"tenant_id"`
		TenantName    string `json:"tenant_name"`
		TenantType    string `json:"tenant_type"`
		InitializeCoA bool   `json:"initialize_coa"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if !isValidTenantID(req.TenantID) {
		http.Error(w, "Invalid tenant ID format", http.StatusBadRequest)
		return
	}

	tenant := coaService.CreateTenant(req.TenantID, req.TenantName, req.TenantType)

	if req.InitializeCoA {
		if err := coaService.initializeTenantCoA(ctx, req.TenantID); err != nil {
			log.Printf("WARNING: Failed to initialize CoA for tenant %s: %v", req.TenantID, err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tenant)
}

func cloneTenantCoAHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	targetTenantID := vars["tenant_id"]

	var req struct {
		SourceTenantID string `json:"source_tenant_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := coaService.CloneTenantCoA(ctx, req.SourceTenantID, targetTenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	coa, _ := coaService.GetTenantCoA(ctx, targetTenantID)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(coa)
}

type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
	IsActive  bool      `json:"is_active"`
}

func (s *ChartOfAccountsService) ListTenants() []Tenant {
	if s.postgres == nil {
		return []Tenant{}
	}

	ctx := context.Background()
	tenants, err := s.postgres.ListTenants(ctx)
	if err != nil {
		log.Printf("ERROR: Failed to list tenants: %v", err)
		return []Tenant{}
	}

	return tenants
}

func (s *ChartOfAccountsService) CreateTenant(tenantID, name, tenantType string) Tenant {
	tenant := Tenant{
		ID:        tenantID,
		Name:      name,
		Type:      tenantType,
		CreatedAt: time.Now(),
		IsActive:  true,
	}

	// Save tenant to PostgreSQL
	if s.postgres != nil {
		ctx := context.Background()
		log.Printf("Saving tenant %s to PostgreSQL...", tenantID)
		if err := s.postgres.CreateTenant(ctx, tenant); err != nil {
			log.Printf("ERROR: Failed to save tenant to PostgreSQL: %v", err)
		} else {
			log.Printf("Successfully saved tenant %s to PostgreSQL", tenantID)
		}
	} else {
		log.Printf("WARNING: PostgreSQL not available", tenantID)
	}

	return tenant
}

func (s *ChartOfAccountsService) CloneTenantCoA(ctx context.Context, sourceTenantID, targetTenantID string) error {
	if s.postgres == nil {
		return errors.New("PostgreSQL not connected")
	}

	// Get source accounts from PostgreSQL
	sourceAccounts, err := s.postgres.ListAccounts(ctx, sourceTenantID, "", "", false)
	if err != nil || len(sourceAccounts) == 0 {
		return fmt.Errorf("source tenant %s has no accounts", sourceTenantID)
	}

	// Clone accounts to target tenant
	for _, account := range sourceAccounts {
		newAccount := account
		newAccount.ID = uuid.New().String()
		newAccount.TenantID = targetTenantID
		newAccount.CreatedAt = time.Now()
		newAccount.UpdatedAt = time.Now()

		// Save to PostgreSQL
		if err := s.postgres.SaveAccount(ctx, newAccount); err != nil {
			log.Printf("ERROR: Failed to save cloned account: %v", err)
			return err
		}
	}

	return nil
}

var cbnReportService *CBNReportService

func listCBNReportTypesHandler(w http.ResponseWriter, r *http.Request) {
	if cbnReportService == nil {
		cbnReportService = NewCBNReportService(coaService, nil)
	}

	reportTypes := cbnReportService.GetAllReportTypes()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"report_types": reportTypes,
		"total":        len(reportTypes),
	})
}

func generateCBNReportHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	vars := mux.Vars(r)
	reportType := CBNReportType(vars["report_type"])

	asOfDateStr := r.URL.Query().Get("as_of_date")
	var asOfDate time.Time
	if asOfDateStr != "" {
		var err error
		asOfDate, err = time.Parse("2006-01-02", asOfDateStr)
		if err != nil {
			http.Error(w, "Invalid date format, use YYYY-MM-DD", http.StatusBadRequest)
			return
		}
	} else {
		asOfDate = time.Now()
	}

	if cbnReportService == nil {
		cbnReportService = NewCBNReportService(coaService, nil)
	}

	report, err := cbnReportService.GenerateReport(ctx, tenantID, reportType, asOfDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(report)
}

func listMappingsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	mappings, err := coaService.postgres.ListCOAMappings(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if mappings == nil {
		mappings = []TenantCOAMapping{}
	}
	json.NewEncoder(w).Encode(mappings)
}

func getMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	key := mux.Vars(r)["key"]
	mapping, err := coaService.postgres.GetCOAMapping(ctx, tenantID, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if mapping == nil {
		http.Error(w, "mapping not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(mapping)
}

func upsertMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	var req UpsertCOAMappingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.MappingKey == "" || req.AccountID == "" {
		http.Error(w, "mapping_key and account_id are required", http.StatusBadRequest)
		return
	}

	now := time.Now()
	m := TenantCOAMapping{
		ID:          fmt.Sprintf("%s-%s", tenantID, req.MappingKey),
		TenantID:    tenantID,
		MappingKey:  req.MappingKey,
		AccountID:   req.AccountID,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := coaService.postgres.UpsertCOAMapping(ctx, m); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the mapping with account details populated
	result, err := coaService.postgres.GetCOAMapping(ctx, tenantID, req.MappingKey)
	if err != nil || result == nil {
		json.NewEncoder(w).Encode(m)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(result)
}

func deleteMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}

	key := mux.Vars(r)["key"]
	if err := coaService.postgres.DeleteCOAMapping(ctx, tenantID, key); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Approval workflow handlers ────────────────────────────────────────────────

func listWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		json.NewEncoder(w).Encode([]ApprovalWorkflow{})
		return
	}
	workflows, err := coaService.postgres.ListApprovalWorkflows(ctx, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if workflows == nil {
		workflows = []ApprovalWorkflow{}
	}
	json.NewEncoder(w).Encode(workflows)
}

func getWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	id := mux.Vars(r)["id"]
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	wf, err := approvalService.GetWorkflow(ctx, tenantID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if wf == nil {
		http.Error(w, "workflow not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(wf)
}

func createWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	var req ApprovalWorkflow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	wf, err := approvalService.CreateWorkflow(ctx, tenantID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wf)
}

func createDefaultWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	if err := approvalService.CreateDefaultWorkflows(ctx, tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "default workflows created"})
}

func listApprovalRequestsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		json.NewEncoder(w).Encode([]ApprovalRequest{})
		return
	}
	entityType := r.URL.Query().Get("entity_type")
	status := r.URL.Query().Get("status")
	requests, err := coaService.postgres.ListApprovalRequests(ctx, tenantID, entityType, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if requests == nil {
		requests = []ApprovalRequest{}
	}
	json.NewEncoder(w).Encode(requests)
}

func getApprovalRequestHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	req, err := approvalService.GetApprovalRequest(ctx, tenantID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if req == nil {
		http.Error(w, "approval request not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(req)
}

func approveRequestHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	approverID := r.Header.Get("X-Keycloak-ID")

	var body struct {
		Comments string `json:"comments"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	result, err := approvalService.Approve(ctx, tenantID, id, approverID, body.Comments)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(result)
}

func rejectRequestHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	approverID := r.Header.Get("X-Keycloak-ID")

	var body struct {
		Comments string `json:"comments"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	result, err := approvalService.Reject(ctx, tenantID, id, approverID, body.Comments)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(result)
}

func cancelRequestHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")

	var body struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	result, err := approvalService.Cancel(ctx, tenantID, id, userID, body.Reason)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(result)
}

func submitForApprovalHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if approvalService == nil {
		http.Error(w, "approval service not initialized", http.StatusServiceUnavailable)
		return
	}
	entryID := mux.Vars(r)["id"]
	requestedBy := r.Header.Get("X-Keycloak-ID")

	entry, err := coaService.GetJournalEntry(ctx, tenantID, entryID)
	if err != nil || entry == nil {
		http.Error(w, "journal entry not found", http.StatusNotFound)
		return
	}

	var totalAmount int64
	for _, line := range entry.Lines {
		totalAmount += line.DebitAmount
	}

	result, err := approvalService.SubmitForApproval(ctx, tenantID, "journal_entry", entryID, requestedBy, totalAmount, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if result == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "no approval workflow required for this amount"})
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(result)
}

func getJournalWithApprovalHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	entryID := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")
	userRole := r.Header.Get("X-User-Role")

	if approvalService == nil {
		entry, err := coaService.GetJournalEntry(ctx, tenantID, entryID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(JournalEntryWithApproval{JournalEntry: *entry})
		return
	}

	result, err := approvalService.GetJournalEntryWithApproval(ctx, tenantID, entryID, userID, userRole)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(result)
}

// ── Accounting period handlers ────────────────────────────────────────────────

func listPeriodsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		json.NewEncoder(w).Encode([]AccountingPeriod{})
		return
	}

	var fiscalYear int
	if fy := r.URL.Query().Get("fiscal_year"); fy != "" {
		fmt.Sscanf(fy, "%d", &fiscalYear)
	}

	periods, err := periodService.ListPeriods(ctx, tenantID, fiscalYear)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if periods == nil {
		periods = []AccountingPeriod{}
	}
	json.NewEncoder(w).Encode(periods)
}

func getPeriodHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	period, err := coaService.postgres.GetAccountingPeriod(ctx, tenantID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if period == nil {
		http.Error(w, "period not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(period)
}

func getPeriodSummaryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	summary, err := periodService.GetPeriodSummary(ctx, tenantID, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(summary)
}

func createFiscalYearHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	var req struct {
		Year       int `json:"year"`
		StartMonth int `json:"start_month"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Year == 0 {
		req.Year = time.Now().Year()
	}
	if req.StartMonth == 0 {
		req.StartMonth = 1
	}
	periods, err := periodService.CreateFiscalYear(ctx, tenantID, req.Year, req.StartMonth)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"periods": periods, "count": len(periods)})
}

func softClosePeriodHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")
	result, err := periodService.SoftClosePeriod(ctx, tenantID, id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(result)
}

func hardClosePeriodHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")
	result, err := periodService.HardClosePeriod(ctx, tenantID, id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(result)
}

func lockPeriodHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")
	if err := periodService.LockPeriod(ctx, tenantID, id, userID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "period_id": id, "status": "locked"})
}

func reopenPeriodHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	if periodService == nil {
		http.Error(w, "period service not initialized", http.StatusServiceUnavailable)
		return
	}
	id := mux.Vars(r)["id"]
	userID := r.Header.Get("X-Keycloak-ID")

	var body struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if err := periodService.ReopenPeriod(ctx, tenantID, id, userID, body.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "period_id": id, "status": "open"})
}
