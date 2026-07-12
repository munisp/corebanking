package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type ERPNextClient struct {
	baseURL    string
	apiKey     string
	apiSecret  string
	oauthToken string
	httpClient *http.Client
}

func NewERPNextClient(baseURL, apiKey, apiSecret, oauthToken string) *ERPNextClient {
	return &ERPNextClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		apiSecret:  apiSecret,
		oauthToken: oauthToken,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *ERPNextClient) doRequest(ctx context.Context, method, endpoint string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(data)
	}

	reqURL := fmt.Sprintf("%s%s", c.baseURL, endpoint)
	req, err := http.NewRequestWithContext(ctx, method, reqURL, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	if c.oauthToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.oauthToken))
	} else if c.apiKey != "" && c.apiSecret != "" {
		req.Header.Set("Authorization", fmt.Sprintf("token %s:%s", c.apiKey, c.apiSecret))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ERPNext API error: %s - %s", resp.Status, string(respBody))
	}

	return respBody, nil
}

type ERPNextResponse struct {
	Message interface{} `json:"message"`
	Data    interface{} `json:"data"`
}

type ERPNextBankAccount struct {
	Name            string  `json:"name"`
	AccountName     string  `json:"account_name"`
	Account         string  `json:"account"`
	BankAccountNo   string  `json:"bank_account_no"`
	Bank            string  `json:"bank"`
	BankAccountType string  `json:"bank_account_type"`
	IsCompanyAccount int    `json:"is_company_account"`
	IsDefault       int     `json:"is_default"`
	Company         string  `json:"company"`
	Currency        string  `json:"account_currency"`
}

type ERPNextBankTransaction struct {
	Name              string    `json:"name"`
	Date              string    `json:"date"`
	BankAccount       string    `json:"bank_account"`
	Deposit           float64   `json:"deposit"`
	Withdrawal        float64   `json:"withdrawal"`
	Currency          string    `json:"currency"`
	Description       string    `json:"description"`
	ReferenceNumber   string    `json:"reference_number"`
	TransactionType   string    `json:"transaction_type"`
	Status            string    `json:"status"`
	UnallocatedAmount float64   `json:"unallocated_amount"`
	AllocatedAmount   float64   `json:"allocated_amount"`
}

type ERPNextPaymentEntry struct {
	Name            string  `json:"name"`
	PaymentType     string  `json:"payment_type"`
	PostingDate     string  `json:"posting_date"`
	Company         string  `json:"company"`
	ModeOfPayment   string  `json:"mode_of_payment"`
	PartyType       string  `json:"party_type"`
	Party           string  `json:"party"`
	PartyName       string  `json:"party_name"`
	PaidFrom        string  `json:"paid_from"`
	PaidTo          string  `json:"paid_to"`
	PaidAmount      float64 `json:"paid_amount"`
	ReceivedAmount  float64 `json:"received_amount"`
	ReferenceNo     string  `json:"reference_no"`
	ReferenceDate   string  `json:"reference_date"`
	Status          string  `json:"status"`
}

type ERPNextSalesInvoice struct {
	Name              string  `json:"name"`
	Customer          string  `json:"customer"`
	CustomerName      string  `json:"customer_name"`
	PostingDate       string  `json:"posting_date"`
	DueDate           string  `json:"due_date"`
	Currency          string  `json:"currency"`
	GrandTotal        float64 `json:"grand_total"`
	OutstandingAmount float64 `json:"outstanding_amount"`
	Status            string  `json:"status"`
	IsReturn          int     `json:"is_return"`
}

type ERPNextPurchaseInvoice struct {
	Name              string  `json:"name"`
	Supplier          string  `json:"supplier"`
	SupplierName      string  `json:"supplier_name"`
	PostingDate       string  `json:"posting_date"`
	DueDate           string  `json:"due_date"`
	Currency          string  `json:"currency"`
	GrandTotal        float64 `json:"grand_total"`
	OutstandingAmount float64 `json:"outstanding_amount"`
	Status            string  `json:"status"`
}

type ERPNextJournalEntry struct {
	Name        string                    `json:"name"`
	PostingDate string                    `json:"posting_date"`
	Company     string                    `json:"company"`
	VoucherType string                    `json:"voucher_type"`
	TotalDebit  float64                   `json:"total_debit"`
	TotalCredit float64                   `json:"total_credit"`
	Accounts    []ERPNextJournalAccount   `json:"accounts"`
}

type ERPNextJournalAccount struct {
	Account       string  `json:"account"`
	PartyType     string  `json:"party_type"`
	Party         string  `json:"party"`
	DebitInAccountCurrency  float64 `json:"debit_in_account_currency"`
	CreditInAccountCurrency float64 `json:"credit_in_account_currency"`
}

type ERPNextAccount struct {
	Name          string `json:"name"`
	AccountName   string `json:"account_name"`
	AccountNumber string `json:"account_number"`
	AccountType   string `json:"account_type"`
	RootType      string `json:"root_type"`
	IsGroup       int    `json:"is_group"`
	Company       string `json:"company"`
	Currency      string `json:"account_currency"`
	ParentAccount string `json:"parent_account"`
}

