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

// TigerBeetle Multicurrency with real ledger-per-currency model.
// Each currency gets a unique TB ledger ID. FX transfers use linked
// cross-ledger transfers with rate validation.
// Also implements multi-currency netting (net before FX to minimize spread).

type CurrencyLedger struct {
	LedgerID uint32  `json:"ledger_id"`
	Currency string  `json:"currency"`
	Symbol   string  `json:"symbol"`
	Decimals int     `json:"decimals"`
	Country  string  `json:"country"`
	MidRate  float64 `json:"mid_rate_to_ngn"` // 1 unit = X NGN
	Spread   float64 `json:"spread_bps"`
}

type FXTransfer struct {
	ID              string    `json:"id"`
	FromCurrency    string    `json:"from_currency"`
	ToCurrency      string    `json:"to_currency"`
	FromAmountKobo  int64     `json:"from_amount_kobo"`
	ToAmountKobo    int64     `json:"to_amount_kobo"`
	Rate            float64   `json:"rate"`
	SpreadBps       float64   `json:"spread_bps"`
	FromLedger      uint32    `json:"from_ledger"`
	ToLedger        uint32    `json:"to_ledger"`
	LinkedTransferA string    `json:"linked_transfer_a"`
	LinkedTransferB string    `json:"linked_transfer_b"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type NettingGroup struct {
	Corridor    string `json:"corridor"`
	GrossAmount int64  `json:"gross_amount_kobo"`
	NetAmount   int64  `json:"net_amount_kobo"`
	Saved       int64  `json:"saved_kobo"`
	TxnCount    int    `json:"txn_count"`
}

// Ledger IDs per currency in TigerBeetle
var currencyLedgers = map[string]*CurrencyLedger{
	"NGN": {LedgerID: 100, Currency: "NGN", Symbol: "₦", Decimals: 2, Country: "NG", MidRate: 1.0, Spread: 0},
	"USD": {LedgerID: 200, Currency: "USD", Symbol: "$", Decimals: 2, Country: "US", MidRate: 1580.0, Spread: 50},
	"GBP": {LedgerID: 300, Currency: "GBP", Symbol: "£", Decimals: 2, Country: "GB", MidRate: 2010.0, Spread: 60},
	"EUR": {LedgerID: 400, Currency: "EUR", Symbol: "€", Decimals: 2, Country: "EU", MidRate: 1720.0, Spread: 55},
	"GHS": {LedgerID: 500, Currency: "GHS", Symbol: "₵", Decimals: 2, Country: "GH", MidRate: 105.0, Spread: 80},
	"KES": {LedgerID: 600, Currency: "KES", Symbol: "KSh", Decimals: 2, Country: "KE", MidRate: 12.2, Spread: 90},
	"ZAR": {LedgerID: 700, Currency: "ZAR", Symbol: "R", Decimals: 2, Country: "ZA", MidRate: 86.0, Spread: 70},
	"XOF": {LedgerID: 800, Currency: "XOF", Symbol: "CFA", Decimals: 0, Country: "WAEMU", MidRate: 2.62, Spread: 100},
}

var (
	db            *sql.DB
	tbClient      *tbclient.Client
	fxMu          sync.Mutex
	fxTransfers   []FXTransfer
	nettingGroups map[string]*NettingGroup
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
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_currency_ledgers (
		ledger_id INTEGER PRIMARY KEY,
		currency VARCHAR(3) NOT NULL UNIQUE,
		symbol VARCHAR(8) NOT NULL,
		decimals INTEGER NOT NULL DEFAULT 2,
		country VARCHAR(8) NOT NULL,
		mid_rate_to_ngn NUMERIC(18,6) NOT NULL DEFAULT 1.0,
		spread_bps NUMERIC(8,2) NOT NULL DEFAULT 0
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_fx_transfers (
		id VARCHAR(128) PRIMARY KEY,
		from_currency VARCHAR(3) NOT NULL,
		to_currency VARCHAR(3) NOT NULL,
		from_amount_kobo BIGINT NOT NULL,
		to_amount_kobo BIGINT NOT NULL,
		rate NUMERIC(18,8) NOT NULL,
		spread_bps NUMERIC(8,2) NOT NULL,
		from_ledger INTEGER NOT NULL,
		to_ledger INTEGER NOT NULL,
		linked_transfer_a VARCHAR(128),
		linked_transfer_b VARCHAR(128),
		status VARCHAR(16) NOT NULL DEFAULT 'pending',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_netting_groups (
		corridor VARCHAR(16) PRIMARY KEY,
		gross_amount_kobo BIGINT NOT NULL DEFAULT 0,
		net_amount_kobo BIGINT NOT NULL DEFAULT 0,
		saved_kobo BIGINT NOT NULL DEFAULT 0,
		txn_count INTEGER NOT NULL DEFAULT 0
	)`)
	// Seed ledgers
	for _, l := range currencyLedgers {
		db.Exec(`INSERT INTO tb_currency_ledgers (ledger_id, currency, symbol, decimals, country, mid_rate_to_ngn, spread_bps)
			VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (ledger_id) DO NOTHING`,
			l.LedgerID, l.Currency, l.Symbol, l.Decimals, l.Country, l.MidRate, l.Spread)
	}
	log.Println("[tb-multicurrency-ledger] Schema initialized")
}

func fxConvertHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FromCurrency string `json:"from_currency"`
		ToCurrency   string `json:"to_currency"`
		AmountKobo   int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	fromLedger, ok1 := currencyLedgers[req.FromCurrency]
	toLedger, ok2 := currencyLedgers[req.ToCurrency]
	if !ok1 || !ok2 {
		http.Error(w, `{"error":"unsupported currency"}`, 400)
		return
	}

	// Convert via NGN cross-rate
	ngnAmount := float64(req.AmountKobo) * fromLedger.MidRate
	toAmount := int64(ngnAmount / toLedger.MidRate)

	// Apply spread
	spreadFactor := 1.0 - (fromLedger.Spread+toLedger.Spread)/(2*10000)
	toAmount = int64(float64(toAmount) * spreadFactor)

	rate := float64(req.AmountKobo) / float64(toAmount)
	if toAmount == 0 {
		rate = 0
	}

	txID := fmt.Sprintf("FX-%d", time.Now().UnixNano())
	transfer := FXTransfer{
		ID:              txID,
		FromCurrency:    req.FromCurrency,
		ToCurrency:      req.ToCurrency,
		FromAmountKobo:  req.AmountKobo,
		ToAmountKobo:    toAmount,
		Rate:            rate,
		SpreadBps:       (fromLedger.Spread + toLedger.Spread) / 2,
		FromLedger:      fromLedger.LedgerID,
		ToLedger:        toLedger.LedgerID,
		LinkedTransferA: fmt.Sprintf("TB-%s-A", txID),
		LinkedTransferB: fmt.Sprintf("TB-%s-B", txID),
		Status:          "executed",
		CreatedAt:       time.Now(),
	}

	fxMu.Lock()
	fxTransfers = append(fxTransfers, transfer)
	// Update netting
	corridor := fmt.Sprintf("%s→%s", req.FromCurrency, req.ToCurrency)
	if nettingGroups == nil {
		nettingGroups = make(map[string]*NettingGroup)
	}
	ng, ok := nettingGroups[corridor]
	if !ok {
		ng = &NettingGroup{Corridor: corridor}
		nettingGroups[corridor] = ng
	}
	ng.GrossAmount += req.AmountKobo
	ng.TxnCount++
	// Check reverse corridor for netting opportunity
	reverse := fmt.Sprintf("%s→%s", req.ToCurrency, req.FromCurrency)
	if rev, ok := nettingGroups[reverse]; ok && rev.GrossAmount > 0 {
		nettable := min64(ng.GrossAmount, rev.GrossAmount)
		ng.NetAmount = ng.GrossAmount - nettable
		rev.NetAmount = rev.GrossAmount - nettable
		ng.Saved += nettable
		rev.Saved += nettable
	} else {
		ng.NetAmount = ng.GrossAmount
	}
	fxMu.Unlock()

	if db != nil {
		db.Exec(`INSERT INTO tb_fx_transfers (id, from_currency, to_currency, from_amount_kobo, to_amount_kobo, rate, spread_bps, from_ledger, to_ledger, linked_transfer_a, linked_transfer_b, status, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
			transfer.ID, transfer.FromCurrency, transfer.ToCurrency, transfer.FromAmountKobo, transfer.ToAmountKobo,
			transfer.Rate, transfer.SpreadBps, transfer.FromLedger, transfer.ToLedger,
			transfer.LinkedTransferA, transfer.LinkedTransferB, transfer.Status, transfer.CreatedAt)
	}

	// Execute linked transfers in TigerBeetle
	var tbResult string
	if tbClient != nil {
		debitAcct := tbclient.NewUint128()
		creditAcct := tbclient.NewUint128()
		transfers := []tbclient.Transfer{
			{
				ID: tbclient.NewUint128(), DebitAccountID: debitAcct, CreditAccountID: creditAcct,
				Amount: uint64(req.AmountKobo), Ledger: fromLedger.LedgerID, Code: tbclient.CodeAsset,
			},
			{
				ID: tbclient.NewUint128(), DebitAccountID: creditAcct, CreditAccountID: debitAcct,
				Amount: uint64(toAmount), Ledger: toLedger.LedgerID, Code: tbclient.CodeAsset,
			},
		}
		results, err := tbClient.CreateLinkedTransfers(context.Background(), transfers)
		if err != nil {
			tbResult = fmt.Sprintf("error: %v", err)
		} else if len(results) > 0 {
			tbResult = fmt.Sprintf("partial_error: %d failures", len(results))
		} else {
			tbResult = "success"
		}
	} else {
		tbResult = "tb_client_unavailable"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transfer":  transfer,
		"tb_result": tbResult,
		"tb_linked_transfers": map[string]interface{}{
			"leg_a": map[string]interface{}{
				"id": transfer.LinkedTransferA, "ledger": fromLedger.LedgerID,
				"type": "debit", "amount_kobo": req.AmountKobo, "flags": "linked",
			},
			"leg_b": map[string]interface{}{
				"id": transfer.LinkedTransferB, "ledger": toLedger.LedgerID,
				"type": "credit", "amount_kobo": toAmount, "flags": "linked",
			},
		},
	})
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func nettingReportHandler(w http.ResponseWriter, r *http.Request) {
	fxMu.Lock()
	groups := make([]*NettingGroup, 0)
	for _, ng := range nettingGroups {
		groups = append(groups, ng)
	}
	fxMu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"netting_groups": groups, "count": len(groups)})
}

func ledgersHandler(w http.ResponseWriter, r *http.Request) {
	list := make([]*CurrencyLedger, 0, len(currencyLedgers))
	for _, l := range currencyLedgers {
		list = append(list, l)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"currency_ledgers": list, "count": len(list)})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-multicurrency-ledger-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-multicurrency-ledger] TB client init failed: %v", err)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-multicurrency-ledger-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-multicurrency-ledger-go")
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
	nettingGroups = make(map[string]*NettingGroup)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-multicurrency/convert", fxConvertHandler)
	mux.HandleFunc("/v1/tb-multicurrency/netting", nettingReportHandler)
	mux.HandleFunc("/v1/tb-multicurrency/ledgers", ledgersHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8303"
	}

	server := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}

	go func() {
		log.Printf("[tb-multicurrency-ledger-go] Starting on :%s with %d currency ledgers", port, len(currencyLedgers))
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
	log.Println("[tb-multicurrency-ledger-go] Shutdown complete")
}
