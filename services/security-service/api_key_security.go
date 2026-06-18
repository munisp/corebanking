package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// APIKeyScope represents the scope/permissions of an API key
type APIKeyScope string

const (
	ScopeRead           APIKeyScope = "read"
	ScopeWrite          APIKeyScope = "write"
	ScopeTransfer       APIKeyScope = "transfer"
	ScopeAdmin          APIKeyScope = "admin"
	ScopeWebhooks       APIKeyScope = "webhooks"
	ScopeReports        APIKeyScope = "reports"
	ScopeAccounts       APIKeyScope = "accounts"
	ScopePayments       APIKeyScope = "payments"
	ScopeCards          APIKeyScope = "cards"
	ScopeKYC            APIKeyScope = "kyc"
)

// APIKeyStatus represents the status of an API key
type APIKeyStatus string

const (
	KeyStatusActive    APIKeyStatus = "active"
	KeyStatusRevoked   APIKeyStatus = "revoked"
	KeyStatusExpired   APIKeyStatus = "expired"
	KeyStatusSuspended APIKeyStatus = "suspended"
)

// APIKeyType represents the type of API key
type APIKeyType string

const (
	KeyTypeLive    APIKeyType = "live"
	KeyTypeTest    APIKeyType = "test"
	KeyTypeSandbox APIKeyType = "sandbox"
)

// APIKeyConfig holds configurable API key settings
type APIKeyConfig struct {
	// Key generation
	KeyLength           int  `json:"key_length"`           // Length of the key in bytes
	PrefixLive          string `json:"prefix_live"`        // Prefix for live keys
	PrefixTest          string `json:"prefix_test"`        // Prefix for test keys
	PrefixSandbox       string `json:"prefix_sandbox"`     // Prefix for sandbox keys

	// Expiration
	DefaultExpiryDays   int  `json:"default_expiry_days"` // Default expiry in days (0 = never)
	MaxExpiryDays       int  `json:"max_expiry_days"`     // Maximum allowed expiry
	RotationReminderDays int `json:"rotation_reminder_days"` // Days before expiry to remind

	// Rate limiting
	DefaultRateLimit    int  `json:"default_rate_limit"`    // Requests per minute
	MaxRateLimit        int  `json:"max_rate_limit"`        // Maximum allowed rate limit
	BurstLimit          int  `json:"burst_limit"`           // Burst allowance

	// IP binding
	EnableIPBinding     bool `json:"enable_ip_binding"`     // Require IP whitelist
	MaxIPsPerKey        int  `json:"max_ips_per_key"`       // Maximum IPs per key

	// Security
	RequireMFA          bool `json:"require_mfa"`           // Require MFA for key creation
	LogAllRequests      bool `json:"log_all_requests"`      // Log all API requests
	AlertOnSuspicious   bool `json:"alert_on_suspicious"`   // Alert on suspicious activity
}

// DefaultAPIKeyConfig provides secure defaults
var DefaultAPIKeyConfig = APIKeyConfig{
	KeyLength:            32,
	PrefixLive:           "pk_live_",
	PrefixTest:           "pk_test_",
	PrefixSandbox:        "pk_sandbox_",
	DefaultExpiryDays:    90,
	MaxExpiryDays:        365,
	RotationReminderDays: 14,
	DefaultRateLimit:     1000,
	MaxRateLimit:         10000,
	BurstLimit:           100,
	EnableIPBinding:      true,
	MaxIPsPerKey:         10,
	RequireMFA:           true,
	LogAllRequests:       true,
	AlertOnSuspicious:    true,
}

