package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// AuditEventType represents the type of audit event
type AuditEventType string

const (
	// Authentication events
	EventLogin          AuditEventType = "login"
	EventLogout         AuditEventType = "logout"
	EventLoginFailed    AuditEventType = "login_failed"
	EventPasswordChange AuditEventType = "password_change"
	EventPasswordReset  AuditEventType = "password_reset"
	EventMFAEnabled     AuditEventType = "mfa_enabled"
	EventMFADisabled    AuditEventType = "mfa_disabled"
	EventSessionRevoked AuditEventType = "session_revoked"

	// Account events
	EventAccountCreated    AuditEventType = "account_created"
	EventAccountUpdated    AuditEventType = "account_updated"
	EventAccountDeleted    AuditEventType = "account_deleted"
	EventAccountLocked     AuditEventType = "account_locked"
	EventAccountUnlocked   AuditEventType = "account_unlocked"
	EventRoleChanged       AuditEventType = "role_changed"
	EventPermissionChanged AuditEventType = "permission_changed"

	// Transaction events
	EventTransactionCreated  AuditEventType = "transaction_created"
	EventTransactionApproved AuditEventType = "transaction_approved"
	EventTransactionRejected AuditEventType = "transaction_rejected"
	EventTransactionReversed AuditEventType = "transaction_reversed"

	// API events
	EventAPIKeyCreated AuditEventType = "api_key_created"
	EventAPIKeyRevoked AuditEventType = "api_key_revoked"
	EventAPIKeyRotated AuditEventType = "api_key_rotated"

	// Security events
	EventSecurityAlert      AuditEventType = "security_alert"
	EventFraudDetected      AuditEventType = "fraud_detected"
	EventIPBlocked          AuditEventType = "ip_blocked"
	EventSuspiciousActivity AuditEventType = "suspicious_activity"

	// Data events
	EventDataExported AuditEventType = "data_exported"
	EventDataImported AuditEventType = "data_imported"
	EventDataDeleted  AuditEventType = "data_deleted"

	// Configuration events
	EventConfigChanged AuditEventType = "config_changed"
	EventPolicyChanged AuditEventType = "policy_changed"
)

// AuditSeverity represents the severity level of an audit event
type AuditSeverity string

const (
	SeverityInfo     AuditSeverity = "info"
	SeverityWarning  AuditSeverity = "warning"
	SeverityError    AuditSeverity = "error"
	SeverityCritical AuditSeverity = "critical"
)

// AuditTrailConfig holds configurable audit trail settings
type AuditTrailConfig struct {
	// Retention settings
	RetentionYears   int  `json:"retention_years"`    // Years to retain audit logs
	ArchiveAfterDays int  `json:"archive_after_days"` // Days before archiving
	CompressArchives bool `json:"compress_archives"`  // Compress archived logs

	// Chain validation
	EnableChainValidation   bool `json:"enable_chain_validation"`   // Enable hash chain
	ChainValidationInterval int  `json:"chain_validation_interval"` // Hours between validations

	// Sensitive field masking
	EnableMasking   bool     `json:"enable_masking"`   // Enable field masking
	SensitiveFields []string `json:"sensitive_fields"` // Fields to mask
	MaskingPattern  string   `json:"masking_pattern"`  // Pattern for masking

	// Logging settings
	LogToFile        bool   `json:"log_to_file"`          // Also log to file
	LogFilePath      string `json:"log_file_path"`        // Path to log file
	MaxLogFileSizeMB int    `json:"max_log_file_size_mb"` // Max log file size

	// Alerting
	AlertOnCritical       bool `json:"alert_on_critical"`        // Alert on critical events
	AlertOnSecurityEvents bool `json:"alert_on_security_events"` // Alert on security events
}

// DefaultAuditConfig provides secure defaults
var DefaultAuditConfig = AuditTrailConfig{
	RetentionYears:          7,
	ArchiveAfterDays:        90,
	CompressArchives:        true,
	EnableChainValidation:   true,
	ChainValidationInterval: 24,
	EnableMasking:           true,
	SensitiveFields: []string{
		"password", "pin", "cvv", "card_number", "account_number",
		"ssn", "bvn", "nin", "secret", "token", "api_key",
		"private_key", "credit_card", "debit_card", "pan",
	},
	MaskingPattern:        "****",
	LogToFile:             false,
	LogFilePath:           "/var/log/54bank/audit.log",
	MaxLogFileSizeMB:      100,
	AlertOnCritical:       true,
	AlertOnSecurityEvents: true,
}

