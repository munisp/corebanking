package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Server struct {
	db          *sql.DB
	apiKeyMgr   *APIKeySecurityManager
	auditMgr    *AuditTrailManager
	fraudMgr    *FraudDetectionEngine
	ipMgr       *IPSecurityManager
	passwordMgr *PasswordPolicyManager
	txLimitMgr  *TransactionLimitManager
}

func NewServer(db *sql.DB) *Server {
	return &Server{
		db:          db,
		apiKeyMgr:   NewAPIKeySecurityManager(db),
		auditMgr:    NewAuditTrailManager(db),
		fraudMgr:    NewFraudDetectionEngine(db),
		ipMgr:       NewIPSecurityManager(db),
		passwordMgr: NewPasswordPolicyManager(db),
		txLimitMgr:  NewTransactionLimitManager(db),
	}
}

func (s *Server) setupRoutes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})
	r.GET("/ready", func(c *gin.Context) {
		if err := s.db.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not ready", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	api := r.Group("/api/v1")

	// --- API Key endpoints ---
	api.POST("/api-keys", s.generateAPIKey)
	api.POST("/api-keys/validate", s.validateAPIKey)
	api.DELETE("/api-keys/:id", s.revokeAPIKey)
	api.POST("/api-keys/:id/rotate", s.rotateAPIKey)
	api.GET("/api-keys", s.listAPIKeys)

	// --- Fraud detection endpoints ---
	api.POST("/fraud/check", s.checkFraud)
	api.GET("/fraud/alerts", s.getFraudAlerts)
	api.PUT("/fraud/alerts/:id/review", s.reviewFraudAlert)

	// --- IP security endpoints ---
	api.POST("/ip/check", s.checkIP)
	api.POST("/ip/block", s.blockIP)
	api.POST("/ip/unblock", s.unblockIP)
	api.POST("/ip/whitelist", s.addToWhitelist)
	api.GET("/ip/blocked", s.getBlockedIPs)

	// --- Password policy endpoints ---
	api.POST("/password/validate", s.validatePassword)
	api.GET("/password/requirements", s.getPasswordRequirements)

	// --- Transaction limit endpoints ---
	api.POST("/transactions/check", s.checkTransactionLimits)
	api.POST("/transactions/record", s.recordTransaction)

	// --- Audit trail endpoints ---
	api.POST("/audit/log", s.logAuditEvent)
	api.GET("/audit/query", s.queryAuditTrail)
}

// --- API Key handlers ---

func (s *Server) generateAPIKey(c *gin.Context) {
	var req struct {
		Name        string        `json:"name" binding:"required"`
		Description string        `json:"description"`
		UserID      string        `json:"user_id" binding:"required"`
		TenantID    string        `json:"tenant_id" binding:"required"`
		CreatedBy   string        `json:"created_by" binding:"required"`
		Type        APIKeyType    `json:"type"`
		Scopes      []APIKeyScope `json:"scopes" binding:"required"`
		AllowedIPs  []string      `json:"allowed_ips"`
		RateLimit   int           `json:"rate_limit"`
		ExpiryDays  int           `json:"expiry_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	key, rawKey, err := s.apiKeyMgr.GenerateAPIKey(
		req.Name, req.Description, req.UserID, req.TenantID, req.CreatedBy,
		req.Type, req.Scopes, req.AllowedIPs, req.RateLimit, req.ExpiryDays,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"key": key, "raw_key": rawKey})
}

func (s *Server) validateAPIKey(c *gin.Context) {
	var req struct {
		Key            string        `json:"key" binding:"required"`
		IPAddress      string        `json:"ip_address"`
		RequiredScopes []APIKeyScope `json:"required_scopes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.apiKeyMgr.ValidateAPIKey(req.Key, req.IPAddress, req.RequiredScopes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) revokeAPIKey(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		RevokedBy string `json:"revoked_by" binding:"required"`
		Reason    string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.apiKeyMgr.RevokeAPIKey(id, req.RevokedBy, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "revoked"})
}

func (s *Server) rotateAPIKey(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		RotatedBy string `json:"rotated_by" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	key, rawKey, err := s.apiKeyMgr.RotateAPIKey(id, req.RotatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"key": key, "raw_key": rawKey})
}

func (s *Server) listAPIKeys(c *gin.Context) {
	userID := c.Query("user_id")
	tenantID := c.Query("tenant_id")
	includeRevoked := c.Query("include_revoked") == "true"
	keys, err := s.apiKeyMgr.GetAPIKeys(userID, tenantID, includeRevoked)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"keys": keys})
}

// --- Fraud detection handlers ---

func (s *Server) checkFraud(c *gin.Context) {
	var req FraudCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.fraudMgr.CheckFraud(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) getFraudAlerts(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	alerts, err := s.fraudMgr.GetFraudAlerts(tenantID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (s *Server) reviewFraudAlert(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ReviewedBy string `json:"reviewed_by" binding:"required"`
		Status     string `json:"status" binding:"required"`
		Notes      string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.fraudMgr.ReviewFraudAlert(id, req.ReviewedBy, req.Status, req.Notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "reviewed"})
}

// --- IP security handlers ---

func (s *Server) checkIP(c *gin.Context) {
	var req struct {
		IPAddress string `json:"ip_address" binding:"required"`
		TenantID  string `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.ipMgr.CheckIP(req.IPAddress, req.TenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) blockIP(c *gin.Context) {
	var req struct {
		IPAddress string `json:"ip_address" binding:"required"`
		TenantID  string `json:"tenant_id"`
		Reason    string `json:"reason"`
		DurationH int    `json:"duration_hours"`
		BlockedBy string `json:"blocked_by" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	dur := time.Duration(req.DurationH) * time.Hour
	if dur == 0 {
		dur = 24 * time.Hour
	}
	if err := s.ipMgr.BlockIP(req.IPAddress, req.TenantID, req.Reason, dur, req.BlockedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "blocked"})
}

func (s *Server) unblockIP(c *gin.Context) {
	var req struct {
		IPAddress string `json:"ip_address" binding:"required"`
		TenantID  string `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.ipMgr.UnblockIP(req.IPAddress, req.TenantID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "unblocked"})
}

func (s *Server) addToWhitelist(c *gin.Context) {
	var req struct {
		IPAddress   string `json:"ip_address" binding:"required"`
		TenantID    string `json:"tenant_id"`
		Description string `json:"description"`
		AddedBy     string `json:"added_by" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.ipMgr.AddToWhitelist(req.IPAddress, req.TenantID, req.Description, req.AddedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "whitelisted"})
}

func (s *Server) getBlockedIPs(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	ips, err := s.ipMgr.GetBlockedIPs(tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"blocked_ips": ips})
}

// --- Password policy handlers ---

func (s *Server) validatePassword(c *gin.Context) {
	var req struct {
		Password string           `json:"password" binding:"required"`
		UserInfo UserPasswordInfo `json:"user_info"`
		TenantID string           `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result := s.passwordMgr.ValidatePassword(req.Password, req.UserInfo, req.TenantID)
	c.JSON(http.StatusOK, result)
}

func (s *Server) getPasswordRequirements(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	requirements := s.passwordMgr.GetPasswordRequirements(tenantID)
	c.JSON(http.StatusOK, gin.H{"requirements": requirements})
}

// --- Transaction limit handlers ---

func (s *Server) checkTransactionLimits(c *gin.Context) {
	var req struct {
		Transaction TransactionRequest `json:"transaction" binding:"required"`
		Tier        UserTier           `json:"tier"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := s.txLimitMgr.CheckTransactionLimits(req.Transaction, req.Tier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) recordTransaction(c *gin.Context) {
	var req TransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.txLimitMgr.RecordTransaction(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "recorded"})
}

// --- Audit trail handlers ---

func (s *Server) logAuditEvent(c *gin.Context) {
	var entry AuditEntry
	if err := c.ShouldBindJSON(&entry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := s.auditMgr.LogEvent(entry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "logged"})
}

func (s *Server) queryAuditTrail(c *gin.Context) {
	filters := AuditQueryFilters{
		TenantID:  c.Query("tenant_id"),
		UserID:    c.Query("user_id"),
		IPAddress: c.Query("ip_address"),
	}
	if v := c.Query("event_types"); v != "" {
		for _, et := range strings.Split(v, ",") {
			filters.EventTypes = append(filters.EventTypes, strings.TrimSpace(et))
		}
	}
	if v := c.Query("limit"); v != "" {
		filters.Limit, _ = strconv.Atoi(v)
	}
	if v := c.Query("offset"); v != "" {
		filters.Offset, _ = strconv.Atoi(v)
	}
	entries, total, err := s.auditMgr.QueryAuditTrail(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"entries": entries, "total": total})
}

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
	port := getEnv("PORT", "8080")
	// DATABASE_URL is REQUIRED — no credential-bearing default. Fail fast at startup.
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatalf("[security-service] DATABASE_URL env var is required; refusing to start with default database credentials")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	srv := NewServer(db)

	r := gin.Default()
	r.Use(jwtAuthMiddleware())
	srv.setupRoutes(r)

	log.Printf("Security service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
