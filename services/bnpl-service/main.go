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
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var db *sql.DB

// ─── Models ──────────────────────────────────────────────────────────────────

type BNPLApplication struct {
	ID                 int64   `json:"id,omitempty"`
	ApplicationID      string  `json:"application_id"`
	TenantID           string  `json:"tenant_id"`
	ApplicantID        string  `json:"applicant_id"`
	MerchantID         string  `json:"merchant_id"`
	PurchaseAmount     float64 `json:"purchase_amount" binding:"required,gt=0"`
	InstallmentCount   int     `json:"installment_count" binding:"required,min=1,max=12"`
	InstallmentAmount  float64 `json:"installment_amount,omitempty"`
	InterestRate       float64 `json:"interest_rate,omitempty"`
	ProductDescription string  `json:"product_description"`
	Status             string  `json:"status,omitempty"`
	CreditScore        int     `json:"credit_score,omitempty"`
	BVNVerified        bool    `json:"bvn_verified,omitempty"`
	CreatedAt          string  `json:"created_at,omitempty"`
	UpdatedAt          string  `json:"updated_at,omitempty"`
}

type BNPLRepayment struct {
	ID            int64   `json:"id,omitempty"`
	ApplicationID string  `json:"application_id"`
	TenantID      string  `json:"tenant_id"`
	InstallmentNo int     `json:"installment_no"`
	DueDate       string  `json:"due_date"`
	Amount        float64 `json:"amount"`
	PaidAt        *string `json:"paid_at,omitempty"`
	Status        string  `json:"status"`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func GetEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// BNPL interest: 0% for ≤3 instalments, 1.5% per month beyond 3
func calcBNPLRate(instalments int) float64 {
	if instalments <= 3 {
		return 0.0
	}
	return 1.5 * float64(instalments-3)
}

func sendError(c *gin.Context, code, message string, status int) {
	c.JSON(status, gin.H{"error": code, "message": message})
}

// ─── Middleware ───────────────────────────────────────────────────────────────

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := c.Request.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
				break
			}
		}
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Tenant-ID,X-Keycloak-ID")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func loggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Printf("[BNPL] %s %s %d %s", c.Request.Method, c.Request.URL.Path,
			c.Writer.Status(), time.Since(start))
	}
}

// ─── Database ────────────────────────────────────────────────────────────────

func initDatabase() error {
	dsn := GetEnv("DATABASE_URL",
		fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			GetEnv("DB_HOST", "localhost"),
			GetEnv("DB_PORT", "5432"),
			GetEnv("DB_USER", "postgres"),
			GetEnv("DB_PASSWORD", "postgres"),
			GetEnv("DB_NAME", "bnpl_db"),
		))

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	if err = db.Ping(); err != nil {
		return err
	}
	return migrateSchema()
}

