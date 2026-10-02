// 54link-dev NIBSS/NIP Integration Engine — Go
// NIP Instant Payment processing (TSQ, nameEnquiry, fundsTransfer) against
// the real NIBSS endpoint, plus direct-debit mandate bookkeeping and
// response-code reference data.
//
// Fail-fast guarantee: funds transfers and name enquiries are proxied to
// the real NIBSS NIP endpoint (NIBSS_BASE_URL). When NIBSS is not
// configured or unreachable, handlers return HTTP 503 with
// ResponseCode "96" (system malfunction) and Status "failed" — a transfer
// is NEVER reported successful without a real NIBSS approval, and a name
// is NEVER fabricated.
package main

import (
	"bytes"
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
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"shared/otel/go/otelkit"
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

// ═══════════════════════════════════════════════════════════════════════════════
// ISO 8583 MESSAGE STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

type ISO8583Message struct {
	MTI            string            `json:"mti"`
	PrimaryBitmap  string            `json:"primaryBitmap"`
	Fields         map[string]string `json:"fields"`
	ProcessingCode string            `json:"processingCode"`
	Amount         int64             `json:"amount"`
	STAN           string            `json:"stan"`
	RRN            string            `json:"rrn"`
	ResponseCode   string            `json:"responseCode,omitempty"`
	CreatedAt      string            `json:"createdAt"`
}

type NIPTransaction struct {
	ID              string `json:"id"`
	SessionID       string `json:"sessionId"`
	Type            string `json:"type"` // nameEnquiry | fundsTransfer | tsq
	SourceBank      string `json:"sourceBank"`
	SourceBankCode  string `json:"sourceBankCode"`
	SourceAccount   string `json:"sourceAccount"`
	DestBank        string `json:"destinationBank"`
	DestBankCode    string `json:"destinationBankCode"`
	DestAccount     string `json:"destinationAccount"`
	BeneficiaryName string `json:"beneficiaryName"`
	Amount          int64  `json:"amountKobo"`
	Narration       string `json:"narration"`
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	Status          string `json:"status"` // initiated | processing | successful | failed | reversed
	ChannelCode     string `json:"channelCode"`
	MTI             string `json:"mti"`
	CreatedAt       string `json:"createdAt"`
	CompletedAt     string `json:"completedAt,omitempty"`
}

type DirectDebitMandate struct {
	ID              string `json:"id"`
	MandateRef      string `json:"mandateReference"`
	DebtorAccount   string `json:"debtorAccount"`
	DebtorBank      string `json:"debtorBank"`
	DebtorBankCode  string `json:"debtorBankCode"`
	DebtorName      string `json:"debtorName"`
	CreditorAccount string `json:"creditorAccount"`
	CreditorBank    string `json:"creditorBank"`
	CreditorName    string `json:"creditorName"`
	Amount          int64  `json:"amountKobo"`
	Frequency       string `json:"frequency"` // one_time | daily | weekly | monthly | quarterly
	StartDate       string `json:"startDate"`
	EndDate         string `json:"endDate"`
	Status          string `json:"status"` // created | pending_approval | approved | active | suspended | cancelled | expired
	LastExecution   string `json:"lastExecutionDate,omitempty"`
	NextExecution   string `json:"nextExecutionDate,omitempty"`
	ExecutionCount  int    `json:"executionCount"`
	CreatedAt       string `json:"createdAt"`
}

type NIBSSResponseCode struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Action      string `json:"action"`
}

