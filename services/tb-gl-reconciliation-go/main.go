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
	"math"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"tbclient"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "tb-gl-reconciliation-go"

type AccountBalance struct {
	AccountID     string  `json:"account_id"`
	GLBalanceKobo int64   `json:"gl_balance_kobo"`
	TBBalanceKobo int64   `json:"tb_balance_kobo"`
	DriftKobo     int64   `json:"drift_kobo"`
	DriftPct      float64 `json:"drift_pct"`
	Status        string  `json:"status"`
}

type ReconciliationRun struct {
	RunID         string           `json:"run_id"`
	StartedAt     time.Time        `json:"started_at"`
	CompletedAt   *time.Time       `json:"completed_at,omitempty"`
	Status        string           `json:"status"`
	TotalAccounts int              `json:"total_accounts"`
	Matched       int              `json:"matched"`
	Drifted       int              `json:"drifted"`
	MissingInGL   int              `json:"missing_in_gl"`
	MissingInTB   int              `json:"missing_in_tb"`
	MaxDriftKobo  int64            `json:"max_drift_kobo"`
	Balances      []AccountBalance `json:"balances,omitempty"`
	Alerts        []string         `json:"alerts,omitempty"`
}

type App struct {
	db       *sql.DB
	tbClient *tbclient.Client
}

var app = &App{}

const (
	DriftThresholdKobo = 100
	DriftThresholdPct  = 0.0001
	AlertThresholdKobo = 10000
	CriticalDriftKobo  = 100000
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/corebanking?sslmode=disable"
	}
	var err error
	app.db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB connection failed: %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS reconciliation_runs (
		run_id TEXT PRIMARY KEY,
		started_at TIMESTAMPTZ NOT NULL,
		completed_at TIMESTAMPTZ,
		status TEXT NOT NULL DEFAULT 'running',
		total_accounts INTEGER NOT NULL DEFAULT 0,
		matched INTEGER NOT NULL DEFAULT 0,
		drifted INTEGER NOT NULL DEFAULT 0,
		missing_in_gl INTEGER NOT NULL DEFAULT 0,
		missing_in_tb INTEGER NOT NULL DEFAULT 0,
		max_drift_kobo BIGINT NOT NULL DEFAULT 0,
		balances JSONB NOT NULL DEFAULT '[]',
		alerts JSONB NOT NULL DEFAULT '[]'
	);
	CREATE INDEX IF NOT EXISTS idx_recon_status ON reconciliation_runs(status);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func reconcile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GLAccounts []struct {
			AccountID   string `json:"account_id"`
			BalanceKobo int64  `json:"balance_kobo"`
		} `json:"gl_accounts"`
		TBAccounts []struct {
			AccountID     string `json:"account_id"`
			DebitsPosted  int64  `json:"debits_posted"`
			CreditsPosted int64  `json:"credits_posted"`
		} `json:"tb_accounts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	run := ReconciliationRun{
		RunID:     fmt.Sprintf("RECON-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:24],
		StartedAt: time.Now(),
		Status:    "running",
	}

	glMap := make(map[string]int64)
	for _, a := range req.GLAccounts {
		glMap[a.AccountID] = a.BalanceKobo
	}
	tbMap := make(map[string]int64)
	for _, a := range req.TBAccounts {
		tbMap[a.AccountID] = a.CreditsPosted - a.DebitsPosted
	}

	allAccounts := make(map[string]bool)
	for id := range glMap {
		allAccounts[id] = true
	}
	for id := range tbMap {
		allAccounts[id] = true
	}
	run.TotalAccounts = len(allAccounts)

	for id := range allAccounts {
		glBal, hasGL := glMap[id]
		tbBal, hasTB := tbMap[id]

		var ab AccountBalance
		ab.AccountID = id

		if !hasGL {
			ab.Status = "missing_in_gl"
			ab.TBBalanceKobo = tbBal
			run.MissingInGL++
			run.Alerts = append(run.Alerts, fmt.Sprintf("MISSING_IN_GL: account %s exists in TigerBeetle but not GL", id))
		} else if !hasTB {
			ab.Status = "missing_in_tb"
			ab.GLBalanceKobo = glBal
			run.MissingInTB++
			run.Alerts = append(run.Alerts, fmt.Sprintf("MISSING_IN_TB: account %s exists in GL but not TigerBeetle", id))
		} else {
			ab.GLBalanceKobo = glBal
			ab.TBBalanceKobo = tbBal
			ab.DriftKobo = glBal - tbBal
			if glBal != 0 {
				ab.DriftPct = math.Abs(float64(ab.DriftKobo)) / math.Abs(float64(glBal))
			}
			if ab.DriftKobo == 0 {
				ab.Status = "matched"
				run.Matched++
			} else {
				ab.Status = "drifted"
				run.Drifted++
				absDrift := ab.DriftKobo
				if absDrift < 0 {
					absDrift = -absDrift
				}
				if absDrift > run.MaxDriftKobo {
					run.MaxDriftKobo = absDrift
				}
				severity := "INFO"
				if absDrift >= CriticalDriftKobo {
					severity = "CRITICAL"
				} else if absDrift >= AlertThresholdKobo {
					severity = "WARNING"
				}
				run.Alerts = append(run.Alerts, fmt.Sprintf("%s: account %s drift=%d kobo (GL=%d, TB=%d)", severity, id, ab.DriftKobo, glBal, tbBal))
			}
		}
		run.Balances = append(run.Balances, ab)
	}

	now := time.Now()
	run.CompletedAt = &now
	run.Status = "completed"
	if run.Drifted > 0 && run.MaxDriftKobo >= CriticalDriftKobo {
		run.Status = "completed_with_critical_drift"
	}

	if app.db != nil {
		balancesJSON, _ := json.Marshal(run.Balances)
		alertsJSON, _ := json.Marshal(run.Alerts)
		_, err := app.db.Exec(`INSERT INTO reconciliation_runs (run_id, started_at, completed_at, status, total_accounts, matched, drifted, missing_in_gl, missing_in_tb, max_drift_kobo, balances, alerts)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			run.RunID, run.StartedAt, run.CompletedAt, run.Status, run.TotalAccounts, run.Matched, run.Drifted, run.MissingInGL, run.MissingInTB, run.MaxDriftKobo, string(balancesJSON), string(alertsJSON))
		if err != nil {
			log.Printf("[%s] INSERT run failed: %v", serviceName, err)
		}
	}

	respondJSON(w, 200, run)
}

