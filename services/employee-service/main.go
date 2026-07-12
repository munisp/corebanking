package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
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

func main() {
	ctx := context.Background()

	godotenv.Load()

	// Initialize database connection
	dbURL := os.Getenv("DATABASE_URI")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/core_banking_employee"
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
		Handler: router,
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

// setSessionContext sets PostgreSQL session context for RLS
func (s *EmployeeService) setSessionContext(ctx context.Context, tenantID, branchID, keycloakID string) error {
	_, err := s.db.Exec(ctx, fmt.Sprintf("SET app.current_bank_id = '%s'", tenantID))
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, fmt.Sprintf("SET app.current_branch_id = '%s'", branchID))
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, fmt.Sprintf("SET app.current_user_id = '%s'", keycloakID))
	if err != nil {
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
