package main

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
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

// TigerBeetle Multicurrency with real ledger-per-currency model (MN-16 rework).
//
// A conversion now executes a REAL TigerBeetle linked-transfer pair across the
// two currency ledgers:
//   leg A (linked): debit from_account → credit FX house account (from ledger)
//   leg B:          debit FX house account → credit to_account (to ledger)
// Transfer ids are deterministic: detID("fx:{quote_id}:A" / ":B") — retries
// with the same quote_id are idempotent via TB's exists result. House accounts
// come from env FX_HOUSE_ACCOUNT_<CURRENCY> (hex TB ids); missing config fails
// closed (503).
//
// Rate sourcing (env FX_RATES_SOURCE):
//   "fx-service" — GET $FX_SERVICE_URL/api/v1/fx/rates?tenant_id&from_currency&to_currency
//   "db"         — tb_currency_ledgers.mid_rate_to_ngn (operator-maintained)
//   "static"     — the hardcoded table below, ONLY honored when
//                  FX_ALLOW_STATIC_RATES=true (explicit labeled fallback)
// The compile-time constants are therefore a documented fallback, not the
// default. A valid HMAC rate-lock token (contract shared with R2's
// payment-hub/payment-processing quote side, env FX_RATE_LOCK_SECRET:
// token = base64url(payloadJSON) "." hex(HMAC-SHA256(secret, payload_b64));
// payload {amount_minor, exp, rate|rate_scaled, quote_id}) overrides the rate
// and is verified fail-closed.
//
// Integer math only: rates are scaled ×1e6 to integers; the single conversion
// point applies explicit ROUND_HALF_UP (divRoundHalfUp) — the same rounding
// mode as the quote side (mojaloop-connector create_quote.ts ROUND_HALF_UP)
// and R2's execution side (_to_kobo_half_up). The old float truncation and
// the in-memory "executed" strings are deleted.

type CurrencyLedger struct {
	LedgerID uint32  `json:"ledger_id"`
	Currency string  `json:"currency"`
	Symbol   string  `json:"symbol"`
	Decimals int     `json:"decimals"`
	Country  string  `json:"country"`
	MidRate  float64 `json:"mid_rate_to_ngn"` // 1 unit = X NGN — STATIC FALLBACK only (FX_ALLOW_STATIC_RATES=true)
	Spread   float64 `json:"spread_bps"`
}

type FXTransfer struct {
	ID              string    `json:"id"`
	QuoteID         string    `json:"quote_id"`
	FromCurrency    string    `json:"from_currency"`
	ToCurrency      string    `json:"to_currency"`
	FromAmountKobo  int64     `json:"from_amount_kobo"`
	ToAmountKobo    int64     `json:"to_amount_kobo"`
	RateScaled      int64     `json:"rate_scaled"` // rate × 1e6
	SpreadBps       int64     `json:"spread_bps"`
	RateSource      string    `json:"rate_source"`
	FromLedger      uint32    `json:"from_ledger"`
	ToLedger        uint32    `json:"to_ledger"`
	LinkedTransferA string    `json:"linked_transfer_a"` // real TB transfer id (hex)
	LinkedTransferB string    `json:"linked_transfer_b"` // real TB transfer id (hex)
	Status          string    `json:"status"`            // executed | failed
	CreatedAt       time.Time `json:"created_at"`
}

type NettingGroup struct {
	Corridor    string `json:"corridor"`
	GrossAmount int64  `json:"gross_amount_kobo"`
	NetAmount   int64  `json:"net_amount_kobo"`
	Saved       int64  `json:"saved_kobo"`
	TxnCount    int    `json:"txn_count"`
}

// Ledger IDs + decimals per currency in TigerBeetle. MidRate/Spread are the
// LABELED static fallback (env FX_ALLOW_STATIC_RATES=true); the authoritative
// rate source is FX_RATES_SOURCE (fx-service or db).
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
	nettingGroups map[string]*NettingGroup
)

