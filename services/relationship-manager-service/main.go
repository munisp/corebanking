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
	portfolioValue = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "rm_portfolio_value",
			Help: "Total portfolio value by RM",
		},
		[]string{"rm_id"},
	)

	opportunitiesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rm_opportunities_total",
			Help: "Total opportunities by stage",
		},
		[]string{"stage"},
	)

	activitiesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rm_activities_total",
			Help: "Total activities by type",
		},
		[]string{"activity_type"},
	)

	crossSellConversions = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "rm_cross_sell_conversions_total",
			Help: "Total cross-sell conversions",
		},
	)

	customerNPS = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "rm_customer_nps_average",
			Help: "Average customer NPS",
		},
	)
)

// RMServer holds all services
type RMServer struct {
	customerService    *CustomerService
	portfolioService   *PortfolioService
	opportunityService *OpportunityService
	activityService    *ActivityService
	crossSellService   *CrossSellService
	campaignService    *CampaignService
	rmService          *RMService
	middleware         *MiddlewareIntegration
}

// NewRMServer creates a new server instance
func NewRMServer() *RMServer {
	tenantID := os.Getenv("DEFAULT_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	return &RMServer{
		customerService:    NewCustomerService(tenantID),
		portfolioService:   NewPortfolioService(tenantID),
		opportunityService: NewOpportunityService(tenantID),
		activityService:    NewActivityService(tenantID),
		crossSellService:   NewCrossSellService(tenantID),
		campaignService:    NewCampaignService(tenantID),
		rmService:          NewRMService(tenantID),
		middleware:         NewMiddlewareIntegration(tenantID),
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
	server := NewRMServer()
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

	// Customers
	api.HandleFunc("/customers", server.listCustomersHandler).Methods("GET")
	api.HandleFunc("/customers", server.createCustomerHandler).Methods("POST")
	api.HandleFunc("/customers/{customer_id}", server.getCustomerHandler).Methods("GET")
	api.HandleFunc("/customers/{customer_id}", server.updateCustomerHandler).Methods("PUT")
	api.HandleFunc("/customers/{customer_id}/products", server.getCustomerProductsHandler).Methods("GET")
	api.HandleFunc("/customers/{customer_id}/transactions", server.getCustomerTransactionsHandler).Methods("GET")
	api.HandleFunc("/customers/{customer_id}/activities", server.getCustomerActivitiesHandler).Methods("GET")
	api.HandleFunc("/customers/{customer_id}/opportunities", server.getCustomerOpportunitiesHandler).Methods("GET")
	api.HandleFunc("/customers/{customer_id}/recommendations", server.getCustomerRecommendationsHandler).Methods("GET")
	api.HandleFunc("/customers/at-risk", server.getAtRiskCustomersHandler).Methods("GET")
	api.HandleFunc("/customers/dormant", server.getDormantCustomersHandler).Methods("GET")
	api.HandleFunc("/customers/search", server.searchCustomersHandler).Methods("GET")

	// Portfolio
	api.HandleFunc("/portfolio", server.getPortfolioHandler).Methods("GET")
	api.HandleFunc("/portfolio/summary", server.getPortfolioSummaryHandler).Methods("GET")
	api.HandleFunc("/portfolio/segments", server.getPortfolioBySegmentHandler).Methods("GET")
	api.HandleFunc("/portfolio/performance", server.getPortfolioPerformanceHandler).Methods("GET")
	api.HandleFunc("/portfolio/targets", server.getPortfolioTargetsHandler).Methods("GET")

	// Opportunities (Pipeline)
	api.HandleFunc("/opportunities", server.listOpportunitiesHandler).Methods("GET")
	api.HandleFunc("/opportunities", server.createOpportunityHandler).Methods("POST")
	api.HandleFunc("/opportunities/{opportunity_id}", server.getOpportunityHandler).Methods("GET")
	api.HandleFunc("/opportunities/{opportunity_id}", server.updateOpportunityHandler).Methods("PUT")
	api.HandleFunc("/opportunities/{opportunity_id}/stage", server.updateOpportunityStageHandler).Methods("PUT")
	api.HandleFunc("/opportunities/pipeline", server.getPipelineHandler).Methods("GET")
	api.HandleFunc("/opportunities/pipeline/stages", server.getPipelineByStageHandler).Methods("GET")
	api.HandleFunc("/opportunities/forecast", server.getForecastHandler).Methods("GET")

	// Activities
	api.HandleFunc("/activities", server.listActivitiesHandler).Methods("GET")
	api.HandleFunc("/activities", server.createActivityHandler).Methods("POST")
	api.HandleFunc("/activities/{activity_id}", server.getActivityHandler).Methods("GET")
	api.HandleFunc("/activities/{activity_id}", server.updateActivityHandler).Methods("PUT")
	api.HandleFunc("/activities/follow-ups", server.getFollowUpsHandler).Methods("GET")
	api.HandleFunc("/activities/calendar", server.getActivityCalendarHandler).Methods("GET")

	// Cross-sell
	api.HandleFunc("/cross-sell/recommendations", server.listRecommendationsHandler).Methods("GET")
	api.HandleFunc("/cross-sell/recommendations/{recommendation_id}", server.getRecommendationHandler).Methods("GET")
	api.HandleFunc("/cross-sell/recommendations/{recommendation_id}/accept", server.acceptRecommendationHandler).Methods("POST")
	api.HandleFunc("/cross-sell/recommendations/{recommendation_id}/reject", server.rejectRecommendationHandler).Methods("POST")
	api.HandleFunc("/cross-sell/recommendations/{recommendation_id}/convert", server.convertRecommendationHandler).Methods("POST")
	api.HandleFunc("/cross-sell/analytics", server.getCrossSellAnalyticsHandler).Methods("GET")

	// Campaigns
	api.HandleFunc("/campaigns", server.listCampaignsHandler).Methods("GET")
	api.HandleFunc("/campaigns", server.createCampaignHandler).Methods("POST")
	api.HandleFunc("/campaigns/{campaign_id}", server.getCampaignHandler).Methods("GET")
	api.HandleFunc("/campaigns/{campaign_id}", server.updateCampaignHandler).Methods("PUT")
	api.HandleFunc("/campaigns/{campaign_id}/leads", server.getCampaignLeadsHandler).Methods("GET")
	api.HandleFunc("/campaigns/{campaign_id}/performance", server.getCampaignPerformanceHandler).Methods("GET")

	// Relationship Managers
	api.HandleFunc("/rms", server.listRMsHandler).Methods("GET")
	api.HandleFunc("/rms", server.registerRMHandler).Methods("POST")
	api.HandleFunc("/rms/{rm_id}", server.getRMHandler).Methods("GET")
	api.HandleFunc("/rms/{rm_id}", server.updateRMHandler).Methods("PUT")
	api.HandleFunc("/rms/{rm_id}/portfolio", server.getRMPortfolioHandler).Methods("GET")
	api.HandleFunc("/rms/{rm_id}/performance", server.getRMPerformanceHandler).Methods("GET")
	api.HandleFunc("/rms/leaderboard", server.getRMLeaderboardHandler).Methods("GET")

	// Dashboard
	api.HandleFunc("/dashboard", server.getDashboardHandler).Methods("GET")
	api.HandleFunc("/dashboard/summary", server.getDashboardSummaryHandler).Methods("GET")
	api.HandleFunc("/dashboard/alerts", server.getAlertsHandler).Methods("GET")
	api.HandleFunc("/dashboard/tasks", server.getTasksHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8130"
	}

	log.Printf("Relationship Manager Service starting on port %s", port)
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, x-keycloak-id, X-RM-ID")

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
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "relationship-manager-service"})
}

