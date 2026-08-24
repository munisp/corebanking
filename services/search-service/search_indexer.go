package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SearchIndexer handles indexing data from PostgreSQL to OpenSearch
type SearchIndexer struct {
	db            *pgxpool.Pool
	searchService *UnifiedSearchService
}

// NewSearchIndexer creates a new search indexer
func NewSearchIndexer(db *pgxpool.Pool, searchService *UnifiedSearchService) *SearchIndexer {
	return &SearchIndexer{
		db:            db,
		searchService: searchService,
	}
}

// IndexCustomers indexes all customers for a tenant
func (i *SearchIndexer) IndexCustomers(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			c.id, c.tenant_id, c.first_name, c.last_name, 
			COALESCE(c.first_name || ' ' || c.last_name, '') as full_name,
			c.email, c.phone, c.bvn, c.nin,
			c.status, c.kyc_status, c.tier,
			c.address, c.city, c.state, c.branch_id,
			c.created_at, c.updated_at,
			ARRAY_AGG(DISTINCT a.account_number) FILTER (WHERE a.account_number IS NOT NULL) as account_numbers
		FROM customers c
		LEFT JOIN accounts a ON c.id = a.customer_id AND a.tenant_id = c.tenant_id
		WHERE c.tenant_id = $1 AND c.updated_at > $2
		GROUP BY c.id
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc CustomerDocument
		var accountNumbers []string
		err := rows.Scan(
			&doc.CustomerID, &doc.TenantID, &doc.FirstName, &doc.LastName,
			&doc.FullName, &doc.Email, &doc.Phone, &doc.BVN, &doc.NIN,
			&doc.Status, &doc.KYCStatus, &doc.Tier,
			&doc.Address, &doc.City, &doc.State, &doc.BranchID,
			&doc.CreatedAt, &doc.UpdatedAt, &accountNumbers,
		)
		if err != nil {
			continue
		}
		doc.AccountNumbers = accountNumbers

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexCustomers,
			ID:       doc.CustomerID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexAccounts indexes all accounts for a tenant
func (i *SearchIndexer) IndexAccounts(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			a.id, a.tenant_id, a.account_number, a.account_name,
			a.customer_id, c.first_name || ' ' || c.last_name as customer_name,
			a.account_type, a.product_code, a.currency, a.status,
			a.balance, a.available_balance, a.branch_id,
			a.opened_date, a.last_transaction_date
		FROM accounts a
		LEFT JOIN customers c ON a.customer_id = c.id AND a.tenant_id = c.tenant_id
		WHERE a.tenant_id = $1 AND a.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc AccountDocument
		err := rows.Scan(
			&doc.AccountID, &doc.TenantID, &doc.AccountNumber, &doc.AccountName,
			&doc.CustomerID, &doc.CustomerName,
			&doc.AccountType, &doc.ProductCode, &doc.Currency, &doc.Status,
			&doc.Balance, &doc.AvailableBalance, &doc.BranchID,
			&doc.OpenedDate, &doc.LastTransactionDate,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexAccounts,
			ID:       doc.AccountID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexTransactions indexes transactions for a tenant
func (i *SearchIndexer) IndexTransactions(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			t.id, t.tenant_id, t.reference, t.account_id, a.account_number,
			t.customer_id, c.first_name || ' ' || c.last_name as customer_name,
			t.type, t.direction, t.amount, t.currency, t.status, t.channel,
			t.narration, t.counterparty_name, t.counterparty_account, t.counterparty_bank,
			t.created_at, t.value_date, t.branch_id
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
		LEFT JOIN customers c ON t.customer_id = c.id
		WHERE t.tenant_id = $1 AND t.created_at > $2
		ORDER BY t.created_at DESC
		LIMIT 100000
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc TransactionDocument
		err := rows.Scan(
			&doc.TransactionID, &doc.TenantID, &doc.Reference, &doc.AccountID, &doc.AccountNumber,
			&doc.CustomerID, &doc.CustomerName,
			&doc.Type, &doc.Direction, &doc.Amount, &doc.Currency, &doc.Status, &doc.Channel,
			&doc.Narration, &doc.CounterpartyName, &doc.CounterpartyAccount, &doc.CounterpartyBank,
			&doc.CreatedAt, &doc.ValueDate, &doc.BranchID,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexTransactions,
			ID:       doc.TransactionID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexLoans indexes loans for a tenant
func (i *SearchIndexer) IndexLoans(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			l.id, l.tenant_id, l.application_id, l.customer_id,
			c.first_name || ' ' || c.last_name as customer_name,
			l.product_code, p.name as product_name,
			l.amount, l.disbursed_amount, l.outstanding_balance,
			l.interest_rate, l.tenure_months, l.status,
			l.disbursement_date, l.maturity_date, l.next_payment_date,
			l.branch_id, l.loan_officer_id, e.first_name || ' ' || e.last_name as loan_officer_name,
			l.collateral_type, l.purpose
		FROM loans l
		LEFT JOIN customers c ON l.customer_id = c.id
		LEFT JOIN loan_products p ON l.product_code = p.code
		LEFT JOIN employees e ON l.loan_officer_id = e.id
		WHERE l.tenant_id = $1 AND l.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc LoanDocument
		err := rows.Scan(
			&doc.LoanID, &doc.TenantID, &doc.ApplicationID, &doc.CustomerID,
			&doc.CustomerName, &doc.ProductCode, &doc.ProductName,
			&doc.Amount, &doc.DisbursedAmount, &doc.OutstandingBalance,
			&doc.InterestRate, &doc.TenureMonths, &doc.Status,
			&doc.DisbursementDate, &doc.MaturityDate, &doc.NextPaymentDate,
			&doc.BranchID, &doc.LoanOfficerID, &doc.LoanOfficerName,
			&doc.CollateralType, &doc.Purpose,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexLoans,
			ID:       doc.LoanID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexDisputes indexes disputes for a tenant
func (i *SearchIndexer) IndexDisputes(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			d.id, d.tenant_id, d.ticket_number, d.customer_id,
			c.first_name || ' ' || c.last_name as customer_name,
			d.account_id, d.transaction_id, d.category, d.subcategory,
			d.status, d.priority, d.amount, d.description, d.resolution,
			d.assigned_to, e.first_name || ' ' || e.last_name as assigned_to_name,
			d.created_at, d.resolved_at, d.sla_due_date, d.channel
		FROM disputes d
		LEFT JOIN customers c ON d.customer_id = c.id
		LEFT JOIN employees e ON d.assigned_to = e.id
		WHERE d.tenant_id = $1 AND d.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc DisputeDocument
		err := rows.Scan(
			&doc.DisputeID, &doc.TenantID, &doc.TicketNumber, &doc.CustomerID,
			&doc.CustomerName, &doc.AccountID, &doc.TransactionID,
			&doc.Category, &doc.Subcategory, &doc.Status, &doc.Priority,
			&doc.Amount, &doc.Description, &doc.Resolution,
			&doc.AssignedTo, &doc.AssignedToName,
			&doc.CreatedAt, &doc.ResolvedAt, &doc.SLADueDate, &doc.Channel,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexDisputes,
			ID:       doc.DisputeID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexDocuments indexes KYC/KYB documents for a tenant
func (i *SearchIndexer) IndexDocuments(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			d.id, d.tenant_id, d.customer_id,
			c.first_name || ' ' || c.last_name as customer_name,
			d.document_type, d.document_name, d.file_name, d.mime_type,
			d.status, d.verification_status, d.extracted_text, d.ocr_confidence,
			d.metadata, d.uploaded_at, d.verified_at, d.expiry_date, d.tags
		FROM documents d
		LEFT JOIN customers c ON d.customer_id = c.id
		WHERE d.tenant_id = $1 AND d.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc DocumentDocument
		var metadata json.RawMessage
		var tags []string
		err := rows.Scan(
			&doc.DocumentID, &doc.TenantID, &doc.CustomerID, &doc.CustomerName,
			&doc.DocumentType, &doc.DocumentName, &doc.FileName, &doc.MimeType,
			&doc.Status, &doc.VerificationStatus, &doc.ExtractedText, &doc.OCRConfidence,
			&metadata, &doc.UploadedAt, &doc.VerifiedAt, &doc.ExpiryDate, &tags,
		)
		if err != nil {
			continue
		}
		json.Unmarshal(metadata, &doc.Metadata)
		doc.Tags = tags

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexDocuments,
			ID:       doc.DocumentID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexEmployees indexes employees for a tenant
func (i *SearchIndexer) IndexEmployees(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			e.id, e.tenant_id, e.staff_id, e.first_name, e.last_name,
			COALESCE(e.first_name || ' ' || e.last_name, '') as full_name,
			e.email, e.phone, e.department, e.role, e.job_title,
			e.branch_id, b.name as branch_name, e.manager_id,
			e.status, e.hire_date, e.last_login
		FROM employees e
		LEFT JOIN branches b ON e.branch_id = b.id
		WHERE e.tenant_id = $1 AND e.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc EmployeeDocument
		err := rows.Scan(
			&doc.EmployeeID, &doc.TenantID, &doc.StaffID, &doc.FirstName, &doc.LastName,
			&doc.FullName, &doc.Email, &doc.Phone, &doc.Department, &doc.Role, &doc.JobTitle,
			&doc.BranchID, &doc.BranchName, &doc.ManagerID,
			&doc.Status, &doc.HireDate, &doc.LastLogin,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexEmployees,
			ID:       doc.EmployeeID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexProducts indexes products for a tenant
func (i *SearchIndexer) IndexProducts(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			p.id, p.tenant_id, p.code, p.name, p.category, p.subcategory,
			p.description, p.features, p.currency, p.min_amount, p.max_amount,
			p.interest_rate, p.status, p.eligibility, p.terms, p.tags, p.created_at
		FROM products p
		WHERE p.tenant_id = $1 AND p.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc ProductDocument
		var tags []string
		err := rows.Scan(
			&doc.ProductID, &doc.TenantID, &doc.ProductCode, &doc.ProductName,
			&doc.Category, &doc.Subcategory, &doc.Description, &doc.Features,
			&doc.Currency, &doc.MinAmount, &doc.MaxAmount, &doc.InterestRate,
			&doc.Status, &doc.Eligibility, &doc.Terms, &tags, &doc.CreatedAt,
		)
		if err != nil {
			continue
		}
		doc.Tags = tags

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexProducts,
			ID:       doc.ProductID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexNotifications indexes notifications for a tenant
func (i *SearchIndexer) IndexNotifications(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			n.id, n.tenant_id, n.customer_id, n.employee_id,
			n.type, n.channel, n.subject, n.body, n.status, n.priority,
			n.sent_at, n.read_at, n.reference_type, n.reference_id
		FROM notifications n
		WHERE n.tenant_id = $1 AND n.created_at > $2
		ORDER BY n.created_at DESC
		LIMIT 100000
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc NotificationDocument
		err := rows.Scan(
			&doc.NotificationID, &doc.TenantID, &doc.CustomerID, &doc.EmployeeID,
			&doc.Type, &doc.Channel, &doc.Subject, &doc.Body, &doc.Status, &doc.Priority,
			&doc.SentAt, &doc.ReadAt, &doc.ReferenceType, &doc.ReferenceID,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexNotifications,
			ID:       doc.NotificationID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// IndexTradeFinance indexes trade finance records for a tenant
func (i *SearchIndexer) IndexTradeFinance(ctx context.Context, tenantID string, since time.Time) (int, error) {
	query := `
		SELECT 
			t.id, t.tenant_id, t.reference, t.customer_id,
			c.first_name || ' ' || c.last_name as customer_name,
			t.type, t.instrument_type, t.amount, t.currency, t.status,
			t.counterparty, t.counterparty_country, t.goods_description,
			t.port_of_loading, t.port_of_discharge,
			t.issue_date, t.expiry_date, t.shipment_date
		FROM trade_finance t
		LEFT JOIN customers c ON t.customer_id = c.id
		WHERE t.tenant_id = $1 AND t.updated_at > $2
	`

	rows, err := i.db.Query(ctx, query, tenantID, since)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var doc TradeFinanceDocument
		err := rows.Scan(
			&doc.TradeID, &doc.TenantID, &doc.Reference, &doc.CustomerID, &doc.CustomerName,
			&doc.Type, &doc.InstrumentType, &doc.Amount, &doc.Currency, &doc.Status,
			&doc.Counterparty, &doc.CounterpartyCountry, &doc.GoodsDescription,
			&doc.PortOfLoading, &doc.PortOfDischarge,
			&doc.IssueDate, &doc.ExpiryDate, &doc.ShipmentDate,
		)
		if err != nil {
			continue
		}

		i.searchService.indexQueue <- &IndexRequest{
			Index:    IndexTradeFinance,
			ID:       doc.TradeID,
			TenantID: doc.TenantID,
			Document: doc.ToMap(),
		}
		count++
	}

	return count, nil
}

// FullReindex performs a full reindex of all data for a tenant
func (i *SearchIndexer) FullReindex(ctx context.Context, tenantID string) error {
	since := time.Time{} // Beginning of time

	fmt.Printf("Starting full reindex for tenant %s\n", tenantID)

	count, _ := i.IndexCustomers(ctx, tenantID, since)
	fmt.Printf("Indexed %d customers\n", count)

	count, _ = i.IndexAccounts(ctx, tenantID, since)
	fmt.Printf("Indexed %d accounts\n", count)

	count, _ = i.IndexTransactions(ctx, tenantID, since)
	fmt.Printf("Indexed %d transactions\n", count)

	count, _ = i.IndexLoans(ctx, tenantID, since)
	fmt.Printf("Indexed %d loans\n", count)

	count, _ = i.IndexDisputes(ctx, tenantID, since)
	fmt.Printf("Indexed %d disputes\n", count)

	count, _ = i.IndexDocuments(ctx, tenantID, since)
	fmt.Printf("Indexed %d documents\n", count)

	count, _ = i.IndexEmployees(ctx, tenantID, since)
	fmt.Printf("Indexed %d employees\n", count)

	count, _ = i.IndexProducts(ctx, tenantID, since)
	fmt.Printf("Indexed %d products\n", count)

	count, _ = i.IndexNotifications(ctx, tenantID, since)
	fmt.Printf("Indexed %d notifications\n", count)

	count, _ = i.IndexTradeFinance(ctx, tenantID, since)
	fmt.Printf("Indexed %d trade finance records\n", count)

	fmt.Printf("Full reindex completed for tenant %s\n", tenantID)
	return nil
}

// Document types for indexing

type CustomerDocument struct {
	CustomerID     string    `json:"customer_id"`
	TenantID       string    `json:"tenant_id"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	FullName       string    `json:"full_name"`
	Email          string    `json:"email"`
	Phone          string    `json:"phone"`
	BVN            string    `json:"bvn"`
	NIN            string    `json:"nin"`
	AccountNumbers []string  `json:"account_numbers"`
	Status         string    `json:"status"`
	KYCStatus      string    `json:"kyc_status"`
	Tier           string    `json:"tier"`
	Address        string    `json:"address"`
	City           string    `json:"city"`
	State          string    `json:"state"`
	BranchID       string    `json:"branch_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (d *CustomerDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"customer_id":     d.CustomerID,
		"tenant_id":       d.TenantID,
		"first_name":      d.FirstName,
		"last_name":       d.LastName,
		"full_name":       d.FullName,
		"email":           d.Email,
		"phone":           d.Phone,
		"bvn":             d.BVN,
		"nin":             d.NIN,
		"account_numbers": d.AccountNumbers,
		"status":          d.Status,
		"kyc_status":      d.KYCStatus,
		"tier":            d.Tier,
		"address":         d.Address,
		"city":            d.City,
		"state":           d.State,
		"branch_id":       d.BranchID,
		"created_at":      d.CreatedAt,
		"updated_at":      d.UpdatedAt,
	}
}

type AccountDocument struct {
	AccountID           string    `json:"account_id"`
	TenantID            string    `json:"tenant_id"`
	AccountNumber       string    `json:"account_number"`
	AccountName         string    `json:"account_name"`
	CustomerID          string    `json:"customer_id"`
	CustomerName        string    `json:"customer_name"`
	AccountType         string    `json:"account_type"`
	ProductCode         string    `json:"product_code"`
	Currency            string    `json:"currency"`
	Status              string    `json:"status"`
	Balance             float64   `json:"balance"`
	AvailableBalance    float64   `json:"available_balance"`
	BranchID            string    `json:"branch_id"`
	OpenedDate          time.Time `json:"opened_date"`
	LastTransactionDate time.Time `json:"last_transaction_date"`
}

func (d *AccountDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"account_id":            d.AccountID,
		"tenant_id":             d.TenantID,
		"account_number":        d.AccountNumber,
		"account_name":          d.AccountName,
		"customer_id":           d.CustomerID,
		"customer_name":         d.CustomerName,
		"account_type":          d.AccountType,
		"product_code":          d.ProductCode,
		"currency":              d.Currency,
		"status":                d.Status,
		"balance":               d.Balance,
		"available_balance":     d.AvailableBalance,
		"branch_id":             d.BranchID,
		"opened_date":           d.OpenedDate,
		"last_transaction_date": d.LastTransactionDate,
	}
}

type TransactionDocument struct {
	TransactionID       string    `json:"transaction_id"`
	TenantID            string    `json:"tenant_id"`
	Reference           string    `json:"reference"`
	AccountID           string    `json:"account_id"`
	AccountNumber       string    `json:"account_number"`
	CustomerID          string    `json:"customer_id"`
	CustomerName        string    `json:"customer_name"`
	Type                string    `json:"type"`
	Direction           string    `json:"direction"`
	Amount              float64   `json:"amount"`
	Currency            string    `json:"currency"`
	Status              string    `json:"status"`
	Channel             string    `json:"channel"`
	Narration           string    `json:"narration"`
	CounterpartyName    string    `json:"counterparty_name"`
	CounterpartyAccount string    `json:"counterparty_account"`
	CounterpartyBank    string    `json:"counterparty_bank"`
	CreatedAt           time.Time `json:"created_at"`
	ValueDate           time.Time `json:"value_date"`
	BranchID            string    `json:"branch_id"`
}

func (d *TransactionDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"transaction_id":       d.TransactionID,
		"tenant_id":            d.TenantID,
		"reference":            d.Reference,
		"account_id":           d.AccountID,
		"account_number":       d.AccountNumber,
		"customer_id":          d.CustomerID,
		"customer_name":        d.CustomerName,
		"type":                 d.Type,
		"direction":            d.Direction,
		"amount":               d.Amount,
		"currency":             d.Currency,
		"status":               d.Status,
		"channel":              d.Channel,
		"narration":            d.Narration,
		"counterparty_name":    d.CounterpartyName,
		"counterparty_account": d.CounterpartyAccount,
		"counterparty_bank":    d.CounterpartyBank,
		"created_at":           d.CreatedAt,
		"value_date":           d.ValueDate,
		"branch_id":            d.BranchID,
	}
}

type LoanDocument struct {
	LoanID             string    `json:"loan_id"`
	TenantID           string    `json:"tenant_id"`
	ApplicationID      string    `json:"application_id"`
	CustomerID         string    `json:"customer_id"`
	CustomerName       string    `json:"customer_name"`
	ProductCode        string    `json:"product_code"`
	ProductName        string    `json:"product_name"`
	Amount             float64   `json:"amount"`
	DisbursedAmount    float64   `json:"disbursed_amount"`
	OutstandingBalance float64   `json:"outstanding_balance"`
	InterestRate       float64   `json:"interest_rate"`
	TenureMonths       int       `json:"tenure_months"`
	Status             string    `json:"status"`
	DisbursementDate   time.Time `json:"disbursement_date"`
	MaturityDate       time.Time `json:"maturity_date"`
	NextPaymentDate    time.Time `json:"next_payment_date"`
	BranchID           string    `json:"branch_id"`
	LoanOfficerID      string    `json:"loan_officer_id"`
	LoanOfficerName    string    `json:"loan_officer_name"`
	CollateralType     string    `json:"collateral_type"`
	Purpose            string    `json:"purpose"`
}

func (d *LoanDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"loan_id":             d.LoanID,
		"tenant_id":           d.TenantID,
		"application_id":      d.ApplicationID,
		"customer_id":         d.CustomerID,
		"customer_name":       d.CustomerName,
		"product_code":        d.ProductCode,
		"product_name":        d.ProductName,
		"amount":              d.Amount,
		"disbursed_amount":    d.DisbursedAmount,
		"outstanding_balance": d.OutstandingBalance,
		"interest_rate":       d.InterestRate,
		"tenure_months":       d.TenureMonths,
		"status":              d.Status,
		"disbursement_date":   d.DisbursementDate,
		"maturity_date":       d.MaturityDate,
		"next_payment_date":   d.NextPaymentDate,
		"branch_id":           d.BranchID,
		"loan_officer_id":     d.LoanOfficerID,
		"loan_officer_name":   d.LoanOfficerName,
		"collateral_type":     d.CollateralType,
		"purpose":             d.Purpose,
	}
}

type DisputeDocument struct {
	DisputeID      string    `json:"dispute_id"`
	TenantID       string    `json:"tenant_id"`
	TicketNumber   string    `json:"ticket_number"`
	CustomerID     string    `json:"customer_id"`
	CustomerName   string    `json:"customer_name"`
	AccountID      string    `json:"account_id"`
	TransactionID  string    `json:"transaction_id"`
	Category       string    `json:"category"`
	Subcategory    string    `json:"subcategory"`
	Status         string    `json:"status"`
	Priority       string    `json:"priority"`
	Amount         float64   `json:"amount"`
	Description    string    `json:"description"`
	Resolution     string    `json:"resolution"`
	AssignedTo     string    `json:"assigned_to"`
	AssignedToName string    `json:"assigned_to_name"`
	CreatedAt      time.Time `json:"created_at"`
	ResolvedAt     time.Time `json:"resolved_at"`
	SLADueDate     time.Time `json:"sla_due_date"`
	Channel        string    `json:"channel"`
}

func (d *DisputeDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"dispute_id":       d.DisputeID,
		"tenant_id":        d.TenantID,
		"ticket_number":    d.TicketNumber,
		"customer_id":      d.CustomerID,
		"customer_name":    d.CustomerName,
		"account_id":       d.AccountID,
		"transaction_id":   d.TransactionID,
		"category":         d.Category,
		"subcategory":      d.Subcategory,
		"status":           d.Status,
		"priority":         d.Priority,
		"amount":           d.Amount,
		"description":      d.Description,
		"resolution":       d.Resolution,
		"assigned_to":      d.AssignedTo,
		"assigned_to_name": d.AssignedToName,
		"created_at":       d.CreatedAt,
		"resolved_at":      d.ResolvedAt,
		"sla_due_date":     d.SLADueDate,
		"channel":          d.Channel,
	}
}

type DocumentDocument struct {
	DocumentID         string                 `json:"document_id"`
	TenantID           string                 `json:"tenant_id"`
	CustomerID         string                 `json:"customer_id"`
	CustomerName       string                 `json:"customer_name"`
	DocumentType       string                 `json:"document_type"`
	DocumentName       string                 `json:"document_name"`
	FileName           string                 `json:"file_name"`
	MimeType           string                 `json:"mime_type"`
	Status             string                 `json:"status"`
	VerificationStatus string                 `json:"verification_status"`
	ExtractedText      string                 `json:"extracted_text"`
	OCRConfidence      float64                `json:"ocr_confidence"`
	Metadata           map[string]interface{} `json:"metadata"`
	UploadedAt         time.Time              `json:"uploaded_at"`
	VerifiedAt         time.Time              `json:"verified_at"`
	ExpiryDate         time.Time              `json:"expiry_date"`
	Tags               []string               `json:"tags"`
}

func (d *DocumentDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"document_id":         d.DocumentID,
		"tenant_id":           d.TenantID,
		"customer_id":         d.CustomerID,
		"customer_name":       d.CustomerName,
		"document_type":       d.DocumentType,
		"document_name":       d.DocumentName,
		"file_name":           d.FileName,
		"mime_type":           d.MimeType,
		"status":              d.Status,
		"verification_status": d.VerificationStatus,
		"extracted_text":      d.ExtractedText,
		"ocr_confidence":      d.OCRConfidence,
		"metadata":            d.Metadata,
		"uploaded_at":         d.UploadedAt,
		"verified_at":         d.VerifiedAt,
		"expiry_date":         d.ExpiryDate,
		"tags":                d.Tags,
	}
}

type EmployeeDocument struct {
	EmployeeID string    `json:"employee_id"`
	TenantID   string    `json:"tenant_id"`
	StaffID    string    `json:"staff_id"`
	FirstName  string    `json:"first_name"`
	LastName   string    `json:"last_name"`
	FullName   string    `json:"full_name"`
	Email      string    `json:"email"`
	Phone      string    `json:"phone"`
	Department string    `json:"department"`
	Role       string    `json:"role"`
	JobTitle   string    `json:"job_title"`
	BranchID   string    `json:"branch_id"`
	BranchName string    `json:"branch_name"`
	ManagerID  string    `json:"manager_id"`
	Status     string    `json:"status"`
	HireDate   time.Time `json:"hire_date"`
	LastLogin  time.Time `json:"last_login"`
}

func (d *EmployeeDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"employee_id": d.EmployeeID,
		"tenant_id":   d.TenantID,
		"staff_id":    d.StaffID,
		"first_name":  d.FirstName,
		"last_name":   d.LastName,
		"full_name":   d.FullName,
		"email":       d.Email,
		"phone":       d.Phone,
		"department":  d.Department,
		"role":        d.Role,
		"job_title":   d.JobTitle,
		"branch_id":   d.BranchID,
		"branch_name": d.BranchName,
		"manager_id":  d.ManagerID,
		"status":      d.Status,
		"hire_date":   d.HireDate,
		"last_login":  d.LastLogin,
	}
}

type ProductDocument struct {
	ProductID    string    `json:"product_id"`
	TenantID     string    `json:"tenant_id"`
	ProductCode  string    `json:"product_code"`
	ProductName  string    `json:"product_name"`
	Category     string    `json:"category"`
	Subcategory  string    `json:"subcategory"`
	Description  string    `json:"description"`
	Features     string    `json:"features"`
	Currency     string    `json:"currency"`
	MinAmount    float64   `json:"min_amount"`
	MaxAmount    float64   `json:"max_amount"`
	InterestRate float64   `json:"interest_rate"`
	Status       string    `json:"status"`
	Eligibility  string    `json:"eligibility"`
	Terms        string    `json:"terms"`
	Tags         []string  `json:"tags"`
	CreatedAt    time.Time `json:"created_at"`
}

func (d *ProductDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"product_id":    d.ProductID,
		"tenant_id":     d.TenantID,
		"product_code":  d.ProductCode,
		"product_name":  d.ProductName,
		"category":      d.Category,
		"subcategory":   d.Subcategory,
		"description":   d.Description,
		"features":      d.Features,
		"currency":      d.Currency,
		"min_amount":    d.MinAmount,
		"max_amount":    d.MaxAmount,
		"interest_rate": d.InterestRate,
		"status":        d.Status,
		"eligibility":   d.Eligibility,
		"terms":         d.Terms,
		"tags":          d.Tags,
		"created_at":    d.CreatedAt,
	}
}

type NotificationDocument struct {
	NotificationID string    `json:"notification_id"`
	TenantID       string    `json:"tenant_id"`
	CustomerID     string    `json:"customer_id"`
	EmployeeID     string    `json:"employee_id"`
	Type           string    `json:"type"`
	Channel        string    `json:"channel"`
	Subject        string    `json:"subject"`
	Body           string    `json:"body"`
	Status         string    `json:"status"`
	Priority       string    `json:"priority"`
	SentAt         time.Time `json:"sent_at"`
	ReadAt         time.Time `json:"read_at"`
	ReferenceType  string    `json:"reference_type"`
	ReferenceID    string    `json:"reference_id"`
}

func (d *NotificationDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"notification_id": d.NotificationID,
		"tenant_id":       d.TenantID,
		"customer_id":     d.CustomerID,
		"employee_id":     d.EmployeeID,
		"type":            d.Type,
		"channel":         d.Channel,
		"subject":         d.Subject,
		"body":            d.Body,
		"status":          d.Status,
		"priority":        d.Priority,
		"sent_at":         d.SentAt,
		"read_at":         d.ReadAt,
		"reference_type":  d.ReferenceType,
		"reference_id":    d.ReferenceID,
	}
}

type TradeFinanceDocument struct {
	TradeID             string    `json:"trade_id"`
	TenantID            string    `json:"tenant_id"`
	Reference           string    `json:"reference"`
	CustomerID          string    `json:"customer_id"`
	CustomerName        string    `json:"customer_name"`
	Type                string    `json:"type"`
	InstrumentType      string    `json:"instrument_type"`
	Amount              float64   `json:"amount"`
	Currency            string    `json:"currency"`
	Status              string    `json:"status"`
	Counterparty        string    `json:"counterparty"`
	CounterpartyCountry string    `json:"counterparty_country"`
	GoodsDescription    string    `json:"goods_description"`
	PortOfLoading       string    `json:"port_of_loading"`
	PortOfDischarge     string    `json:"port_of_discharge"`
	IssueDate           time.Time `json:"issue_date"`
	ExpiryDate          time.Time `json:"expiry_date"`
	ShipmentDate        time.Time `json:"shipment_date"`
}

func (d *TradeFinanceDocument) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"trade_id":             d.TradeID,
		"tenant_id":            d.TenantID,
		"reference":            d.Reference,
		"customer_id":          d.CustomerID,
		"customer_name":        d.CustomerName,
		"type":                 d.Type,
		"instrument_type":      d.InstrumentType,
		"amount":               d.Amount,
		"currency":             d.Currency,
		"status":               d.Status,
		"counterparty":         d.Counterparty,
		"counterparty_country": d.CounterpartyCountry,
		"goods_description":    d.GoodsDescription,
		"port_of_loading":      d.PortOfLoading,
		"port_of_discharge":    d.PortOfDischarge,
		"issue_date":           d.IssueDate,
		"expiry_date":          d.ExpiryDate,
		"shipment_date":        d.ShipmentDate,
	}
}
