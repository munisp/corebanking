package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"sync"
	"time"
)

// FraudRuleType represents the type of fraud detection rule
type FraudRuleType string

const (
	RuleLargeTransaction   FraudRuleType = "large_transaction"
	RuleUnusualAmount      FraudRuleType = "unusual_amount"
	RuleUnusualTime        FraudRuleType = "unusual_time"
	RuleNewRecipient       FraudRuleType = "new_recipient"
	RuleHighVelocity       FraudRuleType = "high_velocity"
	RuleRoundAmount        FraudRuleType = "round_amount"
	RuleNewDevice          FraudRuleType = "new_device"
	RuleNewIP              FraudRuleType = "new_ip"
	RuleImpossibleTravel   FraudRuleType = "impossible_travel"
	RuleRapidSuccession    FraudRuleType = "rapid_succession"
	RuleDormantAccount     FraudRuleType = "dormant_account"
	RuleMultipleRecipients FraudRuleType = "multiple_recipients"
	RuleUnusualChannel     FraudRuleType = "unusual_channel"
	RuleHighRiskCountry    FraudRuleType = "high_risk_country"
	RulePatternAnomaly     FraudRuleType = "pattern_anomaly"
)

// FraudAction represents the action to take when fraud is detected
type FraudAction string

const (
	ActionAllow         FraudAction = "allow"
	ActionAllowWithMFA  FraudAction = "allow_with_mfa"
	ActionHoldForReview FraudAction = "hold_for_review"
	ActionBlock         FraudAction = "block"
	ActionAlertOnly     FraudAction = "alert_only"
)