// Helper functions
func getTenantID(r *http.Request) string {
	return r.Header.Get("X-Tenant-ID")
}

func getRMID(r *http.Request) string {
	rmID := r.Header.Get("X-RM-ID")
	if rmID == "" {
		rmID = "rm-001"
	}
	return rmID
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Customer handlers
func (s *RMServer) listCustomersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	segment := r.URL.Query().Get("segment")
	customers := s.customerService.ListCustomers(tenantID, rmID, segment)
	respondJSON(w, http.StatusOK, map[string]interface{}{"customers": customers})
}

func (s *RMServer) createCustomerHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)

	var req CreateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	customer, err := s.customerService.CreateCustomer(tenantID, rmID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, customer)
}

func (s *RMServer) getCustomerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	customer, err := s.customerService.GetCustomer(tenantID, customerID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Customer not found")
		return
	}

	respondJSON(w, http.StatusOK, customer)
}

func (s *RMServer) updateCustomerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	var customer Customer
	if err := json.NewDecoder(r.Body).Decode(&customer); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	customer.CustomerID = customerID
	customer.TenantID = tenantID

	if err := s.customerService.UpdateCustomer(&customer); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, customer)
}

func (s *RMServer) getCustomerProductsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	products := s.customerService.GetCustomerProducts(tenantID, customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"products": products})
}

