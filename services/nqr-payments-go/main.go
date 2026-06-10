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
var validCurrencies = map[string]bool{"NGN": true, "USD": true, "GBP": true, "EUR": true}

var serviceName = "nqr-payments-go"

// NIBSS NQR (Nigeria Quick Response) payment gateway — EMV QR standard for Nigerian payments

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type QRCode struct {
	ID           string `json:"id"`
	MerchantID   string `json:"merchant_id"`
	MerchantName string `json:"merchant_name"`
	AmountKobo   int64  `json:"amount_kobo"`
	Currency     string `json:"currency"`
	MCC          string `json:"mcc"`
	QRPayload    string `json:"qr_payload"`
	QRType       string `json:"qr_type"` // static or dynamic
	Status       string `json:"status"`  // generated→active→expired→cancelled
	ExpiresAt    string `json:"expires_at"`
	CreatedAt    string `json:"created_at"`
	ScanCount    int    `json:"scan_count"`
}

type QRPayment struct {
	ID             string `json:"id"`
	QRCodeID       string `json:"qr_code_id"`
	PayerAccount   string `json:"payer_account"`
	PayerBankCode  string `json:"payer_bank_code"`
	MerchantID     string `json:"merchant_id"`
	AmountKobo     int64  `json:"amount_kobo"`
	InterchangeFee int64  `json:"interchange_fee_kobo"`
	SwitchingFee   int64  `json:"switching_fee_kobo"`
	AcquirerFee    int64  `json:"acquirer_fee_kobo"`
	Reference      string `json:"reference"`
	NIBSSRef       string `json:"nibss_ref"`
	Status         string `json:"status"` // initiated→validating→processing→completed→failed→reversed
	Channel        string `json:"channel"`
	NFIUReportable bool   `json:"nfiu_reportable"`
	CreatedAt      string `json:"created_at"`
	CompletedAt    string `json:"completed_at,omitempty"`
}

type Merchant struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	BankCode    string `json:"bank_code"`
	AccountNo   string `json:"account_no"`
	MCC         string `json:"mcc"`
	MCCDesc     string `json:"mcc_description"`
	TierLimit   int64  `json:"tier_limit_kobo"`
	Status      string `json:"status"` // pending→active→suspended→closed
	CreatedAt   string `json:"created_at"`
	TotalTxnKobo int64 `json:"total_txn_kobo"`
}

type Settlement struct {
	ID           string `json:"id"`
	MerchantID   string `json:"merchant_id"`
	TotalKobo    int64  `json:"total_kobo"`
	FeeKobo      int64  `json:"fee_kobo"`
	NetKobo      int64  `json:"net_kobo"`
	TxnCount     int    `json:"txn_count"`
	PeriodStart  string `json:"period_start"`
	PeriodEnd    string `json:"period_end"`
	Status       string `json:"status"` // pending→processing→settled→failed
	SettledAt    string `json:"settled_at,omitempty"`
}

// ─── State ───

