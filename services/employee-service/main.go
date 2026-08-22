package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics for employee onboarding
var (
	employeeOnboardingTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "employee_onboarding_total",
			Help: "Total number of employee onboarding requests",
		},
		[]string{"status", "bank_id"},
	)

	employeeOnboardingDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "employee_onboarding_duration_seconds",
			Help:    "Duration of employee onboarding workflow",
			Buckets: prometheus.ExponentialBuckets(1, 2, 12),
		},
		[]string{"status"},
	)

	employeeWorkflowStepDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "employee_workflow_step_duration_seconds",
			Help:    "Duration of individual workflow steps",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
		},
		[]string{"step_name", "status"},
	)

	keycloakOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "employee_keycloak_operations_total",
			Help: "Total Keycloak operations for employee onboarding",
		},
		[]string{"operation", "status"},
	)

	permifyOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "employee_permify_operations_total",
			Help: "Total Permify operations for employee onboarding",
		},
		[]string{"operation", "status"},
	)

	tigerbeetleOperations = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "employee_tigerbeetle_operations_total",
			Help: "Total TigerBeetle operations for employee onboarding",
		},
		[]string{"operation", "status"},
	)

	backgroundCheckDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "employee_background_check_duration_seconds",
			Help:    "Duration of background check activity",
			Buckets: prometheus.ExponentialBuckets(60, 2, 8), // 1min to ~4hrs
		},
	)

	activeOnboardings = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "employee_onboarding_active",
			Help: "Number of active employee onboarding workflows",
		},
	)
)

// Idempotency store for employee onboarding
var (
	idempotencyStore    = make(map[string]IdempotencyRecord)
	idempotencyMutex    sync.RWMutex
	employeeKafkaClient *EmployeeKafkaClient
)

// IdempotencyRecord stores the result of an idempotent operation
type IdempotencyRecord struct {
	Key       string
	Result    interface{}
	CreatedAt time.Time
	ExpiresAt time.Time
}

