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
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	db              *sql.DB
	lakehouseClient *LakehouseClient
)

// Prometheus metrics
var (
	applicationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "islamic_banking_applications_total",
			Help: "Total number of Islamic banking applications",
		},
		[]string{"status", "product_type"},
	)
	productsActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "islamic_banking_products_active",
			Help: "Number of active Islamic banking products",
		},
		[]string{"product_type"},
	)
	requestLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "islamic_banking_request_duration_seconds",
			Help:    "Request latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"endpoint"},
	)
)

func init() {
	prometheus.MustRegister(applicationsTotal)
	prometheus.MustRegister(productsActive)
	prometheus.MustRegister(requestLatency)
}

// Product Status
type ProductStatus string

const (
	StatusPending   ProductStatus = "pending"
	StatusApproved  ProductStatus = "approved"
	StatusActive    ProductStatus = "active"
	StatusRejected  ProductStatus = "rejected"
	StatusCancelled ProductStatus = "cancelled"
	StatusCompleted ProductStatus = "completed"
	StatusPaused    ProductStatus = "paused"
)

// Product Types
type ProductType string

const (
	ProductMurabaha  ProductType = "murabaha"
	ProductMusharaka ProductType = "musharaka"
	ProductIjara     ProductType = "ijara"
	ProductTakaful   ProductType = "takaful"
	ProductSukuk     ProductType = "sukuk"
)

// Lease Type for Ijara
type LeaseType string

const (
	LeaseTypeOperating LeaseType = "operating"
	LeaseTypeFinance   LeaseType = "finance"
)

// Policy Type for Takaful
type PolicyType string

const (
	PolicyTypeFamily  PolicyType = "family"
	PolicyTypeGeneral PolicyType = "general"
	PolicyTypeHealth  PolicyType = "health"
)

// Frequency Type
type FrequencyType string

const (
	FrequencyMonthly   FrequencyType = "monthly"
	FrequencyQuarterly FrequencyType = "quarterly"
	FrequencyAnnually  FrequencyType = "annually"
)

// Sukuk Type
type SukukType string

const (
	SukukTypeIjara     SukukType = "ijara"
	SukukTypeMurabaha  SukukType = "murabaha"
	SukukTypeMusharaka SukukType = "musharaka"
)

// ============================================================
// MURABAHA - Cost-Plus Financing
// ============================================================

