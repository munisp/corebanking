package main

import (
	"testing"
	"time"
)

// TestNotificationCreation tests notification creation
func TestNotificationCreation(t *testing.T) {
	tests := []struct {
		name    string
		input   NotificationInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid SMS notification",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "SMS",
				Recipient:  "08012345678",
				Subject:    "",
				Message:    "Your OTP is 123456",
				Priority:   "HIGH",
			},
			wantErr: false,
		},
		{
			name: "valid email notification",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "EMAIL",
				Recipient:  "user@example.com",
				Subject:    "Account Statement",
				Message:    "Please find your statement attached",
				Priority:   "NORMAL",
			},
			wantErr: false,
		},
		{
			name: "valid push notification",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "PUSH",
				Recipient:  "device-token-123",
				Subject:    "Transaction Alert",
				Message:    "You received NGN 10,000",
				Priority:   "HIGH",
			},
			wantErr: false,
		},
		{
			name: "missing tenant ID",
			input: NotificationInput{
				CustomerID: "cust-001",
				Type:       "SMS",
				Recipient:  "08012345678",
				Message:    "Test message",
			},
			wantErr: true,
			errMsg:  "tenant_id is required",
		},
		{
			name: "invalid notification type",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "INVALID",
				Recipient:  "08012345678",
				Message:    "Test message",
			},
			wantErr: true,
			errMsg:  "invalid notification type",
		},
		{
			name: "invalid phone number for SMS",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "SMS",
				Recipient:  "invalid",
				Message:    "Test message",
			},
			wantErr: true,
			errMsg:  "invalid phone number",
		},
		{
			name: "invalid email for EMAIL type",
			input: NotificationInput{
				TenantID:   "tenant-001",
				CustomerID: "cust-001",
				Type:       "EMAIL",
				Recipient:  "invalid-email",
				Subject:    "Test",
				Message:    "Test message",
			},
			wantErr: true,
			errMsg:  "invalid email address",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateNotificationInput(tt.input)
			if tt.wantErr {
				if result.Valid {
					t.Errorf("expected error but got valid result")
				}
				if !containsError(result.Errors, tt.errMsg) {
					t.Errorf("expected error %q not found in %v", tt.errMsg, result.Errors)
				}
			} else {
				if !result.Valid {
					t.Errorf("expected valid but got errors: %v", result.Errors)
				}
			}
		})
	}
}

// TestNotificationTemplates tests template rendering
func TestNotificationTemplates(t *testing.T) {
	tests := []struct {
		name     string
		template string
		data     map[string]string
		expected string
	}{
		{
			name:     "OTP template",
			template: "Your OTP is {{otp}}. Valid for {{validity}} minutes.",
			data:     map[string]string{"otp": "123456", "validity": "5"},
			expected: "Your OTP is 123456. Valid for 5 minutes.",
		},
		{
			name:     "transaction alert",
			template: "{{type}} of {{currency}}{{amount}} on your account {{account}}",
			data:     map[string]string{"type": "Credit", "currency": "NGN", "amount": "10,000", "account": "****1234"},
			expected: "Credit of NGN10,000 on your account ****1234",
		},
		{
			name:     "welcome message",
			template: "Welcome {{name}}! Your account {{account}} is now active.",
			data:     map[string]string{"name": "John", "account": "1234567890"},
			expected: "Welcome John! Your account 1234567890 is now active.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := renderTemplate(tt.template, tt.data)
			if result != tt.expected {
				t.Errorf("expected %q but got %q", tt.expected, result)
			}
		})
	}
}

