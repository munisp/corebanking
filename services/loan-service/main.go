package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var (
	db              *sql.DB
	engine          *CreditDecisionEngine
	loanKafkaClient *LoanKafkaClient
	coaClient       *CoAClient
)

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware() gin.HandlerFunc {
	ensureJWKSRefresh()
	return func(c *gin.Context) {
		r := c.Request
		p := r.URL.Path
		if isProbePath(p) {
			c.Next()
			return
		}
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token format"})
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		if header.Alg != "RS256" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unsupported token algorithm"})
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
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown signing key"})
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature encoding"})
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims encoding"})
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token missing exp claim"})
			return
		}
		if time.Now().Unix() >= int64(exp) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
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
		c.Set("jwt_claims", claims)
		c.Next()
	}
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
	// DEPRECATED: loan-service is superseded by loan-origination-go (platform canonical).
	// This service will be decommissioned after loan-origination-go reaches feature parity
	// with the affordability-check and loan-comparison endpoints in loan_calculator.go.
	log.Println("WARNING: loan-service is DEPRECATED — migrate to loan-origination-go")
	godotenv.Load()

	if err := initDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	engine = NewCreditDecisionEngine()
	coaClient = NewCoAClient()

	// Initialize Kafka client if Kafka brokers are configured
	kafkaBrokers := os.Getenv("KAFKA_BROKERS")
	if kafkaBrokers != "" {
		loanKafkaClient = NewLoanKafkaClient()
		log.Printf("Kafka client initialized with brokers: %s", kafkaBrokers)
	} else {
		log.Printf("WARNING: Kafka client not initialized - KAFKA_BROKERS not set")
	}

	router := gin.Default()
	router.Use(jwtAuthMiddleware())
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	router.Use(auditMiddleware())

	registerRoutes(router)

	var addr = ":" + GetEnv("PORT", "8011")

	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	log.Printf("Loan service started on %s", addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func createTables() error {
	schema := `
		-- Loan Applications Table
		CREATE TABLE IF NOT EXISTS loan_applications (
			id SERIAL PRIMARY KEY,
			loan_application_id VARCHAR(50) UNIQUE NOT NULL,
			tenant_id VARCHAR(50) NOT NULL,
			applicant_id VARCHAR(50) NOT NULL,
			loan_amount NUMERIC(15, 2) NOT NULL,
			loan_purpose TEXT NOT NULL,
			loan_type VARCHAR(50) NOT NULL DEFAULT 'general',
			requested_term INT NOT NULL,
			monthly_income NUMERIC(15, 2) NOT NULL,
			existing_debt NUMERIC(15, 2),
			collateral_value NUMERIC(15, 2),
			credit_score INT,
			employment_status TEXT,
			employment_duration INT,
			bank_statement_score NUMERIC(5, 2),
			bvn_verified BOOLEAN DEFAULT FALSE,
			nin_verified BOOLEAN DEFAULT FALSE,
			interest_rate_percent NUMERIC(15, 2) NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			loan_started_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		-- Index on id & tenant_id (composite)
		CREATE INDEX IF NOT EXISTS idx_loan_id_tenant ON loan_applications (id, tenant_id);

		-- Index on tenant_id & applicant_id (composite)
		CREATE INDEX IF NOT EXISTS idx_loan_tenant_applicant ON loan_applications (tenant_id, applicant_id);

		--------------------------------------------------------------------------------
		-- Loan Payments Table
		CREATE TABLE IF NOT EXISTS loan_payments (
			id SERIAL PRIMARY KEY,
			loan_payment_id VARCHAR(50) UNIQUE NOT NULL,
			loan_application_id VARCHAR(50) NOT NULL REFERENCES loan_applications(loan_application_id) ON DELETE CASCADE,
			tenant_id VARCHAR(50) NOT NULL,
			transaction_id VARCHAR(100) UNIQUE NOT NULL,
			amount NUMERIC(15, 2) NOT NULL,
			payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			payment_method TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		-- Index for fast queries on tenant + loan
		CREATE INDEX IF NOT EXISTS idx_payment_tenant_loan ON loan_payments (tenant_id, loan_application_id);

		-- Index for transaction lookups
		CREATE INDEX IF NOT EXISTS idx_payment_transaction ON loan_payments (transaction_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	// Idempotent column addition for existing deployments
	_, _ = db.Exec(`ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_type VARCHAR(50) NOT NULL DEFAULT 'general'`)

	log.Println("Loan database tables created/verified")
	return nil
}

func initDatabase() error {
	connStr := GetEnv("DATABASE_URI", "")

	if connStr == "" {
		log.Fatal("Failed to connect to database: connection string is empty")
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Loan database connection established")

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func registerRoutes(router *gin.Engine) {
	router.GET("/health", healthCheck)

	api := router.Group("/api/v1/loans")
	{
		api.POST("/applications", createLoanApplication)
		api.GET("/applications/administration", getAllLoanApplications)
		api.GET("/applications/:id", getLoanApplication)
		api.GET("/applications", getLoanApplications)
		api.POST("/applications/:id/evaluate", evaluateLoanApplication)
		api.POST("/applications/:id/approve", approveLoanApplication)
		api.POST("/applications/:id/decline", declineLoanApplication)
		api.POST("/:id/disburse", disburseLoan)
		api.GET("/:id/schedule", getRepaymentSchedule)
		api.POST("/:id/record-payment", recordPayment)
	}
	registerCalculatorRoutes(api)

	interbank := router.Group("/api/v1/interbank")
	{
		interbank.GET("/loans", interbankLoansHandler)
		interbank.GET("/loans/:id", interbankLoanDetailHandler)
		interbank.POST("/loans", interbankCreateLoanHandler)
	}
}

func interbankLoansHandler(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS interbank_loans (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		counterparty VARCHAR(255),
		direction VARCHAR(16),
		amount NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		rate NUMERIC(6,4),
		start_date DATE,
		maturity_date DATE,
		status VARCHAR(32) DEFAULT 'active',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
	if err != nil {
		log.Printf("interbank table init: %v", err)
	}
	rows, err := db.QueryContext(c.Request.Context(), `
		SELECT id, COALESCE(counterparty,''), COALESCE(direction,'placement'),
		       COALESCE(amount,0), COALESCE(currency,'NGN'), COALESCE(rate,0),
		       TO_CHAR(start_date,'YYYY-MM-DD'), TO_CHAR(maturity_date,'YYYY-MM-DD'), status
		FROM interbank_loans WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	type Loan struct {
		ID           string  `json:"id"`
		Counterparty string  `json:"counterparty"`
		Direction    string  `json:"direction"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
		Rate         float64 `json:"rate"`
		StartDate    string  `json:"start_date"`
		MaturityDate string  `json:"maturity_date"`
		Status       string  `json:"status"`
	}
	items := make([]Loan, 0)
	for rows.Next() {
		var l Loan
		rows.Scan(&l.ID, &l.Counterparty, &l.Direction, &l.Amount, &l.Currency,
			&l.Rate, &l.StartDate, &l.MaturityDate, &l.Status)
		items = append(items, l)
	}
	c.JSON(200, gin.H{"loans": items, "total": len(items)})
}

func interbankLoanDetailHandler(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")
	type Loan struct {
		ID           string  `json:"id"`
		Counterparty string  `json:"counterparty"`
		Direction    string  `json:"direction"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
		Rate         float64 `json:"rate"`
		StartDate    string  `json:"start_date"`
		MaturityDate string  `json:"maturity_date"`
		Status       string  `json:"status"`
	}
	var l Loan
	err := db.QueryRowContext(c.Request.Context(), `
		SELECT id, COALESCE(counterparty,''), COALESCE(direction,'placement'),
		       COALESCE(amount,0), COALESCE(currency,'NGN'), COALESCE(rate,0),
		       TO_CHAR(start_date,'YYYY-MM-DD'), TO_CHAR(maturity_date,'YYYY-MM-DD'), status
		FROM interbank_loans WHERE id=$1 AND tenant_id=$2`, id, tenantID).
		Scan(&l.ID, &l.Counterparty, &l.Direction, &l.Amount, &l.Currency,
			&l.Rate, &l.StartDate, &l.MaturityDate, &l.Status)
	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "loan not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, l)
}

func interbankCreateLoanHandler(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "invalid body"})
		return
	}
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	counterparty, _ := body["counterparty"].(string)
	direction, _ := body["direction"].(string)
	amount, _ := body["amount"].(float64)
	currency, _ := body["currency"].(string)
	if currency == "" {
		currency = "NGN"
	}
	rate, _ := body["rate"].(float64)
	_, err := db.ExecContext(c.Request.Context(), `
		INSERT INTO interbank_loans (id, tenant_id, counterparty, direction, amount, currency, rate, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'active')`,
		id, tenantID, counterparty, direction, amount, currency, rate)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("create failed: %v", err)})
		return
	}
	body["id"] = id
	body["status"] = "active"
	c.JSON(201, body)
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "loan-service", "version": "0.0.1"})
}

