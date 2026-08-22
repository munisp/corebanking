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
	auditsCompletedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "audit_completed_total",
			Help: "Total audits completed by type",
		},
		[]string{"audit_type"},
	)

	findingsIdentifiedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "audit_findings_total",
			Help: "Total findings identified by risk rating",
		},
		[]string{"risk_rating"},
	)

	controlsTestedTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "audit_controls_tested_total",
			Help: "Total controls tested by result",
		},
		[]string{"result"},
	)

	openFindingsGauge = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "audit_open_findings",
			Help: "Current number of open findings",
		},
	)
)

// AuditServer holds all services
type AuditServer struct {
	planService        *PlanService
	engagementService  *EngagementService
	controlTestService *ControlTestService
	findingService     *FindingService
	reportService      *ReportService
	followUpService    *FollowUpService
	riskService        *RiskAssessmentService
	auditorService     *AuditorService
	middleware         *MiddlewareIntegration
}

// NewAuditServer creates a new server instance
func NewAuditServer() *AuditServer {
	tenantID := os.Getenv("DEFAULT_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	return &AuditServer{
		planService:        NewPlanService(tenantID),
		engagementService:  NewEngagementService(tenantID),
		controlTestService: NewControlTestService(tenantID),
		findingService:     NewFindingService(tenantID),
		reportService:      NewReportService(tenantID),
		followUpService:    NewFollowUpService(tenantID),
		riskService:        NewRiskAssessmentService(tenantID),
		auditorService:     NewAuditorService(tenantID),
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
	server := NewAuditServer()
	router := mux.NewRouter()

	// Middleware
	router.Use(corsMiddleware)
	router.Use(tenantMiddleware)
	router.Use(loggingMiddleware)

	// Health and metrics
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// API routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Audit Plans
	api.HandleFunc("/plans", server.listPlansHandler).Methods("GET")
	api.HandleFunc("/plans", server.createPlanHandler).Methods("POST")
	api.HandleFunc("/plans/{plan_id}", server.getPlanHandler).Methods("GET")
	api.HandleFunc("/plans/{plan_id}", server.updatePlanHandler).Methods("PUT")
	api.HandleFunc("/plans/{plan_id}/approve", server.approvePlanHandler).Methods("POST")
	api.HandleFunc("/plans/{plan_id}/start", server.startPlanHandler).Methods("POST")
	api.HandleFunc("/plans/{plan_id}/complete", server.completePlanHandler).Methods("POST")
	api.HandleFunc("/plans/year/{year}", server.getPlansByYearHandler).Methods("GET")
	api.HandleFunc("/plans/summary", server.getPlanSummaryHandler).Methods("GET")

	// Audit Engagements
	api.HandleFunc("/engagements", server.listEngagementsHandler).Methods("GET")
	api.HandleFunc("/engagements", server.createEngagementHandler).Methods("POST")
	api.HandleFunc("/engagements/{engagement_id}", server.getEngagementHandler).Methods("GET")
	api.HandleFunc("/engagements/{engagement_id}", server.updateEngagementHandler).Methods("PUT")
	api.HandleFunc("/engagements/{engagement_id}/start-fieldwork", server.startFieldworkHandler).Methods("POST")
	api.HandleFunc("/engagements/{engagement_id}/start-reporting", server.startReportingHandler).Methods("POST")
	api.HandleFunc("/engagements/{engagement_id}/close", server.closeEngagementHandler).Methods("POST")
	api.HandleFunc("/engagements/{engagement_id}/controls", server.getEngagementControlsHandler).Methods("GET")
	api.HandleFunc("/engagements/{engagement_id}/findings", server.getEngagementFindingsHandler).Methods("GET")
	api.HandleFunc("/engagements/active", server.getActiveEngagementsHandler).Methods("GET")

	// Control Tests
	api.HandleFunc("/controls", server.listControlTestsHandler).Methods("GET")
	api.HandleFunc("/controls", server.createControlTestHandler).Methods("POST")
	api.HandleFunc("/controls/{test_id}", server.getControlTestHandler).Methods("GET")
	api.HandleFunc("/controls/{test_id}", server.updateControlTestHandler).Methods("PUT")
	api.HandleFunc("/controls/{test_id}/execute", server.executeControlTestHandler).Methods("POST")
	api.HandleFunc("/controls/{test_id}/review", server.reviewControlTestHandler).Methods("POST")
	api.HandleFunc("/controls/summary", server.getControlSummaryHandler).Methods("GET")

	// Audit Findings
	api.HandleFunc("/findings", server.listFindingsHandler).Methods("GET")
	api.HandleFunc("/findings", server.createFindingHandler).Methods("POST")
	api.HandleFunc("/findings/{finding_id}", server.getFindingHandler).Methods("GET")
	api.HandleFunc("/findings/{finding_id}", server.updateFindingHandler).Methods("PUT")
	api.HandleFunc("/findings/{finding_id}/management-response", server.submitManagementResponseHandler).Methods("POST")
	api.HandleFunc("/findings/{finding_id}/close", server.closeFindingHandler).Methods("POST")
	api.HandleFunc("/findings/open", server.getOpenFindingsHandler).Methods("GET")
	api.HandleFunc("/findings/overdue", server.getOverdueFindingsHandler).Methods("GET")
	api.HandleFunc("/findings/summary", server.getFindingSummaryHandler).Methods("GET")

	// Audit Reports
	api.HandleFunc("/reports", server.listReportsHandler).Methods("GET")
	api.HandleFunc("/reports", server.createReportHandler).Methods("POST")
	api.HandleFunc("/reports/{report_id}", server.getReportHandler).Methods("GET")
	api.HandleFunc("/reports/{report_id}", server.updateReportHandler).Methods("PUT")
	api.HandleFunc("/reports/{report_id}/review", server.reviewReportHandler).Methods("POST")
	api.HandleFunc("/reports/{report_id}/approve", server.approveReportHandler).Methods("POST")
	api.HandleFunc("/reports/{report_id}/issue", server.issueReportHandler).Methods("POST")

	// Follow-ups
	api.HandleFunc("/followups", server.listFollowUpsHandler).Methods("GET")
	api.HandleFunc("/followups", server.createFollowUpHandler).Methods("POST")
	api.HandleFunc("/followups/{followup_id}", server.getFollowUpHandler).Methods("GET")
	api.HandleFunc("/followups/{followup_id}", server.updateFollowUpHandler).Methods("PUT")
	api.HandleFunc("/followups/pending", server.getPendingFollowUpsHandler).Methods("GET")
	api.HandleFunc("/followups/overdue", server.getOverdueFollowUpsHandler).Methods("GET")

	// Risk Assessments
	api.HandleFunc("/risk-assessments", server.listRiskAssessmentsHandler).Methods("GET")
	api.HandleFunc("/risk-assessments", server.createRiskAssessmentHandler).Methods("POST")
	api.HandleFunc("/risk-assessments/{assessment_id}", server.getRiskAssessmentHandler).Methods("GET")
	api.HandleFunc("/risk-assessments/{assessment_id}", server.updateRiskAssessmentHandler).Methods("PUT")
	api.HandleFunc("/risk-assessments/{assessment_id}/approve", server.approveRiskAssessmentHandler).Methods("POST")
	api.HandleFunc("/risk-assessments/high-risk", server.getHighRiskAreasHandler).Methods("GET")

	// Auditors
	api.HandleFunc("/auditors", server.listAuditorsHandler).Methods("GET")
	api.HandleFunc("/auditors", server.registerAuditorHandler).Methods("POST")
	api.HandleFunc("/auditors/{auditor_id}", server.getAuditorHandler).Methods("GET")
	api.HandleFunc("/auditors/{auditor_id}", server.updateAuditorHandler).Methods("PUT")
	api.HandleFunc("/auditors/{auditor_id}/workload", server.getAuditorWorkloadHandler).Methods("GET")

	// Dashboard
	api.HandleFunc("/dashboard", server.getDashboardHandler).Methods("GET")
	api.HandleFunc("/dashboard/summary", server.getDashboardSummaryHandler).Methods("GET")
	api.HandleFunc("/dashboard/alerts", server.getAlertsHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8133"
	}

	log.Printf("Internal Auditor Service starting on port %s", port)
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, x-keycloak-id, X-Auditor-ID")

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
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "internal-auditor-service"})
}

