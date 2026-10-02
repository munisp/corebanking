// 54Bank db-migrations — platform schema migration runner (B5 P1-C rewrite).
//
// Was: a 614-line in-memory stub with fabricated Record CRUD and ZERO
// CREATE TABLE. Now: the real, single owned migration path for the platform
// template tables (outbox, service_records, service_configs — see
// migrations/V2026*.sql) and the registration point for future
// service-specific migrations (see README.md).
//
// Endpoint contract preserved from the stub: /healthz /readyz /livez
// /metrics keep their paths and response shapes (now truthful), and the
// /v1/db-migrations/* routes now serve real ledger data instead of the
// fabricated in-memory store. Non-probe routes remain behind the Keycloak
// JWKS JWT middleware (fail-closed), unchanged from the stub.
package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls.
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

var startTime = time.Now()
var (
	_reqCount uint64
	_errCount uint64
)

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "db-migrations")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Runner state (real, ledger-backed) ─────────────────────────────────────

var (
	dbHandle *sql.DB
	stateMu  sync.RWMutex
	state    = &runnerState{LastError: "migrations not yet run"}
)

func currentState() runnerState {
	stateMu.RLock()
	defer stateMu.RUnlock()
	return *state
}

func setState(s *runnerState, runErr error) {
	stateMu.Lock()
	defer stateMu.Unlock()
	if runErr != nil && s.LastError == "" {
		s.LastError = runErr.Error()
	}
	if runErr == nil {
		s.LastError = ""
	}
	state = s
}

// dbReady reports probe truth: DB reachable, no dirty ledger rows, no pending
// migrations, no run error.
func dbReady() (bool, string) {
	if dbHandle == nil {
		return false, "database not connected"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := dbHandle.PingContext(ctx); err != nil {
		return false, "database unreachable: " + err.Error()
	}
	s := currentState()
	if len(s.Dirty) > 0 {
		return false, "dirty schema_migrations versions present"
	}
	if len(s.Pending) > 0 {
		return false, "pending migrations: " + strings.Join(s.Pending, ",")
	}
	if s.LastError != "" {
		return false, s.LastError
	}
	return true, ""
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	s := currentState()
	status := "healthy"
	if s.LastError != "" || len(s.Dirty) > 0 {
		status = "degraded"
	}
	respondJSON(w, 200, map[string]interface{}{
		"service": "db-migrations", "status": status, "version": "2.1.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain":      "Db Migrations — Infrastructure/Data",
		"migrations": map[string]interface{}{
			"applied": s.Applied,
			"pending": s.Pending,
			"dirty":   s.Dirty,
			"lastRun": s.LastRun,
		},
	})
}

func handleReadyz(w http.ResponseWriter, r *http.Request) {
	ok, reason := dbReady()
	if !ok {
		respondJSON(w, 503, map[string]interface{}{
			"ready": false, "service": "db-migrations", "reason": reason,
		})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"ready": true, "service": "db-migrations"})
}

// ledgerEntry is the JSON view of one schema_migrations row.
type ledgerEntry struct {
	Version         int64  `json:"version"`
	Script          string `json:"script"`
	AppliedAt       string `json:"appliedAt"`
	Checksum        string `json:"checksum,omitempty"`
	ExecutionTimeMs int64  `json:"executionTimeMs,omitempty"`
	Runner          string `json:"runner"`
	Dirty           bool   `json:"dirty"`
}

func ledgerEntries(rows []ledgerRow) []ledgerEntry {
	out := make([]ledgerEntry, 0, len(rows))
	for _, r := range rows {
		e := ledgerEntry{
			Version:   r.Version,
			Script:    r.Script,
			AppliedAt: r.AppliedAt.Format(time.RFC3339),
			Runner:    r.Runner.String,
			Dirty:     r.Dirty,
		}
		if r.Checksum.Valid {
			e.Checksum = r.Checksum.String
		}
		if r.ExecutionTimeMs.Valid {
			e.ExecutionTimeMs = r.ExecutionTimeMs.Int64
		}
		out = append(out, e)
	}
	return out
}

// handleStatus is the k8s/operator source of truth: applied count, pending
// migrations, dirty flag, and the full ledger.
func handleStatus(w http.ResponseWriter, r *http.Request) {
	s := currentState()
	respondJSON(w, 200, map[string]interface{}{
		"service": "db-migrations",
		"applied": s.Applied,
		"pending": s.Pending,
		"dirty":   s.Dirty,
		"ok":      s.LastError == "" && len(s.Dirty) == 0 && len(s.Pending) == 0,
		"lastRun": s.LastRun,
		"error":   s.LastError,
		"ledger":  ledgerEntries(s.Entries),
	})
}

// handleList replaces the stub's fabricated in-memory record list with the
// real applied-migration list.
func handleList(w http.ResponseWriter, r *http.Request) {
	s := currentState()
	respondJSON(w, 200, map[string]interface{}{
		"migrations": ledgerEntries(s.Entries),
		"total":      len(s.Entries),
		"domain":     "Infrastructure/Data",
	})
}

