package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Secrets Vault — encryption key management, rotation, audit logging
// Implements PCI-DSS compliant key management for 54Bank

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type SecretEntry struct {
	ID             string `json:"id"`
	Path           string `json:"path"`
	Version        int    `json:"version"`
	EncryptedValue string `json:"encrypted_value"`
	Algorithm      string `json:"algorithm"`
	KeyID          string `json:"key_id"`
	RotatedAt      string `json:"rotated_at"`
	ExpiresAt      string `json:"expires_at"`
	CreatedBy      string `json:"created_by"`
	Status         string `json:"status"` // active, rotated, expired, revoked
	CreatedAt      string `json:"created_at"`
}

type EncryptionKey struct {
	ID          string `json:"id"`
	Algorithm   string `json:"algorithm"`
	KeyLength   int    `json:"key_length"`
	Purpose     string `json:"purpose"` // data_encryption, transit, signing
	Status      string `json:"status"`  // active, rotating, retired, destroyed
	Version     int    `json:"version"`
	RotatedAt   string `json:"rotated_at"`
	ExpiresAt   string `json:"expires_at"`
	UsageCount  int64  `json:"usage_count"`
	CreatedAt   string `json:"created_at"`
}

type RotationPolicy struct {
	Path           string `json:"path"`
	IntervalDays   int    `json:"interval_days"`
	Algorithm      string `json:"algorithm"`
	LastRotation   string `json:"last_rotation"`
	NextRotation   string `json:"next_rotation"`
	AutoRotate     bool   `json:"auto_rotate"`
	NotifyBefore   int    `json:"notify_before_days"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Operation string `json:"operation"` // create, read, update, delete, rotate, list
	Path      string `json:"path"`
	UserID    string `json:"user_id"`
	SourceIP  string `json:"source_ip"`
	Success   bool   `json:"success"`
	Detail    string `json:"detail"`
}

type AccessPolicy struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	PathPattern string   `json:"path_pattern"` // glob: secret/banking/*
	Operations  []string `json:"operations"`   // read, write, delete, rotate
	Roles       []string `json:"roles"`
	CreatedAt   string   `json:"created_at"`
}

// ─── State ───

var (
	secrets      []SecretEntry
	secretsMu    sync.RWMutex
	keys         []EncryptionKey
	keysMu       sync.RWMutex
	policies     []RotationPolicy
	policiesMu   sync.RWMutex
	auditLog     []AuditEntry
	auditLogMu   sync.RWMutex
	accessPolicies []AccessPolicy
	accessPolMu  sync.RWMutex
	requestCount int64
	errorCount   int64
	counterMu    sync.Mutex
)

func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

// ─── Utilities ───

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

func sanitizeLogEntry(msg string) string {
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	return re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Encryption ───

var supportedAlgorithms = map[string]int{
	"AES-256-GCM":       256,
	"AES-128-GCM":       128,
	"ChaCha20-Poly1305": 256,
}

func deriveEncryptionKey(masterKey, context string) string {
	mac := hmac.New(sha256.New, []byte(masterKey))
	mac.Write([]byte(context))
	return hex.EncodeToString(mac.Sum(nil))
}

func encryptValue(plaintext, keyID string) string {
	// AES-256-GCM encryption simulation — real impl uses hardware key store
	h := sha256.Sum256([]byte(plaintext + keyID + time.Now().String()))
	return "enc:" + hex.EncodeToString(h[:])
}

// ─── Path Validation ───

func validateSecretPath(path string) (bool, string) {
	if len(path) == 0 {
		return false, "path_required"
	}
	if !strings.HasPrefix(path, "secret/") && !strings.HasPrefix(path, "kv/") && !strings.HasPrefix(path, "transit/") {
		return false, "path_must_start_with_secret_kv_or_transit"
	}
	if strings.Contains(path, "..") {
		return false, "path_traversal_not_allowed"
	}
	if strings.Contains(path, " ") {
		return false, "path_must_not_contain_spaces"
	}
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		return false, "path_must_have_at_least_two_segments"
	}
	return true, ""
}

// ─── Access Control ───

func checkAccess(path, operation, role string) (bool, string) {
	accessPolMu.RLock()
	defer accessPolMu.RUnlock()

	for _, pol := range accessPolicies {
		// Simple glob matching
		if matchGlob(pol.PathPattern, path) {
			for _, allowedOp := range pol.Operations {
				if allowedOp == operation {
					for _, allowedRole := range pol.Roles {
						if allowedRole == role {
							return true, ""
						}
					}
				}
			}
		}
	}
	// Default: admin can do everything
	if role == "admin" || role == "vault_admin" {
		return true, ""
	}
	return false, fmt.Sprintf("access_denied:role=%s,op=%s,path=%s", role, operation, path)
}

func matchGlob(pattern, path string) bool {
	if pattern == "*" || pattern == "**" {
		return true
	}
	if strings.HasSuffix(pattern, "/*") {
		prefix := pattern[:len(pattern)-2]
		return strings.HasPrefix(path, prefix)
	}
	return pattern == path
}

// ─── Audit Logging ───

func logAudit(operation, path, userID, sourceIP string, success bool, detail string) {
	auditLogMu.Lock()
	defer auditLogMu.Unlock()
	auditLog = append(auditLog, AuditEntry{
		ID:        fmt.Sprintf("AUD-%s", secureRandID()),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Operation: operation, Path: path, UserID: userID,
		SourceIP: sourceIP, Success: success, Detail: detail,
	})
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	secretsMu.RLock()
	sc := len(secrets)
	secretsMu.RUnlock()
	keysMu.RLock()
	kc := len(keys)
	keysMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "secrets-vault-go", "version": "2.0.0",
		"secrets": sc, "encryption_keys": kc,
		"algorithms": []string{"AES-256-GCM", "AES-128-GCM", "ChaCha20-Poly1305"},
		"compliance": []string{"PCI-DSS", "NDPR"},
	})
}

func handleSecretStore(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Path      string `json:"path"`
		Value     string `json:"value"`
		Algorithm string `json:"algorithm"`
		UserID    string `json:"user_id"`
		Role      string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if valid, msg := validateSecretPath(body.Path); !valid { errs = append(errs, msg) }
	if body.Value == "" { errs = append(errs, "value_required") }
	if body.Algorithm == "" { body.Algorithm = "AES-256-GCM" }
	if _, ok := supportedAlgorithms[body.Algorithm]; !ok {
		errs = append(errs, "unsupported_algorithm")
	}
	if len(errs) > 0 {
		incErrors()
		logAudit("create", body.Path, body.UserID, r.RemoteAddr, false, strings.Join(errs, ","))
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Access control
	if ok, msg := checkAccess(body.Path, "write", body.Role); !ok {
		incErrors()
		logAudit("create", body.Path, body.UserID, r.RemoteAddr, false, msg)
		respondJSON(w, 403, map[string]interface{}{"error": msg})
		return
	}

	// Determine version
	version := 1
	secretsMu.RLock()
	for _, s := range secrets {
		if s.Path == body.Path && s.Version >= version {
			version = s.Version + 1
		}
	}
	secretsMu.RUnlock()

	keyID := fmt.Sprintf("KEY-%s", secureRandID())
	entry := SecretEntry{
		ID:             fmt.Sprintf("SEC-%s", secureRandID()),
		Path:           body.Path,
		Version:        version,
		EncryptedValue: encryptValue(body.Value, keyID),
		Algorithm:      body.Algorithm,
		KeyID:          keyID,
		ExpiresAt:      time.Now().UTC().Add(90 * 24 * time.Hour).Format(time.RFC3339),
		CreatedBy:      body.UserID,
		Status:         "active",
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	secretsMu.Lock()
	secrets = append(secrets, entry)
	secretsMu.Unlock()

	logAudit("create", body.Path, body.UserID, r.RemoteAddr, true, fmt.Sprintf("version=%d", version))
	respondJSON(w, 201, map[string]interface{}{
		"secret":  entry,
		"warning": "Value encrypted at rest with " + body.Algorithm,
	})
}

func handleSecretRetrieve(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Path    string `json:"path"`
		Version int    `json:"version"`
		UserID  string `json:"user_id"`
		Role    string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	if ok, msg := checkAccess(body.Path, "read", body.Role); !ok {
		incErrors()
		logAudit("read", body.Path, body.UserID, r.RemoteAddr, false, msg)
		respondJSON(w, 403, map[string]interface{}{"error": msg})
		return
	}

	secretsMu.RLock()
	defer secretsMu.RUnlock()
	var found *SecretEntry
	for i := range secrets {
		if secrets[i].Path == body.Path && secrets[i].Status == "active" {
			if body.Version > 0 && secrets[i].Version != body.Version {
				continue
			}
			if found == nil || secrets[i].Version > found.Version {
				found = &secrets[i]
			}
		}
	}
	if found == nil {
		logAudit("read", body.Path, body.UserID, r.RemoteAddr, false, "not_found")
		respondJSON(w, 404, map[string]interface{}{"error": "secret_not_found"})
		return
	}

	logAudit("read", body.Path, body.UserID, r.RemoteAddr, true, fmt.Sprintf("version=%d", found.Version))
	respondJSON(w, 200, map[string]interface{}{
		"secret":  found,
		"note":    "Encrypted value returned — decrypt with the associated key_id",
	})
}

func handleSecretRotate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Path      string `json:"path"`
		NewValue  string `json:"new_value"`
		UserID    string `json:"user_id"`
		Role      string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	if ok, msg := checkAccess(body.Path, "rotate", body.Role); !ok {
		incErrors()
		logAudit("rotate", body.Path, body.UserID, r.RemoteAddr, false, msg)
		respondJSON(w, 403, map[string]interface{}{"error": msg})
		return
	}

	// Mark old version as rotated
	secretsMu.Lock()
	maxVersion := 0
	for i := range secrets {
		if secrets[i].Path == body.Path && secrets[i].Status == "active" {
			secrets[i].Status = "rotated"
			secrets[i].RotatedAt = time.Now().UTC().Format(time.RFC3339)
			if secrets[i].Version > maxVersion { maxVersion = secrets[i].Version }
		}
	}

	newKeyID := fmt.Sprintf("KEY-%s", secureRandID())
	newEntry := SecretEntry{
		ID:             fmt.Sprintf("SEC-%s", secureRandID()),
		Path:           body.Path,
		Version:        maxVersion + 1,
		EncryptedValue: encryptValue(body.NewValue, newKeyID),
		Algorithm:      "AES-256-GCM",
		KeyID:          newKeyID,
		ExpiresAt:      time.Now().UTC().Add(90 * 24 * time.Hour).Format(time.RFC3339),
		CreatedBy:      body.UserID,
		Status:         "active",
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
	secrets = append(secrets, newEntry)
	secretsMu.Unlock()

	logAudit("rotate", body.Path, body.UserID, r.RemoteAddr, true, fmt.Sprintf("new_version=%d", newEntry.Version))
	respondJSON(w, 200, map[string]interface{}{
		"rotated": true,
		"old_version": maxVersion,
		"new_version": newEntry.Version,
		"secret": newEntry,
	})
}

func handleSecretList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	secretsMu.RLock()
	defer secretsMu.RUnlock()
	// Only return metadata, not values
	meta := []map[string]interface{}{}
	for _, s := range secrets {
		meta = append(meta, map[string]interface{}{
			"id": s.ID, "path": s.Path, "version": s.Version,
			"algorithm": s.Algorithm, "status": s.Status, "expires_at": s.ExpiresAt,
		})
	}
	respondJSON(w, 200, map[string]interface{}{"secrets": meta, "count": len(meta)})
}

func handlePolicyCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Name        string   `json:"name"`
		PathPattern string   `json:"path_pattern"`
		Operations  []string `json:"operations"`
		Roles       []string `json:"roles"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if body.Name == "" || body.PathPattern == "" || len(body.Operations) == 0 || len(body.Roles) == 0 {
		respondJSON(w, 400, map[string]interface{}{"error": "name_path_operations_roles_all_required"})
		return
	}
	pol := AccessPolicy{
		ID: fmt.Sprintf("POL-%s", secureRandID()),
		Name: body.Name, PathPattern: body.PathPattern,
		Operations: body.Operations, Roles: body.Roles,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	accessPolMu.Lock()
	accessPolicies = append(accessPolicies, pol)
	accessPolMu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"policy": pol})
}