// AuditEntry represents a single audit log entry
type AuditEntry struct {
	ID           string                 `json:"id"`
	EventType    AuditEventType         `json:"event_type"`
	Severity     AuditSeverity          `json:"severity"`
	UserID       string                 `json:"user_id,omitempty"`
	TenantID     string                 `json:"tenant_id,omitempty"`
	ActorID      string                 `json:"actor_id,omitempty"`      // Who performed the action
	ActorType    string                 `json:"actor_type,omitempty"`    // user, system, api
	ResourceType string                 `json:"resource_type,omitempty"` // account, transaction, etc.
	ResourceID   string                 `json:"resource_id,omitempty"`
	Action       string                 `json:"action"`
	Description  string                 `json:"description"`
	OldValue     map[string]interface{} `json:"old_value,omitempty"`
	NewValue     map[string]interface{} `json:"new_value,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	RequestID    string                 `json:"request_id,omitempty"`
	PreviousHash string                 `json:"previous_hash,omitempty"`
	EntryHash    string                 `json:"entry_hash"`
	Timestamp    time.Time              `json:"timestamp"`
	Archived     bool                   `json:"archived"`
}

// AuditTrailManager manages audit trail logging
type AuditTrailManager struct {
	db           *sql.DB
	config       AuditTrailConfig
	tenantConfig map[string]AuditTrailConfig
	lastHash     string
	mu           sync.RWMutex
	logFile      *os.File
}

// NewAuditTrailManager creates a new audit trail manager
func NewAuditTrailManager(db *sql.DB) *AuditTrailManager {
	atm := &AuditTrailManager{
		db:           db,
		config:       DefaultAuditConfig,
		tenantConfig: make(map[string]AuditTrailConfig),
	}

	// Load environment overrides
	atm.loadEnvOverrides()

	// Create necessary tables
	atm.createTables()

	// Load tenant-specific configs
	atm.loadTenantConfigs()

	// Load last hash for chain validation
	atm.loadLastHash()

	// Open log file if configured
	if atm.config.LogToFile {
		atm.openLogFile()
	}

	// Start background tasks
	go atm.backgroundTasks()

	return atm
}

func (atm *AuditTrailManager) loadEnvOverrides() {
	if val := os.Getenv("AUDIT_RETENTION_YEARS"); val != "" {
		if years, err := strconv.Atoi(val); err == nil {
			atm.config.RetentionYears = years
		}
	}
	if val := os.Getenv("AUDIT_ARCHIVE_AFTER_DAYS"); val != "" {
		if days, err := strconv.Atoi(val); err == nil {
			atm.config.ArchiveAfterDays = days
		}
	}
	if val := os.Getenv("AUDIT_ENABLE_CHAIN_VALIDATION"); val != "" {
		atm.config.EnableChainValidation = val == "true"
	}
	if val := os.Getenv("AUDIT_LOG_FILE_PATH"); val != "" {
		atm.config.LogFilePath = val
		atm.config.LogToFile = true
	}
}

func (atm *AuditTrailManager) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS audit_config (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50) UNIQUE,
		config JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS audit_trail (
		id VARCHAR(50) PRIMARY KEY,
		event_type VARCHAR(50) NOT NULL,
		severity VARCHAR(20) NOT NULL,
		user_id VARCHAR(50),
		tenant_id VARCHAR(50),
		actor_id VARCHAR(50),
		actor_type VARCHAR(20),
		resource_type VARCHAR(50),
		resource_id VARCHAR(100),
		action VARCHAR(100) NOT NULL,
		description TEXT,
		old_value JSONB,
		new_value JSONB,
		metadata JSONB,
		ip_address VARCHAR(45),
		user_agent TEXT,
		session_id VARCHAR(100),
		request_id VARCHAR(100),
		previous_hash VARCHAR(64),
		entry_hash VARCHAR(64) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		archived BOOLEAN DEFAULT FALSE
	);

	CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON audit_trail(event_type);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON audit_trail(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_actor ON audit_trail(actor_id);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_severity ON audit_trail(severity);
	CREATE INDEX IF NOT EXISTS idx_audit_trail_archived ON audit_trail(archived);

	CREATE TABLE IF NOT EXISTS audit_trail_archive (
		id VARCHAR(50) PRIMARY KEY,
		event_type VARCHAR(50) NOT NULL,
		severity VARCHAR(20) NOT NULL,
		user_id VARCHAR(50),
		tenant_id VARCHAR(50),
		actor_id VARCHAR(50),
		actor_type VARCHAR(20),
		resource_type VARCHAR(50),
		resource_id VARCHAR(100),
		action VARCHAR(100) NOT NULL,
		description TEXT,
		old_value JSONB,
		new_value JSONB,
		metadata JSONB,
		ip_address VARCHAR(45),
		user_agent TEXT,
		session_id VARCHAR(100),
		request_id VARCHAR(100),
		previous_hash VARCHAR(64),
		entry_hash VARCHAR(64) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_audit_archive_created ON audit_trail_archive(created_at);
	CREATE INDEX IF NOT EXISTS idx_audit_archive_user ON audit_trail_archive(user_id);
	CREATE INDEX IF NOT EXISTS idx_audit_archive_tenant ON audit_trail_archive(tenant_id);

	CREATE TABLE IF NOT EXISTS audit_chain_validation (
		id SERIAL PRIMARY KEY,
		validation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		start_id VARCHAR(50),
		end_id VARCHAR(50),
		entries_validated INT,
		valid BOOLEAN NOT NULL,
		errors JSONB,
		duration_ms INT
	);
	`

	_, err := atm.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create audit trail tables: %v", err)
	}
}