// MurabahaProduct represents a Murabaha financing agreement
type MurabahaProduct struct {
	ID                 string        `json:"id"`
	TenantID           string        `json:"tenant_id"`
	UserID             string        `json:"user_id"`
	AssetName          string        `json:"asset_name"`
	CostPrice          float64       `json:"cost_price"`
	SellingPrice       float64       `json:"selling_price"`
	ProfitMargin       float64       `json:"profit_margin"`
	TenureMonths       int           `json:"tenure_months"`
	MonthlyInstallment float64       `json:"monthly_installment"`
	Status             ProductStatus `json:"status"`
	ReferenceNumber    string        `json:"reference_number"`
	ApplicationDate    time.Time     `json:"application_date"`
	ApprovalDate       *time.Time    `json:"approval_date,omitempty"`
	CompletionDate     *time.Time    `json:"completion_date,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// MUSHARAKA - Partnership Financing
// ============================================================

// MusharakaProduct represents a Musharaka partnership agreement
type MusharakaProduct struct {
	ID                   string        `json:"id"`
	TenantID             string        `json:"tenant_id"`
	UserID               string        `json:"user_id"`
	BusinessName         string        `json:"business_name"`
	BankContribution     float64       `json:"bank_contribution"`
	CustomerContribution float64       `json:"customer_contribution"`
	TotalCapital         float64       `json:"total_capital"`
	BankProfitShare      float64       `json:"bank_profit_share"`
	CustomerProfitShare  float64       `json:"customer_profit_share"`
	Status               ProductStatus `json:"status"`
	ReferenceNumber      string        `json:"reference_number"`
	ApplicationDate      time.Time     `json:"application_date"`
	ApprovalDate         *time.Time    `json:"approval_date,omitempty"`
	PartnershipEndDate   *time.Time    `json:"partnership_end_date,omitempty"`
	CreatedAt            time.Time     `json:"created_at"`
	UpdatedAt            *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// IJARA - Islamic Leasing
// ============================================================

// IjaraProduct represents an Ijara leasing agreement
type IjaraProduct struct {
	ID              string        `json:"id"`
	TenantID        string        `json:"tenant_id"`
	UserID          string        `json:"user_id"`
	AssetName       string        `json:"asset_name"`
	AssetValue      float64       `json:"asset_value"`
	MonthlyRental   float64       `json:"monthly_rental"`
	TenureMonths    int           `json:"tenure_months"`
	LeaseType       LeaseType     `json:"lease_type"`
	Status          ProductStatus `json:"status"`
	ReferenceNumber string        `json:"reference_number"`
	ApplicationDate time.Time     `json:"application_date"`
	ApprovalDate    *time.Time    `json:"approval_date,omitempty"`
	LeaseStartDate  *time.Time    `json:"lease_start_date,omitempty"`
	LeaseEndDate    *time.Time    `json:"lease_end_date,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// TAKAFUL - Islamic Insurance
// ============================================================

// TakafulProduct represents a Takaful insurance policy
type TakafulProduct struct {
	ID                 string        `json:"id"`
	TenantID           string        `json:"tenant_id"`
	UserID             string        `json:"user_id"`
	PolicyType         PolicyType    `json:"policy_type"`
	PolicyName         string        `json:"policy_name"`
	ContributionAmount float64       `json:"contribution_amount"`
	CoverageAmount     float64       `json:"coverage_amount"`
	Frequency          FrequencyType `json:"frequency"`
	Status             ProductStatus `json:"status"`
	ReferenceNumber    string        `json:"reference_number"`
	ApplicationDate    time.Time     `json:"application_date"`
	ApprovalDate       *time.Time    `json:"approval_date,omitempty"`
	PolicyStartDate    *time.Time    `json:"policy_start_date,omitempty"`
	PolicyEndDate      *time.Time    `json:"policy_end_date,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// SUKUK - Islamic Bonds
// ============================================================

// SukukProduct represents a Sukuk investment
type SukukProduct struct {
	ID               string        `json:"id"`
	TenantID         string        `json:"tenant_id"`
	UserID           string        `json:"user_id"`
	SukukType        SukukType     `json:"sukuk_type"`
	SukukName        string        `json:"sukuk_name"`
	InvestmentAmount float64       `json:"investment_amount"`
	ExpectedReturn   float64       `json:"expected_return"`
	TenureMonths     int           `json:"tenure_months"`
	Status           ProductStatus `json:"status"`
	ReferenceNumber  string        `json:"reference_number"`
	ApplicationDate  time.Time     `json:"application_date"`
	ApprovalDate     *time.Time    `json:"approval_date,omitempty"`
	MaturityDate     *time.Time    `json:"maturity_date,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        *time.Time    `json:"updated_at,omitempty"`
}

var islamicBankingKafkaClient = NewIslamicBankingKafkaClient()

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

	db = initDatabase()
	if db != nil {
		defer db.Close()
	}

	lakehouseClient = NewLakehouseClient()

	router := gin.Default()
	router.Use(jwtAuthMiddleware())
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	router.Use(tenantMiddleware())
	router.Use(metricsMiddleware())

	registerRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8029"
	}

	addr := ":" + port

	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	log.Printf("Islamic Banking Service started on %s", addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func registerRoutes(router *gin.Engine) {
	router.GET("/health", healthCheck)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := router.Group("/api/v1")
	{
		// Murabaha Endpoints
		murabaha := api.Group("/murabaha")
		{
			murabaha.GET("", getAllMurabaha)
			murabaha.GET("/:id", getMurabahaByID)
			murabaha.POST("", applyForMurabaha)
			murabaha.DELETE("/:id", cancelMurabaha)
			murabaha.PATCH("/:id/status", updateMurabahaStatus)
		}

		// Musharaka Endpoints
		musharaka := api.Group("/musharaka")
		{
			musharaka.GET("", getAllMusharaka)
			musharaka.GET("/:id", getMusharakaByID)
			musharaka.POST("", applyForMusharaka)
			musharaka.DELETE("/:id", cancelMusharaka)
			musharaka.PATCH("/:id/status", updateMusharakaStatus)
		}

		// Ijara Endpoints
		ijara := api.Group("/ijara")
		{
			ijara.GET("", getAllIjara)
			ijara.GET("/:id", getIjaraByID)
			ijara.POST("", applyForIjara)
			ijara.DELETE("/:id", cancelIjara)
			ijara.PATCH("/:id/status", updateIjaraStatus)
		}

		// Takaful Endpoints
		takaful := api.Group("/takaful")
		{
			takaful.GET("", getAllTakaful)
			takaful.GET("/:id", getTakafulByID)
			takaful.POST("", applyForTakaful)
			takaful.DELETE("/:id", cancelTakaful)
			takaful.PATCH("/:id/status", updateTakafulStatus)
		}

		// Sukuk Endpoints
		sukuk := api.Group("/sukuk")
		{
			sukuk.GET("", getAllSukuk)
			sukuk.GET("/:id", getSukukByID)
			sukuk.POST("", investInSukuk)
			sukuk.DELETE("/:id", cancelSukuk)
			sukuk.PATCH("/:id/status", updateSukukStatus)
		}

		// Common Endpoints
		api.GET("/products", getAllProducts)
		api.GET("/products/tenant", getProductsByTenant)
		api.GET("/products/:id", getProductByID)
		api.PATCH("/products/:id/status", updateProductStatusGeneric)
		api.DELETE("/products/:id", cancelProductGeneric)
	}
}

// Health check endpoint
func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "islamic-banking-service"})
}