// FraudRule represents a configurable fraud detection rule
type FraudRule struct {
	ID          string                 `json:"id"`
	Type        FraudRuleType          `json:"type"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Enabled     bool                   `json:"enabled"`
	Weight      int                    `json:"weight"`     // Risk score contribution (0-100)
	Threshold   float64                `json:"threshold"`  // Rule-specific threshold
	Action      FraudAction            `json:"action"`     // Default action when triggered
	Parameters  map[string]interface{} `json:"parameters"` // Rule-specific parameters
}

// FraudDetectionConfig holds the fraud detection configuration
type FraudDetectionConfig struct {
	Enabled         bool        `json:"enabled"`
	Rules           []FraudRule `json:"rules"`
	BlockThreshold  int         `json:"block_threshold"`   // Risk score to auto-block
	ReviewThreshold int         `json:"review_threshold"`  // Risk score to flag for review
	MFAThreshold    int         `json:"mfa_threshold"`     // Risk score to require MFA
	AlertThreshold  int         `json:"alert_threshold"`   // Risk score to generate alert
	MaxRiskScore    int         `json:"max_risk_score"`    // Maximum possible risk score
	EnableMLScoring bool        `json:"enable_ml_scoring"` // Use ML model for scoring
	MLServiceURL    string      `json:"ml_service_url"`    // URL of ML scoring service
	MLTimeoutMs     int         `json:"ml_timeout_ms"`     // Timeout for ML service calls
}

// DefaultFraudRules provides the default set of fraud detection rules
var DefaultFraudRules = []FraudRule{
	{
		ID:          "rule_large_tx",
		Type:        RuleLargeTransaction,
		Name:        "Large Transaction",
		Description: "Transaction amount exceeds threshold for user tier",
		Enabled:     true,
		Weight:      25,
		Threshold:   0.8, // 80% of tier limit
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{"tier_multiplier": 0.8},
	},
	{
		ID:          "rule_unusual_amount",
		Type:        RuleUnusualAmount,
		Name:        "Unusual Amount",
		Description: "Transaction amount deviates significantly from user's normal pattern",
		Enabled:     true,
		Weight:      20,
		Threshold:   3.0, // 3 standard deviations
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{"std_dev_multiplier": 3.0, "min_history": 5},
	},
	{
		ID:          "rule_unusual_time",
		Type:        RuleUnusualTime,
		Name:        "Unusual Time",
		Description: "Transaction at unusual time for user",
		Enabled:     true,
		Weight:      10,
		Threshold:   0.0,
		Action:      ActionAlertOnly,
		Parameters:  map[string]interface{}{"unusual_hours": []int{0, 1, 2, 3, 4, 5}},
	},
	{
		ID:          "rule_new_recipient",
		Type:        RuleNewRecipient,
		Name:        "New Recipient",
		Description: "First transaction to this recipient",
		Enabled:     true,
		Weight:      15,
		Threshold:   0.0,
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{"high_value_threshold": 100000},
	},
	{
		ID:          "rule_high_velocity",
		Type:        RuleHighVelocity,
		Name:        "High Velocity",
		Description: "Multiple transactions in short time period",
		Enabled:     true,
		Weight:      30,
		Threshold:   5.0, // 5 transactions
		Action:      ActionHoldForReview,
		Parameters:  map[string]interface{}{"time_window_minutes": 10, "max_transactions": 5},
	},
	{
		ID:          "rule_round_amount",
		Type:        RuleRoundAmount,
		Name:        "Round Amount",
		Description: "Transaction is a suspiciously round amount",
		Enabled:     true,
		Weight:      5, // Low weight - many legitimate transactions are round
		Threshold:   0.0,
		Action:      ActionAlertOnly,
		Parameters:  map[string]interface{}{"round_thresholds": []float64{10000, 50000, 100000, 500000, 1000000}},
	},
	{
		ID:          "rule_new_device",
		Type:        RuleNewDevice,
		Name:        "New Device",
		Description: "Transaction from unrecognized device",
		Enabled:     true,
		Weight:      20,
		Threshold:   0.0,
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{},
	},
	{
		ID:          "rule_new_ip",
		Type:        RuleNewIP,
		Name:        "New IP Address",
		Description: "Transaction from new IP address",
		Enabled:     true,
		Weight:      15,
		Threshold:   0.0,
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{},
	},
	{
		ID:          "rule_impossible_travel",
		Type:        RuleImpossibleTravel,
		Name:        "Impossible Travel",
		Description: "Login/transaction from geographically impossible location given time since last activity",
		Enabled:     true,
		Weight:      40,
		Threshold:   500.0, // km/hour max travel speed
		Action:      ActionBlock,
		Parameters:  map[string]interface{}{"max_speed_kmh": 500},
	},
	{
		ID:          "rule_rapid_succession",
		Type:        RuleRapidSuccession,
		Name:        "Rapid Succession",
		Description: "Multiple transactions in rapid succession",
		Enabled:     true,
		Weight:      25,
		Threshold:   3.0, // 3 transactions
		Action:      ActionHoldForReview,
		Parameters:  map[string]interface{}{"time_window_seconds": 60, "max_transactions": 3},
	},
	{
		ID:          "rule_dormant_account",
		Type:        RuleDormantAccount,
		Name:        "Dormant Account Activity",
		Description: "Activity on account that has been dormant",
		Enabled:     true,
		Weight:      30,
		Threshold:   90.0, // 90 days
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{"dormant_days": 90},
	},
	{
		ID:          "rule_multiple_recipients",
		Type:        RuleMultipleRecipients,
		Name:        "Multiple Recipients",
		Description: "Transactions to many different recipients in short period",
		Enabled:     true,
		Weight:      25,
		Threshold:   5.0, // 5 unique recipients
		Action:      ActionHoldForReview,
		Parameters:  map[string]interface{}{"time_window_hours": 24, "max_recipients": 5},
	},
	{
		ID:          "rule_unusual_channel",
		Type:        RuleUnusualChannel,
		Name:        "Unusual Channel",
		Description: "Transaction via channel user doesn't normally use",
		Enabled:     true,
		Weight:      10,
		Threshold:   0.0,
		Action:      ActionAlertOnly,
		Parameters:  map[string]interface{}{},
	},
	{
		ID:          "rule_high_risk_country",
		Type:        RuleHighRiskCountry,
		Name:        "High Risk Country",
		Description: "Transaction involving high-risk country",
		Enabled:     true,
		Weight:      35,
		Threshold:   0.0,
		Action:      ActionHoldForReview,
		Parameters:  map[string]interface{}{"high_risk_countries": []string{"KP", "IR", "SY", "CU", "VE", "MM"}},
	},
	{
		ID:          "rule_pattern_anomaly",
		Type:        RulePatternAnomaly,
		Name:        "Pattern Anomaly",
		Description: "Transaction pattern deviates from user's normal behavior",
		Enabled:     true,
		Weight:      20,
		Threshold:   0.7, // 70% confidence
		Action:      ActionAllowWithMFA,
		Parameters:  map[string]interface{}{"min_history_days": 30},
	},
}

// DefaultFraudConfig provides default fraud detection configuration
var DefaultFraudConfig = FraudDetectionConfig{
	Enabled:         true,
	Rules:           DefaultFraudRules,
	BlockThreshold:  80,
	ReviewThreshold: 60,
	MFAThreshold:    40,
	AlertThreshold:  30,
	MaxRiskScore:    100,
	EnableMLScoring: false,
	MLServiceURL:    "http://localhost:8081/api/v1/fraud/score",
	MLTimeoutMs:     500,
}

// FraudCheckRequest represents a request to check for fraud
type FraudCheckRequest struct {
	UserID          string                 `json:"user_id"`
	TenantID        string                 `json:"tenant_id"`
	TransactionID   string                 `json:"transaction_id"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	TransactionType TransactionType        `json:"transaction_type"`
	Channel         Channel                `json:"channel"`
	RecipientID     string                 `json:"recipient_id"`
	RecipientType   string                 `json:"recipient_type"`
	DeviceID        string                 `json:"device_id"`
	DeviceInfo      string                 `json:"device_info"`
	IPAddress       string                 `json:"ip_address"`
	Location        *GeoLocation           `json:"location,omitempty"`
	Timestamp       time.Time              `json:"timestamp"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// GeoLocation represents a geographic location
type GeoLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Country   string  `json:"country"`
	City      string  `json:"city"`
}

// FraudCheckResult represents the result of a fraud check
type FraudCheckResult struct {
	TransactionID  string          `json:"transaction_id"`
	RiskScore      int             `json:"risk_score"`
	RiskLevel      string          `json:"risk_level"` // low, medium, high, critical
	Action         FraudAction     `json:"action"`
	TriggeredRules []TriggeredRule `json:"triggered_rules"`
	RequiresMFA    bool            `json:"requires_mfa"`
	RequiresReview bool            `json:"requires_review"`
	Blocked        bool            `json:"blocked"`
	Reasons        []string        `json:"reasons"`
	MLScore        *float64        `json:"ml_score,omitempty"`
	ProcessingTime time.Duration   `json:"processing_time"`
	Timestamp      time.Time       `json:"timestamp"`
}

// TriggeredRule represents a fraud rule that was triggered
type TriggeredRule struct {
	RuleID   string        `json:"rule_id"`
	RuleType FraudRuleType `json:"rule_type"`
	RuleName string        `json:"rule_name"`
	Weight   int           `json:"weight"`
	Action   FraudAction   `json:"action"`
	Details  string        `json:"details"`
}

// FraudDetectionEngine manages fraud detection
type FraudDetectionEngine struct {
	db           *sql.DB
	config       FraudDetectionConfig
	tenantConfig map[string]FraudDetectionConfig
	mu           sync.RWMutex
}

// NewFraudDetectionEngine creates a new fraud detection engine
func NewFraudDetectionEngine(db *sql.DB) *FraudDetectionEngine {
	fde := &FraudDetectionEngine{
		db:           db,
		config:       DefaultFraudConfig,
		tenantConfig: make(map[string]FraudDetectionConfig),
	}

	// Load environment overrides
	fde.loadEnvOverrides()

	// Create necessary tables
	fde.createTables()

	// Load tenant-specific configs
	fde.loadTenantConfigs()

	return fde
}

func (fde *FraudDetectionEngine) loadEnvOverrides() {
	if val := os.Getenv("FRAUD_BLOCK_THRESHOLD"); val != "" {
		if threshold, err := strconv.Atoi(val); err == nil {
			fde.config.BlockThreshold = threshold
		}
	}
	if val := os.Getenv("FRAUD_REVIEW_THRESHOLD"); val != "" {
		if threshold, err := strconv.Atoi(val); err == nil {
			fde.config.ReviewThreshold = threshold
		}
	}
	if val := os.Getenv("FRAUD_MFA_THRESHOLD"); val != "" {
		if threshold, err := strconv.Atoi(val); err == nil {
			fde.config.MFAThreshold = threshold
		}
	}
	if val := os.Getenv("FRAUD_ML_ENABLED"); val != "" {
		fde.config.EnableMLScoring = val == "true"
	}
	if val := os.Getenv("FRAUD_ML_SERVICE_URL"); val != "" {
		fde.config.MLServiceURL = val
	}
}

func (fde *FraudDetectionEngine) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS fraud_config (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50) UNIQUE,
		config JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS fraud_alerts (
		id SERIAL PRIMARY KEY,
		alert_id VARCHAR(50) UNIQUE NOT NULL,
		user_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50),
		transaction_id VARCHAR(50),
		risk_score INT NOT NULL,
		risk_level VARCHAR(20) NOT NULL,
		action_taken VARCHAR(50) NOT NULL,
		triggered_rules JSONB,
		reasons JSONB,
		status VARCHAR(20) DEFAULT 'pending',
		reviewed_by VARCHAR(50),
		reviewed_at TIMESTAMP,
		review_notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id);
	CREATE INDEX IF NOT EXISTS idx_fraud_alerts_tenant ON fraud_alerts(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
	CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON fraud_alerts(created_at);

	CREATE TABLE IF NOT EXISTS user_transaction_patterns (
		id SERIAL PRIMARY KEY,
		user_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50),
		avg_transaction_amount DECIMAL(20, 2),
		std_dev_amount DECIMAL(20, 2),
		avg_transactions_per_day DECIMAL(10, 2),
		typical_hours JSONB,
		typical_channels JSONB,
		known_recipients JSONB,
		known_devices JSONB,
		known_ips JSONB,
		last_activity_at TIMESTAMP,
		last_location JSONB,
		pattern_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, tenant_id)
	);

	CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON user_transaction_patterns(user_id);

	CREATE TABLE IF NOT EXISTS transaction_history (
		id SERIAL PRIMARY KEY,
		user_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50),
		transaction_id VARCHAR(50) NOT NULL,
		amount DECIMAL(20, 2) NOT NULL,
		transaction_type VARCHAR(50),
		channel VARCHAR(50),
		recipient_id VARCHAR(50),
		device_id VARCHAR(50),
		ip_address VARCHAR(45),
		location JSONB,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_tx_history_user ON transaction_history(user_id);
	CREATE INDEX IF NOT EXISTS idx_tx_history_created ON transaction_history(created_at);
	`

	_, err := fde.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create fraud detection tables: %v", err)
	}
}