// TestNotificationPriority tests priority handling
func TestNotificationPriority(t *testing.T) {
	t.Run("high priority processed first", func(t *testing.T) {
		queue := NewNotificationQueue()
		queue.Add(Notification{ID: "1", Priority: "LOW"})
		queue.Add(Notification{ID: "2", Priority: "HIGH"})
		queue.Add(Notification{ID: "3", Priority: "NORMAL"})

		next := queue.GetNext()
		if next.ID != "2" {
			t.Errorf("expected high priority notification first, got %s", next.ID)
		}
	})

	t.Run("same priority FIFO", func(t *testing.T) {
		queue := NewNotificationQueue()
		queue.Add(Notification{ID: "1", Priority: "NORMAL", CreatedAt: time.Now().Add(-2 * time.Second)})
		queue.Add(Notification{ID: "2", Priority: "NORMAL", CreatedAt: time.Now().Add(-1 * time.Second)})

		next := queue.GetNext()
		if next.ID != "1" {
			t.Errorf("expected older notification first, got %s", next.ID)
		}
	})
}

// TestNotificationRetry tests retry logic
func TestNotificationRetry(t *testing.T) {
	t.Run("should retry on failure", func(t *testing.T) {
		notification := Notification{
			ID:         "1",
			RetryCount: 0,
			MaxRetries: 3,
			Status:     "FAILED",
		}

		if !shouldRetry(notification) {
			t.Error("should retry when retry count < max retries")
		}
	})

	t.Run("should not retry when max reached", func(t *testing.T) {
		notification := Notification{
			ID:         "1",
			RetryCount: 3,
			MaxRetries: 3,
			Status:     "FAILED",
		}

		if shouldRetry(notification) {
			t.Error("should not retry when retry count >= max retries")
		}
	})

	t.Run("exponential backoff", func(t *testing.T) {
		delays := []time.Duration{
			calculateBackoff(0), // 1s
			calculateBackoff(1), // 2s
			calculateBackoff(2), // 4s
			calculateBackoff(3), // 8s
		}

		for i := 1; i < len(delays); i++ {
			if delays[i] <= delays[i-1] {
				t.Errorf("backoff should increase: %v <= %v", delays[i], delays[i-1])
			}
		}
	})
}

// TestNotificationChannelSelection tests channel selection
func TestNotificationChannelSelection(t *testing.T) {
	tests := []struct {
		name             string
		notificationType string
		preferences      CustomerPreferences
		expectedChannel  string
	}{
		{
			name:             "SMS when preferred",
			notificationType: "TRANSACTION_ALERT",
			preferences:      CustomerPreferences{PreferredChannel: "SMS", SMSEnabled: true},
			expectedChannel:  "SMS",
		},
		{
			name:             "fallback to email when SMS disabled",
			notificationType: "TRANSACTION_ALERT",
			preferences:      CustomerPreferences{PreferredChannel: "SMS", SMSEnabled: false, EmailEnabled: true},
			expectedChannel:  "EMAIL",
		},
		{
			name:             "push for marketing when enabled",
			notificationType: "MARKETING",
			preferences:      CustomerPreferences{PreferredChannel: "PUSH", PushEnabled: true, MarketingEnabled: true},
			expectedChannel:  "PUSH",
		},
		{
			name:             "no channel when marketing disabled",
			notificationType: "MARKETING",
			preferences:      CustomerPreferences{PreferredChannel: "PUSH", PushEnabled: true, MarketingEnabled: false},
			expectedChannel:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := selectChannel(tt.notificationType, tt.preferences)
			if channel != tt.expectedChannel {
				t.Errorf("expected channel %q but got %q", tt.expectedChannel, channel)
			}
		})
	}
}

