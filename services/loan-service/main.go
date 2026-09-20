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
	"io"
	"log"
	"math"
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

	"go.opentelemetry.io/otel/attribute"
	"shared/otel/go/otelkit"
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

	shutdown, oerr := otelkit.Init(context.Background(), "loan-service")
	if oerr != nil {
		log.Fatalf("otelkit init: %v", oerr)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if serr := shutdown(sctx); serr != nil {
			log.Printf("otelkit shutdown: %v", serr)
		}
	}()
	if err := initDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// LN-03 (L3): PAYMENT_URL is required at boot — fail fast rather than
	// 500 on every disbursement (w8:F1-14).
	if err := InitPaymentConfig(); err != nil {
		log.Fatalf("%v", err)
	}

	// LN-03 (L3): COA journal outbox retry worker (persist + retry, not
	// fire-and-forget PostAsync).
	startCoAOutboxWorker()

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
	router.Use(otelkit.GinMiddleware())
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

		-- LN-02 (L2): stored credit evaluations — approval requires a stored
		-- passing evaluation, not an advisory recomputation.
		CREATE TABLE IF NOT EXISTS loan_evaluations (
			id SERIAL PRIMARY KEY,
			loan_application_id VARCHAR(50) NOT NULL REFERENCES loan_applications(loan_application_id) ON DELETE CASCADE,
			tenant_id VARCHAR(50) NOT NULL,
			decision VARCHAR(20) NOT NULL,
			risk_score NUMERIC(6, 4),
			approved_amount NUMERIC(15, 2),
			approved_term INT,
			interest_rate NUMERIC(15, 2),
			decline_reasons TEXT,
			evaluated_by VARCHAR(100),
			evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		-- LN-04 (L4): persisted amortized repayment schedule. Collections and
		-- completion are driven from these installment rows — not from a
		-- divergent flat-interest formula.
		CREATE TABLE IF NOT EXISTS loan_schedule (
			id SERIAL PRIMARY KEY,
			loan_application_id VARCHAR(50) NOT NULL REFERENCES loan_applications(loan_application_id) ON DELETE CASCADE,
			tenant_id VARCHAR(50) NOT NULL,
			installment_number INT NOT NULL,
			due_date TIMESTAMP NOT NULL,
			principal_amount NUMERIC(15, 2) NOT NULL,
			interest_amount NUMERIC(15, 2) NOT NULL,
			total_amount NUMERIC(15, 2) NOT NULL,
			remaining_balance NUMERIC(15, 2) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
			paid_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (loan_application_id, installment_number)
		);

		-- LN-03 (L3): COA journal outbox — entries are persisted before the
		-- money path completes and retried by a background worker.
		CREATE TABLE IF NOT EXISTS coa_outbox (
			id SERIAL PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(100),
			user_role VARCHAR(100),
			entry_json JSONB NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			attempts INT NOT NULL DEFAULT 0,
			last_error TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			posted_at TIMESTAMP
		);

		-- LN-02 (L2): approver identity + maker-checker reference columns.
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS declined_by VARCHAR(100);
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS maker_checker_approval_id VARCHAR(100);

		-- LN-09 (L10): delinquency aging columns maintained by the sweeper.
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS days_past_due INT NOT NULL DEFAULT 0;
		ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS aging_bucket VARCHAR(10) NOT NULL DEFAULT 'current';
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
	db, err = otelkit.OpenSQLDB("postgres", connStr)
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
	// LN-01 (L1): credit_score, bvn_verified and nin_verified are
	// SERVER-SOURCED attributes. A client that supplies them is rejected
	// outright; they are fetched from bvn-nin-verification-go and
	// credit-service by applicant id. If the verification providers are
	// unreachable the request fails closed (503).
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		SendErrorGin(c, "validation_failed", "failed to read request body", 400)
		return
	}

	var probe struct {
		CreditScore *int   `json:"credit_score"`
		BVNVerified *bool  `json:"bvn_verified"`
		NINVerified *bool  `json:"nin_verified"`
		BVN         string `json:"bvn"`
		NIN         string `json:"nin"`
	}
	if err := json.Unmarshal(rawBody, &probe); err != nil {
		SendErrorGin(c, "validation_failed", err.Error(), 400)
		return
	}
	if probe.CreditScore != nil || probe.BVNVerified != nil || probe.NINVerified != nil {
		SendErrorGin(c, "validation_failed",
			"credit_score, bvn_verified and nin_verified are server-sourced and must not be supplied by the client",
			400)
		return
	}

	var application LoanApplication
	if err := json.Unmarshal(rawBody, &application); err != nil {
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

	// Server-side identity verification (fail-closed).
	bvnVerified, ninVerified, err := fetchApplicantVerification(application.TenantID, application.ApplicantID, probe.BVN, probe.NIN)
	if err != nil {
		log.Printf("ERROR: identity verification unavailable for applicant %s: %v", application.ApplicantID, err)
		SendErrorGin(c, "service_unavailable", "identity verification service unavailable — application not accepted", 503)
		return
	}
	application.BVNVerified = bvnVerified
	application.NINVerified = ninVerified

	// Server-side credit score (fail-closed).
	creditScore, err := fetchApplicantCreditScore(application.TenantID, &application)
	if err != nil {
		log.Printf("ERROR: credit scoring unavailable for applicant %s: %v", application.ApplicantID, err)
		SendErrorGin(c, "service_unavailable", "credit scoring service unavailable — application not accepted", 503)
		return
	}
	application.CreditScore = creditScore

	query := `
		INSERT INTO loan_applications (loan_application_id, tenant_id, applicant_id, loan_amount, loan_purpose, loan_type,
			requested_term, monthly_income, existing_debt, collateral_value, credit_score,
			employment_status, employment_duration, bank_statement_score, bvn_verified, nin_verified, interest_rate_percent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id
	`

	err = db.QueryRow(query, application.LoanApplicationID, application.TenantID, application.ApplicantID, application.LoanAmount, application.LoanPurpose, application.LoanType,
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

	// LN-02 (L2): persist the evaluation so approval can require a stored
	// passing evaluation instead of re-running an advisory computation.
	reasons := strings.Join(decision.DeclineReasons, "; ")
	if _, err := db.Exec(`
		INSERT INTO loan_evaluations (loan_application_id, tenant_id, decision, risk_score, approved_amount, approved_term, interest_rate, decline_reasons, evaluated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		app.LoanApplicationID, tenantID, decision.Decision, decision.RiskScore,
		decision.ApprovedAmount, decision.ApprovedTerm, decision.InterestRate, reasons,
		c.GetHeader("X-Keycloak-ID")); err != nil {
		log.Println("Failed to persist evaluation:", err)
		SendErrorGin(c, "internal_error", "Failed to store evaluation", 500)
		return
	}

	// A terminal evaluation moves the application to a decision-driven state;
	// approval is only possible from 'evaluated' with a stored APPROVED row.
	switch decision.Decision {
	case "APPROVED", "REFER":
		if _, err := db.Exec(`UPDATE loan_applications SET status = 'evaluated', updated_at = $1 WHERE loan_application_id = $2 AND tenant_id = $3 AND status IN ('pending', 'under_review')`,
			time.Now(), app.LoanApplicationID, tenantID); err != nil {
			log.Println("Failed to update application status after evaluation:", err)
		}
	case "DECLINED":
		if _, err := db.Exec(`UPDATE loan_applications SET status = 'declined', updated_at = $1 WHERE loan_application_id = $2 AND tenant_id = $3 AND status IN ('pending', 'under_review')`,
			time.Now(), app.LoanApplicationID, tenantID); err != nil {
			log.Println("Failed to update application status after evaluation:", err)
		}
	}

	c.JSON(200, decision)
}

// LN-02 (L2): controlled approval. Preconditions: the application is in
// 'evaluated' state with a STORED passing evaluation; the approver identity
// comes from verified JWT claims (X-Keycloak-ID set by jwtAuthMiddleware),
// never from the request body; amounts above LOAN_APPROVAL_THRESHOLD_KOBO
// require a maker-checker approval id (x-maker-checker-approval-id header).
// Terminal-state re-approval is rejected.
func approveLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	approverID := c.GetHeader("X-Keycloak-ID")
	if approverID == "" {
		SendErrorGin(c, "unauthenticated", "authenticated approver identity required", 401)
		return
	}

	// Stored passing evaluation precondition.
	var evalDecision string
	err := db.QueryRow(`
		SELECT decision FROM loan_evaluations
		WHERE loan_application_id = $1 AND tenant_id = $2
		ORDER BY evaluated_at DESC LIMIT 1`, id, tenantID).Scan(&evalDecision)
	if err == sql.ErrNoRows {
		SendErrorGin(c, "precondition_failed", "application has no stored evaluation — evaluate first", 412)
		return
	}
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to read evaluation", 500)
		return
	}
	if evalDecision != "APPROVED" && evalDecision != "REFER" {
		SendErrorGin(c, "precondition_failed", "latest stored evaluation did not pass — cannot approve", 412)
		return
	}

	// Maker-checker for amounts above the configured threshold (kobo).
	thresholdStr := GetEnv("LOAN_APPROVAL_THRESHOLD_KOBO", "")
	if thresholdStr != "" {
		threshold, terr := strconv.ParseInt(thresholdStr, 10, 64)
		if terr != nil {
			log.Printf("ERROR: LOAN_APPROVAL_THRESHOLD_KOBO=%q is not an integer", thresholdStr)
			SendErrorGin(c, "internal_error", "approval threshold misconfigured", 500)
			return
		}
		var amount float64
		if err := db.QueryRow(`SELECT loan_amount FROM loan_applications WHERE loan_application_id = $1 AND tenant_id = $2`, id, tenantID).Scan(&amount); err != nil {
			SendErrorGin(c, "not_found", "Application not found", 404)
			return
		}
		if int64(amount*100) > threshold {
			mcID := c.GetHeader("x-maker-checker-approval-id")
			if mcID == "" {
				SendErrorGin(c, "precondition_failed",
					"amount exceeds LOAN_APPROVAL_THRESHOLD_KOBO — a maker-checker approval id (x-maker-checker-approval-id header) is required", 412)
				return
			}
			if _, err := db.Exec(`UPDATE loan_applications SET maker_checker_approval_id = $1 WHERE loan_application_id = $2 AND tenant_id = $3`, mcID, id, tenantID); err != nil {
				log.Println("Failed to persist maker-checker approval id:", err)
			}
		}
	}

	// Atomic state guard: only 'evaluated' can be approved (terminal states
	// declined/disbursed/completed/written_off are rejected by no-row).
	res, err := db.Exec(`
		UPDATE loan_applications SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = $2
		WHERE loan_application_id = $3 AND tenant_id = $4 AND status = 'evaluated'`,
		approverID, time.Now(), id, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to approve application", 500)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		SendErrorGin(c, "conflict", "application is not in 'evaluated' state (already decided or terminal)", 409)
		return
	}

	c.JSON(200, gin.H{"status": "approved", "approved_by": approverID})
}

// LN-02 (L2): decline is likewise guarded — only non-terminal states can be
// declined, and the declining officer's identity is persisted from JWT claims.
func declineLoanApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	declinedBy := c.GetHeader("X-Keycloak-ID")
	if declinedBy == "" {
		SendErrorGin(c, "unauthenticated", "authenticated officer identity required", 401)
		return
	}

	res, err := db.Exec(`
		UPDATE loan_applications SET status = 'declined', declined_by = $1, updated_at = $2
		WHERE loan_application_id = $3 AND tenant_id = $4 AND status IN ('pending', 'under_review', 'evaluated')`,
		declinedBy, time.Now(), id, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to decline application", 500)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		SendErrorGin(c, "conflict", "application not found or already in a terminal state", 409)
		return
	}

	c.JSON(200, gin.H{"status": "declined", "declined_by": declinedBy})
}

// LN-03 (L3): disbursement saga with an atomic claim.
//  1. CLAIM (atomic): UPDATE ... SET status='disbursing' WHERE
//     status='approved' RETURNING — the double-disbursement window
//     (check-then-act on a non-locked read) is closed at the DB.
//  2. The amount comes from the claimed record, never the request.
//  3. The COA journal entry is ENQUEUED to the outbox before money moves
//     (persist + retry, not fire-and-forget).
//  4. FORWARD: real payment via the payment service.
//  5. COMMIT: status='disbursed' + persisted amortized schedule (LN-04).
//  6. Failure handling: pre-payment failures release the claim; post-payment
//     persistence failure marks compensation_failed with an ALERT (the
//     payment-service exposes no reversal API — manual reconciliation).
func disburseLoan(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")
	keycloakID := c.GetHeader("X-Keycloak-ID")
	ledgerID := c.GetHeader("X-Ledger-ID")
	mintAccountID := c.GetHeader("X-Mint-Account-ID")

	var app LoanApplication
	// Step 1 — atomic claim. err checked BEFORE any use of the row (the
	// previous ordering bug checked err after the status guards).
	claimQuery := `
		UPDATE loan_applications SET status = 'disbursing', updated_at = $3
		WHERE loan_application_id = $1 AND tenant_id = $2 AND status = 'approved'
		RETURNING id, tenant_id, applicant_id, loan_application_id, loan_amount, loan_purpose, requested_term,
			monthly_income, COALESCE(existing_debt, 0), COALESCE(collateral_value, 0), COALESCE(credit_score, 0),
			COALESCE(employment_status, ''), COALESCE(employment_duration, 0), COALESCE(bank_statement_score, 0),
			bvn_verified, nin_verified, status, interest_rate_percent
	`
	err := db.QueryRow(claimQuery, id, tenantID, time.Now()).Scan(
		&app.ID, &app.TenantID, &app.ApplicantID, &app.LoanApplicationID, &app.LoanAmount, &app.LoanPurpose,
		&app.RequestedTerm, &app.MonthlyIncome, &app.ExistingDebt, &app.CollateralValue,
		&app.CreditScore, &app.EmploymentStatus, &app.EmploymentDuration,
		&app.BankStatementScore, &app.BVNVerified, &app.NINVerified, &app.Status, &app.LoanInterestRatePercent,
	)
	if err == sql.ErrNoRows {
		SendErrorGin(c, "conflict", "Loan not found, not approved, or disbursement already in progress", 409)
		return
	}
	if err != nil {
		log.Printf("ERROR: disbursement claim failed for loan %s: %v", id, err)
		SendErrorGin(c, "internal_error", "Failed to initiate disbursement", 500)
		return
	}

	releaseClaim := func() {
		if _, rerr := db.Exec(`UPDATE loan_applications SET status = 'approved', updated_at = $1 WHERE loan_application_id = $2 AND tenant_id = $3 AND status = 'disbursing'`,
			time.Now(), id, tenantID); rerr != nil {
			log.Printf("ALERT: failed to release disbursement claim for loan %s: %v", id, rerr)
		}
	}

	// Step 2 — amount from the claimed record.
	var amountString = strconv.FormatFloat(app.LoanAmount, 'f', 2, 64)
	amountInKobo := int64(app.LoanAmount * 100)

	// Step 3 — persist the COA journal entry in the outbox BEFORE money moves.
	if err := coaClient.RecordLoanDisbursement(tenantID, keycloakID, "finance_admin", id, app.LoanType, amountInKobo); err != nil {
		log.Printf("ERROR: COA outbox enqueue failed for loan %s disbursement: %v", id, err)
		releaseClaim()
		SendErrorGin(c, "internal_error", "Failed to persist disbursement journal — disbursement aborted", 500)
		return
	}

	// Step 4 — forward: move the funds (mint -> applicant).
	_, err = Payment(&PaymentStruct{
		Recipient:     app.ApplicantID,
		Amount:        amountString,
		Note:          "LOAN_DISBURSEMENT/" + amountString,
		TenantID:      tenantID,
		KeycloakID:    keycloakID,
		LedgerID:      ledgerID,
		MintAccountID: mintAccountID,
	})
	if err != nil {
		log.Printf("Payment failed for loan %s disbursement: %v", id, err)
		releaseClaim()
		SendErrorGin(c, "bad_gateway", "Payment processing failed — no disbursement recorded", 502)
		return
	}

	// Step 5 — commit + persist the amortized repayment schedule (LN-04).
	now := time.Now()
	res, err := db.Exec(`
		UPDATE loan_applications
		SET status = 'disbursed', loan_started_at = $1, updated_at = $1
		WHERE loan_application_id = $2 AND tenant_id = $3 AND status = 'disbursing'
	`, now, id, tenantID)
	if err == nil {
		if n, _ := res.RowsAffected(); n == 0 {
			err = fmt.Errorf("commit updated no rows")
		}
	}
	if err != nil {
		log.Printf("ALERT: loan %s paid via payment service but commit failed: %v — marking compensation_failed, manual reconciliation required", id, err)
		if _, merr := db.Exec(`UPDATE loan_applications SET status = 'compensation_failed', updated_at = $1 WHERE loan_application_id = $2 AND tenant_id = $3`, time.Now(), id, tenantID); merr != nil {
			log.Printf("ALERT: could not mark loan %s compensation_failed: %v", id, merr)
		}
		SendErrorGin(c, "internal_error", "Disbursement paid but persistence failed — manual reconciliation required", 500)
		return
	}

	if err := persistRepaymentSchedule(id, tenantID, app.LoanAmount, app.LoanInterestRatePercent, app.RequestedTerm, now); err != nil {
		// Money moved; schedule persistence failure is loud but the loan
		// stays disbursed — the schedule can be regenerated deterministically.
		log.Printf("ALERT: loan %s disbursed but schedule persistence failed: %v — regenerate before collections", id, err)
	}

	// Telemetry: loan_disbursement_events_total{service,tenant_id,loan_id}
	// (Wave-9 SPEC addendum; feeds the DoubleDisburseGuard alert rule).
	otelkit.IncCounter(c.Request.Context(), "loan_disbursement_events_total",
		attribute.String("service", "loan-service"),
		attribute.String("tenant_id", tenantID),
		attribute.String("loan_id", id))

	c.JSON(200, gin.H{"status": "disbursed"})
}

// persistRepaymentSchedule (LN-04) writes the amortized schedule rows that
// collections and completion are driven from.
func persistRepaymentSchedule(loanApplicationID, tenantID string, loanAmount, interestRatePercent float64, termMonths int, startDate time.Time) error {
	if termMonths < 1 {
		return fmt.Errorf("invalid term %d", termMonths)
	}
	if interestRatePercent <= 0 {
		// Zero-rate loan: equal principal installments (EMI formula is
		// undefined at r=0).
		per := loanAmount / float64(termMonths)
		balance := loanAmount
		for i := 1; i <= termMonths; i++ {
			principal := per
			if i == termMonths {
				principal = balance
			}
			balance -= principal
			_, err := db.Exec(`
				INSERT INTO loan_schedule (loan_application_id, tenant_id, installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance, status)
				VALUES ($1, $2, $3, $4, $5, 0, $5, $6, 'pending')
				ON CONFLICT (loan_application_id, installment_number) DO NOTHING`,
				loanApplicationID, tenantID, i, startDate.AddDate(0, i, 0), principal, math.Max(balance, 0))
			if err != nil {
				return err
			}
		}
		return nil
	}
	schedule := GenerateRepaymentSchedule(loanAmount, interestRatePercent, termMonths, startDate)
	for _, inst := range schedule.Schedule {
		_, err := db.Exec(`
			INSERT INTO loan_schedule (loan_application_id, tenant_id, installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
			ON CONFLICT (loan_application_id, installment_number) DO NOTHING`,
			loanApplicationID, tenantID, inst.InstallmentNumber, inst.DueDate,
			inst.PrincipalPayment, inst.InterestPayment, inst.TotalPayment, inst.RemainingBalance)
		if err != nil {
			return err
		}
	}
	return nil
}

func getRepaymentSchedule(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	// LN-04 (L4): serve the PERSISTED amortized schedule written at
	// disbursement. Legacy loans without persisted rows fall back to the
	// deterministic recomputation.
	var persisted []RepaymentInstallment
	rows, err := db.Query(`
		SELECT installment_number, due_date, principal_amount, interest_amount, total_amount, remaining_balance
		FROM loan_schedule WHERE loan_application_id = $1 AND tenant_id = $2
		ORDER BY installment_number`, id, tenantID)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to read repayment schedule", 500)
		return
	}
	for rows.Next() {
		var inst RepaymentInstallment
		if err := rows.Scan(&inst.InstallmentNumber, &inst.DueDate, &inst.PrincipalPayment, &inst.InterestPayment, &inst.TotalPayment, &inst.RemainingBalance); err != nil {
			log.Println("Error scanning schedule row:", err)
			continue
		}
		persisted = append(persisted, inst)
	}
	rows.Close()

	if len(persisted) > 0 {
		c.JSON(200, gin.H{"schedule": persisted, "basis": "amortized", "persisted": true})
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

	err = db.QueryRow(query, id, tenantID).Scan(
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
	if app.LoanStartedAt == nil {
		SendErrorGin(c, "conflict", "loan not disbursed — no repayment schedule", 409)
		return
	}

	schedule := GenerateRepaymentSchedule(app.LoanAmount, app.LoanInterestRatePercent, app.RequestedTerm, *app.LoanStartedAt)

	c.JSON(200, schedule)
}

// is rejected — never silently clipped.
// LN-05 (L5): repayment is ledger-first. A real transfer via the payment
// service (customer -> settlement account) must execute BEFORE any row is
// recorded; the stored transaction id is the SERVER-FETCHED reference from
// the payment service — client-supplied transaction ids are rejected.
// Precondition: status='disbursed'. Overpayment beyond the schedule total
// is rejected (issue a credit note out of band), never silently clipped.
// LN-04 (L4): totals come from the persisted amortized schedule, not the
// flat-interest formula.
func recordPayment(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var payment LoanPayment
	if err := c.ShouldBindJSON(&payment); err != nil {
		SendErrorGin(c, "validation_failed", err.Error(), 400)
		return
	}
	if payment.TransactionID != "" {
		SendErrorGin(c, "validation_failed", "transaction_id is server-issued by the payment service and must not be supplied", 400)
		return
	}
	if payment.Amount <= 0 {
		SendErrorGin(c, "validation_failed", "amount must be positive", 400)
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

	// Only a disbursed loan can accept repayment.
	if app.Status == "completed" {
		SendErrorGin(c, "bad_request", "Loan payment already completed", 400)
		return
	}
	if app.Status != "disbursed" {
		SendErrorGin(c, "conflict", "loan must be disbursed before payments are accepted", 409)
		return
	}

	// Amortized total from the persisted schedule (LN-04).
	var totalRequiredPaymentAmount float64
	err = db.QueryRow(`SELECT COALESCE(SUM(total_amount), 0) FROM loan_schedule WHERE loan_application_id = $1 AND tenant_id = $2`,
		app.LoanApplicationID, tenantID).Scan(&totalRequiredPaymentAmount)
	if err != nil {
		SendErrorGin(c, "internal_error", "Failed to read repayment schedule", 500)
		return
	}
	if totalRequiredPaymentAmount <= 0 {
		// No persisted schedule — refuse rather than fall back to the
		// divergent flat-interest formula.
		SendErrorGin(c, "conflict", "loan has no persisted repayment schedule — disbursement incomplete", 409)
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

	totalUnpaid := totalRequiredPaymentAmount - totalPaid
	if payment.Amount > totalUnpaid {
		SendErrorGin(c, "bad_request",
			fmt.Sprintf("payment %.2f exceeds outstanding balance %.2f — overpayment is rejected; request a credit note", payment.Amount, totalUnpaid),
			400)
		return
	}

	// Step 1 — move the money FIRST via the payment service.
	settlementAccount := GetEnv("LOAN_REPAYMENT_RECIPIENT", "")
	if settlementAccount == "" {
		SendErrorGin(c, "service_unavailable", "LOAN_REPAYMENT_RECIPIENT not configured — repayment unavailable", 503)
		return
	}
	amountString := strconv.FormatFloat(payment.Amount, 'f', 2, 64)
	keycloakID := c.GetHeader("X-Keycloak-ID")
	payResult, err := Payment(&PaymentStruct{
		Recipient:     settlementAccount,
		Amount:        amountString,
		Note:          "LOAN_REPAYMENT/" + app.LoanApplicationID + "/" + amountString,
		TenantID:      tenantID,
		KeycloakID:    keycloakID,
		LedgerID:      c.GetHeader("X-Ledger-ID"),
		MintAccountID: c.GetHeader("X-Mint-Account-ID"),
	})
	if err != nil {
		log.Printf("Repayment transfer failed for loan %s: %v", app.LoanApplicationID, err)
		SendErrorGin(c, "bad_gateway", "Payment processing failed — no payment recorded", 502)
		return
	}
	if payResult.TransactionID == "" {
		log.Printf("ERROR: payment service returned no transaction reference for loan %s repayment", app.LoanApplicationID)
		SendErrorGin(c, "bad_gateway", "payment service returned no transaction reference — payment not recorded", 502)
		return
	}

	// Step 2 — record the payment with the server-fetched reference.
	recordedPaymentAmount := payment.Amount
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
		payResult.TransactionID,
		recordedPaymentAmount,
		time.Now(),
		payment.PaymentMethod,
	).Scan(&payment.ID)
	if err != nil {
		// Money moved but the record failed — loud, never silent.
		log.Printf("ALERT: repayment of %.2f for loan %s executed (ref %s) but recording failed: %v — manual reconciliation required",
			recordedPaymentAmount, app.LoanApplicationID, payResult.TransactionID, err)
		SendErrorGin(c, "internal_error", "Payment executed but recording failed — manual reconciliation required", 500)
		return
	}

	// Interest-first waterfall from the persisted schedule totals (LN-04).
	var totalInterest float64
	if err := db.QueryRow(`SELECT COALESCE(SUM(interest_amount), 0) FROM loan_schedule WHERE loan_application_id = $1 AND tenant_id = $2`,
		app.LoanApplicationID, tenantID).Scan(&totalInterest); err != nil {
		totalInterest = 0
	}
	var principalPortion, interestPortion float64
	if totalPaid < totalInterest {
		if recordedPaymentAmount <= (totalInterest - totalPaid) {
			interestPortion = recordedPaymentAmount
			principalPortion = 0
		} else {
			interestPortion = totalInterest - totalPaid
			principalPortion = recordedPaymentAmount - interestPortion
		}
	} else {
		principalPortion = recordedPaymentAmount
		interestPortion = 0
	}

	// Mark schedule installments covered by this payment (oldest first).
	applyPaymentToSchedule(app.LoanApplicationID, tenantID, recordedPaymentAmount)

	// Record journal entry for loan repayment (outbox — persist + retry).
	principalKobo := int64(principalPortion * 100)
	interestKobo := int64(interestPortion * 100)
	if err := coaClient.RecordLoanRepayment(tenantID, keycloakID, "finance_admin", app.LoanApplicationID, app.LoanType, principalKobo, interestKobo); err != nil {
		log.Printf("ALERT: COA outbox enqueue failed for loan %s repayment (ref %s): %v", app.LoanApplicationID, payResult.TransactionID, err)
	}

	if totalPaid+recordedPaymentAmount >= totalRequiredPaymentAmount {
		_, err := db.Exec(`
			UPDATE loan_applications
			SET status = 'completed', updated_at = $1
			WHERE loan_application_id = $2 AND tenant_id = $3
		`, time.Now(), app.LoanApplicationID, app.TenantID)
		if err != nil {
			log.Println("Failed to update loan status:", err)
		}
	}

	c.JSON(200, gin.H{"status": "success", "amount": recordedPaymentAmount, "transaction_id": payResult.TransactionID})
}

// applyPaymentToSchedule (LN-04) marks pending installments as covered by a
// payment, oldest due first.
func applyPaymentToSchedule(loanApplicationID, tenantID string, amount float64) {
	rows, err := db.Query(`
		SELECT id, total_amount, paid_amount FROM loan_schedule
		WHERE loan_application_id = $1 AND tenant_id = $2 AND status != 'paid'
		ORDER BY installment_number`, loanApplicationID, tenantID)
	if err != nil {
		log.Printf("ALERT: schedule lookup failed for loan %s: %v", loanApplicationID, err)
		return
	}
	defer rows.Close()

	type instRow struct {
		id          int
		total, paid float64
	}
	var installments []instRow
	for rows.Next() {
		var r instRow
		if err := rows.Scan(&r.id, &r.total, &r.paid); err == nil {
			installments = append(installments, r)
		}
	}

	remaining := amount
	for _, inst := range installments {
		if remaining <= 0 {
			break
		}
		due := inst.total - inst.paid
		apply := math.Min(remaining, due)
		newPaid := inst.paid + apply
		status := "pending"
		var paidAt interface{}
		if newPaid >= inst.total {
			status = "paid"
			paidAt = time.Now()
		}
		if _, err := db.Exec(`UPDATE loan_schedule SET paid_amount = $1, status = $2, paid_at = $3 WHERE id = $4`,
			newPaid, status, paidAt, inst.id); err != nil {
			log.Printf("ALERT: installment update failed (schedule id %d): %v", inst.id, err)
		}
		remaining -= apply
	}
}
