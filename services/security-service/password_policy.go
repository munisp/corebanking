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
	"unicode"
)

// PasswordPolicyConfig holds configurable password policy settings
type PasswordPolicyConfig struct {
	// Length requirements
	MinLength int `json:"min_length"`
	MaxLength int `json:"max_length"`

	// Character requirements
	RequireUppercase   bool `json:"require_uppercase"`
	RequireLowercase   bool `json:"require_lowercase"`
	RequireNumbers     bool `json:"require_numbers"`
	RequireSpecialChar bool `json:"require_special_char"`
	MinUppercase       int  `json:"min_uppercase"`
	MinLowercase       int  `json:"min_lowercase"`
	MinNumbers         int  `json:"min_numbers"`
	MinSpecialChars    int  `json:"min_special_chars"`

	// Pattern restrictions
	DisallowSequential  bool `json:"disallow_sequential"`   // abc, 123, etc.
	DisallowRepeating   bool `json:"disallow_repeating"`    // aaa, 111, etc.
	DisallowUserInfo    bool `json:"disallow_user_info"`    // email, name, phone
	DisallowCommonWords bool `json:"disallow_common_words"` // password, 123456, etc.
	MaxRepeatingChars   int  `json:"max_repeating_chars"`   // max consecutive same chars
	MaxSequentialChars  int  `json:"max_sequential_chars"`  // max sequential chars

	// History and expiry
	PasswordHistoryCount int `json:"password_history_count"` // number of previous passwords to check
	PasswordExpiryDays   int `json:"password_expiry_days"`   // days until password expires (0 = never)
	MinPasswordAgeDays   int `json:"min_password_age_days"`  // minimum days before password can be changed

	// Lockout settings (handled by session_manager but configured here)
	MaxFailedAttempts   int `json:"max_failed_attempts"`
	LockoutDurationMins int `json:"lockout_duration_mins"`

	// Special characters allowed
	AllowedSpecialChars string `json:"allowed_special_chars"`
}

// DefaultPasswordPolicy provides secure defaults for banking
var DefaultPasswordPolicy = PasswordPolicyConfig{
	MinLength:            12,
	MaxLength:            128,
	RequireUppercase:     true,
	RequireLowercase:     true,
	RequireNumbers:       true,
	RequireSpecialChar:   true,
	MinUppercase:         1,
	MinLowercase:         1,
	MinNumbers:           1,
	MinSpecialChars:      1,
	DisallowSequential:   true,
	DisallowRepeating:    true,
	DisallowUserInfo:     true,
	DisallowCommonWords:  true,
	MaxRepeatingChars:    2,
	MaxSequentialChars:   3,
	PasswordHistoryCount: 12,
	PasswordExpiryDays:   90,
	MinPasswordAgeDays:   1,
	MaxFailedAttempts:    5,
	LockoutDurationMins:  15,
	AllowedSpecialChars:  "!@#$%^&*()_+-=[]{}|;':\",./<>?`~",
}

// Common passwords list (top 100 most common)
var commonPasswords = map[string]bool{
	"password": true, "123456": true, "12345678": true, "qwerty": true,
	"abc123": true, "monkey": true, "1234567": true, "letmein": true,
	"trustno1": true, "dragon": true, "baseball": true, "iloveyou": true,
	"master": true, "sunshine": true, "ashley": true, "bailey": true,
	"passw0rd": true, "shadow": true, "123123": true, "654321": true,
	"superman": true, "qazwsx": true, "michael": true, "football": true,
	"password1": true, "password123": true, "batman": true, "login": true,
	"admin": true, "welcome": true, "hello": true, "charlie": true,
	"donald": true, "password2": true, "qwerty123": true, "admin123": true,
	"root": true, "toor": true, "pass": true, "test": true,
	"guest": true, "master123": true, "changeme": true, "123qwe": true,
	"zaq1zaq1": true, "mustang": true, "access": true, "love": true,
	"god": true, "money": true, "secret": true, "sexy": true,
	"54bank": true, "banking": true, "bank123": true, "nigeria": true,
	"naira": true, "lagos": true, "abuja": true, "transfer": true,
}

