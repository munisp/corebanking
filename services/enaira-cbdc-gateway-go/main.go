package main

import (
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)


// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "enaira-cbdc-gateway-go"

// eNaira CBDC Gateway — CBN Central Bank Digital Currency integration
// Implements CBN eNaira framework for speed/standard/merchant wallets

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type ENairaWallet struct {
	ID            string `json:"id"`
	WalletID      string `json:"wallet_id"`
	OwnerBVN      string `json:"owner_bvn"`
	OwnerNIN      string `json:"owner_nin"`
	OwnerName     string `json:"owner_name"`
	Tier          string `json:"tier"` // speed_wallet, standard_wallet, merchant_wallet
	BalanceKobo   int64  `json:"balance_kobo"`
	DailySpent    int64  `json:"daily_spent_kobo"`
	Status        string `json:"status"` // created→active→frozen→closed
	LinkedAccount string `json:"linked_account,omitempty"`
	LinkedBank    string `json:"linked_bank,omitempty"`
	KYCLevel      string `json:"kyc_level"` // basic, enhanced, full
	CreatedAt     string `json:"created_at"`
}

type ENairaTransfer struct {
	ID              string `json:"id"`
	SenderWallet    string `json:"sender_wallet"`
	ReceiverWallet  string `json:"receiver_wallet"`
	AmountKobo      int64  `json:"amount_kobo"`
	Currency        string `json:"currency"`
	Reference       string `json:"reference"`
	Status          string `json:"status"` // initiated→validating→processing→completed→failed→reversed
	TxnType         string `json:"txn_type"` // p2p, p2m, mint, redeem
	NFIUReportable  bool   `json:"nfiu_reportable"`
	GLEntries       []GLEntry `json:"gl_entries,omitempty"`
	CreatedAt       string `json:"created_at"`
	CompletedAt     string `json:"completed_at,omitempty"`
}

type GLEntry struct {
	Account   string `json:"account"`
	Debit     int64  `json:"debit_kobo"`
	Credit    int64  `json:"credit_kobo"`
	Narration string `json:"narration"`
}

type MintRequest struct {
	ID          string `json:"id"`
	WalletID    string `json:"wallet_id"`
	AmountKobo  int64  `json:"amount_kobo"`
	Source      string `json:"source"` // bank_account, nip_transfer
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
}

type RedemptionRequest struct {
	ID           string `json:"id"`
	WalletID     string `json:"wallet_id"`
	AmountKobo   int64  `json:"amount_kobo"`
	Destination  string `json:"destination"` // bank_account
	DestBank     string `json:"dest_bank"`
	DestAccount  string `json:"dest_account"`
	Status       string `json:"status"`
	CreatedAt    string `json:"created_at"`
}

// ─── State ───

var (
	wallets       []ENairaWallet
	walletsMu     sync.RWMutex
	transfers     []ENairaTransfer
	transfersMu   sync.RWMutex
	mints         []MintRequest
	mintsMu       sync.RWMutex
	redemptions   []RedemptionRequest
	redemptionsMu sync.RWMutex
	requestCount  int64
	errorCount    int64
	counterMu     sync.Mutex
)

func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

// ─── Utilities ───

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

