package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	creditRiskExposure = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "risk_credit_exposure_total",
			Help: "Total credit risk exposure",
		},
		[]string{"rating"},
	)

	operationalRiskEvents = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "risk_operational_events_total",
			Help: "Total operational risk events",
		},
		[]string{"event_type", "severity"},
	)

	marketRiskVaR = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "risk_market_var",
			Help: "Market risk Value at Risk",
		},
	)

	riskLimitBreaches = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "risk_limit_breaches_total",
			Help: "Total risk limit breaches",
		},
	)

	kriBreaches = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "risk_kri_breaches",
			Help: "Number of KRI breaches",
		},
	)
)

// RiskServer holds all services
type RiskServer struct {
	creditRiskService      *CreditRiskService
	operationalRiskService *OperationalRiskService
	marketRiskService      *MarketRiskService
	limitService           *LimitService
	indicatorService       *IndicatorService
	stressTestService      *StressTestService
	reportService          *ReportService
	officerService         *OfficerService
	middleware             *MiddlewareIntegration
}

// NewRiskServer creates a new server instance
func NewRiskServer() *RiskServer {
	tenantID := os.Getenv("DEFAULT_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	return &RiskServer{
		creditRiskService:      NewCreditRiskService(tenantID),
		operationalRiskService: NewOperationalRiskService(tenantID),
		marketRiskService:      NewMarketRiskService(tenantID),
		limitService:           NewLimitService(tenantID),
		indicatorService:       NewIndicatorService(tenantID),
		stressTestService:      NewStressTestService(tenantID),
		reportService:          NewReportService(tenantID),
		officerService:         NewOfficerService(tenantID),
		middleware:             NewMiddlewareIntegration(tenantID),
	}
}

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
	server := NewRiskServer()
	router := mux.NewRouter()

	// Middleware
	router.Use(corsMiddleware)
	router.Use(tenantMiddleware)
	router.Use(loggingMiddleware)
	router.Use(auditMiddleware)

	// Health and metrics
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// API routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Credit Risk
	api.HandleFunc("/credit-risk", server.listCreditRisksHandler).Methods("GET")
	api.HandleFunc("/credit-risk", server.createCreditRiskHandler).Methods("POST")
	api.HandleFunc("/credit-risk/{risk_id}", server.getCreditRiskHandler).Methods("GET")
	api.HandleFunc("/credit-risk/{risk_id}", server.updateCreditRiskHandler).Methods("PUT")
	api.HandleFunc("/credit-risk/{risk_id}/rating", server.updateRiskRatingHandler).Methods("PUT")
	api.HandleFunc("/credit-risk/portfolio", server.getPortfolioRiskHandler).Methods("GET")
	api.HandleFunc("/credit-risk/concentration", server.getConcentrationRiskHandler).Methods("GET")
	api.HandleFunc("/credit-risk/watchlist", server.getWatchlistHandler).Methods("GET")
	api.HandleFunc("/credit-risk/provisions", server.getProvisionsHandler).Methods("GET")
	api.HandleFunc("/credit-risk/npl", server.getNPLAnalysisHandler).Methods("GET")

	// Operational Risk
	api.HandleFunc("/operational-risk", server.listOperationalRisksHandler).Methods("GET")
	api.HandleFunc("/operational-risk", server.createOperationalRiskHandler).Methods("POST")
	api.HandleFunc("/operational-risk/{risk_id}", server.getOperationalRiskHandler).Methods("GET")
	api.HandleFunc("/operational-risk/{risk_id}", server.updateOperationalRiskHandler).Methods("PUT")
	api.HandleFunc("/operational-risk/{risk_id}/assign", server.assignOperationalRiskHandler).Methods("POST")
	api.HandleFunc("/operational-risk/{risk_id}/resolve", server.resolveOperationalRiskHandler).Methods("POST")
	api.HandleFunc("/operational-risk/summary", server.getOperationalRiskSummaryHandler).Methods("GET")
	api.HandleFunc("/operational-risk/loss-distribution", server.getLossDistributionHandler).Methods("GET")

	// Market Risk
	api.HandleFunc("/market-risk", server.listMarketRisksHandler).Methods("GET")
	api.HandleFunc("/market-risk/var", server.getVaRHandler).Methods("GET")
	api.HandleFunc("/market-risk/var/history", server.getVaRHistoryHandler).Methods("GET")
	api.HandleFunc("/market-risk/sensitivity", server.getSensitivityAnalysisHandler).Methods("GET")
	api.HandleFunc("/market-risk/fx-exposure", server.getFXExposureHandler).Methods("GET")
	api.HandleFunc("/market-risk/interest-rate", server.getInterestRateRiskHandler).Methods("GET")

	// Risk Limits
	api.HandleFunc("/limits", server.listLimitsHandler).Methods("GET")
	api.HandleFunc("/limits", server.createLimitHandler).Methods("POST")
	api.HandleFunc("/limits/{limit_id}", server.getLimitHandler).Methods("GET")
	api.HandleFunc("/limits/{limit_id}", server.updateLimitHandler).Methods("PUT")
	api.HandleFunc("/limits/utilization", server.getLimitUtilizationHandler).Methods("GET")
	api.HandleFunc("/limits/breaches", server.getLimitBreachesHandler).Methods("GET")

	// Key Risk Indicators (KRI)
	api.HandleFunc("/indicators", server.listIndicatorsHandler).Methods("GET")
	api.HandleFunc("/indicators", server.createIndicatorHandler).Methods("POST")
	api.HandleFunc("/indicators/{indicator_id}", server.getIndicatorHandler).Methods("GET")
	api.HandleFunc("/indicators/{indicator_id}", server.updateIndicatorHandler).Methods("PUT")
	api.HandleFunc("/indicators/dashboard", server.getKRIDashboardHandler).Methods("GET")
	api.HandleFunc("/indicators/trends", server.getKRITrendsHandler).Methods("GET")

	// Stress Testing
	api.HandleFunc("/stress-tests", server.listStressTestsHandler).Methods("GET")
	api.HandleFunc("/stress-tests", server.createStressTestHandler).Methods("POST")
	api.HandleFunc("/stress-tests/{test_id}", server.getStressTestHandler).Methods("GET")
	api.HandleFunc("/stress-tests/{test_id}/run", server.runStressTestHandler).Methods("POST")
	api.HandleFunc("/stress-tests/scenarios", server.getScenariosHandler).Methods("GET")
	api.HandleFunc("/stress-tests/results", server.getStressTestResultsHandler).Methods("GET")

	// Reports
	api.HandleFunc("/reports", server.listReportsHandler).Methods("GET")
	api.HandleFunc("/reports", server.createReportHandler).Methods("POST")
	api.HandleFunc("/reports/{report_id}", server.getReportHandler).Methods("GET")
	api.HandleFunc("/reports/{report_id}/approve", server.approveReportHandler).Methods("POST")
	api.HandleFunc("/reports/{report_id}/submit", server.submitReportHandler).Methods("POST")
	api.HandleFunc("/reports/regulatory", server.getRegulatoryReportsHandler).Methods("GET")

	// Officers
	api.HandleFunc("/officers", server.listOfficersHandler).Methods("GET")
	api.HandleFunc("/officers", server.registerOfficerHandler).Methods("POST")
	api.HandleFunc("/officers/{officer_id}", server.getOfficerHandler).Methods("GET")
	api.HandleFunc("/officers/{officer_id}", server.updateOfficerHandler).Methods("PUT")

	// Dashboard
	api.HandleFunc("/dashboard", server.getDashboardHandler).Methods("GET")
	api.HandleFunc("/dashboard/summary", server.getDashboardSummaryHandler).Methods("GET")
	api.HandleFunc("/dashboard/alerts", server.getAlertsHandler).Methods("GET")
	api.HandleFunc("/dashboard/risk-appetite", server.getRiskAppetiteHandler).Methods("GET")

	// Capital
	api.HandleFunc("/capital/adequacy", server.getCapitalAdequacyHandler).Methods("GET")
	api.HandleFunc("/capital/requirements", server.getCapitalRequirementsHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8129"
	}

	log.Printf("Risk Manager Service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(router)))
}