// PasswordValidationResult holds the result of password validation
type PasswordValidationResult struct {
	Valid       bool     `json:"valid"`
	Score       int      `json:"score"`       // 0-100 strength score
	Strength    string   `json:"strength"`    // weak, fair, good, strong, excellent
	Violations  []string `json:"violations"`  // list of policy violations
	Suggestions []string `json:"suggestions"` // improvement suggestions
}

// PasswordPolicyManager manages password policies
type PasswordPolicyManager struct {
	db           *sql.DB
	policy       PasswordPolicyConfig
	tenantPolicy map[string]PasswordPolicyConfig
	mu           sync.RWMutex
}

// NewPasswordPolicyManager creates a new password policy manager
func NewPasswordPolicyManager(db *sql.DB) *PasswordPolicyManager {
	ppm := &PasswordPolicyManager{
		db:           db,
		policy:       DefaultPasswordPolicy,
		tenantPolicy: make(map[string]PasswordPolicyConfig),
	}

	// Load environment overrides
	ppm.loadEnvOverrides()

	// Create necessary tables
	ppm.createTables()

	// Load tenant-specific policies
	ppm.loadTenantPolicies()

	return ppm
}

func (ppm *PasswordPolicyManager) loadEnvOverrides() {
	if val := os.Getenv("PASSWORD_MIN_LENGTH"); val != "" {
		if length, err := strconv.Atoi(val); err == nil {
			ppm.policy.MinLength = length
		}
	}
	if val := os.Getenv("PASSWORD_HISTORY_COUNT"); val != "" {
		if count, err := strconv.Atoi(val); err == nil {
			ppm.policy.PasswordHistoryCount = count
		}
	}
	if val := os.Getenv("PASSWORD_EXPIRY_DAYS"); val != "" {
		if days, err := strconv.Atoi(val); err == nil {
			ppm.policy.PasswordExpiryDays = days
		}
	}
}

func (ppm *PasswordPolicyManager) createTables() {
	schema := `
	CREATE TABLE IF NOT EXISTS password_policies (
		id SERIAL PRIMARY KEY,
		tenant_id VARCHAR(50) UNIQUE,
		policy_config JSONB NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS password_history (
		id SERIAL PRIMARY KEY,
		user_id VARCHAR(50) NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
	CREATE INDEX IF NOT EXISTS idx_password_history_created ON password_history(created_at);

	CREATE TABLE IF NOT EXISTS password_metadata (
		user_id VARCHAR(50) PRIMARY KEY,
		last_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		expires_at TIMESTAMP,
		must_change BOOLEAN DEFAULT FALSE,
		change_reason VARCHAR(255)
	);

	CREATE INDEX IF NOT EXISTS idx_password_metadata_expires ON password_metadata(expires_at);
	`

	_, err := ppm.db.Exec(schema)
	if err != nil {
		log.Printf("Warning: Failed to create password policy tables: %v", err)
	}
}

func (ppm *PasswordPolicyManager) loadTenantPolicies() {
	rows, err := ppm.db.Query(`SELECT tenant_id, policy_config FROM password_policies WHERE tenant_id IS NOT NULL`)
	if err != nil {
		log.Printf("Warning: Failed to load tenant password policies: %v", err)
		return
	}
	defer rows.Close()

	ppm.mu.Lock()
	defer ppm.mu.Unlock()

	for rows.Next() {
		var tenantID string
		var policyJSON []byte
		if err := rows.Scan(&tenantID, &policyJSON); err != nil {
			continue
		}

		var policy PasswordPolicyConfig
		if err := json.Unmarshal(policyJSON, &policy); err != nil {
			continue
		}

		ppm.tenantPolicy[tenantID] = policy
	}
}

// GetPolicy returns the applicable password policy
func (ppm *PasswordPolicyManager) GetPolicy(tenantID string) PasswordPolicyConfig {
	ppm.mu.RLock()
	defer ppm.mu.RUnlock()

	if tenantID != "" {
		if policy, ok := ppm.tenantPolicy[tenantID]; ok {
			return policy
		}
	}

	return ppm.policy
}

// SetTenantPolicy sets a custom password policy for a tenant
func (ppm *PasswordPolicyManager) SetTenantPolicy(tenantID string, policy PasswordPolicyConfig) error {
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return err
	}

	_, err = ppm.db.Exec(`
		INSERT INTO password_policies (tenant_id, policy_config)
		VALUES ($1, $2)
		ON CONFLICT (tenant_id) DO UPDATE SET
			policy_config = EXCLUDED.policy_config,
			updated_at = CURRENT_TIMESTAMP
	`, tenantID, policyJSON)

	if err != nil {
		return err
	}

	ppm.mu.Lock()
	ppm.tenantPolicy[tenantID] = policy
	ppm.mu.Unlock()

	return nil
}