// handleStats replaces the stub's fabricated DomainStats with real counts.
func handleStats(w http.ResponseWriter, r *http.Request) {
	s := currentState()
	respondJSON(w, 200, map[string]interface{}{
		"domain":         "Infrastructure/Data",
		"appliedCount":   s.Applied,
		"pendingCount":   len(s.Pending),
		"dirtyCount":     len(s.Dirty),
		"ledgerRowCount": len(s.Entries),
		"lastRun":        s.LastRun,
		"uptime_secs":    int(time.Since(startTime).Seconds()),
	})
}

// handleAudit serves the ledger as the audit trail (append-only record of
// what ran, when, how long, with checksums).
func handleAudit(w http.ResponseWriter, r *http.Request) {
	s := currentState()
	respondJSON(w, 200, map[string]interface{}{
		"auditLog": ledgerEntries(s.Entries), "total": len(s.Entries),
	})
}

// handleRun re-runs pending migrations on demand (operator action). No-op
// when nothing is pending. Refuses (fail-closed) while dirty.
func handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	if dbHandle == nil {
		respondJSON(w, 503, map[string]string{"error": "database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()
	s, err := applyMigrations(ctx, dbHandle)
	setState(s, err)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"ok": true, "applied": s.Applied})
}

// goneHandler replaces the stub's fabricated in-memory create/update/process
// routes. They returned invented data; there is no real operation behind
// them, so they fail honestly (mirrors the stub's own handleProcess 501).
func goneHandler(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 501, map[string]string{
		"error": "not_implemented",
		"detail": "the in-memory record store was fabricated and has been removed; " +
			"see /v1/db-migrations/status for real migration state",
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---
// Unchanged from the stub: non-probe routes require a verified Bearer token.

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
func fetchJWKS(realmURL string) {
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers are overwritten from verified claims.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// runMigrationsAtBoot connects (with retry — the DB may still be coming up in
// the same compose group) and applies pending migrations once.
func runMigrationsAtBoot() error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	var db *sql.DB
	var err error
	for attempt := 1; attempt <= 5; attempt++ {
		db, err = connectDB(ctx)
		if err == nil {
			break
		}
		log.Printf("[db-migrations] connect attempt %d/5 failed: %v", attempt, err)
		time.Sleep(time.Duration(attempt) * 3 * time.Second)
	}
	if err != nil {
		setState(&runnerState{LastRun: time.Now().UTC(), LastError: err.Error()}, err)
		return err
	}
	dbHandle = db

	s, err := applyMigrations(ctx, db)
	setState(s, err)
	return err
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9345"
	}

	bootErr := runMigrationsAtBoot()
	if bootErr != nil {
		// Fail-closed: the process keeps serving so probes/operators can read
		// the real state, but /readyz stays 503 until the dirty state is
		// resolved. Job mode exits non-zero instead (below).
		log.Printf("[db-migrations] BOOT MIGRATION FAILED (serving degraded): %v", bootErr)
	} else {
		log.Printf("[db-migrations] all migrations applied")
	}

	// Job mode: run migrations and exit (k8s Job / initContainer usage).
	if os.Getenv("MIGRATIONS_EXIT_AFTER_RUN") == "true" {
		if bootErr != nil {
			os.Exit(1)
		}
		os.Exit(0)
	}

	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/readyz", handleReadyz)
	http.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"alive": true})
	})
	http.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		reqs := atomic.LoadUint64(&_reqCount)
		errs := atomic.LoadUint64(&_errCount)
		s := currentState()
		dirty := 0
		if len(s.Dirty) > 0 {
			dirty = 1
		}
		w.Header().Set("Content-Type", "text/plain")
		printfText(w, "# TYPE requests_total counter\nrequests_total{service=\"db-migrations\"} %d\n", reqs)
		printfText(w, "# TYPE errors_total counter\nerrors_total{service=\"db-migrations\"} %d\n", errs)
		printfText(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"db-migrations\"} %.0f\n", time.Since(startTime).Seconds())
		printfText(w, "# TYPE db_migrations_applied gauge\ndb_migrations_applied %d\n", s.Applied)
		printfText(w, "# TYPE db_migrations_pending gauge\ndb_migrations_pending %d\n", len(s.Pending))
		printfText(w, "# TYPE db_migrations_dirty gauge\ndb_migrations_dirty %d\n", dirty)
	})
	http.HandleFunc("/v1/db-migrations/status", handleStatus)
	http.HandleFunc("/v1/db-migrations/list", handleList)
	http.HandleFunc("/v1/db-migrations/audit", handleAudit)
	http.HandleFunc("/v1/db-migrations/stats", handleStats)
	http.HandleFunc("/v1/db-migrations/run", handleRun)
	http.HandleFunc("/v1/db-migrations/create", goneHandler)
	http.HandleFunc("/v1/db-migrations/update", goneHandler)
	http.HandleFunc("/v1/db-migrations/process", goneHandler)
	log.Printf("db-migrations v2.1 (platform migration runner) on :%s", port)
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           countingMiddleware(jwtAuthMiddleware(http.DefaultServeMux)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[db-migrations] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	if dbHandle != nil {
		dbHandle.Close()
	}
	log.Println("[db-migrations] Server stopped")
}

// printfText writes a formatted metrics line, logging write failures
// (fmt.Fprintf return value must not be silently dropped — errcheck hygiene).
func printfText(w http.ResponseWriter, format string, args ...interface{}) {
	if _, err := fmt.Fprintf(w, format, args...); err != nil {
		log.Printf("[db-migrations] metrics write failed: %v", err)
	}
}