func (s *RMServer) getCustomerTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	transactions := s.customerService.GetCustomerTransactions(tenantID, customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"transactions": transactions})
}

func (s *RMServer) getCustomerActivitiesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	activities := s.activityService.GetCustomerActivities(tenantID, customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"activities": activities})
}

func (s *RMServer) getCustomerOpportunitiesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	opportunities := s.opportunityService.GetCustomerOpportunities(tenantID, customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"opportunities": opportunities})
}

func (s *RMServer) getCustomerRecommendationsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customer_id"]
	tenantID := getTenantID(r)

	recommendations := s.crossSellService.GetCustomerRecommendations(tenantID, customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"recommendations": recommendations})
}

func (s *RMServer) getAtRiskCustomersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	customers := s.customerService.GetAtRiskCustomers(tenantID, rmID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"customers": customers})
}

func (s *RMServer) getDormantCustomersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	customers := s.customerService.GetDormantCustomers(tenantID, rmID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"customers": customers})
}

func (s *RMServer) searchCustomersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	query := r.URL.Query().Get("q")
	customers := s.customerService.SearchCustomers(tenantID, query)
	respondJSON(w, http.StatusOK, map[string]interface{}{"customers": customers})
}

// Portfolio handlers
func (s *RMServer) getPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	portfolio := s.portfolioService.GetPortfolio(tenantID, rmID)
	respondJSON(w, http.StatusOK, portfolio)
}

func (s *RMServer) getPortfolioSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	summary := s.portfolioService.GetPortfolioSummary(tenantID, rmID)
	respondJSON(w, http.StatusOK, summary)
}

func (s *RMServer) getPortfolioBySegmentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	segments := s.portfolioService.GetPortfolioBySegment(tenantID, rmID)
	respondJSON(w, http.StatusOK, segments)
}

func (s *RMServer) getPortfolioPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	performance := s.portfolioService.GetPortfolioPerformance(tenantID, rmID)
	respondJSON(w, http.StatusOK, performance)
}

func (s *RMServer) getPortfolioTargetsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	targets := s.portfolioService.GetPortfolioTargets(tenantID, rmID)
	respondJSON(w, http.StatusOK, targets)
}

// Opportunity handlers
func (s *RMServer) listOpportunitiesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	stage := r.URL.Query().Get("stage")
	opportunities := s.opportunityService.ListOpportunities(tenantID, rmID, stage)
	respondJSON(w, http.StatusOK, map[string]interface{}{"opportunities": opportunities})
}

func (s *RMServer) createOpportunityHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)

	var req CreateOpportunityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	opportunity, err := s.opportunityService.CreateOpportunity(tenantID, rmID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	opportunitiesTotal.WithLabelValues(opportunity.Stage).Inc()
	respondJSON(w, http.StatusCreated, opportunity)
}

func (s *RMServer) getOpportunityHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	opportunityID := vars["opportunity_id"]
	tenantID := getTenantID(r)

	opportunity, err := s.opportunityService.GetOpportunity(tenantID, opportunityID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Opportunity not found")
		return
	}

	respondJSON(w, http.StatusOK, opportunity)
}

