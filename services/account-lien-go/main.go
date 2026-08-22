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
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "account-lien-go"

type Lien struct {
	LienID     string     `json:"lien_id"`
	AccountID  string     `json:"account_id"`
	AmountKobo int64      `json:"amount_kobo"`
	Type       string     `json:"type"`
	Reason     string     `json:"reason"`
	Reference  string     `json:"reference"`
	Status     string     `json:"status"`
	PlacedBy   string     `json:"placed_by"`
	PlacedAt   time.Time  `json:"placed_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
	ReleasedBy string     `json:"released_by,omitempty"`
}

type App struct {
	db *sql.DB
}

var app = &App{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/corebanking?sslmode=disable"
	}
	var err error
	app.db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB connection failed (will retry): %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS liens (
		lien_id TEXT PRIMARY KEY,
		account_id TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		type TEXT NOT NULL,
		reason TEXT NOT NULL DEFAULT '',
		reference TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'active',
		placed_by TEXT NOT NULL DEFAULT '',
		placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ,
		released_at TIMESTAMPTZ,
		released_by TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_liens_account ON liens(account_id);
	CREATE INDEX IF NOT EXISTS idx_liens_status ON liens(status);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func placeLien(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID     string `json:"account_id"`
		AmountKobo    int64  `json:"amount_kobo"`
		Type          string `json:"type"`
		Reason        string `json:"reason"`
		Reference     string `json:"reference"`
		PlacedBy      string `json:"placed_by"`
		DurationHours int    `json:"duration_hours,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.AmountKobo <= 0 {
		respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
		return
	}
	validTypes := map[string]bool{"judicial_hold": true, "collateral_lock": true, "garnishment": true, "regulatory_freeze": true, "card_hold": true, "loan_security": true}
	if !validTypes[req.Type] {
		respondJSON(w, 400, map[string]interface{}{"error": "invalid lien type", "valid_types": []string{"judicial_hold", "collateral_lock", "garnishment", "regulatory_freeze", "card_hold", "loan_security"}})
		return
	}

	var totalLienKobo int64
	if app.db != nil {
		app.db.QueryRow(`SELECT COALESCE(SUM(amount_kobo), 0) FROM liens WHERE account_id = $1 AND status = 'active'`, req.AccountID).Scan(&totalLienKobo)
	}

	lienID := fmt.Sprintf("LIEN-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%d", req.AccountID, time.Now().UnixNano()))))[0:20]
	now := time.Now()
	var expiresAt *time.Time
	if req.DurationHours > 0 {
		exp := now.Add(time.Duration(req.DurationHours) * time.Hour)
		expiresAt = &exp
	}

	if app.db != nil {
		_, err := app.db.Exec(`INSERT INTO liens (lien_id, account_id, amount_kobo, type, reason, reference, status, placed_by, placed_at, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)`,
			lienID, req.AccountID, req.AmountKobo, req.Type, req.Reason, req.Reference, req.PlacedBy, now, expiresAt)
		if err != nil {
			log.Printf("[%s] INSERT lien failed: %v", serviceName, err)
			respondJSON(w, 500, map[string]string{"error": "failed to persist lien"})
			return
		}
	}

	respondJSON(w, 201, map[string]interface{}{
		"lien_id": lienID, "status": "active",
		"total_liens_on_account_kobo": totalLienKobo + req.AmountKobo,
	})
}

func releaseLien(w http.ResponseWriter, r *http.Request) {
	var req struct {
		LienID     string `json:"lien_id"`
		ReleasedBy string `json:"released_by"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	if app.db != nil {
		now := time.Now()
		result, err := app.db.Exec(`UPDATE liens SET status = 'released', released_at = $1, released_by = $2 WHERE lien_id = $3 AND status = 'active'`,
			now, req.ReleasedBy, req.LienID)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "database error"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			respondJSON(w, 404, map[string]string{"error": "active lien not found"})
			return
		}
		respondJSON(w, 200, map[string]string{"status": "released", "lien_id": req.LienID})
		return
	}
	respondJSON(w, 503, map[string]string{"error": "database unavailable"})
}

func getAccountLiens(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	rows, err := app.db.Query(`SELECT lien_id, account_id, amount_kobo, type, reason, reference, status, placed_by, placed_at, expires_at, released_at, released_by FROM liens WHERE account_id = $1 ORDER BY placed_at DESC`, accountID)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	result := make([]Lien, 0)
	var totalActiveKobo int64
	for rows.Next() {
		var l Lien
		if err := rows.Scan(&l.LienID, &l.AccountID, &l.AmountKobo, &l.Type, &l.Reason, &l.Reference, &l.Status, &l.PlacedBy, &l.PlacedAt, &l.ExpiresAt, &l.ReleasedAt, &l.ReleasedBy); err != nil {
			continue
		}
		result = append(result, l)
		if l.Status == "active" {
			totalActiveKobo += l.AmountKobo
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"account_id": accountID, "liens": result, "total_active_kobo": totalActiveKobo,
		"available_balance_note": "Subtract total_active_kobo from account balance to get available balance",
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "account-lien-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "account-lien-go")
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
	port := os.Getenv("PORT")
	if port == "" {
		port = "9046"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/lien/place", placeLien)
	mux.HandleFunc("/api/v1/lien/release", releaseLien)
	mux.HandleFunc("/api/v1/lien/account", getAccountLiens)
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
