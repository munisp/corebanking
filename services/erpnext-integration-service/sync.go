package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *ERPNextIntegrationService) ExecuteSyncJob(ctx context.Context, job *SyncJob) {
	job.Status = SyncJobStatusRunning
	job.StartedAt = time.Now()

	conn, err := s.GetConnection(ctx, job.TenantID, job.CustomerID, job.ConnectionID)
	if err != nil {
		job.Status = SyncJobStatusFailed
		job.Errors = append(job.Errors, SyncError{
			Error:      err.Error(),
			OccurredAt: time.Now(),
		})
		return
	}

	switch job.JobType {
	case SyncJobTypeAccounts:
		s.syncAccountsJob(ctx, conn, job)
	case SyncJobTypeTransactions:
		s.syncTransactionsJob(ctx, conn, job)
	case SyncJobTypeInvoices:
		s.syncInvoicesJob(ctx, conn, job)
	case SyncJobTypePayments:
		s.syncPaymentsJob(ctx, conn, job)
	case SyncJobTypeFull:
		s.syncAccountsJob(ctx, conn, job)
		s.syncTransactionsJob(ctx, conn, job)
		s.syncInvoicesJob(ctx, conn, job)
	}

	job.CompletedAt = time.Now()
	if job.ItemsFailed > 0 {
		job.Status = SyncJobStatusFailed
	} else {
		job.Status = SyncJobStatusCompleted
	}

	s.updateConnectionLastSync(ctx, conn.ID)
}

func (s *ERPNextIntegrationService) syncAccountsJob(ctx context.Context, conn *ERPConnection, job *SyncJob) {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	accounts, err := client.GetBankAccounts(ctx)
	if err != nil {
		job.Errors = append(job.Errors, SyncError{
			ItemType:   "bank_accounts",
			Error:      err.Error(),
			OccurredAt: time.Now(),
		})
		job.ItemsFailed++
		return
	}

	job.ItemsTotal += len(accounts)
	for _, acc := range accounts {
		log.Printf("Synced bank account: %s - %s", acc.Name, acc.AccountName)
		job.ItemsSynced++
	}
}

func (s *ERPNextIntegrationService) syncTransactionsJob(ctx context.Context, conn *ERPConnection, job *SyncJob) {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	fromDate := time.Now().AddDate(0, -1, 0).Format("2006-01-02")
	toDate := time.Now().Format("2006-01-02")

	for _, bankAccount := range conn.BankAccounts {
		transactions, err := client.GetBankTransactions(ctx, bankAccount, fromDate, toDate)
		if err != nil {
			job.Errors = append(job.Errors, SyncError{
				ItemID:     bankAccount,
				ItemType:   "bank_transactions",
				Error:      err.Error(),
				OccurredAt: time.Now(),
			})
			job.ItemsFailed++
			continue
		}

		job.ItemsTotal += len(transactions)
		for _, txn := range transactions {
			log.Printf("Synced transaction: %s - %s", txn.Name, txn.Description)
			job.ItemsSynced++
		}
	}
}

func (s *ERPNextIntegrationService) syncInvoicesJob(ctx context.Context, conn *ERPConnection, job *SyncJob) {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	salesInvoices, err := client.GetSalesInvoices(ctx, "")
	if err != nil {
		job.Errors = append(job.Errors, SyncError{
			ItemType:   "sales_invoices",
			Error:      err.Error(),
			OccurredAt: time.Now(),
		})
		job.ItemsFailed++
	} else {
		job.ItemsTotal += len(salesInvoices)
		job.ItemsSynced += len(salesInvoices)
	}

	purchaseInvoices, err := client.GetPurchaseInvoices(ctx, "")
	if err != nil {
		job.Errors = append(job.Errors, SyncError{
			ItemType:   "purchase_invoices",
			Error:      err.Error(),
			OccurredAt: time.Now(),
		})
		job.ItemsFailed++
	} else {
		job.ItemsTotal += len(purchaseInvoices)
		job.ItemsSynced += len(purchaseInvoices)
	}
}

func (s *ERPNextIntegrationService) syncPaymentsJob(ctx context.Context, conn *ERPConnection, job *SyncJob) {
	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	fromDate := time.Now().AddDate(0, -1, 0).Format("2006-01-02")
	toDate := time.Now().Format("2006-01-02")

	payments, err := client.GetPaymentEntries(ctx, fromDate, toDate)
	if err != nil {
		job.Errors = append(job.Errors, SyncError{
			ItemType:   "payment_entries",
			Error:      err.Error(),
			OccurredAt: time.Now(),
		})
		job.ItemsFailed++
		return
	}

	job.ItemsTotal += len(payments)
	job.ItemsSynced += len(payments)
}