func (s *RMServer) updateOpportunityHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	opportunityID := vars["opportunity_id"]
	tenantID := getTenantID(r)

	var opportunity Opportunity
	if err := json.NewDecoder(r.Body).Decode(&opportunity); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	opportunity.OpportunityID = opportunityID
	opportunity.TenantID = tenantID

	if err := s.opportunityService.UpdateOpportunity(&opportunity); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, opportunity)
}

func (s *RMServer) updateOpportunityStageHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	opportunityID := vars["opportunity_id"]
	tenantID := getTenantID(r)

	var req UpdateOpportunityStageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	opportunity, err := s.opportunityService.UpdateStage(tenantID, opportunityID, req.Stage, req.Notes)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	opportunitiesTotal.WithLabelValues(req.Stage).Inc()
	respondJSON(w, http.StatusOK, opportunity)
}

func (s *RMServer) getPipelineHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	pipeline := s.opportunityService.GetPipeline(tenantID, rmID)
	respondJSON(w, http.StatusOK, pipeline)
}

func (s *RMServer) getPipelineByStageHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	stages := s.opportunityService.GetPipelineByStage(tenantID, rmID)
	respondJSON(w, http.StatusOK, stages)
}

func (s *RMServer) getForecastHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	forecast := s.opportunityService.GetForecast(tenantID, rmID)
	respondJSON(w, http.StatusOK, forecast)
}

// Activity handlers
func (s *RMServer) listActivitiesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	activityType := r.URL.Query().Get("type")
	activities := s.activityService.ListActivities(tenantID, rmID, activityType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"activities": activities})
}

func (s *RMServer) createActivityHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)

	var req CreateActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	activity, err := s.activityService.CreateActivity(tenantID, rmID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	activitiesTotal.WithLabelValues(activity.ActivityType).Inc()
	respondJSON(w, http.StatusCreated, activity)
}

func (s *RMServer) getActivityHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	activityID := vars["activity_id"]
	tenantID := getTenantID(r)

	activity, err := s.activityService.GetActivity(tenantID, activityID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Activity not found")
		return
	}

	respondJSON(w, http.StatusOK, activity)
}

func (s *RMServer) updateActivityHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	activityID := vars["activity_id"]
	tenantID := getTenantID(r)

	var activity Activity
	if err := json.NewDecoder(r.Body).Decode(&activity); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	activity.ActivityID = activityID
	activity.TenantID = tenantID

	if err := s.activityService.UpdateActivity(&activity); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, activity)
}

func (s *RMServer) getFollowUpsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	followUps := s.activityService.GetFollowUps(tenantID, rmID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"followUps": followUps})
}

func (s *RMServer) getActivityCalendarHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	calendar := s.activityService.GetCalendar(tenantID, rmID)
	respondJSON(w, http.StatusOK, calendar)
}

// Cross-sell handlers
func (s *RMServer) listRecommendationsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	status := r.URL.Query().Get("status")
	recommendations := s.crossSellService.ListRecommendations(tenantID, rmID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"recommendations": recommendations})
}

func (s *RMServer) getRecommendationHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	recommendationID := vars["recommendation_id"]
	tenantID := getTenantID(r)

	recommendation, err := s.crossSellService.GetRecommendation(tenantID, recommendationID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Recommendation not found")
		return
	}

	respondJSON(w, http.StatusOK, recommendation)
}

func (s *RMServer) acceptRecommendationHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	recommendationID := vars["recommendation_id"]
	tenantID := getTenantID(r)

	recommendation, err := s.crossSellService.AcceptRecommendation(tenantID, recommendationID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, recommendation)
}

func (s *RMServer) rejectRecommendationHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	recommendationID := vars["recommendation_id"]
	tenantID := getTenantID(r)

	recommendation, err := s.crossSellService.RejectRecommendation(tenantID, recommendationID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, recommendation)
}

func (s *RMServer) convertRecommendationHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	recommendationID := vars["recommendation_id"]
	tenantID := getTenantID(r)

	recommendation, err := s.crossSellService.ConvertRecommendation(tenantID, recommendationID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	crossSellConversions.Inc()
	respondJSON(w, http.StatusOK, recommendation)
}

func (s *RMServer) getCrossSellAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	analytics := s.crossSellService.GetAnalytics(tenantID, rmID)
	respondJSON(w, http.StatusOK, analytics)
}

