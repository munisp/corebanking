// 54link-dev Interest Accrual Engine — Go
// Computes daily interest accrual for savings, loans, FDs, overdrafts.
//
// Data integrity doctrine:
//   - Accrual-eligible accounts are read from Postgres (accrual_eligible_accounts).
//   - Every accrual posts a REAL balanced double-entry journal into the GL
//     store ("journalEntries" + "glAccounts" balance update) in one tx.
//   - If Postgres is unavailable the batch FAILS with an error and nothing is
//     marked posted. No hardcoded accounts, no fabricated "posted" statuses,
//     no middleware action claims.
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
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

var serviceName = "interest-accrual-engine-go"

type AccrualProduct struct {
	ProductType string `json:"productType"`
	GLDebit     string `json:"glDebit"`
	GLCredit    string `json:"glCredit"`
	Description string `json:"description"`
	Basis       int    `json:"dayBasis"`
}

// GL posting map per product type (static accounting configuration, not data).
var accrualProducts = []AccrualProduct{
	{ProductType: "savings", GLDebit: "5101", GLCredit: "2102", Description: "Interest Expense on Savings → Savings Deposit Payable", Basis: 365},
	{ProductType: "fixed_deposit", GLDebit: "5102", GLCredit: "2103", Description: "Interest Expense on FD → FD Payable", Basis: 365},
	{ProductType: "loan", GLDebit: "1301", GLCredit: "4101", Description: "Interest Receivable on Loans → Interest Income (Loans)", Basis: 360},
	{ProductType: "overdraft", GLDebit: "1301", GLCredit: "4101", Description: "Interest Receivable on OD → Interest Income (Loans)", Basis: 365},
	{ProductType: "mortgage", GLDebit: "1309", GLCredit: "4102", Description: "Interest Receivable on Mortgage → Interest Income (Retail)", Basis: 365},
	{ProductType: "placement", GLDebit: "1104", GLCredit: "4105", Description: "Placement Receivable → Interest on Placements", Basis: 365},
}

type accrualAccount struct {
	ID            string
	Name          string
	ProductType   string
	PrincipalKobo int64
	AnnualRateBP  int64 // annual rate in basis points — no float money
	DayBasis      int
}

type AccrualResult struct {
	AccountID    string `json:"accountId"`
	AccountName  string `json:"accountName"`
	ProductType  string `json:"productType"`
	AccruedKobo  int64  `json:"accrued_kobo"`
	GLDebitCode  string `json:"glDebitCode"`
	GLCreditCode string `json:"glCreditCode"`
	JournalEntry string `json:"journalEntryId"`
	Status       string `json:"status"` // posted | failed
}

type AccrualBatchResult struct {
	BatchID          string          `json:"batchId"`
	BusinessDate     string          `json:"businessDate"`
	TotalAccounts    int             `json:"totalAccounts"`
	TotalAccruedKobo int64           `json:"total_accrued_kobo"`
	Posted           int             `json:"journalEntriesPosted"`
	Failed           int             `json:"journalEntriesFailed"`
	Results          []AccrualResult `json:"results"`
	Status           string          `json:"status"` // completed | failed | no_eligible_accounts
}

// computeDailyAccrualKobo: principal_kobo × rate_bp / 10000 / basis, integer math.
func computeDailyAccrualKobo(principalKobo int64, annualRateBP int64, basis int) int64 {
	if basis <= 0 {
		basis = 365
	}
	return principalKobo * annualRateBP / 10000 / int64(basis)
}

func productFor(t string) (AccrualProduct, bool) {
	for _, p := range accrualProducts {
		if p.ProductType == t {
			return p, true
		}
	}
	return AccrualProduct{}, false
}