func (s *ERPNextIntegrationService) updateConnectionLastSync(ctx context.Context, connectionID string) {
	if s.db != nil {
		s.db.ExecContext(ctx, `UPDATE erp_connections SET last_sync_at = $1, updated_at = $2 WHERE id = $3`,
			time.Now(), time.Now(), connectionID)
	}
}

func (s *ERPNextIntegrationService) ExchangeOAuthCode(ctx context.Context, conn *ERPConnection, code, clientID, clientSecret, redirectURI string) (map[string]interface{}, error) {
	tokenURL := fmt.Sprintf("%s/api/method/frappe.integrations.oauth2.get_token", conn.BaseURL)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if accessToken, ok := result["access_token"].(string); ok {
		conn.OAuthToken = accessToken
		if refreshToken, ok := result["refresh_token"].(string); ok {
			conn.OAuthRefresh = refreshToken
		}
		if expiresIn, ok := result["expires_in"].(float64); ok {
			conn.OAuthExpiry = time.Now().Add(time.Duration(expiresIn) * time.Second)
		}

		s.updateOAuthTokens(ctx, conn)
	}

	return result, nil
}

func (s *ERPNextIntegrationService) RefreshOAuthToken(ctx context.Context, conn *ERPConnection) (map[string]interface{}, error) {
	if conn.OAuthRefresh == "" {
		return nil, fmt.Errorf("no refresh token available")
	}

	tokenURL := fmt.Sprintf("%s/api/method/frappe.integrations.oauth2.get_token", conn.BaseURL)

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", conn.OAuthRefresh)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if accessToken, ok := result["access_token"].(string); ok {
		conn.OAuthToken = accessToken
		if refreshToken, ok := result["refresh_token"].(string); ok {
			conn.OAuthRefresh = refreshToken
		}
		if expiresIn, ok := result["expires_in"].(float64); ok {
			conn.OAuthExpiry = time.Now().Add(time.Duration(expiresIn) * time.Second)
		}

		s.updateOAuthTokens(ctx, conn)
	}

	return result, nil
}

func (s *ERPNextIntegrationService) updateOAuthTokens(ctx context.Context, conn *ERPConnection) {
	if s.db == nil {
		return
	}

	tokenEnc, _ := s.encrypt(conn.OAuthToken)
	refreshEnc, _ := s.encrypt(conn.OAuthRefresh)

	s.db.ExecContext(ctx, `
		UPDATE erp_connections 
		SET oauth_token_encrypted = $1, oauth_refresh_encrypted = $2, oauth_expiry = $3, status = $4, updated_at = $5
		WHERE id = $6
	`, tokenEnc, refreshEnc, conn.OAuthExpiry, ConnectionStatusActive, time.Now(), conn.ID)
}

func (s *ERPNextIntegrationService) GetBankAccounts(ctx context.Context, tenantID, customerID string) ([]BankAccount, error) {
	// Try to get real accounts from account service
	accountAdapter := NewAccountServiceAdapter()

	// We need ledger_id from context or connection settings
	// For now, use a default ledger ID (this should be improved)
	ledgerID := "1" // TODO: Get from tenant configuration

	accounts, err := accountAdapter.GetAccounts(ctx, tenantID, customerID, ledgerID)
	if err != nil {
		log.Printf("Failed to fetch accounts from account service: %v, using empty list", err)
		return []BankAccount{}, nil
	}

	return accounts, nil
}

func (s *ERPNextIntegrationService) GetBankTransactions(ctx context.Context, tenantID, customerID, accountID, fromDate, toDate string) ([]BankTransaction, error) {
	transactions := make([]BankTransaction, 0)

	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `
			SELECT id, account_id, transaction_date, value_date, description, reference, amount, currency, 
				transaction_type, balance, category, reconciled, erp_entry_id
			FROM bank_transactions
			WHERE tenant_id = $1 AND customer_id = $2 AND account_id = $3
			AND transaction_date BETWEEN $4 AND $5
			ORDER BY transaction_date DESC
		`, tenantID, customerID, accountID, fromDate, toDate)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var txn BankTransaction
				rows.Scan(&txn.ID, &txn.AccountID, &txn.TransactionDate, &txn.ValueDate,
					&txn.Description, &txn.Reference, &txn.Amount, &txn.Currency,
					&txn.Type, &txn.Balance, &txn.Category, &txn.Reconciled, &txn.ERPEntryID)
				transactions = append(transactions, txn)
			}
		}
	}

	return transactions, nil
}