// Middleware functions
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, x-keycloak-id, X-Officer-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func tenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		r.Header.Set("X-Tenant-ID", tenantID)
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s %v", r.Method, r.RequestURI, r.Header.Get("X-Tenant-ID"), time.Since(start))
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "risk-manager-service"})
}

// Helper functions
func getTenantID(r *http.Request) string {
	return r.Header.Get("X-Tenant-ID")
}

func getUserID(r *http.Request) string {
	userID := r.Header.Get("x-keycloak-id")
	if userID == "" {
		userID = "system"
	}
	return userID
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Credit Risk handlers
func (s *RiskServer) listCreditRisksHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rating := r.URL.Query().Get("rating")
	watchlist := r.URL.Query().Get("watchlist")
	risks := s.creditRiskService.ListRisks(tenantID, rating, watchlist)
	respondJSON(w, http.StatusOK, map[string]interface{}{"risks": risks})
}

func (s *RiskServer) createCreditRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var req CreateCreditRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	risk, err := s.creditRiskService.CreateRisk(tenantID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	creditRiskExposure.WithLabelValues(risk.RiskRating).Add(float64(risk.ExposureAmount))
	respondJSON(w, http.StatusCreated, risk)
}

func (s *RiskServer) getCreditRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)

	risk, err := s.creditRiskService.GetRisk(tenantID, riskID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Risk not found")
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) updateCreditRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)

	var risk CreditRisk
	if err := json.NewDecoder(r.Body).Decode(&risk); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	risk.RiskID = riskID
	risk.TenantID = tenantID

	if err := s.creditRiskService.UpdateRisk(&risk); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) updateRiskRatingHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req UpdateRiskRatingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	risk, err := s.creditRiskService.UpdateRating(tenantID, riskID, userID, &req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) getPortfolioRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	portfolio := s.creditRiskService.GetPortfolioRisk(tenantID)
	respondJSON(w, http.StatusOK, portfolio)
}

