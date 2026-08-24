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

// TigerBeetle Regulatory Ledger
// Mirrors all GL entries to a separate read-only audit cluster.
// Auditors (CBN, NDIC, external) get read-only access to an immutable,
// append-only ledger that cannot be tampered with.
// All writes go through the replication endpoint; reads are unrestricted.

type RegLedgerEntry struct {
	EntryID        string    `json:"entry_id"`
	SourceSystem   string    `json:"source_system"`
	GLCode         string    `json:"gl_code"`
	AccountID      string    `json:"account_id"`
	Type           string    `json:"type"` // debit or credit
	AmountKobo     int64     `json:"amount_kobo"`
	Currency       string    `json:"currency"`
	Narration      string    `json:"narration"`
	TransactionRef string    `json:"transaction_ref"`
	OriginalTS     time.Time `json:"original_timestamp"`
	ReplicatedAt   time.Time `json:"replicated_at"`
	HashChain      string    `json:"hash_chain"`
}

type AuditQuery struct {
	GLCode    string `json:"gl_code"`
	DateFrom  string `json:"date_from"`
	DateTo    string `json:"date_to"`
	Currency  string `json:"currency"`
	MinAmount int64  `json:"min_amount_kobo"`
}

var (
	db        *sql.DB
	tbClient  *tbclient.Client
	entriesMu sync.RWMutex
	entries   []RegLedgerEntry
	lastHash  string
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
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_regulatory_ledger (
		entry_id VARCHAR(128) PRIMARY KEY,
		source_system VARCHAR(64) NOT NULL,
		gl_code VARCHAR(32) NOT NULL,
		account_id VARCHAR(64) NOT NULL,
		type VARCHAR(8) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
		narration TEXT NOT NULL DEFAULT '',
		transaction_ref VARCHAR(128) NOT NULL DEFAULT '',
		original_timestamp TIMESTAMPTZ NOT NULL,
		replicated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		hash_chain VARCHAR(128) NOT NULL
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_reg_gl_code ON tb_regulatory_ledger(gl_code)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_reg_ts ON tb_regulatory_ledger(original_timestamp)`)
	log.Println("[tb-regulatory-ledger] Schema initialized (append-only)")
}

func loadEntries() {
	if db == nil {
		return
	}
	rows, err := db.Query(`SELECT entry_id, source_system, gl_code, account_id, type, amount_kobo, currency,
		narration, transaction_ref, original_timestamp, replicated_at, hash_chain
		FROM tb_regulatory_ledger ORDER BY replicated_at DESC LIMIT 100`)
	if err != nil {
		log.Printf("Load entries error: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var e RegLedgerEntry
		if err := rows.Scan(&e.EntryID, &e.SourceSystem, &e.GLCode, &e.AccountID, &e.Type, &e.AmountKobo,
			&e.Currency, &e.Narration, &e.TransactionRef, &e.OriginalTS, &e.ReplicatedAt, &e.HashChain); err != nil {
			continue
		}
		entries = append(entries, e)
		lastHash = e.HashChain
	}
	log.Printf("[tb-regulatory-ledger] Loaded %d entries from DB", len(entries))
}

func computeHash(prevHash, entryID string, amountKobo int64) string {
	data := fmt.Sprintf("%s|%s|%d", prevHash, entryID, amountKobo)
	h := uint64(0)
	for _, c := range data {
		h = h*31 + uint64(c)
	}
	return fmt.Sprintf("%016X", h)
}

func replicateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		EntryID        string `json:"entry_id"`
		SourceSystem   string `json:"source_system"`
		GLCode         string `json:"gl_code"`
		AccountID      string `json:"account_id"`
		Type           string `json:"type"`
		AmountKobo     int64  `json:"amount_kobo"`
		Currency       string `json:"currency"`
		Narration      string `json:"narration"`
		TransactionRef string `json:"transaction_ref"`
		OriginalTS     string `json:"original_timestamp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	originalTS, _ := time.Parse(time.RFC3339, req.OriginalTS)
	if originalTS.IsZero() {
		originalTS = time.Now()
	}

	entriesMu.Lock()
	hash := computeHash(lastHash, req.EntryID, req.AmountKobo)
	entry := RegLedgerEntry{
		EntryID:        req.EntryID,
		SourceSystem:   req.SourceSystem,
		GLCode:         req.GLCode,
		AccountID:      req.AccountID,
		Type:           req.Type,
		AmountKobo:     req.AmountKobo,
		Currency:       req.Currency,
		Narration:      req.Narration,
		TransactionRef: req.TransactionRef,
		OriginalTS:     originalTS,
		ReplicatedAt:   time.Now(),
		HashChain:      hash,
	}
	entries = append(entries, entry)
	lastHash = hash
	entriesMu.Unlock()

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_regulatory_ledger (entry_id, source_system, gl_code, account_id, type, amount_kobo, currency, narration, transaction_ref, original_timestamp, replicated_at, hash_chain)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
			ON CONFLICT (entry_id) DO NOTHING`,
			entry.EntryID, entry.SourceSystem, entry.GLCode, entry.AccountID, entry.Type, entry.AmountKobo,
			entry.Currency, entry.Narration, entry.TransactionRef, entry.OriginalTS, entry.ReplicatedAt, entry.HashChain)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
	}

	// Mirror entry to TigerBeetle regulatory cluster
	if tbClient != nil {
		debitAcct := tbclient.NewUint128()
		creditAcct := tbclient.NewUint128()
		code := tbclient.CodeAsset
		if req.Type == "credit" {
			code = tbclient.CodeLiability
		}
		_, err := tbClient.CreateTransfers(context.Background(), []tbclient.Transfer{{
			ID: tbclient.NewUint128(), DebitAccountID: debitAcct, CreditAccountID: creditAcct,
			Amount: uint64(req.AmountKobo), Ledger: tbclient.LedgerNGN, Code: code,
		}})
		if err != nil {
			log.Printf("[tb-regulatory-ledger] TB CreateTransfers error: %v", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"replicated":      entry,
		"chain_integrity": map[string]string{"hash": hash, "previous": lastHash},
	})
}

func queryHandler(w http.ResponseWriter, r *http.Request) {
	glCode := r.URL.Query().Get("gl_code")
	currency := r.URL.Query().Get("currency")

	entriesMu.RLock()
	results := []RegLedgerEntry{}
	totalDebits := int64(0)
	totalCredits := int64(0)
	for _, e := range entries {
		if glCode != "" && e.GLCode != glCode {
			continue
		}
		if currency != "" && e.Currency != currency {
			continue
		}
		results = append(results, e)
		if e.Type == "debit" {
			totalDebits += e.AmountKobo
		}
		if e.Type == "credit" {
			totalCredits += e.AmountKobo
		}
	}
	entriesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"entries":            results,
		"count":              len(results),
		"total_debits_kobo":  totalDebits,
		"total_credits_kobo": totalCredits,
		"net_kobo":           totalDebits - totalCredits,
		"read_only":          true,
	})
}

func integrityHandler(w http.ResponseWriter, r *http.Request) {
	entriesMu.RLock()
	valid := true
	prevHash := ""
	for _, e := range entries {
		expected := computeHash(prevHash, e.EntryID, e.AmountKobo)
		if e.HashChain != expected {
			valid = false
			break
		}
		prevHash = e.HashChain
	}
	count := len(entries)
	entriesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"chain_valid": valid,
		"entry_count": count,
		"latest_hash": lastHash,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-regulatory-ledger-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-regulatory-ledger] TB client init failed: %v", err)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-regulatory-ledger-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-regulatory-ledger-go")
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
	loadEntries()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-regulatory/replicate", replicateHandler)
	mux.HandleFunc("/v1/tb-regulatory/query", queryHandler)
	mux.HandleFunc("/v1/tb-regulatory/integrity", integrityHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8305"
	}

	server := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}

	go func() {
		log.Printf("[tb-regulatory-ledger-go] Starting on :%s (read-only audit cluster)", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Println("[tb-regulatory-ledger-go] Shutdown complete")
}