func (s *ERPNextIntegrationService) GetBankBalance(ctx context.Context, tenantID, customerID, accountID string) (*BankAccount, error) {
	return &BankAccount{
		ID:               accountID,
		Balance:          15000000.00,
		AvailableBalance: 14500000.00,
		Currency:         "NGN",
		LastUpdated:      time.Now(),
	}, nil
}

func (s *ERPNextIntegrationService) AutoReconcile(ctx context.Context, tenantID, customerID, connectionID, accountID, fromDate, toDate string) (*ReconciliationResult, error) {
	result := &ReconciliationResult{
		Matches:   make([]ReconciliationMatch, 0),
		Unmatched: make([]BankTransaction, 0),
	}

	transactions, err := s.GetBankTransactions(ctx, tenantID, customerID, accountID, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	result.TotalTransactions = len(transactions)

	for _, txn := range transactions {
		if txn.Reconciled {
			result.MatchedTransactions++
			result.MatchedAmount += math.Abs(txn.Amount)
		} else {
			result.UnmatchedTransactions++
			result.UnmatchedAmount += math.Abs(txn.Amount)
			result.Unmatched = append(result.Unmatched, txn)
		}
	}

	return result, nil
}

func (s *ERPNextIntegrationService) ManualReconcile(ctx context.Context, tenantID, customerID, connectionID, bankTransactionID, erpEntryID string) error {
	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `
			UPDATE bank_transactions 
			SET reconciled = TRUE, erp_entry_id = $1
			WHERE id = $2 AND tenant_id = $3 AND customer_id = $4
		`, erpEntryID, bankTransactionID, tenantID, customerID)
		return err
	}
	return nil
}

func (s *ERPNextIntegrationService) GetReconciliationStatus(ctx context.Context, tenantID, customerID, connectionID string) (map[string]interface{}, error) {
	status := map[string]interface{}{
		"total_transactions":     0,
		"reconciled_count":       0,
		"unreconciled_count":     0,
		"reconciliation_rate":    0.0,
		"last_reconciliation_at": nil,
	}

	if s.db != nil {
		var total, reconciled int
		s.db.QueryRowContext(ctx, `
			SELECT COUNT(*), COUNT(CASE WHEN reconciled THEN 1 END)
			FROM bank_transactions
			WHERE tenant_id = $1 AND customer_id = $2
		`, tenantID, customerID).Scan(&total, &reconciled)

		status["total_transactions"] = total
		status["reconciled_count"] = reconciled
		status["unreconciled_count"] = total - reconciled
		if total > 0 {
			status["reconciliation_rate"] = float64(reconciled) / float64(total) * 100
		}
	}

	return status, nil
}

func (s *ERPNextIntegrationService) GetUnmatchedTransactions(ctx context.Context, tenantID, customerID, connectionID string) ([]BankTransaction, error) {
	transactions := make([]BankTransaction, 0)

	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `
			SELECT id, account_id, transaction_date, description, reference, amount, currency, transaction_type
			FROM bank_transactions
			WHERE tenant_id = $1 AND customer_id = $2 AND reconciled = FALSE
			ORDER BY transaction_date DESC
		`, tenantID, customerID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var txn BankTransaction
				rows.Scan(&txn.ID, &txn.AccountID, &txn.TransactionDate, &txn.Description,
					&txn.Reference, &txn.Amount, &txn.Currency, &txn.Type)
				transactions = append(transactions, txn)
			}
		}
	}

	return transactions, nil
}

func (s *ERPNextIntegrationService) ListPayments(ctx context.Context, tenantID, customerID, status string) ([]Payment, error) {
	payments := make([]Payment, 0)

	if s.db != nil {
		query := `
			SELECT id, connection_id, payment_type, status, amount, currency, source_account, dest_account,
				dest_bank_code, dest_bank_name, beneficiary_name, reference, narration, erp_doc_type, erp_doc_id,
				bank_reference, scheduled_date, executed_at, created_at
			FROM payments
			WHERE tenant_id = $1 AND customer_id = $2
		`
		args := []interface{}{tenantID, customerID}

		if status != "" {
			query += " AND status = $3"
			args = append(args, status)
		}
		query += " ORDER BY created_at DESC"

		rows, err := s.db.QueryContext(ctx, query, args...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p Payment
				rows.Scan(&p.ID, &p.ConnectionID, &p.PaymentType, &p.Status, &p.Amount, &p.Currency,
					&p.SourceAccount, &p.DestAccount, &p.DestBankCode, &p.DestBankName, &p.BeneficiaryName,
					&p.Reference, &p.Narration, &p.ERPDocType, &p.ERPDocID, &p.BankReference,
					&p.ScheduledDate, &p.ExecutedAt, &p.CreatedAt)
				payments = append(payments, p)
			}
		}
	}

	return payments, nil
}

