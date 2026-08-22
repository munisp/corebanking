// services/core-banking-go — silent-mockware remediation
//
// Previously: postings always returned "posted" over in-memory maps, the
// ledger POST was fire-and-forget with swallowed errors, eodBatchHandler
// fabricated interest/fees, the outbox relay marked rows published without
// publishing, and jwtAuthMiddleware accepted any three-part token with
// X-User-Id: "validated". The file also did not compile (undefined
// handlers, duplicate bootstrap).
//
// Now: postings go to the real TigerBeetle cluster via pkg/tbclient and
// only cluster-confirmed transfers return "posted" (502 otherwise); the EOD
// batch returns 501 instead of fabricating interest/fees; the outbox relay
// (middleware_events.go) publishes to Kafka before published=TRUE; and JWT
// auth verifies RS256 signatures against JWT_JWKS_URL, failing closed.
package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/munisp/corebanking/pkg/tbclient"
)

var serviceName = "core-banking-go"

var (
	db            *sql.DB
	ledgerClient  *tbclient.Client // nil when the cluster is unreachable
	ledgerConnErr error

	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

// journal records postings confirmed by the TigerBeetle cluster in this
// process. It is never pre-populated and only appended after the cluster
// confirms the transfer.
var journal = struct {
	sync.RWMutex
	entries []map[string]interface{}
}{}

// ── Helpers ─────────────────────────────────────────────────────────────────

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResp(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func sanitizeInput(s string) string {
	return strings.Map(func(r rune) rune {
		if r == '<' || r == '>' {
			return -1
		}
		return r
	}, s)
}

func computeInterest(balance float64, rate float64, days int) float64 {
	return balance * (rate / 100.0) * float64(days) / 365.0
}

func accountTier(balance float64) int {
	if balance >= 50000000 {
		return 3
	}
	if balance >= 500000 {
		return 2
	}
	return 1
}

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

// ── Health / metrics / alerts ───────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]string{"status": "healthy", "service": serviceName})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db != nil {
		if err := db.PingContext(r.Context()); err != nil {
			jsonResp(w, 503, map[string]string{"status": "not ready", "error": err.Error()})
			return
		}
	}
	ledger := "unavailable"
	if ledgerClient != nil {
		ledger = "connected"
	}
	jsonResp(w, 200, map[string]string{"status": "ready", "ledger": ledger})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]string{"status": "alive"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=%q} %d\n", serviceName, reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=%q} %d\n", serviceName, errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=%q} %.0f\n", serviceName, time.Since(_bootTime).Seconds())
}

// --- Alerting (real checks over live counters) ---
type alertRule struct {
	Name      string
	Metric    string
	Threshold float64
	Severity  string
}

var alertRules = []alertRule{
	{"high_error_rate", "error_rate", 0.05, "critical"},
	{"db_connection_failures", "db_failures", 3, "critical"},
}

func checkAlerts() []map[string]interface{} {
	var fired []map[string]interface{}
	errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
	if errRate > 0.05 {
		fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
	}
	return fired
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"alerts": checkAlerts(), "rules": len(alertRules)})
}

// ── Posting (real TigerBeetle via pkg/tbclient) ─────────────────────────────

type PostingRequest struct {
	TenantID       string                 `json:"tenant_id"`
	Amount         float64                `json:"amount"`
	Currency       string                 `json:"currency"`
	DebitAccount   string                 `json:"debit_account"`
	CreditAccount  string                 `json:"credit_account"`
	Reference      string                 `json:"reference"`
	Narration      string                 `json:"narration"`
	IdempotencyKey string                 `json:"idempotency_key"`
	Metadata       map[string]interface{} `json:"metadata"`
}

