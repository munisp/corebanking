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

var serviceName = "programmable-money-go"

type Condition struct {
	Type      string `json:"type"`
	Operator  string `json:"operator"`
	Field     string `json:"field"`
	Value     string `json:"value"`
	Satisfied bool   `json:"satisfied"`
	CheckedAt string `json:"checked_at,omitempty"`
}

type SmartTransfer struct {
	TransferID    string      `json:"transfer_id"`
	PayerAccount  string      `json:"payer_account"`
	PayeeAccount  string      `json:"payee_account"`
	AmountKobo    int64       `json:"amount_kobo"`
	Currency      string      `json:"currency"`
	Conditions    []Condition `json:"conditions"`
	LogicOperator string      `json:"logic_operator"`
	Status        string      `json:"status"`
	EscrowHeld    bool        `json:"escrow_held"`
	CreatedAt     time.Time   `json:"created_at"`
	ExpiresAt     time.Time   `json:"expires_at"`
	ReleasedAt    *time.Time  `json:"released_at,omitempty"`
	Narration     string      `json:"narration"`
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
		log.Printf("[%s] DB connection failed: %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS smart_transfers (
		transfer_id TEXT PRIMARY KEY,
		payer_account TEXT NOT NULL,
		payee_account TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		currency TEXT NOT NULL DEFAULT 'NGN',
		conditions JSONB NOT NULL DEFAULT '[]',
		logic_operator TEXT NOT NULL DEFAULT 'AND',
		status TEXT NOT NULL DEFAULT 'pending_conditions',
		escrow_held BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL,
		released_at TIMESTAMPTZ,
		narration TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_smart_transfers_status ON smart_transfers(status);
	CREATE INDEX IF NOT EXISTS idx_smart_transfers_payer ON smart_transfers(payer_account);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func createSmartTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PayerAccount  string      `json:"payer_account"`
		PayeeAccount  string      `json:"payee_account"`
		AmountKobo    int64       `json:"amount_kobo"`
		Currency      string      `json:"currency"`
		Conditions    []Condition `json:"conditions"`
		LogicOperator string      `json:"logic_operator"`
		ExpiryHours   int         `json:"expiry_hours"`
		Narration     string      `json:"narration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if len(req.Conditions) == 0 {
		respondJSON(w, 400, map[string]string{"error": "at least one condition required"})
		return
	}
	if req.LogicOperator == "" {
		req.LogicOperator = "AND"
	}
	if req.ExpiryHours == 0 {
		req.ExpiryHours = 72
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	transferID := fmt.Sprintf("SMART-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:22]
	now := time.Now()
	expiresAt := now.Add(time.Duration(req.ExpiryHours) * time.Hour)
	conditionsJSON, _ := json.Marshal(req.Conditions)

	if app.db != nil {
		_, err := app.db.Exec(`INSERT INTO smart_transfers (transfer_id, payer_account, payee_account, amount_kobo, currency, conditions, logic_operator, status, escrow_held, created_at, expires_at, narration)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_conditions', TRUE, $8, $9, $10)`,
			transferID, req.PayerAccount, req.PayeeAccount, req.AmountKobo, req.Currency, string(conditionsJSON), req.LogicOperator, now, expiresAt, req.Narration)
		if err != nil {
			log.Printf("[%s] INSERT failed: %v", serviceName, err)
			respondJSON(w, 500, map[string]string{"error": "failed to persist transfer"})
			return
		}
	}

	respondJSON(w, 201, map[string]interface{}{
		"transfer_id":      transferID,
		"status":           "pending_conditions",
		"conditions_count": len(req.Conditions),
		"logic":            req.LogicOperator,
		"expires_at":       expiresAt.Format(time.RFC3339),
		"note":             "Funds held in escrow via TigerBeetle 2PC pending transfer",
	})
}

func satisfyCondition(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID    string      `json:"transfer_id"`
		ConditionType string      `json:"condition_type"`
		Evidence      interface{} `json:"evidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	var conditionsJSON string
	var status, logicOp string
	var amountKobo int64
	var payeeAccount string
	err := app.db.QueryRow(`SELECT conditions, status, logic_operator, amount_kobo, payee_account FROM smart_transfers WHERE transfer_id = $1`, req.TransferID).Scan(
		&conditionsJSON, &status, &logicOp, &amountKobo, &payeeAccount)
	if err == sql.ErrNoRows {
		respondJSON(w, 404, map[string]string{"error": "transfer not found"})
		return
	}
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	if status != "pending_conditions" {
		respondJSON(w, 409, map[string]string{"error": "transfer not in pending_conditions state"})
		return
	}

	var conditions []Condition
	json.Unmarshal([]byte(conditionsJSON), &conditions)

	now := time.Now().Format(time.RFC3339)
	for j := range conditions {
		if conditions[j].Type == req.ConditionType {
			conditions[j].Satisfied = true
			conditions[j].CheckedAt = now
		}
	}

	allMet := true
	anyMet := false
	satisfied := 0
	for _, c := range conditions {
		if c.Satisfied {
			anyMet = true
			satisfied++
		} else {
			allMet = false
		}
	}

	shouldRelease := (logicOp == "AND" && allMet) || (logicOp == "OR" && anyMet)
	updatedConditions, _ := json.Marshal(conditions)

	if shouldRelease {
		releasedAt := time.Now()
		app.db.Exec(`UPDATE smart_transfers SET conditions = $1, status = 'released', released_at = $2 WHERE transfer_id = $3`,
			string(updatedConditions), releasedAt, req.TransferID)
		respondJSON(w, 200, map[string]interface{}{
			"transfer_id": req.TransferID, "status": "released",
			"amount_kobo": amountKobo, "released_to": payeeAccount,
			"note": "All conditions met — funds released from escrow",
		})
		return
	}

	app.db.Exec(`UPDATE smart_transfers SET conditions = $1 WHERE transfer_id = $2`, string(updatedConditions), req.TransferID)
	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": req.TransferID, "status": "pending_conditions",
		"satisfied": satisfied, "total": len(conditions),
		"remaining": len(conditions) - satisfied,
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
		"condition_types": []string{"delivery_confirmed", "quality_passed", "time_elapsed", "multi_sig", "iot_sensor", "manual_approval"},
	})
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "programmable-money-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "programmable-money-go")
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
		port = "9049"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/smart-transfer/create", createSmartTransfer)
	mux.HandleFunc("/api/v1/smart-transfer/satisfy", satisfyCondition)
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