// detID derives a deterministic TB Uint128 from a human-meaningful key
// (SHA-256, first 128 bits) ⇒ idempotent retries.
func detID(key string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte(key))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// u128Hex renders a TB Uint128 as a 32-char big-endian hex string.
func u128Hex(u tbclient.Uint128) string {
	b := u.Bytes()
	for i, j := 0, 15; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return hex.EncodeToString(b[:])
}

// parseTBAccountID parses a big-endian hex TB account id (mirrors the SDK's
// HexStringToUint128, not re-exported by pkg/tbclient).
func parseTBAccountID(s string) (tbclient.Uint128, error) {
	var zero tbclient.Uint128
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" || len(s) > 32 {
		return zero, fmt.Errorf("account id must be 1..32 hex chars")
	}
	if len(s)%2 == 1 {
		s = "0" + s
	}
	var b [16]byte
	n, err := hex.Decode(b[:], []byte(s))
	if err != nil {
		return zero, fmt.Errorf("account id is not valid hex: %w", err)
	}
	for i := 0; i < n/2; i++ {
		b[i], b[n-1-i] = b[n-1-i], b[i]
	}
	return tbclient.BytesToUint128(b), nil
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// divRoundHalfUp computes ROUND_HALF_UP(num/den) for positive integers —
// the single rounding point for all FX conversion math (MN-16, F13-8).
func divRoundHalfUp(num, den *big.Int) *big.Int {
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))
	if new(big.Int).Mul(r, big.NewInt(2)).Cmp(den) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	return q
}

func pow10(n int) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
}

// validateRateLockToken verifies the quote-side rate-lock token (shared
// contract with R2: base64url(payload).hex(HMAC-SHA256(secret, payload_b64)),
// payload {amount_minor, exp, rate|rate_scaled, quote_id}). Fail-closed:
// a supplied token with no FX_RATE_LOCK_SECRET configured is an error.
// Returns the locked rate (×1e6) and quote_id when the payload carries them.
func validateRateLockToken(token string, amountKobo int64) (rateScaled int64, quoteID string, err error) {
	secret := os.Getenv("FX_RATE_LOCK_SECRET")
	if secret == "" {
		return 0, "", fmt.Errorf("rate-lock token supplied but FX_RATE_LOCK_SECRET is not configured")
	}
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("malformed rate-lock token")
	}
	payloadB64, sigHex := parts[0], parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payloadB64))
	expected := mac.Sum(nil)
	got, derr := hex.DecodeString(sigHex)
	if derr != nil || !hmac.Equal(expected, got) {
		return 0, "", fmt.Errorf("invalid rate-lock token signature")
	}
	payloadBytes, derr := base64.URLEncoding.DecodeString(payloadB64 + strings.Repeat("=", (4-len(payloadB64)%4)%4))
	if derr != nil {
		payloadBytes, derr = base64.RawURLEncoding.DecodeString(payloadB64)
		if derr != nil {
			return 0, "", fmt.Errorf("malformed rate-lock token payload")
		}
	}
	var payload map[string]interface{}
	if json.Unmarshal(payloadBytes, &payload) != nil {
		return 0, "", fmt.Errorf("malformed rate-lock token payload")
	}
	if exp, _ := payload["exp"].(float64); int64(exp) < time.Now().Unix() {
		return 0, "", fmt.Errorf("rate-lock token expired")
	}
	if amt, _ := payload["amount_minor"].(float64); int64(amt) != amountKobo {
		return 0, "", fmt.Errorf("execution amount does not match the quoted rate-locked amount")
	}
	if qid, _ := payload["quote_id"].(string); qid != "" {
		quoteID = qid
	}
	if rs, _ := payload["rate_scaled"].(float64); rs > 0 {
		rateScaled = int64(rs)
	} else if rt, _ := payload["rate"].(float64); rt > 0 {
		rateScaled = int64(rt*1_000_000 + 0.5)
	}
	return rateScaled, quoteID, nil
}

// crossRate carries the two mid rates (NGN per unit) for NGN-cross conversion
// from the db/static sources.
type crossRate struct{ fromMid, toMid float64 }