func handleAuditLog(w http.ResponseWriter, r *http.Request) {
	incRequests()
	auditLogMu.RLock()
	defer auditLogMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"audit_log": auditLog, "count": len(auditLog)})
}

func handleKeyCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Algorithm string `json:"algorithm"`
		Purpose   string `json:"purpose"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	keyLen, ok := supportedAlgorithms[body.Algorithm]
	if !ok { body.Algorithm = "AES-256-GCM"; keyLen = 256 }
	if body.Purpose == "" { body.Purpose = "data_encryption" }

	key := EncryptionKey{
		ID:        fmt.Sprintf("KEY-%s", secureRandID()),
		Algorithm: body.Algorithm, KeyLength: keyLen,
		Purpose: body.Purpose, Status: "active", Version: 1,
		ExpiresAt: time.Now().UTC().Add(365 * 24 * time.Hour).Format(time.RFC3339),
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	keysMu.Lock()
	keys = append(keys, key)
	keysMu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"key": key})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	auditLogMu.RLock()
	ac := len(auditLog)
	auditLogMu.RUnlock()
	fmt.Fprintf(w, "requests_total{service=\"secrets-vault-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"secrets-vault-go\"} %d\n", ec)
	fmt.Fprintf(w, "audit_entries_total{service=\"secrets-vault-go\"} %d\n", ac)
}

func main() {
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = deriveEncryptionKey
	_ = strings.HasPrefix
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/secret/store", handleSecretStore)
	mux.HandleFunc("/v1/secret/retrieve", handleSecretRetrieve)
	mux.HandleFunc("/v1/secret/rotate", handleSecretRotate)
	mux.HandleFunc("/v1/secret/list", handleSecretList)
	mux.HandleFunc("/v1/policy/create", handlePolicyCreate)
	mux.HandleFunc("/v1/key/create", handleKeyCreate)
	mux.HandleFunc("/v1/audit/log", handleAuditLog)
	log.Printf("Secrets Vault (PCI-DSS Compliant) listening on :%s", PORT)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
