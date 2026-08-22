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

var serviceName = "settlement-clearing-go"

type NostroPosition struct {
	PositionID   string    `json:"position_id"`
	BankCode     string    `json:"bank_code"`
	BankName     string    `json:"bank_name"`
	BalanceKobo  int64     `json:"balance_kobo"`
	Currency     string    `json:"currency"`
	MaxLimitKobo int64     `json:"max_limit_kobo"`
	MinLimitKobo int64     `json:"min_limit_kobo"`
	LastUpdated  time.Time `json:"last_updated"`
}

type NIPTransfer struct {
	TransferID     string    `json:"transfer_id"`
	SourceBank     string    `json:"source_bank"`
	DestBank       string    `json:"dest_bank"`
	AmountKobo     int64     `json:"amount_kobo"`
	SessionID      string    `json:"session_id"`
	PaymentRef     string    `json:"payment_ref"`
	NarrationCode  string    `json:"narration_code"`
	Status         string    `json:"status"`
	SettlementType string    `json:"settlement_type"`
	CreatedAt      time.Time `json:"created_at"`
}

type SettlementBatch struct {
	BatchID        string     `json:"batch_id"`
	BatchType      string     `json:"batch_type"`
	TotalTransfers int        `json:"total_transfers"`
	TotalKobo      int64      `json:"total_kobo"`
	NetPositions   string     `json:"net_positions"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	SettledAt      *time.Time `json:"settled_at,omitempty"`
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

	schema := `CREATE TABLE IF NOT EXISTS nostro_positions (
		position_id TEXT PRIMARY KEY,
		bank_code TEXT UNIQUE NOT NULL,
		bank_name TEXT NOT NULL,
		balance_kobo BIGINT NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'NGN',
		max_limit_kobo BIGINT NOT NULL DEFAULT 10000000000,
		min_limit_kobo BIGINT NOT NULL DEFAULT 100000000,
		last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE TABLE IF NOT EXISTS nip_transfers (
		transfer_id TEXT PRIMARY KEY,
		source_bank TEXT NOT NULL,
		dest_bank TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		session_id TEXT NOT NULL DEFAULT '',
		payment_ref TEXT NOT NULL DEFAULT '',
		narration_code TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'pending',
		settlement_type TEXT NOT NULL DEFAULT 'RTGS',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_nip_status ON nip_transfers(status);
	CREATE INDEX IF NOT EXISTS idx_nip_source ON nip_transfers(source_bank);

	CREATE TABLE IF NOT EXISTS settlement_batches (
		batch_id TEXT PRIMARY KEY,
		batch_type TEXT NOT NULL,
		total_transfers INTEGER NOT NULL DEFAULT 0,
		total_kobo BIGINT NOT NULL DEFAULT 0,
		net_positions JSONB NOT NULL DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		settled_at TIMESTAMPTZ
	);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	seedNostroPositions()
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func seedNostroPositions() {
	if app.db == nil {
		return
	}
	type seed struct {
		code, name string
		balance    int64
	}
	banks := []seed{
		{"000001", "Access Bank", 500000000000},
		{"000002", "First Bank", 450000000000},
		{"000003", "UBA", 400000000000},
		{"000004", "GTBank", 380000000000},
		{"000005", "Zenith Bank", 520000000000},
		{"000006", "Stanbic IBTC", 200000000000},
		{"000007", "Fidelity Bank", 150000000000},
		{"000008", "Polaris Bank", 120000000000},
		{"000009", "Union Bank", 180000000000},
		{"000010", "Wema Bank", 90000000000},
	}
	for i, b := range banks {
		posID := fmt.Sprintf("NOS-%03d", i+1)
		app.db.Exec(`INSERT INTO nostro_positions (position_id, bank_code, bank_name, balance_kobo) VALUES ($1, $2, $3, $4) ON CONFLICT (bank_code) DO NOTHING`,
			posID, b.code, b.name, b.balance)
	}
}

func processTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceBank    string `json:"source_bank"`
		DestBank      string `json:"dest_bank"`
		AmountKobo    int64  `json:"amount_kobo"`
		SessionID     string `json:"session_id"`
		PaymentRef    string `json:"payment_ref"`
		NarrationCode string `json:"narration_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.AmountKobo <= 0 {
		respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
		return
	}
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	// Check source bank nostro position
	var sourceBalance int64
	err := app.db.QueryRow(`SELECT balance_kobo FROM nostro_positions WHERE bank_code = $1`, req.SourceBank).Scan(&sourceBalance)
	if err == sql.ErrNoRows {
		respondJSON(w, 404, map[string]string{"error": "source bank not found"})
		return
	}
	if sourceBalance < req.AmountKobo {
		respondJSON(w, 422, map[string]interface{}{
			"error":          "insufficient nostro position",
			"available_kobo": sourceBalance, "required_kobo": req.AmountKobo,
		})
		return
	}

	settlementType := "RTGS"
	if req.AmountKobo <= 500000000 { // <= 5M NGN
		settlementType = "NIP"
	}

	transferID := fmt.Sprintf("NIP-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:22]

	tx, err := app.db.Begin()
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "transaction start failed"})
		return
	}

	_, err = tx.Exec(`UPDATE nostro_positions SET balance_kobo = balance_kobo - $1, last_updated = NOW() WHERE bank_code = $2`, req.AmountKobo, req.SourceBank)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "debit failed"})
		return
	}
	_, err = tx.Exec(`UPDATE nostro_positions SET balance_kobo = balance_kobo + $1, last_updated = NOW() WHERE bank_code = $2`, req.AmountKobo, req.DestBank)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "credit failed"})
		return
	}
	_, err = tx.Exec(`INSERT INTO nip_transfers (transfer_id, source_bank, dest_bank, amount_kobo, session_id, payment_ref, narration_code, status, settlement_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'settled', $8)`,
		transferID, req.SourceBank, req.DestBank, req.AmountKobo, req.SessionID, req.PaymentRef, req.NarrationCode, settlementType)
	if err != nil {
		tx.Rollback()
		respondJSON(w, 500, map[string]string{"error": "transfer record failed"})
		return
	}

	if err := tx.Commit(); err != nil {
		respondJSON(w, 500, map[string]string{"error": "commit failed"})
		return
	}

	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": transferID, "status": "settled",
		"settlement_type": settlementType,
		"amount_kobo":     req.AmountKobo,
	})
}

func getPositions(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT position_id, bank_code, bank_name, balance_kobo, currency, max_limit_kobo, min_limit_kobo, last_updated FROM nostro_positions ORDER BY bank_code`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	positions := make([]NostroPosition, 0)
	var totalKobo int64
	for rows.Next() {
		var p NostroPosition
		if err := rows.Scan(&p.PositionID, &p.BankCode, &p.BankName, &p.BalanceKobo, &p.Currency, &p.MaxLimitKobo, &p.MinLimitKobo, &p.LastUpdated); err != nil {
			continue
		}
		positions = append(positions, p)
		totalKobo += p.BalanceKobo
	}

	breaches := make([]map[string]interface{}, 0)
	for _, p := range positions {
		if p.BalanceKobo < p.MinLimitKobo {
			breaches = append(breaches, map[string]interface{}{
				"bank_code": p.BankCode, "type": "BELOW_MINIMUM",
				"balance_kobo": p.BalanceKobo, "limit_kobo": p.MinLimitKobo,
			})
		}
	}

	respondJSON(w, 200, map[string]interface{}{
		"positions": positions, "total_nostro_kobo": totalKobo,
		"limit_breaches": breaches,
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
		"settlement_types": []string{"RTGS", "NIP", "DNS"},
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "settlement-clearing-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "settlement-clearing-go")
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
	port := os.Getenv("PORT")
	if port == "" {
		port = "9048"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/settlement/transfer", processTransfer)
	mux.HandleFunc("/api/v1/settlement/positions", getPositions)
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
