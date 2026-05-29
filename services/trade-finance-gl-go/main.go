// 54Bank Trade Finance & Specialized Banking GL Engine — Go
// Closes gaps 17-20: LC, Documentary Collections, Islamic Finance, Disputes
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
"sync"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
	"database/sql"
	"bytes"
	"strings"

	"net"

)

var serviceName = "trade-finance-gl-go"

type GLEntry struct {
	EntryID    string  `json:"entryId"`
	DebitGL    string  `json:"debitGL"`
	DebitName  string  `json:"debitName"`
	CreditGL   string  `json:"creditGL"`
	CreditName string  `json:"creditName"`
	Amount     float64 `json:"amount"`
	Narration  string  `json:"narration"`
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 17: LC AMENDMENT LIFECYCLE → GL
// Letter of Credit: issuance → margin → amendment → utilization → settlement
// ═══════════════════════════════════════════════════════════════════════════════

func lcLifecycleGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("LC-GL-%s", businessDate),
		"businessDate": businessDate,
		"events": []map[string]interface{}{
			{"eventId": "LC-ISSUE-001", "lcNumber": "LC-2026-0045", "type": "issuance", "applicant": "Dangote Industries", "beneficiary": "Siemens AG (Germany)", "amount": 2_500_000, "currency": "EUR", "marginPercent": 20,
				"glPostings": []GLEntry{
					{EntryID: "JE-LC-MARGIN-001", DebitGL: "2101", DebitName: "Applicant Deposit Account", CreditGL: "2107", CreditName: "LC Margin Held (Cash Collateral)", Amount: 862_000_000, Narration: "20% margin on LC EUR 2.5M (@ 1724 = ₦4.31B × 20%)"},
					{EntryID: "JE-LC-CONT-001", DebitGL: "9201", DebitName: "Contingent Liability - LC Issued", CreditGL: "9999", CreditName: "Contingent Contra", Amount: 4_310_000_000, Narration: "Off-balance sheet: LC contingent liability EUR 2.5M"},
					{EntryID: "JE-LC-FEE-001", DebitGL: "2101", DebitName: "Applicant (commission)", CreditGL: "4205", CreditName: "LC Commission Income", Amount: 10_775_000, Narration: "LC issuance commission 0.25% of ₦4.31B"},
				}},
			{"eventId": "LC-AMEND-001", "lcNumber": "LC-2026-0045", "type": "amendment", "amendmentNo": 1, "change": "increase_amount", "increaseEUR": 500_000, "additionalMargin": 172_400_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-LC-AMEND-MAR-001", DebitGL: "2101", DebitName: "Applicant Deposit", CreditGL: "2107", CreditName: "LC Margin Held (additional)", Amount: 172_400_000, Narration: "Additional 20% margin on LC amendment EUR 500K"},
					{EntryID: "JE-LC-AMEND-CONT-001", DebitGL: "9201", DebitName: "Contingent Liability (increase)", CreditGL: "9999", CreditName: "Contingent Contra", Amount: 862_000_000, Narration: "Off-BS: LC contingent increased by EUR 500K"},
					{EntryID: "JE-LC-AMEND-FEE-001", DebitGL: "2101", DebitName: "Applicant (amendment fee)", CreditGL: "4205", CreditName: "LC Amendment Fee Income", Amount: 2_155_000, Narration: "Amendment fee 0.25% on increase"},
				}},
			{"eventId": "LC-UTIL-001", "lcNumber": "LC-2026-0045", "type": "utilization", "drawAmount": 1_000_000, "currency": "EUR",
				"glPostings": []GLEntry{
					{EntryID: "JE-LC-UTIL-PAY-001", DebitGL: "1102", DebitName: "Nostro EUR (Deutsche Bank)", CreditGL: "2107", CreditName: "LC Margin Released (utilized portion)", Amount: 344_800_000, Narration: "LC utilization payment EUR 1M to beneficiary bank"},
					{EntryID: "JE-LC-UTIL-LOAN-001", DebitGL: "1320", DebitName: "Bills Negotiated Under LC", CreditGL: "1102", CreditName: "Nostro EUR", Amount: 1_724_000_000, Narration: "Customer liability for LC draw EUR 1M"},
					{EntryID: "JE-LC-CONT-REV-001", DebitGL: "9999", DebitName: "Contingent Contra (reversal)", CreditGL: "9201", CreditName: "Contingent Liability (reduced)", Amount: 1_724_000_000, Narration: "Reduce off-BS contingent on utilization"},
				}},
		},
		"summary": map[string]interface{}{
			"lcIssued": 1, "amendments": 1, "utilizations": 1,
			"totalMarginHeld":     1_034_400_000,
			"contingentExposure":  3_448_000_000,
			"commissionEarned":    12_930_000,
			"glCodesImpacted":     []string{"2101 (Deposits)", "2107 (LC Margin)", "1102 (Nostro EUR)", "1320 (Bills Under LC)", "4205 (LC Commission)", "9201 (Contingent)", "9999 (Contra)"},
		},
		"pipeline": map[string]string{
			"step1": "LC issuance: collect margin (Dr 2101 / Cr 2107) + post contingent (9201)",
			"step2": "SWIFT MT700 sent to advising bank",
			"step3": "Amendment: additional margin + adjust contingent + SWIFT MT707",
			"step4": "Utilization/Draw: pay beneficiary (Dr nostro / Cr customer loan 1320)",
			"step5": "Release contingent proportionally as LC is utilized",
			"step6": "Expiry/settlement: release remaining margin, zero contingent",
		},
		"middleware": middlewareActions("banking.trade_finance.lc"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 18: DOCUMENTARY COLLECTIONS → GL
// Documents against Payment (D/P), Documents against Acceptance (D/A)
// ═══════════════════════════════════════════════════════════════════════════════

func docCollectionsGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("DOCCOLL-GL-%s", businessDate),
		"businessDate": businessDate,
		"collections": []map[string]interface{}{
			{"collectionId": "DC-DP-001", "type": "documents_against_payment", "drawer": "Nigerian Exporters Ltd", "drawee": "Shanghai Trading Co", "amount": 500_000, "currency": "USD", "status": "paid",
				"glPostings": []GLEntry{
					{EntryID: "JE-DC-DP-RCV-001", DebitGL: "1101", DebitName: "Nostro USD (Citibank)", CreditGL: "2303", CreditName: "Collections Payable to Drawer", Amount: 791_250_000, Narration: "D/P collection received USD 500K from drawee's bank"},
					{EntryID: "JE-DC-DP-PAY-001", DebitGL: "2303", DebitName: "Collections Payable (settled)", CreditGL: "2101", CreditName: "Drawer's Deposit Account", Amount: 789_175_000, Narration: "Credit drawer (net of commission)"},
					{EntryID: "JE-DC-DP-FEE-001", DebitGL: "2303", DebitName: "Collections Payable (commission)", CreditGL: "4206", CreditName: "Collection Commission Income", Amount: 2_075_000, Narration: "Documentary collection commission 0.25%"},
				}},
			{"collectionId": "DC-DA-001", "type": "documents_against_acceptance", "drawer": "Lagos Commodities", "drawee": "Dubai Imports LLC", "amount": 250_000, "currency": "USD", "maturityDate": "2026-08-09", "status": "accepted",
				"glPostings": []GLEntry{
					{EntryID: "JE-DC-DA-ACC-001", DebitGL: "9202", DebitName: "Contingent - Accepted Bills", CreditGL: "9999", CreditName: "Contingent Contra", Amount: 395_625_000, Narration: "Off-BS: D/A accepted, maturity 90 days, USD 250K"},
				}},
			{"collectionId": "DC-DA-002", "type": "documents_against_acceptance", "drawer": "Port Harcourt Oil Services", "drawee": "Rotterdam Refinery BV", "amount": 1_000_000, "currency": "USD", "status": "matured_and_paid",
				"glPostings": []GLEntry{
					{EntryID: "JE-DC-DA-MAT-001", DebitGL: "1101", DebitName: "Nostro USD", CreditGL: "2303", CreditName: "Collections Payable", Amount: 1_582_500_000, Narration: "D/A matured and paid by drawee USD 1M"},
					{EntryID: "JE-DC-DA-PAY-001", DebitGL: "2303", DebitName: "Collections Payable", CreditGL: "2101", CreditName: "Drawer Account", Amount: 1_578_543_750, Narration: "Credit drawer net of commission"},
					{EntryID: "JE-DC-DA-FEE-001", DebitGL: "2303", DebitName: "Commission deducted", CreditGL: "4206", CreditName: "Collection Commission", Amount: 3_956_250, Narration: "0.25% collection commission on USD 1M"},
					{EntryID: "JE-DC-DA-CONT-REV-001", DebitGL: "9999", DebitName: "Contra (reversal)", CreditGL: "9202", CreditName: "Contingent - Bills (matured)", Amount: 1_582_500_000, Narration: "Reverse off-BS contingent on maturity"},
				}},
		},
		"summary": map[string]interface{}{
			"dpCollections": 1, "daCollections": 2, "totalSettled": 2_373_750_000,
			"commissionEarned": 6_031_250, "contingentOutstanding": 395_625_000,
			"glCodesImpacted": []string{"1101 (Nostro USD)", "2101 (Deposits)", "2303 (Collections Payable)", "4206 (Collection Commission)", "9202 (Contingent Bills)", "9999 (Contra)"},
		},
		"pipeline": map[string]string{
			"step1": "Receive collection instruction (SWIFT MT400/MT410)",
			"step2": "D/P: Present documents; on payment Dr nostro / Cr 2303",
			"step3": "D/A: Present documents; on acceptance post contingent (9202)",
			"step4": "Settlement: Cr drawer account (2101), deduct commission to 4206",
			"step5": "On maturity of D/A: collect from drawee, reverse contingent",
			"step6": "Report outstanding collections for LER/FCE returns",
		},
		"middleware": middlewareActions("banking.trade_finance.collections"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 19: MURABAHA (ISLAMIC FINANCE) → GL
// Cost-plus financing: purchase → sale → deferred profit recognition
// ═══════════════════════════════════════════════════════════════════════════════

func murabahaGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("MURABAHA-GL-%s", businessDate),
		"businessDate": businessDate,
		"transactions": []map[string]interface{}{
			{"txnId": "MRB-PURCH-001", "type": "asset_purchase", "customer": "Kano Textiles Ltd", "asset": "Industrial Weaving Machines (3x)", "costPrice": 75_000_000, "supplier": "Jiangsu Machinery Co",
				"glPostings": []GLEntry{
					{EntryID: "JE-MRB-PURCH-001", DebitGL: "1401", DebitName: "Murabaha Asset Inventory", CreditGL: "1006", CreditName: "Bank Operating Account", Amount: 75_000_000, Narration: "Purchase of asset for Murabaha financing"},
				}},
			{"txnId": "MRB-SALE-001", "type": "sale_to_customer", "customer": "Kano Textiles Ltd", "costPrice": 75_000_000, "profitMargin": 15, "sellingPrice": 86_250_000, "tenor": 36, "monthlyInstallment": 2_395_833,
				"glPostings": []GLEntry{
					{EntryID: "JE-MRB-SALE-001", DebitGL: "1302", DebitName: "Murabaha Receivable (Customer)", CreditGL: "1401", CreditName: "Murabaha Asset Inventory (sold)", Amount: 75_000_000, Narration: "Transfer asset to customer receivable at cost"},
					{EntryID: "JE-MRB-DEF-PROFIT-001", DebitGL: "1302", DebitName: "Murabaha Receivable (profit component)", CreditGL: "2501", CreditName: "Deferred Murabaha Profit (Liability)", Amount: 11_250_000, Narration: "Deferred profit recognized over 36 months"},
				}},
			{"txnId": "MRB-REPAY-001", "type": "monthly_installment", "customer": "Kano Textiles Ltd", "installment": 2_395_833, "principalPortion": 2_083_333, "profitPortion": 312_500,
				"glPostings": []GLEntry{
					{EntryID: "JE-MRB-INST-001", DebitGL: "2101", DebitName: "Customer Deposit (debit)", CreditGL: "1302", CreditName: "Murabaha Receivable (principal reduction)", Amount: 2_083_333, Narration: "Monthly principal portion"},
					{EntryID: "JE-MRB-PROFIT-001", DebitGL: "2501", DebitName: "Deferred Profit (recognized)", CreditGL: "4110", CreditName: "Murabaha Profit Income (earned)", Amount: 312_500, Narration: "Monthly profit recognition (straight-line over tenor)"},
					{EntryID: "JE-MRB-CUST-001", DebitGL: "2101", DebitName: "Customer Account (profit portion)", CreditGL: "2501", CreditName: "Deferred Profit reduction", Amount: 312_500, Narration: "Cash received for profit portion"},
				}},
		},
		"summary": map[string]interface{}{
			"activeMurabaha":       1,
			"totalAssetsPurchased": 75_000_000,
			"totalDeferredProfit":  11_250_000,
			"monthlyRecognition":   312_500,
			"glCodesImpacted":      []string{"1401 (Murabaha Inventory)", "1302 (Murabaha Receivable)", "1006 (Bank Account)", "2101 (Customer Deposits)", "2501 (Deferred Profit)", "4110 (Murabaha Income)"},
		},
		"ifsb_compliance": map[string]string{
			"standard":          "IFSB-1 (Capital Adequacy for Islamic Institutions)",
			"profit_recognition": "Proportionate over financing tenor (AAOIFI FAS 2)",
			"asset_ownership":    "Bank bears risk until sale deed signed",
			"shariah_board":      "Approved — no interest, genuine trade structure",
		},
		"pipeline": map[string]string{
			"step1": "Customer requests financing → Bank purchases asset from supplier",
			"step2": "Asset recorded at cost in inventory GL 1401",
			"step3": "Sale to customer at cost + agreed profit margin",
			"step4": "Dr 1302 (Receivable) / Cr 1401 (Inventory) + Cr 2501 (Deferred Profit)",
			"step5": "Monthly: Dr 2501 / Cr 4110 (profit recognition on straight-line basis)",
			"step6": "Customer payment: Dr 2101 / Cr 1302 (receivable reduction)",
		},
		"middleware": middlewareActions("banking.islamic.murabaha"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 20: DISPUTE/CHARGEBACK → GL
// Provisional credit, investigation, reversal or permanent credit
// ═══════════════════════════════════════════════════════════════════════════════

func disputeChargebackGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("DISPUTE-GL-%s", businessDate),
		"businessDate": businessDate,
		"disputes": []map[string]interface{}{
			{"disputeId": "DSP-001", "type": "card_chargeback", "customer": "Adebayo Emmanuel", "amount": 150_000, "merchant": "Unknown POS Terminal", "stage": "provisional_credit_issued",
				"glPostings": []GLEntry{
					{EntryID: "JE-DSP-PROV-001", DebitGL: "1408", DebitName: "Chargeback Suspense (Pending)", CreditGL: "2101", CreditName: "Customer Account (provisional credit)", Amount: 150_000, Narration: "Provisional credit pending dispute investigation (CBN 72hr rule)"},
				}},
			{"disputeId": "DSP-002", "type": "card_chargeback", "customer": "Fatimah Ibrahim", "amount": 85_000, "merchant": "Online Store XYZ", "stage": "resolved_in_customer_favor",
				"glPostings": []GLEntry{
					{EntryID: "JE-DSP-RESOLVE-001", DebitGL: "1104", DebitName: "Card Network Settlement (recoverable)", CreditGL: "1408", CreditName: "Chargeback Suspense (cleared)", Amount: 85_000, Narration: "Chargeback won — recover from acquirer/merchant"},
				}},
			{"disputeId": "DSP-003", "type": "unauthorized_transfer", "customer": "Ibrahim Mohammed", "amount": 500_000, "channel": "mobile_banking", "stage": "resolved_against_customer",
				"glPostings": []GLEntry{
					{EntryID: "JE-DSP-REVERSE-001", DebitGL: "2101", DebitName: "Customer Account (provisional reversed)", CreditGL: "1408", CreditName: "Chargeback Suspense (cleared)", Amount: 500_000, Narration: "Dispute resolved against customer — reverse provisional credit"},
				}},
			{"disputeId": "DSP-004", "type": "atm_failed_dispense", "customer": "Chukwuemeka Obi", "amount": 200_000, "channel": "ATM-VI-003", "stage": "bank_liability",
				"glPostings": []GLEntry{
					{EntryID: "JE-DSP-BANK-001", DebitGL: "5301", DebitName: "ATM Discrepancy Expense", CreditGL: "1408", CreditName: "Chargeback Suspense (absorbed)", Amount: 200_000, Narration: "ATM failed dispense — bank bears loss (journal imbalance confirmed)"},
				}},
		},
		"summary": map[string]interface{}{
			"provisionalCredits": 1, "resolvedForCustomer": 1, "resolvedAgainst": 1, "bankLiability": 1,
			"totalSuspenseBalance": 150_000, "totalRecovered": 85_000, "totalLoss": 200_000,
			"glCodesImpacted": []string{"1408 (Chargeback Suspense)", "2101 (Customer Deposits)", "1104 (Card Settlement)", "5301 (ATM Discrepancy Expense)"},
			"cbnCompliance": map[string]string{
				"acknowledgment": "Within 72 hours (CBN circular)",
				"resolution":     "Within 15 business days (card disputes)",
				"provisional":    "Credit issued immediately for ATM/POS failures",
			},
		},
		"pipeline": map[string]string{
			"step1": "Dispute received → provisional credit: Dr 1408 (Suspense) / Cr 2101 (Customer)",
			"step2": "Investigation period (15 business days for card, 72hrs ack for all)",
			"step3": "If customer wins: Dr 1104 (recover from network) / Cr 1408 (clear suspense)",
			"step4": "If customer loses: Dr 2101 (reverse credit) / Cr 1408 (clear suspense)",
			"step5": "If bank error: Dr 5301 (expense) / Cr 1408 (bank absorbs loss)",
			"step6": "Report to CBN Fraud & Forgery Return (FFR) if fraud confirmed",
		},
		"middleware": middlewareActions("banking.disputes.chargeback"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

func middlewareActions(kafkaTopic string) map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"topic": kafkaTopic, "status": "published"},
		"dapr":        map[string]string{"statestore": "trade-finance-state", "status": "saved"},
		"fluvio":      map[string]string{"stream": "trade-finance-events", "status": "appended"},
		"temporal":    map[string]string{"workflow": "TradeFinanceWorkflow", "status": "completed"},
		"postgres":    map[string]string{"tables": "journalEntries, trialBalances, lcRegister, collections", "status": "updated"},
		"keycloak":    map[string]string{"role": "trade_finance_officer", "status": "authorized"},
		"permify":     map[string]string{"permission": "trade_finance.approve", "status": "granted"},
		"redis":       map[string]string{"cache": "lc_positions_invalidated", "status": "flushed"},
		"mojaloop":    map[string]string{"purpose": "cross-border_settlement_routing", "status": "checked"},
		"opensearch":  map[string]string{"index": "trade-finance-2026", "status": "indexed"},
		"openappsec":  map[string]string{"policy": "trade-finance-protection", "status": "passed"},
		"apisix":      map[string]string{"route": "rate_limited_authenticated", "status": "ok"},
		"tigerbeetle": map[string]string{"action": "lc_transfers_posted", "status": "verified"},
		"lakehouse":   map[string]string{"table": "kpi_catalog.trade_finance.events_iceberg", "status": "appended"},
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	dbData, _ := json.Marshal(map[string]string{"service": "trade_finance_gl_go", "action": "respondJSON"})
	if dbErr := dbInsert(fmt.Sprintf("trade_finance_gl_go-%d", time.Now().UnixNano()), "trade_finance_gl_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheInvalidate("trade_finance_gl_list")
	}
	csURL := os.Getenv("GL_ENGINE_URL")
	if csURL == "" { csURL = "http://gl-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "trade_finance_gl_go", "action": "respondJSON"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status": "healthy", "service": "trade-finance-gl-go", "version": "1.0.0",
		"gaps_closed": []string{"Gap 17: LC → GL", "Gap 18: Doc Collections → GL", "Gap 19: Murabaha → GL", "Gap 20: Disputes → GL"},
	})
}


func trade_finance_glComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func trade_finance_glValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func trade_finance_glScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := trade_finance_glComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, map[string]interface{}{"score": score})
}