func (s *RiskServer) getConcentrationRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	concentration := s.creditRiskService.GetConcentrationRisk(tenantID)
	respondJSON(w, http.StatusOK, concentration)
}

func (s *RiskServer) getWatchlistHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	watchlist := s.creditRiskService.GetWatchlist(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"watchlist": watchlist})
}

func (s *RiskServer) getProvisionsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	provisions := s.creditRiskService.GetProvisions(tenantID)
	respondJSON(w, http.StatusOK, provisions)
}

func (s *RiskServer) getNPLAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	npl := s.creditRiskService.GetNPLAnalysis(tenantID)
	respondJSON(w, http.StatusOK, npl)
}

// Operational Risk handlers
func (s *RiskServer) listOperationalRisksHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	eventType := r.URL.Query().Get("type")
	risks := s.operationalRiskService.ListRisks(tenantID, status, eventType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"risks": risks})
}

func (s *RiskServer) createOperationalRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req CreateOperationalRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	risk, err := s.operationalRiskService.CreateRisk(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	operationalRiskEvents.WithLabelValues(req.EventType, req.Severity).Inc()
	respondJSON(w, http.StatusCreated, risk)
}

func (s *RiskServer) getOperationalRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)

	risk, err := s.operationalRiskService.GetRisk(tenantID, riskID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Risk not found")
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) updateOperationalRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)

	var risk OperationalRisk
	if err := json.NewDecoder(r.Body).Decode(&risk); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	risk.RiskID = riskID
	risk.TenantID = tenantID

	if err := s.operationalRiskService.UpdateRisk(&risk); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) assignOperationalRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)

	var req struct {
		AssignTo string `json:"assignTo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	risk, err := s.operationalRiskService.AssignRisk(tenantID, riskID, req.AssignTo)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) resolveOperationalRiskHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	riskID := vars["risk_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req struct {
		RootCause        string `json:"rootCause"`
		CorrectiveAction string `json:"correctiveAction"`
		PreventiveAction string `json:"preventiveAction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	risk, err := s.operationalRiskService.ResolveRisk(tenantID, riskID, userID, req.RootCause, req.CorrectiveAction, req.PreventiveAction)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, risk)
}

