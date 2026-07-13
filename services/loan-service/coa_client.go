package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type CoAClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewCoAClient() *CoAClient {
	baseURL := os.Getenv("COA_SERVICE_URL")
	if baseURL == "" {
		gatewayURL := os.Getenv("BACKEND_URL")
		if gatewayURL != "" {
			baseURL = gatewayURL + "/chart-of-accounts"
		} else {
			baseURL = "http://chart-of-accounts-service:8080"
		}
	}
	return &CoAClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// PostAsync fires a COA journal entry in a background goroutine.
// Failures are logged but never bubble up to the caller — same pattern as audit.
func (c *CoAClient) PostAsync(tenantID, userID, userRole string, entry CreateJournalEntryRequest) {
	go func() {
		if _, err := c.CreateJournalEntry(tenantID, userID, userRole, entry); err != nil {
			log.Printf("WARN [coa] async journal entry failed (tenant=%s ref=%s): %v", tenantID, entry.Reference, err)
		}
	}()
}

// GetMapping resolves a semantic key (e.g. "loans.interest.sme") to the
// COA account UUID configured by the tenant. Returns "" if not configured.
func (c *CoAClient) GetMapping(tenantID, mappingKey string) string {
	url := fmt.Sprintf("%s/api/v1/mappings/%s", c.baseURL, mappingKey)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("X-Tenant-ID", tenantID)
	req.Header.Set("x-keycloak-id", "system")
	req.Header.Set("X-User-Role", "finance_admin")

	resp, err := c.httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		AccountID string `json:"account_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return ""
	}
	return result.AccountID
}

// CoAAccount represents an account in the Chart of Accounts
type CoAAccount struct {
	ID              string    `json:"id,omitempty"`
	TenantID        string    `json:"tenant_id"`
	Code            string    `json:"code"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	ParentID        string    `json:"parent_id,omitempty"`
	NormalBalance   string    `json:"normal_balance,omitempty"`
	Level           int       `json:"level,omitempty"`
	IsActive        bool      `json:"is_active"`
	IsSystemAccount bool      `json:"is_system_account"`
	Currency        string    `json:"currency"`
	Description     string    `json:"description,omitempty"`
	CreatedAt       time.Time `json:"created_at,omitempty"`
	UpdatedAt       time.Time `json:"updated_at,omitempty"`
}

type JournalLineRequest struct {
	AccountID    string `json:"account_id"`
	Description  string `json:"description,omitempty"`
	DebitAmount  int64  `json:"debit_amount"`
	CreditAmount int64  `json:"credit_amount"`
}

type CreateJournalEntryRequest struct {
	Date        time.Time              `json:"date"`
	Description string                 `json:"description"`
	Reference   string                 `json:"reference,omitempty"`
	Lines       []JournalLineRequest   `json:"lines"`
	PostedBy    string                 `json:"posted_by"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type JournalEntryResponse struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	EntryNumber string                 `json:"entry_number"`
	Date        time.Time              `json:"date"`
	Description string                 `json:"description"`
	Status      string                 `json:"status"`
	Lines       []JournalLine          `json:"lines"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type JournalLine struct {
	ID           string `json:"id"`
	AccountID    string `json:"account_id"`
	AccountCode  string `json:"account_code"`
	AccountName  string `json:"account_name"`
	Description  string `json:"description"`
	DebitAmount  int64  `json:"debit_amount"`
	CreditAmount int64  `json:"credit_amount"`
}

func (c *CoAClient) CreateJournalEntry(tenantID, userID, userRole string, entry CreateJournalEntryRequest) (*JournalEntryResponse, error) {
	body, err := json.Marshal(entry)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal journal entry: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+"/api/v1/journal-entries", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	req.Header.Set("x-keycloak-id", userID)
	req.Header.Set("X-User-Role", userRole)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to create journal entry: %s (status: %d)", string(bodyBytes), resp.StatusCode)
	}

	var result JournalEntryResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return &result, nil
}

// RecordLoanDisbursement posts the journal entry for a loan disbursement.
// Account UUIDs are resolved from the tenant's COA mappings:
//
//	loans.receivable          → asset (Loans Receivable)
//	loans.customer.liability  → liability (Customer Deposits / Nostro)
func (c *CoAClient) RecordLoanDisbursement(tenantID, userID, userRole, loanID, loanType string, amount int64) {
	principalAcct := c.GetMapping(tenantID, "loans.receivable")
	customerAcct := c.GetMapping(tenantID, "loans.customer.liability")

	if principalAcct == "" || customerAcct == "" {
		log.Printf("WARN [coa] disbursement skipped for loan %s — mappings not configured for tenant %s", loanID, tenantID)
		return
	}

	entry := CreateJournalEntryRequest{
		Date:        time.Now(),
		Description: fmt.Sprintf("Loan disbursement - %s", loanID),
		Reference:   loanID,
		PostedBy:    userID,
		Lines: []JournalLineRequest{
			{AccountID: principalAcct, Description: "Loan principal disbursed", DebitAmount: amount},
			{AccountID: customerAcct, Description: "Credit to customer account", CreditAmount: amount},
		},
		Metadata: map[string]interface{}{
			"loan_id": loanID, "loan_type": loanType, "source": "loan-service", "event_type": "disbursement",
		},
	}
	c.PostAsync(tenantID, userID, userRole, entry)
}

// RecordLoanRepayment posts the journal entry for a loan repayment.
// Account UUIDs are resolved from the tenant's COA mappings:
//
//	loans.receivable               → asset (Loans Receivable)
//	loans.interest.<loanType>      → revenue (Interest Income, specific to loan type)
//	loans.customer.liability       → liability (Customer Deposits)
func (c *CoAClient) RecordLoanRepayment(tenantID, userID, userRole, loanID, loanType string, principalAmount, interestAmount int64) {
	principalAcct := c.GetMapping(tenantID, "loans.receivable")
	customerAcct := c.GetMapping(tenantID, "loans.customer.liability")
	interestAcct := c.GetMapping(tenantID, "loans.interest."+loanType)
	if interestAcct == "" {
		// Fall back to generic interest account if loan-type-specific one isn't mapped
		interestAcct = c.GetMapping(tenantID, "loans.interest")
	}

	if principalAcct == "" || customerAcct == "" {
		log.Printf("WARN [coa] repayment skipped for loan %s — mappings not configured for tenant %s", loanID, tenantID)
		return
	}

	totalAmount := principalAmount + interestAmount
	lines := []JournalLineRequest{
		{AccountID: customerAcct, Description: "Loan repayment received", DebitAmount: totalAmount},
		{AccountID: principalAcct, Description: "Principal repayment", CreditAmount: principalAmount},
	}
	if interestAmount > 0 && interestAcct != "" {
		lines = append(lines, JournalLineRequest{
			AccountID: interestAcct, Description: "Interest earned", CreditAmount: interestAmount,
		})
	}

	entry := CreateJournalEntryRequest{
		Date:        time.Now(),
		Description: fmt.Sprintf("Loan repayment - %s", loanID),
		Reference:   loanID,
		PostedBy:    userID,
		Lines:       lines,
		Metadata: map[string]interface{}{
			"loan_id":          loanID,
			"loan_type":        loanType,
			"source":           "loan-service",
			"event_type":       "repayment",
			"principal_amount": principalAmount,
			"interest_amount":  interestAmount,
		},
	}
	c.PostAsync(tenantID, userID, userRole, entry)
}