func (atm *AuditTrailManager) loadTenantConfigs() {
	rows, err := atm.db.Query(`SELECT tenant_id, config FROM audit_config WHERE tenant_id IS NOT NULL`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant audit configs: %v", err)
		return
	}
	defer rows.Close()

	atm.mu.Lock()
	defer atm.mu.Unlock()

	for rows.Next() {
		var tenantID string
		var configJSON []byte
		if err := rows.Scan(&tenantID, &configJSON); err != nil {
			continue
		}

		var config AuditTrailConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			continue
		}

		atm.tenantConfig[tenantID] = config
	}
}

func (atm *AuditTrailManager) loadLastHash() {
	var hash string
	err := atm.db.QueryRow(`
		SELECT entry_hash FROM audit_trail
		ORDER BY created_at DESC
		LIMIT 1
	`).Scan(&hash)

	if err == nil {
		atm.mu.Lock()
		atm.lastHash = hash
		atm.mu.Unlock()
	}
}

func (atm *AuditTrailManager) openLogFile() {
	file, err := os.OpenFile(atm.config.LogFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("Warning: Failed to open audit log file: %v", err)
		return
	}
	atm.logFile = file
}

// GetConfig returns the applicable audit config
func (atm *AuditTrailManager) GetConfig(tenantID string) AuditTrailConfig {
	atm.mu.RLock()
	defer atm.mu.RUnlock()

	if tenantID != "" {
		if config, ok := atm.tenantConfig[tenantID]; ok {
			return config
		}
	}

	return atm.config
}

// LogEvent logs an audit event
func (atm *AuditTrailManager) LogEvent(entry AuditEntry) error {
	config := atm.GetConfig(entry.TenantID)

	// Generate ID if not provided
	if entry.ID == "" {
		entry.ID = fmt.Sprintf("audit_%d", time.Now().UnixNano())
	}

	// Set timestamp if not provided
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}

	// Mask sensitive fields
	if config.EnableMasking {
		entry.OldValue = atm.maskSensitiveFields(entry.OldValue, config.SensitiveFields)
		entry.NewValue = atm.maskSensitiveFields(entry.NewValue, config.SensitiveFields)
		entry.Metadata = atm.maskSensitiveFields(entry.Metadata, config.SensitiveFields)
	}

	// Calculate hash chain
	if config.EnableChainValidation {
		atm.mu.Lock()
		entry.PreviousHash = atm.lastHash
		entry.EntryHash = atm.calculateEntryHash(entry)
		atm.lastHash = entry.EntryHash
		atm.mu.Unlock()
	} else {
		entry.EntryHash = atm.calculateEntryHash(entry)
	}

	// Store in database
	oldValueJSON, _ := json.Marshal(entry.OldValue)
	newValueJSON, _ := json.Marshal(entry.NewValue)
	metadataJSON, _ := json.Marshal(entry.Metadata)

	_, err := atm.db.Exec(`
		INSERT INTO audit_trail (id, event_type, severity, user_id, tenant_id, actor_id, actor_type,
		                         resource_type, resource_id, action, description, old_value, new_value,
		                         metadata, ip_address, user_agent, session_id, request_id,
		                         previous_hash, entry_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`, entry.ID, entry.EventType, entry.Severity, entry.UserID, entry.TenantID,
		entry.ActorID, entry.ActorType, entry.ResourceType, entry.ResourceID,
		entry.Action, entry.Description, oldValueJSON, newValueJSON, metadataJSON,
		entry.IPAddress, entry.UserAgent, entry.SessionID, entry.RequestID,
		entry.PreviousHash, entry.EntryHash, entry.Timestamp)

	if err != nil {
		return fmt.Errorf("failed to log audit event: %v", err)
	}

	// Write to log file if configured
	if config.LogToFile && atm.logFile != nil {
		logLine, _ := json.Marshal(entry)
		atm.logFile.WriteString(string(logLine) + "\n")
	}

	// Alert on critical/security events
	if config.AlertOnCritical && entry.Severity == SeverityCritical {
		go atm.sendAlert(entry)
	}
	if config.AlertOnSecurityEvents && isSecurityEvent(entry.EventType) {
		go atm.sendAlert(entry)
	}

	return nil
}