func (c *ERPNextClient) GetBankAccounts(ctx context.Context) ([]ERPNextBankAccount, error) {
	endpoint := "/api/resource/Bank Account?fields=[\"*\"]&limit_page_length=0"
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextBankAccount `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) GetBankTransactions(ctx context.Context, bankAccount string, fromDate, toDate string) ([]ERPNextBankTransaction, error) {
	filters := url.QueryEscape(fmt.Sprintf(`[["bank_account","=","%s"],["date",">=","%s"],["date","<=","%s"]]`, bankAccount, fromDate, toDate))
	endpoint := fmt.Sprintf("/api/resource/Bank Transaction?fields=[\"*\"]&filters=%s&limit_page_length=0", filters)
	
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextBankTransaction `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) GetPaymentEntries(ctx context.Context, fromDate, toDate string) ([]ERPNextPaymentEntry, error) {
	filters := url.QueryEscape(fmt.Sprintf(`[["posting_date",">=","%s"],["posting_date","<=","%s"]]`, fromDate, toDate))
	endpoint := fmt.Sprintf("/api/resource/Payment Entry?fields=[\"*\"]&filters=%s&limit_page_length=0", filters)
	
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextPaymentEntry `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) GetSalesInvoices(ctx context.Context, status string) ([]ERPNextSalesInvoice, error) {
	var filters string
	if status != "" {
		filters = url.QueryEscape(fmt.Sprintf(`[["status","=","%s"]]`, status))
	} else {
		filters = url.QueryEscape(`[["outstanding_amount",">",0]]`)
	}
	endpoint := fmt.Sprintf("/api/resource/Sales Invoice?fields=[\"*\"]&filters=%s&limit_page_length=0", filters)
	
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextSalesInvoice `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) GetPurchaseInvoices(ctx context.Context, status string) ([]ERPNextPurchaseInvoice, error) {
	var filters string
	if status != "" {
		filters = url.QueryEscape(fmt.Sprintf(`[["status","=","%s"]]`, status))
	} else {
		filters = url.QueryEscape(`[["outstanding_amount",">",0]]`)
	}
	endpoint := fmt.Sprintf("/api/resource/Purchase Invoice?fields=[\"*\"]&filters=%s&limit_page_length=0", filters)
	
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextPurchaseInvoice `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) GetAccounts(ctx context.Context, company string) ([]ERPNextAccount, error) {
	filters := url.QueryEscape(fmt.Sprintf(`[["company","=","%s"]]`, company))
	endpoint := fmt.Sprintf("/api/resource/Account?fields=[\"*\"]&filters=%s&limit_page_length=0", filters)
	
	resp, err := c.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []ERPNextAccount `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result.Data, nil
}

func (c *ERPNextClient) CreateBankTransaction(ctx context.Context, transaction ERPNextBankTransaction) (*ERPNextBankTransaction, error) {
	resp, err := c.doRequest(ctx, "POST", "/api/resource/Bank Transaction", transaction)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data ERPNextBankTransaction `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

func (c *ERPNextClient) CreatePaymentEntry(ctx context.Context, payment ERPNextPaymentEntry) (*ERPNextPaymentEntry, error) {
	resp, err := c.doRequest(ctx, "POST", "/api/resource/Payment Entry", payment)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data ERPNextPaymentEntry `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

func (c *ERPNextClient) CreateJournalEntry(ctx context.Context, entry ERPNextJournalEntry) (*ERPNextJournalEntry, error) {
	resp, err := c.doRequest(ctx, "POST", "/api/resource/Journal Entry", entry)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data ERPNextJournalEntry `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

func (c *ERPNextClient) ReconcileBankTransaction(ctx context.Context, transactionName string, paymentEntries []string) error {
	payload := map[string]interface{}{
		"bank_transaction": transactionName,
		"payment_entries":  paymentEntries,
	}

	_, err := c.doRequest(ctx, "POST", "/api/method/erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.reconcile_vouchers", payload)
	return err
}

func (c *ERPNextClient) GetAccountBalance(ctx context.Context, account, company string, date string) (float64, error) {
	payload := map[string]interface{}{
		"account": account,
		"company": company,
		"date":    date,
	}

	resp, err := c.doRequest(ctx, "POST", "/api/method/erpnext.accounts.utils.get_balance_on", payload)
	if err != nil {
		return 0, err
	}

	var result struct {
		Message float64 `json:"message"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return 0, err
	}

	return result.Message, nil
}

func (c *ERPNextClient) GetTrialBalance(ctx context.Context, company, fromDate, toDate string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"company":   company,
		"from_date": fromDate,
		"to_date":   toDate,
	}

	resp, err := c.doRequest(ctx, "POST", "/api/method/erpnext.accounts.report.trial_balance.trial_balance.execute", payload)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *ERPNextClient) SubmitDocument(ctx context.Context, doctype, name string) error {
	endpoint := fmt.Sprintf("/api/resource/%s/%s", doctype, name)
	payload := map[string]interface{}{
		"docstatus": 1,
	}

	_, err := c.doRequest(ctx, "PUT", endpoint, payload)
	return err
}

func (c *ERPNextClient) CancelDocument(ctx context.Context, doctype, name string) error {
	endpoint := fmt.Sprintf("/api/resource/%s/%s", doctype, name)
	payload := map[string]interface{}{
		"docstatus": 2,
	}

	_, err := c.doRequest(ctx, "PUT", endpoint, payload)
	return err
}

type ERPNextWebhook struct {
	Name          string `json:"name"`
	WebhookDoctype string `json:"webhook_doctype"`
	WebhookDocevent string `json:"webhook_docevent"`
	RequestURL    string `json:"request_url"`
	RequestMethod string `json:"request_method"`
	Enabled       int    `json:"enabled"`
}

func (c *ERPNextClient) CreateWebhook(ctx context.Context, webhook ERPNextWebhook) (*ERPNextWebhook, error) {
	resp, err := c.doRequest(ctx, "POST", "/api/resource/Webhook", webhook)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data ERPNextWebhook `json:"data"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return nil, err
	}

	return &result.Data, nil
}

func (c *ERPNextClient) DeleteWebhook(ctx context.Context, webhookName string) error {
	endpoint := fmt.Sprintf("/api/resource/Webhook/%s", webhookName)
	_, err := c.doRequest(ctx, "DELETE", endpoint, nil)
	return err
}