// APIKey represents an API key
type APIKey struct {
	ID              string       `json:"id"`
	KeyHash         string       `json:"-"`                    // Stored hash, never exposed
	KeyPrefix       string       `json:"key_prefix"`           // First 8 chars for identification
	Name            string       `json:"name"`
	Description     string       `json:"description,omitempty"`
	UserID          string       `json:"user_id"`
	TenantID        string       `json:"tenant_id"`
	Type            APIKeyType   `json:"type"`
	Status          APIKeyStatus `json:"status"`
	Scopes          []APIKeyScope `json:"scopes"`
	AllowedIPs      []string     `json:"allowed_ips,omitempty"`
	RateLimit       int          `json:"rate_limit"`
	BurstLimit      int          `json:"burst_limit"`
	ExpiresAt       *time.Time   `json:"expires_at,omitempty"`
	LastUsedAt      *time.Time   `json:"last_used_at,omitempty"`
	LastUsedIP      string       `json:"last_used_ip,omitempty"`
	UsageCount      int64        `json:"usage_count"`
	CreatedAt       time.Time    `json:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at"`
	CreatedBy       string       `json:"created_by"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// APIKeyValidationResult represents the result of API key validation
type APIKeyValidationResult struct {
	Valid           bool         `json:"valid"`
	Key             *APIKey      `json:"key,omitempty"`
	Reasons         []string     `json:"reasons,omitempty"`
	RateLimited     bool         `json:"rate_limited"`
	RemainingQuota  int          `json:"remaining_quota"`
}

// APIKeyUsageLog represents a log entry for API key usage
type APIKeyUsageLog struct {
	ID          string    `json:"id"`
	KeyID       string    `json:"key_id"`
	Endpoint    string    `json:"endpoint"`
	Method      string    `json:"method"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	StatusCode  int       `json:"status_code"`
	ResponseTime int64    `json:"response_time_ms"`
	RequestSize int64     `json:"request_size"`
	ResponseSize int64    `json:"response_size"`
	Error       string    `json:"error,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

// APIKeySecurityManager manages API key security
type APIKeySecurityManager struct {
	db           *sql.DB
	config       APIKeyConfig
	tenantConfig map[string]APIKeyConfig
	rateLimiter  map[string]*RateLimiter
	mu           sync.RWMutex
}

// RateLimiter implements a token bucket rate limiter
type RateLimiter struct {
	tokens     float64
	maxTokens  float64
	refillRate float64
	lastRefill time.Time
	mu         sync.Mutex
}

// NewAPIKeySecurityManager creates a new API key security manager
func NewAPIKeySecurityManager(db *sql.DB) *APIKeySecurityManager {
	aksm := &APIKeySecurityManager{
		db:           db,
		config:       DefaultAPIKeyConfig,
		tenantConfig: make(map[string]APIKeyConfig),
		rateLimiter:  make(map[string]*RateLimiter),
	}

	// Load environment overrides
	aksm.loadEnvOverrides()

	// Create necessary tables
	aksm.createTables()

	// Load tenant-specific configs
	aksm.loadTenantConfigs()

	// Start background cleanup
	go aksm.backgroundCleanup()

	return aksm
}

func (aksm *APIKeySecurityManager) loadEnvOverrides() {
	if val := os.Getenv("API_KEY_LENGTH"); val != "" {
		if length, err := strconv.Atoi(val); err == nil {
			aksm.config.KeyLength = length
		}
	}
	if val := os.Getenv("API_KEY_DEFAULT_EXPIRY_DAYS"); val != "" {
		if days, err := strconv.Atoi(val); err == nil {
			aksm.config.DefaultExpiryDays = days
		}
	}
	if val := os.Getenv("API_KEY_DEFAULT_RATE_LIMIT"); val != "" {
		if limit, err := strconv.Atoi(val); err == nil {
			aksm.config.DefaultRateLimit = limit
		}
	}
	if val := os.Getenv("API_KEY_ENABLE_IP_BINDING"); val != "" {
		aksm.config.EnableIPBinding = val == "true"
	}
}

func (aksm *APIKeySecurityManager) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS api_key_config (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50) UNIQUE,
		config JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS api_keys (
		id VARCHAR(50) PRIMARY KEY,
		key_hash VARCHAR(64) NOT NULL,
		key_prefix VARCHAR(20) NOT NULL,
		name VARCHAR(100) NOT NULL,
		description TEXT,
		user_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50),
		key_type VARCHAR(20) NOT NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'active',
		scopes JSONB NOT NULL DEFAULT '[]',
		allowed_ips JSONB DEFAULT '[]',
		rate_limit INT NOT NULL DEFAULT 1000,
		burst_limit INT NOT NULL DEFAULT 100,
		expires_at TIMESTAMP,
		last_used_at TIMESTAMP,
		last_used_ip VARCHAR(45),
		usage_count BIGINT DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		created_by VARCHAR(50),
		metadata JSONB DEFAULT '{}'
	);

	CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
	CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
	CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
	CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

	CREATE TABLE IF NOT EXISTS api_key_usage_logs (
		id SERIAL PRIMARY KEY,
		key_id VARCHAR(50) NOT NULL,
		endpoint VARCHAR(255) NOT NULL,
		method VARCHAR(10) NOT NULL,
		ip_address VARCHAR(45),
		user_agent TEXT,
		status_code INT,
		response_time_ms INT,
		request_size BIGINT,
		response_size BIGINT,
		error TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage_logs(key_id);
	CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage_logs(created_at);

	CREATE TABLE IF NOT EXISTS api_key_rate_limits (
		id SERIAL PRIMARY KEY,
		key_id VARCHAR(50) NOT NULL,
		window_start TIMESTAMP NOT NULL,
		request_count INT DEFAULT 0,
		UNIQUE(key_id, window_start)
	);

	CREATE INDEX IF NOT EXISTS idx_api_key_rate_key ON api_key_rate_limits(key_id);
	CREATE INDEX IF NOT EXISTS idx_api_key_rate_window ON api_key_rate_limits(window_start);
	`

	_, err := aksm.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create API key tables: %v", err)
	}
}