func (atm *AuditTrailManager) maskSensitiveFields(data map[string]interface{}, sensitiveFields []string) map[string]interface{} {
	if data == nil {
		return nil
	}

	masked := make(map[string]interface{})
	for key, value := range data {
		lowerKey := strings.ToLower(key)
		isSensitive := false

		for _, field := range sensitiveFields {
			if strings.Contains(lowerKey, strings.ToLower(field)) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			// Mask the value
			if str, ok := value.(string); ok {
				if len(str) > 4 {
					masked[key] = str[:2] + "****" + str[len(str)-2:]
				} else {
					masked[key] = "****"
				}
			} else {
				masked[key] = "****"
			}
		} else if nestedMap, ok := value.(map[string]interface{}); ok {
			masked[key] = atm.maskSensitiveFields(nestedMap, sensitiveFields)
		} else {
			masked[key] = value
		}
	}

	return masked
}

func (atm *AuditTrailManager) calculateEntryHash(entry AuditEntry) string {
	// Create a deterministic string representation
	data := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
		entry.ID, entry.EventType, entry.Severity, entry.UserID, entry.TenantID,
		entry.ActorID, entry.Action, entry.ResourceType, entry.ResourceID,
		entry.PreviousHash, entry.Timestamp.Format(time.RFC3339Nano))

	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func isSecurityEvent(eventType AuditEventType) bool {
	securityEvents := map[AuditEventType]bool{
		EventLoginFailed:        true,
		EventAccountLocked:      true,
		EventSecurityAlert:      true,
		EventFraudDetected:      true,
		EventIPBlocked:          true,
		EventSuspiciousActivity: true,
		EventAPIKeyRevoked:      true,
	}
	return securityEvents[eventType]
}

func (atm *AuditTrailManager) sendAlert(entry AuditEntry) {
	// In production, this would send alerts via email, SMS, Slack, etc.
	log.Printf("AUDIT ALERT: %s - %s - %s", entry.Severity, entry.EventType, entry.Description)
}