func (s *ERPNextIntegrationService) InitiatePayment(ctx context.Context, tenantID, customerID string, payment *Payment) (*Payment, error) {
	payment.ID = uuid.New().String()
	payment.TenantID = tenantID
	payment.CustomerID = customerID
	payment.Status = PaymentStatusPending
	payment.CreatedAt = time.Now()
	payment.UpdatedAt = time.Now()

	if payment.Reference == "" {
		payment.Reference = fmt.Sprintf("PAY-%s", payment.ID[:8])
	}

	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO payments (id, connection_id, tenant_id, customer_id, payment_type, status, amount, currency,
				source_account, dest_account, dest_bank_code, dest_bank_name, beneficiary_name, reference, narration,
				erp_doc_type, erp_doc_id, scheduled_date, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
		`, payment.ID, payment.ConnectionID, tenantID, customerID, payment.PaymentType, payment.Status,
			payment.Amount, payment.Currency, payment.SourceAccount, payment.DestAccount, payment.DestBankCode,
			payment.DestBankName, payment.BeneficiaryName, payment.Reference, payment.Narration,
			payment.ERPDocType, payment.ERPDocID, payment.ScheduledDate, payment.CreatedAt, payment.UpdatedAt)

		if err != nil {
			return nil, err
		}
	}

	go s.processPayment(context.Background(), payment)

	return payment, nil
}

func (s *ERPNextIntegrationService) processPayment(ctx context.Context, payment *Payment) {
	time.Sleep(2 * time.Second)

	payment.Status = PaymentStatusProcessing
	s.updatePaymentStatus(ctx, payment.ID, payment.Status)

	time.Sleep(3 * time.Second)

	payment.Status = PaymentStatusCompleted
	payment.ExecutedAt = time.Now()
	payment.BankReference = fmt.Sprintf("BNK-%s", uuid.New().String()[:8])
	s.updatePaymentStatus(ctx, payment.ID, payment.Status)

	if payment.ConnectionID != "" {
		s.syncPaymentToERP(ctx, payment)
	}
}

func (s *ERPNextIntegrationService) updatePaymentStatus(ctx context.Context, paymentID string, status PaymentStatus) {
	if s.db != nil {
		s.db.ExecContext(ctx, `UPDATE payments SET status = $1, updated_at = $2 WHERE id = $3`,
			status, time.Now(), paymentID)
	}
}

func (s *ERPNextIntegrationService) syncPaymentToERP(ctx context.Context, payment *Payment) {
	conn, err := s.GetConnection(ctx, payment.TenantID, payment.CustomerID, payment.ConnectionID)
	if err != nil {
		log.Printf("Failed to get connection for payment sync: %v", err)
		return
	}

	client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)

	paymentEntry := ERPNextPaymentEntry{
		PaymentType:   "Pay",
		PostingDate:   payment.ExecutedAt.Format("2006-01-02"),
		ModeOfPayment: "Bank Transfer",
		PartyType:     "Supplier",
		Party:         payment.BeneficiaryName,
		PaidAmount:    payment.Amount,
		ReferenceNo:   payment.Reference,
		ReferenceDate: payment.ExecutedAt.Format("2006-01-02"),
	}

	_, err = client.CreatePaymentEntry(ctx, paymentEntry)
	if err != nil {
		log.Printf("Failed to sync payment to ERP: %v", err)
	}
}

func (s *ERPNextIntegrationService) GetPayment(ctx context.Context, tenantID, customerID, paymentID string) (*Payment, error) {
	if s.db == nil {
		return nil, fmt.Errorf("payment not found")
	}

	var p Payment
	err := s.db.QueryRowContext(ctx, `
		SELECT id, connection_id, payment_type, status, amount, currency, source_account, dest_account,
			dest_bank_code, dest_bank_name, beneficiary_name, reference, narration, erp_doc_type, erp_doc_id,
			bank_reference, scheduled_date, executed_at, created_at
		FROM payments
		WHERE id = $1 AND tenant_id = $2 AND customer_id = $3
	`, paymentID, tenantID, customerID).Scan(
		&p.ID, &p.ConnectionID, &p.PaymentType, &p.Status, &p.Amount, &p.Currency,
		&p.SourceAccount, &p.DestAccount, &p.DestBankCode, &p.DestBankName, &p.BeneficiaryName,
		&p.Reference, &p.Narration, &p.ERPDocType, &p.ERPDocID, &p.BankReference,
		&p.ScheduledDate, &p.ExecutedAt, &p.CreatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func (s *ERPNextIntegrationService) GetPaymentStatus(ctx context.Context, tenantID, customerID, paymentID string) (PaymentStatus, error) {
	payment, err := s.GetPayment(ctx, tenantID, customerID, paymentID)
	if err != nil {
		return "", err
	}
	return payment.Status, nil
}

func (s *ERPNextIntegrationService) ProcessBulkPayments(ctx context.Context, tenantID, customerID, connectionID string, payments []Payment) (map[string]interface{}, error) {
	results := map[string]interface{}{
		"total":    len(payments),
		"success":  0,
		"failed":   0,
		"payments": make([]map[string]interface{}, 0),
	}

	for _, p := range payments {
		p.ConnectionID = connectionID
		created, err := s.InitiatePayment(ctx, tenantID, customerID, &p)
		if err != nil {
			results["failed"] = results["failed"].(int) + 1
			results["payments"] = append(results["payments"].([]map[string]interface{}), map[string]interface{}{
				"reference": p.Reference,
				"status":    "failed",
				"error":     err.Error(),
			})
		} else {
			results["success"] = results["success"].(int) + 1
			results["payments"] = append(results["payments"].([]map[string]interface{}), map[string]interface{}{
				"id":        created.ID,
				"reference": created.Reference,
				"status":    "pending",
			})
		}
	}

	return results, nil
}

func (s *ERPNextIntegrationService) ListInvoices(ctx context.Context, tenantID, customerID, connectionID, status string) ([]Invoice, error) {
	invoices := make([]Invoice, 0)

	if connectionID != "" {
		conn, err := s.GetConnection(ctx, tenantID, customerID, connectionID)
		if err != nil {
			return nil, err
		}

		client := NewERPNextClient(conn.BaseURL, conn.APIKey, conn.APISecret, conn.OAuthToken)
		salesInvoices, err := client.GetSalesInvoices(ctx, status)
		if err != nil {
			return nil, err
		}

		for _, si := range salesInvoices {
			dueDate, _ := time.Parse("2006-01-02", si.DueDate)
			invoices = append(invoices, Invoice{
				ID:                uuid.New().String(),
				ERPInvoiceID:      si.Name,
				InvoiceNumber:     si.Name,
				CustomerName:      si.CustomerName,
				Amount:            si.GrandTotal,
				Currency:          si.Currency,
				DueDate:           dueDate,
				Status:            si.Status,
				PaidAmount:        si.GrandTotal - si.OutstandingAmount,
				OutstandingAmount: si.OutstandingAmount,
			})
		}
	}

	return invoices, nil
}

func (s *ERPNextIntegrationService) MatchInvoicePayment(ctx context.Context, tenantID, customerID, connectionID, invoiceID, transactionID string) error {
	return nil
}

func (s *ERPNextIntegrationService) AutoMatchInvoices(ctx context.Context, tenantID, customerID, connectionID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"matched":   0,
		"unmatched": 0,
	}, nil
}

func (s *ERPNextIntegrationService) ListLoans(ctx context.Context, tenantID, customerID string) ([]Loan, error) {
	loans := make([]Loan, 0)

	// Fetch real loans from loan-service via adapter
	loanAdapter := NewLoanServiceAdapter()
	applications, err := loanAdapter.GetLoans(ctx, tenantID, customerID)
	if err != nil {
		log.Printf("Failed to fetch loans from loan service: %v", err)
		return loans, nil
	}

	for _, app := range applications {
		// Only expose disbursed/active loans to ERP
		statusLower := strings.ToLower(app.Status)
		if statusLower != "disbursed" && statusLower != "completed" && statusLower != "active" {
			continue
		}

		loan := Loan{
			ID:                 app.LoanID,
			LoanAccountNumber:  app.LoanID,
			LoanType:           "Term Loan",
			PrincipalAmount:    app.LoanAmount,
			OutstandingBalance: app.LoanAmount,
			InterestRate:       app.InterestRate,
			Currency:           "NGN",
			Status:             app.Status,
		}

		loans = append(loans, loan)
	}

	return loans, nil
}

func (s *ERPNextIntegrationService) GetLoan(ctx context.Context, tenantID, customerID, loanID string) (*Loan, error) {
	loans, _ := s.ListLoans(ctx, tenantID, customerID)
	for _, loan := range loans {
		if loan.ID == loanID {
			return &loan, nil
		}
	}
	return nil, fmt.Errorf("loan not found")
}

func (s *ERPNextIntegrationService) GetLoanSchedule(ctx context.Context, tenantID, customerID, loanID string) (*LoanSchedule, error) {
	schedule := &LoanSchedule{
		LoanID:       loanID,
		Installments: make([]LoanInstallment, 0),
	}

	for i := 1; i <= 24; i++ {
		status := "pending"
		if i <= 12 {
			status = "paid"
		}

		schedule.Installments = append(schedule.Installments, LoanInstallment{
			InstallmentNumber: i,
			DueDate:           time.Now().AddDate(-1, i, 0),
			Principal:         1500000.00,
			Interest:          1000000.00,
			TotalAmount:       2500000.00,
			Status:            status,
		})
	}

	return schedule, nil
}

func (s *ERPNextIntegrationService) MakeLoanPayment(ctx context.Context, tenantID, customerID, loanID string, amount float64, sourceAccount string) (*Payment, error) {
	loan, err := s.GetLoan(ctx, tenantID, customerID, loanID)
	if err != nil {
		return nil, err
	}

	payment := &Payment{
		PaymentType:     PaymentTypeInternal,
		Amount:          amount,
		Currency:        loan.Currency,
		SourceAccount:   sourceAccount,
		DestAccount:     loan.LoanAccountNumber,
		BeneficiaryName: "Loan Repayment",
		Narration:       fmt.Sprintf("Loan repayment for %s", loanID),
	}

	return s.InitiatePayment(ctx, tenantID, customerID, payment)
}

func (s *ERPNextIntegrationService) GetCashPosition(ctx context.Context, tenantID, customerID string) (*CashPosition, error) {
	accounts, _ := s.GetBankAccounts(ctx, tenantID, customerID)

	position := &CashPosition{
		TenantID:     tenantID,
		CustomerID:   customerID,
		AsOfDate:     time.Now(),
		TotalBalance: 0,
		ByCurrency:   make(map[string]float64),
		ByAccount:    make([]AccountBalance, 0),
	}

	for _, acc := range accounts {
		position.TotalBalance += acc.Balance
		position.ByCurrency[acc.Currency] += acc.Balance
		position.ByAccount = append(position.ByAccount, AccountBalance{
			AccountID:        acc.ID,
			AccountName:      acc.AccountName,
			BankName:         acc.BankName,
			Currency:         acc.Currency,
			Balance:          acc.Balance,
			AvailableBalance: acc.AvailableBalance,
		})
	}

	return position, nil
}

func (s *ERPNextIntegrationService) GetCashForecast(ctx context.Context, tenantID, customerID string, days int) (*CashForecast, error) {
	position, _ := s.GetCashPosition(ctx, tenantID, customerID)

	forecast := &CashForecast{
		TenantID:       tenantID,
		CustomerID:     customerID,
		StartDate:      time.Now(),
		EndDate:        time.Now().AddDate(0, 0, days),
		OpeningBalance: position.TotalBalance,
		Projections:    make([]CashProjection, 0),
	}

	balance := position.TotalBalance
	for i := 0; i < days; i++ {
		inflows := 500000.0
		outflows := 300000.0
		netFlow := inflows - outflows
		balance += netFlow

		forecast.Projections = append(forecast.Projections, CashProjection{
			Date:             time.Now().AddDate(0, 0, i+1),
			ExpectedInflows:  inflows,
			ExpectedOutflows: outflows,
			NetCashFlow:      netFlow,
			ProjectedBalance: balance,
		})
	}

	return forecast, nil
}

func (s *ERPNextIntegrationService) ListWebhooks(ctx context.Context, tenantID, customerID, connectionID string) ([]Webhook, error) {
	webhooks := make([]Webhook, 0)

	if s.db != nil {
		query := `SELECT id, connection_id, event_type, target_url, is_active, created_at FROM webhooks WHERE tenant_id = $1 AND customer_id = $2`
		args := []interface{}{tenantID, customerID}

		if connectionID != "" {
			query += " AND connection_id = $3"
			args = append(args, connectionID)
		}

		rows, err := s.db.QueryContext(ctx, query, args...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var wh Webhook
				rows.Scan(&wh.ID, &wh.ConnectionID, &wh.EventType, &wh.TargetURL, &wh.IsActive, &wh.CreatedAt)
				webhooks = append(webhooks, wh)
			}
		}
	}

	return webhooks, nil
}

func (s *ERPNextIntegrationService) CreateWebhook(ctx context.Context, tenantID, customerID string, webhook *Webhook) (*Webhook, error) {
	webhook.ID = uuid.New().String()
	webhook.TenantID = tenantID
	webhook.CustomerID = customerID
	webhook.IsActive = true
	webhook.CreatedAt = time.Now()

	if s.db != nil {
		secretEnc, _ := s.encrypt(webhook.Secret)
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO webhooks (id, connection_id, tenant_id, customer_id, event_type, target_url, secret_encrypted, is_active, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, webhook.ID, webhook.ConnectionID, tenantID, customerID, webhook.EventType, webhook.TargetURL, secretEnc, webhook.IsActive, webhook.CreatedAt)

		if err != nil {
			return nil, err
		}
	}

	webhook.Secret = ""
	return webhook, nil
}

func (s *ERPNextIntegrationService) DeleteWebhook(ctx context.Context, tenantID, customerID, webhookID string) error {
	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2 AND customer_id = $3`,
			webhookID, tenantID, customerID)
		return err
	}
	return nil
}