func (aksm *APIKeySecurityManager) loadTenantConfigs() {
	rows, err := aksm.db.Query(`SELECT tenant_id, config FROM api_key_config WHERE tenant_id IS NOT NULL`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant API key configs: %v", err)
		return
	}
	defer rows.Close()

	aksm.mu.Lock()
	defer aksm.mu.Unlock()

	for rows.Next() {
		var tenantID string
		var configJSON []byte
		if err := rows.Scan(&tenantID, &configJSON); err != nil {
			continue
		}

		var config APIKeyConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			continue
		}

		aksm.tenantConfig[tenantID] = config
	}
}

// GetConfig returns the applicable API key config
func (aksm *APIKeySecurityManager) GetConfig(tenantID string) APIKeyConfig {
	aksm.mu.RLock()
	defer aksm.mu.RUnlock()

	if tenantID != "" {
		if config, ok := aksm.tenantConfig[tenantID]; ok {
			return config
		}
	}

	return aksm.config
}

// GenerateAPIKey generates a new API key
func (aksm *APIKeySecurityManager) GenerateAPIKey(
	name, description, userID, tenantID, createdBy string,
	keyType APIKeyType,
	scopes []APIKeyScope,
	allowedIPs []string,
	rateLimit int,
	expiryDays int,
) (*APIKey, string, error) {
	config := aksm.GetConfig(tenantID)

	// Validate inputs
	if name == "" {
		return nil, "", fmt.Errorf("key name is required")
	}
	if len(scopes) == 0 {
		return nil, "", fmt.Errorf("at least one scope is required")
	}

	// Apply defaults and limits
	if rateLimit <= 0 {
		rateLimit = config.DefaultRateLimit
	}
	if rateLimit > config.MaxRateLimit {
		rateLimit = config.MaxRateLimit
	}

	if expiryDays <= 0 {
		expiryDays = config.DefaultExpiryDays
	}
	if expiryDays > config.MaxExpiryDays {
		expiryDays = config.MaxExpiryDays
	}

	// Validate IPs
	if config.EnableIPBinding && len(allowedIPs) == 0 {
		return nil, "", fmt.Errorf("IP binding is required")
	}
	if len(allowedIPs) > config.MaxIPsPerKey {
		return nil, "", fmt.Errorf("maximum %d IPs allowed per key", config.MaxIPsPerKey)
	}
	for _, ip := range allowedIPs {
		if net.ParseIP(ip) == nil {
			// Check if it's a CIDR
			_, _, err := net.ParseCIDR(ip)
			if err != nil {
				return nil, "", fmt.Errorf("invalid IP address or CIDR: %s", ip)
			}
		}
	}

	// Generate the key
	keyBytes := make([]byte, config.KeyLength)
	if _, err := rand.Read(keyBytes); err != nil {
		return nil, "", fmt.Errorf("failed to generate key: %v", err)
	}

	// Create the full key with prefix
	var prefix string
	switch keyType {
	case KeyTypeLive:
		prefix = config.PrefixLive
	case KeyTypeTest:
		prefix = config.PrefixTest
	case KeyTypeSandbox:
		prefix = config.PrefixSandbox
	default:
		prefix = config.PrefixTest
	}

	rawKey := hex.EncodeToString(keyBytes)
	fullKey := prefix + rawKey

	// Hash the key for storage
	keyHash := hashAPIKey(fullKey)

	// Create the key record
	keyID := fmt.Sprintf("key_%d", time.Now().UnixNano())
	keyPrefix := fullKey[:min(len(fullKey), 16)]

	var expiresAt *time.Time
	if expiryDays > 0 {
		t := time.Now().AddDate(0, 0, expiryDays)
		expiresAt = &t
	}

	scopesJSON, _ := json.Marshal(scopes)
	allowedIPsJSON, _ := json.Marshal(allowedIPs)

	_, err := aksm.db.Exec(`
		INSERT INTO api_keys (id, key_hash, key_prefix, name, description, user_id, tenant_id,
		                      key_type, status, scopes, allowed_ips, rate_limit, burst_limit,
		                      expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`, keyID, keyHash, keyPrefix, name, description, userID, tenantID,
		keyType, KeyStatusActive, scopesJSON, allowedIPsJSON, rateLimit,
		config.BurstLimit, expiresAt, createdBy)

	if err != nil {
		return nil, "", fmt.Errorf("failed to store API key: %v", err)
	}

	apiKey := &APIKey{
		ID:          keyID,
		KeyPrefix:   keyPrefix,
		Name:        name,
		Description: description,
		UserID:      userID,
		TenantID:    tenantID,
		Type:        keyType,
		Status:      KeyStatusActive,
		Scopes:      scopes,
		AllowedIPs:  allowedIPs,
		RateLimit:   rateLimit,
		BurstLimit:  config.BurstLimit,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CreatedBy:   createdBy,
	}

	return apiKey, fullKey, nil
}

func hashAPIKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ValidateAPIKey validates an API key and checks permissions
func (aksm *APIKeySecurityManager) ValidateAPIKey(key, ipAddress string, requiredScopes []APIKeyScope) (*APIKeyValidationResult, error) {
	result := &APIKeyValidationResult{
		Valid:   false,
		Reasons: []string{},
	}

	// Hash the key for lookup
	keyHash := hashAPIKey(key)

	// Look up the key
	var apiKey APIKey
	var scopesJSON, allowedIPsJSON, metadataJSON []byte
	var expiresAt, lastUsedAt sql.NullTime
	var lastUsedIP sql.NullString

	err := aksm.db.QueryRow(`
		SELECT id, key_prefix, name, description, user_id, tenant_id, key_type, status,
		       scopes, allowed_ips, rate_limit, burst_limit, expires_at, last_used_at,
		       last_used_ip, usage_count, created_at, updated_at, created_by, metadata
		FROM api_keys
		WHERE key_hash = $1
	`, keyHash).Scan(
		&apiKey.ID, &apiKey.KeyPrefix, &apiKey.Name, &apiKey.Description,
		&apiKey.UserID, &apiKey.TenantID, &apiKey.Type, &apiKey.Status,
		&scopesJSON, &allowedIPsJSON, &apiKey.RateLimit, &apiKey.BurstLimit,
		&expiresAt, &lastUsedAt, &lastUsedIP, &apiKey.UsageCount,
		&apiKey.CreatedAt, &apiKey.UpdatedAt, &apiKey.CreatedBy, &metadataJSON,
	)

	if err == sql.ErrNoRows {
		result.Reasons = append(result.Reasons, "Invalid API key")
		return result, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to validate API key: %v", err)
	}

	// Parse JSON fields
	json.Unmarshal(scopesJSON, &apiKey.Scopes)
	json.Unmarshal(allowedIPsJSON, &apiKey.AllowedIPs)
	json.Unmarshal(metadataJSON, &apiKey.Metadata)

	if expiresAt.Valid {
		apiKey.ExpiresAt = &expiresAt.Time
	}
	if lastUsedAt.Valid {
		apiKey.LastUsedAt = &lastUsedAt.Time
	}
	if lastUsedIP.Valid {
		apiKey.LastUsedIP = lastUsedIP.String
	}

	result.Key = &apiKey

	// Check status
	if apiKey.Status != KeyStatusActive {
		result.Reasons = append(result.Reasons, fmt.Sprintf("API key is %s", apiKey.Status))
		return result, nil
	}

	// Check expiration
	if apiKey.ExpiresAt != nil && time.Now().After(*apiKey.ExpiresAt) {
		result.Reasons = append(result.Reasons, "API key has expired")
		// Update status to expired
		aksm.db.Exec(`UPDATE api_keys SET status = $1 WHERE id = $2`, KeyStatusExpired, apiKey.ID)
		return result, nil
	}

	// Check IP binding
	if len(apiKey.AllowedIPs) > 0 && ipAddress != "" {
		ipAllowed := false
		for _, allowedIP := range apiKey.AllowedIPs {
			if allowedIP == ipAddress {
				ipAllowed = true
				break
			}
			// Check CIDR
			_, cidr, err := net.ParseCIDR(allowedIP)
			if err == nil && cidr.Contains(net.ParseIP(ipAddress)) {
				ipAllowed = true
				break
			}
		}
		if !ipAllowed {
			result.Reasons = append(result.Reasons, "IP address not allowed for this API key")
			return result, nil
		}
	}

	// Check scopes
	if len(requiredScopes) > 0 {
		for _, required := range requiredScopes {
			hasScope := false
			for _, scope := range apiKey.Scopes {
				if scope == required || scope == ScopeAdmin {
					hasScope = true
					break
				}
			}
			if !hasScope {
				result.Reasons = append(result.Reasons, fmt.Sprintf("Missing required scope: %s", required))
				return result, nil
			}
		}
	}

	// Check rate limit
	rateLimited, remaining := aksm.checkRateLimit(apiKey.ID, apiKey.RateLimit, apiKey.BurstLimit)
	result.RemainingQuota = remaining
	if rateLimited {
		result.RateLimited = true
		result.Reasons = append(result.Reasons, "Rate limit exceeded")
		return result, nil
	}

	// Update last used
	aksm.db.Exec(`
		UPDATE api_keys
		SET last_used_at = NOW(), last_used_ip = $1, usage_count = usage_count + 1, updated_at = NOW()
		WHERE id = $2
	`, ipAddress, apiKey.ID)

	result.Valid = true
	return result, nil
}