// ValidatePassword validates a password against the policy
func (ppm *PasswordPolicyManager) ValidatePassword(password string, userInfo UserPasswordInfo, tenantID string) *PasswordValidationResult {
	policy := ppm.GetPolicy(tenantID)
	result := &PasswordValidationResult{
		Valid:       true,
		Violations:  []string{},
		Suggestions: []string{},
	}

	// Rule 1: Check minimum length
	if len(password) < policy.MinLength {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must be at least %d characters long", policy.MinLength))
	}

	// Rule 2: Check maximum length
	if len(password) > policy.MaxLength {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must not exceed %d characters", policy.MaxLength))
	}

	// Rule 3: Check uppercase requirement
	uppercaseCount := countUppercase(password)
	if policy.RequireUppercase && uppercaseCount < policy.MinUppercase {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must contain at least %d uppercase letter(s)", policy.MinUppercase))
	}

	// Rule 4: Check lowercase requirement
	lowercaseCount := countLowercase(password)
	if policy.RequireLowercase && lowercaseCount < policy.MinLowercase {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must contain at least %d lowercase letter(s)", policy.MinLowercase))
	}

	// Rule 5: Check number requirement
	numberCount := countNumbers(password)
	if policy.RequireNumbers && numberCount < policy.MinNumbers {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must contain at least %d number(s)", policy.MinNumbers))
	}

	// Rule 6: Check special character requirement
	specialCount := countSpecialChars(password, policy.AllowedSpecialChars)
	if policy.RequireSpecialChar && specialCount < policy.MinSpecialChars {
		result.Valid = false
		result.Violations = append(result.Violations,
			fmt.Sprintf("Password must contain at least %d special character(s)", policy.MinSpecialChars))
	}

	// Rule 7: Check for common passwords
	if policy.DisallowCommonWords {
		lowerPassword := strings.ToLower(password)
		if commonPasswords[lowerPassword] {
			result.Valid = false
			result.Violations = append(result.Violations, "Password is too common and easily guessable")
		}
		// Also check if password contains common words
		for word := range commonPasswords {
			if len(word) >= 4 && strings.Contains(lowerPassword, word) {
				result.Valid = false
				result.Violations = append(result.Violations,
					fmt.Sprintf("Password contains common word: %s", word))
				break
			}
		}
	}

	// Rule 8: Check for user information
	if policy.DisallowUserInfo {
		violations := checkUserInfo(password, userInfo)
		if len(violations) > 0 {
			result.Valid = false
			result.Violations = append(result.Violations, violations...)
		}
	}

	// Rule 9: Check for sequential characters
	if policy.DisallowSequential {
		if hasSequentialChars(password, policy.MaxSequentialChars) {
			result.Valid = false
			result.Violations = append(result.Violations,
				fmt.Sprintf("Password must not contain more than %d sequential characters (e.g., abc, 123)", policy.MaxSequentialChars))
		}
	}

	// Rule 10: Check for repeating characters
	if policy.DisallowRepeating {
		if hasRepeatingChars(password, policy.MaxRepeatingChars) {
			result.Valid = false
			result.Violations = append(result.Violations,
				fmt.Sprintf("Password must not contain more than %d repeating characters (e.g., aaa)", policy.MaxRepeatingChars))
		}
	}

	// Rule 11: Check keyboard patterns
	if hasKeyboardPattern(password) {
		result.Valid = false
		result.Violations = append(result.Violations, "Password contains keyboard pattern (e.g., qwerty, asdf)")
	}

	// Rule 12: Check for dictionary words (simplified)
	if isDictionaryWord(password) {
		result.Suggestions = append(result.Suggestions, "Consider using a passphrase or adding more complexity")
	}

	// Calculate strength score
	result.Score = calculatePasswordStrength(password, policy)
	result.Strength = getStrengthLabel(result.Score)

	// Add suggestions based on score
	if result.Score < 60 {
		if uppercaseCount < 2 {
			result.Suggestions = append(result.Suggestions, "Add more uppercase letters")
		}
		if numberCount < 2 {
			result.Suggestions = append(result.Suggestions, "Add more numbers")
		}
		if specialCount < 2 {
			result.Suggestions = append(result.Suggestions, "Add more special characters")
		}
		if len(password) < 16 {
			result.Suggestions = append(result.Suggestions, "Consider using a longer password")
		}
	}

	return result
}