// resolveRate obtains the conversion rate per FX_RATES_SOURCE. It returns
// either a direct pair rate (rateScaled ×1e6, to-units per 1 from-unit) or a
// cross-rate pair (NGN mids). Static constants only when explicitly allowed
// (FX_ALLOW_STATIC_RATES=true).
func resolveRate(r *http.Request, from, to *CurrencyLedger, tenantID string) (rateScaled int64, cross *crossRate, spreadBps int64, source string, err error) {
	spreadBps = int64(from.Spread+to.Spread) / 2
	switch strings.ToLower(os.Getenv("FX_RATES_SOURCE")) {
	case "fx-service":
		base := strings.TrimSuffix(os.Getenv("FX_SERVICE_URL"), "/")
		if base == "" {
			return 0, nil, 0, "", fmt.Errorf("FX_RATES_SOURCE=fx-service but FX_SERVICE_URL is not set")
		}
		url := fmt.Sprintf("%s/api/v1/fx/rates?tenant_id=%s&from_currency=%s&to_currency=%s", base, tenantID, from.Currency, to.Currency)
		req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, url, nil)
		req.Header.Set("x-tenant-id", tenantID)
		if tok := os.Getenv("FX_SERVICE_TOKEN"); tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		client := &http.Client{Timeout: 5 * time.Second}
		resp, ferr := client.Do(req)
		if ferr != nil {
			return 0, nil, 0, "", fmt.Errorf("fx-service unreachable: %v", ferr)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return 0, nil, 0, "", fmt.Errorf("fx-service returned http_%d", resp.StatusCode)
		}
		var body struct {
			Rate float64 `json:"rate"`
		}
		if json.NewDecoder(resp.Body).Decode(&body) != nil || body.Rate <= 0 {
			return 0, nil, 0, "", fmt.Errorf("fx-service returned no usable rate")
		}
		// Direct pair rate: `rate` units of `to` per 1 unit of `from`.
		return int64(body.Rate*1_000_000 + 0.5), nil, spreadBps, "fx-service", nil
	case "db", "":
		if db == nil {
			return 0, nil, 0, "", fmt.Errorf("FX_RATES_SOURCE=db but postgres is not connected")
		}
		var fromMid, toMid float64
		if err = db.QueryRowContext(r.Context(), `SELECT mid_rate_to_ngn FROM tb_currency_ledgers WHERE currency=$1`, from.Currency).Scan(&fromMid); err != nil {
			return 0, nil, 0, "", fmt.Errorf("no db rate for %s", from.Currency)
		}
		if err = db.QueryRowContext(r.Context(), `SELECT mid_rate_to_ngn FROM tb_currency_ledgers WHERE currency=$1`, to.Currency).Scan(&toMid); err != nil {
			return 0, nil, 0, "", fmt.Errorf("no db rate for %s", to.Currency)
		}
		if fromMid <= 0 || toMid <= 0 {
			return 0, nil, 0, "", fmt.Errorf("non-positive db rate")
		}
		return 0, &crossRate{fromMid: fromMid, toMid: toMid}, spreadBps, "db", nil
	case "static":
		if os.Getenv("FX_ALLOW_STATIC_RATES") != "true" {
			return 0, nil, 0, "", fmt.Errorf("static rates are a labeled fallback only; set FX_ALLOW_STATIC_RATES=true to enable")
		}
		return 0, &crossRate{fromMid: from.MidRate, toMid: to.MidRate}, spreadBps, "static", nil
	default:
		return 0, nil, 0, "", fmt.Errorf("unknown FX_RATES_SOURCE %q", os.Getenv("FX_RATES_SOURCE"))
	}
}