func (aksm *APIKeySecurityManager) checkRateLimit(keyID string, rateLimit, burstLimit int) (bool, int) {
	aksm.mu.Lock()
	limiter, exists := aksm.rateLimiter[keyID]
	if !exists {
		limiter = &RateLimiter{
			tokens:     float64(burstLimit),
			maxTokens:  float64(burstLimit),
			refillRate: float64(rateLimit) / 60.0, // tokens per second
			lastRefill: time.Now(),
		}
		aksm.rateLimiter[keyID] = limiter
	}
	aksm.mu.Unlock()

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(limiter.lastRefill).Seconds()
	limiter.tokens += elapsed * limiter.refillRate
	if limiter.tokens > limiter.maxTokens {
		limiter.tokens = limiter.maxTokens
	}
	limiter.lastRefill = now

	// Check if we have tokens
	if limiter.tokens < 1 {
		return true, 0
	}

	// Consume a token
	limiter.tokens--
	return false, int(limiter.tokens)
}

// LogAPIKeyUsage logs an API key usage event
func (aksm *APIKeySecurityManager) LogAPIKeyUsage(log APIKeyUsageLog) error {
	_, err := aksm.db.Exec(`
		INSERT INTO api_key_usage_logs (key_id, endpoint, method, ip_address, user_agent,
		                                status_code, response_time_ms, request_size, response_size, error)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, log.KeyID, log.Endpoint, log.Method, log.IPAddress, log.UserAgent,
		log.StatusCode, log.ResponseTime, log.RequestSize, log.ResponseSize, log.Error)
	return err
}

// RevokeAPIKey revokes an API key
func (aksm *APIKeySecurityManager) RevokeAPIKey(keyID, revokedBy, reason string) error {
	result, err := aksm.db.Exec(`
		UPDATE api_keys
		SET status = $1, updated_at = NOW()
		WHERE id = $2 AND status = $3
	`, KeyStatusRevoked, keyID, KeyStatusActive)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("API key not found or already revoked")
	}

	// Clear rate limiter
	aksm.mu.Lock()
	delete(aksm.rateLimiter, keyID)
	aksm.mu.Unlock()

	return nil
}

// RotateAPIKey creates a new key and revokes the old one
func (aksm *APIKeySecurityManager) RotateAPIKey(oldKeyID, rotatedBy string) (*APIKey, string, error) {
	// Get the old key details
	var oldKey APIKey
	var scopesJSON, allowedIPsJSON []byte
	var expiresAt sql.NullTime

	err := aksm.db.QueryRow(`
		SELECT name, description, user_id, tenant_id, key_type, scopes, allowed_ips, rate_limit, expires_at
		FROM api_keys
		WHERE id = $1 AND status = $2
	`, oldKeyID, KeyStatusActive).Scan(
		&oldKey.Name, &oldKey.Description, &oldKey.UserID, &oldKey.TenantID,
		&oldKey.Type, &scopesJSON, &allowedIPsJSON, &oldKey.RateLimit, &expiresAt,
	)

	if err == sql.ErrNoRows {
		return nil, "", fmt.Errorf("API key not found or not active")
	}
	if err != nil {
		return nil, "", err
	}

	json.Unmarshal(scopesJSON, &oldKey.Scopes)
	json.Unmarshal(allowedIPsJSON, &oldKey.AllowedIPs)

	// Calculate remaining days until expiry
	expiryDays := 90 // Default
	if expiresAt.Valid {
		remaining := int(time.Until(expiresAt.Time).Hours() / 24)
		if remaining > 0 {
			expiryDays = remaining
		}
	}

	// Generate new key
	newKey, rawKey, err := aksm.GenerateAPIKey(
		oldKey.Name+" (rotated)",
		oldKey.Description,
		oldKey.UserID,
		oldKey.TenantID,
		rotatedBy,
		oldKey.Type,
		oldKey.Scopes,
		oldKey.AllowedIPs,
		oldKey.RateLimit,
		expiryDays,
	)

	if err != nil {
		return nil, "", err
	}

	// Revoke old key
	aksm.RevokeAPIKey(oldKeyID, rotatedBy, "Rotated")

	return newKey, rawKey, nil
}

// GetAPIKeys retrieves API keys for a user
func (aksm *APIKeySecurityManager) GetAPIKeys(userID, tenantID string, includeRevoked bool) ([]APIKey, error) {
	query := `
		SELECT id, key_prefix, name, description, user_id, tenant_id, key_type, status,
		       scopes, allowed_ips, rate_limit, burst_limit, expires_at, last_used_at,
		       last_used_ip, usage_count, created_at, updated_at, created_by
		FROM api_keys
		WHERE user_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
	`
	if !includeRevoked {
		query += " AND status != 'revoked'"
	}
	query += " ORDER BY created_at DESC"

	rows, err := aksm.db.Query(query, userID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var key APIKey
		var scopesJSON, allowedIPsJSON []byte
		var expiresAt, lastUsedAt sql.NullTime
		var lastUsedIP sql.NullString

		err := rows.Scan(
			&key.ID, &key.KeyPrefix, &key.Name, &key.Description,
			&key.UserID, &key.TenantID, &key.Type, &key.Status,
			&scopesJSON, &allowedIPsJSON, &key.RateLimit, &key.BurstLimit,
			&expiresAt, &lastUsedAt, &lastUsedIP, &key.UsageCount,
			&key.CreatedAt, &key.UpdatedAt, &key.CreatedBy,
		)
		if err != nil {
			continue
		}

		json.Unmarshal(scopesJSON, &key.Scopes)
		json.Unmarshal(allowedIPsJSON, &key.AllowedIPs)

		if expiresAt.Valid {
			key.ExpiresAt = &expiresAt.Time
		}
		if lastUsedAt.Valid {
			key.LastUsedAt = &lastUsedAt.Time
		}
		if lastUsedIP.Valid {
			key.LastUsedIP = lastUsedIP.String
		}

		keys = append(keys, key)
	}

	return keys, nil
}

// GetAPIKeyUsageStats retrieves usage statistics for an API key
func (aksm *APIKeySecurityManager) GetAPIKeyUsageStats(keyID string, days int) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total requests
	var totalRequests int64
	aksm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage_logs
		WHERE key_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
	`, keyID, days).Scan(&totalRequests)
	stats["total_requests"] = totalRequests

	// Requests by status code
	rows, err := aksm.db.Query(`
		SELECT status_code, COUNT(*) as count
		FROM api_key_usage_logs
		WHERE key_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
		GROUP BY status_code
		ORDER BY count DESC
	`, keyID, days)
	if err == nil {
		statusCodes := make(map[int]int64)
		for rows.Next() {
			var code int
			var count int64
			rows.Scan(&code, &count)
			statusCodes[code] = count
		}
		rows.Close()
		stats["status_codes"] = statusCodes
	}

	// Average response time
	var avgResponseTime float64
	aksm.db.QueryRow(`
		SELECT COALESCE(AVG(response_time_ms), 0)
		FROM api_key_usage_logs
		WHERE key_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
	`, keyID, days).Scan(&avgResponseTime)
	stats["avg_response_time_ms"] = avgResponseTime

	// Top endpoints
	rows, err = aksm.db.Query(`
		SELECT endpoint, COUNT(*) as count
		FROM api_key_usage_logs
		WHERE key_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
		GROUP BY endpoint
		ORDER BY count DESC
		LIMIT 10
	`, keyID, days)
	if err == nil {
		endpoints := make(map[string]int64)
		for rows.Next() {
			var endpoint string
			var count int64
			rows.Scan(&endpoint, &count)
			endpoints[endpoint] = count
		}
		rows.Close()
		stats["top_endpoints"] = endpoints
	}

	// Error rate
	var errorCount int64
	aksm.db.QueryRow(`
		SELECT COUNT(*) FROM api_key_usage_logs
		WHERE key_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
		AND (status_code >= 400 OR error IS NOT NULL)
	`, keyID, days).Scan(&errorCount)
	if totalRequests > 0 {
		stats["error_rate"] = float64(errorCount) / float64(totalRequests) * 100
	} else {
		stats["error_rate"] = 0.0
	}

	return stats, nil
}

