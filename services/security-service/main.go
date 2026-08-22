package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
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
	srv.setupRoutes(r)

	log.Printf("Security service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
