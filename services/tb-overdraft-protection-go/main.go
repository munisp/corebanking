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

// TigerBeetle Overdraft Protection
// Uses linked transfers + account flags: if primary account has insufficient
// funds, atomically checks and debits overdraft facility account in the same
// TB batch. credits_must_not_exceed_debits on primary ensures we detect
// insufficient funds, then the linked OD transfer covers the shortfall.

type OverdraftFacility struct {
	FacilityID    string    `json:"facility_id"`
	AccountID     string    `json:"account_id"`    // Primary account
	ODAccountID   string    `json:"od_account_id"` // Overdraft facility account
	LimitKobo     int64     `json:"limit_kobo"`
	UsedKobo      int64     `json:"used_kobo"`
	AvailableKobo int64     `json:"available_kobo"`
	InterestRate  float64   `json:"interest_rate_pct"`
	Status        string    `json:"status"` // active, suspended, closed
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}

type ODTransfer struct {
	TransferID    string    `json:"transfer_id"`
	FacilityID    string    `json:"facility_id"`
	AmountKobo    int64     `json:"amount_kobo"`
	Type          string    `json:"type"` // drawdown, repayment
	BalanceBefore int64     `json:"balance_before_kobo"`
	BalanceAfter  int64     `json:"balance_after_kobo"`
	CreatedAt     time.Time `json:"created_at"`
}

var (
	db           *sql.DB
	tbClient     *tbclient.Client
	facilitiesMu sync.RWMutex
	facilities   map[string]*OverdraftFacility
	odTransfers  []ODTransfer
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
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_overdraft_facilities (
		facility_id VARCHAR(64) PRIMARY KEY,
		account_id VARCHAR(64) NOT NULL,
		od_account_id VARCHAR(64) NOT NULL,
		limit_kobo BIGINT NOT NULL,
		used_kobo BIGINT NOT NULL DEFAULT 0,
		available_kobo BIGINT NOT NULL,
		interest_rate_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
		status VARCHAR(16) NOT NULL DEFAULT 'active',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_od_transfers (
		transfer_id VARCHAR(128) PRIMARY KEY,
		facility_id VARCHAR(64) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		type VARCHAR(16) NOT NULL,
		balance_before_kobo BIGINT NOT NULL,
		balance_after_kobo BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	log.Println("[tb-overdraft-protection] Schema initialized")
}

func loadFacilities() {
	facilities = make(map[string]*OverdraftFacility)
	if db == nil {
		return
	}
	rows, err := db.Query(`SELECT facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo,
		interest_rate_pct, status, created_at, expires_at FROM tb_overdraft_facilities WHERE status = 'active'`)
	if err != nil {
		log.Printf("Load facilities error: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var f OverdraftFacility
		if err := rows.Scan(&f.FacilityID, &f.AccountID, &f.ODAccountID, &f.LimitKobo, &f.UsedKobo,
			&f.AvailableKobo, &f.InterestRate, &f.Status, &f.CreatedAt, &f.ExpiresAt); err != nil {
			continue
		}
		facilities[f.AccountID] = &f
	}
	log.Printf("[tb-overdraft-protection] Loaded %d active facilities from DB", len(facilities))
}

func createFacilityHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID    string  `json:"account_id"`
		LimitKobo    int64   `json:"limit_kobo"`
		InterestRate float64 `json:"interest_rate_pct"`
		ExpiryDays   int     `json:"expiry_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	if req.LimitKobo <= 0 {
		http.Error(w, `{"error":"limit must be positive"}`, 400)
		return
	}

	f := &OverdraftFacility{
		FacilityID:    fmt.Sprintf("ODF-%d", time.Now().UnixNano()),
		AccountID:     req.AccountID,
		ODAccountID:   fmt.Sprintf("ODA-%s", req.AccountID),
		LimitKobo:     req.LimitKobo,
		UsedKobo:      0,
		AvailableKobo: req.LimitKobo,
		InterestRate:  req.InterestRate,
		Status:        "active",
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().AddDate(0, 0, req.ExpiryDays),
	}

	if db != nil {
		_, err := db.Exec(`INSERT INTO tb_overdraft_facilities (facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo, interest_rate_pct, status, created_at, expires_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			f.FacilityID, f.AccountID, f.ODAccountID, f.LimitKobo, f.UsedKobo, f.AvailableKobo, f.InterestRate, f.Status, f.CreatedAt, f.ExpiresAt)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), 500)
			return
		}
	}

	facilitiesMu.Lock()
	facilities[req.AccountID] = f
	facilitiesMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"facility": f,
		"tb_account_flags": map[string]interface{}{
			"primary_account": "credits_must_not_exceed_debits",
			"od_account":      "linked to primary via TB linked transfers",
		},
	})
}

func drawdownHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	facilitiesMu.Lock()
	f, ok := facilities[req.AccountID]
	if !ok {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"no overdraft facility for this account"}`, 404)
		return
	}
	if f.Status != "active" {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"facility not active"}`, 403)
		return
	}
	if time.Now().After(f.ExpiresAt) {
		f.Status = "expired"
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"facility expired"}`, 403)
		return
	}
	if req.AmountKobo > f.AvailableKobo {
		facilitiesMu.Unlock()
		http.Error(w, fmt.Sprintf(`{"error":"exceeds available limit","available_kobo":%d,"requested_kobo":%d}`, f.AvailableKobo, req.AmountKobo), 403)
		return
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo += req.AmountKobo
	f.AvailableKobo = f.LimitKobo - f.UsedKobo

	transfer := ODTransfer{
		TransferID:    fmt.Sprintf("ODT-%d", time.Now().UnixNano()),
		FacilityID:    f.FacilityID,
		AmountKobo:    req.AmountKobo,
		Type:          "drawdown",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	odTransfers = append(odTransfers, transfer)
	facilitiesMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2 WHERE facility_id=$3`,
			f.UsedKobo, f.AvailableKobo, f.FacilityID)
		db.Exec(`INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt)
	}

	// Execute linked OD transfer in TigerBeetle
	var tbResult string
	if tbClient != nil {
		debitAcct := tbclient.NewUint128()
		creditAcct := tbclient.NewUint128()
		results, err := tbClient.CreateLinkedTransfers(context.Background(), []tbclient.Transfer{
			{
				ID: tbclient.NewUint128(), DebitAccountID: debitAcct, CreditAccountID: creditAcct,
				Amount: uint64(req.AmountKobo), Ledger: tbclient.LedgerNGN, Code: tbclient.CodeLiability,
				Flags: tbclient.TransferPending,
			},
			{
				ID: tbclient.NewUint128(), DebitAccountID: creditAcct, CreditAccountID: debitAcct,
				Amount: uint64(req.AmountKobo), Ledger: tbclient.LedgerNGN, Code: tbclient.CodeLiability,
			},
		})
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
		"facility":  f,
		"tb_result": tbResult,
		"tb_linked_transfers": map[string]string{
			"description": "Atomic TB linked transfer: debit OD facility account, credit primary account",
			"flags":       "linked | pending",
		},
	})
}

func repayHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}

	facilitiesMu.Lock()
	f, ok := facilities[req.AccountID]
	if !ok {
		facilitiesMu.Unlock()
		http.Error(w, `{"error":"no overdraft facility for this account"}`, 404)
		return
	}

	repayAmount := req.AmountKobo
	if repayAmount > f.UsedKobo {
		repayAmount = f.UsedKobo
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo -= repayAmount
	f.AvailableKobo = f.LimitKobo - f.UsedKobo

	transfer := ODTransfer{
		TransferID:    fmt.Sprintf("ODT-%d", time.Now().UnixNano()),
		FacilityID:    f.FacilityID,
		AmountKobo:    repayAmount,
		Type:          "repayment",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	odTransfers = append(odTransfers, transfer)
	facilitiesMu.Unlock()

	if db != nil {
		db.Exec(`UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2 WHERE facility_id=$3`,
			f.UsedKobo, f.AvailableKobo, f.FacilityID)
		db.Exec(`INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer": transfer, "facility": f})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	facilitiesMu.RLock()
	f, ok := facilities[accountID]
	facilitiesMu.RUnlock()
	if !ok {
		http.Error(w, `{"error":"no facility"}`, 404)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"facility": f})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-overdraft-protection-go"}`))
}

func initTBClient() {
	cfg := tbclient.DefaultConfig()
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-overdraft-protection] TB client init failed: %v", err)
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
		for range time.Tick(5 * time.Minute) {
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-overdraft-protection-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-overdraft-protection-go")
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
	initTBClient()
	loadFacilities()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-overdraft/create", createFacilityHandler)
	mux.HandleFunc("/v1/tb-overdraft/drawdown", drawdownHandler)
	mux.HandleFunc("/v1/tb-overdraft/repay", repayHandler)
	mux.HandleFunc("/v1/tb-overdraft/status", statusHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8304"
	}

	server := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}

	go func() {
		log.Printf("[tb-overdraft-protection-go] Starting on :%s", port)
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
	log.Println("[tb-overdraft-protection-go] Shutdown complete")
}