// UpdateAPIKeyScopes updates the scopes of an API key
func (aksm *APIKeySecurityManager) UpdateAPIKeyScopes(keyID string, scopes []APIKeyScope) error {
	scopesJSON, _ := json.Marshal(scopes)
	_, err := aksm.db.Exec(`
		UPDATE api_keys
		SET scopes = $1, updated_at = NOW()
		WHERE id = $2 AND status = $3
	`, scopesJSON, keyID, KeyStatusActive)
	return err
}

// UpdateAPIKeyIPs updates the allowed IPs of an API key
func (aksm *APIKeySecurityManager) UpdateAPIKeyIPs(keyID string, allowedIPs []string, tenantID string) error {
	config := aksm.GetConfig(tenantID)

	if len(allowedIPs) > config.MaxIPsPerKey {
		return fmt.Errorf("maximum %d IPs allowed per key", config.MaxIPsPerKey)
	}

	for _, ip := range allowedIPs {
		if net.ParseIP(ip) == nil {
			_, _, err := net.ParseCIDR(ip)
			if err != nil {
				return fmt.Errorf("invalid IP address or CIDR: %s", ip)
			}
		}
	}

	allowedIPsJSON, _ := json.Marshal(allowedIPs)
	_, err := aksm.db.Exec(`
		UPDATE api_keys
		SET allowed_ips = $1, updated_at = NOW()
		WHERE id = $2 AND status = $3
	`, allowedIPsJSON, keyID, KeyStatusActive)
	return err
}