func createLoanApplication(c *gin.Context) {
	var application LoanApplication
	if err := c.ShouldBindJSON(&application); err != nil {
		SendErrorGin(c, "validation_failed", err.Error(), 400)
		return
	}

	application.TenantID = c.GetHeader("X-Tenant-ID")
	application.ApplicantID = c.GetHeader("X-Keycloak-ID")
	application.LoanApplicationID = generateID("LOAN")
	application.LoanInterestRatePercent = CalculateInterestRate(application.LoanAmount)

	if application.LoanType == "" {
		application.LoanType = "general"
	}

	query := `
		INSERT INTO loan_applications (loan_application_id, tenant_id, applicant_id, loan_amount, loan_purpose, loan_type,
			requested_term, monthly_income, existing_debt, collateral_value, credit_score,
			employment_status, employment_duration, bank_statement_score, bvn_verified, nin_verified, interest_rate_percent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id
	`

	err := db.QueryRow(query, application.LoanApplicationID, application.TenantID, application.ApplicantID, application.LoanAmount, application.LoanPurpose, application.LoanType,
		application.RequestedTerm, application.MonthlyIncome, application.ExistingDebt, application.CollateralValue, application.CreditScore,
		application.EmploymentStatus, application.EmploymentDuration, application.BankStatementScore, application.BVNVerified, application.NINVerified, application.LoanInterestRatePercent).Scan(&application.ID)

	if err != nil {
		log.Println("Insert error:", err)
		SendErrorGin(c, "internal_error", "Failed to create loan application", 500)
		return
	}

	// Publish event to Kafka
	event := LoanEvent{
		Type:      "loan.application.created",
		EntityID:  application.LoanApplicationID,
		TenantID:  application.TenantID,
		Status:    "pending",
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"applicant_id":      application.ApplicantID,
			"loan_amount":       application.LoanAmount,
			"loan_purpose":      application.LoanPurpose,
			"requested_term":    application.RequestedTerm,
			"credit_score":      application.CreditScore,
			"employment_status": application.EmploymentStatus,
		},
	}

	// Publish event to Kafka if client is available
	if loanKafkaClient != nil {
		loanKafkaClient.PublishEvent("loan.application.created", event)
	}

	c.JSON(201, application)
}