func (fde *FraudDetectionEngine) loadTenantConfigs() {
	rows, err := fde.db.Query(`SELECT tenant_id, config FROM fraud_config WHERE tenant_id IS NOT NULL`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant fraud configs: %v", err)
		return
	}
	defer rows.Close()

	fde.mu.Lock()
	defer fde.mu.Unlock()

	for rows.Next() {
		var tenantID string
		var configJSON []byte
		if err := rows.Scan(&tenantID, &configJSON); err != nil {
			continue
		}

		var config FraudDetectionConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			continue
		}

		fde.tenantConfig[tenantID] = config
	}
}

// GetConfig returns the applicable fraud detection config
func (fde *FraudDetectionEngine) GetConfig(tenantID string) FraudDetectionConfig {
	fde.mu.RLock()
	defer fde.mu.RUnlock()

	if tenantID != "" {
		if config, ok := fde.tenantConfig[tenantID]; ok {
			return config
		}
	}

	return fde.config
}

// CheckFraud performs a comprehensive fraud check
func (fde *FraudDetectionEngine) CheckFraud(req FraudCheckRequest) (*FraudCheckResult, error) {
	startTime := time.Now()
	config := fde.GetConfig(req.TenantID)

	if !config.Enabled {
		return &FraudCheckResult{
			TransactionID:  req.TransactionID,
			RiskScore:      0,
			RiskLevel:      "low",
			Action:         ActionAllow,
			ProcessingTime: time.Since(startTime),
			Timestamp:      time.Now(),
		}, nil
	}

	result := &FraudCheckResult{
		TransactionID:  req.TransactionID,
		TriggeredRules: []TriggeredRule{},
		Reasons:        []string{},
		Timestamp:      time.Now(),
	}

	// Get user's transaction patterns
	patterns, err := fde.getUserPatterns(req.UserID, req.TenantID)
	if err != nil {
		log.Printf("Warning: Failed to get user patterns: %v", err)
	}

	// Evaluate each enabled rule
	totalScore := 0
	for _, rule := range config.Rules {
		if !rule.Enabled {
			continue
		}

		triggered, details := fde.evaluateRule(rule, req, patterns)
		if triggered {
			totalScore += rule.Weight
			result.TriggeredRules = append(result.TriggeredRules, TriggeredRule{
				RuleID:   rule.ID,
				RuleType: rule.Type,
				RuleName: rule.Name,
				Weight:   rule.Weight,
				Action:   rule.Action,
				Details:  details,
			})
			result.Reasons = append(result.Reasons, details)
		}
	}

	// Cap the score at max
	if totalScore > config.MaxRiskScore {
		totalScore = config.MaxRiskScore
	}
	result.RiskScore = totalScore

	// Determine risk level
	result.RiskLevel = fde.getRiskLevel(totalScore, config)

	// Determine action based on score and triggered rules
	result.Action = fde.determineAction(result, config)

	// Set flags based on action
	switch result.Action {
	case ActionBlock:
		result.Blocked = true
	case ActionHoldForReview:
		result.RequiresReview = true
	case ActionAllowWithMFA:
		result.RequiresMFA = true
	}

	result.ProcessingTime = time.Since(startTime)

	// Record the check result
	if totalScore >= config.AlertThreshold {
		fde.recordFraudAlert(req, result)
	}

	// Update user patterns
	go fde.updateUserPatterns(req)

	return result, nil
}

