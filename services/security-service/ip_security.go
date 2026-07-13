package main

import (
	"database/sql"
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

// IPSecurityConfig holds configurable IP security settings
type IPSecurityConfig struct {
	// Auto-blocking settings
	EnableAutoBlock           bool `json:"enable_auto_block"`
	FailedAttemptsThreshold   int  `json:"failed_attempts_threshold"`
	BlockDurationMinutes      int  `json:"block_duration_minutes"`
	SuspicionScoreThreshold   int  `json:"suspicion_score_threshold"`
	SuspicionScoreDecayHours  int  `json:"suspicion_score_decay_hours"`

	// Geo-restriction settings
	EnableGeoRestriction      bool     `json:"enable_geo_restriction"`
	AllowedCountries          []string `json:"allowed_countries"`
	BlockedCountries          []string `json:"blocked_countries"`
	HighRiskCountries         []string `json:"high_risk_countries"`
	HomeCountry               string   `json:"home_country"`

	// VPN/Proxy detection
	EnableVPNDetection        bool `json:"enable_vpn_detection"`
	BlockVPN                  bool `json:"block_vpn"`
	BlockTor                  bool `json:"block_tor"`
	BlockProxy                bool `json:"block_proxy"`
	BlockDatacenter           bool `json:"block_datacenter"`

	// Rate limiting
	MaxRequestsPerMinute      int `json:"max_requests_per_minute"`
	MaxRequestsPerHour        int `json:"max_requests_per_hour"`
	MaxLoginAttemptsPerHour   int `json:"max_login_attempts_per_hour"`

	// Whitelist/Blacklist
	EnableWhitelist           bool `json:"enable_whitelist"`
	EnableBlacklist           bool `json:"enable_blacklist"`
}

// DefaultIPSecurityConfig provides secure defaults
var DefaultIPSecurityConfig = IPSecurityConfig{
	EnableAutoBlock:          true,
	FailedAttemptsThreshold:  10,
	BlockDurationMinutes:     60,
	SuspicionScoreThreshold:  100,
	SuspicionScoreDecayHours: 24,

	EnableGeoRestriction:     false, // Default to global access for BaaS
	AllowedCountries:         []string{}, // Empty = all allowed
	BlockedCountries:         []string{},
	HighRiskCountries:        []string{"KP", "IR", "SY", "CU"}, // Sanctioned countries
	HomeCountry:              "NG", // Nigeria

	EnableVPNDetection:       true,
	BlockVPN:                 false, // Don't block, but flag for step-up auth
	BlockTor:                 true,  // Block Tor by default
	BlockProxy:               false, // Don't block, but flag
	BlockDatacenter:          false, // Don't block, but flag

	MaxRequestsPerMinute:     100,
	MaxRequestsPerHour:       1000,
	MaxLoginAttemptsPerHour:  20,

	EnableWhitelist:          false,
	EnableBlacklist:          true,
}

// IPType represents the type of IP address
type IPType string

const (
	IPTypeResidential IPType = "residential"
	IPTypeDatacenter  IPType = "datacenter"
	IPTypeVPN         IPType = "vpn"
	IPTypeTor         IPType = "tor"
	IPTypeProxy       IPType = "proxy"
	IPTypeUnknown     IPType = "unknown"
)

// IPInfo holds information about an IP address
type IPInfo struct {
	IP            string    `json:"ip"`
	Type          IPType    `json:"type"`
	CountryCode   string    `json:"country_code"`
	CountryName   string    `json:"country_name"`
	City          string    `json:"city"`
	Region        string    `json:"region"`
	ISP           string    `json:"isp"`
	Organization  string    `json:"organization"`
	ASN           string    `json:"asn"`
	IsVPN         bool      `json:"is_vpn"`
	IsTor         bool      `json:"is_tor"`
	IsProxy       bool      `json:"is_proxy"`
	IsDatacenter  bool      `json:"is_datacenter"`
	ThreatScore   int       `json:"threat_score"`
	LastChecked   time.Time `json:"last_checked"`
}

// IPCheckResult represents the result of an IP security check
type IPCheckResult struct {
	Allowed         bool     `json:"allowed"`
	RequiresMFA     bool     `json:"requires_mfa"`
	RequiresReview  bool     `json:"requires_review"`
	RiskScore       int      `json:"risk_score"`
	Reasons         []string `json:"reasons"`
	IPInfo          *IPInfo  `json:"ip_info,omitempty"`
	BlockedUntil    *time.Time `json:"blocked_until,omitempty"`
}

// IPSecurityManager manages IP-based security
type IPSecurityManager struct {
	db           *sql.DB
	config       IPSecurityConfig
	tenantConfig map[string]IPSecurityConfig
	ipCache      map[string]*IPInfo
	mu           sync.RWMutex
}

// NewIPSecurityManager creates a new IP security manager
func NewIPSecurityManager(db *sql.DB) *IPSecurityManager {
	ism := &IPSecurityManager{
		db:           db,
		config:       DefaultIPSecurityConfig,
		tenantConfig: make(map[string]IPSecurityConfig),
		ipCache:      make(map[string]*IPInfo),
	}

	// Load environment overrides
	ism.loadEnvOverrides()

	// Create necessary tables
	ism.createTables()

	// Load tenant-specific configs
	ism.loadTenantConfigs()

	// Start background cleanup
	go ism.backgroundCleanup()

	return ism
}

func (ism *IPSecurityManager) loadEnvOverrides() {
	if val := os.Getenv("IP_BLOCK_DURATION_MINUTES"); val != "" {
		if mins, err := strconv.Atoi(val); err == nil {
			ism.config.BlockDurationMinutes = mins
		}
	}
	if val := os.Getenv("IP_FAILED_ATTEMPTS_THRESHOLD"); val != "" {
		if threshold, err := strconv.Atoi(val); err == nil {
			ism.config.FailedAttemptsThreshold = threshold
		}
	}
	if val := os.Getenv("IP_HOME_COUNTRY"); val != "" {
		ism.config.HomeCountry = val
	}
	if val := os.Getenv("IP_BLOCK_TOR"); val != "" {
		ism.config.BlockTor = val == "true"
	}
	if val := os.Getenv("IP_BLOCK_VPN"); val != "" {
		ism.config.BlockVPN = val == "true"
	}
}

func (ism *IPSecurityManager) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS ip_security_config (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50) UNIQUE,
		config JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS ip_blocklist (
		id SERIAL PRIMARY KEY,
		ip_address VARCHAR(45) NOT NULL,
		cidr_range VARCHAR(50),
		tenant_id VARCHAR(50),
		reason VARCHAR(255),
		blocked_by VARCHAR(50),
		blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		expires_at TIMESTAMP,
		is_permanent BOOLEAN DEFAULT FALSE,
		UNIQUE(ip_address, tenant_id)
	);

	CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip ON ip_blocklist(ip_address);
	CREATE INDEX IF NOT EXISTS idx_ip_blocklist_expires ON ip_blocklist(expires_at);

	CREATE TABLE IF NOT EXISTS ip_whitelist (
		id SERIAL PRIMARY KEY,
		ip_address VARCHAR(45) NOT NULL,
		cidr_range VARCHAR(50),
		tenant_id VARCHAR(50),
		description VARCHAR(255),
		added_by VARCHAR(50),
		added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(ip_address, tenant_id)
	);

	CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);

	CREATE TABLE IF NOT EXISTS ip_suspicion_scores (
		id SERIAL PRIMARY KEY,
		ip_address VARCHAR(45) NOT NULL,
		tenant_id VARCHAR(50),
		score INT DEFAULT 0,
		failed_attempts INT DEFAULT 0,
		last_failed_at TIMESTAMP,
		last_success_at TIMESTAMP,
		last_decay_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(ip_address, tenant_id)
	);

	CREATE INDEX IF NOT EXISTS idx_ip_suspicion_ip ON ip_suspicion_scores(ip_address);

	CREATE TABLE IF NOT EXISTS ip_info_cache (
		id SERIAL PRIMARY KEY,
		ip_address VARCHAR(45) UNIQUE NOT NULL,
		ip_type VARCHAR(20),
		country_code VARCHAR(2),
		country_name VARCHAR(100),
		city VARCHAR(100),
		region VARCHAR(100),
		isp VARCHAR(255),
		organization VARCHAR(255),
		asn VARCHAR(50),
		is_vpn BOOLEAN DEFAULT FALSE,
		is_tor BOOLEAN DEFAULT FALSE,
		is_proxy BOOLEAN DEFAULT FALSE,
		is_datacenter BOOLEAN DEFAULT FALSE,
		threat_score INT DEFAULT 0,
		last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_ip_info_cache_ip ON ip_info_cache(ip_address);

	CREATE TABLE IF NOT EXISTS ip_rate_limits (
		id SERIAL PRIMARY KEY,
		ip_address VARCHAR(45) NOT NULL,
		window_start TIMESTAMP NOT NULL,
		request_count INT DEFAULT 0,
		login_attempts INT DEFAULT 0,
		UNIQUE(ip_address, window_start)
	);

	CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_ip ON ip_rate_limits(ip_address);
	CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_window ON ip_rate_limits(window_start);
	`

	_, err := ism.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create IP security tables: %v", err)
	}
}

func (ism *IPSecurityManager) loadTenantConfigs() {
	rows, err := ism.db.Query(`SELECT tenant_id, config FROM ip_security_config WHERE tenant_id IS NOT NULL`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant IP configs: %v", err)
		return
	}
	defer rows.Close()

	ism.mu.Lock()
	defer ism.mu.Unlock()

	for rows.Next() {
		var tenantID string
		var configJSON []byte
		if err := rows.Scan(&tenantID, &configJSON); err != nil {
			continue
		}

		var config IPSecurityConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			continue
		}

		ism.tenantConfig[tenantID] = config
	}
}

// GetConfig returns the applicable IP security config
func (ism *IPSecurityManager) GetConfig(tenantID string) IPSecurityConfig {
	ism.mu.RLock()
	defer ism.mu.RUnlock()

	if tenantID != "" {
		if config, ok := ism.tenantConfig[tenantID]; ok {
			return config
		}
	}

	return ism.config
}

// SetTenantConfig sets a custom IP security config for a tenant
func (ism *IPSecurityManager) SetTenantConfig(tenantID string, config IPSecurityConfig) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return err
	}

	_, err = ism.db.Exec(`
		INSERT INTO ip_security_config (tenant_id, config)
		VALUES ($1, $2)
		ON CONFLICT (tenant_id) DO UPDATE SET
			config = EXCLUDED.config,
			updated_at = CURRENT_TIMESTAMP
	`, tenantID, configJSON)

	if err != nil {
		return err
	}

	ism.mu.Lock()
	ism.tenantConfig[tenantID] = config
	ism.mu.Unlock()

	return nil
}

// CheckIP performs a comprehensive IP security check
func (ism *IPSecurityManager) CheckIP(ipAddress, tenantID string) (*IPCheckResult, error) {
	config := ism.GetConfig(tenantID)
	result := &IPCheckResult{
		Allowed: true,
		Reasons: []string{},
	}

	// Validate IP address format
	ip := net.ParseIP(ipAddress)
	if ip == nil {
		result.Allowed = false
		result.Reasons = append(result.Reasons, "Invalid IP address format")
		return result, nil
	}

	// Check whitelist first
	if config.EnableWhitelist {
		isWhitelisted, err := ism.isWhitelisted(ipAddress, tenantID)
		if err != nil {
			log.Printf("Warning: Failed to check whitelist: %v", err)
		}
		if isWhitelisted {
			result.Allowed = true
			result.Reasons = append(result.Reasons, "IP is whitelisted")
			return result, nil
		}
	}

	// Check blocklist
	if config.EnableBlacklist {
		isBlocked, blockedUntil, reason, err := ism.isBlocked(ipAddress, tenantID)
		if err != nil {
			log.Printf("Warning: Failed to check blocklist: %v", err)
		}
		if isBlocked {
			result.Allowed = false
			result.BlockedUntil = blockedUntil
			result.Reasons = append(result.Reasons, fmt.Sprintf("IP is blocked: %s", reason))
			return result, nil
		}
	}

	// Get IP info (from cache or lookup)
	ipInfo, err := ism.getIPInfo(ipAddress)
	if err != nil {
		log.Printf("Warning: Failed to get IP info: %v", err)
	}
	result.IPInfo = ipInfo

	// Check geo-restriction
	if config.EnableGeoRestriction && ipInfo != nil {
		geoResult := ism.checkGeoRestriction(ipInfo, config)
		if !geoResult.Allowed {
			result.Allowed = false
			result.Reasons = append(result.Reasons, geoResult.Reasons...)
		}
		if geoResult.RequiresMFA {
			result.RequiresMFA = true
		}
		result.RiskScore += geoResult.RiskScore
	}

	// Check VPN/Proxy/Tor
	if config.EnableVPNDetection && ipInfo != nil {
		vpnResult := ism.checkVPNProxy(ipInfo, config)
		if !vpnResult.Allowed {
			result.Allowed = false
			result.Reasons = append(result.Reasons, vpnResult.Reasons...)
		}
		if vpnResult.RequiresMFA {
			result.RequiresMFA = true
		}
		result.RiskScore += vpnResult.RiskScore
	}

	// Check suspicion score
	suspicionScore, err := ism.getSuspicionScore(ipAddress, tenantID)
	if err != nil {
		log.Printf("Warning: Failed to get suspicion score: %v", err)
	}
	if suspicionScore >= config.SuspicionScoreThreshold {
		result.Allowed = false
		result.Reasons = append(result.Reasons, "IP has high suspicion score")
	}
	result.RiskScore += suspicionScore / 2 // Add half of suspicion score to risk

	// Check rate limits
	rateLimitResult, err := ism.checkRateLimits(ipAddress, config)
	if err != nil {
		log.Printf("Warning: Failed to check rate limits: %v", err)
	}
	if rateLimitResult != nil && !rateLimitResult.Allowed {
		result.Allowed = false
		result.Reasons = append(result.Reasons, rateLimitResult.Reasons...)
	}

	// Cap risk score at 100
	if result.RiskScore > 100 {
		result.RiskScore = 100
	}

	// Flag for review if risk score is high
	if result.RiskScore >= 70 {
		result.RequiresReview = true
	}

	return result, nil
}

func (ism *IPSecurityManager) isWhitelisted(ipAddress, tenantID string) (bool, error) {
	var count int
	err := ism.db.QueryRow(`
		SELECT COUNT(*) FROM ip_whitelist
		WHERE (ip_address = $1 OR $1 <<= cidr_range::inet)
		AND (tenant_id = $2 OR tenant_id IS NULL)
	`, ipAddress, tenantID).Scan(&count)
	return count > 0, err
}

func (ism *IPSecurityManager) isBlocked(ipAddress, tenantID string) (bool, *time.Time, string, error) {
	var expiresAt sql.NullTime
	var reason string

	err := ism.db.QueryRow(`
		SELECT expires_at, reason FROM ip_blocklist
		WHERE (ip_address = $1 OR $1 <<= cidr_range::inet)
		AND (tenant_id = $2 OR tenant_id IS NULL)
		AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY is_permanent DESC, expires_at DESC NULLS FIRST
		LIMIT 1
	`, ipAddress, tenantID).Scan(&expiresAt, &reason)

	if err == sql.ErrNoRows {
		return false, nil, "", nil
	}
	if err != nil {
		return false, nil, "", err
	}

	var expiresAtPtr *time.Time
	if expiresAt.Valid {
		expiresAtPtr = &expiresAt.Time
	}

	return true, expiresAtPtr, reason, nil
}

func (ism *IPSecurityManager) getIPInfo(ipAddress string) (*IPInfo, error) {
	// Check cache first
	ism.mu.RLock()
	if info, ok := ism.ipCache[ipAddress]; ok {
		// Check if cache is still valid (24 hours)
		if time.Since(info.LastChecked) < 24*time.Hour {
			ism.mu.RUnlock()
			return info, nil
		}
	}
	ism.mu.RUnlock()

	// Check database cache
	var info IPInfo
	err := ism.db.QueryRow(`
		SELECT ip_address, ip_type, country_code, country_name, city, region,
		       isp, organization, asn, is_vpn, is_tor, is_proxy, is_datacenter,
		       threat_score, last_checked
		FROM ip_info_cache
		WHERE ip_address = $1 AND last_checked > NOW() - INTERVAL '24 hours'
	`, ipAddress).Scan(&info.IP, &info.Type, &info.CountryCode, &info.CountryName,
		&info.City, &info.Region, &info.ISP, &info.Organization, &info.ASN,
		&info.IsVPN, &info.IsTor, &info.IsProxy, &info.IsDatacenter,
		&info.ThreatScore, &info.LastChecked)

	if err == nil {
		// Update memory cache
		ism.mu.Lock()
		ism.ipCache[ipAddress] = &info
		ism.mu.Unlock()
		return &info, nil
	}

	// In production, you would call an external IP intelligence API here
	// For now, we'll create a basic info based on IP characteristics
	info = ism.createBasicIPInfo(ipAddress)

	// Cache the result
	ism.cacheIPInfo(&info)

	return &info, nil
}

func (ism *IPSecurityManager) createBasicIPInfo(ipAddress string) IPInfo {
	info := IPInfo{
		IP:          ipAddress,
		Type:        IPTypeUnknown,
		LastChecked: time.Now(),
	}

	ip := net.ParseIP(ipAddress)
	if ip == nil {
		return info
	}

	// Check for private/reserved IPs
	if ip.IsPrivate() || ip.IsLoopback() {
		info.Type = IPTypeResidential
		info.CountryCode = "XX"
		info.CountryName = "Private Network"
		return info
	}

	// Basic heuristics for IP type detection
	// In production, use a proper IP intelligence service
	ipStr := ipAddress

	// Check for known datacenter ranges (simplified)
	datacenterPrefixes := []string{
		"52.", "54.", "35.", "34.", // AWS
		"104.", "35.", // Google Cloud
		"40.", "52.", "13.", // Azure
		"159.203.", "167.99.", "206.189.", // DigitalOcean
	}
	for _, prefix := range datacenterPrefixes {
		if strings.HasPrefix(ipStr, prefix) {
			info.Type = IPTypeDatacenter
			info.IsDatacenter = true
			info.ThreatScore = 30
			break
		}
	}

	// Check for known Tor exit nodes (simplified - in production use Tor exit list)
	// This is a placeholder - real implementation would check against Tor exit node list
	if strings.HasPrefix(ipStr, "185.220.") || strings.HasPrefix(ipStr, "193.189.") {
		info.Type = IPTypeTor
		info.IsTor = true
		info.ThreatScore = 80
	}

	return info
}

func (ism *IPSecurityManager) cacheIPInfo(info *IPInfo) {
	// Update memory cache
	ism.mu.Lock()
	ism.ipCache[info.IP] = info
	ism.mu.Unlock()

	// Update database cache
	_, err := ism.db.Exec(`
		INSERT INTO ip_info_cache (ip_address, ip_type, country_code, country_name, city, region,
		                           isp, organization, asn, is_vpn, is_tor, is_proxy, is_datacenter,
		                           threat_score, last_checked)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
		ON CONFLICT (ip_address) DO UPDATE SET
			ip_type = EXCLUDED.ip_type,
			country_code = EXCLUDED.country_code,
			country_name = EXCLUDED.country_name,
			city = EXCLUDED.city,
			region = EXCLUDED.region,
			isp = EXCLUDED.isp,
			organization = EXCLUDED.organization,
			asn = EXCLUDED.asn,
			is_vpn = EXCLUDED.is_vpn,
			is_tor = EXCLUDED.is_tor,
			is_proxy = EXCLUDED.is_proxy,
			is_datacenter = EXCLUDED.is_datacenter,
			threat_score = EXCLUDED.threat_score,
			last_checked = NOW()
	`, info.IP, info.Type, info.CountryCode, info.CountryName, info.City, info.Region,
		info.ISP, info.Organization, info.ASN, info.IsVPN, info.IsTor, info.IsProxy,
		info.IsDatacenter, info.ThreatScore)

	if err != nil {
		log.Printf("Warning: Failed to cache IP info: %v", err)
	}
}

func (ism *IPSecurityManager) checkGeoRestriction(info *IPInfo, config IPSecurityConfig) *IPCheckResult {
	result := &IPCheckResult{
		Allowed: true,
		Reasons: []string{},
	}

	if info.CountryCode == "" {
		result.RiskScore = 20 // Unknown country is slightly risky
		return result
	}

	// Check blocked countries
	for _, country := range config.BlockedCountries {
		if strings.EqualFold(info.CountryCode, country) {
			result.Allowed = false
			result.Reasons = append(result.Reasons, fmt.Sprintf("Country %s is blocked", info.CountryCode))
			return result
		}
	}

	// Check high-risk countries
	for _, country := range config.HighRiskCountries {
		if strings.EqualFold(info.CountryCode, country) {
			result.Allowed = false
			result.Reasons = append(result.Reasons, fmt.Sprintf("Country %s is sanctioned/high-risk", info.CountryCode))
			return result
		}
	}

	// Check allowed countries (if whitelist mode)
	if len(config.AllowedCountries) > 0 {
		allowed := false
		for _, country := range config.AllowedCountries {
			if strings.EqualFold(info.CountryCode, country) {
				allowed = true
				break
			}
		}
		if !allowed {
			result.Allowed = false
			result.Reasons = append(result.Reasons, fmt.Sprintf("Country %s is not in allowed list", info.CountryCode))
			return result
		}
	}

	// Check if outside home country (add risk but don't block)
	if config.HomeCountry != "" && !strings.EqualFold(info.CountryCode, config.HomeCountry) {
		result.RiskScore = 25
		result.RequiresMFA = true
		result.Reasons = append(result.Reasons, fmt.Sprintf("Access from outside home country (%s)", info.CountryCode))
	}

	return result
}

func (ism *IPSecurityManager) checkVPNProxy(info *IPInfo, config IPSecurityConfig) *IPCheckResult {
	result := &IPCheckResult{
		Allowed: true,
		Reasons: []string{},
	}

	// Check Tor
	if info.IsTor {
		if config.BlockTor {
			result.Allowed = false
			result.Reasons = append(result.Reasons, "Tor exit node detected")
		} else {
			result.RiskScore = 50
			result.RequiresMFA = true
			result.Reasons = append(result.Reasons, "Tor exit node detected - requires additional verification")
		}
	}

	// Check VPN
	if info.IsVPN {
		if config.BlockVPN {
			result.Allowed = false
			result.Reasons = append(result.Reasons, "VPN detected")
		} else {
			result.RiskScore = 20
			result.RequiresMFA = true
			result.Reasons = append(result.Reasons, "VPN detected - requires additional verification")
		}
	}

	// Check Proxy
	if info.IsProxy {
		if config.BlockProxy {
			result.Allowed = false
			result.Reasons = append(result.Reasons, "Proxy detected")
		} else {
			result.RiskScore = 25
			result.RequiresMFA = true
			result.Reasons = append(result.Reasons, "Proxy detected - requires additional verification")
		}
	}

	// Check Datacenter
	if info.IsDatacenter {
		if config.BlockDatacenter {
			result.Allowed = false
			result.Reasons = append(result.Reasons, "Datacenter IP detected")
		} else {
			result.RiskScore = 15
			result.Reasons = append(result.Reasons, "Datacenter IP detected")
		}
	}

	return result
}

func (ism *IPSecurityManager) getSuspicionScore(ipAddress, tenantID string) (int, error) {
	var score int
	err := ism.db.QueryRow(`
		SELECT COALESCE(score, 0) FROM ip_suspicion_scores
		WHERE ip_address = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
	`, ipAddress, tenantID).Scan(&score)

	if err == sql.ErrNoRows {
		return 0, nil
	}
	return score, err
}

func (ism *IPSecurityManager) checkRateLimits(ipAddress string, config IPSecurityConfig) (*IPCheckResult, error) {
	result := &IPCheckResult{
		Allowed: true,
		Reasons: []string{},
	}

	// Check requests per minute
	windowStart := time.Now().Truncate(time.Minute)
	var requestCount int
	err := ism.db.QueryRow(`
		SELECT COALESCE(request_count, 0) FROM ip_rate_limits
		WHERE ip_address = $1 AND window_start = $2
	`, ipAddress, windowStart).Scan(&requestCount)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if requestCount >= config.MaxRequestsPerMinute {
		result.Allowed = false
		result.Reasons = append(result.Reasons, "Rate limit exceeded (requests per minute)")
	}

	// Check requests per hour
	hourStart := time.Now().Truncate(time.Hour)
	var hourlyCount int
	err = ism.db.QueryRow(`
		SELECT COALESCE(SUM(request_count), 0) FROM ip_rate_limits
		WHERE ip_address = $1 AND window_start >= $2
	`, ipAddress, hourStart).Scan(&hourlyCount)

	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	if hourlyCount >= config.MaxRequestsPerHour {
		result.Allowed = false
		result.Reasons = append(result.Reasons, "Rate limit exceeded (requests per hour)")
	}

	return result, nil
}

// RecordRequest records a request for rate limiting
func (ism *IPSecurityManager) RecordRequest(ipAddress string) error {
	windowStart := time.Now().Truncate(time.Minute)
	_, err := ism.db.Exec(`
		INSERT INTO ip_rate_limits (ip_address, window_start, request_count)
		VALUES ($1, $2, 1)
		ON CONFLICT (ip_address, window_start) DO UPDATE SET
			request_count = ip_rate_limits.request_count + 1
	`, ipAddress, windowStart)
	return err
}

// RecordLoginAttempt records a login attempt for rate limiting
func (ism *IPSecurityManager) RecordLoginAttempt(ipAddress string, success bool, tenantID string) error {
	config := ism.GetConfig(tenantID)

	// Update rate limits
	windowStart := time.Now().Truncate(time.Minute)
	_, err := ism.db.Exec(`
		INSERT INTO ip_rate_limits (ip_address, window_start, login_attempts)
		VALUES ($1, $2, 1)
		ON CONFLICT (ip_address, window_start) DO UPDATE SET
			login_attempts = ip_rate_limits.login_attempts + 1
	`, ipAddress, windowStart)
	if err != nil {
		return err
	}

	// Update suspicion score
	if !success {
		_, err = ism.db.Exec(`
			INSERT INTO ip_suspicion_scores (ip_address, tenant_id, score, failed_attempts, last_failed_at)
			VALUES ($1, $2, 10, 1, NOW())
			ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
				score = ip_suspicion_scores.score + 10,
				failed_attempts = ip_suspicion_scores.failed_attempts + 1,
				last_failed_at = NOW(),
				updated_at = NOW()
		`, ipAddress, tenantID)
		if err != nil {
			return err
		}

		// Check if should auto-block
		if config.EnableAutoBlock {
			var failedAttempts int
			ism.db.QueryRow(`
				SELECT failed_attempts FROM ip_suspicion_scores
				WHERE ip_address = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
			`, ipAddress, tenantID).Scan(&failedAttempts)

			if failedAttempts >= config.FailedAttemptsThreshold {
				ism.BlockIP(ipAddress, tenantID, "Auto-blocked due to excessive failed login attempts",
					time.Duration(config.BlockDurationMinutes)*time.Minute, "system")
			}
		}
	} else {
		// Successful login - reduce suspicion score
		_, err = ism.db.Exec(`
			UPDATE ip_suspicion_scores
			SET score = GREATEST(0, score - 5),
			    last_success_at = NOW(),
			    updated_at = NOW()
			WHERE ip_address = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
		`, ipAddress, tenantID)
	}

	return err
}

// BlockIP adds an IP to the blocklist
func (ism *IPSecurityManager) BlockIP(ipAddress, tenantID, reason string, duration time.Duration, blockedBy string) error {
	var expiresAt *time.Time
	isPermanent := false

	if duration > 0 {
		t := time.Now().Add(duration)
		expiresAt = &t
	} else {
		isPermanent = true
	}

	_, err := ism.db.Exec(`
		INSERT INTO ip_blocklist (ip_address, tenant_id, reason, blocked_by, expires_at, is_permanent)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
			reason = EXCLUDED.reason,
			blocked_by = EXCLUDED.blocked_by,
			blocked_at = NOW(),
			expires_at = EXCLUDED.expires_at,
			is_permanent = EXCLUDED.is_permanent
	`, ipAddress, tenantID, reason, blockedBy, expiresAt, isPermanent)

	return err
}

// UnblockIP removes an IP from the blocklist
func (ism *IPSecurityManager) UnblockIP(ipAddress, tenantID string) error {
	_, err := ism.db.Exec(`
		DELETE FROM ip_blocklist
		WHERE ip_address = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
	`, ipAddress, tenantID)
	return err
}

// AddToWhitelist adds an IP to the whitelist
func (ism *IPSecurityManager) AddToWhitelist(ipAddress, tenantID, description, addedBy string) error {
	_, err := ism.db.Exec(`
		INSERT INTO ip_whitelist (ip_address, tenant_id, description, added_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
			description = EXCLUDED.description,
			added_by = EXCLUDED.added_by,
			added_at = NOW()
	`, ipAddress, tenantID, description, addedBy)
	return err
}

// RemoveFromWhitelist removes an IP from the whitelist
func (ism *IPSecurityManager) RemoveFromWhitelist(ipAddress, tenantID string) error {
	_, err := ism.db.Exec(`
		DELETE FROM ip_whitelist
		WHERE ip_address = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
	`, ipAddress, tenantID)
	return err
}

// BlockCIDR blocks a CIDR range
func (ism *IPSecurityManager) BlockCIDR(cidrRange, tenantID, reason, blockedBy string, duration time.Duration) error {
	// Validate CIDR
	_, _, err := net.ParseCIDR(cidrRange)
	if err != nil {
		return fmt.Errorf("invalid CIDR range: %v", err)
	}

	var expiresAt *time.Time
	isPermanent := false

	if duration > 0 {
		t := time.Now().Add(duration)
		expiresAt = &t
	} else {
		isPermanent = true
	}

	_, err = ism.db.Exec(`
		INSERT INTO ip_blocklist (ip_address, cidr_range, tenant_id, reason, blocked_by, expires_at, is_permanent)
		VALUES ($1, $1, $2, $3, $4, $5, $6)
	`, cidrRange, tenantID, reason, blockedBy, expiresAt, isPermanent)

	return err
}

// DecaySuspicionScores reduces suspicion scores over time
func (ism *IPSecurityManager) DecaySuspicionScores() error {
	_, err := ism.db.Exec(`
		UPDATE ip_suspicion_scores
		SET score = GREATEST(0, score - 5),
		    last_decay_at = NOW(),
		    updated_at = NOW()
		WHERE last_decay_at < NOW() - INTERVAL '1 hour'
		AND score > 0
	`)
	return err
}

func (ism *IPSecurityManager) backgroundCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		// Decay suspicion scores
		ism.DecaySuspicionScores()

		// Clean up expired blocks
		ism.db.Exec(`DELETE FROM ip_blocklist WHERE expires_at < NOW() AND NOT is_permanent`)

		// Clean up old rate limit data
		ism.db.Exec(`DELETE FROM ip_rate_limits WHERE window_start < NOW() - INTERVAL '24 hours'`)

		// Clean up old IP info cache
		ism.db.Exec(`DELETE FROM ip_info_cache WHERE last_checked < NOW() - INTERVAL '7 days'`)

		// Clear memory cache of old entries
		ism.mu.Lock()
		for ip, info := range ism.ipCache {
			if time.Since(info.LastChecked) > 24*time.Hour {
				delete(ism.ipCache, ip)
			}
		}
		ism.mu.Unlock()
	}
}

// GetBlockedIPs returns a list of blocked IPs
func (ism *IPSecurityManager) GetBlockedIPs(tenantID string, limit, offset int) ([]map[string]interface{}, error) {
	rows, err := ism.db.Query(`
		SELECT ip_address, cidr_range, reason, blocked_by, blocked_at, expires_at, is_permanent
		FROM ip_blocklist
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
		AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY blocked_at DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var ipAddress, reason, blockedBy string
		var cidrRange sql.NullString
		var blockedAt time.Time
		var expiresAt sql.NullTime
		var isPermanent bool

		if err := rows.Scan(&ipAddress, &cidrRange, &reason, &blockedBy, &blockedAt, &expiresAt, &isPermanent); err != nil {
			continue
		}

		result := map[string]interface{}{
			"ip_address":   ipAddress,
			"reason":       reason,
			"blocked_by":   blockedBy,
			"blocked_at":   blockedAt,
			"is_permanent": isPermanent,
		}
		if cidrRange.Valid {
			result["cidr_range"] = cidrRange.String
		}
		if expiresAt.Valid {
			result["expires_at"] = expiresAt.Time
		}

		results = append(results, result)
	}

	return results, nil
}