func getAllLoanApplications(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	if tenantID == "" {
		SendErrorGin(c, "bad_request", "Missing X-Tenant-ID header", 400)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	var total int
	err := db.QueryRow("SELECT COUNT(*) FROM loan_applications WHERE tenant_id = $1", tenantID).Scan(&total)
	if err != nil {
		SendErrorGin(c, "internal_error", "Database count query failed", 500)
		return
	}

	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, COALESCE(loan_type, 'general'), requested_term,
		       monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
		       COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
		       bvn_verified, nin_verified, status, interest_rate_percent, loan_started_at
		FROM loan_applications
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, tenantID, limit, (page-1)*limit)
	if err != nil {
		SendErrorGin(c, "internal_error", "Database query failed", 500)
		return
	}
	defer rows.Close()

	apps := []LoanApplication{}

	for rows.Next() {
		var app LoanApplication
		if err := rows.Scan(
			&app.ID,
			&app.TenantID,
			&app.ApplicantID,
			&app.LoanApplicationID,
			&app.LoanAmount,
			&app.LoanPurpose,
			&app.LoanType,
			&app.RequestedTerm,
			&app.MonthlyIncome,
			&app.ExistingDebt,
			&app.CollateralValue,
			&app.CreditScore,
			&app.EmploymentStatus,
			&app.EmploymentDuration,
			&app.BankStatementScore,
			&app.BVNVerified,
			&app.NINVerified,
			&app.Status,
			&app.LoanInterestRatePercent,
			&app.LoanStartedAt,
		); err != nil {
			SendErrorGin(c, "internal_error", "Failed to scan loan data", 500)
			return
		}
		apps = append(apps, app)
	}

	c.JSON(200, gin.H{"data": apps, "total": total, "page": page, "limit": limit})
}

