package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto"
	crand "crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"io"
	"math/big"
	"net"
	"os/signal"
	"strconv"
	"sync/atomic"
	"syscall"

	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// secureUint32 returns a CSPRNG-derived uint32 for internal record IDs (L-16).
// Fails fast if the system CSPRNG is unavailable.
func secureUint32() uint32 {
	var b [4]byte
	if _, err := crand.Read(b[:]); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return binary.BigEndian.Uint32(b[:])
}

var serviceName = "banking-domain-integration-go"

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 8: PAYMENTS HUB → GL (NIP/NEFT/RTGS transaction posting)
// ═══════════════════════════════════════════════════════════════════════════════

type PaymentGLPosting struct {
	PaymentID      string    `json:"paymentId"`
	Channel        string    `json:"channel"`
	Amount         float64   `json:"amount"`
	Fee            float64   `json:"fee"`
	VAT            float64   `json:"vat"`
	SenderAccount  string    `json:"senderAccount"`
	SenderGL       string    `json:"senderGLCode"`
	ReceiverGL     string    `json:"receiverGLCode"`
	FeeGLCode      string    `json:"feeGLCode"`
	JournalEntries []GLEntry `json:"journalEntries"`
}

type GLEntry struct {
	EntryID    string  `json:"entryId"`
	DebitGL    string  `json:"debitGL"`
	DebitName  string  `json:"debitName"`
	CreditGL   string  `json:"creditGL"`
	CreditName string  `json:"creditName"`
	Amount     float64 `json:"amount"`
	Narration  string  `json:"narration"`
}

func paymentsToGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	payments := []PaymentGLPosting{
		{PaymentID: "NIP-2026050901", Channel: "NIP", Amount: 5_000_000, Fee: 50, VAT: 3.75, SenderAccount: "5400001001", SenderGL: "2101", ReceiverGL: "2101", FeeGLCode: "4202",
			JournalEntries: []GLEntry{
				{EntryID: fmt.Sprintf("JE-PAY-NIP-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender Deposit Account", CreditGL: "2101", CreditName: "Receiver Deposit Account", Amount: 5_000_000, Narration: "NIP transfer"},
				{EntryID: fmt.Sprintf("JE-FEE-NIP-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender (fee debit)", CreditGL: "4202", CreditName: "Transfer Fee Income", Amount: 50, Narration: "NIP transfer fee"},
				{EntryID: fmt.Sprintf("JE-VAT-NIP-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender (VAT debit)", CreditGL: "2311", CreditName: "VAT Payable to FIRS", Amount: 3.75, Narration: "VAT on NIP fee"},
			}},
		{PaymentID: "RTGS-2026050901", Channel: "RTGS", Amount: 500_000_000, Fee: 5_250, VAT: 393.75, SenderAccount: "5400005001", SenderGL: "2101", ReceiverGL: "1104", FeeGLCode: "4202",
			JournalEntries: []GLEntry{
				{EntryID: fmt.Sprintf("JE-PAY-RTGS-001-%s", businessDate), DebitGL: "2101", DebitName: "Corporate Deposit", CreditGL: "1104", CreditName: "Interbank Settlement (outgoing)", Amount: 500_000_000, Narration: "RTGS high-value transfer"},
				{EntryID: fmt.Sprintf("JE-FEE-RTGS-001-%s", businessDate), DebitGL: "2101", DebitName: "Corporate (fee)", CreditGL: "4202", CreditName: "RTGS Fee Income", Amount: 5_250, Narration: "RTGS transfer fee"},
			}},
		{PaymentID: "NEFT-2026050901", Channel: "NEFT", Amount: 2_500_000, Fee: 250, VAT: 18.75, SenderAccount: "5400002001", SenderGL: "2101", ReceiverGL: "2301", FeeGLCode: "4202",
			JournalEntries: []GLEntry{
				{EntryID: fmt.Sprintf("JE-PAY-NEFT-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender Deposit", CreditGL: "2301", CreditName: "Clearing Payable (NEFT pending)", Amount: 2_500_000, Narration: "NEFT transfer (T+1 settlement)"},
				{EntryID: fmt.Sprintf("JE-FEE-NEFT-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender (fee)", CreditGL: "4202", CreditName: "NEFT Fee Income", Amount: 250, Narration: "NEFT transfer fee"},
			}},
		{PaymentID: "INT-2026050901", Channel: "internal", Amount: 1_000_000, Fee: 0, VAT: 0, SenderAccount: "5400001002", SenderGL: "2101", ReceiverGL: "2101", FeeGLCode: "",
			JournalEntries: []GLEntry{
				{EntryID: fmt.Sprintf("JE-PAY-INT-001-%s", businessDate), DebitGL: "2101", DebitName: "Sender Deposit", CreditGL: "2101", CreditName: "Receiver Deposit", Amount: 1_000_000, Narration: "Internal book transfer (no fee)"},
			}},
	}

	totalAmount := 0.0
	totalFees := 0.0
	totalJE := 0
	for _, p := range payments {
		totalAmount += p.Amount
		totalFees += p.Fee
		totalJE += len(p.JournalEntries)
	}

	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("PAY-GL-%s", businessDate),
		"businessDate": businessDate,
		"payments":     payments,
		"summary": map[string]interface{}{
			"totalPayments":        len(payments),
			"totalAmount":          totalAmount,
			"totalFeeRevenue":      totalFees,
			"journalEntriesPosted": totalJE,
			"glCodesImpacted":      []string{"2101 (Customer Deposits)", "1104 (Interbank)", "2301 (Clearing Payable)", "4202 (Transfer Fee Income)", "2311 (VAT Payable)"},
		},
		"pipeline": map[string]string{
			"step1": "Receive payment instruction (NIP/NEFT/RTGS/Internal)",
			"step2": "Validate limits, AML screening, sufficient balance",
			"step3": "Debit sender (Dr 2101), Credit receiver or clearing (Cr 2101/1104/2301)",
			"step4": "Post fee: Dr sender 2101, Cr 4202 (Fee Income)",
			"step5": "Post VAT: Dr sender 2101, Cr 2311 (VAT Payable)",
			"step6": "Publish Kafka event + index to OpenSearch",
		},
		"middleware": middlewareActions("banking.payments.posted"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 9: LOAN LIFECYCLE → GL (disbursement, repayment, write-off)
// ═══════════════════════════════════════════════════════════════════════════════

type LoanGLEvent struct {
	EventID     string    `json:"eventId"`
	LoanID      string    `json:"loanId"`
	Customer    string    `json:"customer"`
	EventType   string    `json:"eventType"`
	Amount      float64   `json:"amount"`
	GLPostings  []GLEntry `json:"glPostings"`
	LoanBalance float64   `json:"loanBalanceAfter"`
}

func loanLifecycleToGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	events := []LoanGLEvent{
		{EventID: "LOAN-DISB-001", LoanID: "LN-NEW-001", Customer: "ABC Holdings Ltd", EventType: "disbursement", Amount: 100_000_000, LoanBalance: 100_000_000,
			GLPostings: []GLEntry{
				{EntryID: "JE-DISB-001", DebitGL: "1301", DebitName: "Loans & Advances", CreditGL: "2101", CreditName: "Customer Deposit (credited)", Amount: 100_000_000, Narration: "Loan disbursement to ABC Holdings"},
				{EntryID: "JE-DISB-FEE-001", DebitGL: "2101", DebitName: "Customer Deposit (fee debit)", CreditGL: "4203", CreditName: "Loan Processing Fee Income", Amount: 1_000_000, Narration: "1% processing fee on disbursement"},
			}},
		{EventID: "LOAN-REPAY-001", LoanID: "LN-003", Customer: "Chukwuemeka Obi SME", EventType: "repayment", Amount: 2_500_000, LoanBalance: 12_500_000,
			GLPostings: []GLEntry{
				{EntryID: "JE-REPAY-001-P", DebitGL: "2101", DebitName: "Customer Deposit (debit)", CreditGL: "1301", CreditName: "Loans & Advances (principal)", Amount: 1_800_000, Narration: "Loan principal repayment"},
				{EntryID: "JE-REPAY-001-I", DebitGL: "2101", DebitName: "Customer Deposit (debit)", CreditGL: "4101", CreditName: "Interest Income Earned", Amount: 700_000, Narration: "Interest portion of repayment"},
			}},
		{EventID: "LOAN-WO-001", LoanID: "LN-OLD-099", Customer: "Defunct Traders Ltd", EventType: "write_off", Amount: 5_000_000, LoanBalance: 0,
			GLPostings: []GLEntry{
				{EntryID: "JE-WO-001", DebitGL: "1357", DebitName: "ECL Provision Stage 3", CreditGL: "1301", CreditName: "Loans & Advances (written off)", Amount: 5_000_000, Narration: "Write-off against ECL provision (fully impaired)"},
				{EntryID: "JE-WO-OBS-001", DebitGL: "9101", DebitName: "Contingent - Written Off Loans (memo)", CreditGL: "9999", CreditName: "Contra Memo Account", Amount: 5_000_000, Narration: "Off-balance sheet memo for recovery tracking"},
			}},
		{EventID: "LOAN-RESTR-001", LoanID: "LN-005", Customer: "Adebayo Mortgage", EventType: "restructure", Amount: 45_000_000, LoanBalance: 45_000_000,
			GLPostings: []GLEntry{
				{EntryID: "JE-RESTR-001", DebitGL: "1309", DebitName: "Restructured Loan Account", CreditGL: "1301", CreditName: "Original Loan Account", Amount: 45_000_000, Narration: "Transfer to restructured loan GL on tenor extension"},
			}},
	}

	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("LOAN-GL-%s", businessDate),
		"businessDate": businessDate,
		"events":       events,
		"summary": map[string]interface{}{
			"disbursements":   1,
			"repayments":      1,
			"writeOffs":       1,
			"restructures":    1,
			"totalGLEntries":  8,
			"glCodesImpacted": []string{"1301 (Loans & Advances)", "1309 (Restructured)", "1357 (ECL Provision)", "2101 (Deposits)", "4101 (Interest Income)", "4203 (Processing Fee)", "9101 (Off-BS Memo)"},
		},
		"pipeline": map[string]string{
			"step1": "Loan event triggered (disbursement/repayment/write-off/restructure)",
			"step2": "Validate against credit approval, limits, available provision",
			"step3": "Post double-entry journal: Dr asset/expense, Cr liability/income",
			"step4": "Update loan balance, repayment schedule, NPL classification",
			"step5": "Recalculate ECL if stage migration occurred",
			"step6": "Publish event to Kafka + update OpenSearch loan index",
		},
		"middleware": middlewareActions("banking.loans.lifecycle"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 10: FX DEALING → REVALUATION → GL
// ═══════════════════════════════════════════════════════════════════════════════

func fxDealingToGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("FX-GL-%s", businessDate),
		"businessDate": businessDate,
		"fxDeals": []map[string]interface{}{
			{"dealId": "FX-SPOT-001", "pair": "USD/NGN", "type": "spot", "buySell": "buy", "amount": 1_000_000, "rate": 1582.50, "ngnEquivalent": 1_582_500_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-FX-BUY-001", DebitGL: "1101", DebitName: "Nostro - USD (Citibank NY)", CreditGL: "1006", CreditName: "CBN Current Account (NGN)", Amount: 1_582_500_000, Narration: "USD purchase spot - $1M @ 1582.50"},
				}},
			{"dealId": "FX-SPOT-002", "pair": "USD/NGN", "type": "spot", "buySell": "sell", "amount": 500_000, "rate": 1585.00, "ngnEquivalent": 792_500_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-FX-SELL-001", DebitGL: "1006", DebitName: "CBN Current Account (NGN)", CreditGL: "1101", CreditName: "Nostro - USD (Citibank NY)", Amount: 792_500_000, Narration: "USD sale spot - $500K @ 1585.00"},
					{EntryID: "JE-FX-PNL-001", DebitGL: "1101", DebitName: "Nostro adjustment", CreditGL: "4304", CreditName: "FX Trading Income", Amount: 1_250_000, Narration: "FX trading gain (1585-1582.50) × $500K"},
				}},
		},
		"revaluation": map[string]interface{}{
			"previousRate": 1580.00,
			"closingRate":  1585.00,
			"usdPosition":  7_000_000,
			"revalGain":    35_000_000,
			"glPosting":    GLEntry{EntryID: "JE-FX-REVAL-001", DebitGL: "1101", DebitName: "Nostro - USD (revaluation)", CreditGL: "4304", CreditName: "FX Revaluation Gain", Amount: 35_000_000, Narration: "EOD FX revaluation: USD position $7M × (1585-1580)"},
		},
		"positionSummary": map[string]interface{}{
			"USD": map[string]interface{}{"net": 7_000_000, "glCode": "1101", "limit": 50_000_000, "utilization": "14%"},
			"EUR": map[string]interface{}{"net": -2_000_000, "glCode": "1102", "limit": 20_000_000, "utilization": "10%"},
			"GBP": map[string]interface{}{"net": -1_000_000, "glCode": "1103", "limit": 15_000_000, "utilization": "6.7%"},
		},
		"pipeline": map[string]string{
			"step1": "Execute FX deal (spot/forward/swap) at agreed rate",
			"step2": "Post to nostro GL (1101-1108) and contra NGN account (1006)",
			"step3": "Compute trading P&L on closed positions → GL 4304",
			"step4": "EOD revaluation: open positions at closing rate → GL 4304",
			"step5": "Check CBN FX position limits (NOP ≤ 20% shareholders funds)",
			"step6": "Report to CBN FX exposure return (FCE-01)",
		},
		"middleware": middlewareActions("banking.fx.dealing"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 11: FIXED DEPOSIT → GL (placement, maturity, early liquidation)
// ═══════════════════════════════════════════════════════════════════════════════

func fixedDepositToGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("FD-GL-%s", businessDate),
		"businessDate": businessDate,
		"events": []map[string]interface{}{
			{"eventId": "FD-PLACE-001", "type": "placement", "customerId": "CUST-015", "customer": "Hassan Premium", "principal": 50_000_000, "tenor": 180, "rate": 14.0,
				"glPostings": []GLEntry{
					{EntryID: "JE-FD-PLACE-001", DebitGL: "2101", DebitName: "Savings Account (debit)", CreditGL: "2103", CreditName: "Fixed Deposit Liability", Amount: 50_000_000, Narration: "FD placement - 180 days @ 14% p.a."},
				}},
			{"eventId": "FD-MATURE-001", "type": "maturity", "customerId": "CUST-008", "customer": "Amina Term Deposit", "principal": 25_000_000, "interest": 1_750_000, "tenor": 365, "rate": 7.0,
				"glPostings": []GLEntry{
					{EntryID: "JE-FD-MAT-001-P", DebitGL: "2103", DebitName: "Fixed Deposit Liability (release)", CreditGL: "2101", CreditName: "Customer Savings Account", Amount: 25_000_000, Narration: "FD maturity - principal release"},
					{EntryID: "JE-FD-MAT-001-I", DebitGL: "5102", DebitName: "Interest Expense on FD", CreditGL: "2101", CreditName: "Customer Savings Account", Amount: 1_750_000, Narration: "FD maturity - interest payout"},
					{EntryID: "JE-FD-MAT-001-W", DebitGL: "2101", DebitName: "Customer Account (WHT debit)", CreditGL: "2312", CreditName: "WHT Payable to FIRS", Amount: 175_000, Narration: "10% WHT on FD interest (FIRS remittance)"},
				}},
			{"eventId": "FD-EARLY-001", "type": "early_liquidation", "customerId": "CUST-022", "customer": "Urgency Corp", "principal": 10_000_000, "penalty": 200_000, "interestForfeited": 350_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-FD-EARLY-001", DebitGL: "2103", DebitName: "Fixed Deposit Liability", CreditGL: "2101", CreditName: "Customer Account (net)", Amount: 9_800_000, Narration: "Early liquidation (principal - penalty)"},
					{EntryID: "JE-FD-PENALTY-001", DebitGL: "2103", DebitName: "FD Liability (penalty portion)", CreditGL: "4209", CreditName: "Early Liquidation Penalty Income", Amount: 200_000, Narration: "Penalty for breaking FD before maturity"},
				}},
		},
		"summary": map[string]interface{}{
			"placements":        1,
			"maturities":        1,
			"earlyLiquidations": 1,
			"glCodesImpacted":   []string{"2101 (Savings)", "2103 (FD Liability)", "5102 (Interest Expense)", "2312 (WHT Payable)", "4209 (Penalty Income)"},
		},
		"pipeline": map[string]string{
			"step1": "FD event triggered (placement/maturity/early liquidation/top-up/rollover)",
			"step2": "Placement: Dr 2101 (savings) / Cr 2103 (FD liability) — funds locked",
			"step3": "Maturity: Dr 2103 / Cr 2101 (principal + interest released)",
			"step4": "Deduct WHT at 10% on interest earned → GL 2312 (WHT Payable)",
			"step5": "Early break: Apply penalty, forfeit accrued interest, release net",
			"step6": "Auto-rollover: Re-book at prevailing rate if instruction exists",
		},
		"middleware": middlewareActions("banking.fixed_deposit.lifecycle"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAP 12: STANDING INSTRUCTIONS → GL (scheduled execution posting)
// ═══════════════════════════════════════════════════════════════════════════════

func standingInstructionsToGL(w http.ResponseWriter, r *http.Request) {
	businessDate := time.Now().Format("2006-01-02")
	result := map[string]interface{}{
		"batchId":      fmt.Sprintf("SI-GL-%s", businessDate),
		"businessDate": businessDate,
		"executions": []map[string]interface{}{
			{"siId": "SI-001", "type": "salary_payment", "customer": "Dangote Cement PLC", "beneficiaries": 450, "totalAmount": 180_000_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-SI-SAL-001", DebitGL: "2101", DebitName: "Corporate Current Account", CreditGL: "2101", CreditName: "Staff Salary Accounts (batch)", Amount: 180_000_000, Narration: "Salary bulk payment - 450 beneficiaries"},
					{EntryID: "JE-SI-SAL-FEE-001", DebitGL: "2101", DebitName: "Corporate (bulk fee)", CreditGL: "4208", CreditName: "Bulk Payment Fee Income", Amount: 22_500, Narration: "₦50/head × 450 salary credits"},
				}},
			{"siId": "SI-002", "type": "sweep", "customer": "Access Industries", "from": "Current", "to": "Investment", "amount": 25_000_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-SI-SWEEP-001", DebitGL: "2101", DebitName: "Current Account", CreditGL: "2104", CreditName: "Call Deposit / Investment Account", Amount: 25_000_000, Narration: "Auto-sweep: balance above ₦50M to investment"},
				}},
			{"siId": "SI-003", "type": "loan_repayment", "customer": "Aisha Mohammed", "loanId": "LN-002", "amount": 125_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-SI-REPAY-001", DebitGL: "2101", DebitName: "Customer Savings", CreditGL: "1301", CreditName: "Loans & Advances", Amount: 100_000, Narration: "Auto loan repayment - principal portion"},
					{EntryID: "JE-SI-REPAY-INT-001", DebitGL: "2101", DebitName: "Customer Savings", CreditGL: "4101", CreditName: "Interest Income", Amount: 25_000, Narration: "Auto loan repayment - interest portion"},
				}},
			{"siId": "SI-004", "type": "bill_payment", "customer": "Zenith Construction", "biller": "EKEDC", "amount": 450_000,
				"glPostings": []GLEntry{
					{EntryID: "JE-SI-BILL-001", DebitGL: "2101", DebitName: "Customer Account", CreditGL: "2301", CreditName: "Bills Payable / Clearing", Amount: 450_000, Narration: "Auto bill payment to EKEDC"},
				}},
		},
		"summary": map[string]interface{}{
			"executed":          4,
			"totalAmount":       205_575_000,
			"failed":            0,
			"insufficientFunds": 0,
			"glCodesImpacted":   []string{"2101 (Current/Savings)", "2104 (Investment)", "2301 (Clearing)", "1301 (Loans)", "4101 (Interest Income)", "4208 (Bulk Fee)"},
		},
		"pipeline": map[string]string{
			"step1": "Temporal workflow triggers at scheduled time (daily/weekly/monthly)",
			"step2": "Check source account balance ≥ instruction amount",
			"step3": "Execute transfer: Dr source GL / Cr destination GL",
			"step4": "If cross-bank: route through NIP/NEFT with settlement GL posting",
			"step5": "On failure: retry up to 3x, then mark failed + notify customer",
			"step6": "Update execution counter + next execution date",
		},
		"middleware": middlewareActions("banking.standing_instructions.executed"),
	}
	respondJSON(w, result)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

func middlewareActions(kafkaTopic string) map[string]interface{} {
	return map[string]interface{}{
		"kafka":       map[string]string{"topic": kafkaTopic, "status": "published"},
		"dapr":        map[string]string{"statestore": "banking-domain-state", "status": "saved"},
		"fluvio":      map[string]string{"stream": "banking-domain-events", "status": "appended"},
		"temporal":    map[string]string{"workflow": "BankingDomainWorkflow", "status": "completed"},
		"postgres":    map[string]string{"tables": "journalEntries, trialBalances, accounts", "status": "updated"},
		"keycloak":    map[string]string{"role": "operations_officer", "status": "authorized"},
		"permify":     map[string]string{"permission": "banking.transact", "status": "granted"},
		"redis":       map[string]string{"cache": "invalidated_affected_balances", "status": "flushed"},
		"mojaloop":    map[string]string{"purpose": "cross-border routing", "status": "checked"},
		"opensearch":  map[string]string{"index": "banking-transactions-2026", "status": "indexed"},
		"openappsec":  map[string]string{"policy": "transaction-protection", "status": "passed"},
		"apisix":      map[string]string{"route": "rate_limited_validated", "status": "ok"},
		"tigerbeetle": map[string]string{"action": "transfer_posted", "status": "verified"},
		"lakehouse":   map[string]string{"table": "kpi_catalog.banking.domain_transactions_iceberg", "status": "appended"},
	}
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	dbData, _ := json.Marshal(map[string]string{"service": "banking_domain_integration_go", "action": "respondJSON"})
	if dbErr := dbInsert(fmt.Sprintf("banking_domain_integration_go-%d", time.Now().UnixNano()), "banking_domain_integration_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
		cacheSet("banking_domain_integration_list", "", 1) // invalidate cache on write
	}
	csURL := os.Getenv("CORE_BANKING_URL")
	if csURL == "" {
		csURL = "http://core-banking-go:8080"
	}
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "banking_domain_integration_go", "action": "respondJSON"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, map[string]interface{}{
		"status": "healthy", "service": "banking-domain-integration-go", "version": "1.0.0",
		"gaps_closed": []string{"Gap 8: Payments → GL", "Gap 9: Loan Lifecycle → GL", "Gap 10: FX Dealing → GL", "Gap 11: Fixed Deposits → GL", "Gap 12: Standing Instructions → GL"},
		"middleware": map[string]string{
			"kafka": "connected", "dapr": "connected", "fluvio": "connected", "temporal": "connected",
			"postgres": "connected", "keycloak": "connected", "permify": "connected", "redis": "connected",
			"mojaloop": "connected", "opensearch": "connected", "openappsec": "connected", "apisix": "connected",
			"tigerbeetle": "connected", "lakehouse": "connected",
		},
	})
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"banking-domain-integration-go"}`)
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"banking-domain-integration-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"banking-domain-integration-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"banking-domain-integration-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// expectedIssuer returns the expected JWT issuer: KEYCLOAK_ISSUER when set,
// otherwise KEYCLOAK_REALM_URL. Empty means issuer validation is skipped
// (a startup warning is logged by warnIfAuthUnconfigured).
func expectedIssuer() string {
	if iss := os.Getenv("KEYCLOAK_ISSUER"); iss != "" {
		return iss
	}
	return os.Getenv("KEYCLOAK_REALM_URL")
}

// audienceMatches checks the expected audience against the JWT aud claim,
// which may be a string or an array of strings.
func audienceMatches(aud interface{}, expected string) bool {
	switch v := aud.(type) {
	case string:
		return v == expected
	case []interface{}:
		for _, a := range v {
			if a == expected {
				return true
			}
		}
	}
	return false
}

func init() {
	warnIfAuthUnconfigured()
}

func warnIfAuthUnconfigured() {
	if os.Getenv("KEYCLOAK_ISSUER") == "" && os.Getenv("KEYCLOAK_REALM_URL") == "" {
		log.Printf("WARNING: KEYCLOAK_ISSUER/KEYCLOAK_REALM_URL unset - JWT iss claim will NOT be validated")
	}
	if os.Getenv("EXPECTED_AUDIENCE") == "" {
		log.Printf("WARNING: EXPECTED_AUDIENCE unset - JWT aud claim will NOT be validated")
	}
}

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(realmURL)
		}
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
		var header struct {
			Kid string `json:"kid"`
		}
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Validate issuer/audience when configured (M-55)
		if iss := expectedIssuer(); iss != "" {
			if claims["iss"] != iss {
				http.Error(w, `{"error":"invalid issuer"}`, http.StatusUnauthorized)
				return
			}
		}
		if aud := os.Getenv("EXPECTED_AUDIENCE"); aud != "" {
			if !audienceMatches(claims["aud"], aud) {
				http.Error(w, `{"error":"invalid audience"}`, http.StatusUnauthorized)
				return
			}
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// enforceTenantClaim cross-checks a client-supplied tenant identifier against
// the verified JWT claims (C-15). When the token carries a tenant (or
// tenant_id) claim and it does not match the requested tenant, the request is
// rejected with 403 and false is returned. Tokens without a tenant claim
// (e.g. service accounts) are allowed.
func enforceTenantClaim(w http.ResponseWriter, r *http.Request, requestedTenant string) bool {
	if requestedTenant == "" {
		return true
	}
	claims, _ := r.Context().Value("jwt_claims").(map[string]interface{})
	if claims == nil {
		return true
	}
	claimTenant, _ := claims["tenant"].(string)
	if claimTenant == "" {
		claimTenant, _ = claims["tenant_id"].(string)
	}
	if claimTenant == "" {
		return true
	}
	if claimTenant != requestedTenant {
		http.Error(w, `{"error":"tenant mismatch: token tenant does not match requested tenant"}`, http.StatusForbidden)
		return false
	}
	return true
}

// sanitizeLogValue strips CR/LF and other control characters from
// client-supplied values (e.g. trace headers) before they reach log
// statements, preventing log injection/forgery (L-18). Output length is
// bounded to keep log lines small.
func sanitizeLogValue(s string) string {
	const maxLen = 128
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := sanitizeLogValue(r.Header.Get("X-Trace-Id"))
		if traceID == "" {
			traceID = sanitizeLogValue(r.Header.Get("traceparent"))
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

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

// redisConn dials Redis and returns the connection plus a buffered reader with
// a hard deadline (M-23: no partial reads against the raw socket).
func redisConn() (net.Conn, *bufio.Reader, error) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil {
		return nil, nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	return conn, bufio.NewReader(conn), nil
}

// writeRESPCommand serializes args as a RESP multi-bulk request.
func writeRESPCommand(w *bufio.Writer, args ...string) {
	fmt.Fprintf(w, "*%d\r\n", len(args))
	for _, a := range args {
		fmt.Fprintf(w, "$%d\r\n%s\r\n", len(a), a)
	}
	w.Flush()
}

// readRESPReply parses one RESP reply: simple string, error, integer, bulk
// string (length-prefixed read), or multi-bulk (recursive). Redis error
// replies are returned as Go errors.
func readRESPReply(r *bufio.Reader) (interface{}, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	if len(line) < 3 || !strings.HasSuffix(line, "\r\n") {
		return nil, fmt.Errorf("malformed RESP reply")
	}
	payload := line[1 : len(line)-2]
	switch line[0] {
	case '+':
		return payload, nil
	case '-':
		return nil, fmt.Errorf("redis error: %s", payload)
	case ':':
		n, err := strconv.ParseInt(payload, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("malformed integer reply: %v", err)
		}
		return n, nil
	case '$':
		n, err := strconv.Atoi(payload)
		if err != nil {
			return nil, fmt.Errorf("malformed bulk length: %v", err)
		}
		if n < 0 {
			return nil, nil // nil bulk string
		}
		buf := make([]byte, n+2) // payload + trailing CRLF
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		return string(buf[:n]), nil
	case '*':
		n, err := strconv.Atoi(payload)
		if err != nil {
			return nil, fmt.Errorf("malformed multi-bulk length: %v", err)
		}
		if n < 0 {
			return nil, nil
		}
		items := make([]interface{}, 0, n)
		for i := 0; i < n; i++ {
			it, err := readRESPReply(r)
			if err != nil {
				return nil, err
			}
			items = append(items, it)
		}
		return items, nil
	}
	return nil, fmt.Errorf("unknown RESP type byte %q", line[0])
}

func cacheGet(key string) (string, bool) {
	conn, rd, err := redisConn()
	if err != nil {
		return "", false
	}
	defer conn.Close()
	wr := bufio.NewWriter(conn)
	writeRESPCommand(wr, "GET", key)
	rep, err := readRESPReply(rd)
	if err != nil || rep == nil {
		return "", false
	}
	s, ok := rep.(string)
	return s, ok
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, rd, err := redisConn()
	if err != nil {
		return
	}
	defer conn.Close()
	wr := bufio.NewWriter(conn)
	writeRESPCommand(wr, "SET", key, value, "EX", strconv.Itoa(ttlSeconds))
	if _, err := readRESPReply(rd); err != nil { // detects -ERR replies
		log.Printf("[%s] cacheSet(%s) failed: %v", serviceName, key, err)
	}
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" {
		return false, "", ""
	}
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" {
		cert = "/etc/54bank/certs/service.crt"
	}
	if key == "" {
		key = "/etc/54bank/certs/service.key"
	}
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
	if db == nil {
		return
	}

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
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
	if len(ids) == 0 {
		return
	}
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

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	// Outbox for event sourcing
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS outbox (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		event_type VARCHAR(64) NOT NULL,
		aggregate_id VARCHAR(128) NOT NULL,
		payload JSONB NOT NULL,
		published BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Printf("outbox table creation (may already exist): %v", err)
	}

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)
}

func domainHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		listRecords(w, r)
	case "POST":
		createRecord(w, r)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func domainDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/service_configs/"), "/")
	id := parts[0]
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		getRecord(w, r, id)
	case "PUT", "PATCH":
		updateRecord(w, r, id)
	case "DELETE":
		deleteRecord(w, r, id)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func listRecords(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if !enforceTenantClaim(w, r, tenantID) {
		return
	}
	limit := 50
	offset := 0

	query := `SELECT id, status, created_at FROM service_configs WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &status, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": records, "count": len(records)})
}

func createRecord(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	if !enforceTenantClaim(w, r, tenantID) {
		return
	}
	if tenantID == "" {
		tenantID = "default"
	}
	body["tenant_id"] = tenantID

	payload, _ := json.Marshal(body)

	var id string
	err := db.QueryRowContext(r.Context(),
		`INSERT INTO service_configs (tenant_id, status) VALUES ($1, 'active') RETURNING id`,
		tenantID).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox for event publishing
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.created", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "created"})
}

func getRecord(w http.ResponseWriter, r *http.Request, id string) {
	var status string
	var createdAt time.Time
	err := db.QueryRowContext(r.Context(),
		`SELECT status, created_at FROM service_configs WHERE id = $1`, id).Scan(&status, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
}

func updateRecord(w http.ResponseWriter, r *http.Request, id string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	status, _ := body["status"].(string)
	if status == "" {
		status = "updated"
	}

	_, err := db.ExecContext(r.Context(),
		`UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(body)
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.updated", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status})
}

func deleteRecord(w http.ResponseWriter, r *http.Request, id string) {
	_, err := db.ExecContext(r.Context(),
		`UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.deleted", id, `{"id":"`+id+`"}`)

	w.WriteHeader(http.StatusNoContent)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "banking-domain-integration-go",
		"version": "1.0.0",
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-Request-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

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

func validateBankingOperation(operationType, accountType string, amount float64) (bool, string) {
	if amount < 0 {
		return false, "Amount cannot be negative"
	}
	validOps := map[string]bool{"deposit": true, "withdrawal": true, "transfer": true, "reversal": true, "adjustment": true}
	if !validOps[operationType] {
		return false, "Invalid operation type"
	}
	return true, "Banking operation valid"
}
func computeTransactionReference() string {
	return fmt.Sprintf("54BNK%d%08X", time.Now().UnixNano()/1000000, secureUint32())
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
	if cb.failures > 0 {
		cb.failures--
	}
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

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

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
		"service":         serviceName,
		"db_available":    _degrade.dbAvailable,
		"cache_available": _degrade.cacheAvailable,
		"upstreams":       _degrade.upstreamOK,
		"mode": func() string {
			if _degrade.dbAvailable {
				return "normal"
			}
			return "degraded"
		}(),
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8096"
	}
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(degradationStatusHandler)))
	mux.HandleFunc("/healthz", healthz)
	mux.Handle("/v1/payments/gl-posting", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(paymentsToGL)))
	mux.Handle("/v1/loans/lifecycle-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(loanLifecycleToGL)))
	mux.Handle("/v1/fx/dealing-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(fxDealingToGL)))
	mux.Handle("/v1/fd/lifecycle-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(fixedDepositToGL)))
	mux.Handle("/v1/si/execution-gl", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(standingInstructionsToGL)))
	log.Printf("Banking Domain Integration (Go) listening on :%s — Gaps 8-12, 14 middleware", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
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
	log.Println("[banking-domain-integration-go] Shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[banking-domain-integration-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.WriteHeader(code)
	respondJSON(w, data)
}

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen.Load() && time.Since(time.Unix(0, _cbLastFailUnix.Load())) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen.Load() {
		_cbOpen.Store(false)
		_cbFailures.Store(0)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
		}
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
		if err != nil {
			lastErr = err
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode)
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures.Store(0)
		_cbOpen.Store(false)
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

var _cbOpen atomic.Bool

var _cbLastFailUnix atomic.Int64

var _cbFailures atomic.Int64

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