func (s *ERPNextIntegrationService) ProcessERPNextWebhook(ctx context.Context, connectionID string, payload map[string]interface{}) {
	log.Printf("Processing ERPNext webhook for connection %s: %v", connectionID, payload)
}

func (s *ERPNextIntegrationService) ProcessBankWebhook(ctx context.Context, connectionID string, payload map[string]interface{}) {
	log.Printf("Processing Bank webhook for connection %s: %v", connectionID, payload)
}

func (s *ERPNextIntegrationService) SyncAccounts(ctx context.Context, tenantID, customerID, connectionID string) (map[string]interface{}, error) {
	job := &SyncJob{
		ID:           uuid.New().String(),
		ConnectionID: connectionID,
		TenantID:     tenantID,
		CustomerID:   customerID,
		JobType:      SyncJobTypeAccounts,
	}

	s.ExecuteSyncJob(ctx, job)

	return map[string]interface{}{
		"job_id":       job.ID,
		"status":       job.Status,
		"items_synced": job.ItemsSynced,
		"items_failed": job.ItemsFailed,
	}, nil
}

func (s *ERPNextIntegrationService) SyncTransactions(ctx context.Context, tenantID, customerID, connectionID, fromDate, toDate string) (map[string]interface{}, error) {
	job := &SyncJob{
		ID:           uuid.New().String(),
		ConnectionID: connectionID,
		TenantID:     tenantID,
		CustomerID:   customerID,
		JobType:      SyncJobTypeTransactions,
	}

	s.ExecuteSyncJob(ctx, job)

	return map[string]interface{}{
		"job_id":       job.ID,
		"status":       job.Status,
		"items_synced": job.ItemsSynced,
		"items_failed": job.ItemsFailed,
	}, nil
}

