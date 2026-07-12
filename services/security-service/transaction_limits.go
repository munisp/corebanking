package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/afrong/54link-secuirity-service/payment_types"
)

// UserTier represents the KYC/verification level of a user
type UserTier string

const (
	TierBasic      UserTier = "basic"      // Unverified/NUBAN only
	TierVerified   UserTier = "verified"   // Full KYC retail
	TierPremium    UserTier = "premium"    // Premium retail
	TierEnterprise UserTier = "enterprise" // Corporate/Business
)

// TransactionType is an alias to the centralized payment type from payment_types package
type TransactionType = payment_types.PaymentType

// Exported constants for commonly used transaction types (for backward compatibility)
// Note: New code should use payment_types.TRANSFER, payment_types.WITHDRAWAL, etc.
var (
	TxTypeTransfer    = payment_types.TRANSFER
	TxTypeWithdrawal  = payment_types.WITHDRAWAL
	TxTypePayment     = payment_types.TRANSFER // Legacy mapping - defaults to Transfer
	TxTypeBillPayment = payment_types.BILL_PAYMENT
	TxTypeCardPayment = payment_types.CARD_PAYMENT
	TxTypeFX          = payment_types.FX
)

// Channel represents the transaction channel
type Channel string

const (
	ChannelMobile Channel = "mobile"
	ChannelWeb    Channel = "web"
	ChannelUSSD   Channel = "ussd"
	ChannelAPI    Channel = "api"
	ChannelAgent  Channel = "agent"
	ChannelBranch Channel = "branch"
)

// TransactionLimitConfig holds configurable limits per tier
type TransactionLimitConfig struct {
	// Daily limits in NGN (configurable per tenant)
	DailyLimit    float64 `json:"daily_limit"`
	SingleTxLimit float64 `json:"single_tx_limit"`
	WeeklyLimit   float64 `json:"weekly_limit"`
	MonthlyLimit  float64 `json:"monthly_limit"`

	// Velocity limits
	MaxTxPerDay         int `json:"max_tx_per_day"`
	MaxTxPerHour        int `json:"max_tx_per_hour"`
	MaxRecipientsPerDay int `json:"max_recipients_per_day"`

	// MFA thresholds
	MFAThreshold float64 `json:"mfa_threshold"`

	// Channel-specific limits (optional overrides)
	ChannelLimits map[Channel]float64 `json:"channel_limits,omitempty"`
}

// DefaultLimits provides default limits per tier (in NGN)
// These are configurable defaults that can be overridden per tenant
var DefaultLimits = map[UserTier]TransactionLimitConfig{
	TierBasic: {
		DailyLimit:          50000,  // NGN 50,000/day
		SingleTxLimit:       20000,  // NGN 20,000/tx
		WeeklyLimit:         200000, // NGN 200,000/week
		MonthlyLimit:        500000, // NGN 500,000/month
		MaxTxPerDay:         10,
		MaxTxPerHour:        5,
		MaxRecipientsPerDay: 5,
		MFAThreshold:        10000, // Require MFA above NGN 10,000
	},
	TierVerified: {
		DailyLimit:          500000,  // NGN 500,000/day
		SingleTxLimit:       200000,  // NGN 200,000/tx
		WeeklyLimit:         2000000, // NGN 2,000,000/week
		MonthlyLimit:        5000000, // NGN 5,000,000/month
		MaxTxPerDay:         50,
		MaxTxPerHour:        20,
		MaxRecipientsPerDay: 20,
		MFAThreshold:        50000, // Require MFA above NGN 50,000
	},
	TierPremium: {
		DailyLimit:          5000000,  // NGN 5,000,000/day
		SingleTxLimit:       2000000,  // NGN 2,000,000/tx
		WeeklyLimit:         20000000, // NGN 20,000,000/week
		MonthlyLimit:        50000000, // NGN 50,000,000/month
		MaxTxPerDay:         100,
		MaxTxPerHour:        50,
		MaxRecipientsPerDay: 50,
		MFAThreshold:        200000, // Require MFA above NGN 200,000
	},
	TierEnterprise: {
		DailyLimit:          50000000,  // NGN 50,000,000/day
		SingleTxLimit:       20000000,  // NGN 20,000,000/tx
		WeeklyLimit:         200000000, // NGN 200,000,000/week
		MonthlyLimit:        500000000, // NGN 500,000,000/month
		MaxTxPerDay:         500,
		MaxTxPerHour:        100,
		MaxRecipientsPerDay: 200,
		MFAThreshold:        1000000, // Require MFA above NGN 1,000,000
	},
}