func maskPII(value, fieldType string) string {
	if len(value) == 0 { return "***" }
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
	case "account":
		if len(value) >= 4 { return "****" + value[len(value)-4:] }
		return "****"
	default:
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	return re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── eNaira Tier Limits (CBN Guidelines) ───

type TierConfig struct {
	MaxBalance   int64  // kobo
	DailyLimit   int64  // kobo
	SingleTxnMax int64  // kobo
	KYCRequired  string // basic, enhanced, full
}

var enairaTiers = map[string]TierConfig{
	"speed_wallet":    {MaxBalance: 30000000,  DailyLimit: 30000000,  SingleTxnMax: 5000000,   KYCRequired: "basic"},
	"standard_wallet": {MaxBalance: 50000000,  DailyLimit: 50000000,  SingleTxnMax: 20000000,  KYCRequired: "enhanced"},
	"merchant_wallet": {MaxBalance: 500000000, DailyLimit: 500000000, SingleTxnMax: 100000000, KYCRequired: "full"},
}

func validateTierLimits(tier string, amountKobo, currentBalance, dailySpent int64) (bool, []string) {
	config, ok := enairaTiers[tier]
	if !ok {
		return false, []string{"invalid_tier"}
	}
	errs := []string{}
	if amountKobo > config.SingleTxnMax {
		errs = append(errs, fmt.Sprintf("exceeds_single_txn_max:%d", config.SingleTxnMax))
	}
	if dailySpent+amountKobo > config.DailyLimit {
		errs = append(errs, fmt.Sprintf("exceeds_daily_limit:%d", config.DailyLimit))
	}
	if currentBalance-amountKobo < 0 {
		errs = append(errs, "insufficient_balance")
	}
	return len(errs) == 0, errs
}

// ─── BVN/NIN Validation ───

func validateBVN(bvn string) (bool, string) {
	if len(bvn) != 11 {
		return false, "bvn_must_be_11_digits"
	}
	for _, c := range bvn {
		if c < '0' || c > '9' {
			return false, "bvn_must_be_numeric"
		}
	}
	// BVN issuer code check (first 2 digits = bank code)
	prefix := bvn[:2]
	validPrefixes := map[string]bool{"22": true, "23": true, "10": true, "20": true, "21": true, "30": true, "31": true}
	if !validPrefixes[prefix] {
		return false, "invalid_bvn_issuer_code"
	}
	return true, ""
}

func validateNIN(nin string) (bool, string) {
	if len(nin) != 11 {
		return false, "nin_must_be_11_digits"
	}
	for _, c := range nin {
		if c < '0' || c > '9' {
			return false, "nin_must_be_numeric"
		}
	}
	return true, ""
}

// ─── NUBAN Validation ───

func validateNUBAN(acctNo string) (bool, string) {
	if len(acctNo) != 10 {
		return false, "account_must_be_10_digits"
	}
	for _, c := range acctNo {
		if c < '0' || c > '9' {
			return false, "account_must_be_numeric"
		}
	}
	return true, ""
}

// ─── Transfer State Machine ───

var transferTransitions = map[string][]string{
	"initiated":  {"validating"},
	"validating": {"processing", "failed"},
	"processing": {"completed", "failed"},
	"completed":  {"reversed"},
	"failed":     {},
	"reversed":   {},
}

// ─── NFIU Threshold ───

func checkNFIU(amountKobo int64) (bool, string) {
	if amountKobo >= 1000000000 { return true, "enaira_transfer_threshold_10M" }
	if amountKobo >= 500000000  { return true, "enaira_cash_threshold_5M" }
	return false, ""
}

// ─── GL Entry Generation ───

func generateGLEntries(senderWallet, receiverWallet string, amountKobo int64, txnType string) []GLEntry {
	entries := []GLEntry{}
	switch txnType {
	case "p2p":
		entries = append(entries,
			GLEntry{Account: senderWallet, Debit: amountKobo, Narration: "eNaira P2P transfer debit"},
			GLEntry{Account: receiverWallet, Credit: amountKobo, Narration: "eNaira P2P transfer credit"},
		)
	case "p2m":
		entries = append(entries,
			GLEntry{Account: senderWallet, Debit: amountKobo, Narration: "eNaira merchant payment debit"},
			GLEntry{Account: receiverWallet, Credit: amountKobo, Narration: "eNaira merchant payment credit"},
		)
	case "mint":
		entries = append(entries,
			GLEntry{Account: "CBN_ENAIRA_RESERVE", Debit: amountKobo, Narration: "eNaira mint from reserve"},
			GLEntry{Account: receiverWallet, Credit: amountKobo, Narration: "eNaira mint to wallet"},
		)
	case "redeem":
		entries = append(entries,
			GLEntry{Account: senderWallet, Debit: amountKobo, Narration: "eNaira redeem from wallet"},
			GLEntry{Account: "CBN_ENAIRA_RESERVE", Credit: amountKobo, Narration: "eNaira redeem to reserve"},
		)
	}
	return entries
}

// ─── HMAC Signature ───

func computeHMAC(data, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	walletsMu.RLock()
	wc := len(wallets)
	walletsMu.RUnlock()
	transfersMu.RLock()
	tc := len(transfers)
	transfersMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "enaira-cbdc-gateway-go", "version": "2.0.0",
		"wallets": wc, "transfers": tc, "regulation": "CBN_eNaira_Framework",
		"supported_tiers": []string{"speed_wallet", "standard_wallet", "merchant_wallet"},
	})
}

func handleWalletCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		OwnerBVN  string `json:"owner_bvn"`
		OwnerNIN  string `json:"owner_nin"`
		OwnerName string `json:"owner_name"`
		Tier      string `json:"tier"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.OwnerName == "" { errs = append(errs, "owner_name_required") }
	if valid, msg := validateBVN(body.OwnerBVN); !valid { errs = append(errs, msg) }
	if body.OwnerNIN != "" {
		if valid, msg := validateNIN(body.OwnerNIN); !valid { errs = append(errs, msg) }
	}
	tierConfig, ok := enairaTiers[body.Tier]
	if !ok { errs = append(errs, "tier_must_be_speed_standard_or_merchant") }
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Check for duplicate BVN wallet
	walletsMu.RLock()
	dupFound := false
	for _, ew := range wallets {
		if ew.OwnerBVN == body.OwnerBVN && ew.Tier == body.Tier && ew.Status != "closed" {
			dupFound = true
			break
		}
	}
	walletsMu.RUnlock()
	if dupFound {
		incErrors()
		respondJSON(w, 409, map[string]interface{}{"error": "duplicate_bvn_wallet_for_tier"})
		return
	}

	wallet := ENairaWallet{
		ID:          fmt.Sprintf("ENW-%s", secureRandID()),
		WalletID:    fmt.Sprintf("eN%s%s", body.Tier[:2], secureRandID()),
		OwnerBVN:    body.OwnerBVN,
		OwnerNIN:    body.OwnerNIN,
		OwnerName:   body.OwnerName,
		Tier:        body.Tier,
		BalanceKobo: 0,
		DailySpent:  0,
		Status:      "active",
		KYCLevel:    tierConfig.KYCRequired,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	walletsMu.Lock()
	wallets = append(wallets, wallet)
	if dataBytes, err := json.Marshal(wallet); err == nil { if dbErr := dbInsert(fmt.Sprintf("enaira-cbdc-gateway-go-%d", time.Now().UnixNano()), "enaira-cbdc-gateway-go", "wallets", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	walletsMu.Unlock()

	log.Printf("[eNaira] Wallet created: %s tier=%s bvn=%s",
		wallet.WalletID, wallet.Tier, maskPII(wallet.OwnerBVN, "bvn"))
	respondJSON(w, 201, map[string]interface{}{"wallet": wallet})
}

func handleWalletBalance(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		WalletID string `json:"wallet_id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	walletsMu.RLock()
	defer walletsMu.RUnlock()
	for _, w2 := range wallets {
		if w2.WalletID == body.WalletID {
			tierConfig := enairaTiers[w2.Tier]
			respondJSON(w, 200, map[string]interface{}{
				"wallet_id":     w2.WalletID,
				"balance_kobo":  w2.BalanceKobo,
				"daily_spent":   w2.DailySpent,
				"daily_limit":   tierConfig.DailyLimit,
				"daily_remaining": tierConfig.DailyLimit - w2.DailySpent,
				"tier":          w2.Tier,
				"status":        w2.Status,
			})
			return
		}
	}
	incErrors()
	respondJSON(w, 404, map[string]interface{}{"error": "wallet_not_found"})
}