// Helper functions
func getTenantID(r *http.Request) string {
	return r.Header.Get("X-Tenant-ID")
}

func getAuditorID(r *http.Request) string {
	auditorID := r.Header.Get("X-Auditor-ID")
	if auditorID == "" {
		auditorID = "auditor-001"
	}
	return auditorID
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Plan handlers
func (s *AuditServer) listPlansHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	auditType := r.URL.Query().Get("type")
	plans := s.planService.ListPlans(tenantID, status, auditType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

func (s *AuditServer) createPlanHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var req CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	plan, err := s.planService.CreatePlan(tenantID, auditorID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, plan)
}

func (s *AuditServer) getPlanHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	planID := vars["plan_id"]
	tenantID := getTenantID(r)

	plan, err := s.planService.GetPlan(tenantID, planID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Plan not found")
		return
	}

	respondJSON(w, http.StatusOK, plan)
}

func (s *AuditServer) updatePlanHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	planID := vars["plan_id"]
	tenantID := getTenantID(r)

	var plan AuditPlan
	if err := json.NewDecoder(r.Body).Decode(&plan); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	plan.PlanID = planID
	plan.TenantID = tenantID

	if err := s.planService.UpdatePlan(&plan); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, plan)
}

func (s *AuditServer) approvePlanHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	planID := vars["plan_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	plan, err := s.planService.ApprovePlan(tenantID, planID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, plan)
}

