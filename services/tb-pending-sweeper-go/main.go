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
	sweepInterval  = 30 * time.Second
	defaultTimeout = 5 * time.Minute
)

// TB ACCOUNT/LEDGER MAPPING (C3-P0-B1): pending transfers are REAL
// TigerBeetle PENDING transfers on the NGN main ledger (id 1, shared with the
// core ledger services). Debit/credit platform account identifiers map to
// deterministic TB account ids via the shared "54bank/ledger/account/"
// namespace (same mapping as the other repatriated services), so the pending
// hold is enforced by the cluster, not by process memory. Transfer ids are
// deterministic (detID of the caller's transfer_id) ⇒ register/resolve/sweep
// are all idempotent. PG (tb_pending_transfers / tb_sweep_results) is the
// query + audit projection only.
const tbSweeperLedgerID uint32 = 1

// detID derives a deterministic TB Uint128 from a human-meaningful key
// (SHA-256, first 128 bits) ⇒ idempotent retries.
func detID(key string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte(key))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// pendingTBID is the deterministic TB id of the PENDING transfer for a
// caller-supplied transfer_id.
func pendingTBID(transferID string) tbclient.Uint128 {
	return detID("tb-pending-sweeper-go/pending/" + transferID)
}

// platformAccountTBID maps a platform account identifier to its TB account
// id (canonical shared namespace).
func platformAccountTBID(accountID string) tbclient.Uint128 {
	return detID("54bank/ledger/account/" + accountID)
}

// ensureSweepAccount idempotently creates a TB account (AccountExists
// tolerated). debit=true accounts carry DEBITS_MUST_NOT_EXCEED_CREDITS so the
// hold can never overdraw the account at the ledger level.
func ensureSweepAccount(ctx context.Context, accountID string, debit bool) (tbclient.Uint128, error) {
	tbID := platformAccountTBID(accountID)
	var flags uint16
	if debit {
		flags = tbclient.AccountFlags{DebitsMustNotExceedCredits: true}.ToUint16()
	}
	results, err := tbClient.CreateAccounts(ctx, []tbclient.Account{{ID: tbID, Ledger: tbSweeperLedgerID, Code: 1, Flags: flags}})
	if err != nil {
		return tbclient.Uint128{}, fmt.Errorf("tigerbeetle create account: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountCreated && r.Status != tbclient.AccountExists {
			return tbclient.Uint128{}, fmt.Errorf("tigerbeetle account rejected: status=%d", uint32(r.Status))
		}
	}
	return tbID, nil
}

// voidPendingTB voids a pending transfer at the cluster. Idempotent: the void
// transfer has a deterministic id (TransferExists tolerated) and the terminal
// pending-state rejections (already voided/posted/expired, not pending) are
// reported as the TB status so callers can converge their projection.
func voidPendingTB(ctx context.Context, transferID string, idemSuffix string) (uint32, error) {
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:        detID("tb-pending-sweeper-go/void/" + transferID + idemSuffix),
		PendingID: pendingTBID(transferID),
		Amount:    tbclient.ToUint128(0),
		Ledger:    tbSweeperLedgerID,
		Code:      1,
		Flags:     tbclient.TransferFlags{VoidPendingTransfer: true}.ToUint16(),
	}})
	if err != nil {
		return 0, fmt.Errorf("tigerbeetle void transfer: %w", err)
	}
	for _, r := range results {
		s := uint32(r.Status)
		if r.Status == tbclient.TransferCreated || r.Status == tbclient.TransferExists {
			return s, nil
		}
		return s, fmt.Errorf("tigerbeetle void rejected: status=%d", s)
	}
	return uint32(tbclient.TransferCreated), nil
}

// postPendingTB posts (commits) a pending transfer at the cluster. Idempotent
// via a deterministic post id.
func postPendingTB(ctx context.Context, transferID string) (uint32, error) {
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:        detID("tb-pending-sweeper-go/post/" + transferID),
		PendingID: pendingTBID(transferID),
		Amount:    tbclient.ToUint128(0),
		Ledger:    tbSweeperLedgerID,
		Code:      1,
		Flags:     tbclient.TransferFlags{PostPendingTransfer: true}.ToUint16(),
	}})
	if err != nil {
		return 0, fmt.Errorf("tigerbeetle post transfer: %w", err)
	}
	for _, r := range results {
		s := uint32(r.Status)
		if r.Status == tbclient.TransferCreated || r.Status == tbclient.TransferExists {
			return s, nil
		}
		return s, fmt.Errorf("tigerbeetle post rejected: status=%d", s)
	}
	return uint32(tbclient.TransferCreated), nil
}

