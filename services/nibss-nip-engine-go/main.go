// 54link-dev NIBSS/NIP Integration Engine — Go
// NIP Instant Payment processing (TSQ, nameEnquiry, fundsTransfer) against
// the real NIBSS endpoint, plus direct-debit mandate bookkeeping and
// response-code reference data.
//
// Fail-fast guarantee: funds transfers and name enquiries are proxied to
// the real NIBSS NIP endpoint (NIBSS_BASE_URL). When NIBSS is not
// configured or unreachable, handlers return HTTP 503 with
// ResponseCode "96" (system malfunction) and Status "failed" — a transfer
// is NEVER reported successful without a real NIBSS approval, and a name
// is NEVER fabricated.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// ═══════════════════════════════════════════════════════════════════════════════
// ISO 8583 MESSAGE STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

type ISO8583Message struct {
	MTI            string            `json:"mti"`
	PrimaryBitmap  string            `json:"primaryBitmap"`
	Fields         map[string]string `json:"fields"`
	ProcessingCode string            `json:"processingCode"`
	Amount         int64             `json:"amount"`
	STAN           string            `json:"stan"`
	RRN            string            `json:"rrn"`
	ResponseCode   string            `json:"responseCode,omitempty"`
	CreatedAt      string            `json:"createdAt"`
}

type NIPTransaction struct {
	ID              string `json:"id"`
	SessionID       string `json:"sessionId"`
	Type            string `json:"type"` // nameEnquiry | fundsTransfer | tsq
	SourceBank      string `json:"sourceBank"`
	SourceBankCode  string `json:"sourceBankCode"`
	SourceAccount   string `json:"sourceAccount"`
	DestBank        string `json:"destinationBank"`
	DestBankCode    string `json:"destinationBankCode"`
	DestAccount     string `json:"destinationAccount"`
	BeneficiaryName string `json:"beneficiaryName"`
	Amount          int64  `json:"amountKobo"`
	Narration       string `json:"narration"`
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	Status          string `json:"status"` // initiated | processing | successful | failed | reversed
	ChannelCode     string `json:"channelCode"`
	MTI             string `json:"mti"`
	CreatedAt       string `json:"createdAt"`
	CompletedAt     string `json:"completedAt,omitempty"`
}

type DirectDebitMandate struct {
	ID              string `json:"id"`
	MandateRef      string `json:"mandateReference"`
	DebtorAccount   string `json:"debtorAccount"`
	DebtorBank      string `json:"debtorBank"`
	DebtorBankCode  string `json:"debtorBankCode"`
	DebtorName      string `json:"debtorName"`
	CreditorAccount string `json:"creditorAccount"`
	CreditorBank    string `json:"creditorBank"`
	CreditorName    string `json:"creditorName"`
	Amount          int64  `json:"amountKobo"`
	Frequency       string `json:"frequency"` // one_time | daily | weekly | monthly | quarterly
	StartDate       string `json:"startDate"`
	EndDate         string `json:"endDate"`
	Status          string `json:"status"` // created | pending_approval | approved | active | suspended | cancelled | expired
	LastExecution   string `json:"lastExecutionDate,omitempty"`
	NextExecution   string `json:"nextExecutionDate,omitempty"`
	ExecutionCount  int    `json:"executionCount"`
	CreatedAt       string `json:"createdAt"`
}

type NIBSSResponseCode struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	Action      string `json:"action"`
}