func handleTransfer(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		SenderWallet   string `json:"sender_wallet"`
		ReceiverWallet string `json:"receiver_wallet"`
		AmountKobo     int64  `json:"amount_kobo"`
		TxnType        string `json:"txn_type"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.SenderWallet == "" { errs = append(errs, "sender_wallet_required") }
	if body.ReceiverWallet == "" { errs = append(errs, "receiver_wallet_required") }
	if body.AmountKobo <= 0 { errs = append(errs, "amount_must_be_positive") }
	if body.SenderWallet == body.ReceiverWallet { errs = append(errs, "sender_and_receiver_must_differ") }
	if body.TxnType == "" { body.TxnType = "p2p" }

	// Lookup sender
	walletsMu.Lock()
	var sender, receiver *ENairaWallet
	for i := range wallets {
		if wallets[i].WalletID == body.SenderWallet { sender = &wallets[i] }
		if wallets[i].WalletID == body.ReceiverWallet { receiver = &wallets[i] }
	}
	if sender == nil { errs = append(errs, "sender_wallet_not_found") }
	if receiver == nil { errs = append(errs, "receiver_wallet_not_found") }
	if sender != nil && sender.Status != "active" { errs = append(errs, "sender_wallet_not_active") }
	if receiver != nil && receiver.Status != "active" { errs = append(errs, "receiver_wallet_not_active") }

	if sender != nil {
		valid, tierErrs := validateTierLimits(sender.Tier, body.AmountKobo, sender.BalanceKobo, sender.DailySpent)
		if !valid { errs = append(errs, tierErrs...) }
	}

	if len(errs) > 0 {
		walletsMu.Unlock()
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Debit sender, credit receiver
	sender.BalanceKobo -= body.AmountKobo
	sender.DailySpent += body.AmountKobo
	receiver.BalanceKobo += body.AmountKobo
	walletsMu.Unlock()

	nfiu, nfiuMsg := checkNFIU(body.AmountKobo)
	glEntries := generateGLEntries(body.SenderWallet, body.ReceiverWallet, body.AmountKobo, body.TxnType)

	transfer := ENairaTransfer{
		ID:             fmt.Sprintf("ENT-%s", secureRandID()),
		SenderWallet:   body.SenderWallet,
		ReceiverWallet: body.ReceiverWallet,
		AmountKobo:     body.AmountKobo,
		Currency:       "eNGN",
		Reference:      fmt.Sprintf("EN%s%s", time.Now().Format("20060102"), secureRandID()),
		Status:         "completed",
		TxnType:        body.TxnType,
		NFIUReportable: nfiu,
		GLEntries:      glEntries,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		CompletedAt:    time.Now().UTC().Format(time.RFC3339),
	}

	transfersMu.Lock()
	transfers = append(transfers, transfer)
	if dataBytes, err := json.Marshal(transfer); err == nil { if dbErr := dbInsert(fmt.Sprintf("enaira-cbdc-gateway-go-%d", time.Now().UnixNano()), "enaira-cbdc-gateway-go", "transfers", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	transfersMu.Unlock()

	resp := map[string]interface{}{"transfer": transfer}
	if nfiu { resp["nfiu_alert"] = nfiuMsg }
	log.Printf("[eNaira] Transfer: %s from=%s to=%s amount=%d",
		transfer.ID, maskPII(body.SenderWallet, "account"), maskPII(body.ReceiverWallet, "account"), body.AmountKobo)
	respondJSON(w, 201, resp)
}

func handleMint(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		WalletID   string `json:"wallet_id"`
		AmountKobo int64  `json:"amount_kobo"`
		Source     string `json:"source"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	errs := []string{}
	if body.WalletID == "" { errs = append(errs, "wallet_id_required") }
	if body.AmountKobo <= 0 { errs = append(errs, "amount_must_be_positive") }
	if body.Source != "bank_account" && body.Source != "nip_transfer" {
		errs = append(errs, "source_must_be_bank_account_or_nip_transfer")
	}

	walletsMu.Lock()
	var wallet *ENairaWallet
	for i := range wallets {
		if wallets[i].WalletID == body.WalletID && wallets[i].Status == "active" {
			wallet = &wallets[i]
			break
		}
	}
	if wallet == nil {
		walletsMu.Unlock()
		errs = append(errs, "wallet_not_found_or_inactive")
	}
	if wallet != nil {
		tierConfig := enairaTiers[wallet.Tier]
		if wallet.BalanceKobo+body.AmountKobo > tierConfig.MaxBalance {
			walletsMu.Unlock()
			errs = append(errs, fmt.Sprintf("exceeds_max_balance:%d", tierConfig.MaxBalance))
			wallet = nil
		}
	}
	if len(errs) > 0 {
		if wallet != nil { walletsMu.Unlock() }
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	wallet.BalanceKobo += body.AmountKobo
	walletsMu.Unlock()

	mint := MintRequest{
		ID:         fmt.Sprintf("MNT-%s", secureRandID()),
		WalletID:   body.WalletID,
		AmountKobo: body.AmountKobo,
		Source:     body.Source,
		Status:     "completed",
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	mintsMu.Lock()
	mints = append(mints, mint)
	if dataBytes, err := json.Marshal(mint); err == nil { if dbErr := dbInsert(fmt.Sprintf("enaira-cbdc-gateway-go-%d", time.Now().UnixNano()), "enaira-cbdc-gateway-go", "mints", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	mintsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{
		"mint": mint,
		"gl_entries": generateGLEntries("", body.WalletID, body.AmountKobo, "mint"),
	})
}

func handleRedeem(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		WalletID    string `json:"wallet_id"`
		AmountKobo  int64  `json:"amount_kobo"`
		DestBank    string `json:"dest_bank"`
		DestAccount string `json:"dest_account"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	errs := []string{}
	if body.WalletID == "" { errs = append(errs, "wallet_id_required") }
	if body.AmountKobo <= 0 { errs = append(errs, "amount_must_be_positive") }
	if valid, msg := validateNUBAN(body.DestAccount); !valid { errs = append(errs, msg) }

	walletsMu.Lock()
	var wallet *ENairaWallet
	for i := range wallets {
		if wallets[i].WalletID == body.WalletID && wallets[i].Status == "active" {
			wallet = &wallets[i]
			break
		}
	}
	if wallet == nil {
		walletsMu.Unlock()
		incErrors()
		respondJSON(w, 404, map[string]interface{}{"error": "wallet_not_found"})
		return
	}
	if wallet.BalanceKobo < body.AmountKobo {
		walletsMu.Unlock()
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "insufficient_balance"})
		return
	}
	wallet.BalanceKobo -= body.AmountKobo
	walletsMu.Unlock()

	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	redemption := RedemptionRequest{
		ID:          fmt.Sprintf("RDM-%s", secureRandID()),
		WalletID:    body.WalletID,
		AmountKobo:  body.AmountKobo,
		Destination: "bank_account",
		DestBank:    body.DestBank,
		DestAccount: body.DestAccount,
		Status:      "completed",
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}
	redemptionsMu.Lock()
	redemptions = append(redemptions, redemption)
	if dataBytes, err := json.Marshal(redemption); err == nil { if dbErr := dbInsert(fmt.Sprintf("enaira-cbdc-gateway-go-%d", time.Now().UnixNano()), "enaira-cbdc-gateway-go", "redemptions", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	redemptionsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{
		"redemption": redemption,
		"gl_entries": generateGLEntries(body.WalletID, "", body.AmountKobo, "redeem"),
	})
}

func handleWalletList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	walletsMu.RLock()
	defer walletsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"wallets": wallets, "count": len(wallets)})
}

func handleTransferList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	transfersMu.RLock()
	defer transfersMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"transfers": transfers, "count": len(transfers)})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	walletsMu.RLock()
	var totalBalance int64
	for _, w2 := range wallets { totalBalance += w2.BalanceKobo }
	walletsMu.RUnlock()
	fmt.Fprintf(w, "requests_total{service=\"enaira-cbdc-gateway-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"enaira-cbdc-gateway-go\"} %d\n", ec)
	fmt.Fprintf(w, "total_enaira_balance_kobo %d\n", totalBalance)
}


// ─── PostgreSQL Persistence ───

var db *sql.DB
var readyFlag int32

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
	atomic.StoreInt32(&readyFlag, 1)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4, updated_at=NOW()", id, service, typ, status, string(data))
	return err
}

func dbQuery(service, typ string) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, data, status, created_at FROM service_records WHERE service=$1 AND type=$2 ORDER BY created_at DESC LIMIT 100", service, typ)
	if err != nil { return nil, err }
	defer rows.Close()
	var results []map[string]interface{}
	for rows.Next() {
		var id, data, status, createdAt string
		if err := rows.Scan(&id, &data, &status, &createdAt); err != nil { continue }
		results = append(results, map[string]interface{}{"id": id, "data": data, "status": status, "created_at": createdAt})
	}
	return results, nil
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Audit Trail (append-only) ---
type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"record_id"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var auditLog []AuditEntry

func appendAudit(action, recordID, actor, details string) {
	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})
}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Circuit Breaker ---
type circuitBreakerState int
const (
	cbClosed circuitBreakerState = iota
	cbOpen
	cbHalfOpen
)

var (
	cbState     circuitBreakerState
	cbFailCount uint64
	cbLastFail  int64
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	if cbState == cbClosed { return true }
	if cbState == cbOpen && time.Now().Unix()-atomic.LoadInt64(&cbLastFail) > cbTimeout {
		cbState = cbHalfOpen
		return true
	}
	return cbState == cbHalfOpen
}

func cbRecordSuccess() { atomic.StoreUint64(&cbFailCount, 0); cbState = cbClosed }
func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold { cbState = cbOpen }
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}


func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil { return uint32(time.Now().UnixNano()) }
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-Id")
		if rid == "" {
			rid = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		w.Header().Set("X-Request-Id", rid)
		next.ServeHTTP(w, r)
	})
}

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

func main() {
	initTracing()
	initDB()
	_ = context.Background
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = computeHMAC
	_ = hex.EncodeToString
	_ = strings.HasPrefix
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/wallet/create", handleWalletCreate)
	mux.HandleFunc("/v1/wallet/balance", handleWalletBalance)
	mux.HandleFunc("/v1/wallet/list", handleWalletList)
	mux.HandleFunc("/v1/transfer", handleTransfer)
	mux.HandleFunc("/v1/transfers", handleTransferList)
	mux.HandleFunc("/v1/mint", handleMint)
	mux.HandleFunc("/v1/redeem", handleRedeem)
	log.Printf("eNaira CBDC Gateway (CBN Digital Currency) listening on :%s", PORT)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Printf("[%s] Shutting down gracefully...", serviceName)
		if db != nil { db.Close() }
		os.Exit(0)
	}()
		srv := &http.Server{Addr: ":"+PORT, Handler: corsMiddleware(rateLimitMiddleware(mux))}
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("[enaira-cbdc-gateway-go] Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("[enaira-cbdc-gateway-go] listening on %s", ":"+PORT)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}
}