// UserPasswordInfo contains user information to check against password
type UserPasswordInfo struct {
	Email     string
	FirstName string
	LastName  string
	Phone     string
	Username  string
}

func checkUserInfo(password string, info UserPasswordInfo) []string {
	var violations []string
	lowerPassword := strings.ToLower(password)

	// Check email parts
	if info.Email != "" {
		emailParts := strings.Split(strings.ToLower(info.Email), "@")
		if len(emailParts) > 0 && len(emailParts[0]) >= 3 {
			if strings.Contains(lowerPassword, emailParts[0]) {
				violations = append(violations, "Password must not contain your email username")
			}
		}
	}

	// Check first name
	if info.FirstName != "" && len(info.FirstName) >= 3 {
		if strings.Contains(lowerPassword, strings.ToLower(info.FirstName)) {
			violations = append(violations, "Password must not contain your first name")
		}
	}

	// Check last name
	if info.LastName != "" && len(info.LastName) >= 3 {
		if strings.Contains(lowerPassword, strings.ToLower(info.LastName)) {
			violations = append(violations, "Password must not contain your last name")
		}
	}

	// Check phone (last 4 digits)
	if info.Phone != "" && len(info.Phone) >= 4 {
		phoneLast4 := info.Phone[len(info.Phone)-4:]
		if strings.Contains(password, phoneLast4) {
			violations = append(violations, "Password must not contain your phone number")
		}
	}

	// Check username
	if info.Username != "" && len(info.Username) >= 3 {
		if strings.Contains(lowerPassword, strings.ToLower(info.Username)) {
			violations = append(violations, "Password must not contain your username")
		}
	}

	return violations
}

func countUppercase(s string) int {
	count := 0
	for _, r := range s {
		if unicode.IsUpper(r) {
			count++
		}
	}
	return count
}

func countLowercase(s string) int {
	count := 0
	for _, r := range s {
		if unicode.IsLower(r) {
			count++
		}
	}
	return count
}

func countNumbers(s string) int {
	count := 0
	for _, r := range s {
		if unicode.IsDigit(r) {
			count++
		}
	}
	return count
}

func countSpecialChars(s string, allowed string) int {
	count := 0
	for _, r := range s {
		if strings.ContainsRune(allowed, r) {
			count++
		}
	}
	return count
}

func hasSequentialChars(s string, maxSeq int) bool {
	if len(s) < maxSeq+1 {
		return false
	}

	s = strings.ToLower(s)
	for i := 0; i <= len(s)-maxSeq-1; i++ {
		isSequential := true
		for j := 0; j < maxSeq; j++ {
			if s[i+j+1] != s[i+j]+1 {
				isSequential = false
				break
			}
		}
		if isSequential {
			return true
		}

		// Check reverse sequence
		isReverseSequential := true
		for j := 0; j < maxSeq; j++ {
			if s[i+j+1] != s[i+j]-1 {
				isReverseSequential = false
				break
			}
		}
		if isReverseSequential {
			return true
		}
	}

	return false
}

func hasRepeatingChars(s string, maxRepeat int) bool {
	if len(s) < maxRepeat+1 {
		return false
	}

	for i := 0; i <= len(s)-maxRepeat-1; i++ {
		isRepeating := true
		for j := 1; j <= maxRepeat; j++ {
			if s[i+j] != s[i] {
				isRepeating = false
				break
			}
		}
		if isRepeating {
			return true
		}
	}

	return false
}

func hasKeyboardPattern(s string) bool {
	patterns := []string{
		"qwerty", "qwertz", "azerty", "asdf", "zxcv",
		"qwer", "asdf", "zxcv", "1234", "0987",
		"!@#$", "qazwsx", "1qaz", "2wsx",
	}

	lowerS := strings.ToLower(s)
	for _, pattern := range patterns {
		if strings.Contains(lowerS, pattern) {
			return true
		}
	}

	return false
}