// Campaign handlers
func (s *RMServer) listCampaignsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	campaigns := s.campaignService.ListCampaigns(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"campaigns": campaigns})
}

func (s *RMServer) createCampaignHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var campaign Campaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newCampaign, err := s.campaignService.CreateCampaign(tenantID, &campaign)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newCampaign)
}

func (s *RMServer) getCampaignHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	campaignID := vars["campaign_id"]
	tenantID := getTenantID(r)

	campaign, err := s.campaignService.GetCampaign(tenantID, campaignID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Campaign not found")
		return
	}

	respondJSON(w, http.StatusOK, campaign)
}

func (s *RMServer) updateCampaignHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	campaignID := vars["campaign_id"]
	tenantID := getTenantID(r)

	var campaign Campaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	campaign.CampaignID = campaignID
	campaign.TenantID = tenantID

	if err := s.campaignService.UpdateCampaign(&campaign); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, campaign)
}

func (s *RMServer) getCampaignLeadsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	campaignID := vars["campaign_id"]
	tenantID := getTenantID(r)

	leads := s.campaignService.GetCampaignLeads(tenantID, campaignID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"leads": leads})
}

func (s *RMServer) getCampaignPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	campaignID := vars["campaign_id"]
	tenantID := getTenantID(r)

	performance := s.campaignService.GetCampaignPerformance(tenantID, campaignID)
	respondJSON(w, http.StatusOK, performance)
}

// RM handlers
func (s *RMServer) listRMsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	segment := r.URL.Query().Get("segment")
	rms := s.rmService.ListRMs(tenantID, segment)
	respondJSON(w, http.StatusOK, map[string]interface{}{"rms": rms})
}

func (s *RMServer) registerRMHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var rm RelationshipManager
	if err := json.NewDecoder(r.Body).Decode(&rm); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newRM, err := s.rmService.RegisterRM(tenantID, &rm)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newRM)
}

func (s *RMServer) getRMHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rmID := vars["rm_id"]
	tenantID := getTenantID(r)

	rm, err := s.rmService.GetRM(tenantID, rmID)
	if err != nil {
		respondError(w, http.StatusNotFound, "RM not found")
		return
	}

	respondJSON(w, http.StatusOK, rm)
}

func (s *RMServer) updateRMHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rmID := vars["rm_id"]
	tenantID := getTenantID(r)

	var rm RelationshipManager
	if err := json.NewDecoder(r.Body).Decode(&rm); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rm.RMID = rmID
	rm.TenantID = tenantID

	if err := s.rmService.UpdateRM(&rm); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, rm)
}

func (s *RMServer) getRMPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rmID := vars["rm_id"]
	tenantID := getTenantID(r)

	portfolio := s.portfolioService.GetPortfolio(tenantID, rmID)
	respondJSON(w, http.StatusOK, portfolio)
}

func (s *RMServer) getRMPerformanceHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rmID := vars["rm_id"]
	tenantID := getTenantID(r)

	performance := s.rmService.GetRMPerformance(tenantID, rmID)
	respondJSON(w, http.StatusOK, performance)
}

func (s *RMServer) getRMLeaderboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	leaderboard := s.rmService.GetLeaderboard(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"leaderboard": leaderboard})
}

// Dashboard handlers
func (s *RMServer) getDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	dashboard := s.getDashboard(tenantID, rmID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *RMServer) getDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	dashboard := s.getDashboard(tenantID, rmID)
	summary := map[string]interface{}{
		"totalCustomers":   dashboard.TotalCustomers,
		"totalRevenue":     dashboard.TotalRevenue,
		"achievement":      dashboard.Achievement,
		"pipelineValue":    dashboard.PipelineValue,
		"pendingFollowUps": dashboard.PendingFollowUps,
	}
	respondJSON(w, http.StatusOK, summary)
}

func (s *RMServer) getAlertsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	alerts := s.getAlerts(tenantID, rmID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"alerts": alerts})
}

func (s *RMServer) getTasksHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rmID := getRMID(r)
	tasks := s.getTasks(tenantID, rmID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"tasks": tasks})
}