func (s *RiskServer) getOperationalRiskSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	summary := s.operationalRiskService.GetSummary(tenantID)
	respondJSON(w, http.StatusOK, summary)
}

func (s *RiskServer) getLossDistributionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	distribution := s.operationalRiskService.GetLossDistribution(tenantID)
	respondJSON(w, http.StatusOK, distribution)
}

// Market Risk handlers
func (s *RiskServer) listMarketRisksHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	portfolio := r.URL.Query().Get("portfolio")
	risks := s.marketRiskService.ListRisks(tenantID, portfolio)
	respondJSON(w, http.StatusOK, map[string]interface{}{"risks": risks})
}

func (s *RiskServer) getVaRHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	var_ := s.marketRiskService.GetVaR(tenantID)
	respondJSON(w, http.StatusOK, var_)
}

func (s *RiskServer) getVaRHistoryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	history := s.marketRiskService.GetVaRHistory(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"history": history})
}

func (s *RiskServer) getSensitivityAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	sensitivity := s.marketRiskService.GetSensitivityAnalysis(tenantID)
	respondJSON(w, http.StatusOK, sensitivity)
}

func (s *RiskServer) getFXExposureHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	exposure := s.marketRiskService.GetFXExposure(tenantID)
	respondJSON(w, http.StatusOK, exposure)
}

func (s *RiskServer) getInterestRateRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	irr := s.marketRiskService.GetInterestRateRisk(tenantID)
	respondJSON(w, http.StatusOK, irr)
}

// Risk Limits handlers
func (s *RiskServer) listLimitsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	limitType := r.URL.Query().Get("type")
	limits := s.limitService.ListLimits(tenantID, limitType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"limits": limits})
}

func (s *RiskServer) createLimitHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req CreateRiskLimitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	limit, err := s.limitService.CreateLimit(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, limit)
}

func (s *RiskServer) getLimitHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	limitID := vars["limit_id"]
	tenantID := getTenantID(r)

	limit, err := s.limitService.GetLimit(tenantID, limitID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Limit not found")
		return
	}

	respondJSON(w, http.StatusOK, limit)
}

func (s *RiskServer) updateLimitHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	limitID := vars["limit_id"]
	tenantID := getTenantID(r)

	var limit RiskLimit
	if err := json.NewDecoder(r.Body).Decode(&limit); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	limit.LimitID = limitID
	limit.TenantID = tenantID

	if err := s.limitService.UpdateLimit(&limit); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, limit)
}

func (s *RiskServer) getLimitUtilizationHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	utilization := s.limitService.GetUtilization(tenantID)
	respondJSON(w, http.StatusOK, utilization)
}

func (s *RiskServer) getLimitBreachesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	breaches := s.limitService.GetBreaches(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"breaches": breaches})
}

// KRI handlers
func (s *RiskServer) listIndicatorsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	category := r.URL.Query().Get("category")
	indicators := s.indicatorService.ListIndicators(tenantID, category)
	respondJSON(w, http.StatusOK, map[string]interface{}{"indicators": indicators})
}

func (s *RiskServer) createIndicatorHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var indicator RiskIndicator
	if err := json.NewDecoder(r.Body).Decode(&indicator); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newIndicator, err := s.indicatorService.CreateIndicator(tenantID, &indicator)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newIndicator)
}

func (s *RiskServer) getIndicatorHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	indicatorID := vars["indicator_id"]
	tenantID := getTenantID(r)

	indicator, err := s.indicatorService.GetIndicator(tenantID, indicatorID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Indicator not found")
		return
	}

	respondJSON(w, http.StatusOK, indicator)
}

func (s *RiskServer) updateIndicatorHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	indicatorID := vars["indicator_id"]
	tenantID := getTenantID(r)

	var indicator RiskIndicator
	if err := json.NewDecoder(r.Body).Decode(&indicator); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	indicator.IndicatorID = indicatorID
	indicator.TenantID = tenantID

	if err := s.indicatorService.UpdateIndicator(&indicator); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, indicator)
}

func (s *RiskServer) getKRIDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.indicatorService.GetDashboard(tenantID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *RiskServer) getKRITrendsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	trends := s.indicatorService.GetTrends(tenantID)
	respondJSON(w, http.StatusOK, trends)
}