func getLoanApplications(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	keycloakID := c.GetHeader("X-Keycloak-ID")

	if tenantID == "" || keycloakID == "" {
		SendErrorGin(c, "bad_request", "Missing required headers", 400)
		return
	}

	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, COALESCE(loan_type, 'general'), requested_term,
		       monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
		       COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
		       bvn_verified, nin_verified, status, interest_rate_percent, loan_started_at
		FROM loan_applications
		WHERE applicant_id = $1 AND tenant_id = $2
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query, keycloakID, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Database query failed", 500)
		return
	}
	defer rows.Close()

	apps := []LoanApplication{}

	for rows.Next() {
		var app LoanApplication
		if err := rows.Scan(
			&app.ID,
			&app.TenantID,
			&app.ApplicantID,
			&app.LoanApplicationID,
			&app.LoanAmount,
			&app.LoanPurpose,
			&app.LoanType,
			&app.RequestedTerm,
			&app.MonthlyIncome,
			&app.ExistingDebt,
			&app.CollateralValue,
			&app.CreditScore,
			&app.EmploymentStatus,
			&app.EmploymentDuration,
			&app.BankStatementScore,
			&app.BVNVerified,
			&app.NINVerified,
			&app.Status,
			&app.LoanInterestRatePercent,
			&app.LoanStartedAt,
		); err != nil {
			SendErrorGin(c, "internal_error", "Failed to scan loan data", 500)
			return
		}
		apps = append(apps, app)
	}

	c.JSON(200, apps)
}

func getLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var app LoanApplication
	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified, status, interest_rate_percent, loan_started_at
		FROM loan_applications
		WHERE loan_application_id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified, &app.Status, &app.LoanInterestRatePercent,
		&app.LoanStartedAt,
	)

	if err != nil {
		SendErrorGin(c, "not_found", "Loan Application not found", 404)
		return
	}

	var totalPaid float64
	err = db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) 
		FROM loan_payments 
		WHERE loan_application_id = $1 AND tenant_id = $2
	`, app.LoanApplicationID, tenantID).Scan(&totalPaid)

	if err != nil {
		log.Println("Failed to fetch total payments:", err)
		SendErrorGin(c, "internal_error", "Failed to fetch payment total", 500)
		return
	}

	log.Printf("Total Amount Paid: %f", totalPaid)

	app.ExistingDebt = app.ExistingDebt + app.LoanAmount + (app.LoanAmount * app.LoanInterestRatePercent / 100) - totalPaid

	// Fetch all payments
	paymentsQuery := `
		SELECT id, loan_payment_id, loan_application_id, tenant_id, transaction_id, amount, payment_date, payment_method
		FROM loan_payments
		WHERE loan_application_id = $1 AND tenant_id = $2
		ORDER BY payment_date DESC
	`

	rows, err := db.Query(paymentsQuery, app.LoanApplicationID, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to fetch payments", 500)
		return
	}
	defer rows.Close()

	var payments []LoanPayment
	for rows.Next() {
		var p LoanPayment
		if err := rows.Scan(&p.ID, &p.LoanPaymentID, &p.LoanApplicationID, &p.TenantID, &p.TransactionID, &p.Amount, &p.PaymentDate, &p.PaymentMethod); err != nil {
			log.Println("Error scanning payment:", err)
			continue
		}
		payments = append(payments, p)
	}

	app.Payments = payments

	c.JSON(200, app)
}

func evaluateLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var app LoanApplication
	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified
		FROM loan_applications
		WHERE loan_application_id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified,
	)

	if err != nil {
		SendErrorGin(c, "not_found", "Application not found", 404)
		return
	}

	decision := engine.EvaluateLoanApplication(&app)

	c.JSON(200, decision)
}

func approveLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `UPDATE loan_applications SET status = 'approved' WHERE loan_application_id = $1 AND tenant_id = $2`
	_, err := db.Exec(query, id, tenantID)

	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to approve application", 500)
		return
	}

	c.JSON(200, gin.H{"status": "approved"})
}

func declineLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := `UPDATE loan_applications SET status = 'declined' WHERE loan_application_id = $1 AND tenant_id = $2`
	_, err := db.Exec(query, id, tenantID)

	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to decline application", 500)
		return
	}

	c.JSON(200, gin.H{"status": "declined"})
}

func disburseLoan(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")
	keycloakID := c.GetHeader("X-Keycloak-ID")
	ledgerID := c.GetHeader("X-Ledger-ID")
	mintAccountID := c.GetHeader("X-Mint-Account-ID")

	var app LoanApplication
	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified, status
		FROM loan_applications
		WHERE loan_application_id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified, &app.Status,
	)

	if app.Status == "disbursed" {
		SendErrorGin(c, "already_exists", "Loan already disbursed", 400)
		return
	}

	if app.Status != "approved" {
		SendErrorGin(c, "bad_request", "Loan must be approved first", 400)
		return
	}

	if err != nil {
		SendErrorGin(c, "not_found", "Invalid Loan Application", 404)
		return
	}

	var AmountString = strconv.FormatFloat(app.LoanAmount, 'f', 2, 64)

	// Deposit loan value into user account
	_, err = Payment(&PaymentStruct{
		Recipient:     app.ApplicantID,
		Amount:        AmountString,
		Note:          "LOAN_DISBURSEMENT/" + AmountString,
		TenantID:      tenantID,
		KeycloakID:    keycloakID,
		LedgerID:      ledgerID,
		MintAccountID: mintAccountID,
	})

	if err != nil {
		SendErrorGin(c, "internal_error", "Payment processing failed", 500)
		return
	}

	updateQuery := `
		UPDATE loan_applications
		SET status = 'disbursed', loan_started_at = $1
		WHERE loan_application_id = $2 AND tenant_id = $3
	`
	_, err = db.Exec(updateQuery, time.Now(), id, tenantID)

	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to disburse loan", 500)
		return
	}

	amountInKobo := int64(app.LoanAmount * 100)
	coaClient.RecordLoanDisbursement(tenantID, c.GetHeader("X-Keycloak-ID"), "finance_admin", id, app.LoanType, amountInKobo)

	c.JSON(200, gin.H{"status": "disbursed"})
}

func getRepaymentSchedule(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var app LoanApplication
	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified, status, interest_rate_percent, loan_started_at
		FROM loan_applications
		WHERE loan_application_id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified, &app.Status, &app.LoanInterestRatePercent,
		&app.LoanStartedAt,
	)

	if err != nil {
		SendErrorGin(c, "not_found", "Loan Application not found", 404)
		return
	}

	schedule := GenerateRepaymentSchedule(app.LoanAmount, app.LoanInterestRatePercent, app.RequestedTerm, *app.LoanStartedAt)

	c.JSON(200, schedule)
}

func recordPayment(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var payment LoanPayment
	if err := c.ShouldBindJSON(&payment); err != nil {
		SendErrorGin(c, "validation_failed", err.Error(), 400)
		return
	}

	var app LoanApplication
	query := `
		SELECT id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified, status, interest_rate_percent, loan_started_at
		FROM loan_applications
		WHERE loan_application_id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified, &app.Status, &app.LoanInterestRatePercent,
		&app.LoanStartedAt,
	)

	if err != nil {
		SendErrorGin(c, "not_found", "Loan Application not found", 404)
		return
	}

	if app.Status == "completed" {
		SendErrorGin(c, "bad_request", "Loan payment already completed", 400)
		return
	}

	var totalPaid float64
	err = db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) 
		FROM loan_payments 
		WHERE loan_application_id = $1 AND tenant_id = $2
	`, app.LoanApplicationID, tenantID).Scan(&totalPaid)

	if err != nil {
		log.Println("Failed to fetch total payments:", err)
		SendErrorGin(c, "internal_error", "Failed to fetch payment total", 500)
		return
	}

	log.Printf("Total Amount Paid: %f", totalPaid)

	var recordedPaymentAmount = payment.Amount

	var totalRequiredPaymentAmount = app.LoanAmount + (app.LoanAmount * app.LoanInterestRatePercent / 100)

	var totalUnpaid = totalRequiredPaymentAmount - totalPaid

	// Ensure no over-payment.
	if recordedPaymentAmount > totalUnpaid {
		recordedPaymentAmount = totalUnpaid
	}

	loanPaymentQuery := `
		INSERT INTO loan_payments 
			(loan_payment_id, loan_application_id, tenant_id, transaction_id, amount, payment_date, payment_method)
		VALUES 
			($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	err = db.QueryRow(
		loanPaymentQuery,
		generateID("LOAN_PAYMENT"),
		app.LoanApplicationID,
		tenantID,
		payment.TransactionID,
		recordedPaymentAmount,
		payment.PaymentDate,
		payment.PaymentMethod,
	).Scan(&payment.ID)

	if err != nil {
		log.Println("Insert error:", err)
		SendErrorGin(c, "internal_error", "Failed to record payment", 500)
		return
	}

	// Record journal entry for loan repayment
	keycloakID := c.GetHeader("X-Keycloak-ID")
	totalInterest := app.LoanAmount * app.LoanInterestRatePercent / 100
	// remainingPrincipal := app.LoanAmount - totalPaid

	// Calculate interest and principal portions of this payment
	var principalPortion, interestPortion float64
	if totalPaid < totalInterest {
		// Still paying off interest first
		if recordedPaymentAmount <= (totalInterest - totalPaid) {
			interestPortion = recordedPaymentAmount
			principalPortion = 0
		} else {
			interestPortion = totalInterest - totalPaid
			principalPortion = recordedPaymentAmount - interestPortion
		}
	} else {
		// Interest fully paid, all goes to principal
		principalPortion = recordedPaymentAmount
		interestPortion = 0
	}

	// Convert to kobo (smallest currency unit)
	principalKobo := int64(principalPortion * 100)
	interestKobo := int64(interestPortion * 100)

	coaClient.RecordLoanRepayment(tenantID, keycloakID, "finance_admin", app.LoanApplicationID, app.LoanType, principalKobo, interestKobo)

	if totalPaid+recordedPaymentAmount >= totalRequiredPaymentAmount {
		_, err := db.Exec(`
			UPDATE loan_applications
			SET status = 'completed'
			WHERE loan_application_id = $1 AND tenant_id = $2
		`, app.LoanApplicationID, app.TenantID)
		if err != nil {
			log.Println("Failed to update loan status:", err)
		}
	}

	c.JSON(200, gin.H{"status": "success", "amount": recordedPaymentAmount})
}