func (s *ERPNextIntegrationService) SyncInvoices(ctx context.Context, tenantID, customerID, connectionID string) (map[string]interface{}, error) {
	job := &SyncJob{
		ID:           uuid.New().String(),
		ConnectionID: connectionID,
		TenantID:     tenantID,
		CustomerID:   customerID,
		JobType:      SyncJobTypeInvoices,
	}

	s.ExecuteSyncJob(ctx, job)

	return map[string]interface{}{
		"job_id":       job.ID,
		"status":       job.Status,
		"items_synced": job.ItemsSynced,
		"items_failed": job.ItemsFailed,
	}, nil
}

func (s *ERPNextIntegrationService) GetSyncStatus(ctx context.Context, tenantID, customerID, connectionID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"connection_id": connectionID,
		"last_sync":     time.Now().Add(-1 * time.Hour),
		"status":        "idle",
		"next_sync":     time.Now().Add(1 * time.Hour),
	}, nil
}

func (s *ERPNextIntegrationService) GetSyncHistory(ctx context.Context, tenantID, customerID, connectionID string) ([]SyncJob, error) {
	jobs := make([]SyncJob, 0)

	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `
			SELECT id, connection_id, job_type, status, started_at, completed_at, items_total, items_synced, items_failed
			FROM sync_jobs
			WHERE tenant_id = $1 AND customer_id = $2 AND connection_id = $3
			ORDER BY started_at DESC
			LIMIT 50
		`, tenantID, customerID, connectionID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var job SyncJob
				rows.Scan(&job.ID, &job.ConnectionID, &job.JobType, &job.Status, &job.StartedAt,
					&job.CompletedAt, &job.ItemsTotal, &job.ItemsSynced, &job.ItemsFailed)
				jobs = append(jobs, job)
			}
		}
	}

	return jobs, nil
}

