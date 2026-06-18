package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// Event subscription models
type DaprSubscription struct {
	PubsubName string `json:"pubsubname"`
	Topic      string `json:"topic"`
	Route      string `json:"route"`
}

type CloudEvent struct {
	ID              string                 `json:"id"`
	Source          string                 `json:"source"`
	Type            string                 `json:"type"`
	SpecVersion     string                 `json:"specversion"`
	DataContentType string                 `json:"datacontenttype"`
	Data            map[string]interface{} `json:"data"`
	Topic           string                 `json:"topic"`
	PubsubName      string                 `json:"pubsubname"`
}

// Business event models
type LoanEvent struct {
	Type          string                 `json:"type"`
	LoanID        string                 `json:"loan_id"`
	TenantID      string                 `json:"tenant_id"`
	CustomerID    string                 `json:"customer_id"`
	Amount        float64                `json:"amount"`
	Status        string                 `json:"status"`
	Timestamp     time.Time              `json:"timestamp"`
	TransactionID string                 `json:"transaction_id,omitempty"`
	PaymentMethod string                 `json:"payment_method,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type TransactionEvent struct {
	TransactionID string    `json:"transaction_id"`
	TenantID      string    `json:"tenant_id"`
	Payer         string    `json:"payer"`
	Payee         string    `json:"payee"`
	Amount        string    `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	Note          string    `json:"note"`
	Tag           string    `json:"tag"`
	CompletedAt   time.Time `json:"completed_at"`
	LedgerID      string    `json:"ledger_id"`
}

type AccountEvent struct {
	Type        string                 `json:"type"`
	AccountID   string                 `json:"account_id"`
	TenantID    string                 `json:"tenant_id"`
	CustomerID  string                 `json:"customer_id"`
	AccountType string                 `json:"account_type"`
	Balance     float64                `json:"balance"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type PaymentEvent struct {
	Type          string    `json:"type"`
	PaymentID     string    `json:"payment_id"`
	TenantID      string    `json:"tenant_id"`
	CustomerID    string    `json:"customer_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	PaymentMethod string    `json:"payment_method"`
	Timestamp     time.Time `json:"timestamp"`
}