// Middlewares
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
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
				break
			}
		}
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
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
		duration := time.Since(start)
		log.Printf("[%s] %s %s - %d (%v)", c.Request.Method, c.Request.URL.Path, c.ClientIP(), c.Writer.Status(), duration)
	}
}

func tenantMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

func metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		requestLatency.WithLabelValues(c.FullPath()).Observe(duration.Seconds())
	}
}

// Helper function to generate reference numbers
func generateReferenceNumber(prefix string) string {
	year := time.Now().Year()
	sequence := uuid.New().ID()
	return fmt.Sprintf("%s-%d-%06d", prefix, year, sequence%1000000)
}

// getUserID extracts the authenticated user identity EXCLUSIVELY from the
// verified JWT claims that jwtAuthMiddleware stores in the gin context
// (c.Set("jwt_claims", claims) after RS256/JWKS verification). Caller-supplied
// identity headers are never consulted, and there is no "user_default"
// fallback: when no verified subject claim is present the request is aborted
// with 401 and ok=false is returned so the handler stops immediately.
func getUserID(c *gin.Context) (userID string, ok bool) {
	if v, exists := c.Get("jwt_claims"); exists {
		if claims, isMap := v.(map[string]interface{}); isMap {
			if sub, isStr := claims["sub"].(string); isStr && sub != "" {
				return sub, true
			}
		}
	}
	SendError(c.Writer, "unauthorized", "Authenticated user identity required", http.StatusUnauthorized, nil)
	c.Abort()
	return "", false
}

// ============================================================
// MURABAHA HANDLERS
// ============================================================