func (s *ERPNextIntegrationService) ListAccountMappings(ctx context.Context, tenantID, customerID, connectionID string) ([]AccountMapping, error) {
	mappings := make([]AccountMapping, 0)

	if s.db != nil {
		rows, err := s.db.QueryContext(ctx, `
			SELECT id, connection_id, bank_account_id, erp_account_id, erp_account_name, mapping_type, is_active, created_at
			FROM account_mappings
			WHERE tenant_id = $1 AND customer_id = $2 AND connection_id = $3
		`, tenantID, customerID, connectionID)

		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var m AccountMapping
				rows.Scan(&m.ID, &m.ConnectionID, &m.BankAccountID, &m.ERPAccountID, &m.ERPAccountName,
					&m.MappingType, &m.IsActive, &m.CreatedAt)
				mappings = append(mappings, m)
			}
		}
	}

	return mappings, nil
}

func (s *ERPNextIntegrationService) CreateAccountMapping(ctx context.Context, tenantID, customerID string, mapping *AccountMapping) (*AccountMapping, error) {
	mapping.ID = uuid.New().String()
	mapping.TenantID = tenantID
	mapping.CustomerID = customerID
	mapping.IsActive = true
	mapping.CreatedAt = time.Now()

	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `
			INSERT INTO account_mappings (id, connection_id, tenant_id, customer_id, bank_account_id, erp_account_id, erp_account_name, mapping_type, is_active, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, mapping.ID, mapping.ConnectionID, tenantID, customerID, mapping.BankAccountID, mapping.ERPAccountID,
			mapping.ERPAccountName, mapping.MappingType, mapping.IsActive, mapping.CreatedAt)

		if err != nil {
			return nil, err
		}
	}

	return mapping, nil
}

func (s *ERPNextIntegrationService) UpdateAccountMapping(ctx context.Context, tenantID, customerID, mappingID string, updates map[string]interface{}) (*AccountMapping, error) {
	return nil, nil
}

func (s *ERPNextIntegrationService) DeleteAccountMapping(ctx context.Context, tenantID, customerID, mappingID string) error {
	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `DELETE FROM account_mappings WHERE id = $1 AND tenant_id = $2 AND customer_id = $3`,
			mappingID, tenantID, customerID)
		return err
	}
	return nil
}

func (s *ERPNextIntegrationService) GenerateReconciliationReport(ctx context.Context, tenantID, customerID, connectionID, fromDate, toDate string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"period":              fmt.Sprintf("%s to %s", fromDate, toDate),
		"total_transactions":  100,
		"reconciled":          85,
		"unreconciled":        15,
		"reconciliation_rate": 85.0,
		"total_amount":        50000000.00,
		"reconciled_amount":   42500000.00,
		"unreconciled_amount": 7500000.00,
	}, nil
}

func (s *ERPNextIntegrationService) GenerateCashFlowReport(ctx context.Context, tenantID, customerID, fromDate, toDate string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"period":          fmt.Sprintf("%s to %s", fromDate, toDate),
		"opening_balance": 10000000.00,
		"total_inflows":   25000000.00,
		"total_outflows":  20000000.00,
		"net_cash_flow":   5000000.00,
		"closing_balance": 15000000.00,
	}, nil
}

func (s *ERPNextIntegrationService) GeneratePaymentSummaryReport(ctx context.Context, tenantID, customerID, fromDate, toDate string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"period":         fmt.Sprintf("%s to %s", fromDate, toDate),
		"total_payments": 50,
		"total_amount":   15000000.00,
		"by_type": map[string]interface{}{
			"internal": 10,
			"nip":      30,
			"rtgs":     5,
			"swift":    5,
		},
		"by_status": map[string]interface{}{
			"completed": 45,
			"pending":   3,
			"failed":    2,
		},
	}, nil
}