func getHistory(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT run_id, started_at, completed_at, status, total_accounts, matched, drifted, missing_in_gl, missing_in_tb, max_drift_kobo, alerts
		FROM reconciliation_runs ORDER BY started_at DESC LIMIT 50`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	type RunSummary struct {
		RunID         string     `json:"run_id"`
		StartedAt     time.Time  `json:"started_at"`
		CompletedAt   *time.Time `json:"completed_at"`
		Status        string     `json:"status"`
		TotalAccounts int        `json:"total_accounts"`
		Matched       int        `json:"matched"`
		Drifted       int        `json:"drifted"`
		MissingInGL   int        `json:"missing_in_gl"`
		MissingInTB   int        `json:"missing_in_tb"`
		MaxDriftKobo  int64      `json:"max_drift_kobo"`
		Alerts        []string   `json:"alerts"`
	}

	runs := make([]RunSummary, 0)
	for rows.Next() {
		var rs RunSummary
		var alertsJSON string
		if err := rows.Scan(&rs.RunID, &rs.StartedAt, &rs.CompletedAt, &rs.Status, &rs.TotalAccounts, &rs.Matched, &rs.Drifted, &rs.MissingInGL, &rs.MissingInTB, &rs.MaxDriftKobo, &alertsJSON); err != nil {
			continue
		}
		json.Unmarshal([]byte(alertsJSON), &rs.Alerts)
		runs = append(runs, rs)
	}
	respondJSON(w, 200, map[string]interface{}{"total_runs": len(runs), "runs": runs})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
		"thresholds": map[string]interface{}{
			"drift_kobo": DriftThresholdKobo, "drift_pct": DriftThresholdPct,
			"alert_kobo": AlertThresholdKobo, "critical_kobo": CriticalDriftKobo,
		},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	app.tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[%s] TB client init failed: %v", serviceName, err)
	}
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
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
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
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

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
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
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-gl-reconciliation-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-gl-reconciliation-go")
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
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
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

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	startJWKSRefresh()

	initDB()
	initTBClient()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9043"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/reconciliation/run", reconcile)
	mux.HandleFunc("/api/v1/reconciliation/history", getHistory)
	srv := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] error: %v", serviceName, err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	if app.db != nil {
		app.db.Close()
	}
	log.Printf("[%s] Shutdown complete", serviceName)
}