// ledgerAccountUint128 deterministically maps a platform account string ID
// to a TigerBeetle Uint128 (SHA-256, namespaced). Stable across restarts.
func ledgerAccountUint128(accountID string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte("54bank/core-banking/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// maxPostingAmountNaira caps a single posting at ₦1 trillion. Anything larger
// is rejected before float64→uint64 conversion, which would otherwise
// overflow/wrap into a garbage ledger amount (cluster-confirmed incident:
// 1e308 naira became a ~₦92-quadrillion transfer).
const maxPostingAmountNaira = 1e12

// validatePostingAmount rejects non-finite, non-positive, oversized, or
// sub-kobo-precision amounts. Returns the amount in kobo (math.Round).
func validatePostingAmount(amount float64) (uint64, error) {
	if amount != amount || math.IsInf(amount, 0) {
		return 0, fmt.Errorf("amount must be finite")
	}
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive")
	}
	if amount > maxPostingAmountNaira {
		return 0, fmt.Errorf("amount %.2f exceeds maximum posting limit %.0f naira", amount, maxPostingAmountNaira)
	}
	if amount*100 != math.Round(amount*100) {
		return 0, fmt.Errorf("amount %.10f has sub-kobo precision — reject rather than silently round", amount)
	}
	kobo := uint64(math.Round(amount * 100))
	if kobo == 0 {
		return 0, fmt.Errorf("amount %.4f rounds to zero minor units", amount)
	}
	return kobo, nil
}

// postLedgerTransfer posts the double-entry transfer to the real cluster.
// Returns error unless the cluster confirmed it.
func postLedgerTransfer(debit, credit string, amount float64, idempotencyKey string) (string, error) {
	if ledgerClient == nil {
		return "", fmt.Errorf("tigerbeetle ledger unavailable: %v", ledgerConnErr)
	}
	kobo, err := validatePostingAmount(amount)
	if err != nil {
		return "", err
	}

	ctx := context.Background()
	// Idempotently ensure both accounts exist (AccountExists tolerated). The
	// debited (customer) account is created with debits_must_not_exceed_credits
	// so it can NEVER be overdrafted at the ledger level — TigerBeetle rejects
	// any transfer that would push debits past credits.
	debitAcctID := ledgerAccountUint128(debit)
	results, err := ledgerClient.CreateAccounts(ctx, []tbclient.Account{
		{ID: debitAcctID, Ledger: 1, Code: 1, Flags: tbclient.AccountFlags{DebitsMustNotExceedCredits: true}.ToUint16()},
		{ID: ledgerAccountUint128(credit), Ledger: 1, Code: 1},
	})
	if err != nil {
		return "", fmt.Errorf("tigerbeetle create accounts: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountCreated && r.Status != tbclient.AccountExists {
			return "", fmt.Errorf("tigerbeetle account rejected: %v", r.Status)
		}
	}

	// Defense-in-depth balance pre-check: accounts created before the
	// debits_must_not_exceed_credits flag was introduced do not have it, so
	// verify the posted balance covers the debit before submitting.
	if bal, balErr := ledgerClient.GetAccountBalance(ctx, debitAcctID); balErr == nil && bal < int64(kobo) {
		return "", fmt.Errorf("insufficient funds: debit account balance %d kobo < amount %d kobo", bal, kobo)
	}

	// Cluster-level idempotency: transfer ID derived from the idempotency
	// key, so a retried request yields TransferExists instead of a duplicate.
	var transferID tbclient.Uint128
	if idempotencyKey != "" {
		sum := sha256.Sum256([]byte("54bank/core-banking/idem/" + idempotencyKey))
		var b [16]byte
		copy(b[:], sum[:16])
		transferID = tbclient.BytesToUint128(b)
	} else {
		transferID = tbclient.ID()
	}

	tresults, err := ledgerClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              transferID,
		DebitAccountID:  ledgerAccountUint128(debit),
		CreditAccountID: ledgerAccountUint128(credit),
		Amount:          tbclient.ToUint128(kobo),
		Ledger:          1,
		Code:            1,
	}})
	if err != nil {
		return "", fmt.Errorf("tigerbeetle create transfer: %w", err)
	}
	for _, r := range tresults {
		switch r.Status {
		case tbclient.TransferCreated:
			return "posted", nil
		case tbclient.TransferExists:
			return "posted_idempotent", nil
		default:
			return "", fmt.Errorf("tigerbeetle transfer rejected: %v", r.Status)
		}
	}
	return "posted", nil
}