// QueryAuditTrail queries the audit trail with filters
func (atm *AuditTrailManager) QueryAuditTrail(filters AuditQueryFilters) ([]AuditEntry, int, error) {
	query := `SELECT id, event_type, severity, user_id, tenant_id, actor_id, actor_type,
	                 resource_type, resource_id, action, description, old_value, new_value,
	                 metadata, ip_address, user_agent, session_id, request_id,
	                 previous_hash, entry_hash, created_at, archived
	          FROM audit_trail WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM audit_trail WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	// Build WHERE clause
	whereClause := ""

	if filters.TenantID != "" {
		whereClause += fmt.Sprintf(" AND tenant_id = $%d", argIndex)
		args = append(args, filters.TenantID)
		argIndex++
	}

	if filters.UserID != "" {
		whereClause += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, filters.UserID)
		argIndex++
	}

	if filters.ActorID != "" {
		whereClause += fmt.Sprintf(" AND actor_id = $%d", argIndex)
		args = append(args, filters.ActorID)
		argIndex++
	}

	if len(filters.EventTypes) > 0 {
		// Handle multiple event types with IN clause
		placeholders := make([]string, len(filters.EventTypes))
		for i, et := range filters.EventTypes {
			placeholders[i] = fmt.Sprintf("$%d", argIndex)
			args = append(args, et)
			argIndex++
		}
		whereClause += fmt.Sprintf(" AND event_type IN (%s)", strings.Join(placeholders, ","))
	} else if filters.EventType != "" {
		// Handle single event type for backward compatibility
		whereClause += fmt.Sprintf(" AND event_type = $%d", argIndex)
		args = append(args, filters.EventType)
		argIndex++
	}

	if filters.Severity != "" {
		whereClause += fmt.Sprintf(" AND severity = $%d", argIndex)
		args = append(args, filters.Severity)
		argIndex++
	}

	if filters.ResourceType != "" {
		whereClause += fmt.Sprintf(" AND resource_type = $%d", argIndex)
		args = append(args, filters.ResourceType)
		argIndex++
	}

	if filters.ResourceID != "" {
		whereClause += fmt.Sprintf(" AND resource_id = $%d", argIndex)
		args = append(args, filters.ResourceID)
		argIndex++
	}

	if !filters.StartTime.IsZero() {
		whereClause += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, filters.StartTime)
		argIndex++
	}

	if !filters.EndTime.IsZero() {
		whereClause += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, filters.EndTime)
		argIndex++
	}

	if filters.IPAddress != "" {
		whereClause += fmt.Sprintf(" AND ip_address = $%d", argIndex)
		args = append(args, filters.IPAddress)
		argIndex++
	}

	if filters.SearchText != "" {
		whereClause += fmt.Sprintf(" AND (description ILIKE $%d OR action ILIKE $%d)", argIndex, argIndex)
		args = append(args, "%"+filters.SearchText+"%")
		argIndex++
	}

	if !filters.IncludeArchived {
		whereClause += " AND archived = FALSE"
	}

	// Get total count
	var totalCount int
	err := atm.db.QueryRow(countQuery+whereClause, args...).Scan(&totalCount)
	if err != nil {
		return nil, 0, err
	}

	// Add ordering and pagination
	query += whereClause + " ORDER BY created_at DESC"

	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, filters.Limit)
		argIndex++
	}

	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, filters.Offset)
	}

	rows, err := atm.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var entry AuditEntry
		var oldValueJSON, newValueJSON, metadataJSON []byte
		var userID, tenantID, actorID, actorType, resourceType, resourceID sql.NullString
		var ipAddress, userAgent, sessionID, requestID, previousHash sql.NullString

		err := rows.Scan(
			&entry.ID, &entry.EventType, &entry.Severity, &userID, &tenantID,
			&actorID, &actorType, &resourceType, &resourceID, &entry.Action,
			&entry.Description, &oldValueJSON, &newValueJSON, &metadataJSON,
			&ipAddress, &userAgent, &sessionID, &requestID,
			&previousHash, &entry.EntryHash, &entry.Timestamp, &entry.Archived,
		)
		if err != nil {
			continue
		}

		// Handle nullable fields
		if userID.Valid {
			entry.UserID = userID.String
		}
		if tenantID.Valid {
			entry.TenantID = tenantID.String
		}
		if actorID.Valid {
			entry.ActorID = actorID.String
		}
		if actorType.Valid {
			entry.ActorType = actorType.String
		}
		if resourceType.Valid {
			entry.ResourceType = resourceType.String
		}
		if resourceID.Valid {
			entry.ResourceID = resourceID.String
		}
		if ipAddress.Valid {
			entry.IPAddress = ipAddress.String
		}
		if userAgent.Valid {
			entry.UserAgent = userAgent.String
		}
		if sessionID.Valid {
			entry.SessionID = sessionID.String
		}
		if requestID.Valid {
			entry.RequestID = requestID.String
		}
		if previousHash.Valid {
			entry.PreviousHash = previousHash.String
		}

		// Parse JSON fields
		json.Unmarshal(oldValueJSON, &entry.OldValue)
		json.Unmarshal(newValueJSON, &entry.NewValue)
		json.Unmarshal(metadataJSON, &entry.Metadata)

		entries = append(entries, entry)
	}

	return entries, totalCount, nil
}

// AuditQueryFilters holds filters for querying audit trail
type AuditQueryFilters struct {
	TenantID        string
	UserID          string
	ActorID         string
	EventType       string
	EventTypes      []string
	Severity        string
	ResourceType    string
	ResourceID      string
	StartTime       time.Time
	EndTime         time.Time
	IPAddress       string
	SearchText      string
	IncludeArchived bool
	Limit           int
	Offset          int
}

// ValidateChain validates the hash chain integrity
func (atm *AuditTrailManager) ValidateChain(startTime, endTime time.Time) (*ChainValidationResult, error) {
	startValidation := time.Now()

	result := &ChainValidationResult{
		Valid:  true,
		Errors: []ChainValidationError{},
	}

	query := `SELECT id, event_type, severity, user_id, tenant_id, actor_id, action,
	                 resource_type, resource_id, previous_hash, entry_hash, created_at
	          FROM audit_trail
	          WHERE created_at >= $1 AND created_at <= $2
	          ORDER BY created_at ASC`

	rows, err := atm.db.Query(query, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var previousHash string
	entriesValidated := 0

	for rows.Next() {
		var entry AuditEntry
		var userID, tenantID, actorID, resourceType, resourceID, prevHash sql.NullString

		err := rows.Scan(
			&entry.ID, &entry.EventType, &entry.Severity, &userID, &tenantID,
			&actorID, &entry.Action, &resourceType, &resourceID,
			&prevHash, &entry.EntryHash, &entry.Timestamp,
		)
		if err != nil {
			continue
		}

		if userID.Valid {
			entry.UserID = userID.String
		}
		if tenantID.Valid {
			entry.TenantID = tenantID.String
		}
		if actorID.Valid {
			entry.ActorID = actorID.String
		}
		if resourceType.Valid {
			entry.ResourceType = resourceType.String
		}
		if resourceID.Valid {
			entry.ResourceID = resourceID.String
		}
		if prevHash.Valid {
			entry.PreviousHash = prevHash.String
		}

		entriesValidated++

		// Validate previous hash link
		if entriesValidated > 1 && entry.PreviousHash != previousHash {
			result.Valid = false
			result.Errors = append(result.Errors, ChainValidationError{
				EntryID:      entry.ID,
				ErrorType:    "chain_break",
				Description:  "Previous hash does not match",
				ExpectedHash: previousHash,
				ActualHash:   entry.PreviousHash,
			})
		}

		// Recalculate and validate entry hash
		calculatedHash := atm.calculateEntryHash(entry)
		if calculatedHash != entry.EntryHash {
			result.Valid = false
			result.Errors = append(result.Errors, ChainValidationError{
				EntryID:      entry.ID,
				ErrorType:    "hash_mismatch",
				Description:  "Entry hash does not match calculated hash",
				ExpectedHash: calculatedHash,
				ActualHash:   entry.EntryHash,
			})
		}

		previousHash = entry.EntryHash
	}

	result.EntriesValidated = entriesValidated
	result.DurationMs = int(time.Since(startValidation).Milliseconds())

	// Record validation result
	errorsJSON, _ := json.Marshal(result.Errors)
	atm.db.Exec(`
		INSERT INTO audit_chain_validation (start_id, end_id, entries_validated, valid, errors, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, "", "", result.EntriesValidated, result.Valid, errorsJSON, result.DurationMs)

	return result, nil
}