type SettlementReport struct {
	ID             string `json:"id"`
	Date           string `json:"settlementDate"`
	TotalCredits   int64  `json:"totalCreditsKobo"`
	TotalDebits    int64  `json:"totalDebitsKobo"`
	NetPosition    int64  `json:"netPositionKobo"`
	TxnCount       int    `json:"transactionCount"`
	Status         string `json:"status"` // pending | settled | disputed
	ReconcileMatch int    `json:"reconciledMatches"`
	Exceptions     int    `json:"exceptions"`
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE DATA (NIBSS response-code table — static standard, not fake state)
// ═══════════════════════════════════════════════════════════════════════════════

var responseCodes = []NIBSSResponseCode{
	{Code: "00", Description: "Approved or completed successfully", Action: "none"},
	{Code: "01", Description: "Status unknown, please wait", Action: "retry_after_30s"},
	{Code: "03", Description: "Invalid Sender", Action: "reject"},
	{Code: "05", Description: "Do not honor", Action: "reject"},
	{Code: "06", Description: "Dormant Account", Action: "reject"},
	{Code: "07", Description: "Invalid Account", Action: "reject"},
	{Code: "09", Description: "Request processing in progress", Action: "wait"},
	{Code: "12", Description: "Invalid transaction", Action: "reject"},
	{Code: "13", Description: "Invalid Amount", Action: "reject"},
	{Code: "14", Description: "Invalid Card Number", Action: "reject"},
	{Code: "25", Description: "Unable to locate record", Action: "retry"},
	{Code: "26", Description: "Duplicate record", Action: "idempotent_success"},
	{Code: "30", Description: "Format error", Action: "fix_message"},
	{Code: "34", Description: "Suspected fraud", Action: "escalate_to_fraud"},
	{Code: "35", Description: "Contact Card Acceptor", Action: "notify_merchant"},
	{Code: "51", Description: "Insufficient funds", Action: "reject"},
	{Code: "53", Description: "No savings account", Action: "reject"},
	{Code: "57", Description: "Transaction not permitted to sender", Action: "reject"},
	{Code: "58", Description: "Transaction not permitted on channel", Action: "reject"},
	{Code: "61", Description: "Transfer limit Exceeded", Action: "reject"},
	{Code: "63", Description: "Security violation", Action: "block_and_alert"},
	{Code: "65", Description: "Exceeds withdrawal frequency", Action: "reject"},
	{Code: "68", Description: "Response received too late", Action: "reversal"},
	{Code: "69", Description: "Unsuccessful Account/Amount block", Action: "reject"},
	{Code: "91", Description: "Beneficiary bank not available", Action: "retry_or_reverse"},
	{Code: "92", Description: "Routing error", Action: "retry"},
	{Code: "94", Description: "Duplicate transaction", Action: "idempotent_success"},
	{Code: "96", Description: "System malfunction", Action: "retry"},
}

// ── Persistence (wave-12 C3-P0-B7, payment-critical) ───────────────────────
// NIP transactions, direct-debit mandates and settlement reports are
// Postgres-authoritative. The in-memory slices were REMOVED — previously a
// restart wiped the transaction log, destroying idempotent-replay protection
// on funds transfers (double-payment risk). Idempotency is now enforced by
// the database, not by process memory:
//   - nip_transactions.session_id is UNIQUE; recordTransaction is an
//     INSERT ... ON CONFLICT (session_id) DO UPDATE ... RETURNING, so a
//     replayed/duplicated record converges to the stored row.
//   - mandates.mandate_ref is UNIQUE; mandate creation is
//     INSERT ... ON CONFLICT (mandate_ref) DO NOTHING followed by SELECT of
//     the stored row (idempotent create, replay flagged to the caller).
//   - settlement_reports.settlement_date is UNIQUE.
//
// Fail-closed: funds-transfer refuses (503) when PG is unavailable because
// replay protection cannot be guaranteed without the durable store.
var db *sql.DB

const nipDDL = `
CREATE SEQUENCE IF NOT EXISTS nip_txn_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS nip_mandate_id_seq START 1;
CREATE TABLE IF NOT EXISTS nip_transactions (
    id                text PRIMARY KEY,
    tenant_id         text NOT NULL DEFAULT '',
    session_id        text NOT NULL UNIQUE,
    type              text NOT NULL,
    source_bank       text NOT NULL DEFAULT '',
    source_bank_code  text NOT NULL DEFAULT '',
    source_account    text NOT NULL DEFAULT '',
    dest_bank         text NOT NULL DEFAULT '',
    dest_bank_code    text NOT NULL DEFAULT '',
    dest_account      text NOT NULL DEFAULT '',
    beneficiary_name  text NOT NULL DEFAULT '',
    amount_kobo       bigint NOT NULL DEFAULT 0,
    narration         text NOT NULL DEFAULT '',
    response_code     text NOT NULL DEFAULT '',
    response_message  text NOT NULL DEFAULT '',
    status            text NOT NULL,
    channel_code      text NOT NULL DEFAULT '',
    mti               text NOT NULL DEFAULT '',
    completed_at      text NOT NULL DEFAULT '',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nip_txn_status ON nip_transactions (status);
CREATE TABLE IF NOT EXISTS mandates (
    id               text PRIMARY KEY,
    tenant_id        text NOT NULL DEFAULT '',
    mandate_ref      text NOT NULL UNIQUE,
    debtor_account   text NOT NULL DEFAULT '',
    debtor_bank      text NOT NULL DEFAULT '',
    debtor_bank_code text NOT NULL DEFAULT '',
    debtor_name      text NOT NULL DEFAULT '',
    creditor_account text NOT NULL DEFAULT '',
    creditor_bank    text NOT NULL DEFAULT '',
    creditor_name    text NOT NULL DEFAULT '',
    amount_kobo      bigint NOT NULL DEFAULT 0,
    frequency        text NOT NULL DEFAULT '',
    start_date       text NOT NULL DEFAULT '',
    end_date         text NOT NULL DEFAULT '',
    status           text NOT NULL DEFAULT 'created',
    last_execution   text NOT NULL DEFAULT '',
    next_execution   text NOT NULL DEFAULT '',
    execution_count  integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settlement_reports (
    id               text PRIMARY KEY,
    tenant_id        text NOT NULL DEFAULT '',
    settlement_date  text NOT NULL UNIQUE,
    total_credits    bigint NOT NULL DEFAULT 0,
    total_debits     bigint NOT NULL DEFAULT 0,
    net_position     bigint NOT NULL DEFAULT 0,
    txn_count        integer NOT NULL DEFAULT 0,
    status           text NOT NULL DEFAULT 'pending',
    reconcile_match  integer NOT NULL DEFAULT 0,
    exceptions       integer NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
`

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[nip] DATABASE_URL not set — funds-transfer fail-closed, lists fail-closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[nip] pg open failed: %v — fail-closed", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[nip] pg ping failed: %v — fail-closed", err)
		db = nil
		return
	}
	if _, err = db.Exec(nipDDL); err != nil {
		log.Fatalf("[nip] DDL failed: %v", err)
	}
	log.Printf("[nip] postgres authoritative store ready (nip_transactions, mandates, settlement_reports)")
}