// loadEligibleAccounts reads the real accrual-eligible account set from Postgres.
func loadEligibleAccounts(ctx context.Context) ([]accrualAccount, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT account_id, account_name, product_type, principal_kobo, annual_rate_bp, day_basis
		 FROM accrual_eligible_accounts WHERE status = 'active' ORDER BY account_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []accrualAccount
	for rows.Next() {
		var a accrualAccount
		if err := rows.Scan(&a.ID, &a.Name, &a.ProductType, &a.PrincipalKobo, &a.AnnualRateBP, &a.DayBasis); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// postAccrualJournal writes a balanced double-entry journal (debit + credit)
// and updates GL balances atomically. Returns the journal entry id.
func postAccrualJournal(ctx context.Context, tenantID, jeID, narration string, acc accrualAccount, product AccrualProduct, amountKobo int64, postingDate time.Time) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	legs := []struct{ code, typ string }{{product.GLDebit, "debit"}, {product.GLCredit, "credit"}}
	for _, leg := range legs {
		if _, err := tx.ExecContext(ctx, `INSERT INTO "journalEntries"
			("entryId", "tenantId", "accountId", "glAccountCode", "type", "amount_kobo", "currency", "narration", "transactionRef", "postingDate", "valueDate")
			VALUES ($1,$2,$3,$4,$5,$6,'NGN',$7,$8,$9,$9)`,
			jeID+"-"+leg.typ, tenantID, acc.ID, leg.code, leg.typ, amountKobo, narration, jeID, postingDate); err != nil {
			return fmt.Errorf("journal insert (%s) failed: %w", leg.typ, err)
		}
		var balSQL string
		if leg.typ == "debit" {
			balSQL = `UPDATE "glAccounts" SET "balance_kobo" = "balance_kobo" + $1, "updatedAt" = NOW() WHERE "glAccountCode" = $2`
		} else {
			balSQL = `UPDATE "glAccounts" SET "balance_kobo" = "balance_kobo" - $1, "updatedAt" = NOW() WHERE "glAccountCode" = $2`
		}
		if _, err := tx.ExecContext(ctx, balSQL, amountKobo, leg.code); err != nil {
			return fmt.Errorf("GL balance update (%s) failed: %w", leg.typ, err)
		}
	}
	return tx.Commit()
}

func runAccrualBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "GET" {
		writeJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	if db == nil {
		writeJSON(w, 503, map[string]string{"error": "accrual_store_unavailable", "detail": "postgres not connected; accrual batch NOT run"})
		return
	}

	ctx := r.Context()
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = "tenant-lagos-main"
	}
	businessDate := time.Now().Format("2006-01-02")

	accounts, err := loadEligibleAccounts(ctx)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "accrual_source_unavailable", "detail": err.Error()})
		return
	}

	batchID := fmt.Sprintf("BATCH-ACCRUAL-%s-%d", businessDate, time.Now().UnixNano())
	batch := AccrualBatchResult{
		BatchID:      batchID,
		BusinessDate: businessDate,
		Status:       "completed",
	}

	if len(accounts) == 0 {
		batch.Status = "no_eligible_accounts"
		writeJSON(w, 200, batch)
		return
	}

	entryNum := 1
	for _, acc := range accounts {
		product, ok := productFor(acc.ProductType)
		if !ok {
			log.Printf("[%s] skipping account %s: unknown product type %q", serviceName, acc.ID, acc.ProductType)
			continue
		}
		daily := computeDailyAccrualKobo(acc.PrincipalKobo, acc.AnnualRateBP, acc.DayBasis)
		if daily <= 0 {
			continue
		}
		jeID := fmt.Sprintf("JE-ACCRUAL-%s-%03d", businessDate, entryNum)
		entryNum++
		narration := fmt.Sprintf("Daily accrual %s - %s", acc.ProductType, acc.Name)

		res := AccrualResult{
			AccountID: acc.ID, AccountName: acc.Name, ProductType: acc.ProductType,
			AccruedKobo: daily, GLDebitCode: product.GLDebit, GLCreditCode: product.GLCredit,
			JournalEntry: jeID,
		}
		if err := postAccrualJournal(ctx, tenantID, jeID, narration, acc, product, daily, time.Now()); err != nil {
			log.Printf("[%s] journal posting failed for %s: %v", serviceName, acc.ID, err)
			res.Status = "failed"
			batch.Failed++
		} else {
			res.Status = "posted" // only after the GL tx committed
			batch.Posted++
			batch.TotalAccruedKobo += daily
		}
		batch.Results = append(batch.Results, res)
	}
	batch.TotalAccounts = len(accounts)
	if batch.Failed > 0 {
		batch.Status = "failed"
	}

	// Persist the batch run record.
	if _, err := db.ExecContext(ctx,
		`INSERT INTO accrual_batches (batch_id, business_date, tenant_id, total_accounts, posted, failed, total_accrued_kobo, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		batchID, businessDate, tenantID, batch.TotalAccounts, batch.Posted, batch.Failed, batch.TotalAccruedKobo, batch.Status); err != nil {
		log.Printf("[%s] batch record insert failed: %v", serviceName, err)
	}

	code := 200
	if batch.Status == "failed" {
		code = 500
	}
	writeJSON(w, code, batch)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	pg := "unavailable"
	if db != nil && db.Ping() == nil {
		pg = "connected"
	}
	writeJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName, "version": "2.0.0",
		"postgres": pg,
		"pipeline": "Interest Accrual → GL Journal Entry (postgres tx) → GL Balance",
	})
}

// ─── Shared hardening handlers (used by tests and routes) ──────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) { healthz(w, r) }

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": "database not initialized"})
		return
	}
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"interest-accrual-engine-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"interest-accrual-engine-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"interest-accrual-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

// listHandler lists recorded accrual batches from Postgres.
func listHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		writeJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT batch_id, business_date, tenant_id, total_accounts, posted, failed, total_accrued_kobo, status, created_at
		 FROM accrual_batches ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var bid, bdate, tenant, status string
		var total, posted, failed int
		var accrued int64
		var created time.Time
		if err := rows.Scan(&bid, &bdate, &tenant, &total, &posted, &failed, &accrued, &status, &created); err != nil {
			continue
		}
		out = append(out, map[string]interface{}{
			"batchId": bid, "businessDate": bdate, "tenantId": tenant,
			"totalAccounts": total, "posted": posted, "failed": failed,
			"total_accrued_kobo": accrued, "status": status, "createdAt": created,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"batches": out, "total": len(out)})
}

// --- Rate Limiting ---
var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) ───────────────────────────────

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
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: no token is accepted on structure
// alone.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, serviceName)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, serviceName)
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
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func initSchema() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS accrual_eligible_accounts (
			account_id VARCHAR(64) PRIMARY KEY,
			account_name VARCHAR(200) NOT NULL,
			product_type VARCHAR(32) NOT NULL,
			principal_kobo BIGINT NOT NULL,
			annual_rate_bp BIGINT NOT NULL,
			day_basis INT NOT NULL DEFAULT 365,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS accrual_batches (
			batch_id VARCHAR(96) PRIMARY KEY,
			business_date VARCHAR(10) NOT NULL,
			tenant_id VARCHAR(64) NOT NULL,
			total_accounts INT NOT NULL,
			posted INT NOT NULL,
			failed INT NOT NULL,
			total_accrued_kobo BIGINT NOT NULL,
			status VARCHAR(20) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Fatalf("schema init failed: %v", err)
		}
	}
}

func main() {
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/interest_accrual_engine_go?sslmode=disable")
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	initSchema()

	startJWKSRefresh()

	port := getEnv("PORT", "8093")
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/health", healthz)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/interest/accrue", runAccrualBatch)
	mux.HandleFunc("/v1/interest/batches", listHandler)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(jwtAuthMiddleware(mux)),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	log.Printf("[%s] listening on :%s", serviceName, port)
	log.Fatal(server.ListenAndServe())
}