func migrateSchema() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS bnpl_applications (
			id                  BIGSERIAL PRIMARY KEY,
			application_id      VARCHAR(64) UNIQUE NOT NULL,
			tenant_id           VARCHAR(64) NOT NULL,
			applicant_id        VARCHAR(64) NOT NULL,
			merchant_id         VARCHAR(64),
			purchase_amount     NUMERIC(18,2) NOT NULL,
			installment_count   INT NOT NULL,
			installment_amount  NUMERIC(18,2) NOT NULL,
			interest_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
			product_description TEXT,
			status              VARCHAR(32) NOT NULL DEFAULT 'pending',
			credit_score        INT,
			bvn_verified        BOOLEAN DEFAULT FALSE,
			created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS bnpl_repayments (
			id             BIGSERIAL PRIMARY KEY,
			application_id VARCHAR(64) NOT NULL REFERENCES bnpl_applications(application_id),
			tenant_id      VARCHAR(64) NOT NULL,
			installment_no INT NOT NULL,
			due_date       DATE NOT NULL,
			amount         NUMERIC(18,2) NOT NULL,
			paid_at        TIMESTAMPTZ,
			status         VARCHAR(32) NOT NULL DEFAULT 'pending',
			UNIQUE(application_id, installment_no)
		);

		CREATE INDEX IF NOT EXISTS idx_bnpl_apps_tenant   ON bnpl_applications(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_bnpl_apps_applicant ON bnpl_applications(applicant_id);
		CREATE INDEX IF NOT EXISTS idx_bnpl_repay_app      ON bnpl_repayments(application_id);
	`)
	return err
}

// ─── Handlers ────────────────────────────────────────────────────────────────

func createApplication(c *gin.Context) {
	var app BNPLApplication
	if err := c.ShouldBindJSON(&app); err != nil {
		sendError(c, "validation_failed", err.Error(), 400)
		return
	}

	app.TenantID = c.GetHeader("X-Tenant-ID")
	app.ApplicantID = c.GetHeader("X-Keycloak-ID")
	app.ApplicationID = generateID("BNPL")
	app.InterestRate = calcBNPLRate(app.InstallmentCount)
	// Total = principal × (1 + rate/100); per-installment = total / n
	total := app.PurchaseAmount * (1 + app.InterestRate/100)
	app.InstallmentAmount = total / float64(app.InstallmentCount)
	app.Status = "pending"

	err := db.QueryRow(`
		INSERT INTO bnpl_applications
			(application_id, tenant_id, applicant_id, merchant_id, purchase_amount,
			 installment_count, installment_amount, interest_rate, product_description,
			 status, credit_score, bvn_verified)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, created_at`,
		app.ApplicationID, app.TenantID, app.ApplicantID, app.MerchantID, app.PurchaseAmount,
		app.InstallmentCount, app.InstallmentAmount, app.InterestRate, app.ProductDescription,
		app.Status, app.CreditScore, app.BVNVerified,
	).Scan(&app.ID, &app.CreatedAt)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}

	c.JSON(201, app)
}

func listApplications(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	rows, err := db.Query(`
		SELECT id, application_id, tenant_id, applicant_id, merchant_id,
		       purchase_amount, installment_count, installment_amount, interest_rate,
		       product_description, status, credit_score, bvn_verified,
		       created_at, updated_at
		FROM bnpl_applications WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	defer rows.Close()

	apps := []BNPLApplication{}
	for rows.Next() {
		var a BNPLApplication
		if err := rows.Scan(&a.ID, &a.ApplicationID, &a.TenantID, &a.ApplicantID,
			&a.MerchantID, &a.PurchaseAmount, &a.InstallmentCount, &a.InstallmentAmount,
			&a.InterestRate, &a.ProductDescription, &a.Status, &a.CreditScore,
			&a.BVNVerified, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		apps = append(apps, a)
	}
	c.JSON(200, gin.H{"items": apps, "total": len(apps)})
}

func getApplication(c *gin.Context) {
	id := c.Param("id")
	var a BNPLApplication
	err := db.QueryRow(`
		SELECT id, application_id, tenant_id, applicant_id, merchant_id,
		       purchase_amount, installment_count, installment_amount, interest_rate,
		       product_description, status, credit_score, bvn_verified, created_at, updated_at
		FROM bnpl_applications WHERE application_id=$1`, id).
		Scan(&a.ID, &a.ApplicationID, &a.TenantID, &a.ApplicantID, &a.MerchantID,
			&a.PurchaseAmount, &a.InstallmentCount, &a.InstallmentAmount, &a.InterestRate,
			&a.ProductDescription, &a.Status, &a.CreditScore, &a.BVNVerified,
			&a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		sendError(c, "not_found", "application not found", 404)
		return
	}
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	c.JSON(200, a)
}

func approveApplication(c *gin.Context) {
	id := c.Param("id")
	_, err := db.Exec(`
		UPDATE bnpl_applications SET status='approved', updated_at=NOW()
		WHERE application_id=$1`, id)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"message": "application approved", "application_id": id})
}

func declineApplication(c *gin.Context) {
	id := c.Param("id")
	_, err := db.Exec(`
		UPDATE bnpl_applications SET status='declined', updated_at=NOW()
		WHERE application_id=$1`, id)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"message": "application declined", "application_id": id})
}

func getRepaymentSchedule(c *gin.Context) {
	id := c.Param("id")
	rows, err := db.Query(`
		SELECT id, application_id, tenant_id, installment_no, due_date, amount, paid_at, status
		FROM bnpl_repayments WHERE application_id=$1 ORDER BY installment_no`, id)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	defer rows.Close()

	schedule := []BNPLRepayment{}
	for rows.Next() {
		var r BNPLRepayment
		if err := rows.Scan(&r.ID, &r.ApplicationID, &r.TenantID, &r.InstallmentNo,
			&r.DueDate, &r.Amount, &r.PaidAt, &r.Status); err != nil {
			continue
		}
		schedule = append(schedule, r)
	}
	c.JSON(200, gin.H{"items": schedule, "total": len(schedule)})
}

func recordRepayment(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		InstallmentNo int `json:"installment_no" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		sendError(c, "validation_failed", err.Error(), 400)
		return
	}
	_, err := db.Exec(`
		UPDATE bnpl_repayments SET status='paid', paid_at=NOW()
		WHERE application_id=$1 AND installment_no=$2`, id, body.InstallmentNo)
	if err != nil {
		sendError(c, "db_error", err.Error(), 500)
		return
	}
	c.JSON(200, gin.H{"message": "repayment recorded"})
}

// ─── Routes ───────────────────────────────────────────────────────────────────

func registerRoutes(router *gin.Engine) {
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "bnpl-service"})
	})

	v1 := router.Group("/v1/applications")
	{
		v1.POST("", createApplication)
		v1.GET("", listApplications)
		v1.GET("/:id", getApplication)
		v1.POST("/:id/approve", approveApplication)
		v1.POST("/:id/decline", declineApplication)
		v1.GET("/:id/schedule", getRepaymentSchedule)
		v1.POST("/:id/repayment", recordRepayment)
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
	godotenv.Load()

	if err := initDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	router := gin.Default()
	router.Use(jwtAuthMiddleware())
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	registerRoutes(router)

	addr := ":" + GetEnv("PORT", "8017")
	srv := &http.Server{Addr: addr, Handler: router}

	go func() {
		log.Printf("bnpl-service listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