const nipTxnCols = `id, session_id, type, source_bank, source_bank_code, source_account, dest_bank, dest_bank_code, dest_account, beneficiary_name, amount_kobo, narration, response_code, response_message, status, channel_code, mti, completed_at, created_at`

func scanNIPTxn(row interface{ Scan(...interface{}) error }) (NIPTransaction, error) {
	var t NIPTransaction
	var createdAt time.Time
	err := row.Scan(&t.ID, &t.SessionID, &t.Type, &t.SourceBank, &t.SourceBankCode, &t.SourceAccount,
		&t.DestBank, &t.DestBankCode, &t.DestAccount, &t.BeneficiaryName, &t.Amount, &t.Narration,
		&t.ResponseCode, &t.ResponseMessage, &t.Status, &t.ChannelCode, &t.MTI, &t.CompletedAt, &createdAt)
	t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return t, err
}

// recordTransaction durably records a NIBSS-processed attempt. The upsert on
// the UNIQUE session_id makes the write idempotent: a repeated record for the
// same session converges to (and returns) the stored row instead of
// duplicating the transaction log. Only real NIBSS-processed attempts are
// recorded (including failures). No fabricated history is seeded.
func recordTransaction(txn NIPTransaction) (NIPTransaction, error) {
	if db == nil {
		return txn, fmt.Errorf("postgres unavailable — transaction NOT recorded")
	}
	return scanNIPTxn(db.QueryRow(
		`INSERT INTO nip_transactions (id, session_id, type, source_bank, source_bank_code, source_account, dest_bank, dest_bank_code, dest_account, beneficiary_name, amount_kobo, narration, response_code, response_message, status, channel_code, mti, completed_at)
		 VALUES ('NIP-' || lpad(nextval('nip_txn_id_seq')::text, 6, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		 ON CONFLICT (session_id) DO UPDATE SET
		   response_code = EXCLUDED.response_code,
		   response_message = EXCLUDED.response_message,
		   beneficiary_name = EXCLUDED.beneficiary_name,
		   status = EXCLUDED.status,
		   completed_at = EXCLUDED.completed_at,
		   updated_at = now()
		 RETURNING `+nipTxnCols,
		txn.SessionID, txn.Type, txn.SourceBank, txn.SourceBankCode, txn.SourceAccount,
		txn.DestBank, txn.DestBankCode, txn.DestAccount, txn.BeneficiaryName, txn.Amount, txn.Narration,
		txn.ResponseCode, txn.ResponseMessage, txn.Status, txn.ChannelCode, txn.MTI, txn.CompletedAt))
}

