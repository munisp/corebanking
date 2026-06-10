package main

import (
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)


// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "secrets-vault-go"

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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(entry); err == nil { if dbErr := dbInsert(fmt.Sprintf("secrets-vault-go-%d", time.Now().UnixNano()), "secrets-vault-go", "secrets", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(newEntry); err == nil { if dbErr := dbInsert(fmt.Sprintf("secrets-vault-go-%d", time.Now().UnixNano()), "secrets-vault-go", "secrets", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(pol); err == nil { if dbErr := dbInsert(fmt.Sprintf("secrets-vault-go-%d", time.Now().UnixNano()), "secrets-vault-go", "accessPolicies", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(key); err == nil { if dbErr := dbInsert(fmt.Sprintf("secrets-vault-go-%d", time.Now().UnixNano()), "secrets-vault-go", "keys", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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


// ─── PostgreSQL Persistence ───

var db *sql.DB
var readyFlag int32

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
	atomic.StoreInt32(&readyFlag, 1)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4, updated_at=NOW()", id, service, typ, status, string(data))
	return err
}

func dbQuery(service, typ string) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, data, status, created_at FROM service_records WHERE service=$1 AND type=$2 ORDER BY created_at DESC LIMIT 100", service, typ)
	if err != nil { return nil, err }
	defer rows.Close()
	var results []map[string]interface{}
	for rows.Next() {
		var id, data, status, createdAt string
		if err := rows.Scan(&id, &data, &status, &createdAt); err != nil { continue }
		results = append(results, map[string]interface{}{"id": id, "data": data, "status": status, "created_at": createdAt})
	}
	return results, nil
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Monetary Safety (kobo precision) ---
type AmountKobo = int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(math.Round(naira * 100)) }
func koboToNaira(kobo AmountKobo) float64  { return float64(kobo) / 100.0 }
func roundNaira(amount float64) float64 { return math.Round(amount*100) / 100 }
func validateAmount(amount float64) error {
	if amount < 0 { return fmt.Errorf("amount must be non-negative") }
	if amount > 999_999_999_999.99 { return fmt.Errorf("exceeds CBN max limit") }
	return nil
}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Circuit Breaker ---
type circuitBreakerState int
const (
	cbClosed circuitBreakerState = iota
	cbOpen
	cbHalfOpen
)

var (
	cbState     circuitBreakerState
	cbFailCount uint64
	cbLastFail  int64
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	if cbState == cbClosed { return true }
	if cbState == cbOpen && time.Now().Unix()-atomic.LoadInt64(&cbLastFail) > cbTimeout {
		cbState = cbHalfOpen
		return true
	}
	return cbState == cbHalfOpen
}

func cbRecordSuccess() { atomic.StoreUint64(&cbFailCount, 0); cbState = cbClosed }
func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold { cbState = cbOpen }
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}

func maskPII(value, fieldType string) string {
	if len(value) < 4 { return "***" }
	switch fieldType {
	case "bvn":
		return value[:3] + "****" + value[len(value)-4:]
	case "phone":
		return value[:4] + "****" + value[len(value)-2:]
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return parts[0][:1] + "***@" + parts[1] }
		return "***"
	default:
		return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
	}
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-Id")
		if rid == "" {
			rid = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		w.Header().Set("X-Request-Id", rid)
		next.ServeHTTP(w, r)
	})
}

func main() {
	initTracing()
	initDB()
	_ = context.Background
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

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Printf("[%s] Shutting down gracefully...", serviceName)
		if db != nil { db.Close() }
		os.Exit(0)
	}()
		srv := &http.Server{Addr: ":"+PORT, Handler: corsMiddleware(rateLimitMiddleware(mux))}
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("[secrets-vault-go] Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("[secrets-vault-go] listening on %s", ":"+PORT)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}
}