type SettlementReport struct {
	ID             string `json:"id"`
	Date           string `json:"settlementDate"`
	TotalCredits   int64  `json:"totalCreditsKobo"`
	TotalDebits    int64  `json:"totalDebitsKobo"`
	NetPosition    int64  `json:"netPositionKobo"`
	TxnCount       int    `json:"transactionCount"`
	Status         string `json:"status"` // pending | settled | disputed
	ReconcileMatch int    `json:"reconciledMatches"`
	Exceptions     int    `json:"exceptions"`
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE DATA (NIBSS response-code table — static standard, not fake state)
// ═══════════════════════════════════════════════════════════════════════════════

var responseCodes = []NIBSSResponseCode{
	{Code: "00", Description: "Approved or completed successfully", Action: "none"},
	{Code: "01", Description: "Status unknown, please wait", Action: "retry_after_30s"},
	{Code: "03", Description: "Invalid Sender", Action: "reject"},
	{Code: "05", Description: "Do not honor", Action: "reject"},
	{Code: "06", Description: "Dormant Account", Action: "reject"},
	{Code: "07", Description: "Invalid Account", Action: "reject"},
	{Code: "09", Description: "Request processing in progress", Action: "wait"},
	{Code: "12", Description: "Invalid transaction", Action: "reject"},
	{Code: "13", Description: "Invalid Amount", Action: "reject"},
	{Code: "14", Description: "Invalid Card Number", Action: "reject"},
	{Code: "25", Description: "Unable to locate record", Action: "retry"},
	{Code: "26", Description: "Duplicate record", Action: "idempotent_success"},
	{Code: "30", Description: "Format error", Action: "fix_message"},
	{Code: "34", Description: "Suspected fraud", Action: "escalate_to_fraud"},
	{Code: "35", Description: "Contact Card Acceptor", Action: "notify_merchant"},
	{Code: "51", Description: "Insufficient funds", Action: "reject"},
	{Code: "53", Description: "No savings account", Action: "reject"},
	{Code: "57", Description: "Transaction not permitted to sender", Action: "reject"},
	{Code: "58", Description: "Transaction not permitted on channel", Action: "reject"},
	{Code: "61", Description: "Transfer limit Exceeded", Action: "reject"},
	{Code: "63", Description: "Security violation", Action: "block_and_alert"},
	{Code: "65", Description: "Exceeds withdrawal frequency", Action: "reject"},
	{Code: "68", Description: "Response received too late", Action: "reversal"},
	{Code: "69", Description: "Unsuccessful Account/Amount block", Action: "reject"},
	{Code: "91", Description: "Beneficiary bank not available", Action: "retry_or_reverse"},
	{Code: "92", Description: "Routing error", Action: "retry"},
	{Code: "94", Description: "Duplicate transaction", Action: "idempotent_success"},
	{Code: "96", Description: "System malfunction", Action: "retry"},
}

var (
	// Transaction log: only real NIBSS-processed attempts are recorded
	// (including failures). No fabricated history is seeded.
	nipTransactions []NIPTransaction
	mandates        []DirectDebitMandate
	settlements     []SettlementReport
	mu              sync.RWMutex
)

// ═══════════════════════════════════════════════════════════════════════════════
// NIBSS NIP CLIENT (real HTTP adapter)
// ═══════════════════════════════════════════════════════════════════════════════

var errNIBSSNotConfigured = fmt.Errorf("NIBSS NIP endpoint not configured (set NIBSS_BASE_URL)")

type nibssClient struct {
	baseURL   string
	apiKey    string
	basicUser string
	basicPass string
	http      *http.Client
}

func newNIBSSClient() *nibssClient {
	timeout := 10 * time.Second
	if v := os.Getenv("NIBSS_TIMEOUT_SECS"); v != "" {
		if n, err := time.ParseDuration(v+"s"); err == nil && n > 0 {
			timeout = n
		}
	}
	return &nibssClient{
		baseURL:   os.Getenv("NIBSS_BASE_URL"),
		apiKey:    os.Getenv("NIBSS_API_KEY"),
		basicUser: os.Getenv("NIBSS_USERNAME"),
		basicPass: os.Getenv("NIBSS_PASSWORD"),
		http:      &http.Client{Timeout: timeout},
	}
}

var nibss = newNIBSSClient()

// nibssUpstreamResponse mirrors the NIBSS NIP JSON response shape.
type nibssUpstreamResponse struct {
	ResponseCode    string `json:"responseCode"`
	ResponseMessage string `json:"responseMessage"`
	SessionID       string `json:"sessionId"`
	BeneficiaryName string `json:"beneficiaryName"`
	AccountName     string `json:"accountName"`
	Status          string `json:"status"`
}

// call posts to the NIBSS NIP endpoint and decodes the response. Any
// transport error, non-2xx status, or undecodable body is an error — the
// caller must NOT treat the operation as successful.
func (c *nibssClient) call(path string, payload map[string]interface{}) (*nibssUpstreamResponse, error) {
	if c.baseURL == "" {
		return nil, errNIBSSNotConfigured
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("x-api-key", c.apiKey)
	}
	if c.basicUser != "" {
		req.SetBasicAuth(c.basicUser, c.basicPass)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("NIBSS call %s failed: %w", path, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("NIBSS %s returned HTTP %d", path, resp.StatusCode)
	}
	var out nibssUpstreamResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("NIBSS %s response undecodable: %w", path, err)
	}
	return &out, nil
}

func nibssNameEnquiryPath() string {
	if v := os.Getenv("NIBSS_NAME_ENQUIRY_PATH"); v != "" {
		return v
	}
	return "/nip/name-enquiry"
}

func nibssFundsTransferPath() string {
	if v := os.Getenv("NIBSS_FUNDS_TRANSFER_PATH"); v != "" {
		return v
	}
	return "/nip/funds-transfer"
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

func newSessionID() string {
	return fmt.Sprintf("%026d", time.Now().UnixNano())
}

func recordTransaction(txn NIPTransaction) {
	mu.Lock()
	txn.ID = fmt.Sprintf("NIP-%06d", len(nipTransactions)+1)
	nipTransactions = append(nipTransactions, txn)
	mu.Unlock()
}

// nipFailure responds 503 with NIBSS response code 96 (system malfunction)
// and records the failed attempt. Nothing is reported successful.
func nipFailure(w http.ResponseWriter, txn NIPTransaction, cause error) {
	log.Printf("[nip] %s FAILED: %v", txn.Type, cause)
	txn.ResponseCode = "96"
	txn.ResponseMessage = "System malfunction"
	txn.Status = "failed"
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	recordTransaction(txn)
	respondJSON(w, http.StatusServiceUnavailable, txn)
}

func handleNameEnquiry(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		DestBankCode string `json:"destinationBankCode"`
		AccountNo    string `json:"accountNumber"`
		ChannelCode  string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.DestBankCode == "" || req.AccountNo == "" {
		respondJSON(w, 400, map[string]string{"error": "destinationBankCode and accountNumber are required", "responseCode": "30"})
		return
	}

	txn := NIPTransaction{
		SessionID: newSessionID(),
		Type:      "nameEnquiry", SourceBank: "54link-dev", SourceBankCode: "054",
		DestBankCode: req.DestBankCode, DestAccount: req.AccountNo,
		Status: "processing", ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	upstream, err := nibss.call(nibssNameEnquiryPath(), map[string]interface{}{
		"sessionId":           txn.SessionID,
		"destinationBankCode": req.DestBankCode,
		"accountNumber":       req.AccountNo,
		"channelCode":         req.ChannelCode,
	})
	if err != nil {
		nipFailure(w, txn, err)
		return
	}

	// Use ONLY the name resolved by NIBSS — never a placeholder.
	txn.ResponseCode = upstream.ResponseCode
	txn.ResponseMessage = upstream.ResponseMessage
	if upstream.SessionID != "" {
		txn.SessionID = upstream.SessionID
	}
	name := upstream.BeneficiaryName
	if name == "" {
		name = upstream.AccountName
	}
	txn.BeneficiaryName = name
	if upstream.ResponseCode == "00" && name != "" {
		txn.Status = "successful"
	} else if upstream.ResponseCode == "00" {
		// Approved code but no name — treat as failure rather than invent one.
		txn.ResponseCode = "25"
		txn.ResponseMessage = "Unable to locate record"
		txn.Status = "failed"
	} else {
		txn.Status = "failed"
	}
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	recordTransaction(txn)

	status := 200
	if txn.Status != "successful" {
		status = 502
	}
	respondJSON(w, status, txn)
}

func handleFundsTransfer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req struct {
		SourceAccount string `json:"sourceAccount"`
		DestBankCode  string `json:"destinationBankCode"`
		DestAccount   string `json:"destinationAccount"`
		Amount        int64  `json:"amountKobo"`
		Narration     string `json:"narration"`
		ChannelCode   string `json:"channelCode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.SourceAccount == "" || req.DestBankCode == "" || req.DestAccount == "" || req.Amount <= 0 {
		respondJSON(w, 400, map[string]string{"error": "sourceAccount, destinationBankCode, destinationAccount and a positive amountKobo are required", "responseCode": "30"})
		return
	}

	txn := NIPTransaction{
		SessionID: newSessionID(),
		Type:      "fundsTransfer", SourceBank: "54link-dev", SourceBankCode: "054",
		SourceAccount: req.SourceAccount, DestBankCode: req.DestBankCode,
		DestAccount: req.DestAccount, Amount: req.Amount, Narration: req.Narration,
		Status: "processing", ChannelCode: req.ChannelCode, MTI: "0200",
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	upstream, err := nibss.call(nibssFundsTransferPath(), map[string]interface{}{
		"sessionId":           txn.SessionID,
		"sourceAccount":       req.SourceAccount,
		"destinationBankCode": req.DestBankCode,
		"destinationAccount":  req.DestAccount,
		"amountKobo":          req.Amount,
		"narration":           req.Narration,
		"channelCode":         req.ChannelCode,
	})
	if err != nil {
		// No NIBSS call completed: no balance checked, no funds moved, and we
		// say exactly that (503 / 96 / failed).
		nipFailure(w, txn, err)
		return
	}

	txn.ResponseCode = upstream.ResponseCode
	txn.ResponseMessage = upstream.ResponseMessage
	if upstream.SessionID != "" {
		txn.SessionID = upstream.SessionID
	}
	if upstream.ResponseCode == "00" {
		txn.Status = "successful"
	} else {
		txn.Status = "failed"
	}
	txn.CompletedAt = time.Now().Format(time.RFC3339)
	recordTransaction(txn)

	if txn.Status != "successful" {
		respondJSON(w, 502, txn)
		return
	}
	respondJSON(w, 200, txn)
}

func handleTSQ(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	mu.RLock()
	defer mu.RUnlock()
	for _, txn := range nipTransactions {
		if txn.SessionID == sessionID {
			respondJSON(w, 200, map[string]interface{}{"originalTransaction": txn, "tsqStatus": "found"})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Transaction not found", "responseCode": "25"})
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		mu.RLock()
		defer mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"mandates": mandates, "total": len(mandates)})
		return
	}
	// POST — create mandate
	var req DirectDebitMandate
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	req.ID = fmt.Sprintf("DDM-%03d", len(mandates)+1)
	mu.Unlock()
	req.Status = "created"
	req.CreatedAt = time.Now().Format(time.RFC3339)
	mu.Lock()
	mandates = append(mandates, req)
	mu.Unlock()
	respondJSON(w, 201, req)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"transactions": nipTransactions, "total": len(nipTransactions)})
}

func handleSettlements(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"settlements": settlements, "total": len(settlements)})
}

func handleResponseCodes(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"responseCodes": responseCodes, "total": len(responseCodes)})
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	nibssStatus := "configured"
	if nibss.baseURL == "" {
		nibssStatus = "not_configured"
	}
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "nibss-nip-engine-go", "version": "2.0.0",
		"protocol": "ISO_8583", "nipVersion": "2.0",
		"capabilities": []string{"nameEnquiry", "fundsTransfer", "tsq", "directDebit", "settlement"},
		"nibss":        nibssStatus,
		"middleware":   middlewareStatus(),
	})
}

// middlewareStatus reports what is actually configured (env presence), not
// fabricated "connected" states.
func middlewareStatus() map[string]string {
	cfg := func(env string) string {
		if os.Getenv(env) != "" {
			return "configured"
		}
		return "not_configured"
	}
	return map[string]string{
		"nibss":       cfg("NIBSS_BASE_URL"),
		"kafka":       cfg("KAFKA_BROKERS"),
		"postgres":    cfg("DATABASE_URL"),
		"redis":       cfg("REDIS_URL"),
		"tigerbeetle": cfg("TIGERBEETLE_ADDRESSES"),
	}
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8111"
	}
	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/v1/nip/name-enquiry", handleNameEnquiry)
	http.HandleFunc("/v1/nip/funds-transfer", handleFundsTransfer)
	http.HandleFunc("/v1/nip/tsq", handleTSQ)
	http.HandleFunc("/v1/nip/transactions", handleTransactions)
	http.HandleFunc("/v1/nip/mandates", handleMandates)
	http.HandleFunc("/v1/nip/settlements", handleSettlements)
	http.HandleFunc("/v1/nip/response-codes", handleResponseCodes)

	if nibss.baseURL == "" {
		log.Printf("WARNING: NIBSS_BASE_URL not set — name-enquiry and funds-transfer will return 503 (responseCode 96)")
	}
	log.Printf("NIBSS/NIP Engine (Go) on :%s — ISO 8583 + Direct Debit", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