// ═══════════════════════════════════════════════════════════════════════════════
// NIBSS NIP CLIENT (real HTTP adapter)
// ═══════════════════════════════════════════════════════════════════════════════

var errNIBSSNotConfigured = fmt.Errorf("NIBSS NIP endpoint not configured (set NIBSS_BASE_URL)")

type nibssClient struct {
	baseURL   string
	apiKey    string
	basicUser string
	basicPass string
	http      *http.Client
}

func newNIBSSClient() *nibssClient {
	timeout := 10 * time.Second
	if v := os.Getenv("NIBSS_TIMEOUT_SECS"); v != "" {
		if n, err := time.ParseDuration(v + "s"); err == nil && n > 0 {
			timeout = n
		}
	}
	return &nibssClient{
		baseURL:   os.Getenv("NIBSS_BASE_URL"),
		apiKey:    os.Getenv("NIBSS_API_KEY"),
		basicUser: os.Getenv("NIBSS_USERNAME"),
		basicPass: os.Getenv("NIBSS_PASSWORD"),
		http:      &http.Client{Timeout: timeout},
	}
}

var nibss = newNIBSSClient()

// nibssUpstreamResponse mirrors the NIBSS NIP JSON response shape.
type nibssUpstreamResponse struct {
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	SessionID       string `json:"sessionId"`
	BeneficiaryName string `json:"beneficiaryName"`
	AccountName     string `json:"accountName"`
	Status          string `json:"status"`
}

// call posts to the NIBSS NIP endpoint and decodes the response. Any
// transport error, non-2xx status, or undecodable body is an error — the
// caller must NOT treat the operation as successful.
func (c *nibssClient) call(path string, payload map[string]interface{}) (*nibssUpstreamResponse, error) {
	if c.baseURL == "" {
		return nil, errNIBSSNotConfigured
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("x-api-key", c.apiKey)
	}
	if c.basicUser != "" {
		req.SetBasicAuth(c.basicUser, c.basicPass)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIBSS call %s failed: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("NIBSS %s returned HTTP %d", path, resp.StatusCode)
	}
	var out nibssUpstreamResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("NIBSS %s response undecodable: %w", path, err)
	}
	return &out, nil
}

func nibssNameEnquiryPath() string {
	if v := os.Getenv("NIBSS_NAME_ENQUIRY_PATH"); v != "" {
		return v
	}
	return "/nip/name-enquiry"
}

func nibssFundsTransferPath() string {
	if v := os.Getenv("NIBSS_FUNDS_TRANSFER_PATH"); v != "" {
		return v
	}
	return "/nip/funds-transfer"
}

// ═══════════════════════════════════════════════════════════════════════════════
// JWT AUTHENTICATION (Keycloak JWKS / RS256, fail-closed)
// ═══════════════════════════════════════════════════════════════════════════════

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[auth] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[auth] JWKS fetch returned HTTP %d", resp.StatusCode)
		return
	}
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[auth] JWKS decode failed: %v", err)
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
	log.Printf("[auth] JWKS refreshed: %d keys", len(jwtCache.keys))
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