func (s *AuditServer) startPlanHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	planID := vars["plan_id"]
	tenantID := getTenantID(r)

	plan, err := s.planService.StartPlan(tenantID, planID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, plan)
}

func (s *AuditServer) completePlanHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	planID := vars["plan_id"]
	tenantID := getTenantID(r)

	plan, err := s.planService.CompletePlan(tenantID, planID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	auditsCompletedTotal.WithLabelValues(plan.AuditType).Inc()
	respondJSON(w, http.StatusOK, plan)
}

func (s *AuditServer) getPlansByYearHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	year := vars["year"]
	tenantID := getTenantID(r)

	plans := s.planService.GetPlansByYear(tenantID, year)
	respondJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

func (s *AuditServer) getPlanSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	summary := s.planService.GetSummary(tenantID)
	respondJSON(w, http.StatusOK, summary)
}

// Engagement handlers
func (s *AuditServer) listEngagementsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	engagements := s.engagementService.ListEngagements(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"engagements": engagements})
}

func (s *AuditServer) createEngagementHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var engagement AuditEngagement
	if err := json.NewDecoder(r.Body).Decode(&engagement); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newEngagement, err := s.engagementService.CreateEngagement(tenantID, auditorID, &engagement)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newEngagement)
}

func (s *AuditServer) getEngagementHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	engagement, err := s.engagementService.GetEngagement(tenantID, engagementID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Engagement not found")
		return
	}

	respondJSON(w, http.StatusOK, engagement)
}

func (s *AuditServer) updateEngagementHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	var engagement AuditEngagement
	if err := json.NewDecoder(r.Body).Decode(&engagement); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	engagement.EngagementID = engagementID
	engagement.TenantID = tenantID

	if err := s.engagementService.UpdateEngagement(&engagement); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, engagement)
}

func (s *AuditServer) startFieldworkHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	engagement, err := s.engagementService.StartFieldwork(tenantID, engagementID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, engagement)
}

func (s *AuditServer) startReportingHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	engagement, err := s.engagementService.StartReporting(tenantID, engagementID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, engagement)
}

func (s *AuditServer) closeEngagementHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	engagement, err := s.engagementService.CloseEngagement(tenantID, engagementID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, engagement)
}

func (s *AuditServer) getEngagementControlsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	controls := s.controlTestService.GetEngagementControls(tenantID, engagementID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"controls": controls})
}

func (s *AuditServer) getEngagementFindingsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	engagementID := vars["engagement_id"]
	tenantID := getTenantID(r)

	findings := s.findingService.GetEngagementFindings(tenantID, engagementID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"findings": findings})
}

func (s *AuditServer) getActiveEngagementsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	engagements := s.engagementService.GetActiveEngagements(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"engagements": engagements})
}

// Control Test handlers
func (s *AuditServer) listControlTestsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	controls := s.controlTestService.ListControlTests(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"controls": controls})
}

func (s *AuditServer) createControlTestHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var control ControlTest
	if err := json.NewDecoder(r.Body).Decode(&control); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newControl, err := s.controlTestService.CreateControlTest(tenantID, &control)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newControl)
}