func (fde *FraudDetectionEngine) evaluateRule(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	switch rule.Type {
	case RuleLargeTransaction:
		return fde.checkLargeTransaction(rule, req, patterns)
	case RuleUnusualAmount:
		return fde.checkUnusualAmount(rule, req, patterns)
	case RuleUnusualTime:
		return fde.checkUnusualTime(rule, req, patterns)
	case RuleNewRecipient:
		return fde.checkNewRecipient(rule, req, patterns)
	case RuleHighVelocity:
		return fde.checkHighVelocity(rule, req)
	case RuleRoundAmount:
		return fde.checkRoundAmount(rule, req)
	case RuleNewDevice:
		return fde.checkNewDevice(rule, req, patterns)
	case RuleNewIP:
		return fde.checkNewIP(rule, req, patterns)
	case RuleImpossibleTravel:
		return fde.checkImpossibleTravel(rule, req, patterns)
	case RuleRapidSuccession:
		return fde.checkRapidSuccession(rule, req)
	case RuleDormantAccount:
		return fde.checkDormantAccount(rule, req, patterns)
	case RuleMultipleRecipients:
		return fde.checkMultipleRecipients(rule, req)
	case RuleUnusualChannel:
		return fde.checkUnusualChannel(rule, req, patterns)
	case RuleHighRiskCountry:
		return fde.checkHighRiskCountry(rule, req)
	case RulePatternAnomaly:
		return fde.checkPatternAnomaly(rule, req, patterns)
	default:
		return false, ""
	}
}