// verifyBearerToken performs full RS256 verification against the realm JWKS.
// Any verification problem (malformed token, unknown key, bad signature,
// missing/expired exp) is an error — the caller rejects with 401.
func verifyBearerToken(token string) (map[string]interface{}, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid token header encoding")
	}
	var header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
		return nil, fmt.Errorf("invalid token header")
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported token algorithm %q", header.Alg)
	}
	jwtCache.mu.RLock()
	pub, ok := jwtCache.keys[header.Kid]
	jwtCache.mu.RUnlock()
	if !ok {
		// Unknown key — refresh once (key rotation) and retry.
		fetchJWKS(jwtRealmURL())
		jwtCache.mu.RLock()
		pub, ok = jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			return nil, fmt.Errorf("unknown signing key")
		}
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding")
	}
	hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
		return nil, fmt.Errorf("invalid signature")
	}
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid claims encoding")
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, fmt.Errorf("invalid claims")
	}
	exp, ok := claims["exp"].(float64)
	if !ok {
		return nil, fmt.Errorf("token missing exp claim")
	}
	if time.Now().Unix() >= int64(exp) {
		return nil, fmt.Errorf("token expired")
	}
	return claims, nil
}

// jwtAuthMiddleware wraps money-path handlers with real JWT verification.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			respondJSON(w, 401, map[string]string{"error": "unauthorized", "detail": "missing bearer token"})
			return
		}
		claims, err := verifyBearerToken(strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			respondJSON(w, 401, map[string]string{"error": "unauthorized", "detail": err.Error()})
			return
		}
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
		}
		next.ServeHTTP(w, r)
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// sessionIDFromIdempotencyKey derives a deterministic 30-digit NIP session ID
// from the caller-supplied Idempotency-Key (sha256). Retries with the same
// key map to the same session ID instead of a fresh time-based ID.
func sessionIDFromIdempotencyKey(key string) string {
	sum := sha256.Sum256([]byte("54bank/nibss-nip/session/" + key))
	var digits [30]byte
	for i := range digits {
		digits[i] = '0' + sum[i]%(10)
	}
	return string(digits[:])
}

// findTransactionBySessionID returns a previously recorded transaction with
// the given session ID, if any (idempotent-replay detection), from Postgres.
func findTransactionBySessionID(sessionID string) (NIPTransaction, bool) {
	if db == nil {
		return NIPTransaction{}, false
	}
	txn, err := scanNIPTxn(db.QueryRow(`SELECT `+nipTxnCols+` FROM nip_transactions WHERE session_id = $1`, sessionID))
	if err != nil {
		return NIPTransaction{}, false
	}
	return txn, true
}

func newSessionID() string {
	return fmt.Sprintf("%026d", time.Now().UnixNano())
}

// nipFailure responds 503 with NIBSS response code 96 (system malfunction)
// and durably records the failed attempt. Nothing is reported successful.
func nipFailure(w http.ResponseWriter, txn NIPTransaction, cause error) {
	log.Printf("[nip] %s FAILED: %v", txn.Type, cause)
	txn.ResponseCode = "96"
	txn.ResponseMessage = "System malfunction"
	txn.Status = "failed"
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	stored, err := recordTransaction(txn)
	if err != nil {
		log.Printf("[nip] WARNING: failed attempt not persisted: %v", err)
	} else {
		txn = stored
	}
	respondJSON(w, http.StatusServiceUnavailable, txn)
}