type SavingsEvent struct {
	Type       string                 `json:"type"`
	GoalID     string                 `json:"goal_id,omitempty"`
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id"`
	Amount     float64                `json:"amount,omitempty"`
	Balance    float64                `json:"balance,omitempty"`
	Status     string                 `json:"status,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type MortgageEvent struct {
	Type          string                 `json:"type"`
	MortgageID    string                 `json:"mortgage_id"`
	TenantID      string                 `json:"tenant_id"`
	CustomerID    string                 `json:"customer_id,omitempty"`
	Status        string                 `json:"status,omitempty"`
	Amount        float64                `json:"amount,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

type LpoEvent struct {
	Type       string                 `json:"type"`
	LpoID      string                 `json:"lpo_id"`
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id"`
	Amount     float64                `json:"amount,omitempty"`
	Status     string                 `json:"status,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// Dapr subscription handler
func subscribeHandler(w http.ResponseWriter, r *http.Request) {
	subscriptions := []DaprSubscription{
		// Transaction events
		{
			PubsubName: "pubsub",
			Topic:      "transaction.initiated",
			Route:      "/events/transaction",
		},
		// Loan events
		{
			PubsubName: "pubsub",
			Topic:      "loan.application.created",
			Route:      "/events/loan",
		},
		{
			PubsubName: "pubsub",
			Topic:      "loan.disbursed",
			Route:      "/events/loan",
		},
		{
			PubsubName: "pubsub",
			Topic:      "loan.payment.recorded",
			Route:      "/events/loan",
		},
		// Account events
		{
			PubsubName: "pubsub",
			Topic:      "account.created",
			Route:      "/events/account",
		},
		{
			PubsubName: "pubsub",
			Topic:      "account.updated",
			Route:      "/events/account",
		},
		// Payment processing events
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.transaction",
			Route:      "/events/payment",
		},
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.payout",
			Route:      "/events/payment",
		},
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.loan",
			Route:      "/events/payment",
		},
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.lpo",
			Route:      "/events/payment",
		},
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.deposit",
			Route:      "/events/payment",
		},
		{
			PubsubName: "pubsub",
			Topic:      "payment.processing.transfer",
			Route:      "/events/payment",
		},
		// Savings events
		{
			PubsubName: "pubsub",
			Topic:      "savings.goal",
			Route:      "/events/savings",
		},
		{
			PubsubName: "pubsub",
			Topic:      "savings.transaction",
			Route:      "/events/savings",
		},
		// Mortgage events
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.applications",
			Route:      "/events/mortgage",
		},
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.disbursements",
			Route:      "/events/mortgage",
		},
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.payments",
			Route:      "/events/mortgage",
		},
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.workflows",
			Route:      "/events/mortgage",
		},
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.arrears",
			Route:      "/events/mortgage",
		},
		{
			PubsubName: "pubsub",
			Topic:      "mortgages.collections",
			Route:      "/events/mortgage",
		},
		// LPO events
		{
			PubsubName: "pubsub",
			Topic:      "lpo.lifecycle",
			Route:      "/events/lpo",
		},
		{
			PubsubName: "pubsub",
			Topic:      "lpo.application",
			Route:      "/events/lpo",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscriptions)
	log.Printf("Subscriptions registered: %d topics", len(subscriptions))
}

// Transaction event handler
func handleTransactionEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding transaction event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract transaction data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var txnEvent TransactionEvent
	if err := json.Unmarshal(eventData, &txnEvent); err != nil {
		log.Printf("Error parsing transaction event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received transaction event: %s for tenant %s", txnEvent.TransactionID, txnEvent.TenantID)

	// Process transaction event
	go processTransactionEvent(txnEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Loan event handler
func handleLoanEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding loan event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract loan data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var loanEvent LoanEvent
	if err := json.Unmarshal(eventData, &loanEvent); err != nil {
		log.Printf("Error parsing loan event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received loan event: %s (type: %s) for tenant %s", loanEvent.LoanID, loanEvent.Type, loanEvent.TenantID)

	// Process loan event
	go processLoanEvent(loanEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Account event handler
func handleAccountEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding account event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract account data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var acctEvent AccountEvent
	if err := json.Unmarshal(eventData, &acctEvent); err != nil {
		log.Printf("Error parsing account event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received account event: %s (type: %s) for tenant %s", acctEvent.AccountID, acctEvent.Type, acctEvent.TenantID)

	// Process account event
	go processAccountEvent(acctEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Payment event handler
func handlePaymentEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding payment event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract payment data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var paymentEvent PaymentEvent
	if err := json.Unmarshal(eventData, &paymentEvent); err != nil {
		log.Printf("Error parsing payment event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received payment event: %s (type: %s) for tenant %s", paymentEvent.PaymentID, paymentEvent.Type, paymentEvent.TenantID)

	// Process payment event
	go processPaymentEvent(paymentEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Savings event handler
func handleSavingsEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding savings event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract savings data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var savingsEvent SavingsEvent
	if err := json.Unmarshal(eventData, &savingsEvent); err != nil {
		log.Printf("Error parsing savings event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received savings event: %s (type: %s) for tenant %s", savingsEvent.GoalID, savingsEvent.Type, savingsEvent.TenantID)

	// Process savings event
	go processSavingsEvent(savingsEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Mortgage event handler
func handleMortgageEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding mortgage event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract mortgage data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var mortgageEvent MortgageEvent
	if err := json.Unmarshal(eventData, &mortgageEvent); err != nil {
		log.Printf("Error parsing mortgage event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received mortgage event: %s (type: %s) for tenant %s", mortgageEvent.MortgageID, mortgageEvent.Type, mortgageEvent.TenantID)

	// Process mortgage event
	go processMortgageEvent(mortgageEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// LPO event handler
func handleLpoEvent(w http.ResponseWriter, r *http.Request) {
	var cloudEvent CloudEvent
	if err := json.NewDecoder(r.Body).Decode(&cloudEvent); err != nil {
		log.Printf("Error decoding lpo event: %v", err)
		http.Error(w, "Invalid event", http.StatusBadRequest)
		return
	}

	// Extract lpo data
	eventData, _ := json.Marshal(cloudEvent.Data)
	var lpoEvent LpoEvent
	if err := json.Unmarshal(eventData, &lpoEvent); err != nil {
		log.Printf("Error parsing lpo event data: %v", err)
		http.Error(w, "Invalid event data", http.StatusBadRequest)
		return
	}

	log.Printf("Received lpo event: %s (type: %s) for tenant %s", lpoEvent.LpoID, lpoEvent.Type, lpoEvent.TenantID)

	// Process LPO event
	go processLpoEvent(lpoEvent)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Event processors
func processTransactionEvent(event TransactionEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, "")
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		// Create bank transaction record
		txn := BankTransaction{
			ID:              event.TransactionID,
			AccountID:       event.Payer,
			TransactionDate: event.CompletedAt,
			ValueDate:       event.CompletedAt,
			Description:     event.Note,
			Reference:       event.TransactionID,
			Amount:          parseAmount(event.Amount),
			Currency:        event.Currency,
			Type:            determineTransactionType(event.Payer, event.Payee),
			Reconciled:      false,
		}

		// Sync to ERPNext
		if err := syncTransactionToERP(ctx, conn, txn); err != nil {
			log.Printf("Error syncing transaction %s to ERP: %v", event.TransactionID, err)
		} else {
			log.Printf("Successfully synced transaction %s to ERPNext for connection %s", event.TransactionID, conn.ID)
		}
	}
}

func processLoanEvent(event LoanEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, event.CustomerID)
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		switch event.Type {
		case "loan.disbursed":
			if err := syncLoanDisbursementToERP(ctx, conn, event); err != nil {
				log.Printf("Error syncing loan disbursement to ERP: %v", err)
			} else {
				log.Printf("Successfully synced loan disbursement %s to ERPNext", event.LoanID)
			}

		case "loan.payment.recorded":
			if err := syncLoanPaymentToERP(ctx, conn, event); err != nil {
				log.Printf("Error syncing loan payment to ERP: %v", err)
			} else {
				log.Printf("Successfully synced loan payment %s to ERPNext", event.TransactionID)
			}

		case "loan.application.created":
			log.Printf("Loan application created: %s (tracking only, no ERP sync)", event.LoanID)
		}
	}
}

func processAccountEvent(event AccountEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, event.CustomerID)
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		if event.Type == "account.created" || event.Type == "account.updated" {
			if err := syncAccountToERP(ctx, conn, event); err != nil {
				log.Printf("Error syncing account to ERP: %v", err)
			} else {
				log.Printf("Successfully synced account %s to ERPNext", event.AccountID)
			}
		}
	}
}

// Helper functions
func parseAmount(amountStr string) float64 {
	var amount float64
	fmt.Sscanf(amountStr, "%f", &amount)
	return amount
}

func determineTransactionType(payer, payee string) string {
	if payee == "MINT_ACCOUNT" {
		return "credit"
	}
	return "debit"
}

func syncTransactionToERP(ctx context.Context, conn *ERPConnection, txn BankTransaction) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Create Journal Entry in ERPNext
	journalEntry := ERPNextJournalEntry{
		PostingDate: txn.TransactionDate.Format("2006-01-02"),
		Company:     "Default Company",
		VoucherType: "Journal Entry",
		TotalDebit:  txn.Amount,
		TotalCredit: txn.Amount,
		Accounts: []ERPNextJournalAccount{
			{
				Account:                 "Bank Account - DC",
				DebitInAccountCurrency:  txn.Amount,
				CreditInAccountCurrency: 0,
			},
			{
				Account:                 "Cash - DC",
				DebitInAccountCurrency:  0,
				CreditInAccountCurrency: txn.Amount,
			},
		},
	}

	_, err := client.CreateJournalEntry(ctx, journalEntry)
	if err != nil {
		return fmt.Errorf("failed to create journal entry: %w", err)
	}

	// Update local record
	if integrationService.db != nil {
		integrationService.db.ExecContext(ctx, `
			INSERT INTO bank_transactions 
			(id, connection_id, tenant_id, customer_id, account_id, transaction_date, value_date, 
			 description, reference, amount, currency, transaction_type, reconciled, erp_entry_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
			ON CONFLICT (connection_id, account_id, reference, transaction_date) DO NOTHING
		`, txn.ID, conn.ID, conn.TenantID, conn.CustomerID, txn.AccountID, txn.TransactionDate,
			txn.ValueDate, txn.Description, txn.Reference, txn.Amount, txn.Currency, txn.Type, true, txn.ID)
	}

	return nil
}

func syncLoanDisbursementToERP(ctx context.Context, conn *ERPConnection, event LoanEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Create Payment Entry for loan disbursement
	paymentEntry := ERPNextPaymentEntry{
		PaymentType:    "Pay",
		PostingDate:    time.Now().Format("2006-01-02"),
		Company:        "Default Company",
		PartyType:      "Customer",
		Party:          event.CustomerID,
		PaidAmount:     event.Amount,
		ReceivedAmount: event.Amount,
		ReferenceNo:    event.LoanID,
		ReferenceDate:  time.Now().Format("2006-01-02"),
	}

	_, err := client.CreatePaymentEntry(ctx, paymentEntry)
	return err
}

func syncLoanPaymentToERP(ctx context.Context, conn *ERPConnection, event LoanEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Create Payment Entry for loan payment
	paymentEntry := ERPNextPaymentEntry{
		PaymentType:    "Receive",
		PostingDate:    time.Now().Format("2006-01-02"),
		Company:        "Default Company",
		PartyType:      "Customer",
		Party:          event.CustomerID,
		PaidAmount:     event.Amount,
		ReceivedAmount: event.Amount,
		ReferenceNo:    event.TransactionID,
		ReferenceDate:  time.Now().Format("2006-01-02"),
	}

	_, err := client.CreatePaymentEntry(ctx, paymentEntry)
	if err != nil {
		return err
	}

	// Record payment in local database
	if integrationService.db != nil {
		integrationService.db.ExecContext(ctx, `
			INSERT INTO payments 
			(id, connection_id, tenant_id, customer_id, payment_type, status, amount, currency,
			 source_account, dest_account, beneficiary_name, reference, erp_doc_type, erp_doc_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
		`, event.TransactionID, conn.ID, event.TenantID, event.CustomerID, "loan_payment",
			"completed", event.Amount, "NGN", event.CustomerID, "MINT_ACCOUNT",
			event.CustomerID, event.TransactionID, "Payment Entry", event.TransactionID)
	}

	return nil
}

func syncAccountToERP(ctx context.Context, conn *ERPConnection, event AccountEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Create or update Account in ERPNext
	account := ERPNextAccount{
		AccountName: event.AccountID,
		AccountType: "Bank",
		IsGroup:     0,
		Company:     "Default Company",
	}

	// Use doRequest directly since there's no CreateAccount method
	_, err := client.doRequest(ctx, "POST", "/api/resource/Account", account)
	return err
}

// Payment event processor
func processPaymentEvent(event PaymentEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, event.CustomerID)
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		if err := syncPaymentToERP(ctx, conn, event); err != nil {
			log.Printf("Error syncing payment to ERP: %v", err)
		} else {
			log.Printf("Successfully synced payment %s to ERPNext", event.PaymentID)
		}
	}
}

func syncPaymentToERP(ctx context.Context, conn *ERPConnection, event PaymentEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Determine payment type based on event type
	paymentType := "Receive"
	if event.Type == "payment.processing.payout" || event.Type == "payment.processing.transfer" {
		paymentType = "Pay"
	}

	// Create Payment Entry in ERPNext
	paymentEntry := ERPNextPaymentEntry{
		PaymentType:    paymentType,
		PostingDate:    event.Timestamp.Format("2006-01-02"),
		Company:        "Default Company",
		PartyType:      "Customer",
		Party:          event.CustomerID,
		PaidAmount:     event.Amount,
		ReceivedAmount: event.Amount,
		ReferenceNo:    event.PaymentID,
		ReferenceDate:  event.Timestamp.Format("2006-01-02"),
	}

	_, err := client.CreatePaymentEntry(ctx, paymentEntry)
	if err != nil {
		return fmt.Errorf("failed to create payment entry: %w", err)
	}

	// Record payment in local database
	if integrationService.db != nil {
		integrationService.db.ExecContext(ctx, `
			INSERT INTO payments 
			(id, connection_id, tenant_id, customer_id, payment_type, status, amount, currency,
			 payment_method, reference, erp_doc_type, erp_doc_id, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
			ON CONFLICT (id) DO NOTHING
		`, event.PaymentID, conn.ID, event.TenantID, event.CustomerID, paymentType,
			event.Status, event.Amount, event.Currency, event.PaymentMethod,
			event.PaymentID, "Payment Entry", event.PaymentID)
	}

	return nil
}

// Savings event processor
func processSavingsEvent(event SavingsEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, event.CustomerID)
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		if err := syncSavingsToERP(ctx, conn, event); err != nil {
			log.Printf("Error syncing savings to ERP: %v", err)
		} else {
			log.Printf("Successfully synced savings event %s to ERPNext", event.Type)
		}
	}
}

func syncSavingsToERP(ctx context.Context, conn *ERPConnection, event SavingsEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Create Journal Entry for savings transactions
	if event.Amount > 0 {
		journalEntry := ERPNextJournalEntry{
			PostingDate: event.Timestamp.Format("2006-01-02"),
			Company:     "Default Company",
			VoucherType: "Journal Entry",
			TotalDebit:  event.Amount,
			TotalCredit: event.Amount,
			Accounts: []ERPNextJournalAccount{
				{
					Account:                 "Savings Account - DC",
					DebitInAccountCurrency:  event.Amount,
					CreditInAccountCurrency: 0,
				},
				{
					Account:                 "Cash - DC",
					DebitInAccountCurrency:  0,
					CreditInAccountCurrency: event.Amount,
				},
			},
		}

		_, err := client.CreateJournalEntry(ctx, journalEntry)
		if err != nil {
			return fmt.Errorf("failed to create savings journal entry: %w", err)
		}
	}

	return nil
}

// Mortgage event processor
func processMortgageEvent(event MortgageEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, "")
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		if err := syncMortgageToERP(ctx, conn, event); err != nil {
			log.Printf("Error syncing mortgage to ERP: %v", err)
		} else {
			log.Printf("Successfully synced mortgage event %s to ERPNext", event.Type)
		}
	}
}

func syncMortgageToERP(ctx context.Context, conn *ERPConnection, event MortgageEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Handle different mortgage event types
	switch {
	case event.Type == "mortgage.disbursement" || event.Type == "mortgages.disbursement":
		// Create Payment Entry for mortgage disbursement
		paymentEntry := ERPNextPaymentEntry{
			PaymentType:    "Pay",
			PostingDate:    event.Timestamp.Format("2006-01-02"),
			Company:        "Default Company",
			PartyType:      "Customer",
			Party:          event.CustomerID,
			PaidAmount:     event.Amount,
			ReceivedAmount: event.Amount,
			ReferenceNo:    event.MortgageID,
			ReferenceDate:  event.Timestamp.Format("2006-01-02"),
		}
		_, err := client.CreatePaymentEntry(ctx, paymentEntry)
		return err

	case event.Type == "mortgage.payment" || event.Type == "mortgages.payment":
		// Create Payment Entry for mortgage payment received
		paymentEntry := ERPNextPaymentEntry{
			PaymentType:    "Receive",
			PostingDate:    event.Timestamp.Format("2006-01-02"),
			Company:        "Default Company",
			PartyType:      "Customer",
			Party:          event.CustomerID,
			PaidAmount:     event.Amount,
			ReceivedAmount: event.Amount,
			ReferenceNo:    event.MortgageID,
			ReferenceDate:  event.Timestamp.Format("2006-01-02"),
		}
		_, err := client.CreatePaymentEntry(ctx, paymentEntry)
		return err

	default:
		log.Printf("Mortgage event type %s tracked (no ERP sync required)", event.Type)
		return nil
	}
}

// LPO event processor
func processLpoEvent(event LpoEvent) {
	ctx := context.Background()

	// Find active connections for this tenant
	connections, err := integrationService.ListConnections(ctx, event.TenantID, event.CustomerID)
	if err != nil {
		log.Printf("Error fetching connections for tenant %s: %v", event.TenantID, err)
		return
	}

	for _, conn := range connections {
		if conn.Status != ConnectionStatusActive {
			continue
		}

		if err := syncLpoToERP(ctx, conn, event); err != nil {
			log.Printf("Error syncing lpo to ERP: %v", err)
		} else {
			log.Printf("Successfully synced lpo event %s to ERPNext", event.Type)
		}
	}
}

func syncLpoToERP(ctx context.Context, conn *ERPConnection, event LpoEvent) error {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	// Handle different LPO event types
	switch event.Type {
	case "lpo.created", "lpo.submitted":
		// Log LPO creation/submission (typically no immediate ERP sync needed)
		log.Printf("LPO %s - %s (tracking only)", event.LpoID, event.Type)
		return nil

	case "lpo.approved":
		// Create Purchase Order in ERPNext when LPO is approved
		// For now, just log (would need full PO structure)
		log.Printf("LPO %s approved - should create Purchase Order in ERP", event.LpoID)
		return nil

	case "lpo.disbursed":
		// Create Payment Entry for LPO disbursement
		paymentEntry := ERPNextPaymentEntry{
			PaymentType:    "Pay",
			PostingDate:    event.Timestamp.Format("2006-01-02"),
			Company:        "Default Company",
			PartyType:      "Supplier",
			Party:          event.CustomerID,
			PaidAmount:     event.Amount,
			ReceivedAmount: event.Amount,
			ReferenceNo:    event.LpoID,
			ReferenceDate:  event.Timestamp.Format("2006-01-02"),
		}
		_, err := client.CreatePaymentEntry(ctx, paymentEntry)
		return err

	default:
		log.Printf("LPO event type %s tracked (no ERP sync required)", event.Type)
		return nil
	}
}