// ChainValidationResult holds the result of chain validation
type ChainValidationResult struct {
	Valid            bool                   `json:"valid"`
	EntriesValidated int                    `json:"entries_validated"`
	Errors           []ChainValidationError `json:"errors"`
	DurationMs       int                    `json:"duration_ms"`
}

// ChainValidationError represents a chain validation error
type ChainValidationError struct {
	EntryID      string `json:"entry_id"`
	ErrorType    string `json:"error_type"`
	Description  string `json:"description"`
	ExpectedHash string `json:"expected_hash"`
	ActualHash   string `json:"actual_hash"`
}

// ArchiveOldEntries moves old entries to archive table
func (atm *AuditTrailManager) ArchiveOldEntries() (int, error) {
	config := atm.config

	// Move entries older than archive threshold to archive table
	result, err := atm.db.Exec(`
		INSERT INTO audit_trail_archive
		SELECT id, event_type, severity, user_id, tenant_id, actor_id, actor_type,
		       resource_type, resource_id, action, description, old_value, new_value,
		       metadata, ip_address, user_agent, session_id, request_id,
		       previous_hash, entry_hash, created_at, NOW()
		FROM audit_trail
		WHERE created_at < NOW() - INTERVAL '1 day' * $1
		AND archived = FALSE
	`, config.ArchiveAfterDays)

	if err != nil {
		return 0, err
	}

	rowsArchived, _ := result.RowsAffected()

	// Mark as archived in main table
	atm.db.Exec(`
		UPDATE audit_trail
		SET archived = TRUE
		WHERE created_at < NOW() - INTERVAL '1 day' * $1
		AND archived = FALSE
	`, config.ArchiveAfterDays)

	return int(rowsArchived), nil
}