func handleNameEnquiry(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		DestBankCode string `json:"destinationBankCode"`
		AccountNo    string `json:"accountNumber"`
		ChannelCode  string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.DestBankCode == "" || req.AccountNo == "" {
		respondJSON(w, 400, map[string]string{"error": "destinationBankCode and accountNumber are required", "responseCode": "30"})
		return
	}

	// When an Idempotency-Key is supplied, the session ID is derived from it
	// (sha256) and a replay returns the recorded enquiry result.
	sessionID := newSessionID()
	if key := strings.TrimSpace(r.Header.Get("Idempotency-Key")); key != "" {
		sessionID = sessionIDFromIdempotencyKey(key)
		if existing, ok := findTransactionBySessionID(sessionID); ok {
			w.Header().Set("X-Idempotent-Replayed", "true")
			respondJSON(w, 200, existing)
			return
		}
	}

	txn := NIPTransaction{
		SessionID: sessionID,
		Type:      "nameEnquiry", SourceBank: "54link-dev", SourceBankCode: "054",
		DestBankCode: req.DestBankCode, DestAccount: req.AccountNo,
		Status: "processing", ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	upstream, err := nibss.call(nibssNameEnquiryPath(), map[string]interface{}{
		"sessionId":           txn.SessionID,
		"destinationBankCode": req.DestBankCode,
		"accountNumber":       req.AccountNo,
		"channelCode":         req.ChannelCode,
	})
	if err != nil {
		nipFailure(w, txn, err)
		return
	}

	// Use ONLY the name resolved by NIBSS — never a placeholder.
	txn.ResponseCode = upstream.ResponseCode
	txn.ResponseMessage = upstream.ResponseMessage
	if upstream.SessionID != "" {
		txn.SessionID = upstream.SessionID
	}
	name := upstream.BeneficiaryName
	if name == "" {
		name = upstream.AccountName
	}
	txn.BeneficiaryName = name
	if upstream.ResponseCode == "00" && name != "" {
		txn.Status = "successful"
	} else if upstream.ResponseCode == "00" {
		// Approved code but no name — treat as failure rather than invent one.
		txn.ResponseCode = "25"
		txn.ResponseMessage = "Unable to locate record"
		txn.Status = "failed"
	} else {
		txn.Status = "failed"
	}
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	stored, rerr := recordTransaction(txn)
	if rerr != nil {
		log.Printf("[nip] WARNING: nameEnquiry result not persisted: %v", rerr)
	} else {
		txn = stored
	}

	status := 200
	if txn.Status != "successful" {
		status = 502
	}
	respondJSON(w, status, txn)
}

func handleFundsTransfer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		SourceAccount string `json:"sourceAccount"`
		DestBankCode  string `json:"destinationBankCode"`
		DestAccount   string `json:"destinationAccount"`
		Amount        int64  `json:"amountKobo"`
		Narration     string `json:"narration"`
		ChannelCode   string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.SourceAccount == "" || req.DestBankCode == "" || req.DestAccount == "" || req.Amount <= 0 {
		respondJSON(w, 400, map[string]string{"error": "sourceAccount, destinationBankCode, destinationAccount and a positive amountKobo are required", "responseCode": "30"})
		return
	}

	// A funds transfer is state-changing: it REQUIRES an Idempotency-Key.
	// The NIP session ID is derived from the key (sha256), so a client retry
	// (or a replayed request) collapses onto the same session ID and returns
	// the recorded outcome instead of executing a duplicate NIP transfer.
	// The dedup store is Postgres (UNIQUE session_id) — without it we cannot
	// guarantee replay protection across replicas/restarts, so we refuse.
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "idempotency store (postgres) unavailable — transfer refused", "responseCode": "96"})
		return
	}
	idempKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempKey == "" {
		respondJSON(w, 400, map[string]string{"error": "Idempotency-Key header is required for funds transfers", "responseCode": "30"})
		return
	}
	sessionID := sessionIDFromIdempotencyKey(idempKey)
	if existing, ok := findTransactionBySessionID(sessionID); ok {
		w.Header().Set("X-Idempotent-Replayed", "true")
		respondJSON(w, 200, existing)
		return
	}

	txn := NIPTransaction{
		SessionID: sessionID,
		Type:      "fundsTransfer", SourceBank: "54link-dev", SourceBankCode: "054",
		SourceAccount: req.SourceAccount, DestBankCode: req.DestBankCode,
		DestAccount: req.DestAccount, Amount: req.Amount, Narration: req.Narration,
		Status: "processing", ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	upstream, err := nibss.call(nibssFundsTransferPath(), map[string]interface{}{
		"sessionId":           txn.SessionID,
		"sourceAccount":       req.SourceAccount,
		"destinationBankCode": req.DestBankCode,
		"destinationAccount":  req.DestAccount,
		"amountKobo":          req.Amount,
		"narration":           req.Narration,
		"channelCode":         req.ChannelCode,
	})
	if err != nil {
		// No NIBSS call completed: no balance checked, no funds moved, and we
		// say exactly that (503 / 96 / failed).
		nipFailure(w, txn, err)
		return
	}

	txn.ResponseCode = upstream.ResponseCode
	txn.ResponseMessage = upstream.ResponseMessage
	if upstream.SessionID != "" {
		txn.SessionID = upstream.SessionID
	}
	if upstream.ResponseCode == "00" {
		txn.Status = "successful"
	} else {
		txn.Status = "failed"
	}
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	stored, rerr := recordTransaction(txn)
	if rerr != nil {
		// Payment-critical: an unrecorded funds transfer cannot be safely
		// replayed/deduplicated — report system malfunction, never success.
		log.Printf("[nip] CRITICAL: fundsTransfer result not persisted: %v", rerr)
		txn.ResponseCode = "96"
		txn.ResponseMessage = "System malfunction"
		txn.Status = "failed"
		respondJSON(w, 503, txn)
		return
	}
	txn = stored

	if txn.Status != "successful" {
		respondJSON(w, 502, txn)
		return
	}
	respondJSON(w, 200, txn)
}