func isDictionaryWord(s string) bool {
	// Simplified check - in production, use a proper dictionary
	commonWords := []string{
		"password", "welcome", "hello", "admin", "login",
		"user", "test", "demo", "sample", "example",
	}

	lowerS := strings.ToLower(s)
	for _, word := range commonWords {
		if lowerS == word {
			return true
		}
	}

	return false
}

func calculatePasswordStrength(password string, policy PasswordPolicyConfig) int {
	score := 0

	// Length score (up to 30 points)
	lengthScore := len(password) * 2
	if lengthScore > 30 {
		lengthScore = 30
	}
	score += lengthScore

	// Character variety (up to 40 points)
	if countUppercase(password) > 0 {
		score += 10
	}
	if countLowercase(password) > 0 {
		score += 10
	}
	if countNumbers(password) > 0 {
		score += 10
	}
	if countSpecialChars(password, policy.AllowedSpecialChars) > 0 {
		score += 10
	}

	// Bonus for extra variety (up to 20 points)
	if countUppercase(password) >= 2 {
		score += 5
	}
	if countNumbers(password) >= 2 {
		score += 5
	}
	if countSpecialChars(password, policy.AllowedSpecialChars) >= 2 {
		score += 5
	}
	if len(password) >= 16 {
		score += 5
	}

	// Penalties
	if hasSequentialChars(password, 3) {
		score -= 10
	}
	if hasRepeatingChars(password, 2) {
		score -= 10
	}
	if hasKeyboardPattern(password) {
		score -= 15
	}

	// Ensure score is within bounds
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return score
}

func getStrengthLabel(score int) string {
	switch {
	case score >= 80:
		return "excellent"
	case score >= 60:
		return "strong"
	case score >= 40:
		return "good"
	case score >= 20:
		return "fair"
	default:
		return "weak"
	}
}