func (s *RMServer) getDashboard(tenantID, rmID string) *RMDashboard {
	dashboard := &RMDashboard{
		Date: time.Now(),
	}

	// Portfolio
	portfolio := s.portfolioService.GetPortfolio(tenantID, rmID)
	if portfolio != nil {
		dashboard.TotalCustomers = portfolio.TotalCustomers
		dashboard.TotalBalance = portfolio.TotalBalance
		dashboard.TotalRevenue = portfolio.TotalRevenue
		dashboard.RevenueTarget = portfolio.TargetRevenue
		dashboard.Achievement = portfolio.Achievement
	}

	// Pipeline
	pipeline := s.opportunityService.GetPipeline(tenantID, rmID)
	if total, ok := pipeline["totalOpportunities"].(int); ok {
		dashboard.TotalOpportunities = total
	}
	if value, ok := pipeline["totalValue"].(int64); ok {
		dashboard.PipelineValue = value
	}
	if weighted, ok := pipeline["weightedValue"].(int64); ok {
		dashboard.WeightedPipeline = weighted
	}

	// Activities
	activities := s.activityService.GetActivityStats(tenantID, rmID)
	if today, ok := activities["today"].(int); ok {
		dashboard.ActivitiesToday = today
	}
	if week, ok := activities["thisWeek"].(int); ok {
		dashboard.ActivitiesThisWeek = week
	}
	if followUps, ok := activities["pendingFollowUps"].(int); ok {
		dashboard.PendingFollowUps = followUps
	}

	// Cross-sell
	crossSell := s.crossSellService.GetAnalytics(tenantID, rmID)
	if recs, ok := crossSell["totalRecommendations"].(int); ok {
		dashboard.Recommendations = recs
	}
	if rate, ok := crossSell["conversionRate"].(float64); ok {
		dashboard.ConversionRate = rate
	}

	// Customer health
	dashboard.AtRiskCustomers = len(s.customerService.GetAtRiskCustomers(tenantID, rmID))
	dashboard.DormantCustomers = len(s.customerService.GetDormantCustomers(tenantID, rmID))
	dashboard.AverageNPS = 72.5

	return dashboard
}

func (s *RMServer) getAlerts(tenantID, rmID string) []map[string]interface{} {
	var alerts []map[string]interface{}

	// At-risk customers
	atRisk := s.customerService.GetAtRiskCustomers(tenantID, rmID)
	if len(atRisk) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "at_risk_customers",
			"severity": "high",
			"message":  "Customers at risk of churn",
			"count":    len(atRisk),
		})
	}

	// Pending follow-ups
	followUps := s.activityService.GetFollowUps(tenantID, rmID)
	overdue := 0
	for _, f := range followUps {
		if f.FollowUpDate != nil && f.FollowUpDate.Before(time.Now()) {
			overdue++
		}
	}
	if overdue > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "overdue_followups",
			"severity": "medium",
			"message":  "Overdue follow-up activities",
			"count":    overdue,
		})
	}

	return alerts
}

func (s *RMServer) getTasks(tenantID, rmID string) []map[string]interface{} {
	var tasks []map[string]interface{}

	// Follow-ups due today
	followUps := s.activityService.GetFollowUps(tenantID, rmID)
	for _, f := range followUps {
		if f.FollowUpDate != nil {
			tasks = append(tasks, map[string]interface{}{
				"type":         "follow_up",
				"customerID":   f.CustomerID,
				"customerName": f.CustomerName,
				"dueDate":      f.FollowUpDate.Format("2006-01-02"),
				"notes":        f.FollowUpNotes,
			})
		}
	}

	// Customer reviews due
	customers := s.customerService.ListCustomers(tenantID, rmID, "")
	for _, c := range customers {
		if c.NextReview.Before(time.Now().AddDate(0, 0, 7)) {
			tasks = append(tasks, map[string]interface{}{
				"type":         "customer_review",
				"customerID":   c.CustomerID,
				"customerName": c.FirstName + " " + c.LastName,
				"dueDate":      c.NextReview.Format("2006-01-02"),
			})
		}
	}

	return tasks
}