// TransactionLimitManager manages transaction limits
type TransactionLimitManager struct {
	db           *sql.DB
	limits       map[UserTier]TransactionLimitConfig
	tenantLimits map[string]map[UserTier]TransactionLimitConfig // tenant-specific overrides
	mu           sync.RWMutex
}

// TransactionRequest represents a transaction to be validated
type TransactionRequest struct {
	UserID          string          `json:"user_id"`
	TenantID        string          `json:"tenant_id"`
	Amount          float64         `json:"amount"`
	Currency        string          `json:"currency"`
	TransactionType TransactionType `json:"transaction_type"`
	Channel         Channel         `json:"channel"`
	RecipientID     string          `json:"recipient_id"`
	RecipientType   string          `json:"recipient_type"` // internal, external, new
	DeviceID        string          `json:"device_id"`
	IPAddress       string          `json:"ip_address"`
}

// LimitCheckResult represents the result of a limit check
type LimitCheckResult struct {
	Allowed         bool     `json:"allowed"`
	RequiresMFA     bool     `json:"requires_mfa"`
	RequiresReview  bool     `json:"requires_review"`
	Violations      []string `json:"violations,omitempty"`
	RemainingDaily  float64  `json:"remaining_daily"`
	RemainingWeekly float64  `json:"remaining_weekly"`
	UsedToday       float64  `json:"used_today"`
	TxCountToday    int      `json:"tx_count_today"`
	RiskScore       int      `json:"risk_score"`
}

// NewTransactionLimitManager creates a new transaction limit manager
func NewTransactionLimitManager(db *sql.DB) *TransactionLimitManager {
	tlm := &TransactionLimitManager{
		db:           db,
		limits:       make(map[UserTier]TransactionLimitConfig),
		tenantLimits: make(map[string]map[UserTier]TransactionLimitConfig),
	}

	// Load default limits
	for tier, config := range DefaultLimits {
		tlm.limits[tier] = config
	}

	// Override from environment variables if set
	tlm.loadEnvOverrides()

	// Create necessary tables
	tlm.createTables()

	// Load tenant-specific limits from database
	tlm.loadTenantLimits()

	return tlm
}

func (tlm *TransactionLimitManager) loadEnvOverrides() {
	// Allow environment variable overrides for default limits
	if val := os.Getenv("BASIC_DAILY_LIMIT"); val != "" {
		if limit, err := strconv.ParseFloat(val, 64); err == nil {
			config := tlm.limits[TierBasic]
			config.DailyLimit = limit
			tlm.limits[TierBasic] = config
		}
	}
	if val := os.Getenv("VERIFIED_DAILY_LIMIT"); val != "" {
		if limit, err := strconv.ParseFloat(val, 64); err == nil {
			config := tlm.limits[TierVerified]
			config.DailyLimit = limit
			tlm.limits[TierVerified] = config
		}
	}
	if val := os.Getenv("PREMIUM_DAILY_LIMIT"); val != "" {
		if limit, err := strconv.ParseFloat(val, 64); err == nil {
			config := tlm.limits[TierPremium]
			config.DailyLimit = limit
			tlm.limits[TierPremium] = config
		}
	}
	if val := os.Getenv("ENTERPRISE_DAILY_LIMIT"); val != "" {
		if limit, err := strconv.ParseFloat(val, 64); err == nil {
			config := tlm.limits[TierEnterprise]
			config.DailyLimit = limit
			tlm.limits[TierEnterprise] = config
		}
	}
}