// PurgeExpiredEntries removes entries older than retention period
func (atm *AuditTrailManager) PurgeExpiredEntries() (int, error) {
	config := atm.config

	// Delete from archive table
	result, err := atm.db.Exec(`
		DELETE FROM audit_trail_archive
		WHERE created_at < NOW() - INTERVAL '1 year' * $1
	`, config.RetentionYears)

	if err != nil {
		return 0, err
	}

	rowsDeleted, _ := result.RowsAffected()

	// Also delete archived entries from main table that are past retention
	atm.db.Exec(`
		DELETE FROM audit_trail
		WHERE archived = TRUE
		AND created_at < NOW() - INTERVAL '1 year' * $1
	`, config.RetentionYears)

	return int(rowsDeleted), nil
}

// ExportAuditTrail exports audit trail entries to JSON
func (atm *AuditTrailManager) ExportAuditTrail(filters AuditQueryFilters) ([]byte, error) {
	entries, _, err := atm.QueryAuditTrail(filters)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(entries, "", "  ")
}

// GetAuditStats returns statistics about the audit trail
func (atm *AuditTrailManager) GetAuditStats(tenantID string, days int) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total entries
	var totalEntries int64
	atm.db.QueryRow(`
		SELECT COUNT(*) FROM audit_trail
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
		AND created_at > NOW() - INTERVAL '1 day' * $2
	`, tenantID, days).Scan(&totalEntries)
	stats["total_entries"] = totalEntries

	// Entries by event type
	rows, err := atm.db.Query(`
		SELECT event_type, COUNT(*) as count
		FROM audit_trail
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
		AND created_at > NOW() - INTERVAL '1 day' * $2
		GROUP BY event_type
		ORDER BY count DESC
	`, tenantID, days)
	if err == nil {
		eventTypes := make(map[string]int64)
		for rows.Next() {
			var eventType string
			var count int64
			rows.Scan(&eventType, &count)
			eventTypes[eventType] = count
		}
		rows.Close()
		stats["by_event_type"] = eventTypes
	}

	// Entries by severity
	rows, err = atm.db.Query(`
		SELECT severity, COUNT(*) as count
		FROM audit_trail
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
		AND created_at > NOW() - INTERVAL '1 day' * $2
		GROUP BY severity
	`, tenantID, days)
	if err == nil {
		severities := make(map[string]int64)
		for rows.Next() {
			var severity string
			var count int64
			rows.Scan(&severity, &count)
			severities[severity] = count
		}
		rows.Close()
		stats["by_severity"] = severities
	}

	// Security events count
	var securityEvents int64
	atm.db.QueryRow(`
		SELECT COUNT(*) FROM audit_trail
		WHERE (tenant_id = $1 OR tenant_id IS NULL)
		AND created_at > NOW() - INTERVAL '1 day' * $2
		AND event_type IN ('login_failed', 'account_locked', 'security_alert', 'fraud_detected', 'ip_blocked', 'suspicious_activity')
	`, tenantID, days).Scan(&securityEvents)
	stats["security_events"] = securityEvents

	// Last chain validation
	var lastValidation time.Time
	var lastValidationValid bool
	err = atm.db.QueryRow(`
		SELECT validation_time, valid FROM audit_chain_validation
		ORDER BY validation_time DESC LIMIT 1
	`).Scan(&lastValidation, &lastValidationValid)
	if err == nil {
		stats["last_chain_validation"] = lastValidation
		stats["chain_valid"] = lastValidationValid
	}

	return stats, nil
}