func handleTSQ(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	if txn, ok := findTransactionBySessionID(sessionID); ok {
		respondJSON(w, 200, map[string]interface{}{"originalTransaction": txn, "tsqStatus": "found"})
		return
	}
	respondJSON(w, 404, map[string]string{"error": "Transaction not found", "responseCode": "25"})
}

const nipMandateCols = `id, mandate_ref, debtor_account, debtor_bank, debtor_bank_code, debtor_name, creditor_account, creditor_bank, creditor_name, amount_kobo, frequency, start_date, end_date, status, last_execution, next_execution, execution_count, created_at`

func scanMandate(row interface{ Scan(...interface{}) error }) (DirectDebitMandate, error) {
	var m DirectDebitMandate
	var createdAt time.Time
	err := row.Scan(&m.ID, &m.MandateRef, &m.DebtorAccount, &m.DebtorBank, &m.DebtorBankCode, &m.DebtorName,
		&m.CreditorAccount, &m.CreditorBank, &m.CreditorName, &m.Amount, &m.Frequency, &m.StartDate, &m.EndDate,
		&m.Status, &m.LastExecution, &m.NextExecution, &m.ExecutionCount, &createdAt)
	m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return m, err
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	if r.Method == "GET" {
		rows, err := db.Query(`SELECT ` + nipMandateCols + ` FROM mandates ORDER BY created_at, id`)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
			return
		}
		defer rows.Close()
		out := []DirectDebitMandate{}
		for rows.Next() {
			m, err := scanMandate(rows)
			if err != nil {
				respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
				return
			}
			out = append(out, m)
		}
		respondJSON(w, 200, map[string]interface{}{"mandates": out, "total": len(out), "source": "postgres"})
		return
	}
	// POST — create mandate, idempotent on the natural key mandate_ref
	// (UNIQUE constraint): a replayed create returns the STORED row with
	// X-Idempotent-Replayed instead of duplicating the mandate.
	var req DirectDebitMandate
	json.NewDecoder(r.Body).Decode(&req)
	if req.MandateRef == "" {
		req.MandateRef = fmt.Sprintf("DDMREF-%06d", time.Now().UnixNano())
	}
	var newID string
	err := db.QueryRow(
		`INSERT INTO mandates (id, mandate_ref, debtor_account, debtor_bank, debtor_bank_code, debtor_name, creditor_account, creditor_bank, creditor_name, amount_kobo, frequency, start_date, end_date, status, last_execution, next_execution, execution_count)
		 VALUES ('DDM-' || lpad(nextval('nip_mandate_id_seq')::text, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'created',$13,$14,$15)
		 ON CONFLICT (mandate_ref) DO NOTHING
		 RETURNING id`,
		req.MandateRef, req.DebtorAccount, req.DebtorBank, req.DebtorBankCode, req.DebtorName,
		req.CreditorAccount, req.CreditorBank, req.CreditorName, req.Amount, req.Frequency,
		req.StartDate, req.EndDate, req.LastExecution, req.NextExecution, req.ExecutionCount).Scan(&newID)
	if err == sql.ErrNoRows {
		// mandate_ref already existed — idempotent replay: return stored row.
		stored, serr := scanMandate(db.QueryRow(`SELECT `+nipMandateCols+` FROM mandates WHERE mandate_ref = $1`, req.MandateRef))
		if serr != nil {
			respondJSON(w, 500, map[string]string{"error": "replay fetch failed: " + serr.Error()})
			return
		}
		w.Header().Set("X-Idempotent-Replayed", "true")
		respondJSON(w, 200, stored)
		return
	}
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "persist failed: " + err.Error()})
		return
	}
	req.ID = newID
	req.Status = "created"
	req.CreatedAt = time.Now().Format(time.RFC3339)
	respondJSON(w, 201, req)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	rows, err := db.Query(`SELECT ` + nipTxnCols + ` FROM nip_transactions ORDER BY created_at, id`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	defer rows.Close()
	out := []NIPTransaction{}
	for rows.Next() {
		t, err := scanNIPTxn(rows)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
			return
		}
		out = append(out, t)
	}
	respondJSON(w, 200, map[string]interface{}{"transactions": out, "total": len(out), "source": "postgres"})
}