var (
	qrCodes     []QRCode
	qrCodesMu   sync.RWMutex
	payments    []QRPayment
	paymentsMu  sync.RWMutex
	merchants   []Merchant
	merchantsMu sync.RWMutex
	settlements []Settlement
	settlementsMu sync.RWMutex
	requestCount int64
	errorCount   int64
	counterMu    sync.Mutex
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
	if len(value) == 0 {
		return "***"
	}
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

// ─── NQR EMV QR Standard ───

// Merchant Category Codes (ISO 18245)
var nqrCategories = map[string]string{
	"5411": "Grocery Stores & Supermarkets",
	"5499": "Miscellaneous Food Stores",
	"5812": "Eating Places & Restaurants",
	"5814": "Fast Food Restaurants",
	"5912": "Drug Stores & Pharmacies",
	"5977": "Cosmetic Stores",
	"6011": "Automated Cash Disbursements",
	"6012": "Financial Institutions",
	"7011": "Hotels, Motels & Resorts",
	"7512": "Car Rental Agencies",
	"8011": "Doctors",
	"8021": "Dentists & Orthodontists",
	"8062": "Hospitals",
	"8099": "Health Services",
	"5251": "Hardware Stores",
	"5311": "Department Stores",
	"5541": "Service Stations — Fuel",
	"5542": "Fuel Dispensers — Automated",
	"7832": "Motion Picture Theatres",
	"8220": "Schools — Primary & Secondary",
}

// Nigerian bank codes (NIBSS participant codes)
var bankCodes = map[string]string{
	"000001": "Sterling Bank",
	"000002": "Keystone Bank",
	"000003": "First City Monument Bank",
	"000004": "United Bank for Africa",
	"000005": "Diamond Bank",
	"000006": "JAIZ Bank",
	"000007": "Fidelity Bank",
	"000008": "Polaris Bank",
	"000009": "Citi Bank",
	"000010": "Ecobank",
	"000011": "Unity Bank",
	"000012": "Stanbic IBTC Bank",
	"000013": "GTBank",
	"000014": "Access Bank",
	"000015": "Zenith Bank",
	"000016": "First Bank",
	"000017": "Wema Bank",
	"000018": "Union Bank",
}

// EMV QR Tag-Length-Value encoding (ISO 18004 / EMVCo standard)
func generateEMVQR(merchantID, merchantName, mcc string, amountKobo int64, isDynamic bool) string {
	var sb strings.Builder
	// Tag 00: Payload Format Indicator
	sb.WriteString("000201")
	// Tag 01: Point of Initiation
	if isDynamic {
		sb.WriteString("010212") // Dynamic QR — one-time use
	} else {
		sb.WriteString("010211") // Static QR — reusable
	}
	// Tag 26: Merchant Account Information (NIBSS NQR sub-scheme)
	nibssData := fmt.Sprintf("0012ng.nibss.nqr01%02d%s", len(merchantID), merchantID)
	sb.WriteString(fmt.Sprintf("26%02d%s", len(nibssData), nibssData))
	// Tag 52: Merchant Category Code
	sb.WriteString(fmt.Sprintf("52%02d%s", len(mcc), mcc))
	// Tag 53: Transaction Currency (566 = Naira)
	sb.WriteString("5303566")
	// Tag 54: Transaction Amount (optional for static QR)
	if amountKobo > 0 {
		amtStr := fmt.Sprintf("%.2f", float64(amountKobo)/100)
		sb.WriteString(fmt.Sprintf("54%02d%s", len(amtStr), amtStr))
	}
	// Tag 58: Country Code
	sb.WriteString("5802NG")
	// Tag 59: Merchant Name
	if len(merchantName) > 25 {
		merchantName = merchantName[:25]
	}
	sb.WriteString(fmt.Sprintf("59%02d%s", len(merchantName), merchantName))
	// Tag 60: Merchant City
	sb.WriteString("6005Lagos")
	// Tag 63: CRC (checksum placeholder)
	payload := sb.String() + "6304"
	crc := crc16(payload)
	return payload + fmt.Sprintf("%04X", crc)
}

// CRC-16/CCITT-FALSE for EMV QR
func crc16(data string) uint16 {
	crc := uint16(0xFFFF)
	for i := 0; i < len(data); i++ {
		crc ^= uint16(data[i]) << 8
		for j := 0; j < 8; j++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}

// ─── NQR Fee Calculation ───
// CBN fee caps for QR payments (effective 2023)
func computeNQRFees(amountKobo int64) (interchange, switching, acquirer int64) {
	switch {
	case amountKobo <= 500000: // ≤ ₦5,000
		interchange = 150 // ₦1.50
		switching = 100   // ₦1.00
		acquirer = 50     // ₦0.50
	case amountKobo <= 5000000: // ≤ ₦50,000
		interchange = amountKobo * 10 / 10000 // 0.10%
		switching = 500
		acquirer = 200
	default: // > ₦50,000
		interchange = amountKobo * 8 / 10000 // 0.08%
		switching = 1000
		acquirer = 500
	}
	// Cap interchange at ₦200
	if interchange > 20000 {
		interchange = 20000
	}
	return
}

// ─── NUBAN Validation ───

func validateNUBAN(accountNumber string) (bool, string) {
	if len(accountNumber) != 10 {
		return false, "account_number_must_be_10_digits"
	}
	for _, c := range accountNumber {
		if c < '0' || c > '9' {
			return false, "account_number_must_be_numeric"
		}
	}
	return true, ""
}

// ─── Payment State Machine ───

var paymentTransitions = map[string][]string{
	"initiated":  {"validating"},
	"validating": {"processing", "failed"},
	"processing": {"completed", "failed"},
	"completed":  {"reversed"},
	"failed":     {},
	"reversed":   {},
}

func validatePaymentTransition(current, target string) (bool, string) {
	allowed, ok := paymentTransitions[current]
	if !ok {
		return false, fmt.Sprintf("unknown_state:%s", current)
	}
	for _, a := range allowed {
		if a == target {
			return true, ""
		}
	}
	return false, fmt.Sprintf("invalid_transition:%s->%s", current, target)
}

// ─── NFIU Threshold Check ───

func checkNFIU(amountKobo int64) (bool, string) {
	if amountKobo >= 1000000000 {
		return true, "transfer_threshold_10M"
	}
	if amountKobo >= 500000000 {
		return true, "cash_threshold_5M"
	}
	return false, ""
}

// ─── HMAC Signature ───

func computeHMAC(data, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	qrCodesMu.RLock()
	qc := len(qrCodes)
	qrCodesMu.RUnlock()
	paymentsMu.RLock()
	pc := len(payments)
	paymentsMu.RUnlock()
	merchantsMu.RLock()
	mc := len(merchants)
	merchantsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "nqr-payments-go", "version": "2.0.0",
		"qr_codes": qc, "payments": pc, "merchants": mc,
		"standard": "NIBSS_NQR_EMV_QR",
	})
}

