package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// AccountServiceAdapter handles communication with the account service
type AccountServiceAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewAccountServiceAdapter() *AccountServiceAdapter {
	baseURL := os.Getenv("ACCOUNT_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://account-service"
	}

	return &AccountServiceAdapter{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Account response from account service
type AccountServiceAccount struct {
	ID            int     `json:"id"`
	AccountNumber string  `json:"account_number"`
	Name          string  `json:"name"`    // API returns "name" not "account_name"
	Balance       float64 `json:"balance"` // Balance now included in /account/all response
	AccountType   string  `json:"account_type"`
	TenantID      string  `json:"tenant_id"`
	LedgerID      string  `json:"ledger_id"`
	KeycloakID    string  `json:"keycloak_id"`
	Status        string  `json:"status"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
	DeletedAt     *string `json:"deleted_at"`
}

type AccountsResponse struct {
	Message  string                  `json:"message"`
	Accounts []AccountServiceAccount `json:"account"` // Note: API returns "account" not "accounts"
}

// GetAccounts fetches all accounts for a tenant/customer
func (a *AccountServiceAdapter) GetAccounts(ctx context.Context, tenantID, keycloakID, ledgerID string) ([]BankAccount, error) {
	url := fmt.Sprintf("%s/account/all", a.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add required headers
	req.Header.Set("X-Tenant-ID", tenantID)
	req.Header.Set("X-Keycloak-ID", keycloakID)
	req.Header.Set("X-Ledger-ID", ledgerID)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call account service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("account service returned error %d: %s", resp.StatusCode, string(body))
	}

	var accountsResp AccountsResponse
	if err := json.NewDecoder(resp.Body).Decode(&accountsResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to BankAccount format
	bankAccounts := make([]BankAccount, 0, len(accountsResp.Accounts))
	for _, acc := range accountsResp.Accounts {
		bankAccounts = append(bankAccounts, BankAccount{
			ID:               fmt.Sprintf("%d", acc.ID),
			AccountNumber:    acc.AccountNumber,
			AccountName:      acc.Name,
			BankName:         tenantID,    // Use tenant ID as bank name
			Currency:         "NGN",       // Default currency
			Balance:          acc.Balance, // Balance now included in response
			AvailableBalance: acc.Balance,
			AccountType:      acc.AccountType,
			Status:           acc.Status,
		})
	}

	return bankAccounts, nil
}

// LoanServiceAdapter handles communication with the loan service
type LoanServiceAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewLoanServiceAdapter() *LoanServiceAdapter {
	baseURL := os.Getenv("LOAN_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://loan-service"
	}

	return &LoanServiceAdapter{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type LoanApplication struct {
	ID           string  `json:"id"`
	LoanID       string  `json:"loan_application_id"`
	TenantID     string  `json:"tenant_id"`
	ApplicantID  string  `json:"applicant_id"`
	LoanAmount   float64 `json:"loan_amount"`
	LoanPurpose  string  `json:"loan_purpose"`
	Status       string  `json:"status"`
	InterestRate float64 `json:"loan_interest_rate_percent"`
}

type LoansResponse struct {
	Loans []LoanApplication `json:"loans"`
}

// GetLoans fetches all loans for a customer
func (l *LoanServiceAdapter) GetLoans(ctx context.Context, tenantID, customerID string) ([]LoanApplication, error) {
	// Align with loan-service API: /api/v1/loans/applications
	// which returns an array of LoanApplication for the current customer
	url := fmt.Sprintf("%s/api/v1/loans/applications", l.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// loan-service expects tenant and keycloak IDs in headers
	req.Header.Set("X-Tenant-ID", tenantID)
	req.Header.Set("X-Keycloak-ID", customerID)
	req.Header.Set("Content-Type", "application/json")

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call loan service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("loan service returned error %d: %s", resp.StatusCode, string(body))
	}

	var loans []LoanApplication
	if err := json.NewDecoder(resp.Body).Decode(&loans); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return loans, nil
}

// PaymentServiceAdapter handles communication with the payment service
type PaymentServiceAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewPaymentServiceAdapter() *PaymentServiceAdapter {
	baseURL := os.Getenv("PAYMENT_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://payment-processing-service"
	}

	return &PaymentServiceAdapter{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}
