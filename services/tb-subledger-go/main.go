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

// TigerBeetle Sub-Ledger per Product
// Each banking product (savings, current, fixed deposit, loan) gets its own
// TB ledger ID. Enables product-level P&L, trial balance, and regulatory
// reporting without SQL aggregation.

type SubLedger struct {
	LedgerID     uint32    `json:"ledger_id"`
	ProductType  string    `json:"product_type"`
	ProductName  string    `json:"product_name"`
	Currency     string    `json:"currency"`
	Description  string    `json:"description"`
	CreatedAt    time.Time `json:"created_at"`
	AccountCount int       `json:"account_count"`
}

type SubLedgerAccount struct {
	AccountID     string `json:"account_id"`
	LedgerID      uint32 `json:"ledger_id"`
	CustomerID    string `json:"customer_id"`
	DebitBalance  int64  `json:"debit_balance_kobo"`
	CreditBalance int64  `json:"credit_balance_kobo"`
}

// Predefined TB ledger IDs per product type
var productLedgers = map[string]uint32{
	"savings":       1001,
	"current":       1002,
	"fixed_deposit": 1003,
	"loan":          1004,
	"overdraft":     1005,
	"treasury":      1006,
	"escrow":        1007,
	"nostro":        1008,
	"vostro":        1009,
	"suspense":      1010,
}

var (
	db        *sql.DB
	tbClient  *tbclient.Client
	ledgersMu sync.RWMutex
	ledgers   map[uint32]*SubLedger
	accounts  map[string]*SubLedgerAccount
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
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sub_ledgers (
		ledger_id INTEGER PRIMARY KEY,
		product_type VARCHAR(32) NOT NULL,
		product_name VARCHAR(128) NOT NULL,
		currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
		description TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		account_count INTEGER NOT NULL DEFAULT 0
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_sub_ledger_accounts (
		account_id VARCHAR(64) PRIMARY KEY,
		ledger_id INTEGER NOT NULL REFERENCES tb_sub_ledgers(ledger_id),
		customer_id VARCHAR(64) NOT NULL,
		debit_balance_kobo BIGINT NOT NULL DEFAULT 0,
		credit_balance_kobo BIGINT NOT NULL DEFAULT 0
	)`)
	// Seed default ledgers
	for prodType, ledgerID := range productLedgers {
		db.Exec(`INSERT INTO tb_sub_ledgers (ledger_id, product_type, product_name, currency, description)
			VALUES ($1, $2, $3, 'NGN', $4)
			ON CONFLICT (ledger_id) DO NOTHING`,
			ledgerID, prodType, fmt.Sprintf("54Bank %s Ledger", prodType),
			fmt.Sprintf("TB sub-ledger for %s product accounts", prodType))
	}
	log.Println("[tb-subledger] Schema initialized with default ledgers")
}

func loadLedgers() {
	ledgers = make(map[uint32]*SubLedger)
	accounts = make(map[string]*SubLedgerAccount)
	if db == nil {
		for prodType, ledgerID := range productLedgers {
			ledgers[ledgerID] = &SubLedger{
				LedgerID: ledgerID, ProductType: prodType,
				ProductName: fmt.Sprintf("54Bank %s Ledger", prodType),
				Currency:    "NGN", CreatedAt: time.Now(),
			}
		}
		return
	}
	rows, err := db.Query(`SELECT ledger_id, product_type, product_name, currency, description, created_at, account_count FROM tb_sub_ledgers`)
	if err != nil {
		log.Printf("Load ledgers error: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var l SubLedger
		if err := rows.Scan(&l.LedgerID, &l.ProductType, &l.ProductName, &l.Currency, &l.Description, &l.CreatedAt, &l.AccountCount); err != nil {
			continue
		}
		ledgers[l.LedgerID] = &l
	}
	log.Printf("[tb-subledger] Loaded %d sub-ledgers from DB", len(ledgers))
}

func listLedgersHandler(w http.ResponseWriter, r *http.Request) {
	ledgersMu.RLock()
	list := make([]*SubLedger, 0, len(ledgers))
	for _, l := range ledgers {
		list = append(list, l)
	}
	ledgersMu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ledgers": list, "count": len(list)})
}

func assignAccountHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID   string `json:"account_id"`
		ProductType string `json:"product_type"`
		CustomerID  string `json:"customer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	ledgerID, ok := productLedgers[req.ProductType]
	if !ok {
		http.Error(w, `{"error":"unknown product type"}`, 400)
		return
	}

	acct := &SubLedgerAccount{
		AccountID:  req.AccountID,
		LedgerID:   ledgerID,
		CustomerID: req.CustomerID,
	}

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_sub_ledger_accounts (account_id, ledger_id, customer_id)
			VALUES ($1, $2, $3) ON CONFLICT (account_id) DO UPDATE SET ledger_id=$2`,
			acct.AccountID, acct.LedgerID, acct.CustomerID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
		db.Exec(`UPDATE tb_sub_ledgers SET account_count = (SELECT COUNT(*) FROM tb_sub_ledger_accounts WHERE ledger_id = $1) WHERE ledger_id = $1`, ledgerID)
	}

	// Create account in TigerBeetle on the correct sub-ledger
	if tbClient != nil {
		tbAcct := tbclient.Account{
			ID: tbclient.NewUint128(), Ledger: ledgerID, Code: tbclient.CodeLiability,
			Flags: tbclient.AccountHistory | tbclient.AccountCreditsMustNotExceedDebits,
		}
		results, err := tbClient.CreateAccounts(context.Background(), []tbclient.Account{tbAcct})
		if err != nil {
			log.Printf("[tb-subledger] TB CreateAccounts error: %v", err)
		} else if len(results) > 0 {
			log.Printf("[tb-subledger] TB CreateAccounts partial error: %d results", len(results))
		}
	}

	ledgersMu.Lock()
	accounts[req.AccountID] = acct
	ledgersMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"account": acct,
		"ledger":  ledgers[ledgerID],
	})
}

func productTrialBalanceHandler(w http.ResponseWriter, r *http.Request) {
	productType := r.URL.Query().Get("product_type")
	ledgerID, ok := productLedgers[productType]
	if !ok {
		http.Error(w, `{"error":"unknown product type"}`, 400)
		return
	}

	ledgersMu.RLock()
	totalDebits := int64(0)
	totalCredits := int64(0)
	acctCount := 0
	for _, a := range accounts {
		if a.LedgerID == ledgerID {
			totalDebits += a.DebitBalance
			totalCredits += a.CreditBalance
			acctCount++
		}
	}
	ledgersMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"product_type":       productType,
		"ledger_id":          ledgerID,
		"total_debits_kobo":  totalDebits,
		"total_credits_kobo": totalCredits,
		"net_balance_kobo":   totalDebits - totalCredits,
		"account_count":      acctCount,
		"balanced":           totalDebits == totalCredits,
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-subledger-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-subledger] TB client init failed: %v", err)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-subledger-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-subledger-go")
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
	loadLedgers()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-subledger/ledgers", listLedgersHandler)
	mux.HandleFunc("/v1/tb-subledger/assign", assignAccountHandler)
	mux.HandleFunc("/v1/tb-subledger/trial-balance", productTrialBalanceHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8302"
	}

	server := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}

	go func() {
		log.Printf("[tb-subledger-go] Starting on :%s with %d product ledgers", port, len(productLedgers))
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
	log.Println("[tb-subledger-go] Shutdown complete")
}