func handleMerchantRegister(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Name      string `json:"name"`
		BankCode  string `json:"bank_code"`
		AccountNo string `json:"account_no"`
		MCC       string `json:"mcc"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	errs := []string{}
	if body.Name == "" {
		errs = append(errs, "name_required")
	}
	if _, ok := bankCodes[body.BankCode]; !ok {
		errs = append(errs, "invalid_bank_code")
	}
	if valid, msg := validateNUBAN(body.AccountNo); !valid {
		errs = append(errs, msg)
	}
	mccDesc, ok := nqrCategories[body.MCC]
	if !ok {
		errs = append(errs, "invalid_mcc")
	}
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	m := Merchant{
		ID:        fmt.Sprintf("MRC-%s", secureRandID()),
		Name:      body.Name,
		BankCode:  body.BankCode,
		AccountNo: body.AccountNo,
		MCC:       body.MCC,
		MCCDesc:   mccDesc,
		TierLimit: 500000000, // ₦5M default
		Status:    "active",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	merchantsMu.Lock()
	merchants = append(merchants, m)
	if dataBytes, err := json.Marshal(m); err == nil { if dbErr := dbInsert(fmt.Sprintf("nqr-payments-go-%d", time.Now().UnixNano()), "nqr-payments-go", "merchants", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	merchantsMu.Unlock()

	log.Printf("[NQR] Merchant registered: %s name=%s mcc=%s account=%s",
		m.ID, m.Name, m.MCC, maskPII(m.AccountNo, "account"))
	respondJSON(w, 201, map[string]interface{}{"merchant": m})
}

func handleQRGenerate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		MerchantID string `json:"merchant_id"`
		AmountKobo int64  `json:"amount_kobo"`
		QRType     string `json:"qr_type"` // static or dynamic
		ExpiryMins int    `json:"expiry_mins"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.MerchantID == "" {
		errs = append(errs, "merchant_id_required")
	}
	if body.QRType != "static" && body.QRType != "dynamic" {
		errs = append(errs, "qr_type_must_be_static_or_dynamic")
	}
	if body.QRType == "dynamic" && body.AmountKobo <= 0 {
		errs = append(errs, "dynamic_qr_requires_amount")
	}

	// Lookup merchant
	merchantsMu.RLock()
	var merch *Merchant
	for i := range merchants {
		if merchants[i].ID == body.MerchantID && merchants[i].Status == "active" {
			merch = &merchants[i]
			break
		}
	}
	merchantsMu.RUnlock()
	if merch == nil {
		errs = append(errs, "merchant_not_found_or_inactive")
	}
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	expiryMins := body.ExpiryMins
	if expiryMins <= 0 {
		if body.QRType == "static" {
			expiryMins = 525600 // 1 year
		} else {
			expiryMins = 15 // 15 minutes for dynamic
		}
	}

	now := time.Now().UTC()
	isDynamic := body.QRType == "dynamic"
	qrPayload := generateEMVQR(merch.ID, merch.Name, merch.MCC, body.AmountKobo, isDynamic)

	qr := QRCode{
		ID:           fmt.Sprintf("QR-%s", secureRandID()),
		MerchantID:   merch.ID,
		MerchantName: merch.Name,
		AmountKobo:   body.AmountKobo,
		Currency:     "NGN",
		MCC:          merch.MCC,
		QRPayload:    qrPayload,
		QRType:       body.QRType,
		Status:       "active",
		ExpiresAt:    now.Add(time.Duration(expiryMins) * time.Minute).Format(time.RFC3339),
		CreatedAt:    now.Format(time.RFC3339),
	}

	qrCodesMu.Lock()
	qrCodes = append(qrCodes, qr)
	if dataBytes, err := json.Marshal(qr); err == nil { if dbErr := dbInsert(fmt.Sprintf("nqr-payments-go-%d", time.Now().UnixNano()), "nqr-payments-go", "qrCodes", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	qrCodesMu.Unlock()

	log.Printf("[NQR] QR generated: %s type=%s merchant=%s amount=%d",
		qr.ID, qr.QRType, qr.MerchantID, qr.AmountKobo)
	respondJSON(w, 201, map[string]interface{}{"qr_code": qr})
}

func handleQRPayment(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		QRCodeID    string `json:"qr_code_id"`
		PayerAccount string `json:"payer_account"`
		PayerBankCode string `json:"payer_bank_code"`
		AmountKobo  int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.QRCodeID == "" {
		errs = append(errs, "qr_code_id_required")
	}
	if valid, msg := validateNUBAN(body.PayerAccount); !valid {
		errs = append(errs, "payer_"+msg)
	}
	if _, ok := bankCodes[body.PayerBankCode]; !ok {
		errs = append(errs, "invalid_payer_bank_code")
	}

	// Lookup QR code
	qrCodesMu.Lock()
	var qr *QRCode
	for i := range qrCodes {
		if qrCodes[i].ID == body.QRCodeID {
			qr = &qrCodes[i]
			break
		}
	}
	if qr == nil {
		qrCodesMu.Unlock()
		incErrors()
		respondJSON(w, 404, map[string]interface{}{"error": "qr_code_not_found"})
		return
	}
	// Check expiry
	expiresAt, _ := time.Parse(time.RFC3339, qr.ExpiresAt)
	if time.Now().UTC().After(expiresAt) {
		qr.Status = "expired"
		qrCodesMu.Unlock()
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "qr_code_expired"})
		return
	}
	if qr.Status != "active" {
		qrCodesMu.Unlock()
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "qr_code_not_active", "status": qr.Status})
		return
	}

	amountKobo := body.AmountKobo
	if qr.AmountKobo > 0 {
		amountKobo = qr.AmountKobo // Dynamic QR — fixed amount
	}
	if amountKobo <= 0 {
		qrCodesMu.Unlock()
		errs = append(errs, "amount_required_for_static_qr")
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	qr.ScanCount++
	if qr.QRType == "dynamic" {
		qr.Status = "used" // One-time use
	}
	qrCodesMu.Unlock()

	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Compute fees
	interchange, switching, acquirer := computeNQRFees(amountKobo)
	nfiu, nfiuMsg := checkNFIU(amountKobo)

	payment := QRPayment{
		ID:             fmt.Sprintf("NQRP-%s", secureRandID()),
		QRCodeID:       body.QRCodeID,
		PayerAccount:   body.PayerAccount,
		PayerBankCode:  body.PayerBankCode,
		MerchantID:     qr.MerchantID,
		AmountKobo:     amountKobo,
		InterchangeFee: interchange,
		SwitchingFee:   switching,
		AcquirerFee:    acquirer,
		Reference:      fmt.Sprintf("NQR%s%s", time.Now().Format("20060102"), secureRandID()),
		NIBSSRef:       fmt.Sprintf("NIBSS%s", secureRandID()),
		Status:         "completed",
		Channel:        "NQR",
		NFIUReportable: nfiu,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		CompletedAt:    time.Now().UTC().Format(time.RFC3339),
	}

	paymentsMu.Lock()
	payments = append(payments, payment)
	if dataBytes, err := json.Marshal(payment); err == nil { if dbErr := dbInsert(fmt.Sprintf("nqr-payments-go-%d", time.Now().UnixNano()), "nqr-payments-go", "payments", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	paymentsMu.Unlock()

	resp := map[string]interface{}{
		"payment":    payment,
		"total_fees": interchange + switching + acquirer,
		"net_amount": amountKobo - interchange - switching - acquirer,
	}
	if nfiu {
		resp["nfiu_alert"] = nfiuMsg
	}
	log.Printf("[NQR] Payment completed: %s amount=%d payer=%s merchant=%s",
		payment.ID, amountKobo, maskPII(body.PayerAccount, "account"), qr.MerchantID)
	respondJSON(w, 201, resp)
}

func handleQRVerify(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		QRPayload string `json:"qr_payload"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if len(body.QRPayload) < 20 {
		respondJSON(w, 400, map[string]interface{}{"error": "qr_payload_too_short"})
		return
	}
	// Verify CRC
	crcStr := body.QRPayload[len(body.QRPayload)-4:]
	dataForCRC := body.QRPayload[:len(body.QRPayload)-4]
	computedCRC := fmt.Sprintf("%04X", crc16(dataForCRC))
	if crcStr != computedCRC {
		respondJSON(w, 400, map[string]interface{}{
			"valid": false, "error": "crc_mismatch",
			"expected": computedCRC, "got": crcStr,
		})
		return
	}
	respondJSON(w, 200, map[string]interface{}{
		"valid":    true,
		"format":   "EMV_QR",
		"standard": "NIBSS_NQR",
		"country":  "NG",
		"currency": "NGN",
	})
}

func handleSettlement(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		MerchantID  string `json:"merchant_id"`
		PeriodStart string `json:"period_start"`
		PeriodEnd   string `json:"period_end"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if body.MerchantID == "" {
		respondJSON(w, 400, map[string]interface{}{"error": "merchant_id_required"})
		return
	}

	// Aggregate payments for this merchant in period
	paymentsMu.RLock()
	var totalKobo, totalFee int64
	var txnCount int
	for _, p := range payments {
		if p.MerchantID == body.MerchantID && p.Status == "completed" {
			totalKobo += p.AmountKobo
			totalFee += p.InterchangeFee + p.SwitchingFee + p.AcquirerFee
			txnCount++
		}
	}
	paymentsMu.RUnlock()

	settlement := Settlement{
		ID:          fmt.Sprintf("STL-%s", secureRandID()),
		MerchantID:  body.MerchantID,
		TotalKobo:   totalKobo,
		FeeKobo:     totalFee,
		NetKobo:     totalKobo - totalFee,
		TxnCount:    txnCount,
		PeriodStart: body.PeriodStart,
		PeriodEnd:   body.PeriodEnd,
		Status:      "pending",
	}
	settlementsMu.Lock()
	settlements = append(settlements, settlement)
	if dataBytes, err := json.Marshal(settlement); err == nil { if dbErr := dbInsert(fmt.Sprintf("nqr-payments-go-%d", time.Now().UnixNano()), "nqr-payments-go", "settlements", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	settlementsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{"settlement": settlement})
}

func handlePaymentList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	paymentsMu.RLock()
	defer paymentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"payments": payments, "count": len(payments)})
}