// UserPatterns holds a user's transaction patterns
type UserPatterns struct {
	AvgAmount       float64
	StdDevAmount    float64
	AvgTxPerDay     float64
	TypicalHours    []int
	TypicalChannels []string
	KnownRecipients []string
	KnownDevices    []string
	KnownIPs        []string
	LastActivityAt  *time.Time
	LastLocation    *GeoLocation
}

func (fde *FraudDetectionEngine) getUserPatterns(userID, tenantID string) (*UserPatterns, error) {
	var patterns UserPatterns
	var typicalHoursJSON, typicalChannelsJSON, knownRecipientsJSON []byte
	var knownDevicesJSON, knownIPsJSON, lastLocationJSON []byte
	var lastActivity sql.NullTime

	err := fde.db.QueryRow(`
		SELECT avg_transaction_amount, std_dev_amount, avg_transactions_per_day,
		       typical_hours, typical_channels, known_recipients, known_devices,
		       known_ips, last_activity_at, last_location
		FROM user_transaction_patterns
		WHERE user_id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
	`, userID, tenantID).Scan(
		&patterns.AvgAmount, &patterns.StdDevAmount, &patterns.AvgTxPerDay,
		&typicalHoursJSON, &typicalChannelsJSON, &knownRecipientsJSON,
		&knownDevicesJSON, &knownIPsJSON, &lastActivity, &lastLocationJSON,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Parse JSON fields
	json.Unmarshal(typicalHoursJSON, &patterns.TypicalHours)
	json.Unmarshal(typicalChannelsJSON, &patterns.TypicalChannels)
	json.Unmarshal(knownRecipientsJSON, &patterns.KnownRecipients)
	json.Unmarshal(knownDevicesJSON, &patterns.KnownDevices)
	json.Unmarshal(knownIPsJSON, &patterns.KnownIPs)

	if lastActivity.Valid {
		patterns.LastActivityAt = &lastActivity.Time
	}

	if lastLocationJSON != nil {
		var loc GeoLocation
		json.Unmarshal(lastLocationJSON, &loc)
		patterns.LastLocation = &loc
	}

	return &patterns, nil
}

func (fde *FraudDetectionEngine) checkLargeTransaction(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	// Get tier limit (simplified - in production, integrate with TransactionLimitManager)
	tierLimit := 500000.0 // Default to verified tier limit
	multiplier := 0.8
	if m, ok := rule.Parameters["tier_multiplier"].(float64); ok {
		multiplier = m
	}

	threshold := tierLimit * multiplier
	if req.Amount > threshold {
		return true, fmt.Sprintf("Transaction amount NGN %.2f exceeds %.0f%% of tier limit", req.Amount, multiplier*100)
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkUnusualAmount(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || patterns.StdDevAmount == 0 {
		return false, ""
	}

	stdDevMultiplier := 3.0
	if m, ok := rule.Parameters["std_dev_multiplier"].(float64); ok {
		stdDevMultiplier = m
	}

	deviation := math.Abs(req.Amount - patterns.AvgAmount)
	if deviation > patterns.StdDevAmount*stdDevMultiplier {
		return true, fmt.Sprintf("Transaction amount deviates %.1f standard deviations from average", deviation/patterns.StdDevAmount)
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkUnusualTime(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	hour := req.Timestamp.Hour()

	// Check against unusual hours parameter
	if unusualHours, ok := rule.Parameters["unusual_hours"].([]interface{}); ok {
		for _, h := range unusualHours {
			if int(h.(float64)) == hour {
				return true, fmt.Sprintf("Transaction at unusual hour: %d:00", hour)
			}
		}
	}

	// Check against user's typical hours
	if patterns != nil && len(patterns.TypicalHours) > 0 {
		isTypical := false
		for _, h := range patterns.TypicalHours {
			if h == hour {
				isTypical = true
				break
			}
		}
		if !isTypical {
			return true, fmt.Sprintf("Transaction at unusual hour for this user: %d:00", hour)
		}
	}

	return false, ""
}

func (fde *FraudDetectionEngine) checkNewRecipient(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || req.RecipientID == "" {
		return false, ""
	}

	for _, r := range patterns.KnownRecipients {
		if r == req.RecipientID {
			return false, ""
		}
	}

	// Check if high value
	highValueThreshold := 100000.0
	if t, ok := rule.Parameters["high_value_threshold"].(float64); ok {
		highValueThreshold = t
	}

	if req.Amount >= highValueThreshold {
		return true, fmt.Sprintf("High-value transaction (NGN %.2f) to new recipient", req.Amount)
	}

	return true, "First transaction to this recipient"
}

func (fde *FraudDetectionEngine) checkHighVelocity(rule FraudRule, req FraudCheckRequest) (bool, string) {
	timeWindowMinutes := 10
	maxTransactions := 5

	if t, ok := rule.Parameters["time_window_minutes"].(float64); ok {
		timeWindowMinutes = int(t)
	}
	if m, ok := rule.Parameters["max_transactions"].(float64); ok {
		maxTransactions = int(m)
	}

	var count int
	fde.db.QueryRow(`
		SELECT COUNT(*) FROM transaction_history
		WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2
	`, req.UserID, timeWindowMinutes).Scan(&count)

	if count >= maxTransactions {
		return true, fmt.Sprintf("%d transactions in last %d minutes", count+1, timeWindowMinutes)
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkRoundAmount(rule FraudRule, req FraudCheckRequest) (bool, string) {
	roundThresholds := []float64{10000, 50000, 100000, 500000, 1000000}
	if t, ok := rule.Parameters["round_thresholds"].([]interface{}); ok {
		roundThresholds = make([]float64, len(t))
		for i, v := range t {
			roundThresholds[i] = v.(float64)
		}
	}

	for _, threshold := range roundThresholds {
		if req.Amount == threshold {
			return true, fmt.Sprintf("Suspiciously round amount: NGN %.0f", req.Amount)
		}
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkNewDevice(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || req.DeviceID == "" {
		return false, ""
	}

	for _, d := range patterns.KnownDevices {
		if d == req.DeviceID {
			return false, ""
		}
	}

	return true, "Transaction from unrecognized device"
}

func (fde *FraudDetectionEngine) checkNewIP(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || req.IPAddress == "" {
		return false, ""
	}

	for _, ip := range patterns.KnownIPs {
		if ip == req.IPAddress {
			return false, ""
		}
	}

	return true, fmt.Sprintf("Transaction from new IP address: %s", req.IPAddress)
}

func (fde *FraudDetectionEngine) checkImpossibleTravel(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || patterns.LastLocation == nil || req.Location == nil {
		return false, ""
	}
	if patterns.LastActivityAt == nil {
		return false, ""
	}

	maxSpeedKmh := 500.0
	if s, ok := rule.Parameters["max_speed_kmh"].(float64); ok {
		maxSpeedKmh = s
	}

	// Calculate distance using Haversine formula
	distance := haversineDistance(
		patterns.LastLocation.Latitude, patterns.LastLocation.Longitude,
		req.Location.Latitude, req.Location.Longitude,
	)

	// Calculate time difference in hours
	timeDiff := req.Timestamp.Sub(*patterns.LastActivityAt).Hours()
	if timeDiff <= 0 {
		timeDiff = 0.01 // Minimum 36 seconds
	}

	// Calculate required speed
	requiredSpeed := distance / timeDiff

	if requiredSpeed > maxSpeedKmh {
		return true, fmt.Sprintf("Impossible travel: %.0f km in %.1f hours (%.0f km/h required)", distance, timeDiff, requiredSpeed)
	}

	return false, ""
}

func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371 // km

	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

func (fde *FraudDetectionEngine) checkRapidSuccession(rule FraudRule, req FraudCheckRequest) (bool, string) {
	timeWindowSeconds := 60
	maxTransactions := 3

	if t, ok := rule.Parameters["time_window_seconds"].(float64); ok {
		timeWindowSeconds = int(t)
	}
	if m, ok := rule.Parameters["max_transactions"].(float64); ok {
		maxTransactions = int(m)
	}

	var count int
	fde.db.QueryRow(`
		SELECT COUNT(*) FROM transaction_history
		WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 second' * $2
	`, req.UserID, timeWindowSeconds).Scan(&count)

	if count >= maxTransactions {
		return true, fmt.Sprintf("%d transactions in last %d seconds", count+1, timeWindowSeconds)
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkDormantAccount(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || patterns.LastActivityAt == nil {
		return false, ""
	}

	dormantDays := 90
	if d, ok := rule.Parameters["dormant_days"].(float64); ok {
		dormantDays = int(d)
	}

	daysSinceActivity := int(time.Since(*patterns.LastActivityAt).Hours() / 24)
	if daysSinceActivity >= dormantDays {
		return true, fmt.Sprintf("Account was dormant for %d days", daysSinceActivity)
	}

	return false, ""
}

func (fde *FraudDetectionEngine) checkMultipleRecipients(rule FraudRule, req FraudCheckRequest) (bool, string) {
	timeWindowHours := 24
	maxRecipients := 5

	if t, ok := rule.Parameters["time_window_hours"].(float64); ok {
		timeWindowHours = int(t)
	}
	if m, ok := rule.Parameters["max_recipients"].(float64); ok {
		maxRecipients = int(m)
	}

	var count int
	fde.db.QueryRow(`
		SELECT COUNT(DISTINCT recipient_id) FROM transaction_history
		WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour' * $2
	`, req.UserID, timeWindowHours).Scan(&count)

	if count >= maxRecipients {
		return true, fmt.Sprintf("Transactions to %d unique recipients in last %d hours", count+1, timeWindowHours)
	}
	return false, ""
}

func (fde *FraudDetectionEngine) checkUnusualChannel(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil || len(patterns.TypicalChannels) == 0 {
		return false, ""
	}

	for _, c := range patterns.TypicalChannels {
		if c == string(req.Channel) {
			return false, ""
		}
	}

	return true, fmt.Sprintf("Transaction via unusual channel: %s", req.Channel)
}

func (fde *FraudDetectionEngine) checkHighRiskCountry(rule FraudRule, req FraudCheckRequest) (bool, string) {
	if req.Location == nil || req.Location.Country == "" {
		return false, ""
	}

	highRiskCountries := []string{"KP", "IR", "SY", "CU", "VE", "MM"}
	if c, ok := rule.Parameters["high_risk_countries"].([]interface{}); ok {
		highRiskCountries = make([]string, len(c))
		for i, v := range c {
			highRiskCountries[i] = v.(string)
		}
	}

	for _, country := range highRiskCountries {
		if req.Location.Country == country {
			return true, fmt.Sprintf("Transaction involving high-risk country: %s", country)
		}
	}

	return false, ""
}

func (fde *FraudDetectionEngine) checkPatternAnomaly(rule FraudRule, req FraudCheckRequest, patterns *UserPatterns) (bool, string) {
	if patterns == nil {
		return false, ""
	}

	// Simple pattern anomaly detection
	// In production, this would call the ML service
	anomalyScore := 0.0

	// Check amount deviation
	if patterns.StdDevAmount > 0 {
		deviation := math.Abs(req.Amount-patterns.AvgAmount) / patterns.StdDevAmount
		if deviation > 2 {
			anomalyScore += 0.3
		}
	}

	// Check time pattern
	hour := req.Timestamp.Hour()
	isTypicalHour := false
	for _, h := range patterns.TypicalHours {
		if h == hour {
			isTypicalHour = true
			break
		}
	}
	if !isTypicalHour && len(patterns.TypicalHours) > 0 {
		anomalyScore += 0.2
	}

	// Check channel pattern
	isTypicalChannel := false
	for _, c := range patterns.TypicalChannels {
		if c == string(req.Channel) {
			isTypicalChannel = true
			break
		}
	}
	if !isTypicalChannel && len(patterns.TypicalChannels) > 0 {
		anomalyScore += 0.2
	}

	threshold := 0.7
	if t, ok := rule.Parameters["threshold"].(float64); ok {
		threshold = t
	}

	if anomalyScore >= threshold {
		return true, fmt.Sprintf("Transaction pattern anomaly detected (score: %.2f)", anomalyScore)
	}

	return false, ""
}

func (fde *FraudDetectionEngine) getRiskLevel(score int, config FraudDetectionConfig) string {
	if score >= config.BlockThreshold {
		return "critical"
	}
	if score >= config.ReviewThreshold {
		return "high"
	}
	if score >= config.MFAThreshold {
		return "medium"
	}
	return "low"
}

func (fde *FraudDetectionEngine) determineAction(result *FraudCheckResult, config FraudDetectionConfig) FraudAction {
	// Check if any triggered rule requires blocking
	for _, rule := range result.TriggeredRules {
		if rule.Action == ActionBlock {
			return ActionBlock
		}
	}

	// Determine action based on score
	if result.RiskScore >= config.BlockThreshold {
		return ActionBlock
	}
	if result.RiskScore >= config.ReviewThreshold {
		return ActionHoldForReview
	}
	if result.RiskScore >= config.MFAThreshold {
		return ActionAllowWithMFA
	}
	if result.RiskScore >= config.AlertThreshold {
		return ActionAlertOnly
	}

	return ActionAllow
}

func (fde *FraudDetectionEngine) recordFraudAlert(req FraudCheckRequest, result *FraudCheckResult) {
	alertID := fmt.Sprintf("alert_%d", time.Now().UnixNano())
	triggeredRulesJSON, _ := json.Marshal(result.TriggeredRules)
	reasonsJSON, _ := json.Marshal(result.Reasons)

	_, err := fde.db.Exec(`
		INSERT INTO fraud_alerts (alert_id, user_id, tenant_id, transaction_id, risk_score,
		                          risk_level, action_taken, triggered_rules, reasons)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, alertID, req.UserID, req.TenantID, req.TransactionID, result.RiskScore,
		result.RiskLevel, result.Action, triggeredRulesJSON, reasonsJSON)

	if err != nil {
		log.Printf("Warning: Failed to record fraud alert: %v", err)
	}
}

func (fde *FraudDetectionEngine) updateUserPatterns(req FraudCheckRequest) {
	// Record transaction in history
	locationJSON, _ := json.Marshal(req.Location)
	_, err := fde.db.Exec(`
		INSERT INTO transaction_history (user_id, tenant_id, transaction_id, amount,
		                                 transaction_type, channel, recipient_id,
		                                 device_id, ip_address, location)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, req.UserID, req.TenantID, req.TransactionID, req.Amount,
		req.TransactionType, req.Channel, req.RecipientID,
		req.DeviceID, req.IPAddress, locationJSON)

	if err != nil {
		log.Printf("Warning: Failed to record transaction history: %v", err)
	}

	// Update user patterns (simplified - in production, use more sophisticated aggregation)
	_, err = fde.db.Exec(`
		INSERT INTO user_transaction_patterns (user_id, tenant_id, avg_transaction_amount,
		                                       last_activity_at, last_location, pattern_updated_at)
		VALUES ($1, $2, $3, NOW(), $4, NOW())
		ON CONFLICT (user_id, tenant_id) DO UPDATE SET
			last_activity_at = NOW(),
			last_location = EXCLUDED.last_location,
			pattern_updated_at = NOW()
	`, req.UserID, req.TenantID, req.Amount, locationJSON)

	if err != nil {
		log.Printf("Warning: Failed to update user patterns: %v", err)
	}
}

// GetFraudAlerts retrieves fraud alerts for review
func (fde *FraudDetectionEngine) GetFraudAlerts(tenantID, status string, limit, offset int) ([]map[string]interface{}, error) {
	query := `
		SELECT alert_id, user_id, transaction_id, risk_score, risk_level,
		       action_taken, triggered_rules, reasons, status, created_at
		FROM fraud_alerts
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
	`
	args := []interface{}{tenantID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	query += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(len(args)+1) + " OFFSET $" + strconv.Itoa(len(args)+2)
	args = append(args, limit, offset)

	rows, err := fde.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var alertID, userID, transactionID, riskLevel, actionTaken, alertStatus string
		var riskScore int
		var triggeredRulesJSON, reasonsJSON []byte
		var createdAt time.Time

		if err := rows.Scan(&alertID, &userID, &transactionID, &riskScore, &riskLevel,
			&actionTaken, &triggeredRulesJSON, &reasonsJSON, &alertStatus, &createdAt); err != nil {
			continue
		}

		var triggeredRules []TriggeredRule
		var reasons []string
		json.Unmarshal(triggeredRulesJSON, &triggeredRules)
		json.Unmarshal(reasonsJSON, &reasons)

		results = append(results, map[string]interface{}{
			"alert_id":        alertID,
			"user_id":         userID,
			"transaction_id":  transactionID,
			"risk_score":      riskScore,
			"risk_level":      riskLevel,
			"action_taken":    actionTaken,
			"triggered_rules": triggeredRules,
			"reasons":         reasons,
			"status":          alertStatus,
			"created_at":      createdAt,
		})
	}

	return results, nil
}

// ReviewFraudAlert updates the status of a fraud alert after review
func (fde *FraudDetectionEngine) ReviewFraudAlert(alertID, reviewedBy, status, notes string) error {
	_, err := fde.db.Exec(`
		UPDATE fraud_alerts
		SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
		WHERE alert_id = $4
	`, status, reviewedBy, notes, alertID)
	return err
}