func handleSettlements(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	rows, err := db.Query(`SELECT id, settlement_date, total_credits, total_debits, net_position, txn_count, status, reconcile_match, exceptions FROM settlement_reports ORDER BY settlement_date`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	defer rows.Close()
	out := []SettlementReport{}
	for rows.Next() {
		var s SettlementReport
		if err := rows.Scan(&s.ID, &s.Date, &s.TotalCredits, &s.TotalDebits, &s.NetPosition, &s.TxnCount, &s.Status, &s.ReconcileMatch, &s.Exceptions); err != nil {
			respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
			return
		}
		out = append(out, s)
	}
	respondJSON(w, 200, map[string]interface{}{"settlements": out, "total": len(out), "source": "postgres"})
}

func handleResponseCodes(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"responseCodes": responseCodes, "total": len(responseCodes)})
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	nibssStatus := "configured"
	if nibss.baseURL == "" {
		nibssStatus = "not_configured"
	}
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "nibss-nip-engine-go", "version": "2.0.0",
		"protocol": "ISO_8583", "nipVersion": "2.0",
		"capabilities": []string{"nameEnquiry", "fundsTransfer", "tsq", "directDebit", "settlement"},
		"nibss":        nibssStatus,
		"middleware":   middlewareStatus(),
	})
}

// middlewareStatus reports what is actually configured (env presence), not
// fabricated "connected" states.
func middlewareStatus() map[string]string {
	cfg := func(env string) string {
		if os.Getenv(env) != "" {
			return "configured"
		}
		return "not_configured"
	}
	return map[string]string{
		"nibss":       cfg("NIBSS_BASE_URL"),
		"kafka":       cfg("KAFKA_BROKERS"),
		"postgres":    cfg("DATABASE_URL"),
		"redis":       cfg("REDIS_URL"),
		"tigerbeetle": cfg("TIGERBEETLE_ADDRESSES"),
	}
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	initDB()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8111"
	}
	shutdown, oerr := otelkit.Init(context.Background(), "nibss-nip-engine-go")
	if oerr != nil {
		log.Fatalf("otelkit init: %v", oerr)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if serr := shutdown(sctx); serr != nil {
			log.Printf("otelkit shutdown: %v", serr)
		}
	}()
	startJWKSRefresh()
	http.HandleFunc("/healthz", handleHealthz)
	// Money-path endpoints require a verified RS256 Bearer token (fail-closed).
	http.Handle("/v1/nip/name-enquiry", jwtAuthMiddleware(http.HandlerFunc(handleNameEnquiry)))
	http.Handle("/v1/nip/funds-transfer", jwtAuthMiddleware(http.HandlerFunc(handleFundsTransfer)))
	http.Handle("/v1/nip/tsq", jwtAuthMiddleware(http.HandlerFunc(handleTSQ)))
	http.Handle("/v1/nip/transactions", jwtAuthMiddleware(http.HandlerFunc(handleTransactions)))
	http.Handle("/v1/nip/mandates", jwtAuthMiddleware(http.HandlerFunc(handleMandates)))
	http.Handle("/v1/nip/settlements", jwtAuthMiddleware(http.HandlerFunc(handleSettlements)))
	http.Handle("/v1/nip/response-codes", jwtAuthMiddleware(http.HandlerFunc(handleResponseCodes)))

	if nibss.baseURL == "" {
		log.Printf("WARNING: NIBSS_BASE_URL not set — name-enquiry and funds-transfer will return 503 (responseCode 96)")
	}
	log.Printf("NIBSS/NIP Engine (Go) on :%s — ISO 8583 + Direct Debit", port)
	// Slowloris hardening: explicit server timeouts (ReadHeader/Read/Write/Idle).
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           otelkit.HTTPMiddleware(http.DefaultServeMux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
	log.Fatal(server.ListenAndServe())
}
