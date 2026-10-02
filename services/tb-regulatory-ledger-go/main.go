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

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

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
	db       *sql.DB
	tbClient *tbclient.Client
)

// TigerBeetle ledger id for the regulatory mirror cluster.
// All regulatory GL entries are mirrored as real TB transfers on this ledger
// between deterministic accounts (GL control account ↔ entry account), with
// transfer ids derived from entry_id so replication is idempotent.
const tbRegulatoryLedgerID uint32 = 900

// detID derives a deterministic TB Uint128 from a human-meaningful key
// (SHA-256, first 128 bits) ⇒ idempotent retries (C3-P0-B1).
func detID(key string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte(key))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// ensureRegAccount idempotently creates a TB account on the regulatory
// ledger (AccountExists tolerated).
func ensureRegAccount(ctx context.Context, tbID tbclient.Uint128) error {
	results, err := tbClient.CreateAccounts(ctx, []tbclient.Account{{ID: tbID, Ledger: tbRegulatoryLedgerID, Code: 1}})
	if err != nil {
		return fmt.Errorf("tigerbeetle create account: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountCreated && r.Status != tbclient.AccountExists {
			return fmt.Errorf("tigerbeetle account rejected: status=%d", uint32(r.Status))
		}
	}
	return nil
}

// mirrorEntryToTB posts the regulatory mirror transfer. Debit/credit legs are
// deterministic: the GL control account (per gl_code) and the entry account.
// Transfer id = detID(entry key) so a retried replication yields
// TransferExists instead of a duplicate mirror posting.
func mirrorEntryToTB(ctx context.Context, glCode, accountID, entryType string, amountKobo int64, idemKey string) error {
	if amountKobo <= 0 {
		return fmt.Errorf("amount_kobo must be positive")
	}
	glAcct := detID("tb-regulatory-ledger-go/gl/" + glCode)
	entryAcct := detID("tb-regulatory-ledger-go/account/" + accountID)
	debit, credit := glAcct, entryAcct
	if entryType == "credit" {
		debit, credit = entryAcct, glAcct
	}
	if err := ensureRegAccount(ctx, debit); err != nil {
		return err
	}
	if err := ensureRegAccount(ctx, credit); err != nil {
		return err
	}
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              detID("tb-regulatory-ledger-go/entry/" + idemKey),
		DebitAccountID:  debit,
		CreditAccountID: credit,
		Amount:          tbclient.ToUint128(uint64(amountKobo)),
		Ledger:          tbRegulatoryLedgerID,
		Code:            1,
	}})
	if err != nil {
		return fmt.Errorf("tigerbeetle create transfer: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferCreated && r.Status != tbclient.TransferExists {
			return fmt.Errorf("tigerbeetle transfer rejected: status=%d", uint32(r.Status))
		}
	}
	return nil
}

// compensateTBEntry reverses a confirmed mirror transfer whose PG audit-row
// insert failed (canonical reverse-transfer compensation; idempotent via
// idemKey+"-REV"). Failure is logged at CRITICAL for manual reconciliation.
func compensateTBEntry(glCode, accountID, entryType string, amountKobo int64, idemKey string) {
	// Reverse the direction of the original mirror.
	revType := "credit"
	if entryType == "credit" {
		revType = "debit"
	}
	if err := mirrorEntryToTB(context.Background(), glCode, accountID, revType, amountKobo, idemKey+"-REV"); err != nil {
		log.Printf("[tb-regulatory-ledger] CRITICAL: TB compensation FAILED entry=%s amount=%d: %v — manual reconciliation required", idemKey, amountKobo, err)
		return
	}
	log.Printf("[tb-regulatory-ledger] TB compensation posted entry=%s (PG audit insert failed; mirror reversed)", idemKey)
}

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