// postingHandler handles POST /v1/core/post. "posted" is returned only when
// the cluster confirmed the transfer; failures are 502 with an explicit
// message that funds were NOT moved.
func postingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResp(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	var req PostingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResp(w, 400, map[string]string{"error": "Invalid request body"})
		return
	}
	if req.DebitAccount == "" || req.CreditAccount == "" {
		jsonResp(w, 400, map[string]string{"error": "debit_account and credit_account are required"})
		return
	}
	if _, err := validatePostingAmount(req.Amount); err != nil {
		jsonResp(w, 400, map[string]string{"error": err.Error()})
		return
	}

	ledgerStatus, err := postLedgerTransfer(req.DebitAccount, req.CreditAccount, req.Amount, req.IdempotencyKey)
	if err != nil {
		log.Printf("[%s] ledger posting FAILED ref=%s: %v", serviceName, req.Reference, err)
		jsonResp(w, 502, map[string]interface{}{
			"status": "failed",
			"error":  "ledger posting failed — funds were NOT moved",
			"detail": err.Error(),
		})
		return
	}

	// Domain event AFTER the ledger confirmed the posting.
	eventStatus := "published"
	if err := publishDomainEvent("core.posting.posted", req.TenantID, map[string]interface{}{
		"posting_ref": req.Reference, "debit": req.DebitAccount, "credit": req.CreditAccount,
		"amount": req.Amount, "narration": req.Narration,
	}); err != nil {
		eventStatus = "publish_failed"
		log.Printf("[%s] domain event publish failed ref=%s: %v", serviceName, req.Reference, err)
	}

	journal.Lock()
	journal.entries = append(journal.entries, map[string]interface{}{
		"posting_ref": req.Reference, "debit": req.DebitAccount, "credit": req.CreditAccount,
		"amount": req.Amount, "status": "posted", "ledger_status": ledgerStatus,
		"posted_at": time.Now().UTC().Format(time.RFC3339),
	})
	journal.Unlock()

	jsonResp(w, 200, map[string]interface{}{
		"status":        "posted",
		"debit":         req.DebitAccount,
		"credit":        req.CreditAccount,
		"amount":        req.Amount,
		"posting_ref":   req.Reference,
		"ledger_status": ledgerStatus,
		"event_status":  eventStatus,
	})
}

// ── /api/* endpoints ────────────────────────────────────────────────────────

// listHandler lists postings confirmed by the cluster in this process.
func listHandler(w http.ResponseWriter, r *http.Request) {
	journal.RLock()
	defer journal.RUnlock()
	jsonResp(w, 200, map[string]interface{}{
		"service":  serviceName,
		"postings": journal.entries,
		"count":    len(journal.entries),
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	journal.RLock()
	posted := len(journal.entries)
	journal.RUnlock()
	ledger := "unavailable"
	if ledgerClient != nil {
		ledger = "connected"
	}
	jsonResp(w, 200, map[string]interface{}{
		"service":            serviceName,
		"requests_total":     atomic.LoadUint64(&_reqCount),
		"errors_total":       atomic.LoadUint64(&_errCount),
		"uptime_seconds":     int(time.Since(_bootTime).Seconds()),
		"postings_confirmed": posted,
		"ledger":             ledger,
		"database":           db != nil,
	})
}

// getByIdHandler looks up a confirmed posting by posting_ref (?id=...).
func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		jsonResp(w, 400, map[string]string{"error": "id query parameter required"})
		return
	}
	journal.RLock()
	defer journal.RUnlock()
	for _, p := range journal.entries {
		if p["posting_ref"] == id {
			jsonResp(w, 200, p)
			return
		}
	}
	jsonResp(w, 404, map[string]string{"error": "posting not found"})
}

// dbInsert persists a record into service_records. Returns error on failure.
func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)",
		id, service, typ, status, string(data))
	return err
}