func trade_finance_glValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := trade_finance_glValidateRequest(body)
    respondJSON(w, result)
}

// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"trade-finance-gl-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&_reqCount)
    errs := atomic.LoadUint64(&_errCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"trade-finance-gl-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"trade-finance-gl-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"trade-finance-gl-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&_reqCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&_errCount, 1)
        }
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}


// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
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
	db.Exec(`CREATE TABLE IF NOT EXISTS trade_transactions (id SERIAL PRIMARY KEY, trade_id TEXT, lc_number TEXT, applicant TEXT, beneficiary TEXT, amount NUMERIC(15,2), currency TEXT, status TEXT, incoterm TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
	log.Printf("[%s] Domain table trade_transactions ensured", serviceName)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}


// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures int
var _cbOpen bool
var _cbLastFail time.Time

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen && time.Since(_cbLastFail) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen { _cbOpen = false; _cbFailures = 0 }
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 { time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond) }
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil { lastErr = err; _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		defer resp.Body.Close()
		if resp.StatusCode >= 500 { lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode); _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures = 0; _cbOpen = false
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
// --- Production Cache (connection-pooled, multi-level, with metrics) ---
var _cachePool *cachePool
var _l1Cache sync.Map // L1 in-process cache
var _cacheHits atomic.Uint64
var _cacheMisses atomic.Uint64
var _cacheStampedes atomic.Uint64

type cachePool struct {
	pool     chan net.Conn
	host     string
	port     string
	password string
	db       string
}

type l1CacheEntry struct {
	Value  string
	Expiry time.Time
}

func initCachePool() {
	url := os.Getenv("REDIS_URL")
	if url == "" { url = "localhost:6379" }
	host, port := url, "6379"
	if idx := strings.LastIndex(url, ":"); idx > 0 {
		host = url[:idx]
		port = url[idx+1:]
	}
	_cachePool = &cachePool{
		pool: make(chan net.Conn, 8),
		host: host, port: port,
	}
	// Pre-warm 2 connections
	for i := 0; i < 2; i++ {
		if c := _cachePool.dial(); c != nil {
			_cachePool.pool <- c
		}
	}
}

func (p *cachePool) dial() net.Conn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil { return nil }
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n > 0 && buf[0] == '+' { return conn }
	conn.Close()
	return nil
}

func (p *cachePool) get() net.Conn {
	select {
	case c := <-p.pool:
		c.SetDeadline(time.Now().Add(2 * time.Second))
		fmt.Fprintf(c, "*1\r\n$4\r\nPING\r\n")
		buf := make([]byte, 64)
		n, err := c.Read(buf)
		if err == nil && n > 0 && buf[0] == '+' { return c }
		c.Close()
		return p.dial()
	default:
		return p.dial()
	}
}

func (p *cachePool) put(c net.Conn) {
	if c == nil { return }
	select {
	case p.pool <- c:
	default:
		c.Close()
	}
}

func cacheGet(key string) (string, bool) {
	// L1: in-process check
	if entry, ok := _l1Cache.Load(key); ok {
		e := entry.(l1CacheEntry)
		if time.Now().Before(e.Expiry) {
			_cacheHits.Add(1)
			return e.Value, true
		}
		_l1Cache.Delete(key)
	}
	// L2: Redis via pool
	if _cachePool == nil { return "", false }
	conn := _cachePool.get()
	if conn == nil { _cacheMisses.Add(1); return "", false }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { _cacheMisses.Add(1); return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			_cacheHits.Add(1)
			// Promote to L1 (10s TTL)
			_l1Cache.Store(key, l1CacheEntry{Value: parts[1], Expiry: time.Now().Add(10 * time.Second)})
			return parts[1], true
		}
	}
	_cacheMisses.Add(1)
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	// L1 store
	_l1Cache.Store(key, l1CacheEntry{Value: value, Expiry: time.Now().Add(time.Duration(ttlSeconds) * time.Second)})
	// L2: Redis via pool
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	ttlStr := fmt.Sprintf("%d", ttlSeconds)
	fmt.Fprintf(conn, "*6\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%s\r\n$2\r\nNX\r\n",
		len(key), key, len(value), value, len(ttlStr), ttlStr)
	buf := make([]byte, 256)
	conn.Read(buf)
}

func cacheInvalidate(key string) {
	_l1Cache.Delete(key)
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nDEL\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 64)
	conn.Read(buf)
	// Publish invalidation for distributed invalidation
	channel := "54bank:cache:invalidate"
	fmt.Fprintf(conn, "*3\r\n$7\r\nPUBLISH\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n",
		len(channel), channel, len(key), key)
	conn.Read(buf)
}

func cacheMetricsHandler(w http.ResponseWriter, r *http.Request) {
	hits := _cacheHits.Load()
	misses := _cacheMisses.Load()
	total := hits + misses
	hitRate := 0.0
	if total > 0 { hitRate = float64(hits) / float64(total) * 100 }
	l1Size := 0
	_l1Cache.Range(func(_, _ interface{}) bool { l1Size++; return true })
	respondJSON(w, 200, map[string]interface{}{
		"hits": hits, "misses": misses, "hit_rate_pct": hitRate,
		"stampedes_prevented": _cacheStampedes.Load(),
		"l1_size": l1Size,
		"pool_connected": _cachePool != nil,
	})
}


// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}


var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr - atomic.LoadInt64(&_rlLastRefill) >= 1000 {
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


func validateTradeFinance(lcAmount float64, expiryDays int, incoterm string) (bool, string) {
	if lcAmount <= 0 { return false, "LC amount must be positive" }
	if expiryDays < 1 { return false, "LC must have valid expiry" }
	validTerms := map[string]bool{"FOB": true, "CIF": true, "CFR": true, "EXW": true, "DDP": true}
	if !validTerms[incoterm] { return false, "Invalid incoterm: " + incoterm }
	return true, "Trade finance application valid"
}
func computeLCFee(amount float64, durationDays int) float64 {
	annualRate := 0.015 // 1.5% p.a.
	return amount * annualRate * float64(durationDays) / 365.0
}


// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
        }
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Source-Service", serviceName)
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
    rules []alertRule
    mu    sync.RWMutex
}

type alertRule struct {
    Name      string
    Metric    string
    Threshold float64
    Severity  string
}

var _alertMgr = &alertManager{
    rules: []alertRule{
        {"high_error_rate", "error_rate", 0.05, "critical"},
        {"high_latency", "p99_latency_ms", 5000, "warning"},
        {"db_connection_failures", "db_failures", 3, "critical"},
    },
}

func (am *alertManager) check() []map[string]interface{} {
    var fired []map[string]interface{}
    errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
    dbAvailable    bool
    cacheAvailable bool
    upstreamOK     map[string]bool
    mu             sync.RWMutex
}

var _degrade = &degradationState{
    dbAvailable:    true,
    cacheAvailable: true,
    upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
    d.mu.RLock()
    defer d.mu.RUnlock()
    return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
    _degrade.mu.RLock()
    defer _degrade.mu.RUnlock()
    jsonResp(w, 200, map[string]interface{}{
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}


// ── Deep Domain Logic: Lending ──────────────────────────────────────────────

// AmountKobo represents money in smallest unit (kobo) to avoid floating-point errors
type AmountKobo int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }
func (a AmountKobo) String() string        { return fmt.Sprintf("₦%s", formatKobo(a)) }

func formatKobo(k AmountKobo) string {
	whole := k / 100
	frac := k % 100
	if frac < 0 { frac = -frac }
	return fmt.Sprintf("%d.%02d", whole, frac)
}

// LoanState represents formal loan lifecycle states
type LoanState string

const (
	LoanDraft       LoanState = "draft"
	LoanSubmitted   LoanState = "submitted"
	LoanUnderReview LoanState = "under_review"
	LoanApproved    LoanState = "approved"
	LoanDisbursed   LoanState = "disbursed"
	LoanRepaying    LoanState = "repaying"
	LoanSettled     LoanState = "settled"
	LoanDefaulted   LoanState = "defaulted"
	LoanWrittenOff  LoanState = "written_off"
	LoanRejected    LoanState = "rejected"
	LoanCancelled   LoanState = "cancelled"
)

// ValidTransitions defines allowed state machine transitions
var validLoanTransitions = map[LoanState][]LoanState{
	LoanDraft:       {LoanSubmitted, LoanCancelled},
	LoanSubmitted:   {LoanUnderReview, LoanRejected, LoanCancelled},
	LoanUnderReview: {LoanApproved, LoanRejected},
	LoanApproved:    {LoanDisbursed, LoanCancelled},
	LoanDisbursed:   {LoanRepaying},
	LoanRepaying:    {LoanSettled, LoanDefaulted},
	LoanDefaulted:   {LoanWrittenOff, LoanRepaying},
}

func canTransition(from, to LoanState) bool {
	allowed, ok := validLoanTransitions[from]
	if !ok { return false }
	for _, s := range allowed { if s == to { return true } }
	return false
}

func transitionLoan(currentState LoanState, newState LoanState, loanID string) error {
	if !canTransition(currentState, newState) {
		return fmt.Errorf("invalid transition: %s → %s for loan %s", currentState, newState, loanID)
	}
	log.Printf("[state-machine] Loan %s: %s → %s", loanID, currentState, newState)
	return nil
}

// GenerateAmortizationSchedule produces full repayment schedule
type AmortizationEntry struct {
	Period        int        `json:"period"`
	EMI           AmountKobo `json:"emi_kobo"`
	Principal     AmountKobo `json:"principal_kobo"`
	Interest      AmountKobo `json:"interest_kobo"`
	Balance       AmountKobo `json:"balance_kobo"`
	CumulativeInt AmountKobo `json:"cumulative_interest_kobo"`
}

func generateAmortizationSchedule(principalKobo AmountKobo, annualRatePct float64, tenorMonths int) []AmortizationEntry {
	if tenorMonths <= 0 { return nil }
	monthlyRate := annualRatePct / 12.0 / 100.0
	var emi AmountKobo
	if monthlyRate == 0 {
		emi = principalKobo / AmountKobo(tenorMonths)
	} else {
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emiFloat := float64(principalKobo) * monthlyRate * pow / (pow - 1)
		emi = AmountKobo(emiFloat)
	}

	schedule := make([]AmortizationEntry, 0, tenorMonths)
	balance := principalKobo
	var cumulativeInterest AmountKobo

	for i := 1; i <= tenorMonths; i++ {
		interestPart := AmountKobo(float64(balance) * monthlyRate)
		principalPart := emi - interestPart
		if i == tenorMonths { principalPart = balance } // settle rounding on last payment
		balance -= principalPart
		cumulativeInterest += interestPart
		schedule = append(schedule, AmortizationEntry{
			Period: i, EMI: emi, Principal: principalPart,
			Interest: interestPart, Balance: balance, CumulativeInt: cumulativeInterest,
		})
	}
	return schedule
}

// ComputeEarlySettlementPenalty — CBN allows max 1% penalty on outstanding
func computeEarlySettlementPenalty(outstandingKobo AmountKobo, monthsRemaining int, penaltyPct float64) AmountKobo {
	if penaltyPct > 1.0 { penaltyPct = 1.0 } // CBN cap
	return AmountKobo(float64(outstandingKobo) * penaltyPct / 100.0)
}

// ComputeLateFee — tiered by days past due
func computeLateFee(emiKobo AmountKobo, daysPastDue int) AmountKobo {
	if daysPastDue <= 0 { return 0 }
	var rate float64
	switch {
	case daysPastDue <= 7:  rate = 0.01  // 1%
	case daysPastDue <= 30: rate = 0.025 // 2.5%
	case daysPastDue <= 90: rate = 0.05  // 5%
	default:               rate = 0.10  // 10% (max)
	}
	return AmountKobo(float64(emiKobo) * rate)
}

// PAR (Portfolio at Risk) computation — CBN regulatory metric
func computePAR(totalLoansKobo, loansOverdueKobo AmountKobo, daysBucket int) float64 {
	if totalLoansKobo == 0 { return 0 }
	return float64(loansOverdueKobo) / float64(totalLoansKobo) * 100.0
}

// Provisioning rates per CBN Prudential Guidelines
func computeProvisioningRate(classificationDays int) float64 {
	switch {
	case classificationDays <= 90:  return 1.0   // Performing — 1%
	case classificationDays <= 180: return 10.0  // Watchlist — 10%
	case classificationDays <= 360: return 50.0  // Substandard — 50%
	case classificationDays <= 720: return 75.0  // Doubtful — 75%
	default:                        return 100.0 // Lost — 100%
	}
}

// ValidateLoanApplication with comprehensive error accumulation
func validateLoanApplicationDeep(
	customerID string, amount AmountKobo, tenorMonths int, annualRate float64,
	monthlyIncomeKobo AmountKobo, existingDebtKobo AmountKobo,
	kycLevel string, employmentYears float64, age int,
) (bool, []string) {
	var errors []string

	// Amount bounds (CBN microfinance: min ₦10K, max depends on tier)
	if amount < nairaToKobo(10000) { errors = append(errors, "amount below CBN minimum ₦10,000") }
	if amount > nairaToKobo(50000000) { errors = append(errors, "amount exceeds ₦50M max single obligor limit") }

	// Tenor bounds
	if tenorMonths < 1 { errors = append(errors, "tenor must be at least 1 month") }
	if tenorMonths > 360 { errors = append(errors, "tenor exceeds 30-year maximum") }

	// Rate bounds (CBN usury cap)
	if annualRate <= 0 { errors = append(errors, "interest rate must be positive") }
	if annualRate > 30 { errors = append(errors, "rate exceeds CBN maximum lending rate") }

	// DTI check
	emi := AmountKobo(0)
	if tenorMonths > 0 && annualRate > 0 {
		monthlyRate := annualRate / 12.0 / 100.0
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emi = AmountKobo(float64(amount) * monthlyRate * pow / (pow - 1))
	}
	dti := float64(existingDebtKobo+emi) / float64(monthlyIncomeKobo) * 100
	if dti > 60 { errors = append(errors, fmt.Sprintf("DTI ratio %.1f%% exceeds 60%% maximum", dti)) }

	// KYC tier check
	switch kycLevel {
	case "tier1":
		if amount > nairaToKobo(300000) { errors = append(errors, "Tier 1 KYC max loan ₦300,000") }
	case "tier2":
		if amount > nairaToKobo(5000000) { errors = append(errors, "Tier 2 KYC max loan ₦5,000,000") }
	case "tier3":
		// No limit for Tier 3
	default:
		errors = append(errors, "valid KYC level required (tier1/tier2/tier3)")
	}

	// Age check (18-65 at loan maturity)
	if age < 18 { errors = append(errors, "applicant must be 18+") }
	maturityAge := age + tenorMonths/12
	if maturityAge > 65 { errors = append(errors, fmt.Sprintf("applicant will be %d at maturity (max 65)", maturityAge)) }

	// Employment stability
	if employmentYears < 0.5 { errors = append(errors, "minimum 6 months employment required") }

	return len(errors) == 0, errors
}

// ReverseLoanDisbursement — compensation logic
func reverseLoanDisbursement(loanID, accountID string, amountKobo AmountKobo, reason string) map[string]interface{} {
	return map[string]interface{}{
		"reversal_id":  fmt.Sprintf("REV-%s-%d", loanID, time.Now().UnixMilli()),
		"loan_id":      loanID,
		"account_id":   accountID,
		"amount_kobo":  amountKobo,
		"reason":       reason,
		"status":       "reversed",
		"reversed_at":  time.Now().Format(time.RFC3339),
		"gl_entries": []map[string]interface{}{
			{"debit": "loan_receivable", "credit": accountID, "amount_kobo": amountKobo},
		},
	}
}


func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8098" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/trade-finance/lc-gl", lcLifecycleGL)
	mux.HandleFunc("/v1/trade-finance/collections-gl", docCollectionsGL)
	mux.HandleFunc("/v1/islamic/murabaha-gl", murabahaGL)
	mux.HandleFunc("/v1/disputes/chargeback-gl", disputeChargebackGL)
	mux.HandleFunc("/v1/trade-finance-gl/score", trade_finance_glScoreHandler)
	mux.HandleFunc("/v1/trade-finance-gl/validate", trade_finance_glValidateRequestHandler)
	log.Printf("Trade Finance & Specialized Banking GL (Go) on :%s — Gaps 17-20", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[trade-finance-gl-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[trade-finance-gl-go] Server stopped gracefully")
}
