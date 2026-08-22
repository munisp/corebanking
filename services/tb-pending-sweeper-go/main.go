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
	"syscall"
	"tbclient"
	"time"

	_ "github.com/lib/pq"
)

// TigerBeetle Pending Transfer Sweeper
// Background goroutine that auto-voids expired pending transfers (>5 min default).
// Prevents funds from being held indefinitely in 2PC pending state.
// Persists sweep results to PostgreSQL for audit trail.

type PendingTransfer struct {
	TransferID  string    `json:"transfer_id"`
	DebitAcct   string    `json:"debit_account_id"`
	CreditAcct  string    `json:"credit_account_id"`
	AmountKobo  int64     `json:"amount_kobo"`
	CreatedAt   time.Time `json:"created_at"`
	TimeoutSecs int       `json:"timeout_secs"`
	Status      string    `json:"status"` // pending, posted, voided, expired
}

type SweepResult struct {
	SweptAt    time.Time `json:"swept_at"`
	TransferID string    `json:"transfer_id"`
	Action     string    `json:"action"` // voided
	AgeSeconds float64   `json:"age_seconds"`
}

var (
	db             *sql.DB
	tbClient       *tbclient.Client
	pendingMu      sync.RWMutex
	pendingTxns    map[string]*PendingTransfer
	sweepResults   []SweepResult
	sweepInterval  = 30 * time.Second
	defaultTimeout = 5 * time.Minute
)

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("DB error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_pending_transfers (
		transfer_id VARCHAR(128) PRIMARY KEY,
		debit_account_id VARCHAR(64) NOT NULL,
		credit_account_id VARCHAR(64) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		timeout_secs INTEGER NOT NULL DEFAULT 300,
		status VARCHAR(16) NOT NULL DEFAULT 'pending'
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sweep_results (
		id SERIAL PRIMARY KEY,
		swept_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		transfer_id VARCHAR(128) NOT NULL,
		action VARCHAR(16) NOT NULL DEFAULT 'voided',
		age_seconds NUMERIC(10,2) NOT NULL
	)`)
	log.Println("[tb-pending-sweeper] Schema initialized")
}

func loadPending() {
	pendingTxns = make(map[string]*PendingTransfer)
	if db == nil {
		return
	}
	rows, err := db.Query(`SELECT transfer_id, debit_account_id, credit_account_id, amount_kobo, created_at, timeout_secs, status
		FROM tb_pending_transfers WHERE status = 'pending'`)
	if err != nil {
		log.Printf("Load pending error: %v", err)
		return
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var p PendingTransfer
		if err := rows.Scan(&p.TransferID, &p.DebitAcct, &p.CreditAcct, &p.AmountKobo, &p.CreatedAt, &p.TimeoutSecs, &p.Status); err != nil {
			continue
		}
		pendingTxns[p.TransferID] = &p
		count++
	}
	log.Printf("[tb-pending-sweeper] Loaded %d pending transfers from DB", count)
}

func sweepExpired() int {
	now := time.Now()
	pendingMu.Lock()
	defer pendingMu.Unlock()

	swept := 0
	for id, p := range pendingTxns {
		if p.Status != "pending" {
			continue
		}
		timeout := time.Duration(p.TimeoutSecs) * time.Second
		if timeout == 0 {
			timeout = defaultTimeout
		}
		age := now.Sub(p.CreatedAt)
		if age > timeout {
			p.Status = "expired"
			result := SweepResult{
				SweptAt:    now,
				TransferID: id,
				Action:     "voided",
				AgeSeconds: age.Seconds(),
			}
			sweepResults = append(sweepResults, result)
			if db != nil {
				db.Exec(`UPDATE tb_pending_transfers SET status = 'expired' WHERE transfer_id = $1`, id)
				db.Exec(`INSERT INTO tb_sweep_results (swept_at, transfer_id, action, age_seconds) VALUES ($1, $2, $3, $4)`,
					result.SweptAt, result.TransferID, result.Action, result.AgeSeconds)
			}
			// Void in TigerBeetle
			if tbClient != nil {
				pendingID := tbclient.NewUint128()
				if err := tbClient.VoidPendingTransfer(pendingID); err != nil {
					log.Printf("[sweeper] TB void failed for %s: %v", id, err)
				}
			}
			log.Printf("[sweeper] voided expired transfer %s (age: %.0fs, timeout: %ds)", id, age.Seconds(), p.TimeoutSecs)
			swept++
		}
	}
	return swept
}

func sweepLoop(ctx context.Context) {
	ticker := time.NewTicker(sweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			sweepExpired()
			return
		case <-ticker.C:
			n := sweepExpired()
			if n > 0 {
				log.Printf("[sweeper] swept %d expired transfers", n)
			}
		}
	}
}

func registerPendingHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID  string `json:"transfer_id"`
		DebitAcct   string `json:"debit_account_id"`
		CreditAcct  string `json:"credit_account_id"`
		AmountKobo  int64  `json:"amount_kobo"`
		TimeoutSecs int    `json:"timeout_secs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	if req.TimeoutSecs == 0 {
		req.TimeoutSecs = 300
	}

	p := &PendingTransfer{
		TransferID:  req.TransferID,
		DebitAcct:   req.DebitAcct,
		CreditAcct:  req.CreditAcct,
		AmountKobo:  req.AmountKobo,
		CreatedAt:   time.Now(),
		TimeoutSecs: req.TimeoutSecs,
		Status:      "pending",
	}

	pendingMu.Lock()
	pendingTxns[req.TransferID] = p
	pendingMu.Unlock()

	if db != nil {
		db.Exec(`INSERT INTO tb_pending_transfers (transfer_id, debit_account_id, credit_account_id, amount_kobo, created_at, timeout_secs, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending')
			ON CONFLICT (transfer_id) DO NOTHING`,
			p.TransferID, p.DebitAcct, p.CreditAcct, p.AmountKobo, p.CreatedAt, p.TimeoutSecs)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer": p, "timeout_secs": req.TimeoutSecs})
}

func resolvePendingHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID string `json:"transfer_id"`
		Action     string `json:"action"` // post or void
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	pendingMu.Lock()
	p, ok := pendingTxns[req.TransferID]
	if !ok {
		pendingMu.Unlock()
		http.Error(w, `{"error":"transfer not found"}`, 404)
		return
	}
	if p.Status != "pending" {
		pendingMu.Unlock()
		http.Error(w, fmt.Sprintf(`{"error":"transfer already %s"}`, p.Status), 409)
		return
	}
	p.Status = req.Action + "ed"
	pendingMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_pending_transfers SET status = $1 WHERE transfer_id = $2`, p.Status, req.TransferID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer_id": req.TransferID, "status": p.Status})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	pendingMu.RLock()
	pending, expired, posted, voided := 0, 0, 0, 0
	for _, p := range pendingTxns {
		switch p.Status {
		case "pending":
			pending++
		case "expired":
			expired++
		case "posted":
			posted++
		case "voided":
			voided++
		}
	}
	pendingMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pending": pending, "expired": expired, "posted": posted, "voided": voided,
		"sweep_interval_secs":  sweepInterval.Seconds(),
		"default_timeout_secs": defaultTimeout.Seconds(),
		"total_sweeps":         len(sweepResults),
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-pending-sweeper-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-pending-sweeper] TB client init failed: %v", err)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-pending-sweeper-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-pending-sweeper-go")
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
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
	loadPending()

	ctx, cancel := context.WithCancel(context.Background())
	go sweepLoop(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-sweeper/register", registerPendingHandler)
	mux.HandleFunc("/v1/tb-sweeper/resolve", resolvePendingHandler)
	mux.HandleFunc("/v1/tb-sweeper/status", statusHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8301"
	}

	server := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}

	go func() {
		log.Printf("[tb-pending-sweeper-go] Starting on :%s (sweep every %v, timeout %v)", port, sweepInterval, defaultTimeout)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	server.Shutdown(shutCtx)
	log.Println("[tb-pending-sweeper-go] Shutdown complete")
}