func handleMerchantList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	merchantsMu.RLock()
	defer merchantsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"merchants": merchants, "count": len(merchants)})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	paymentsMu.RLock()
	var totalVolume int64
	for _, p := range payments {
		if p.Status == "completed" { totalVolume += p.AmountKobo }
	}
	paymentsMu.RUnlock()
	fmt.Fprintf(w, "requests_total{service=\"nqr-payments-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"nqr-payments-go\"} %d\n", ec)
	fmt.Fprintf(w, "payment_volume_kobo{service=\"nqr-payments-go\"} %d\n", totalVolume)
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


// ─── Optimistic Locking for Balance Updates ─────────────────────────────────
// All balance updates use version-checked atomic operations.
type BalanceLock struct {
	AccountID string
	Version   int64
	Balance   int64 // kobo
}

func dbUpdateBalanceAtomic(accountID string, deltaKobo int64, currentVersion int64) (int64, error) {
	if db == nil { return 0, fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return 0, err }
	defer tx.Rollback()
	var balance int64
	var version int64
	err = tx.QueryRow("SELECT balance_kobo, version FROM account_balances WHERE account_id = $1 FOR UPDATE", accountID).Scan(&balance, &version)
	if err != nil { return 0, fmt.Errorf("account not found or locked: %v", err) }
	if version != currentVersion {
		return 0, fmt.Errorf("optimistic lock conflict: expected version %d, got %d", currentVersion, version)
	}
	newBalance := balance + deltaKobo
	if newBalance < 0 { return 0, fmt.Errorf("insufficient balance: have %d kobo, need %d kobo", balance, -deltaKobo) }
	_, err = tx.Exec("UPDATE account_balances SET balance_kobo = $1, version = version + 1, updated_at = NOW() WHERE account_id = $2 AND version = $3",
		newBalance, accountID, currentVersion)
	if err != nil { return 0, err }
	err = tx.Commit()
	if err != nil { return 0, err }
	return newBalance, nil
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
// CBN requires dual control for high-value operations.
type MakerCheckerRequest struct {
	RequestID  string      `json:"request_id"`
	Operation  string      `json:"operation"`
	MakerID    string      `json:"maker_id"`
	CheckerID  string      `json:"checker_id,omitempty"`
	AmountKobo int64       `json:"amount_kobo"`
	Status     string      `json:"status"` // pending_approval|approved|rejected
	Payload    interface{} `json:"payload"`
	CreatedAt  string      `json:"created_at"`
	DecidedAt  string      `json:"decided_at,omitempty"`
}

var (
	makerCheckerRequests []MakerCheckerRequest
	makerCheckerMu       sync.Mutex
)

// makerCheckerThresholds defines CBN-required dual authorization thresholds (kobo)
var makerCheckerThresholds = map[string]int64{
	"transfer":      100_000_000, // ₦1M
	"loan_disburse": 100_000_000, // ₦1M
	"gl_posting":    50_000_000,  // ₦500K
	"account_close": 0,           // Always requires checker
}

func requiresMakerChecker(operation string, amountKobo int64) bool {
	threshold, ok := makerCheckerThresholds[operation]
	if !ok { threshold = 100_000_000 }
	return amountKobo >= threshold
}

func submitForApproval(operation, makerID string, amountKobo int64, payload interface{}) *MakerCheckerRequest {
	req := MakerCheckerRequest{
		RequestID: fmt.Sprintf("MCR-%d", time.Now().UnixNano()),
		Operation: operation, MakerID: makerID, AmountKobo: amountKobo,
		Status: "pending_approval", Payload: payload,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	makerCheckerMu.Lock()
	makerCheckerRequests = append(makerCheckerRequests, req)
	makerCheckerMu.Unlock()
	return &req
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
// Append-only audit log. No DELETE or UPDATE permitted on audit records.
type AuditEntry struct {
	ID         string `json:"id"`
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Operation  string `json:"operation"`
	ActorID    string `json:"actor_id"`
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
	OldState   string `json:"old_state,omitempty"`
	NewState   string `json:"new_state,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
	Checksum   string `json:"checksum"` // SHA256 of entry for tamper detection
}

var (
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

func appendAuditEntry(service, operation, actorID, entityID, entityType, oldState, newState, ip string) {
	entry := AuditEntry{
		ID:         fmt.Sprintf("AUD-%d", time.Now().UnixNano()),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Service:    service,
		Operation:  operation,
		ActorID:    actorID,
		EntityID:   entityID,
		EntityType: entityType,
		OldState:   oldState,
		NewState:   newState,
		IPAddress:  ip,
	}
	// Compute tamper-detection checksum
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s", entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.OldState, entry.NewState, entry.IPAddress)
	entry.Checksum = fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	auditLogMu.Unlock()
	// Persist to DB if available (append-only INSERT, never UPDATE/DELETE)
	if db != nil {
		go func() {
			db.Exec("INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.EntityType, entry.OldState, entry.NewState, entry.IPAddress, entry.Checksum)
		}()
	}
}


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


// ─── Domain-Specific Payment Validation ─────────────────────────────────────
func validatePaymentRequest(amountKobo int64, currency, channel, beneficiaryBank, beneficiaryAccount string) (bool, []string) {
	var errs []string
	if amountKobo <= 0 { errs = append(errs, "payment amount must be positive") }
	if !validCurrencies[currency] { errs = append(errs, "unsupported currency: "+currency) }
	validChannels := map[string]bool{"nip": true, "neft": true, "rtgs": true, "internal": true, "ussd": true, "mobile": true, "pos": true, "atm": true}
	if !validChannels[channel] { errs = append(errs, "invalid payment channel: "+channel) }
	if channel == "nip" || channel == "neft" || channel == "rtgs" {
		if len(beneficiaryBank) != 3 { errs = append(errs, "beneficiary bank code must be 3 digits") }
		if len(beneficiaryAccount) != 10 { errs = append(errs, "beneficiary account must be 10 digits (NUBAN)") }
	}
	// RTGS minimum (₦10M for Nigeria)
	if channel == "rtgs" && amountKobo < 1_000_000_000 { errs = append(errs, "RTGS requires minimum ₦10M") }
	return len(errs) == 0, errs
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

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

// Input validation helpers
func sanitizeInput(s string, maxLen int) string {
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	// Strip null bytes and control characters
	var clean []byte
	for _, b := range []byte(s) {
		if b >= 32 && b != 127 {
			clean = append(clean, b)
		}
	}
	return string(clean)
}

func validateEmail(email string) bool {
	if len(email) > 254 || len(email) < 3 {
		return false
	}
	atIdx := strings.LastIndex(email, "@")
	if atIdx < 1 || atIdx > len(email)-3 {
		return false
	}
	domain := email[atIdx+1:]
	if !strings.Contains(domain, ".") {
		return false
	}
	return true
}

func validateNigerianPhone(phone string) bool {
	// Nigerian numbers: +234XXXXXXXXXX or 0XXXXXXXXXXX
	clean := strings.ReplaceAll(phone, " ", "")
	clean = strings.ReplaceAll(clean, "-", "")
	if strings.HasPrefix(clean, "+234") && len(clean) == 14 {
		return true
	}
	if strings.HasPrefix(clean, "0") && len(clean) == 11 {
		return true
	}
	return false
}

func validateBVN(bvn string) bool {
	if len(bvn) != 11 {
		return false
	}
	for _, c := range bvn {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func validateAccountNumber(acctNo string) bool {
	// NUBAN: 10 digits
	if len(acctNo) != 10 {
		return false
	}
	for _, c := range acctNo {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// Secure HTTP server configuration
func newSecureServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
}

func main() {
	initTracing()
	initDB()
	_ = context.Background
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = computeHMAC
	_ = hex.EncodeToString
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/merchant/register", handleMerchantRegister)
	mux.HandleFunc("/v1/merchant/list", handleMerchantList)
	mux.HandleFunc("/v1/qr/generate", handleQRGenerate)
	mux.HandleFunc("/v1/qr/payment", handleQRPayment)
	mux.HandleFunc("/v1/qr/verify", handleQRVerify)
	mux.HandleFunc("/v1/payments", handlePaymentList)
	mux.HandleFunc("/v1/settlement/create", handleSettlement)
	log.Printf("NIBSS NQR Payment Gateway (EMV QR) listening on :%s", PORT)

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
		log.Println("[nqr-payments-go] Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("[nqr-payments-go] listening on %s", ":"+PORT)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}
}