// Stress Test handlers
func (s *RiskServer) listStressTestsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	testType := r.URL.Query().Get("type")
	tests := s.stressTestService.ListTests(tenantID, testType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"tests": tests})
}

func (s *RiskServer) createStressTestHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req CreateStressTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	test, err := s.stressTestService.CreateTest(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, test)
}

func (s *RiskServer) getStressTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)

	test, err := s.stressTestService.GetTest(tenantID, testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Test not found")
		return
	}

	respondJSON(w, http.StatusOK, test)
}

func (s *RiskServer) runStressTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	test, err := s.stressTestService.RunTest(tenantID, testID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, test)
}

func (s *RiskServer) getScenariosHandler(w http.ResponseWriter, r *http.Request) {
	scenarios := s.stressTestService.GetScenarios()
	respondJSON(w, http.StatusOK, map[string]interface{}{"scenarios": scenarios})
}

func (s *RiskServer) getStressTestResultsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	results := s.stressTestService.GetResults(tenantID)
	respondJSON(w, http.StatusOK, results)
}

// Report handlers
func (s *RiskServer) listReportsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	reportType := r.URL.Query().Get("type")
	reports := s.reportService.ListReports(tenantID, reportType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"reports": reports})
}

func (s *RiskServer) createReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req struct {
		ReportType string `json:"reportType"`
		ReportName string `json:"reportName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	report, err := s.reportService.CreateReport(tenantID, userID, req.ReportType, req.ReportName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, report)
}

func (s *RiskServer) getReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)

	report, err := s.reportService.GetReport(tenantID, reportID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Report not found")
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *RiskServer) approveReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	report, err := s.reportService.ApproveReport(tenantID, reportID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *RiskServer) submitReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)

	report, err := s.reportService.SubmitReport(tenantID, reportID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *RiskServer) getRegulatoryReportsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	reports := s.reportService.GetRegulatoryReports(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"reports": reports})
}

// Officer handlers
func (s *RiskServer) listOfficersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	specialization := r.URL.Query().Get("specialization")
	officers := s.officerService.ListOfficers(tenantID, specialization)
	respondJSON(w, http.StatusOK, map[string]interface{}{"officers": officers})
}

func (s *RiskServer) registerOfficerHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var officer RiskOfficer
	if err := json.NewDecoder(r.Body).Decode(&officer); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newOfficer, err := s.officerService.RegisterOfficer(tenantID, &officer)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newOfficer)
}

func (s *RiskServer) getOfficerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	officerID := vars["officer_id"]
	tenantID := getTenantID(r)

	officer, err := s.officerService.GetOfficer(tenantID, officerID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Officer not found")
		return
	}

	respondJSON(w, http.StatusOK, officer)
}

func (s *RiskServer) updateOfficerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	officerID := vars["officer_id"]
	tenantID := getTenantID(r)

	var officer RiskOfficer
	if err := json.NewDecoder(r.Body).Decode(&officer); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	officer.OfficerID = officerID
	officer.TenantID = tenantID

	if err := s.officerService.UpdateOfficer(&officer); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, officer)
}

// Dashboard handlers
func (s *RiskServer) getDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *RiskServer) getDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	summary := map[string]interface{}{
		"totalExposure":        dashboard.TotalExposure,
		"nplRatio":             dashboard.NPLRatio,
		"totalVaR":             dashboard.TotalVaR,
		"openIncidents":        dashboard.OpenIncidents,
		"capitalAdequacyRatio": dashboard.CapitalAdequacyRatio,
	}
	respondJSON(w, http.StatusOK, summary)
}

func (s *RiskServer) getAlertsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	alerts := s.getAlerts(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"alerts": alerts})
}

func (s *RiskServer) getRiskAppetiteHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	appetite := s.getRiskAppetite(tenantID)
	respondJSON(w, http.StatusOK, appetite)
}

func (s *RiskServer) getDashboard(tenantID string) *RiskDashboard {
	dashboard := &RiskDashboard{
		Date: time.Now(),
	}

	// Credit Risk
	portfolio := s.creditRiskService.GetPortfolioRisk(tenantID)
	if exposure, ok := portfolio["totalExposure"].(int64); ok {
		dashboard.TotalExposure = exposure
	}
	if npl, ok := portfolio["nplRatio"].(float64); ok {
		dashboard.NPLRatio = npl
	}
	if coverage, ok := portfolio["provisionCoverage"].(float64); ok {
		dashboard.ProvisionCoverage = coverage
	}

	// Market Risk
	var_ := s.marketRiskService.GetVaR(tenantID)
	if totalVaR, ok := var_["totalVaR"].(int64); ok {
		dashboard.TotalVaR = totalVaR
	}

	// Operational Risk
	summary := s.operationalRiskService.GetSummary(tenantID)
	if open, ok := summary["openEvents"].(int); ok {
		dashboard.OpenIncidents = open
	}
	if losses, ok := summary["totalLosses"].(int64); ok {
		dashboard.TotalLosses = losses
	}

	// KRI
	kriDashboard := s.indicatorService.GetDashboard(tenantID)
	if breaches, ok := kriDashboard["redIndicators"].(int); ok {
		dashboard.KRIBreaches = breaches
	}

	// Capital
	dashboard.CapitalAdequacyRatio = 18.5
	dashboard.RiskAppetiteStatus = "within_appetite"

	return dashboard
}

func (s *RiskServer) getAlerts(tenantID string) []map[string]interface{} {
	var alerts []map[string]interface{}

	// Check limit breaches
	breaches := s.limitService.GetBreaches(tenantID)
	if len(breaches) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "limit_breach",
			"severity": "high",
			"message":  "Risk limit breaches detected",
			"count":    len(breaches),
		})
	}

	// Check KRI breaches
	kriDashboard := s.indicatorService.GetDashboard(tenantID)
	if red, ok := kriDashboard["redIndicators"].(int); ok && red > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "kri_breach",
			"severity": "high",
			"message":  "Key Risk Indicators in red status",
			"count":    red,
		})
	}

	return alerts
}

func (s *RiskServer) getRiskAppetite(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"creditRisk": map[string]interface{}{
			"nplLimit":           5.0,
			"currentNPL":         3.2,
			"status":             "within_appetite",
			"concentrationLimit": 25.0,
		},
		"marketRisk": map[string]interface{}{
			"varLimit":    5000000000,
			"currentVaR":  2500000000,
			"status":      "within_appetite",
			"utilization": 50.0,
		},
		"operationalRisk": map[string]interface{}{
			"lossLimit":   1000000000,
			"currentLoss": 250000000,
			"status":      "within_appetite",
			"utilization": 25.0,
		},
		"capitalAdequacy": map[string]interface{}{
			"minimumRatio": 15.0,
			"currentRatio": 18.5,
			"status":       "within_appetite",
			"buffer":       3.5,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// Capital handlers
func (s *RiskServer) getCapitalAdequacyHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	_ = tenantID
	adequacy := map[string]interface{}{
		"tier1Capital":       150000000000, // 150B NGN
		"tier2Capital":       50000000000,  // 50B NGN
		"totalCapital":       200000000000, // 200B NGN
		"riskWeightedAssets": 1081081081081,
		"tier1Ratio":         13.88,
		"totalCapitalRatio":  18.50,
		"minimumRequirement": 15.0,
		"capitalBuffer":      3.5,
		"status":             "compliant",
		"timestamp":          time.Now().Format(time.RFC3339),
	}
	respondJSON(w, http.StatusOK, adequacy)
}

func (s *RiskServer) getCapitalRequirementsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	_ = tenantID
	requirements := map[string]interface{}{
		"creditRiskRWA":             800000000000, // 800B NGN
		"marketRiskRWA":             150000000000, // 150B NGN
		"operationalRiskRWA":        131081081081, // 131B NGN
		"totalRWA":                  1081081081081,
		"pillar1Capital":            162162162162,
		"pillar2Capital":            20000000000,
		"capitalConservationBuffer": 27027027027,
		"countercyclicalBuffer":     0,
		"timestamp":                 time.Now().Format(time.RFC3339),
	}
	respondJSON(w, http.StatusOK, requirements)
}