func (atm *AuditTrailManager) backgroundTasks() {
	// Archive old entries daily
	archiveTicker := time.NewTicker(24 * time.Hour)

	// Validate chain periodically
	validationInterval := time.Duration(atm.config.ChainValidationInterval) * time.Hour
	validationTicker := time.NewTicker(validationInterval)

	for {
		select {
		case <-archiveTicker.C:
			archived, err := atm.ArchiveOldEntries()
			if err != nil {
				log.Printf("Warning: Failed to archive audit entries: %v", err)
			} else if archived > 0 {
				log.Printf("Archived %d audit entries", archived)
			}

			purged, err := atm.PurgeExpiredEntries()
			if err != nil {
				log.Printf("Warning: Failed to purge expired audit entries: %v", err)
			} else if purged > 0 {
				log.Printf("Purged %d expired audit entries", purged)
			}

		case <-validationTicker.C:
			if atm.config.EnableChainValidation {
				endTime := time.Now()
				startTime := endTime.Add(-validationInterval)
				result, err := atm.ValidateChain(startTime, endTime)
				if err != nil {
					log.Printf("Warning: Chain validation failed: %v", err)
				} else if !result.Valid {
					log.Printf("CRITICAL: Audit chain validation failed with %d errors", len(result.Errors))
					// In production, this would trigger alerts
				}
			}
		}
	}
}

// Helper function to create common audit entries

// LogLogin logs a login event
func (atm *AuditTrailManager) LogLogin(userID, tenantID, ipAddress, userAgent, sessionID string, success bool) error {
	eventType := EventLogin
	severity := SeverityInfo
	action := "User logged in successfully"

	if !success {
		eventType = EventLoginFailed
		severity = SeverityWarning
		action = "Login attempt failed"
	}

	return atm.LogEvent(AuditEntry{
		EventType:   eventType,
		Severity:    severity,
		UserID:      userID,
		TenantID:    tenantID,
		ActorID:     userID,
		ActorType:   "user",
		Action:      action,
		Description: action,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		SessionID:   sessionID,
	})
}

// LogPasswordChange logs a password change event
func (atm *AuditTrailManager) LogPasswordChange(userID, tenantID, actorID, ipAddress string, forced bool) error {
	action := "Password changed by user"
	if forced {
		action = "Password reset forced by administrator"
	}

	return atm.LogEvent(AuditEntry{
		EventType:    EventPasswordChange,
		Severity:     SeverityInfo,
		UserID:       userID,
		TenantID:     tenantID,
		ActorID:      actorID,
		ActorType:    "user",
		ResourceType: "user",
		ResourceID:   userID,
		Action:       action,
		Description:  action,
		IPAddress:    ipAddress,
	})
}

// LogSecurityAlert logs a security alert
func (atm *AuditTrailManager) LogSecurityAlert(userID, tenantID, alertType, description string, metadata map[string]interface{}) error {
	return atm.LogEvent(AuditEntry{
		EventType:   EventSecurityAlert,
		Severity:    SeverityCritical,
		UserID:      userID,
		TenantID:    tenantID,
		ActorType:   "system",
		Action:      alertType,
		Description: description,
		Metadata:    metadata,
	})
}

// LogConfigChange logs a configuration change
func (atm *AuditTrailManager) LogConfigChange(actorID, tenantID, configType string, oldValue, newValue map[string]interface{}, ipAddress string) error {
	return atm.LogEvent(AuditEntry{
		EventType:    EventConfigChanged,
		Severity:     SeverityWarning,
		TenantID:     tenantID,
		ActorID:      actorID,
		ActorType:    "user",
		ResourceType: "config",
		ResourceID:   configType,
		Action:       "Configuration changed",
		Description:  fmt.Sprintf("Configuration '%s' was modified", configType),
		OldValue:     oldValue,
		NewValue:     newValue,
		IPAddress:    ipAddress,
	})
}

// MaskPAN masks a card PAN number
func MaskPAN(pan string) string {
	if len(pan) < 10 {
		return "****"
	}
	// Keep first 6 and last 4 digits
	return pan[:6] + strings.Repeat("*", len(pan)-10) + pan[len(pan)-4:]
}

// MaskEmail masks an email address
func MaskEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "****@****"
	}
	username := parts[0]
	domain := parts[1]

	if len(username) <= 2 {
		return "**@" + domain
	}

	return username[:2] + strings.Repeat("*", len(username)-2) + "@" + domain
}

// MaskPhone masks a phone number
func MaskPhone(phone string) string {
	// Remove non-digits
	digits := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
	if len(digits) < 6 {
		return "****"
	}
	return digits[:3] + strings.Repeat("*", len(digits)-6) + digits[len(digits)-3:]
}