// GetExpiringKeys returns keys that will expire soon
func (aksm *APIKeySecurityManager) GetExpiringKeys(tenantID string, daysUntilExpiry int) ([]APIKey, error) {
	rows, err := aksm.db.Query(`
		SELECT id, key_prefix, name, user_id, tenant_id, expires_at
		FROM api_keys
		WHERE status = $1
		AND (tenant_id = $2 OR tenant_id IS NULL)
		AND expires_at IS NOT NULL
		AND expires_at <= NOW() + INTERVAL '1 day' * $3
		AND expires_at > NOW()
		ORDER BY expires_at ASC
	`, KeyStatusActive, tenantID, daysUntilExpiry)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []APIKey
	for rows.Next() {
		var key APIKey
		var expiresAt time.Time
		err := rows.Scan(&key.ID, &key.KeyPrefix, &key.Name, &key.UserID, &key.TenantID, &expiresAt)
		if err != nil {
			continue
		}
		key.ExpiresAt = &expiresAt
		keys = append(keys, key)
	}

	return keys, nil
}

func (aksm *APIKeySecurityManager) backgroundCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		// Expire old keys
		aksm.db.Exec(`
			UPDATE api_keys
			SET status = $1, updated_at = NOW()
			WHERE status = $2 AND expires_at < NOW()
		`, KeyStatusExpired, KeyStatusActive)

		// Clean up old usage logs (keep 90 days)
		aksm.db.Exec(`
			DELETE FROM api_key_usage_logs
			WHERE created_at < NOW() - INTERVAL '90 days'
		`)

		// Clean up old rate limit data
		aksm.db.Exec(`
			DELETE FROM api_key_rate_limits
			WHERE window_start < NOW() - INTERVAL '1 hour'
		`)

		// Clean up in-memory rate limiters for inactive keys
		aksm.mu.Lock()
		for keyID, limiter := range aksm.rateLimiter {
			limiter.mu.Lock()
			if time.Since(limiter.lastRefill) > 1*time.Hour {
				delete(aksm.rateLimiter, keyID)
			}
			limiter.mu.Unlock()
		}
		aksm.mu.Unlock()
	}
}

// HasScope checks if an API key has a specific scope
func HasScope(key *APIKey, scope APIKeyScope) bool {
	for _, s := range key.Scopes {
		if s == scope || s == ScopeAdmin {
			return true
		}
	}
	return false
}

// ParseAPIKeyFromHeader extracts the API key from an Authorization header
func ParseAPIKeyFromHeader(header string) string {
	if strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}
	if strings.HasPrefix(header, "ApiKey ") {
		return strings.TrimPrefix(header, "ApiKey ")
	}
	return header
}