// checkIdempotency checks if an operation was already performed
func checkIdempotency(key string) (interface{}, bool) {
	idempotencyMutex.RLock()
	defer idempotencyMutex.RUnlock()

	record, exists := idempotencyStore[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(record.ExpiresAt) {
		return nil, false
	}

	return record.Result, true
}

// storeIdempotency stores the result of an idempotent operation
func storeIdempotency(key string, result interface{}, ttl time.Duration) {
	idempotencyMutex.Lock()
	defer idempotencyMutex.Unlock()

	idempotencyStore[key] = IdempotencyRecord{
		Key:       key,
		Result:    result,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(ttl),
	}
}

// EmployeeService handles employee onboarding operations
type EmployeeService struct {
	db             *pgxpool.Pool
	kafkaTopicName string
}

// EmployeeOnboardingRequest represents the employee onboarding request
type EmployeeOnboardingRequest struct {
	EmployeeNumber string `json:"employee_number"`
	Email          string `json:"email"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	Phone          string `json:"phone"`
	Role           string `json:"role"`
	Department     string `json:"department"`
	HireDate       string `json:"hire_date"`
	ReportingTo    string `json:"reporting_to,omitempty"`
	BankID         string `json:"-"` // Set from header
	BranchID       string `json:"branch"`
}

// EmployeeOnboardingResponse represents the response
type EmployeeOnboardingResponse struct {
	EmployeeID          string    `json:"employee_id"`
	Status              string    `json:"status"`
	KeycloakUserID      string    `json:"keycloak_user_id,omitempty"`
	Message             string    `json:"message"`
	EstimatedCompletion time.Time `json:"estimated_completion"`
}

// Employee represents an employee record
type Employee struct {
	EmployeeID     string    `json:"employee_id"`
	BankID         string    `json:"bank_id"`
	BranchID       string    `json:"branch_id"`
	EmployeeNumber string    `json:"employee_number"`
	Email          string    `json:"email"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	Phone          string    `json:"phone"`
	Role           string    `json:"role"`
	Department     string    `json:"department"`
	Status         string    `json:"status"`
	HireDate       time.Time `json:"hire_date"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
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
	ctx := context.Background()

	godotenv.Load()

	// Initialize database connection
	// DATABASE_URI is REQUIRED — no credential-bearing default. Fail fast at startup.
	dbURL := os.Getenv("DATABASE_URI")
	if dbURL == "" {
		log.Fatalf("[employee-service] DATABASE_URI env var is required; refusing to start with default database credentials")
	}

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	employeeKafkaClient = NewEmployeeKafkaClient()
	defer employeeKafkaClient.Close()

	// Create service
	service := &EmployeeService{
		db:             db,
		kafkaTopicName: "employee-events",
	}

	// Create HTTP router
	router := mux.NewRouter()
	router.Use(auditMiddleware)
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")
	router.HandleFunc("/employees", service.onboardEmployeeHandler).Methods("POST")
	router.HandleFunc("/employees", service.listEmployeesHandler).Methods("GET")
	router.HandleFunc("/employees/{employee_id}", service.getEmployeeHandler).Methods("GET")
	router.HandleFunc("/employees/{employee_id}", service.updateEmployeeHandler).Methods("PUT")
	router.HandleFunc("/employees/{employee_id}/status", service.updateEmployeeStatusHandler).Methods("PATCH")

	// Start HTTP server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8025"
	}

	addr := ":" + port

	srv := &http.Server{
		Addr:    addr,
		Handler: jwtAuthMiddleware(router),
	}

	go func() {
		log.Printf("Employee service listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start HTTP server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	query := `
    CREATE TABLE IF NOT EXISTS employees (
        employee_id TEXT PRIMARY KEY,
        bank_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        employee_number TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        hire_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Enable RLS
	ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

	-- Policy: only allow rows where bank_id matches the session context
	DO $$
	BEGIN
		IF NOT EXISTS (
			SELECT 1
			FROM pg_policies
			WHERE schemaname = 'public'
			AND tablename = 'employees'
			AND policyname = 'bank_rls'
		) THEN
			CREATE POLICY bank_rls ON employees
			USING (bank_id = current_setting('app.current_bank_id')::text);
		END IF;
	END$$;
    `

	_, err := db.Exec(ctx, query)
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

// healthHandler handles health check requests
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

// onboardEmployeeHandler handles employee onboarding requests
func (s *EmployeeService) onboardEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	startTime := time.Now()

	// Parse request body
	var req EmployeeOnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Extract tenant context from headers
	tenantID := r.Header.Get("x-tenant-id")
	keycloakID := r.Header.Get("X-Keycloak-ID")
	branchID := req.BranchID

	if tenantID == "" {
		tenantID = r.URL.Query().Get("tenantId")
	}

	if branchID == "" {
		http.Error(w, "branch is required in payload", http.StatusBadRequest)
		return
	}

	if tenantID == "" {
		http.Error(w, "Missing tenant context headers", http.StatusBadRequest)
		return
	}

	// Check idempotency key from header
	idempotencyKey := r.Header.Get("X-Idempotency-Key")
	if idempotencyKey != "" {
		if result, exists := checkIdempotency(idempotencyKey); exists {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Idempotent-Replay", "true")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(result)
			return
		}
	}

	req.BankID = tenantID

	// Set PostgreSQL session context for RLS
	if err := s.setSessionContext(ctx, tenantID, branchID, keycloakID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set session context: %v", err), http.StatusInternalServerError)
		return
	}

	// Validate employee information
	if err := s.validateEmployeeInformation(ctx, &req); err != nil {
		employeeOnboardingTotal.WithLabelValues("validation_failed", tenantID).Inc()
		http.Error(w, fmt.Sprintf("Validation failed: %v", err), http.StatusBadRequest)
		return
	}

	// Generate employee ID
	// employeeID := fmt.Sprintf("emp-%s-%s-%s",
	// 	tenantID,
	// 	branchID,
	// 	uuid.NewString(),
	// )

	employeeID := uuid.NewString()

	// Increment active onboardings gauge
	activeOnboardings.Inc()

	// Start Temporal workflow
	workflowID := fmt.Sprintf("employee-onboarding-workflow-%s", employeeID)

	// Store initial employee record with pending status
	if err := s.createEmployeeRecord(ctx, employeeID, &req, "pending"); err != nil {
		log.Printf("Warning: Failed to create employee record: %v", err)
		// Continue anyway as workflow will create it
	}

	// Publish event to Kafka (strongly-typed)
	event := EmployeeEvent{
		Type:      "employee.onboarding.started",
		EntityID:  employeeID,
		TenantID:  tenantID,
		Status:    "pending",
		Timestamp: time.Now().UTC(),
		Metadata: map[string]interface{}{
			"bank_id":      tenantID,
			"branch_id":    branchID,
			"workflow_id":  workflowID,
			"initiated_by": keycloakID,
		},
	}
	employeeKafkaClient.PublishEvent("employee.onboarding.started", event)

	// Record metrics
	employeeOnboardingTotal.WithLabelValues("started", tenantID).Inc()
	employeeOnboardingDuration.WithLabelValues("started").Observe(time.Since(startTime).Seconds())

	// Return response
	response := EmployeeOnboardingResponse{
		EmployeeID:          employeeID,
		Status:              "in_progress",
		Message:             "Employee onboarding workflow started",
		EstimatedCompletion: time.Now().Add(30 * time.Minute),
	}

	// Store idempotency record if key was provided
	if idempotencyKey != "" {
		storeIdempotency(idempotencyKey, response, 24*time.Hour)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// listEmployeesHandler handles listing employees
func (s *EmployeeService) listEmployeesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract tenant context from headers
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.Header.Get("x-tenant-id")
	}
	branchID := r.Header.Get("X-Branch-ID")
	if branchID == "" {
		branchID = r.Header.Get("x-branch-id")
	}
	keycloakID := r.Header.Get("X-Keycloak-ID")

	// Branch ID is optional for read operations; tenant ID is required
	if tenantID == "" {
		http.Error(w, "Missing tenant context headers", http.StatusBadRequest)
		return
	}
	if branchID == "" {
		branchID = "default"
	}

	// Set PostgreSQL session context for RLS
	if err := s.setSessionContext(ctx, tenantID, branchID, keycloakID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set session context: %v", err), http.StatusInternalServerError)
		return
	}

	// Parse pagination query params
	page := 1
	limit := 10
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if v, err := strconv.Atoi(pageStr); err == nil {
			page = v
		}
	}
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil {
			limit = v
		}
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	// COUNT query (RLS automatically filters by bank_id and branch_id)
	var total int
	if err := s.db.QueryRow(ctx, "SELECT COUNT(*) FROM employees").Scan(&total); err != nil {
		http.Error(w, fmt.Sprintf("Failed to count employees: %v", err), http.StatusInternalServerError)
		return
	}

	// Query database (RLS automatically filters by bank_id and branch_id)
	query := `
		SELECT employee_id, bank_id, branch_id, employee_number, email,
		       first_name, last_name, phone, role, department, status,
		       hire_date, created_at, updated_at
		FROM employees
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := s.db.Query(ctx, query, limit, (page-1)*limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query employees: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var employees []Employee
	for rows.Next() {
		var emp Employee
		if err := rows.Scan(
			&emp.EmployeeID, &emp.BankID, &emp.BranchID, &emp.EmployeeNumber,
			&emp.Email, &emp.FirstName, &emp.LastName, &emp.Phone,
			&emp.Role, &emp.Department, &emp.Status, &emp.HireDate,
			&emp.CreatedAt, &emp.UpdatedAt,
		); err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan employee: %v", err), http.StatusInternalServerError)
			return
		}
		employees = append(employees, emp)
	}

	// Prepare response
	response := map[string]interface{}{
		"employees": employees,
		"total":     total,
		"page":      page,
		"page_size": limit,
	}

	responseJSON, err := json.Marshal(response)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal response: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(http.StatusOK)
	w.Write(responseJSON)
}

// getEmployeeHandler handles getting a single employee
func (s *EmployeeService) getEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	employeeID := vars["employee_id"]

	// Extract tenant context from headers
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.Header.Get("x-tenant-id")
	}
	branchID := r.Header.Get("X-Branch-ID")
	if branchID == "" {
		branchID = r.Header.Get("x-branch-id")
	}
	keycloakID := r.Header.Get("X-Keycloak-ID")

	if tenantID == "" {
		http.Error(w, "Missing tenant context headers", http.StatusBadRequest)
		return
	}
	if branchID == "" {
		branchID = "default"
	}

	// Set PostgreSQL session context for RLS
	if err := s.setSessionContext(ctx, tenantID, branchID, keycloakID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set session context: %v", err), http.StatusInternalServerError)
		return
	}

	// Query database (RLS automatically filters)
	query := `
		SELECT employee_id, bank_id, branch_id, employee_number, email, 
		       first_name, last_name, phone, role, department, status, 
		       hire_date, created_at, updated_at
		FROM employees
		WHERE employee_id = $1
	`

	var emp Employee
	err := s.db.QueryRow(ctx, query, employeeID).Scan(
		&emp.EmployeeID, &emp.BankID, &emp.BranchID, &emp.EmployeeNumber,
		&emp.Email, &emp.FirstName, &emp.LastName, &emp.Phone,
		&emp.Role, &emp.Department, &emp.Status, &emp.HireDate,
		&emp.CreatedAt, &emp.UpdatedAt,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Employee not found: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(emp)
}

// UpdateEmployeeRequest represents the update request
type UpdateEmployeeRequest struct {
	FirstName   *string `json:"first_name,omitempty"`
	LastName    *string `json:"last_name,omitempty"`
	Phone       *string `json:"phone,omitempty"`
	Role        *string `json:"role,omitempty"`
	Department  *string `json:"department,omitempty"`
	ReportingTo *string `json:"reporting_to,omitempty"`
}

// updateEmployeeHandler handles updating employee information
func (s *EmployeeService) updateEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	employeeID := vars["employee_id"]

	// Extract tenant context from headers
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.Header.Get("x-tenant-id")
	}
	branchID := r.Header.Get("X-Branch-ID")
	if branchID == "" {
		branchID = r.Header.Get("x-branch-id")
	}
	keycloakID := r.Header.Get("X-Keycloak-ID")

	if tenantID == "" {
		http.Error(w, "Missing tenant context headers", http.StatusBadRequest)
		return
	}
	if branchID == "" {
		branchID = "default"
	}

	// Set PostgreSQL session context for RLS
	if err := s.setSessionContext(ctx, tenantID, branchID, keycloakID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set session context: %v", err), http.StatusInternalServerError)
		return
	}

	// Parse request body
	var req UpdateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Build dynamic UPDATE query based on provided fields
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIndex := 1

	if req.FirstName != nil {
		setClauses = append(setClauses, fmt.Sprintf("first_name = $%d", argIndex))
		args = append(args, *req.FirstName)
		argIndex++
	}
	if req.LastName != nil {
		setClauses = append(setClauses, fmt.Sprintf("last_name = $%d", argIndex))
		args = append(args, *req.LastName)
		argIndex++
	}
	if req.Phone != nil {
		setClauses = append(setClauses, fmt.Sprintf("phone = $%d", argIndex))
		args = append(args, *req.Phone)
		argIndex++
	}
	if req.Role != nil {
		// Validate role
		validRoles := map[string]bool{
			"teller": true, "loan_officer": true, "branch_manager": true,
			"bank_admin": true, "compliance": true, "auditor": true,
		}
		if !validRoles[*req.Role] {
			http.Error(w, fmt.Sprintf("Invalid role: %s", *req.Role), http.StatusBadRequest)
			return
		}
		setClauses = append(setClauses, fmt.Sprintf("role = $%d", argIndex))
		args = append(args, *req.Role)
		argIndex++
	}
	if req.Department != nil {
		setClauses = append(setClauses, fmt.Sprintf("department = $%d", argIndex))
		args = append(args, *req.Department)
		argIndex++
	}

	// Add employee_id as the last argument
	args = append(args, employeeID)

	// Build and execute UPDATE query with RETURNING
	query := fmt.Sprintf(`
		UPDATE employees SET %s
		WHERE employee_id = $%d
		RETURNING employee_id, bank_id, branch_id, employee_number, email,
		          first_name, last_name, phone, role, department, status,
		          hire_date, created_at, updated_at
	`, strings.Join(setClauses, ", "), argIndex)

	var emp Employee
	err := s.db.QueryRow(ctx, query, args...).Scan(
		&emp.EmployeeID, &emp.BankID, &emp.BranchID, &emp.EmployeeNumber,
		&emp.Email, &emp.FirstName, &emp.LastName, &emp.Phone,
		&emp.Role, &emp.Department, &emp.Status, &emp.HireDate,
		&emp.CreatedAt, &emp.UpdatedAt,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Employee not found or update failed: %v", err), http.StatusNotFound)
		return
	}

	// Publish event
	event := map[string]interface{}{
		"event_type":  "employee.updated",
		"employee_id": employeeID,
		"bank_id":     tenantID,
		"branch_id":   branchID,
		"updated_by":  keycloakID,
		"timestamp":   time.Now().UTC(),
	}
	if err := s.publishEvent(ctx, "employee-events", event); err != nil {
		log.Printf("Warning: Failed to publish event: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(emp)
}

// UpdateStatusRequest represents the status update request
type UpdateStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

// updateEmployeeStatusHandler handles updating employee status
func (s *EmployeeService) updateEmployeeStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	employeeID := vars["employee_id"]

	// Extract tenant context from headers
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.Header.Get("x-tenant-id")
	}
	branchID := r.Header.Get("X-Branch-ID")
	if branchID == "" {
		branchID = r.Header.Get("x-branch-id")
	}
	keycloakID := r.Header.Get("X-Keycloak-ID")

	if tenantID == "" {
		http.Error(w, "Missing tenant context headers", http.StatusBadRequest)
		return
	}
	if branchID == "" {
		branchID = "default"
	}

	// Set PostgreSQL session context for RLS
	if err := s.setSessionContext(ctx, tenantID, branchID, keycloakID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to set session context: %v", err), http.StatusInternalServerError)
		return
	}

	// Parse request body
	var req UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		"pending":    true,
		"active":     true,
		"inactive":   true,
		"suspended":  true,
		"terminated": true,
		"retired":    true,
	}
	if !validStatuses[req.Status] {
		http.Error(w, fmt.Sprintf("Invalid status: %s. Valid values: pending, active, inactive, suspended, terminated, retired", req.Status), http.StatusBadRequest)
		return
	}

	// Update employee status
	query := `
		UPDATE employees 
		SET status = $1, updated_at = NOW()
		WHERE employee_id = $2
		RETURNING employee_id, bank_id, branch_id, employee_number, email,
		          first_name, last_name, phone, role, department, status,
		          hire_date, created_at, updated_at
	`

	var emp Employee
	err := s.db.QueryRow(ctx, query, req.Status, employeeID).Scan(
		&emp.EmployeeID, &emp.BankID, &emp.BranchID, &emp.EmployeeNumber,
		&emp.Email, &emp.FirstName, &emp.LastName, &emp.Phone,
		&emp.Role, &emp.Department, &emp.Status, &emp.HireDate,
		&emp.CreatedAt, &emp.UpdatedAt,
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Employee not found or update failed: %v", err), http.StatusNotFound)
		return
	}

	// Publish status change event
	event := map[string]interface{}{
		"event_type":  "employee.status.changed",
		"employee_id": employeeID,
		"bank_id":     tenantID,
		"branch_id":   branchID,
		"new_status":  req.Status,
		"reason":      req.Reason,
		"changed_by":  keycloakID,
		"timestamp":   time.Now().UTC(),
	}
	if err := s.publishEvent(ctx, "employee-events", event); err != nil {
		log.Printf("Warning: Failed to publish event: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(emp)
}

// handleEmployeeEvent handles employee events from Kafka
func (s *EmployeeService) handleEmployeeEvent(ctx context.Context) (retry bool, err error) {
	// TODO
	return false, nil
}

// sessionContextIDPattern allowlists identifiers that may be written into the
// PostgreSQL RLS session context (bank/branch/user IDs). It covers both UUIDs
// and slug-style tenant IDs such as "54bank-platform-prod".
var sessionContextIDPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// setSessionContext sets PostgreSQL session context for RLS.
//
// Values are validated against an allowlist AND bound via set_config(..., $1)
// parameters: pgx's simple protocol would otherwise allow stacked-query
// injection through a string-built SET statement.
func (s *EmployeeService) setSessionContext(ctx context.Context, tenantID, branchID, keycloakID string) error {
	for name, v := range map[string]string{"tenant": tenantID, "branch": branchID, "keycloak": keycloakID} {
		if v != "" && !sessionContextIDPattern.MatchString(v) {
			return fmt.Errorf("invalid %s identifier for session context", name)
		}
	}

	if _, err := s.db.Exec(ctx, "SELECT set_config('app.current_bank_id', $1, false)", tenantID); err != nil {
		return err
	}

	if _, err := s.db.Exec(ctx, "SELECT set_config('app.current_branch_id', $1, false)", branchID); err != nil {
		return err
	}

	if _, err := s.db.Exec(ctx, "SELECT set_config('app.current_user_id', $1, false)", keycloakID); err != nil {
		return err
	}

	return nil
}

// validateEmployeeInformation validates employee information
func (s *EmployeeService) validateEmployeeInformation(ctx context.Context, req *EmployeeOnboardingRequest) error {
	// Check if employee number already exists
	var count int
	err := s.db.QueryRow(ctx, "SELECT COUNT(*) FROM employees WHERE employee_number = $1 AND bank_id = $2", req.EmployeeNumber, req.BankID).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check employee number: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("employee number already exists")
	}

	// Check if email already exists
	err = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM employees WHERE email = $1 AND bank_id = $2", req.Email, req.BankID).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check email: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("email already exists")
	}

	// Validate role
	validRoles := map[string]bool{
		"teller":         true,
		"loan_officer":   true,
		"branch_manager": true,
		"bank_admin":     true,
		"compliance":     true,
		"auditor":        true,
	}
	if !validRoles[req.Role] {
		return fmt.Errorf("invalid role: %s", req.Role)
	}

	return nil
}

// createEmployeeRecord creates an employee record in the database
func (s *EmployeeService) createEmployeeRecord(ctx context.Context, employeeID string, req *EmployeeOnboardingRequest, status string) error {
	if req.HireDate == "" {
		req.HireDate = time.Now().Format(time.DateOnly)
	}
	hireDate, err := time.Parse("2006-01-02", req.HireDate)
	if err != nil {
		return fmt.Errorf("invalid hire date format: %w", err)
	}

	query := `
		INSERT INTO employees (
			employee_id, bank_id, branch_id, employee_number, email,
			first_name, last_name, phone, role, department, status,
			hire_date, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, NOW(), NOW()
		)
	`

	_, err = s.db.Exec(ctx, query,
		employeeID,
		req.BankID,
		req.BranchID,
		req.EmployeeNumber,
		req.Email,
		req.FirstName,
		req.LastName,
		req.Phone,
		req.Role,
		req.Department,
		status,
		hireDate,
	)

	return err
}

// publishEvent publishes an event to Kafka via Dapr
func (s *EmployeeService) publishEvent(ctx context.Context, topic string, event map[string]interface{}) error {
	// Deprecated: use employeeKafkaClient.PublishEvent instead
	return nil
}