// TestNotificationStatus tests status transitions
func TestNotificationStatus(t *testing.T) {
	validTransitions := []struct {
		from string
		to   string
	}{
		{"PENDING", "PROCESSING"},
		{"PROCESSING", "SENT"},
		{"PROCESSING", "FAILED"},
		{"FAILED", "PENDING"},
		{"FAILED", "CANCELLED"},
	}

	for _, tt := range validTransitions {
		t.Run(tt.from+"_to_"+tt.to, func(t *testing.T) {
			if !isValidStatusTransition(tt.from, tt.to) {
				t.Errorf("expected %s -> %s to be valid", tt.from, tt.to)
			}
		})
	}

	invalidTransitions := []struct {
		from string
		to   string
	}{
		{"SENT", "PENDING"},
		{"CANCELLED", "PROCESSING"},
		{"PENDING", "SENT"},
	}

	for _, tt := range invalidTransitions {
		t.Run(tt.from+"_to_"+tt.to+"_invalid", func(t *testing.T) {
			if isValidStatusTransition(tt.from, tt.to) {
				t.Errorf("expected %s -> %s to be invalid", tt.from, tt.to)
			}
		})
	}
}

// TestBulkNotification tests bulk notification handling
func TestBulkNotification(t *testing.T) {
	t.Run("batch size limit", func(t *testing.T) {
		recipients := make([]string, 1500)
		for i := range recipients {
			recipients[i] = "0801234" + string(rune('0'+i%10)) + string(rune('0'+i%10)) + string(rune('0'+i%10)) + string(rune('0'+i%10))
		}

		batches := splitIntoBatches(recipients, 500)
		if len(batches) != 3 {
			t.Errorf("expected 3 batches but got %d", len(batches))
		}
	})

	t.Run("rate limiting", func(t *testing.T) {
		limiter := NewRateLimiter(100, time.Second)

		allowed := 0
		for i := 0; i < 150; i++ {
			if limiter.Allow() {
				allowed++
			}
		}

		if allowed > 100 {
			t.Errorf("rate limiter allowed %d requests, expected max 100", allowed)
		}
	})
}

// ============================================
// HELPER TYPES AND FUNCTIONS
// ============================================

type NotificationInput struct {
	TenantID   string
	CustomerID string
	Type       string
	Recipient  string
	Subject    string
	Message    string
	Priority   string
}

type Notification struct {
	ID         string
	Priority   string
	Status     string
	RetryCount int
	MaxRetries int
	CreatedAt  time.Time
}

type CustomerPreferences struct {
	PreferredChannel string
	SMSEnabled       bool
	EmailEnabled     bool
	PushEnabled      bool
	MarketingEnabled bool
}

type ValidationResult struct {
	Valid  bool
	Errors []string
}

var validNotificationTypes = []string{"SMS", "EMAIL", "PUSH", "WHATSAPP", "IN_APP"}

func validateNotificationInput(input NotificationInput) ValidationResult {
	var errors []string

	if input.TenantID == "" {
		errors = append(errors, "tenant_id is required")
	}
	if input.CustomerID == "" {
		errors = append(errors, "customer_id is required")
	}
	if !isValidNotificationType(input.Type) {
		errors = append(errors, "invalid notification type")
	}
	if input.Message == "" {
		errors = append(errors, "message is required")
	}

	// Type-specific validation
	switch input.Type {
	case "SMS":
		if !isValidPhoneNumber(input.Recipient) {
			errors = append(errors, "invalid phone number")
		}
	case "EMAIL":
		if !isValidEmail(input.Recipient) {
			errors = append(errors, "invalid email address")
		}
		if input.Subject == "" {
			errors = append(errors, "subject is required for email")
		}
	}

	return ValidationResult{Valid: len(errors) == 0, Errors: errors}
}

func isValidNotificationType(t string) bool {
	for _, valid := range validNotificationTypes {
		if t == valid {
			return true
		}
	}
	return false
}

func isValidPhoneNumber(phone string) bool {
	if len(phone) < 10 || len(phone) > 14 {
		return false
	}
	for _, c := range phone {
		if c != '+' && (c < '0' || c > '9') {
			return false
		}
	}
	return true
}

func isValidEmail(email string) bool {
	atIndex := -1
	dotIndex := -1
	for i, c := range email {
		if c == '@' {
			atIndex = i
		}
		if c == '.' && atIndex > 0 {
			dotIndex = i
		}
	}
	return atIndex > 0 && dotIndex > atIndex+1 && dotIndex < len(email)-1
}