func (tlm *TransactionLimitManager) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS transaction_limits (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50),
		tier VARCHAR(20) NOT NULL,
		daily_limit DECIMAL(20, 2),
		single_tx_limit DECIMAL(20, 2),
		weekly_limit DECIMAL(20, 2),
		monthly_limit DECIMAL(20, 2),
		max_tx_per_day INT,
		max_tx_per_hour INT,
		max_recipients_per_day INT,
		mfa_threshold DECIMAL(20, 2),
		channel_limits JSONB,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(tenant_id, tier)
	);

	CREATE INDEX IF NOT EXISTS idx_transaction_limits_tenant ON transaction_limits(tenant_id);

	CREATE TABLE IF NOT EXISTS transaction_velocity (
		id SERIAL PRIMARY KEY,
		user_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50),
		transaction_date DATE NOT NULL,
		total_amount DECIMAL(20, 2) DEFAULT 0,
		transaction_count INT DEFAULT 0,
		unique_recipients INT DEFAULT 0,
		recipients JSONB DEFAULT '[]',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, transaction_date)
	);

	CREATE INDEX IF NOT EXISTS idx_transaction_velocity_user ON transaction_velocity(user_id);
	CREATE INDEX IF NOT EXISTS idx_transaction_velocity_date ON transaction_velocity(transaction_date);

	CREATE TABLE IF NOT EXISTS hourly_velocity (
		id SERIAL PRIMARY KEY,
		user_id VARCHAR(50) NOT NULL,
		hour_bucket TIMESTAMP NOT NULL,
		transaction_count INT DEFAULT 0,
		total_amount DECIMAL(20, 2) DEFAULT 0,
		UNIQUE(user_id, hour_bucket)
	);

	CREATE INDEX IF NOT EXISTS idx_hourly_velocity_user ON hourly_velocity(user_id);
	CREATE INDEX IF NOT EXISTS idx_hourly_velocity_bucket ON hourly_velocity(hour_bucket);
	`

	_, err := tlm.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create transaction limit tables: %v", err)
	}
}

func (tlm *TransactionLimitManager) loadTenantLimits() {
	rows, err := tlm.db.Query(`
		SELECT tenant_id, tier, daily_limit, single_tx_limit, weekly_limit, monthly_limit,
		       max_tx_per_day, max_tx_per_hour, max_recipients_per_day, mfa_threshold, channel_limits
		FROM transaction_limits
		WHERE tenant_id IS NOT NULL
	`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant limits: %v", err)
		return
	}
	defer rows.Close()

	tlm.mu.Lock()
	defer tlm.mu.Unlock()

	for rows.Next() {
		var tenantID, tier string
		var config TransactionLimitConfig
		var channelLimitsJSON []byte

		err := rows.Scan(&tenantID, &tier, &config.DailyLimit, &config.SingleTxLimit,
			&config.WeeklyLimit, &config.MonthlyLimit, &config.MaxTxPerDay,
			&config.MaxTxPerHour, &config.MaxRecipientsPerDay, &config.MFAThreshold, &channelLimitsJSON)
		if err != nil {
			continue
		}

		if channelLimitsJSON != nil {
			json.Unmarshal(channelLimitsJSON, &config.ChannelLimits)
		}

		if tlm.tenantLimits[tenantID] == nil {
			tlm.tenantLimits[tenantID] = make(map[UserTier]TransactionLimitConfig)
		}
		tlm.tenantLimits[tenantID][UserTier(tier)] = config
	}
}

// GetLimits returns the applicable limits for a user
func (tlm *TransactionLimitManager) GetLimits(tenantID string, tier UserTier) TransactionLimitConfig {
	tlm.mu.RLock()
	defer tlm.mu.RUnlock()

	// Check for tenant-specific limits first
	if tenantLimits, ok := tlm.tenantLimits[tenantID]; ok {
		if config, ok := tenantLimits[tier]; ok {
			return config
		}
	}

	// Fall back to default limits
	if config, ok := tlm.limits[tier]; ok {
		return config
	}

	// Ultimate fallback to basic tier
	return tlm.limits[TierBasic]
}

// SetTenantLimits sets custom limits for a tenant
func (tlm *TransactionLimitManager) SetTenantLimits(tenantID string, tier UserTier, config TransactionLimitConfig) error {
	channelLimitsJSON, _ := json.Marshal(config.ChannelLimits)

	_, err := tlm.db.Exec(`
		INSERT INTO transaction_limits (tenant_id, tier, daily_limit, single_tx_limit, weekly_limit, monthly_limit,
		                                max_tx_per_day, max_tx_per_hour, max_recipients_per_day, mfa_threshold, channel_limits)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (tenant_id, tier) DO UPDATE SET
			daily_limit = EXCLUDED.daily_limit,
			single_tx_limit = EXCLUDED.single_tx_limit,
			weekly_limit = EXCLUDED.weekly_limit,
			monthly_limit = EXCLUDED.monthly_limit,
			max_tx_per_day = EXCLUDED.max_tx_per_day,
			max_tx_per_hour = EXCLUDED.max_tx_per_hour,
			max_recipients_per_day = EXCLUDED.max_recipients_per_day,
			mfa_threshold = EXCLUDED.mfa_threshold,
			channel_limits = EXCLUDED.channel_limits,
			updated_at = CURRENT_TIMESTAMP
	`, tenantID, string(tier), config.DailyLimit, config.SingleTxLimit, config.WeeklyLimit,
		config.MonthlyLimit, config.MaxTxPerDay, config.MaxTxPerHour, config.MaxRecipientsPerDay,
		config.MFAThreshold, channelLimitsJSON)

	if err != nil {
		return err
	}

	// Update in-memory cache
	tlm.mu.Lock()
	if tlm.tenantLimits[tenantID] == nil {
		tlm.tenantLimits[tenantID] = make(map[UserTier]TransactionLimitConfig)
	}
	tlm.tenantLimits[tenantID][tier] = config
	tlm.mu.Unlock()

	return nil
}

// CheckTransactionLimits validates a transaction against limits
func (tlm *TransactionLimitManager) CheckTransactionLimits(req TransactionRequest, tier UserTier) (*LimitCheckResult, error) {
	limits := tlm.GetLimits(req.TenantID, tier)
	result := &LimitCheckResult{
		Allowed:    true,
		Violations: []string{},
	}

	// Get current velocity data
	velocity, err := tlm.getVelocityData(req.UserID)
	if err != nil {
		log.Printf("Warning: Failed to get velocity data: %v", err)
	}

	result.UsedToday = velocity.TotalAmount
	result.TxCountToday = velocity.TxCount
	result.RemainingDaily = limits.DailyLimit - velocity.TotalAmount

	// Check single transaction limit
	if req.Amount > limits.SingleTxLimit {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Amount NGN %.2f exceeds single transaction limit of NGN %.2f", req.Amount, limits.SingleTxLimit))
	}

	// Check daily limit
	if velocity.TotalAmount+req.Amount > limits.DailyLimit {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Transaction would exceed daily limit of NGN %.2f (used: NGN %.2f)", limits.DailyLimit, velocity.TotalAmount))
	}

	// Check weekly limit
	weeklyTotal, _ := tlm.getWeeklyTotal(req.UserID)
	if weeklyTotal+req.Amount > limits.WeeklyLimit {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Transaction would exceed weekly limit of NGN %.2f", limits.WeeklyLimit))
	}
	result.RemainingWeekly = limits.WeeklyLimit - weeklyTotal

	// Check monthly limit
	monthlyTotal, _ := tlm.getMonthlyTotal(req.UserID)
	if monthlyTotal+req.Amount > limits.MonthlyLimit {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Transaction would exceed monthly limit of NGN %.2f", limits.MonthlyLimit))
	}

	// Check transaction count per day
	if velocity.TxCount >= limits.MaxTxPerDay {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Maximum transactions per day (%d) exceeded", limits.MaxTxPerDay))
	}

	// Check transaction count per hour
	hourlyCount, _ := tlm.getHourlyCount(req.UserID)
	if hourlyCount >= limits.MaxTxPerHour {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Maximum transactions per hour (%d) exceeded", limits.MaxTxPerHour))
	}

	// Check unique recipients per day
	if req.RecipientType == "new" && velocity.UniqueRecipients >= limits.MaxRecipientsPerDay {
		result.Allowed = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Maximum unique recipients per day (%d) exceeded", limits.MaxRecipientsPerDay))
	}

	// Check channel-specific limits
	if limits.ChannelLimits != nil {
		if channelLimit, ok := limits.ChannelLimits[req.Channel]; ok {
			if req.Amount > channelLimit {
				result.Allowed = false
				result.Violations = append(result.Violations,
					fmt.Sprintf("Amount exceeds %s channel limit of NGN %.2f", req.Channel, channelLimit))
			}
		}
	}

	// Check if MFA is required
	if req.Amount >= limits.MFAThreshold {
		result.RequiresMFA = true
	}

	// Calculate risk score based on velocity patterns
	result.RiskScore = tlm.calculateVelocityRisk(req, velocity, limits)

	// Flag for review if risk score is high
	if result.RiskScore >= 70 {
		result.RequiresReview = true
	}

	return result, nil
}

// VelocityData holds current velocity metrics for a user
type VelocityData struct {
	TotalAmount      float64
	TxCount          int
	UniqueRecipients int
	Recipients       []string
}

func (tlm *TransactionLimitManager) getVelocityData(userID string) (VelocityData, error) {
	var data VelocityData
	var recipientsJSON []byte

	err := tlm.db.QueryRow(`
		SELECT COALESCE(total_amount, 0), COALESCE(transaction_count, 0), 
		       COALESCE(unique_recipients, 0), COALESCE(recipients, '[]')
		FROM transaction_velocity
		WHERE user_id = $1 AND transaction_date = CURRENT_DATE
	`, userID).Scan(&data.TotalAmount, &data.TxCount, &data.UniqueRecipients, &recipientsJSON)

	if err != nil && err != sql.ErrNoRows {
		return data, err
	}

	if recipientsJSON != nil {
		json.Unmarshal(recipientsJSON, &data.Recipients)
	}

	return data, nil
}

func (tlm *TransactionLimitManager) getWeeklyTotal(userID string) (float64, error) {
	var total float64
	err := tlm.db.QueryRow(`
		SELECT COALESCE(SUM(total_amount), 0)
		FROM transaction_velocity
		WHERE user_id = $1 AND transaction_date >= CURRENT_DATE - INTERVAL '7 days'
	`, userID).Scan(&total)
	return total, err
}

func (tlm *TransactionLimitManager) getMonthlyTotal(userID string) (float64, error) {
	var total float64
	err := tlm.db.QueryRow(`
		SELECT COALESCE(SUM(total_amount), 0)
		FROM transaction_velocity
		WHERE user_id = $1 AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
	`, userID).Scan(&total)
	return total, err
}

func (tlm *TransactionLimitManager) getHourlyCount(userID string) (int, error) {
	var count int
	hourBucket := time.Now().Truncate(time.Hour)
	err := tlm.db.QueryRow(`
		SELECT COALESCE(transaction_count, 0)
		FROM hourly_velocity
		WHERE user_id = $1 AND hour_bucket = $2
	`, userID, hourBucket).Scan(&count)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

// RecordTransaction records a transaction for velocity tracking
func (tlm *TransactionLimitManager) RecordTransaction(req TransactionRequest) error {
	// Update daily velocity
	recipientsJSON, _ := json.Marshal([]string{req.RecipientID})

	_, err := tlm.db.Exec(`
		INSERT INTO transaction_velocity (user_id, tenant_id, transaction_date, total_amount, transaction_count, unique_recipients, recipients)
		VALUES ($1, $2, CURRENT_DATE, $3, 1, 1, $4)
		ON CONFLICT (user_id, transaction_date) DO UPDATE SET
			total_amount = transaction_velocity.total_amount + EXCLUDED.total_amount,
			transaction_count = transaction_velocity.transaction_count + 1,
			unique_recipients = CASE 
				WHEN NOT (transaction_velocity.recipients @> $4) 
				THEN transaction_velocity.unique_recipients + 1 
				ELSE transaction_velocity.unique_recipients 
			END,
			recipients = CASE 
				WHEN NOT (transaction_velocity.recipients @> $4) 
				THEN transaction_velocity.recipients || $4 
				ELSE transaction_velocity.recipients 
			END,
			updated_at = CURRENT_TIMESTAMP
	`, req.UserID, req.TenantID, req.Amount, recipientsJSON)

	if err != nil {
		return err
	}

	// Update hourly velocity
	hourBucket := time.Now().Truncate(time.Hour)
	_, err = tlm.db.Exec(`
		INSERT INTO hourly_velocity (user_id, hour_bucket, transaction_count, total_amount)
		VALUES ($1, $2, 1, $3)
		ON CONFLICT (user_id, hour_bucket) DO UPDATE SET
			transaction_count = hourly_velocity.transaction_count + 1,
			total_amount = hourly_velocity.total_amount + EXCLUDED.total_amount
	`, req.UserID, hourBucket, req.Amount)

	return err
}

func (tlm *TransactionLimitManager) calculateVelocityRisk(req TransactionRequest, velocity VelocityData, limits TransactionLimitConfig) int {
	score := 0

	// High percentage of daily limit used
	if velocity.TotalAmount > 0 {
		usagePercent := (velocity.TotalAmount + req.Amount) / limits.DailyLimit * 100
		if usagePercent > 90 {
			score += 30
		} else if usagePercent > 70 {
			score += 20
		} else if usagePercent > 50 {
			score += 10
		}
	}

	// High transaction count
	txCountPercent := float64(velocity.TxCount+1) / float64(limits.MaxTxPerDay) * 100
	if txCountPercent > 80 {
		score += 20
	} else if txCountPercent > 50 {
		score += 10
	}

	// Many unique recipients
	recipientPercent := float64(velocity.UniqueRecipients+1) / float64(limits.MaxRecipientsPerDay) * 100
	if recipientPercent > 80 {
		score += 20
	} else if recipientPercent > 50 {
		score += 10
	}

	// New recipient
	if req.RecipientType == "new" {
		score += 15
	}

	// Large single transaction relative to limit
	txPercent := req.Amount / limits.SingleTxLimit * 100
	if txPercent > 80 {
		score += 15
	} else if txPercent > 50 {
		score += 10
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	return score
}

// GetUserTier retrieves the user's tier from the database
func (tlm *TransactionLimitManager) GetUserTier(userID string) (UserTier, error) {
	var tier string
	err := tlm.db.QueryRow(`
		SELECT COALESCE(tier, 'basic') FROM users WHERE user_id = $1
	`, userID).Scan(&tier)

	if err != nil {
		return TierBasic, err
	}

	return UserTier(tier), nil
}

// CleanupOldVelocityData removes velocity data older than 90 days
func (tlm *TransactionLimitManager) CleanupOldVelocityData() error {
	_, err := tlm.db.Exec(`
		DELETE FROM transaction_velocity WHERE transaction_date < CURRENT_DATE - INTERVAL '90 days'
	`)
	if err != nil {
		return err
	}

	_, err = tlm.db.Exec(`
		DELETE FROM hourly_velocity WHERE hour_bucket < NOW() - INTERVAL '7 days'
	`)
	return err
}