// convertKobo is the SINGLE conversion point (MN-16): integer minor units in,
// integer minor units out, explicit ROUND_HALF_UP, currency-decimal aware.
// A rate-locked conversion applies no further spread (the locked rate is the
// final customer rate from the quote).
func convertKobo(amountKobo int64, from, to *CurrencyLedger, rateScaled int64, cross *crossRate, spreadBps int64, lockedRate bool) int64 {
	amount := new(big.Int).SetInt64(amountKobo)
	var num, den *big.Int
	if cross != nil {
		// NGN cross-rate: to_minor = from_minor × (fromMid/toMid) × 10^(toDec-fromDec)
		fromScaled := new(big.Int).SetInt64(int64(cross.fromMid*1_000_000 + 0.5))
		toScaled := new(big.Int).SetInt64(int64(cross.toMid*1_000_000 + 0.5))
		num = new(big.Int).Mul(amount, fromScaled)
		num.Mul(num, pow10(to.Decimals))
		den = new(big.Int).Mul(toScaled, pow10(from.Decimals))
	} else {
		// direct pair rate scaled ×1e6
		num = new(big.Int).Mul(amount, new(big.Int).SetInt64(rateScaled))
		num.Mul(num, pow10(to.Decimals))
		den = new(big.Int).Mul(big.NewInt(1_000_000), pow10(from.Decimals))
	}
	out := divRoundHalfUp(num, den)
	if !lockedRate && spreadBps > 0 {
		out = divRoundHalfUp(new(big.Int).Mul(out, big.NewInt(10000-spreadBps)), big.NewInt(10000))
	}
	return out.Int64()
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[tb-multicurrency-ledger] WARNING: DATABASE_URL unset — conversion will fail closed unless FX_RATES_SOURCE=static is explicitly enabled")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("DB error: %v", err)
		db = nil
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
	// MN-16 expand-migrate.
	for _, stmt := range []string{
		`ALTER TABLE tb_fx_transfers ADD COLUMN IF NOT EXISTS quote_id VARCHAR(128)`,
		`ALTER TABLE tb_fx_transfers ADD COLUMN IF NOT EXISTS rate_source VARCHAR(32)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS tb_fx_transfers_quote_uidx ON tb_fx_transfers (quote_id) WHERE quote_id IS NOT NULL`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("schema migration: %v", err)
		}
	}
	db.Exec(`CREATE TABLE IF NOT EXISTS tb_netting_groups (
		corridor VARCHAR(16) PRIMARY KEY,
		gross_amount_kobo BIGINT NOT NULL DEFAULT 0,
		net_amount_kobo BIGINT NOT NULL DEFAULT 0,
		saved_kobo BIGINT NOT NULL DEFAULT 0,
		txn_count INTEGER NOT NULL DEFAULT 0
	)`)
	// Seed ledgers (metadata + fallback rates).
	for _, l := range currencyLedgers {
		db.Exec(`INSERT INTO tb_currency_ledgers (ledger_id, currency, symbol, decimals, country, mid_rate_to_ngn, spread_bps)
			VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (ledger_id) DO NOTHING`,
			l.LedgerID, l.Currency, l.Symbol, l.Decimals, l.Country, l.MidRate, l.Spread)
	}
	log.Println("[tb-multicurrency-ledger] Schema initialized")
}

func fxConvertHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FromCurrency  string `json:"from_currency"`
		ToCurrency    string `json:"to_currency"`
		AmountKobo    int64  `json:"amount_kobo"`
		FromAccountID string `json:"from_account_id"` // real TB account id (hex), from-currency ledger
		ToAccountID   string `json:"to_account_id"`   // real TB account id (hex), to-currency ledger
		QuoteID       string `json:"quote_id"`        // idempotency key; generated when omitted
		RateLockToken string `json:"rate_lock_token"` // quote-side HMAC token (shared contract with R2)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", 400)
		return
	}
	if req.AmountKobo <= 0 {
		jsonErr(w, "amount_kobo must be positive", 400)
		return
	}
	fromLedger, ok1 := currencyLedgers[strings.ToUpper(req.FromCurrency)]
	toLedger, ok2 := currencyLedgers[strings.ToUpper(req.ToCurrency)]
	if !ok1 || !ok2 {
		jsonErr(w, "unsupported currency", 400)
		return
	}
	if fromLedger.Currency == toLedger.Currency {
		jsonErr(w, "from_currency and to_currency must differ", 400)
		return
	}
	if db == nil || tbClient == nil {
		jsonErr(w, "store or ledger unavailable — conversion NOT executed", 503)
		return
	}
	if req.FromAccountID == "" || req.ToAccountID == "" {
		jsonErr(w, "from_account_id and to_account_id (real TB account ids) are required", 400)
		return
	}
	fromAcct, err := parseTBAccountID(req.FromAccountID)
	if err != nil {
		jsonErr(w, "from_account_id: "+err.Error(), 400)
		return
	}
	toAcct, err := parseTBAccountID(req.ToAccountID)
	if err != nil {
		jsonErr(w, "to_account_id: "+err.Error(), 400)
		return
	}

	// Rate-lock token (validated fail-closed) overrides the configured source.
	var lockedRateScaled int64
	lockedRate := false
	quoteID := strings.TrimSpace(req.QuoteID)
	if req.RateLockToken != "" {
		rs, qid, verr := validateRateLockToken(req.RateLockToken, req.AmountKobo)
		if verr != nil {
			jsonErr(w, verr.Error(), 400)
			return
		}
		lockedRate = true
		lockedRateScaled = rs
		if quoteID == "" {
			quoteID = qid
		}
	}
	if quoteID == "" {
		// No caller-supplied idempotency key: generate one and return it;
		// retries must pass the same quote_id (documented contract).
		quoteID = fmt.Sprintf("fxq-%d", time.Now().UnixNano())
	}

	tenantID := r.Header.Get("X-Tenant-ID") // stamped by jwtAuthMiddleware from verified claims
	rateScaled, cross, spreadBps, rateSource, rerr := resolveRate(r, fromLedger, toLedger, tenantID)
	if rerr != nil {
		jsonErr(w, "rate unavailable — conversion NOT executed: "+rerr.Error(), 503)
		return
	}
	if lockedRate && lockedRateScaled > 0 {
		rateScaled, cross, rateSource = lockedRateScaled, nil, "rate-lock-token"
	}
	if cross != nil {
		// record the effective pair rate (metadata only; math uses the cross mids)
		rateScaled = int64(cross.fromMid/cross.toMid*1_000_000 + 0.5)
	}

	toAmount := convertKobo(req.AmountKobo, fromLedger, toLedger, rateScaled, cross, spreadBps, lockedRate)
	if toAmount <= 0 {
		jsonErr(w, "conversion result rounds to zero", 400)
		return
	}

	// Resolve house accounts (fail-closed) and validate customer accounts on
	// the expected ledgers.
	houseFromHex := os.Getenv("FX_HOUSE_ACCOUNT_" + fromLedger.Currency)
	houseToHex := os.Getenv("FX_HOUSE_ACCOUNT_" + toLedger.Currency)
	if houseFromHex == "" || houseToHex == "" {
		jsonErr(w, fmt.Sprintf("FX house accounts not configured (FX_HOUSE_ACCOUNT_%s / FX_HOUSE_ACCOUNT_%s) — conversion NOT executed", fromLedger.Currency, toLedger.Currency), 503)
		return
	}
	houseFrom, err := parseTBAccountID(houseFromHex)
	if err != nil {
		jsonErr(w, "FX_HOUSE_ACCOUNT_"+fromLedger.Currency+" is not a valid TB account id", 500)
		return
	}
	houseTo, err := parseTBAccountID(houseToHex)
	if err != nil {
		jsonErr(w, "FX_HOUSE_ACCOUNT_"+toLedger.Currency+" is not a valid TB account id", 500)
		return
	}
	accts, err := tbClient.LookupAccounts(r.Context(), []tbclient.Uint128{fromAcct, toAcct})
	if err != nil || len(accts) != 2 {
		jsonErr(w, "from/to TB accounts not found — conversion NOT executed", 422)
		return
	}
	if accts[0].Ledger != fromLedger.LedgerID || accts[1].Ledger != toLedger.LedgerID {
		jsonErr(w, "account ledger does not match requested currency", 422)
		return
	}

	// MN-16: REAL linked-transfer pair across currency ledgers. Linked flag on
	// leg A makes the pair atomic in TB (TransferFlagsLinked semantics).
	idA := detID("fx:" + quoteID + ":A")
	idB := detID("fx:" + quoteID + ":B")
	transfers := []tbclient.Transfer{
		{
			ID:              idA,
			DebitAccountID:  fromAcct,
			CreditAccountID: houseFrom,
			Amount:          tbclient.ToUint128(uint64(req.AmountKobo)),
			Ledger:          fromLedger.LedgerID,
			Code:            1,
			Flags:           tbclient.TransferFlags{Linked: true}.ToUint16(),
		},
		{
			ID:              idB,
			DebitAccountID:  houseTo,
			CreditAccountID: toAcct,
			Amount:          tbclient.ToUint128(uint64(toAmount)),
			Ledger:          toLedger.LedgerID,
			Code:            1,
		},
	}
	results, terr := tbClient.CreateTransfers(r.Context(), transfers)
	status := "executed"
	tbResult := "success"
	if terr != nil {
		status = "failed"
		tbResult = "error: " + terr.Error()
	} else {
		for _, res := range results {
			// TransferExists on either leg = idempotent retry of a prior execution.
			if res.Status != tbclient.TransferExists {
				status = "failed"
				tbResult = fmt.Sprintf("rejected: status=%d", uint32(res.Status))
				break
			}
		}
	}

	transfer := FXTransfer{
		ID:              quoteID,
		QuoteID:         quoteID,
		FromCurrency:    fromLedger.Currency,
		ToCurrency:      toLedger.Currency,
		FromAmountKobo:  req.AmountKobo,
		ToAmountKobo:    toAmount,
		RateScaled:      rateScaled,
		SpreadBps:       spreadBps,
		RateSource:      rateSource,
		FromLedger:      fromLedger.LedgerID,
		ToLedger:        toLedger.LedgerID,
		LinkedTransferA: u128Hex(idA),
		LinkedTransferB: u128Hex(idB),
		Status:          status,
		CreatedAt:       time.Now(),
	}

	// Persist the real outcome (executed or failed) — the in-memory "executed"
	// strings are gone.
	if _, err := db.ExecContext(r.Context(), `INSERT INTO tb_fx_transfers (id, quote_id, from_currency, to_currency, from_amount_kobo, to_amount_kobo, rate, spread_bps, rate_source, from_ledger, to_ledger, linked_transfer_a, linked_transfer_b, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
		transfer.ID, transfer.QuoteID, transfer.FromCurrency, transfer.ToCurrency, transfer.FromAmountKobo, transfer.ToAmountKobo,
		float64(transfer.RateScaled)/1_000_000, transfer.SpreadBps, transfer.RateSource, transfer.FromLedger, transfer.ToLedger,
		transfer.LinkedTransferA, transfer.LinkedTransferB, transfer.Status, transfer.CreatedAt); err != nil {
		log.Printf("[tb-multicurrency-ledger] persist fx transfer: %v", err)
	}

	if status != "executed" {
		jsonErr(w, "ledger transfer failed — conversion NOT executed: "+tbResult, 502)
		return
	}

	// Netting analytics (derived from executed conversions only).
	fxMu.Lock()
	if nettingGroups == nil {
		nettingGroups = make(map[string]*NettingGroup)
	}
	corridor := fmt.Sprintf("%s→%s", fromLedger.Currency, toLedger.Currency)
	ng, ok := nettingGroups[corridor]
	if !ok {
		ng = &NettingGroup{Corridor: corridor}
		nettingGroups[corridor] = ng
	}
	ng.GrossAmount += req.AmountKobo
	ng.TxnCount++
	reverse := fmt.Sprintf("%s→%s", toLedger.Currency, fromLedger.Currency)
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transfer":  transfer,
		"tb_result": tbResult,
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
	json.NewEncoder(w).Encode(map[string]interface{}{
		"currency_ledgers": list,
		"count":            len(list),
		"rate_source":      getEnv("FX_RATES_SOURCE", "db"),
		"static_rates":     "fallback only; enabled solely when FX_ALLOW_STATIC_RATES=true",
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-multicurrency-ledger-go"}`))
}

func initTBClient() {
	var cfg tbclient.Config
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-multicurrency-ledger] TB client init failed (conversion fails closed): %v", err)
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
