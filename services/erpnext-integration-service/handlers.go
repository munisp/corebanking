package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// respondJSON writes a JSON response with proper headers
func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// respondJSONOK writes a 200 OK JSON response with proper headers
func respondJSONOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func listConnectionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	connections, err := integrationService.ListConnections(ctx, tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"connections": connections,
		"total":       len(connections),
	})
}

func createConnectionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var conn ERPConnection
	if err := json.NewDecoder(r.Body).Decode(&conn); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	created, err := integrationService.CreateConnection(ctx, tenantID, customerID, &conn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, created)
}

func getConnectionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := mux.Vars(r)["id"]

	conn, err := integrationService.GetConnection(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSONOK(w, conn)
}

func updateConnectionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := mux.Vars(r)["id"]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	conn, err := integrationService.UpdateConnection(ctx, tenantID, customerID, connectionID, updates)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, conn)
}

func deleteConnectionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := mux.Vars(r)["id"]

	if err := integrationService.DeleteConnection(ctx, tenantID, customerID, connectionID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func testConnectionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := mux.Vars(r)["id"]

	success, err := integrationService.TestConnection(ctx, tenantID, customerID, connectionID)
	if err != nil {
		respondJSONOK(w, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"success": success,
	})
}

func triggerSyncHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := mux.Vars(r)["id"]

	var req struct {
		SyncType string `json:"sync_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.SyncType == "" {
		req.SyncType = "full"
	}

	job := &SyncJob{
		ID:           uuid.New().String(),
		ConnectionID: connectionID,
		TenantID:     tenantID,
		CustomerID:   customerID,
		JobType:      SyncJobType(req.SyncType),
		Status:       SyncJobStatusPending,
		StartedAt:    time.Now(),
	}

	go integrationService.ExecuteSyncJob(ctx, job)

	respondJSON(w, http.StatusAccepted, job)
}

func oauthAuthorizeHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r.Context())
	customerID := getCustomerID(r.Context())
	connectionID := r.URL.Query().Get("connection_id")

	state := fmt.Sprintf("%s:%s:%s", tenantID, customerID, connectionID)

	erpBaseURL := r.URL.Query().Get("erp_url")
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")

	authURL := fmt.Sprintf("%s/api/method/frappe.integrations.oauth2.authorize?client_id=%s&redirect_uri=%s&response_type=code&state=%s",
		erpBaseURL, clientID, redirectURI, state)

	http.Redirect(w, r, authURL, http.StatusFound)
}

func oauthCallbackHandler(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" {
		http.Error(w, "Authorization code not provided", http.StatusBadRequest)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"success": true,
		"code":    code,
		"state":   state,
		"message": "OAuth callback received. Exchange code for token using /oauth/token endpoint.",
	})
}

func oauthTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
		Code         string `json:"code"`
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
		RedirectURI  string `json:"redirect_uri"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	conn, err := integrationService.GetConnection(ctx, tenantID, customerID, req.ConnectionID)
	if err != nil {
		http.Error(w, "Connection not found", http.StatusNotFound)
		return
	}

	token, err := integrationService.ExchangeOAuthCode(ctx, conn, req.Code, req.ClientID, req.ClientSecret, req.RedirectURI)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, token)
}

func oauthRefreshHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	conn, err := integrationService.GetConnection(ctx, tenantID, customerID, req.ConnectionID)
	if err != nil {
		http.Error(w, "Connection not found", http.StatusNotFound)
		return
	}

	token, err := integrationService.RefreshOAuthToken(ctx, conn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, token)
}

func listBankAccountsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	accounts, err := integrationService.GetBankAccounts(ctx, tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"accounts": accounts,
		"total":    len(accounts),
	})
}

func getBankTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	accountID := mux.Vars(r)["id"]

	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	if fromDate == "" {
		fromDate = time.Now().AddDate(0, -1, 0).Format("2006-01-02")
	}
	if toDate == "" {
		toDate = time.Now().Format("2006-01-02")
	}

	transactions, err := integrationService.GetBankTransactions(ctx, tenantID, customerID, accountID, fromDate, toDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"transactions": transactions,
		"total":        len(transactions),
		"from_date":    fromDate,
		"to_date":      toDate,
	})
}

func getBankBalanceHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	accountID := mux.Vars(r)["id"]

	balance, err := integrationService.GetBankBalance(ctx, tenantID, customerID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, balance)
}

func autoReconcileHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
		AccountID    string `json:"account_id"`
		FromDate     string `json:"from_date"`
		ToDate       string `json:"to_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := integrationService.AutoReconcile(ctx, tenantID, customerID, req.ConnectionID, req.AccountID, req.FromDate, req.ToDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, result)
}

func manualReconcileHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID      string `json:"connection_id"`
		BankTransactionID string `json:"bank_transaction_id"`
		ERPEntryID        string `json:"erp_entry_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := integrationService.ManualReconcile(ctx, tenantID, customerID, req.ConnectionID, req.BankTransactionID, req.ERPEntryID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"success": true,
		"message": "Transaction reconciled successfully",
	})
}

func reconciliationStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	status, err := integrationService.GetReconciliationStatus(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, status)
}

func unmatchedTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	transactions, err := integrationService.GetUnmatchedTransactions(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"transactions": transactions,
		"total":        len(transactions),
	})
}

func listPaymentsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	status := r.URL.Query().Get("status")

	payments, err := integrationService.ListPayments(ctx, tenantID, customerID, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"payments": payments,
		"total":    len(payments),
	})
}

func initiatePaymentHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var payment Payment
	if err := json.NewDecoder(r.Body).Decode(&payment); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	created, err := integrationService.InitiatePayment(ctx, tenantID, customerID, &payment)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, created)
}

func getPaymentHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	paymentID := mux.Vars(r)["id"]

	payment, err := integrationService.GetPayment(ctx, tenantID, customerID, paymentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSONOK(w, payment)
}

func getPaymentStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	paymentID := mux.Vars(r)["id"]

	status, err := integrationService.GetPaymentStatus(ctx, tenantID, customerID, paymentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"payment_id": paymentID,
		"status":     status,
	})
}

func bulkPaymentHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string    `json:"connection_id"`
		Payments     []Payment `json:"payments"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	results, err := integrationService.ProcessBulkPayments(ctx, tenantID, customerID, req.ConnectionID, req.Payments)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, results)
}

func listInvoicesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")
	status := r.URL.Query().Get("status")

	invoices, err := integrationService.ListInvoices(ctx, tenantID, customerID, connectionID, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"invoices": invoices,
		"total":    len(invoices),
	})
}

func matchInvoicePaymentHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	invoiceID := mux.Vars(r)["id"]

	var req struct {
		ConnectionID  string `json:"connection_id"`
		TransactionID string `json:"transaction_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := integrationService.MatchInvoicePayment(ctx, tenantID, customerID, req.ConnectionID, invoiceID, req.TransactionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"success": true,
		"message": "Invoice matched with payment",
	})
}

func autoMatchInvoicesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := integrationService.AutoMatchInvoices(ctx, tenantID, customerID, req.ConnectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, result)
}

func listLoansHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	loans, err := integrationService.ListLoans(ctx, tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"loans": loans,
		"total": len(loans),
	})
}

func getLoanHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	loanID := mux.Vars(r)["id"]

	loan, err := integrationService.GetLoan(ctx, tenantID, customerID, loanID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSONOK(w, loan)
}

func getLoanScheduleHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	loanID := mux.Vars(r)["id"]

	schedule, err := integrationService.GetLoanSchedule(ctx, tenantID, customerID, loanID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSONOK(w, schedule)
}

func makeLoanPaymentHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	loanID := mux.Vars(r)["id"]

	var req struct {
		Amount        float64 `json:"amount"`
		SourceAccount string  `json:"source_account"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	payment, err := integrationService.MakeLoanPayment(ctx, tenantID, customerID, loanID, req.Amount, req.SourceAccount)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, payment)
}

func getCashPositionHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	position, err := integrationService.GetCashPosition(ctx, tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, position)
}

func getCashForecastHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		fmt.Sscanf(d, "%d", &days)
	}

	forecast, err := integrationService.GetCashForecast(ctx, tenantID, customerID, days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, forecast)
}

func listWebhooksHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	webhooks, err := integrationService.ListWebhooks(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"webhooks": webhooks,
		"total":    len(webhooks),
	})
}

func createWebhookHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var webhook Webhook
	if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	created, err := integrationService.CreateWebhook(ctx, tenantID, customerID, &webhook)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, created)
}

func deleteWebhookHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	webhookID := mux.Vars(r)["id"]

	if err := integrationService.DeleteWebhook(ctx, tenantID, customerID, webhookID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func erpnextWebhookHandler(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connection_id"]

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	go integrationService.ProcessERPNextWebhook(context.Background(), connectionID, payload)

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"received": true,
	})
}

func bankWebhookHandler(w http.ResponseWriter, r *http.Request) {
	connectionID := mux.Vars(r)["connection_id"]

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	go integrationService.ProcessBankWebhook(context.Background(), connectionID, payload)

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"received": true,
	})
}

func syncAccountsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := integrationService.SyncAccounts(ctx, tenantID, customerID, req.ConnectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, result)
}

func syncTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
		FromDate     string `json:"from_date"`
		ToDate       string `json:"to_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := integrationService.SyncTransactions(ctx, tenantID, customerID, req.ConnectionID, req.FromDate, req.ToDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, result)
}

func syncInvoicesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var req struct {
		ConnectionID string `json:"connection_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := integrationService.SyncInvoices(ctx, tenantID, customerID, req.ConnectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, result)
}

func getSyncStatusHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	status, err := integrationService.GetSyncStatus(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, status)
}

func getSyncHistoryHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	history, err := integrationService.GetSyncHistory(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"history": history,
		"total":   len(history),
	})
}

func listAccountMappingsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")

	mappings, err := integrationService.ListAccountMappings(ctx, tenantID, customerID, connectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, map[string]interface{}{
		"mappings": mappings,
		"total":    len(mappings),
	})
}

func createAccountMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)

	var mapping AccountMapping
	if err := json.NewDecoder(r.Body).Decode(&mapping); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	created, err := integrationService.CreateAccountMapping(ctx, tenantID, customerID, &mapping)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, created)
}

func updateAccountMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	mappingID := mux.Vars(r)["id"]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	mapping, err := integrationService.UpdateAccountMapping(ctx, tenantID, customerID, mappingID, updates)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, mapping)
}

func deleteAccountMappingHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	mappingID := mux.Vars(r)["id"]

	if err := integrationService.DeleteAccountMapping(ctx, tenantID, customerID, mappingID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func reconciliationReportHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	connectionID := r.URL.Query().Get("connection_id")
	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	report, err := integrationService.GenerateReconciliationReport(ctx, tenantID, customerID, connectionID, fromDate, toDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, report)
}

func cashFlowReportHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	report, err := integrationService.GenerateCashFlowReport(ctx, tenantID, customerID, fromDate, toDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, report)
}

func paymentSummaryReportHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := getTenantID(ctx)
	customerID := getCustomerID(ctx)
	fromDate := r.URL.Query().Get("from_date")
	toDate := r.URL.Query().Get("to_date")

	report, err := integrationService.GeneratePaymentSummaryReport(ctx, tenantID, customerID, fromDate, toDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSONOK(w, report)
}
