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

// LN-03 (L3): PAYMENT_URL is REQUIRED. It is resolved once at boot via
// InitPaymentConfig (fail-fast); an empty value previously meant every
// disbursement died against an empty URL (w8:F1-14).
var paymentServiceURL string

// InitPaymentConfig resolves and validates the payment-service URL at boot.
func InitPaymentConfig() error {
	paymentServiceURL = os.Getenv("PAYMENT_URL")
	if paymentServiceURL == "" {
		return fmt.Errorf("PAYMENT_URL env var is required; refusing to start (loan disbursement/repayment would be dead)")
	}
	return nil
}

type PaymentStruct struct {
	Recipient     string `json:"recipient"`
	Amount        string `json:"amount"`
	Note          string `json:"note"`
	TenantID      string `json:"tenant_id"`
	KeycloakID    string `json:"keycloak_id"`
	LedgerID      string `json:"ledger_id"`
	MintAccountID string `json:"mint_account_id"`
}

// PaymentResult carries the server-issued transfer reference.
type PaymentResult struct {
	TransactionID string
	Raw           []byte
}

// Payment executes a transfer via the payment service and returns the
// SERVER-FETCHED transaction reference. Callers must persist that reference;
// client-supplied transaction ids are never trusted (LN-05).
func Payment(payload *PaymentStruct) (*PaymentResult, error) {
	if paymentServiceURL == "" {
		return nil, fmt.Errorf("payment service not configured (PAYMENT_URL empty)")
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payment payload: %w", err)
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", paymentServiceURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to build payment request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-tenant-id", payload.TenantID)
	req.Header.Set("x-keycloak-id", payload.KeycloakID)
	req.Header.Set("x-ledger-id", payload.LedgerID)
	req.Header.Set("x-mint-account-id", payload.MintAccountID)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf(
			"payment failed | status: %d | response: %s",
			resp.StatusCode,
			string(body),
		)
	}

	// Extract the server-issued transaction reference (accept the common key
	// spellings; fail closed if the payment service returns none).
	var parsed map[string]interface{}
	if err := json.Unmarshal(body, &parsed); err == nil {
		for _, k := range []string{"transaction_id", "transactionId", "transfer_id", "reference", "id"} {
			if v, ok := parsed[k].(string); ok && v != "" {
				return &PaymentResult{TransactionID: v, Raw: body}, nil
			}
		}
	}

	log.Printf("WARN: payment succeeded but the payment service returned no transaction reference (loan flow will reject)")
	return &PaymentResult{TransactionID: "", Raw: body}, nil
}