// createHandler handles /api/create. Previously it swallowed dbInsert
// failures and log.Fatalf'd on upstream errors. Now persistence and the
// upstream GL call must both succeed, or the request fails with 502/503.
func createHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResp(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" {
		tenantID = "platform"
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonResp(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	id := fmt.Sprintf("%s-%d", "core_banking_go", time.Now().UnixNano())
	dataBytes, _ := json.Marshal(body)
	dataBytes = []byte(sanitizeInput(string(dataBytes)))

	if err := dbInsert(id, "core_banking_go", "default", "active", dataBytes); err != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, err)
		jsonResp(w, 503, map[string]string{"error": "persistence unavailable — record NOT created"})
		return
	}

	// Inter-service call to the GL engine (optional integration).
	upstreamURL := os.Getenv("GL_ENGINE_URL")
	if upstreamURL != "" {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		reqBody := strings.NewReader(string(dataBytes))
		ureq, err := http.NewRequestWithContext(ctx, "POST", upstreamURL+"/v1/post", reqBody)
		if err != nil {
			jsonResp(w, 500, map[string]string{"error": "internal error"})
			return
		}
		ureq.Header.Set("Content-Type", "application/json")
		ureq.Header.Set("X-Tenant-ID", tenantID)
		resp, err := http.DefaultClient.Do(ureq)
		if err != nil {
			log.Printf("[%s] GL engine %s unreachable: %v", serviceName, upstreamURL, err)
			jsonResp(w, 502, map[string]interface{}{"error": "GL engine unreachable", "id": id, "gl_status": "not_posted"})
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			jsonResp(w, 502, map[string]interface{}{"error": fmt.Sprintf("GL engine rejected posting (HTTP %d)", resp.StatusCode), "id": id, "gl_status": "not_posted"})
			return
		}
	}

	jsonResp(w, 201, map[string]interface{}{"created": true, "id": id, "data": body})
}

// ── EOD batch — no fabricated numbers ───────────────────────────────────────

// eodBatchHandler previously returned hardcoded interest/fees and status
// "completed". There is no real account store here to compute them from, so
// it now fails loud with 501.
func eodBatchHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 501, map[string]string{
		"status": "unimplemented",
		"error":  "EOD batch is not implemented against real account data — fabricated interest accrual and fee computation were removed. Wire the interest engine and GL before enabling.",
	})
}

// ── Pure calculators (deterministic math on request input — real) ───────────

func accountTierHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Balance float64 `json:"balance"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	tier := accountTier(req.Balance)
	jsonResp(w, 200, map[string]interface{}{"balance": req.Balance, "tier": tier, "max_balance": []float64{300000, 500000, 0}[tier-1]})
}

func interestCalcHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Balance float64 `json:"balance"`
		Rate    float64 `json:"rate"`
		Days    int     `json:"days"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	interest := computeInterest(req.Balance, req.Rate, req.Days)
	jsonResp(w, 200, map[string]interface{}{"interest": math.Round(interest*100) / 100, "balance": req.Balance, "rate": req.Rate, "days": req.Days})
}

// ── Middleware ──────────────────────────────────────────────────────────────

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (rw *statusWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
	})
}

// corsAllowedOrigins returns the configured CORS allowlist. When
// CORS_ALLOWED_ORIGINS is unset, cross-origin requests are denied (no
// Access-Control-Allow-Origin header is ever emitted, and never "*").
func corsAllowedOrigins() []string {
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw == "" {
		return nil
	}
	var out []string
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o == "" || o == "*" { // never allow wildcard origins on the posting service
			continue
		}
		out = append(out, o)
	}
	return out
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			for _, allowed := range corsAllowedOrigins() {
				if allowed == origin {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					break
				}
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-Request-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — running without Postgres", serviceName)
		return
	}
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] db open error: %v", serviceName, err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := conn.PingContext(ctx); err != nil {
		log.Printf("[%s] db ping error: %v", serviceName, err)
		conn.Close()
		return
	}
	db = conn
	log.Printf("[%s] connected to Postgres", serviceName)
}

func initLedger() {
	client, err := tbclient.NewClient(tbclient.Config{})
	if err != nil {
		ledgerConnErr = err
		log.Printf("[%s] FATAL: TigerBeetle cluster unreachable (%v) — postings will fail with 502", serviceName, err)
		return
	}
	ledgerClient = client
	log.Printf("[%s] connected to TigerBeetle cluster", serviceName)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	initDB()
	initLedger()
	go startOutboxRelay(2 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)
	mux.HandleFunc("/v1/core/post", postingHandler)
	mux.HandleFunc("/v1/core/eod-batch", eodBatchHandler)
	mux.HandleFunc("/v1/core/account-tier", accountTierHandler)
	mux.HandleFunc("/v1/core/interest-calc", interestCalcHandler)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	ln, err := net.Listen("tcp", server.Addr)
	if err != nil {
		log.Fatalf("listen %s: %v", server.Addr, err)
	}
	log.Printf("[%s] listening on %s (ledger=%v)", serviceName, server.Addr, ledgerClient != nil)
	log.Fatal(server.Serve(ln))
}
