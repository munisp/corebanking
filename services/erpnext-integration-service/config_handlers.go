package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Configuration Models
type SyncConfig struct {
	ID                  string `json:"id,omitempty"`
	TenantID            string `json:"tenant_id"`
	AutoSyncEnabled     bool   `json:"auto_sync_enabled"`
	SyncFrequency       string `json:"sync_frequency"`
	SyncTimeOfDay       string `json:"sync_time_of_day,omitempty"`
	BatchSize           int    `json:"batch_size"`
	ParallelConnections int    `json:"parallel_connections"`
	TimeoutSeconds      int    `json:"timeout_seconds"`
	UpdatedAt           string `json:"updated_at,omitempty"`
}

type RetryPolicyConfig struct {
	ID                  string  `json:"id,omitempty"`
	TenantID            string  `json:"tenant_id"`
	MaxRetries          int     `json:"max_retries"`
	InitialDelaySeconds int     `json:"initial_delay_seconds"`
	MaxDelaySeconds     int     `json:"max_delay_seconds"`
	BackoffMultiplier   float64 `json:"backoff_multiplier"`
	RetryOnStatusCodes  []int   `json:"retry_on_status_codes"`
	UpdatedAt           string  `json:"updated_at,omitempty"`
}

type NotificationConfig struct {
	ID                             string   `json:"id,omitempty"`
	TenantID                       string   `json:"tenant_id"`
	EmailNotificationsEnabled      bool     `json:"email_notifications_enabled"`
	NotificationEmails             []string `json:"notification_emails"`
	NotifyOnSyncFailure            bool     `json:"notify_on_sync_failure"`
	NotifyOnReconciliationMismatch bool     `json:"notify_on_reconciliation_mismatch"`
	NotifyOnPaymentFailure         bool     `json:"notify_on_payment_failure"`
	NotifyOnHighValueTransactions  bool     `json:"notify_on_high_value_transactions"`
	HighValueThreshold             float64  `json:"high_value_threshold"`
	SlackWebhookURL                string   `json:"slack_webhook_url,omitempty"`
	TeamsWebhookURL                string   `json:"teams_webhook_url,omitempty"`
	UpdatedAt                      string   `json:"updated_at,omitempty"`
}

type SecurityConfig struct {
	ID                              string   `json:"id,omitempty"`
	TenantID                        string   `json:"tenant_id"`
	RequireApprovalForPaymentsAbove float64  `json:"require_approval_for_payments_above"`
	RequireApprovalForConfigChanges bool     `json:"require_approval_for_config_changes"`
	SessionTimeoutMinutes           int      `json:"session_timeout_minutes"`
	AllowedIPRanges                 []string `json:"allowed_ip_ranges"`
	MFARequired                     bool     `json:"mfa_required"`
	AuditLogRetentionDays           int      `json:"audit_log_retention_days"`
	EncryptionEnabled               bool     `json:"encryption_enabled"`
	UpdatedAt                       string   `json:"updated_at,omitempty"`
}

type AuditLog struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	UserID       string                 `json:"user_id"`
	UserEmail    string                 `json:"user_email"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id,omitempty"`
	Changes      map[string]interface{} `json:"changes,omitempty"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	Status       string                 `json:"status"`
	ErrorMessage string                 `json:"error_message,omitempty"`
	CreatedAt    string                 `json:"created_at"`
}

type DashboardMetrics struct {
	TenantID string `json:"tenant_id"`
	Period   string `json:"period"`

	TransactionVolume struct {
		Total  int            `json:"total"`
		ByType map[string]int `json:"by_type"`
		Trend  float64        `json:"trend"`
	} `json:"transaction_volume"`

	SyncPerformance struct {
		TotalSyncs         int     `json:"total_syncs"`
		SuccessfulSyncs    int     `json:"successful_syncs"`
		FailedSyncs        int     `json:"failed_syncs"`
		SuccessRate        float64 `json:"success_rate"`
		AvgDurationSeconds float64 `json:"avg_duration_seconds"`
	} `json:"sync_performance"`

	Reconciliation struct {
		TotalTransactions int     `json:"total_transactions"`
		Matched           int     `json:"matched"`
		Unmatched         int     `json:"unmatched"`
		AccuracyRate      float64 `json:"accuracy_rate"`
		Exceptions        int     `json:"exceptions"`
	} `json:"reconciliation"`

	Payments struct {
		TotalPayments int     `json:"total_payments"`
		TotalAmount   float64 `json:"total_amount"`
		Pending       int     `json:"pending"`
		Completed     int     `json:"completed"`
		Failed        int     `json:"failed"`
	} `json:"payments"`

	SystemHealth struct {
		ActiveConnections int     `json:"active_connections"`
		TotalConnections  int     `json:"total_connections"`
		APIResponseTimeMs float64 `json:"api_response_time_ms"`
		ErrorRate         float64 `json:"error_rate"`
	} `json:"system_health"`
}

type Exception struct {
	ID              string                 `json:"id"`
	TenantID        string                 `json:"tenant_id"`
	Type            string                 `json:"type"`
	Severity        string                 `json:"severity"`
	Status          string                 `json:"status"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	ResourceType    string                 `json:"resource_type,omitempty"`
	ResourceID      string                 `json:"resource_id,omitempty"`
	Data            map[string]interface{} `json:"data,omitempty"`
	AssignedTo      string                 `json:"assigned_to,omitempty"`
	ResolutionNotes string                 `json:"resolution_notes,omitempty"`
	CreatedAt       string                 `json:"created_at"`
	ResolvedAt      string                 `json:"resolved_at,omitempty"`
}