// TB CreateTransferStatus values (tigerbeetle-go v0.17.0 enum) used to
// converge the PG projection when the cluster already resolved a transfer.
const (
	tbStatusPendingTransferNotFound      uint32 = 25
	tbStatusPendingTransferNotPending    uint32 = 26
	tbStatusPendingTransferAlreadyPosted uint32 = 33
	tbStatusPendingTransferAlreadyVoided uint32 = 34
	tbStatusPendingTransferExpired       uint32 = 35
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

// sweepExpired voids every expired PENDING transfer at the TigerBeetle
// cluster and records the outcome in the PG projection. The candidate set
// comes from the tb_pending_transfers projection (durable across restarts),
// NOT from process memory. TB is authoritative: terminal cluster states
// (already posted/voided/expired) converge the projection instead of being
// treated as failures.
func sweepExpired() int {
	if db == nil || tbClient == nil {
		return 0
	}
	now := time.Now()
	rows, err := db.Query(`SELECT transfer_id, created_at, timeout_secs
		FROM tb_pending_transfers WHERE status = 'pending'`)
	if err != nil {
		log.Printf("[sweeper] pending query failed: %v", err)
		return 0
	}
	type cand struct {
		id        string
		createdAt time.Time
		timeout   int
	}
	cands := []cand{}
	for rows.Next() {
		var c cand
		if err := rows.Scan(&c.id, &c.createdAt, &c.timeout); err == nil {
			cands = append(cands, c)
		}
	}
	rows.Close()

	swept := 0
	for _, c := range cands {
		timeout := time.Duration(c.timeout) * time.Second
		if timeout == 0 {
			timeout = defaultTimeout
		}
		age := now.Sub(c.createdAt)
		if age <= timeout {
			continue
		}
		// AUTHORITATIVE STEP: void the expired pending transfer at the
		// cluster (idempotent void id).
		status, verr := voidPendingTB(context.Background(), c.id, "")
		newStatus := "expired"
		action := "voided"
		if verr != nil {
			switch status {
			case tbStatusPendingTransferAlreadyPosted:
				newStatus, action = "posted", "already-posted"
			case tbStatusPendingTransferAlreadyVoided, tbStatusPendingTransferExpired, tbStatusPendingTransferNotPending, tbStatusPendingTransferNotFound:
				newStatus, action = "voided", "already-resolved"
			default:
				log.Printf("[sweeper] TB void failed for %s: %v", c.id, verr)
				continue
			}
		}
		// Projection updates after cluster confirmation.
		if _, err := db.Exec(`UPDATE tb_pending_transfers SET status = $1 WHERE transfer_id = $2 AND status = 'pending'`, newStatus, c.id); err != nil {
			log.Printf("[sweeper] projection status update failed for %s: %v", c.id, err)
		}
		if _, err := db.Exec(`INSERT INTO tb_sweep_results (swept_at, transfer_id, action, age_seconds) VALUES ($1, $2, $3, $4)`,
			now, c.id, action, age.Seconds()); err != nil {
			log.Printf("[sweeper] sweep audit insert failed for %s: %v", c.id, err)
		}
		log.Printf("[sweeper] %s expired transfer %s (age: %.0fs, timeout: %ds)", action, c.id, age.Seconds(), c.timeout)
		swept++
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
	if req.TransferID == "" || req.DebitAcct == "" || req.CreditAcct == "" {
		http.Error(w, `{"error":"transfer_id, debit_account_id and credit_account_id are required"}`, 400)
		return
	}
	if req.AmountKobo <= 0 {
		http.Error(w, `{"error":"amount_kobo must be positive"}`, 400)
		return
	}
	if req.TimeoutSecs == 0 {
		req.TimeoutSecs = 300
	}
	if db == nil || tbClient == nil {
		http.Error(w, `{"error":"store or ledger unavailable — pending transfer NOT registered"}`, 503)
		return
	}

	// AUTHORITATIVE LEDGER STEP (TigerBeetle) FIRST: create a REAL PENDING
	// transfer — the cluster holds the funds (debits_pending) and auto-expires
	// the hold after Timeout seconds. Deterministic id ⇒ TransferExists makes
	// a retried registration idempotent.
	debitTB, err := ensureSweepAccount(r.Context(), req.DebitAcct, true)
	if err != nil {
		log.Printf("[tb-pending-sweeper] debit account provisioning FAILED for %s: %v", req.TransferID, err)
		http.Error(w, `{"error":"ledger account provisioning failed — NOT registered"}`, 502)
		return
	}
	creditTB, err := ensureSweepAccount(r.Context(), req.CreditAcct, false)
	if err != nil {
		log.Printf("[tb-pending-sweeper] credit account provisioning FAILED for %s: %v", req.TransferID, err)
		http.Error(w, `{"error":"ledger account provisioning failed — NOT registered"}`, 502)
		return
	}
	tresults, err := tbClient.CreateTransfers(r.Context(), []tbclient.Transfer{{
		ID:              pendingTBID(req.TransferID),
		DebitAccountID:  debitTB,
		CreditAccountID: creditTB,
		Amount:          tbclient.ToUint128(uint64(req.AmountKobo)),
		Timeout:         uint32(req.TimeoutSecs),
		Ledger:          tbSweeperLedgerID,
		Code:            1,
		Flags:           tbclient.TransferFlags{Pending: true}.ToUint16(),
	}})
	if err != nil {
		log.Printf("[tb-pending-sweeper] TB pending transfer FAILED for %s: %v", req.TransferID, err)
		http.Error(w, `{"error":"ledger hold failed — NOT registered"}`, 502)
		return
	}
	for _, res := range tresults {
		if res.Status != tbclient.TransferCreated && res.Status != tbclient.TransferExists {
			http.Error(w, fmt.Sprintf(`{"error":"ledger hold rejected: status=%d"}`, uint32(res.Status)), 502)
			return
		}
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

	// PG projection (query + audit) after cluster confirmation. On failure,
	// compensate: void the hold we just created (idempotent "-REV" void id).
	if _, err := db.Exec(`INSERT INTO tb_pending_transfers (transfer_id, debit_account_id, credit_account_id, amount_kobo, created_at, timeout_secs, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		ON CONFLICT (transfer_id) DO NOTHING`,
		p.TransferID, p.DebitAcct, p.CreditAcct, p.AmountKobo, p.CreatedAt, p.TimeoutSecs); err != nil {
		if _, verr := voidPendingTB(context.Background(), req.TransferID, "-REV"); verr != nil {
			log.Printf("[tb-pending-sweeper] CRITICAL: compensation void FAILED for %s: %v — manual reconciliation required", req.TransferID, verr)
		} else {
			log.Printf("[tb-pending-sweeper] compensation void posted for %s (projection insert failed)", req.TransferID)
		}
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
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
	if req.Action != "post" && req.Action != "void" {
		http.Error(w, `{"error":"action must be post or void"}`, 400)
		return
	}
	if db == nil || tbClient == nil {
		http.Error(w, `{"error":"store or ledger unavailable — resolution NOT performed"}`, 503)
		return
	}

	// Current state comes from the durable projection, never process memory.
	var current string
	err := db.QueryRowContext(r.Context(), `SELECT status FROM tb_pending_transfers WHERE transfer_id = $1`, req.TransferID).Scan(&current)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"transfer not found"}`, 404)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}
	if current != "pending" {
		http.Error(w, fmt.Sprintf(`{"error":"transfer already %s"}`, current), 409)
		return
	}

	// AUTHORITATIVE STEP (TigerBeetle): post or void the pending transfer at
	// the cluster. Deterministic ids make retries idempotent; terminal-state
	// rejections mean the cluster already resolved it (converge, don't fail).
	newStatus := req.Action + "ed"
	var tbStatus uint32
	if req.Action == "post" {
		tbStatus, err = postPendingTB(r.Context(), req.TransferID)
	} else {
		tbStatus, err = voidPendingTB(r.Context(), req.TransferID, "")
	}
	if err != nil {
		switch tbStatus {
		case tbStatusPendingTransferAlreadyPosted:
			newStatus = "posted"
		case tbStatusPendingTransferAlreadyVoided, tbStatusPendingTransferExpired, tbStatusPendingTransferNotPending:
			newStatus = "voided"
		default:
			log.Printf("[tb-pending-sweeper] TB %s FAILED for %s: %v", req.Action, req.TransferID, err)
			http.Error(w, `{"error":"ledger resolution failed — NOT resolved"}`, 502)
			return
		}
	}

	// Projection update after cluster confirmation. If it fails, TB remains
	// authoritative: the sweeper converges terminal states on its next pass.
	if _, err := db.Exec(`UPDATE tb_pending_transfers SET status = $1 WHERE transfer_id = $2 AND status = 'pending'`, newStatus, req.TransferID); err != nil {
		log.Printf("[tb-pending-sweeper] CRITICAL: projection update FAILED after TB %s for %s: %v — sweeper will converge", req.Action, req.TransferID, err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer_id": req.TransferID, "status": newStatus})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		http.Error(w, `{"error":"projection store unavailable"}`, 503)
		return
	}
	counts := map[string]int{"pending": 0, "expired": 0, "posted": 0, "voided": 0}
	rows, err := db.QueryContext(r.Context(), `SELECT status, COUNT(*) FROM tb_pending_transfers GROUP BY status`)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
		return
	}
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err == nil {
			counts[s] = n
		}
	}
	rows.Close()
	totalSweeps := 0
	db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM tb_sweep_results`).Scan(&totalSweeps)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pending": counts["pending"], "expired": counts["expired"], "posted": counts["posted"], "voided": counts["voided"],
		"sweep_interval_secs":  sweepInterval.Seconds(),
		"default_timeout_secs": defaultTimeout.Seconds(),
		"total_sweeps":         totalSweeps,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-pending-sweeper-go"}`))
}

func initTBClient() {
	var cfg tbclient.Config
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-pending-sweeper] TB client init failed (register/resolve/sweep fail closed): %v", err)
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

	ctx, cancel := context.WithCancel(context.Background())
	go sweepLoop(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-sweeper/register", permifyAuthzGuard("sweep", "register", registerPendingHandler))
	mux.HandleFunc("/v1/tb-sweeper/resolve", permifyAuthzGuard("sweep", "resolve", resolvePendingHandler))
	mux.HandleFunc("/v1/tb-sweeper/status", statusHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8301"
	}

	server := &http.Server{
		Addr: ":" + port, Handler: jwtAuthMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

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