// CheckPasswordHistory checks if password was used before
func (ppm *PasswordPolicyManager) CheckPasswordHistory(userID, passwordHash, tenantID string) (bool, error) {
	policy := ppm.GetPolicy(tenantID)

	var count int
	err := ppm.db.QueryRow(`
		SELECT COUNT(*) FROM password_history
		WHERE user_id = $1 AND password_hash = $2
		AND created_at > NOW() - INTERVAL '1 year' * $3
	`, userID, passwordHash, policy.PasswordHistoryCount/12+1).Scan(&count)

	if err != nil {
		return false, err
	}

	// Also check against the most recent N passwords
	rows, err := ppm.db.Query(`
		SELECT password_hash FROM password_history
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, policy.PasswordHistoryCount)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			continue
		}
		if hash == passwordHash {
			return true, nil // Password was used before
		}
	}

	return false, nil
}

// AddPasswordToHistory adds a password hash to history
func (ppm *PasswordPolicyManager) AddPasswordToHistory(userID, passwordHash string) error {
	_, err := ppm.db.Exec(`
		INSERT INTO password_history (user_id, password_hash)
		VALUES ($1, $2)
	`, userID, passwordHash)
	return err
}

// UpdatePasswordMetadata updates password metadata after a change
func (ppm *PasswordPolicyManager) UpdatePasswordMetadata(userID, tenantID string) error {
	policy := ppm.GetPolicy(tenantID)

	var expiresAt *time.Time
	if policy.PasswordExpiryDays > 0 {
		t := time.Now().AddDate(0, 0, policy.PasswordExpiryDays)
		expiresAt = &t
	}

	_, err := ppm.db.Exec(`
		INSERT INTO password_metadata (user_id, last_changed_at, expires_at, must_change)
		VALUES ($1, NOW(), $2, FALSE)
		ON CONFLICT (user_id) DO UPDATE SET
			last_changed_at = NOW(),
			expires_at = EXCLUDED.expires_at,
			must_change = FALSE,
			change_reason = NULL
	`, userID, expiresAt)

	return err
}

// CheckPasswordExpiry checks if a user's password has expired
func (ppm *PasswordPolicyManager) CheckPasswordExpiry(userID string) (bool, bool, string, error) {
	var expiresAt sql.NullTime
	var mustChange bool
	var changeReason sql.NullString

	err := ppm.db.QueryRow(`
		SELECT expires_at, must_change, change_reason
		FROM password_metadata
		WHERE user_id = $1
	`, userID).Scan(&expiresAt, &mustChange, &changeReason)

	if err == sql.ErrNoRows {
		return false, false, "", nil
	}
	if err != nil {
		return false, false, "", err
	}

	// Check if must change is set
	if mustChange {
		reason := "Password change required"
		if changeReason.Valid {
			reason = changeReason.String
		}
		return false, true, reason, nil
	}

	// Check if expired
	if expiresAt.Valid && time.Now().After(expiresAt.Time) {
		return true, false, "Password has expired", nil
	}

	return false, false, "", nil
}

// ForcePasswordChange forces a user to change their password
func (ppm *PasswordPolicyManager) ForcePasswordChange(userID, reason string) error {
	_, err := ppm.db.Exec(`
		INSERT INTO password_metadata (user_id, must_change, change_reason)
		VALUES ($1, TRUE, $2)
		ON CONFLICT (user_id) DO UPDATE SET
			must_change = TRUE,
			change_reason = EXCLUDED.change_reason
	`, userID, reason)
	return err
}

// CheckMinPasswordAge checks if enough time has passed since last password change
func (ppm *PasswordPolicyManager) CheckMinPasswordAge(userID, tenantID string) (bool, error) {
	policy := ppm.GetPolicy(tenantID)

	if policy.MinPasswordAgeDays == 0 {
		return true, nil
	}

	var lastChanged time.Time
	err := ppm.db.QueryRow(`
		SELECT last_changed_at FROM password_metadata WHERE user_id = $1
	`, userID).Scan(&lastChanged)

	if err == sql.ErrNoRows {
		return true, nil
	}
	if err != nil {
		return false, err
	}

	minAge := time.Duration(policy.MinPasswordAgeDays) * 24 * time.Hour
	return time.Since(lastChanged) >= minAge, nil
}

// HashPassword creates a SHA256 hash of the password for history comparison
// Note: This is separate from bcrypt used for actual password storage
func HashPasswordForHistory(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// CleanupOldPasswordHistory removes old password history entries
func (ppm *PasswordPolicyManager) CleanupOldPasswordHistory() error {
	_, err := ppm.db.Exec(`
		DELETE FROM password_history
		WHERE created_at < NOW() - INTERVAL '3 years'
	`)
	return err
}

// GetPasswordRequirements returns human-readable password requirements
func (ppm *PasswordPolicyManager) GetPasswordRequirements(tenantID string) []string {
	policy := ppm.GetPolicy(tenantID)
	requirements := []string{}

	requirements = append(requirements, fmt.Sprintf("At least %d characters long", policy.MinLength))

	if policy.RequireUppercase {
		requirements = append(requirements, fmt.Sprintf("At least %d uppercase letter(s)", policy.MinUppercase))
	}
	if policy.RequireLowercase {
		requirements = append(requirements, fmt.Sprintf("At least %d lowercase letter(s)", policy.MinLowercase))
	}
	if policy.RequireNumbers {
		requirements = append(requirements, fmt.Sprintf("At least %d number(s)", policy.MinNumbers))
	}
	if policy.RequireSpecialChar {
		requirements = append(requirements, fmt.Sprintf("At least %d special character(s)", policy.MinSpecialChars))
	}
	if policy.DisallowSequential {
		requirements = append(requirements, "No sequential characters (e.g., abc, 123)")
	}
	if policy.DisallowRepeating {
		requirements = append(requirements, "No repeating characters (e.g., aaa)")
	}
	if policy.DisallowUserInfo {
		requirements = append(requirements, "Cannot contain your name, email, or phone number")
	}
	if policy.DisallowCommonWords {
		requirements = append(requirements, "Cannot be a common password")
	}
	if policy.PasswordHistoryCount > 0 {
		requirements = append(requirements, fmt.Sprintf("Cannot reuse your last %d passwords", policy.PasswordHistoryCount))
	}

	return requirements
}

// ValidatePasswordWithRegex provides additional regex-based validation
func ValidatePasswordWithRegex(password string) bool {
	// Must not contain whitespace
	if matched, _ := regexp.MatchString(`\s`, password); matched {
		return false
	}

	// Must not contain control characters
	for _, r := range password {
		if unicode.IsControl(r) {
			return false
		}
	}

	return true
}