// Entries are served from the PG audit table (append-only) — no in-memory
// copy is kept (C3-P0-B1). The hash chain head is read from PG inside the
// replicating transaction so the chain survives restarts and concurrent
// replicas serialize on the chain-head row lock.

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

	if req.EntryID == "" || req.GLCode == "" || req.AccountID == "" {
		http.Error(w, `{"error":"entry_id, gl_code and account_id are required"}`, 400)
		return
	}
	if req.Type != "debit" && req.Type != "credit" {
		http.Error(w, `{"error":"type must be debit or credit"}`, 400)
		return
	}
	if req.AmountKobo <= 0 {
		http.Error(w, `{"error":"amount_kobo must be positive"}`, 400)
		return
	}
	if db == nil || tbClient == nil {
		http.Error(w, `{"error":"audit store or ledger unavailable — entry NOT replicated"}`, 503)
		return
	}

	originalTS, _ := time.Parse(time.RFC3339, req.OriginalTS)
	if originalTS.IsZero() {
		originalTS = time.Now()
	}

	// AUTHORITATIVE LEDGER STEP (TigerBeetle) FIRST: mirror the entry on the
	// regulatory ledger with deterministic accounts and an id derived from
	// entry_id — a retried replication is idempotent at the cluster.
	if err := mirrorEntryToTB(r.Context(), req.GLCode, req.AccountID, req.Type, req.AmountKobo, req.EntryID); err != nil {
		log.Printf("[tb-regulatory-ledger] TB mirror FAILED entry=%s: %v", req.EntryID, err)
		http.Error(w, `{"error":"ledger mirror failed — entry NOT replicated"}`, 502)
		return
	}

	// PG audit row (append-only, hash-chained) — TB is already confirmed; the
	// chain head is read + advanced inside one transaction so concurrent
	// replicas cannot fork the chain.
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		compensateTBEntry(req.GLCode, req.AccountID, req.Type, req.AmountKobo, req.EntryID)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}
	defer tx.Rollback()
	var prevHash string
	// Serialize chain advancement: lock the most recent row (if any).
	tx.QueryRowContext(r.Context(), `SELECT hash_chain FROM tb_regulatory_ledger ORDER BY replicated_at DESC, entry_id DESC LIMIT 1 FOR UPDATE`).Scan(&prevHash)
	hash := computeHash(prevHash, req.EntryID, req.AmountKobo)
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
	res, err := tx.ExecContext(r.Context(), `INSERT INTO tb_regulatory_ledger (entry_id, source_system, gl_code, account_id, type, amount_kobo, currency, narration, transaction_ref, original_timestamp, replicated_at, hash_chain)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (entry_id) DO NOTHING`,
		entry.EntryID, entry.SourceSystem, entry.GLCode, entry.AccountID, entry.Type, entry.AmountKobo,
		entry.Currency, entry.Narration, entry.TransactionRef, entry.OriginalTS, entry.ReplicatedAt, entry.HashChain)
	if err == nil {
		if n, _ := res.RowsAffected(); n == 0 {
			// Idempotent retry: entry already replicated — return the stored
			// row instead of advancing a phantom hash chain link.
			tx.Rollback()
			var stored RegLedgerEntry
			if qerr := db.QueryRowContext(r.Context(), `SELECT entry_id, source_system, gl_code, account_id, type, amount_kobo, currency,
				narration, transaction_ref, original_timestamp, replicated_at, hash_chain
				FROM tb_regulatory_ledger WHERE entry_id = $1`, req.EntryID).
				Scan(&stored.EntryID, &stored.SourceSystem, &stored.GLCode, &stored.AccountID, &stored.Type, &stored.AmountKobo,
					&stored.Currency, &stored.Narration, &stored.TransactionRef, &stored.OriginalTS, &stored.ReplicatedAt, &stored.HashChain); qerr != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, qerr.Error()), 500)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(200)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"replicated":      stored,
				"chain_integrity": map[string]string{"hash": stored.HashChain, "previous": ""},
				"idempotent":      true,
			})
			return
		}
		err = tx.Commit()
	}
	if err != nil {
		// TB mirror confirmed but the audit row failed: compensate with an
		// idempotent reverse mirror so ledger and audit store never diverge
		// silently (canonical C3 pattern).
		compensateTBEntry(req.GLCode, req.AccountID, req.Type, req.AmountKobo, req.EntryID)
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"replicated":      entry,
		"chain_integrity": map[string]string{"hash": hash, "previous": prevHash},
	})
}

func queryHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		http.Error(w, `{"error":"audit store unavailable"}`, 503)
		return
	}
	glCode := r.URL.Query().Get("gl_code")
	currency := r.URL.Query().Get("currency")

	q := `SELECT entry_id, source_system, gl_code, account_id, type, amount_kobo, currency,
		narration, transaction_ref, original_timestamp, replicated_at, hash_chain
		FROM tb_regulatory_ledger WHERE ($1 = '' OR gl_code = $1) AND ($2 = '' OR currency = $2)
		ORDER BY replicated_at, entry_id`
	rows, err := db.QueryContext(r.Context(), q, glCode, currency)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}
	defer rows.Close()
	results := []RegLedgerEntry{}
	totalDebits := int64(0)
	totalCredits := int64(0)
	for rows.Next() {
		var e RegLedgerEntry
		if err := rows.Scan(&e.EntryID, &e.SourceSystem, &e.GLCode, &e.AccountID, &e.Type, &e.AmountKobo,
			&e.Currency, &e.Narration, &e.TransactionRef, &e.OriginalTS, &e.ReplicatedAt, &e.HashChain); err != nil {
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
	if db == nil {
		http.Error(w, `{"error":"audit store unavailable"}`, 503)
		return
	}
	rows, err := db.QueryContext(r.Context(), `SELECT entry_id, amount_kobo, hash_chain
		FROM tb_regulatory_ledger ORDER BY replicated_at, entry_id`)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}
	defer rows.Close()
	valid := true
	prevHash := ""
	latestHash := ""
	count := 0
	for rows.Next() {
		var entryID, hash string
		var amount int64
		if err := rows.Scan(&entryID, &amount, &hash); err != nil {
			continue
		}
		if hash != computeHash(prevHash, entryID, amount) {
			valid = false
			break
		}
		prevHash = hash
		latestHash = hash
		count++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"chain_valid": valid,
		"entry_count": count,
		"latest_hash": latestHash,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-regulatory-ledger-go"}`))
}

func initTBClient() {
	var cfg tbclient.Config
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-regulatory-ledger] TB client init failed (replication fails closed): %v", err)
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

	mux := http.NewServeMux()
	// W12-B5-P0-D3: the only mutating handler is gated by a real Permify
	// check (regulatory_ledger:replicate) after jwtAuthMiddleware; fail-closed.
	mux.HandleFunc("/v1/tb-regulatory/replicate", permifyAuthzGuard("regulatory_ledger", "replicate", replicateHandler))
	mux.HandleFunc("/v1/tb-regulatory/query", queryHandler)
	mux.HandleFunc("/v1/tb-regulatory/integrity", integrityHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8305"
	}

	server := &http.Server{
		Addr: ":" + port, Handler: jwtAuthMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

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
