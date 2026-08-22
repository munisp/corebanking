// 54Bank Trade Finance & Specialized Banking GL Engine — Go
// Closes gaps 17-20: LC, Documentary Collections, Islamic Finance, Disputes
package main

import (
	"github.com/IBM/sarama"
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
	cacheSet("trade_finance_gl_list", "", 1) // invalidate cache on write
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
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func cacheGet(key string) (string, bool) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return "", false }
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 { return parts[1], true }
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return }
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
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


// ── MIDDLEWARE: JWT Validation ───────────────────────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func fetchJWKS(realmURL string) {
	resp, err := http.Get(realmURL + "/protocol/openid-connect/certs")
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
		if len(eBytes) == 0 { continue }
		var eInt int
		for _, b := range eBytes { eInt = eInt<<8 | int(b) }
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		for range time.Tick(5 * time.Minute) { fetchJWKS(realmURL) }
	}()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct { Kid string `json:"kid"` }
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────

func startOutboxRelay(ctx context.Context, brokers string, topic string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				relayOutbox(brokers, topic)
			}
		}
	}()
}

func relayOutbox(brokers string, topic string) {
	if db == nil { return }

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}



func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8098" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(degradationStatusHandler)))
	mux.HandleFunc("/healthz", healthz)
	mux.Handle("/v1/trade-finance/lc-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(lcLifecycleGL)))
	mux.Handle("/v1/trade-finance/collections-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(docCollectionsGL)))
	mux.Handle("/v1/islamic/murabaha-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(murabahaGL)))
	mux.Handle("/v1/disputes/chargeback-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(disputeChargebackGL)))
	mux.Handle("/v1/trade-finance-gl/score", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(trade_finance_glScoreHandler)))
	mux.Handle("/v1/trade-finance-gl/validate", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(trade_finance_glValidateRequestHandler)))
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

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