func renderTemplate(template string, data map[string]string) string {
	result := template
	for key, value := range data {
		placeholder := "{{" + key + "}}"
		newResult := ""
		for i := 0; i < len(result); i++ {
			if i+len(placeholder) <= len(result) && result[i:i+len(placeholder)] == placeholder {
				newResult += value
				i += len(placeholder) - 1
			} else {
				newResult += string(result[i])
			}
		}
		result = newResult
	}
	return result
}

type NotificationQueue struct {
	notifications []Notification
}

func NewNotificationQueue() *NotificationQueue {
	return &NotificationQueue{notifications: []Notification{}}
}

func (q *NotificationQueue) Add(n Notification) {
	q.notifications = append(q.notifications, n)
}

func (q *NotificationQueue) GetNext() Notification {
	if len(q.notifications) == 0 {
		return Notification{}
	}

	// Find highest priority
	priorityOrder := map[string]int{"HIGH": 0, "NORMAL": 1, "LOW": 2}
	bestIdx := 0
	for i, n := range q.notifications {
		if priorityOrder[n.Priority] < priorityOrder[q.notifications[bestIdx].Priority] {
			bestIdx = i
		} else if priorityOrder[n.Priority] == priorityOrder[q.notifications[bestIdx].Priority] {
			if n.CreatedAt.Before(q.notifications[bestIdx].CreatedAt) {
				bestIdx = i
			}
		}
	}

	result := q.notifications[bestIdx]
	q.notifications = append(q.notifications[:bestIdx], q.notifications[bestIdx+1:]...)
	return result
}

func shouldRetry(n Notification) bool {
	return n.Status == "FAILED" && n.RetryCount < n.MaxRetries
}

func calculateBackoff(retryCount int) time.Duration {
	base := time.Second
	for i := 0; i < retryCount; i++ {
		base *= 2
	}
	return base
}

func selectChannel(notificationType string, prefs CustomerPreferences) string {
	if notificationType == "MARKETING" && !prefs.MarketingEnabled {
		return ""
	}

	switch prefs.PreferredChannel {
	case "SMS":
		if prefs.SMSEnabled {
			return "SMS"
		}
		if prefs.EmailEnabled {
			return "EMAIL"
		}
	case "EMAIL":
		if prefs.EmailEnabled {
			return "EMAIL"
		}
		if prefs.SMSEnabled {
			return "SMS"
		}
	case "PUSH":
		if prefs.PushEnabled {
			return "PUSH"
		}
	}
	return ""
}

func isValidStatusTransition(from, to string) bool {
	validTransitions := map[string][]string{
		"PENDING":    {"PROCESSING", "CANCELLED"},
		"PROCESSING": {"SENT", "FAILED"},
		"FAILED":     {"PENDING", "CANCELLED"},
		"SENT":       {},
		"CANCELLED":  {},
	}

	allowed, exists := validTransitions[from]
	if !exists {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func splitIntoBatches(items []string, batchSize int) [][]string {
	var batches [][]string
	for i := 0; i < len(items); i += batchSize {
		end := i + batchSize
		if end > len(items) {
			end = len(items)
		}
		batches = append(batches, items[i:end])
	}
	return batches
}

type RateLimiter struct {
	limit    int
	window   time.Duration
	tokens   int
	lastTime time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:    limit,
		window:   window,
		tokens:   limit,
		lastTime: time.Now(),
	}
}

func (r *RateLimiter) Allow() bool {
	now := time.Now()
	if now.Sub(r.lastTime) >= r.window {
		r.tokens = r.limit
		r.lastTime = now
	}
	if r.tokens > 0 {
		r.tokens--
		return true
	}
	return false
}

func containsError(errors []string, msg string) bool {
	for _, e := range errors {
		if e == msg {
			return true
		}
	}
	return false
}