// Configuration Handlers
func getSyncConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config SyncConfig
	err := integrationService.db.QueryRow(
		`SELECT id, tenant_id, auto_sync_enabled, sync_frequency, sync_time_of_day, 
		 batch_size, parallel_connections, timeout_seconds, updated_at 
		 FROM erp_sync_configs WHERE tenant_id = $1`,
		tenantID,
	).Scan(
		&config.ID, &config.TenantID, &config.AutoSyncEnabled, &config.SyncFrequency,
		&config.SyncTimeOfDay, &config.BatchSize, &config.ParallelConnections,
		&config.TimeoutSeconds, &config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// Return default config
		config = SyncConfig{
			TenantID:            tenantID,
			AutoSyncEnabled:     false,
			SyncFrequency:       "hourly",
			BatchSize:           100,
			ParallelConnections: 3,
			TimeoutSeconds:      30,
		}
	} else if err != nil {
		http.Error(w, "Failed to get sync config", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func updateSyncConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config SyncConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	config.TenantID = tenantID
	config.UpdatedAt = time.Now().Format(time.RFC3339)

	_, err := integrationService.db.Exec(
		`INSERT INTO erp_sync_configs
		 (tenant_id, auto_sync_enabled, sync_frequency, sync_time_of_day, batch_size, 
		  parallel_connections, timeout_seconds, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		 auto_sync_enabled = $2, sync_frequency = $3, sync_time_of_day = $4,
		 batch_size = $5, parallel_connections = $6, timeout_seconds = $7, updated_at = $8`,
		config.TenantID, config.AutoSyncEnabled, config.SyncFrequency, config.SyncTimeOfDay,
		config.BatchSize, config.ParallelConnections, config.TimeoutSeconds, config.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to update sync config", http.StatusInternalServerError)
		return
	}

	// Log audit
	logAudit(r.Context(), "update_sync_config", "sync_config", "", nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func getRetryPolicyConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config RetryPolicyConfig
	var statusCodesJSON []byte

	err := integrationService.db.QueryRow(
		`SELECT id, tenant_id, max_retries, initial_delay_seconds, max_delay_seconds,
		 backoff_multiplier, retry_on_status_codes, updated_at 
		 FROM erp_retry_policy_configs WHERE tenant_id = $1`,
		tenantID,
	).Scan(
		&config.ID, &config.TenantID, &config.MaxRetries, &config.InitialDelaySeconds,
		&config.MaxDelaySeconds, &config.BackoffMultiplier, &statusCodesJSON, &config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		config = RetryPolicyConfig{
			TenantID:            tenantID,
			MaxRetries:          3,
			InitialDelaySeconds: 1,
			MaxDelaySeconds:     60,
			BackoffMultiplier:   2.0,
			RetryOnStatusCodes:  []int{408, 429, 500, 502, 503, 504},
		}
	} else if err != nil {
		http.Error(w, "Failed to get retry policy config", http.StatusInternalServerError)
		return
	} else {
		json.Unmarshal(statusCodesJSON, &config.RetryOnStatusCodes)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func updateRetryPolicyConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config RetryPolicyConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	config.TenantID = tenantID
	config.UpdatedAt = time.Now().Format(time.RFC3339)

	statusCodesJSON, _ := json.Marshal(config.RetryOnStatusCodes)

	_, err := integrationService.db.Exec(
		`INSERT INTO erp_retry_policy_configs
		 (tenant_id, max_retries, initial_delay_seconds, max_delay_seconds, 
		  backoff_multiplier, retry_on_status_codes, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		 max_retries = $2, initial_delay_seconds = $3, max_delay_seconds = $4,
		 backoff_multiplier = $5, retry_on_status_codes = $6, updated_at = $7`,
		config.TenantID, config.MaxRetries, config.InitialDelaySeconds, config.MaxDelaySeconds,
		config.BackoffMultiplier, statusCodesJSON, config.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to update retry policy config", http.StatusInternalServerError)
		return
	}

	logAudit(r.Context(), "update_retry_policy", "retry_policy_config", "", nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func getNotificationConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config NotificationConfig
	var emailsJSON []byte

	err := integrationService.db.QueryRow(
		`SELECT id, tenant_id, email_notifications_enabled, notification_emails,
		 notify_on_sync_failure, notify_on_reconciliation_mismatch, notify_on_payment_failure,
		 notify_on_high_value_transactions, high_value_threshold, slack_webhook_url,
		 teams_webhook_url, updated_at 
		 FROM erp_notification_configs WHERE tenant_id = $1`,
		tenantID,
	).Scan(
		&config.ID, &config.TenantID, &config.EmailNotificationsEnabled, &emailsJSON,
		&config.NotifyOnSyncFailure, &config.NotifyOnReconciliationMismatch,
		&config.NotifyOnPaymentFailure, &config.NotifyOnHighValueTransactions,
		&config.HighValueThreshold, &config.SlackWebhookURL, &config.TeamsWebhookURL,
		&config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		config = NotificationConfig{
			TenantID:                       tenantID,
			EmailNotificationsEnabled:      false,
			NotificationEmails:             []string{},
			NotifyOnSyncFailure:            true,
			NotifyOnReconciliationMismatch: true,
			NotifyOnPaymentFailure:         true,
			NotifyOnHighValueTransactions:  true,
			HighValueThreshold:             10000,
		}
	} else if err != nil {
		http.Error(w, "Failed to get notification config", http.StatusInternalServerError)
		return
	} else {
		json.Unmarshal(emailsJSON, &config.NotificationEmails)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func updateNotificationConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config NotificationConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	config.TenantID = tenantID
	config.UpdatedAt = time.Now().Format(time.RFC3339)

	emailsJSON, _ := json.Marshal(config.NotificationEmails)

	_, err := integrationService.db.Exec(
		`INSERT INTO erp_notification_configs
		 (tenant_id, email_notifications_enabled, notification_emails, notify_on_sync_failure,
		  notify_on_reconciliation_mismatch, notify_on_payment_failure, notify_on_high_value_transactions,
		  high_value_threshold, slack_webhook_url, teams_webhook_url, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		 email_notifications_enabled = $2, notification_emails = $3, notify_on_sync_failure = $4,
		 notify_on_reconciliation_mismatch = $5, notify_on_payment_failure = $6,
		 notify_on_high_value_transactions = $7, high_value_threshold = $8,
		 slack_webhook_url = $9, teams_webhook_url = $10, updated_at = $11`,
		config.TenantID, config.EmailNotificationsEnabled, emailsJSON, config.NotifyOnSyncFailure,
		config.NotifyOnReconciliationMismatch, config.NotifyOnPaymentFailure,
		config.NotifyOnHighValueTransactions, config.HighValueThreshold,
		config.SlackWebhookURL, config.TeamsWebhookURL, config.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to update notification config", http.StatusInternalServerError)
		return
	}

	logAudit(r.Context(), "update_notification_config", "notification_config", "", nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func getSecurityConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config SecurityConfig
	var ipRangesJSON []byte

	err := integrationService.db.QueryRow(
		`SELECT id, tenant_id, require_approval_for_payments_above, require_approval_for_config_changes,
		 session_timeout_minutes, allowed_ip_ranges, mfa_required, audit_log_retention_days,
		 encryption_enabled, updated_at 
		 FROM erp_security_configs WHERE tenant_id = $1`,
		tenantID,
	).Scan(
		&config.ID, &config.TenantID, &config.RequireApprovalForPaymentsAbove,
		&config.RequireApprovalForConfigChanges, &config.SessionTimeoutMinutes,
		&ipRangesJSON, &config.MFARequired, &config.AuditLogRetentionDays,
		&config.EncryptionEnabled, &config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		config = SecurityConfig{
			TenantID:                        tenantID,
			RequireApprovalForPaymentsAbove: 5000,
			RequireApprovalForConfigChanges: true,
			SessionTimeoutMinutes:           30,
			AllowedIPRanges:                 []string{"0.0.0.0/0"},
			MFARequired:                     false,
			AuditLogRetentionDays:           90,
			EncryptionEnabled:               true,
		}
	} else if err != nil {
		http.Error(w, "Failed to get security config", http.StatusInternalServerError)
		return
	} else {
		json.Unmarshal(ipRangesJSON, &config.AllowedIPRanges)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func updateSecurityConfigHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	var config SecurityConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	config.TenantID = tenantID
	config.UpdatedAt = time.Now().Format(time.RFC3339)

	ipRangesJSON, _ := json.Marshal(config.AllowedIPRanges)

	_, err := integrationService.db.Exec(
		`INSERT INTO erp_security_configs
		 (tenant_id, require_approval_for_payments_above, require_approval_for_config_changes,
		  session_timeout_minutes, allowed_ip_ranges, mfa_required, audit_log_retention_days,
		  encryption_enabled, updated_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		 require_approval_for_payments_above = $2, require_approval_for_config_changes = $3,
		 session_timeout_minutes = $4, allowed_ip_ranges = $5, mfa_required = $6,
		 audit_log_retention_days = $7, encryption_enabled = $8, updated_at = $9`,
		config.TenantID, config.RequireApprovalForPaymentsAbove, config.RequireApprovalForConfigChanges,
		config.SessionTimeoutMinutes, ipRangesJSON, config.MFARequired, config.AuditLogRetentionDays,
		config.EncryptionEnabled, config.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to update security config", http.StatusInternalServerError)
		return
	}

	logAudit(r.Context(), "update_security_config", "security_config", "", nil, r)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// Audit Log Handlers
func getAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	// Parse query parameters
	query := `SELECT id, tenant_id, user_id, user_email, action, resource_type, resource_id,
	          changes, ip_address, user_agent, status, error_message, created_at 
	          FROM erp_audit_logs WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIndex := 2

	if action := r.URL.Query().Get("action"); action != "" {
		query += " AND action = $" + strconv.Itoa(argIndex)
		args = append(args, action)
		argIndex++
	}

	if resourceType := r.URL.Query().Get("resource_type"); resourceType != "" {
		query += " AND resource_type = $" + strconv.Itoa(argIndex)
		args = append(args, resourceType)
		argIndex++
	}

	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := integrationService.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to query audit logs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		var changesJSON []byte

		err := rows.Scan(
			&log.ID, &log.TenantID, &log.UserID, &log.UserEmail, &log.Action,
			&log.ResourceType, &log.ResourceID, &changesJSON, &log.IPAddress,
			&log.UserAgent, &log.Status, &log.ErrorMessage, &log.CreatedAt,
		)
		if err != nil {
			continue
		}

		if len(changesJSON) > 0 {
			json.Unmarshal(changesJSON, &log.Changes)
		}

		logs = append(logs, log)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"logs":  logs,
		"total": len(logs),
	})
}

// Dashboard Metrics Handler
func getDashboardMetricsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}

	// TODO: When implementing actual database queries, calculate startDate:
	// var startDate time.Time
	// now := time.Now()
	// switch period {
	// case "today":
	//     startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	// case "week":
	//     startDate = now.AddDate(0, 0, -7)
	// case "month":
	//     startDate = now.AddDate(0, -1, 0)
	// case "year":
	//     startDate = now.AddDate(-1, 0, 0)
	// default:
	//     startDate = now.AddDate(0, 0, -7)
	// }
	// Then use: WHERE created_at >= $1, startDate

	metrics := DashboardMetrics{
		TenantID: tenantID,
		Period:   period,
	}

	// Mock data - replace with actual database queries
	metrics.TransactionVolume.Total = 1523
	metrics.TransactionVolume.ByType = map[string]int{
		"payment":  845,
		"transfer": 423,
		"deposit":  255,
	}
	metrics.TransactionVolume.Trend = 12.5

	metrics.SyncPerformance.TotalSyncs = 48
	metrics.SyncPerformance.SuccessfulSyncs = 46
	metrics.SyncPerformance.FailedSyncs = 2
	metrics.SyncPerformance.SuccessRate = 95.8
	metrics.SyncPerformance.AvgDurationSeconds = 3.2

	metrics.Reconciliation.TotalTransactions = 1523
	metrics.Reconciliation.Matched = 1498
	metrics.Reconciliation.Unmatched = 25
	metrics.Reconciliation.AccuracyRate = 98.4
	metrics.Reconciliation.Exceptions = 3

	metrics.Payments.TotalPayments = 845
	metrics.Payments.TotalAmount = 2458900.50
	metrics.Payments.Pending = 12
	metrics.Payments.Completed = 820
	metrics.Payments.Failed = 13

	metrics.SystemHealth.ActiveConnections = 4
	metrics.SystemHealth.TotalConnections = 5
	metrics.SystemHealth.APIResponseTimeMs = 127.3
	metrics.SystemHealth.ErrorRate = 0.8

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// Exception Handlers
func listExceptionsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())

	query := `SELECT id, tenant_id, type, severity, status, title, description, 
	          resource_type, resource_id, data, assigned_to, resolution_notes, 
	          created_at, resolved_at FROM erp_exceptions WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIndex := 2

	if status := r.URL.Query().Get("status"); status != "" {
		query += " AND status = $" + strconv.Itoa(argIndex)
		args = append(args, status)
		argIndex++
	}

	if severity := r.URL.Query().Get("severity"); severity != "" {
		query += " AND severity = $" + strconv.Itoa(argIndex)
		args = append(args, severity)
		argIndex++
	}

	query += " ORDER BY created_at DESC"

	rows, err := integrationService.db.Query(query, args...)
	if err != nil {
		http.Error(w, "Failed to query exceptions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var exceptions []Exception
	for rows.Next() {
		var ex Exception
		var dataJSON []byte
		var resolvedAt sql.NullString

		err := rows.Scan(
			&ex.ID, &ex.TenantID, &ex.Type, &ex.Severity, &ex.Status, &ex.Title,
			&ex.Description, &ex.ResourceType, &ex.ResourceID, &dataJSON,
			&ex.AssignedTo, &ex.ResolutionNotes, &ex.CreatedAt, &resolvedAt,
		)
		if err != nil {
			continue
		}

		if len(dataJSON) > 0 {
			json.Unmarshal(dataJSON, &ex.Data)
		}

		if resolvedAt.Valid {
			ex.ResolvedAt = resolvedAt.String
		}

		exceptions = append(exceptions, ex)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"exceptions": exceptions,
		"total":      len(exceptions),
	})
}

func updateExceptionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	exceptionID := vars["id"]
	tenantID := getTenantID(r.Context())

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update exception
	query := "UPDATE erp_exceptions SET "
	args := []interface{}{}
	argIndex := 1

	if status, ok := updates["status"].(string); ok {
		query += "status = $" + strconv.Itoa(argIndex) + ", "
		args = append(args, status)
		argIndex++

		if status == "resolved" {
			query += "resolved_at = $" + strconv.Itoa(argIndex) + ", "
			args = append(args, time.Now().Format(time.RFC3339))
			argIndex++
		}
	}

	if notes, ok := updates["resolution_notes"].(string); ok {
		query += "resolution_notes = $" + strconv.Itoa(argIndex) + ", "
		args = append(args, notes)
		argIndex++
	}

	query = query[:len(query)-2] // Remove trailing ", "
	query += " WHERE id = $" + strconv.Itoa(argIndex) + " AND tenant_id = $" + strconv.Itoa(argIndex+1)
	args = append(args, exceptionID, tenantID)

	_, err := integrationService.db.Exec(query, args...)
	if err != nil {
		http.Error(w, "Failed to update exception", http.StatusInternalServerError)
		return
	}

	logAudit(r.Context(), "update_exception", "exception", exceptionID, updates, r)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Audit logging utility
func logAudit(ctx context.Context, action, resourceType, resourceID string, changes map[string]interface{}, r *http.Request) {
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	changesJSON, _ := json.Marshal(changes)

	integrationService.db.Exec(
		`INSERT INTO erp_audit_logs 
		 (id, tenant_id, user_id, user_email, action, resource_type, resource_id, changes, 
		  ip_address, user_agent, status, created_at) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		uuid.New().String(), tenantID, customerID, customerID+"@tenant.com", action, resourceType,
		resourceID, changesJSON, r.RemoteAddr, r.UserAgent(), "success", time.Now().Format(time.RFC3339),
	)
}