func (s *AuditServer) getControlTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)

	control, err := s.controlTestService.GetControlTest(tenantID, testID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Control test not found")
		return
	}

	respondJSON(w, http.StatusOK, control)
}

func (s *AuditServer) updateControlTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)

	var control ControlTest
	if err := json.NewDecoder(r.Body).Decode(&control); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	control.TestID = testID
	control.TenantID = tenantID

	if err := s.controlTestService.UpdateControlTest(&control); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, control)
}

func (s *AuditServer) executeControlTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var req struct {
		SampleTested    int    `json:"sampleTested"`
		ExceptionsFound int    `json:"exceptionsFound"`
		TestResult      string `json:"testResult"`
		Conclusion      string `json:"conclusion"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	control, err := s.controlTestService.ExecuteTest(tenantID, testID, auditorID, req.SampleTested, req.ExceptionsFound, req.TestResult, req.Conclusion)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	controlsTestedTotal.WithLabelValues(req.TestResult).Inc()
	respondJSON(w, http.StatusOK, control)
}

func (s *AuditServer) reviewControlTestHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID := vars["test_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	control, err := s.controlTestService.ReviewTest(tenantID, testID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, control)
}

func (s *AuditServer) getControlSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	summary := s.controlTestService.GetSummary(tenantID)
	respondJSON(w, http.StatusOK, summary)
}

// Finding handlers
func (s *AuditServer) listFindingsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	riskRating := r.URL.Query().Get("risk_rating")
	findings := s.findingService.ListFindings(tenantID, status, riskRating)
	respondJSON(w, http.StatusOK, map[string]interface{}{"findings": findings})
}

func (s *AuditServer) createFindingHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var req CreateFindingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	finding, err := s.findingService.CreateFinding(tenantID, auditorID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	findingsIdentifiedTotal.WithLabelValues(req.RiskRating).Inc()
	respondJSON(w, http.StatusCreated, finding)
}

func (s *AuditServer) getFindingHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	findingID := vars["finding_id"]
	tenantID := getTenantID(r)

	finding, err := s.findingService.GetFinding(tenantID, findingID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Finding not found")
		return
	}

	respondJSON(w, http.StatusOK, finding)
}

func (s *AuditServer) updateFindingHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	findingID := vars["finding_id"]
	tenantID := getTenantID(r)

	var finding AuditFinding
	if err := json.NewDecoder(r.Body).Decode(&finding); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	finding.FindingID = findingID
	finding.TenantID = tenantID

	if err := s.findingService.UpdateFinding(&finding); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, finding)
}

func (s *AuditServer) submitManagementResponseHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	findingID := vars["finding_id"]
	tenantID := getTenantID(r)

	var req ManagementResponseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	finding, err := s.findingService.SubmitManagementResponse(tenantID, findingID, &req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, finding)
}

func (s *AuditServer) closeFindingHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	findingID := vars["finding_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	finding, err := s.findingService.CloseFinding(tenantID, findingID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, finding)
}

func (s *AuditServer) getOpenFindingsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	findings := s.findingService.GetOpenFindings(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"findings": findings})
}

func (s *AuditServer) getOverdueFindingsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	findings := s.findingService.GetOverdueFindings(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"findings": findings})
}

func (s *AuditServer) getFindingSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	summary := s.findingService.GetSummary(tenantID)
	respondJSON(w, http.StatusOK, summary)
}

// Report handlers
func (s *AuditServer) listReportsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	reports := s.reportService.ListReports(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"reports": reports})
}

func (s *AuditServer) createReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var report AuditReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newReport, err := s.reportService.CreateReport(tenantID, auditorID, &report)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newReport)
}

func (s *AuditServer) getReportHandler(w http.ResponseWriter, r *http.Request) {
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

func (s *AuditServer) updateReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)

	var report AuditReport
	if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	report.ReportID = reportID
	report.TenantID = tenantID

	if err := s.reportService.UpdateReport(&report); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *AuditServer) reviewReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	report, err := s.reportService.ReviewReport(tenantID, reportID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *AuditServer) approveReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	report, err := s.reportService.ApproveReport(tenantID, reportID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (s *AuditServer) issueReportHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	reportID := vars["report_id"]
	tenantID := getTenantID(r)

	report, err := s.reportService.IssueReport(tenantID, reportID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, report)
}

// Follow-up handlers
func (s *AuditServer) listFollowUpsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	followUps := s.followUpService.ListFollowUps(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"followUps": followUps})
}

func (s *AuditServer) createFollowUpHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var followUp FollowUp
	if err := json.NewDecoder(r.Body).Decode(&followUp); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newFollowUp, err := s.followUpService.CreateFollowUp(tenantID, auditorID, &followUp)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newFollowUp)
}

func (s *AuditServer) getFollowUpHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	followUpID := vars["followup_id"]
	tenantID := getTenantID(r)

	followUp, err := s.followUpService.GetFollowUp(tenantID, followUpID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Follow-up not found")
		return
	}

	respondJSON(w, http.StatusOK, followUp)
}

func (s *AuditServer) updateFollowUpHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	followUpID := vars["followup_id"]
	tenantID := getTenantID(r)

	var followUp FollowUp
	if err := json.NewDecoder(r.Body).Decode(&followUp); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	followUp.FollowUpID = followUpID
	followUp.TenantID = tenantID

	if err := s.followUpService.UpdateFollowUp(&followUp); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, followUp)
}

func (s *AuditServer) getPendingFollowUpsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	followUps := s.followUpService.GetPendingFollowUps(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"followUps": followUps})
}

func (s *AuditServer) getOverdueFollowUpsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	followUps := s.followUpService.GetOverdueFollowUps(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"followUps": followUps})
}

// Risk Assessment handlers
func (s *AuditServer) listRiskAssessmentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	assessments := s.riskService.ListAssessments(tenantID, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"assessments": assessments})
}

func (s *AuditServer) createRiskAssessmentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	var assessment RiskAssessment
	if err := json.NewDecoder(r.Body).Decode(&assessment); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newAssessment, err := s.riskService.CreateAssessment(tenantID, auditorID, &assessment)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newAssessment)
}

func (s *AuditServer) getRiskAssessmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	assessmentID := vars["assessment_id"]
	tenantID := getTenantID(r)

	assessment, err := s.riskService.GetAssessment(tenantID, assessmentID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Assessment not found")
		return
	}

	respondJSON(w, http.StatusOK, assessment)
}

func (s *AuditServer) updateRiskAssessmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	assessmentID := vars["assessment_id"]
	tenantID := getTenantID(r)

	var assessment RiskAssessment
	if err := json.NewDecoder(r.Body).Decode(&assessment); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	assessment.AssessmentID = assessmentID
	assessment.TenantID = tenantID

	if err := s.riskService.UpdateAssessment(&assessment); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, assessment)
}

func (s *AuditServer) approveRiskAssessmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	assessmentID := vars["assessment_id"]
	tenantID := getTenantID(r)
	auditorID := getAuditorID(r)

	assessment, err := s.riskService.ApproveAssessment(tenantID, assessmentID, auditorID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, assessment)
}

func (s *AuditServer) getHighRiskAreasHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	assessments := s.riskService.GetHighRiskAreas(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"assessments": assessments})
}

// Auditor handlers
func (s *AuditServer) listAuditorsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	specialization := r.URL.Query().Get("specialization")
	auditors := s.auditorService.ListAuditors(tenantID, specialization)
	respondJSON(w, http.StatusOK, map[string]interface{}{"auditors": auditors})
}

func (s *AuditServer) registerAuditorHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var auditor Auditor
	if err := json.NewDecoder(r.Body).Decode(&auditor); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newAuditor, err := s.auditorService.RegisterAuditor(tenantID, &auditor)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newAuditor)
}

func (s *AuditServer) getAuditorHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auditorID := vars["auditor_id"]
	tenantID := getTenantID(r)

	auditor, err := s.auditorService.GetAuditor(tenantID, auditorID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Auditor not found")
		return
	}

	respondJSON(w, http.StatusOK, auditor)
}

func (s *AuditServer) updateAuditorHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auditorID := vars["auditor_id"]
	tenantID := getTenantID(r)

	var auditor Auditor
	if err := json.NewDecoder(r.Body).Decode(&auditor); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	auditor.AuditorID = auditorID
	auditor.TenantID = tenantID

	if err := s.auditorService.UpdateAuditor(&auditor); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, auditor)
}

func (s *AuditServer) getAuditorWorkloadHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auditorID := vars["auditor_id"]
	tenantID := getTenantID(r)

	workload := s.auditorService.GetWorkload(tenantID, auditorID)
	respondJSON(w, http.StatusOK, workload)
}

// Dashboard handlers
func (s *AuditServer) getDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *AuditServer) getDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	summary := map[string]interface{}{
		"activeEngagements": dashboard.ActiveEngagements,
		"openFindings":      dashboard.OpenFindings,
		"criticalFindings":  dashboard.CriticalFindings,
		"overdueFindings":   dashboard.OverdueFindings,
	}
	respondJSON(w, http.StatusOK, summary)
}

func (s *AuditServer) getAlertsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	alerts := s.getAlerts(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"alerts": alerts})
}

func (s *AuditServer) getDashboard(tenantID string) *AuditDashboard {
	dashboard := &AuditDashboard{
		Date: time.Now(),
	}

	// Plan summary
	planSummary := s.planService.GetSummary(tenantID)
	if total, ok := planSummary["totalPlans"].(int); ok {
		dashboard.TotalPlans = total
	}
	if inProgress, ok := planSummary["inProgress"].(int); ok {
		dashboard.PlansInProgress = inProgress
	}
	if completed, ok := planSummary["completed"].(int); ok {
		dashboard.PlansCompleted = completed
	}

	// Engagement summary
	activeEngagements := s.engagementService.GetActiveEngagements(tenantID)
	dashboard.ActiveEngagements = len(activeEngagements)

	// Finding summary
	findingSummary := s.findingService.GetSummary(tenantID)
	if open, ok := findingSummary["openFindings"].(int); ok {
		dashboard.OpenFindings = open
	}
	if critical, ok := findingSummary["criticalFindings"].(int); ok {
		dashboard.CriticalFindings = critical
	}
	if high, ok := findingSummary["highFindings"].(int); ok {
		dashboard.HighFindings = high
	}
	if overdue, ok := findingSummary["overdueFindings"].(int); ok {
		dashboard.OverdueFindings = overdue
	}

	// Control summary
	controlSummary := s.controlTestService.GetSummary(tenantID)
	if tested, ok := controlSummary["totalTested"].(int); ok {
		dashboard.ControlsTested = tested
	}
	if effective, ok := controlSummary["effectiveControls"].(int); ok {
		dashboard.EffectiveControls = effective
	}
	if effectiveness, ok := controlSummary["effectiveness"].(float64); ok {
		dashboard.ControlEffectiveness = effectiveness
	}

	// Follow-ups
	pendingFollowUps := s.followUpService.GetPendingFollowUps(tenantID)
	dashboard.PendingFollowUps = len(pendingFollowUps)
	overdueFollowUps := s.followUpService.GetOverdueFollowUps(tenantID)
	dashboard.OverdueFollowUps = len(overdueFollowUps)

	// Resources
	auditors := s.auditorService.ListAuditors(tenantID, "")
	dashboard.AuditorsAvailable = len(auditors)
	dashboard.HoursUtilized = 1200
	dashboard.HoursBudgeted = 2000

	return dashboard
}

func (s *AuditServer) getAlerts(tenantID string) []map[string]interface{} {
	var alerts []map[string]interface{}

	// Critical findings
	criticalFindings := s.findingService.ListFindings(tenantID, "open", "critical")
	if len(criticalFindings) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "critical_findings",
			"severity": "critical",
			"message":  "Critical audit findings require immediate attention",
			"count":    len(criticalFindings),
		})
	}

	// Overdue findings
	overdueFindings := s.findingService.GetOverdueFindings(tenantID)
	if len(overdueFindings) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "overdue_findings",
			"severity": "high",
			"message":  "Audit findings past target remediation date",
			"count":    len(overdueFindings),
		})
	}

	// Overdue follow-ups
	overdueFollowUps := s.followUpService.GetOverdueFollowUps(tenantID)
	if len(overdueFollowUps) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "overdue_followups",
			"severity": "medium",
			"message":  "Follow-ups past due date",
			"count":    len(overdueFollowUps),
		})
	}

	// High risk areas
	highRiskAreas := s.riskService.GetHighRiskAreas(tenantID)
	if len(highRiskAreas) > 0 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "high_risk_areas",
			"severity": "medium",
			"message":  "High risk areas requiring audit attention",
			"count":    len(highRiskAreas),
		})
	}

	return alerts
}