func getAllMurabaha(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	products, err := fetchAllMurabaha(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Murabaha products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getMurabahaByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	product, err := fetchMurabahaByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForMurabaha(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		AssetName    string  `json:"asset_name" binding:"required"`
		CostPrice    float64 `json:"cost_price" binding:"required"`
		ProfitMargin float64 `json:"profit_margin" binding:"required"`
		TenureMonths int     `json:"tenure_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate selling price and monthly installment
	sellingPrice := req.CostPrice * (1 + req.ProfitMargin/100)
	monthlyInstallment := sellingPrice / float64(req.TenureMonths)

	now := time.Now()
	product := MurabahaProduct{
		ID:                 "murabaha_" + uuid.New().String()[:8],
		TenantID:           tenantID,
		UserID:             userID,
		AssetName:          req.AssetName,
		CostPrice:          req.CostPrice,
		SellingPrice:       sellingPrice,
		ProfitMargin:       req.ProfitMargin,
		TenureMonths:       req.TenureMonths,
		MonthlyInstallment: monthlyInstallment,
		Status:             StatusPending,
		ReferenceNumber:    generateReferenceNumber("MUR"),
		ApplicationDate:    now,
		CreatedAt:          now,
	}

	if err := saveMurabaha(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Murabaha application", http.StatusInternalServerError, nil)
		return
	}

	// Publish event to Kafka
	event := IslamicBankingEvent{
		Type:      "islamic_banking.murabaha.created",
		EntityID:  product.ID,
		TenantID:  tenantID,
		Status:    string(product.Status),
		Timestamp: now,
		Metadata: map[string]interface{}{
			"user_id":          userID,
			"asset_name":       req.AssetName,
			"cost_price":       req.CostPrice,
			"selling_price":    sellingPrice,
			"profit_margin":    req.ProfitMargin,
			"tenure_months":    req.TenureMonths,
			"application_date": now,
		},
	}
	islamicBankingKafkaClient.PublishEvent("islamic_banking.murabaha.created", event)

	// Publish event to lakehouse (existing)
	lakehouseClient.PublishEvent("islamic_banking_application", map[string]interface{}{
		"product_type":     "murabaha",
		"application_id":   product.ID,
		"user_id":          userID,
		"tenant_id":        tenantID,
		"asset_name":       req.AssetName,
		"cost_price":       req.CostPrice,
		"selling_price":    sellingPrice,
		"profit_margin":    req.ProfitMargin,
		"tenure_months":    req.TenureMonths,
		"application_date": now,
	}, "islamic-banking-service")

	applicationsTotal.WithLabelValues("pending", "murabaha").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Murabaha application submitted successfully", "data": product})
}

func cancelMurabaha(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	if err := updateMurabahaStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateMurabahaStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateMurabahaStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// MUSHARAKA HANDLERS
// ============================================================

func getAllMusharaka(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	products, err := fetchAllMusharaka(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Musharaka products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getMusharakaByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	product, err := fetchMusharakaByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForMusharaka(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		BusinessName         string  `json:"business_name" binding:"required"`
		CustomerContribution float64 `json:"customer_contribution" binding:"required"`
		BankContribution     float64 `json:"bank_contribution" binding:"required"`
		CustomerProfitShare  float64 `json:"customer_profit_share" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate total capital and bank profit share
	totalCapital := req.BankContribution + req.CustomerContribution
	bankProfitShare := 100 - req.CustomerProfitShare

	now := time.Now()
	product := MusharakaProduct{
		ID:                   "musharaka_" + uuid.New().String()[:8],
		TenantID:             tenantID,
		UserID:               userID,
		BusinessName:         req.BusinessName,
		BankContribution:     req.BankContribution,
		CustomerContribution: req.CustomerContribution,
		TotalCapital:         totalCapital,
		BankProfitShare:      bankProfitShare,
		CustomerProfitShare:  req.CustomerProfitShare,
		Status:               StatusPending,
		ReferenceNumber:      generateReferenceNumber("MSH"),
		ApplicationDate:      now,
		CreatedAt:            now,
	}

	if err := saveMusharaka(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Musharaka application", http.StatusInternalServerError, nil)
		return
	}

	lakehouseClient.PublishEvent("islamic_banking_application", map[string]interface{}{
		"product_type":          "musharaka",
		"application_id":        product.ID,
		"business_name":         req.BusinessName,
		"total_capital":         totalCapital,
		"customer_contribution": req.CustomerContribution,
		"bank_contribution":     req.BankContribution,
	}, "islamic-banking-service")

	applicationsTotal.WithLabelValues("pending", "musharaka").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Musharaka application submitted successfully", "data": product})
}

func cancelMusharaka(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	if err := updateMusharakaStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateMusharakaStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateMusharakaStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// IJARA HANDLERS
// ============================================================

func getAllIjara(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	products, err := fetchAllIjara(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Ijara products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getIjaraByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	product, err := fetchIjaraByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForIjara(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		AssetName    string  `json:"asset_name" binding:"required"`
		AssetValue   float64 `json:"asset_value" binding:"required"`
		TenureMonths int     `json:"tenure_months" binding:"required"`
		LeaseType    string  `json:"lease_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate monthly rental (simplified: 10% annual rate)
	monthlyRental := (req.AssetValue * 0.10) / 12

	now := time.Now()
	product := IjaraProduct{
		ID:              "ijara_" + uuid.New().String()[:8],
		TenantID:        tenantID,
		UserID:          userID,
		AssetName:       req.AssetName,
		AssetValue:      req.AssetValue,
		MonthlyRental:   monthlyRental,
		TenureMonths:    req.TenureMonths,
		LeaseType:       LeaseType(req.LeaseType),
		Status:          StatusPending,
		ReferenceNumber: generateReferenceNumber("IJA"),
		ApplicationDate: now,
		CreatedAt:       now,
	}

	if err := saveIjara(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Ijara application", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "ijara").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Ijara application submitted successfully", "data": product})
}

func cancelIjara(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	if err := updateIjaraStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateIjaraStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateIjaraStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// TAKAFUL HANDLERS
// ============================================================

func getAllTakaful(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	products, err := fetchAllTakaful(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Takaful products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getTakafulByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	product, err := fetchTakafulByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForTakaful(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		PolicyType     string  `json:"policy_type" binding:"required"`
		PolicyName     string  `json:"policy_name" binding:"required"`
		CoverageAmount float64 `json:"coverage_amount" binding:"required"`
		Frequency      string  `json:"frequency" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate contribution amount (simplified: 1% of coverage)
	contributionAmount := req.CoverageAmount * 0.01

	now := time.Now()
	product := TakafulProduct{
		ID:                 "takaful_" + uuid.New().String()[:8],
		TenantID:           tenantID,
		UserID:             userID,
		PolicyType:         PolicyType(req.PolicyType),
		PolicyName:         req.PolicyName,
		ContributionAmount: contributionAmount,
		CoverageAmount:     req.CoverageAmount,
		Frequency:          FrequencyType(req.Frequency),
		Status:             StatusPending,
		ReferenceNumber:    generateReferenceNumber("TKF"),
		ApplicationDate:    now,
		CreatedAt:          now,
	}

	if err := saveTakaful(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Takaful application", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "takaful").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Takaful application submitted successfully", "data": product})
}

func cancelTakaful(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	if err := updateTakafulStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateTakafulStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateTakafulStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// SUKUK HANDLERS
// ============================================================

func getAllSukuk(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	products, err := fetchAllSukuk(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Sukuk products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getSukukByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	product, err := fetchSukukByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func investInSukuk(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		SukukType        string  `json:"sukuk_type" binding:"required"`
		SukukName        string  `json:"sukuk_name" binding:"required"`
		InvestmentAmount float64 `json:"investment_amount" binding:"required"`
		TenureMonths     int     `json:"tenure_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Expected return based on sukuk type (simplified)
	expectedReturn := 8.5

	now := time.Now()
	product := SukukProduct{
		ID:               "sukuk_" + uuid.New().String()[:8],
		TenantID:         tenantID,
		UserID:           userID,
		SukukType:        SukukType(req.SukukType),
		SukukName:        req.SukukName,
		InvestmentAmount: req.InvestmentAmount,
		ExpectedReturn:   expectedReturn,
		TenureMonths:     req.TenureMonths,
		Status:           StatusPending,
		ReferenceNumber:  generateReferenceNumber("SKK"),
		ApplicationDate:  now,
		CreatedAt:        now,
	}

	if err := saveSukuk(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Sukuk investment", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "sukuk").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Sukuk investment submitted successfully", "data": product})
}

func cancelSukuk(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	if err := updateSukukStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateSukukStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateSukukStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// COMMON HANDLERS
// ============================================================

func getAllProducts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID, idOK := getUserID(c)
	if !idOK {
		return
	}

	murabaha, _ := fetchAllMurabaha(tenantID, userID)
	musharaka, _ := fetchAllMusharaka(tenantID, userID)
	ijara, _ := fetchAllIjara(tenantID, userID)
	takaful, _ := fetchAllTakaful(tenantID, userID)
	sukuk, _ := fetchAllSukuk(tenantID, userID)

	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"murabaha":  murabaha,
			"musharaka": musharaka,
			"ijara":     ijara,
			"takaful":   takaful,
			"sukuk":     sukuk,
		},
	})
}

func getProductsByTenant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	// Fetch all products for this tenant without user filtering
	murabaha, _ := fetchAllMurabahaByTenant(tenantID)
	musharaka, _ := fetchAllMusharakaByTenant(tenantID)
	ijara, _ := fetchAllIjaraByTenant(tenantID)
	takaful, _ := fetchAllTakafulByTenant(tenantID)
	sukuk, _ := fetchAllSukukByTenant(tenantID)

	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"murabaha":  murabaha,
			"musharaka": musharaka,
			"ijara":     ijara,
			"takaful":   takaful,
			"sukuk":     sukuk,
		},
	})
}

func getProductByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	// Try to fetch from each product type
	if product, err := fetchProductByIDFromAllTypes(id, tenantID); err == nil {
		c.JSON(200, gin.H{"success": true, "data": product})
		return
	}

	SendError(c.Writer, "not_found", "Product not found", http.StatusNotFound, nil)
}

func updateProductStatusGeneric(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)

	// Try to update status in each product type
	if err := updateProductStatusInAllTypes(id, tenantID, status); err != nil {
		SendError(c.Writer, "not_found", "Product not found or update failed", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully"})
}

func cancelProductGeneric(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	// Try to cancel in each product type
	if err := cancelProductInAllTypes(id, tenantID); err != nil {
		SendError(c.Writer, "not_found", "Product not found or cancellation failed", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product cancelled successfully"})
}
