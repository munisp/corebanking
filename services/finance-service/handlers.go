package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

func registerRoutes(router *gin.Engine) {
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "service": "finance-service"})
	})

	api := router.Group("/api/v1/finance")
	{
		// Invoice financing
		api.POST("/invoices", submitInvoice)
		api.GET("/invoices", listInvoices)
		api.GET("/invoices/:id", getInvoice)
		api.POST("/invoices/:id/finance", financeInvoice)

		// Loans
		api.POST("/loans", applyForLoan)
		api.GET("/loans", listLoans)
		api.GET("/loans/:id", getLoan)
		api.POST("/loans/:id/disburse", disburseLoan)
		api.POST("/repayments", makeRepayment)
	}
}

var financeKafkaClient = NewFinanceKafkaClient()

func submitInvoice(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		SupplierID    string  `json:"supplier_id" binding:"required"`
		BuyerID       string  `json:"buyer_id" binding:"required"`
		InvoiceNumber string  `json:"invoice_number" binding:"required"`
		Amount        float64 `json:"amount" binding:"required"`
		Currency      string  `json:"currency"`
		IssueDate     string  `json:"issue_date" binding:"required"`
		DueDate       string  `json:"due_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	invoiceID := generateID("INV")
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	query := `
		INSERT INTO invoices (invoice_id, tenant_id, supplier_id, buyer_id, invoice_number, amount, currency, issue_date, due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at
	`

	var createdAt time.Time
	err := db.QueryRow(query, invoiceID, tenantID, req.SupplierID, req.BuyerID, req.InvoiceNumber, req.Amount, req.Currency, req.IssueDate, req.DueDate).Scan(&createdAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to submit invoice", "details": err.Error()})
		return
	}

	// Publish event to Kafka
	event := FinanceEvent{
		Type:      "finance.invoice.created",
		EntityID:  invoiceID,
		TenantID:  tenantID,
		Status:    "pending",
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"supplier_id":    req.SupplierID,
			"buyer_id":       req.BuyerID,
			"invoice_number": req.InvoiceNumber,
			"amount":         req.Amount,
			"currency":       req.Currency,
			"issue_date":     req.IssueDate,
			"due_date":       req.DueDate,
		},
	}
	financeKafkaClient.PublishEvent("finance.invoice.created", event)

	c.JSON(201, gin.H{"invoice_id": invoiceID, "status": "pending", "created_at": createdAt})
}

func listInvoices(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	status := c.Query("status")

	query := "SELECT invoice_id, supplier_id, buyer_id, amount, currency, status, issue_date, due_date FROM invoices WHERE tenant_id = $1"
	args := []interface{}{tenantID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch invoices", "details": err.Error()})
		return
	}
	defer rows.Close()

	invoices := []map[string]interface{}{}
	for rows.Next() {
		var invID, supID, buyID, currency, status, issueDate, dueDate string
		var amount float64
		rows.Scan(&invID, &supID, &buyID, &amount, &currency, &status, &issueDate, &dueDate)
		invoices = append(invoices, map[string]interface{}{
			"invoice_id":  invID,
			"supplier_id": supID,
			"buyer_id":    buyID,
			"amount":      amount,
			"currency":    currency,
			"status":      status,
			"issue_date":  issueDate,
			"due_date":    dueDate,
		})
	}

	c.JSON(200, gin.H{"invoices": invoices})
}

func getInvoice(c *gin.Context) {
	invoiceID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := "SELECT invoice_id, supplier_id, buyer_id, amount, currency, status, issue_date, due_date, financed_amount FROM invoices WHERE invoice_id = $1 AND tenant_id = $2"

	var invID, supID, buyID, currency, status, issueDate, dueDate string
	var amount, financedAmount float64

	err := db.QueryRow(query, invoiceID, tenantID).Scan(&invID, &supID, &buyID, &amount, &currency, &status, &issueDate, &dueDate, &financedAmount)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Invoice not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch invoice", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{
		"invoice_id":      invID,
		"supplier_id":     supID,
		"buyer_id":        buyID,
		"amount":          amount,
		"currency":        currency,
		"status":          status,
		"issue_date":      issueDate,
		"due_date":        dueDate,
		"financed_amount": financedAmount,
	})
}

func financeInvoice(c *gin.Context) {
	invoiceID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		FinancedAmount float64 `json:"financed_amount" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := "UPDATE invoices SET status = 'financed', financed_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE invoice_id = $2 AND tenant_id = $3"

	_, err := db.Exec(query, req.FinancedAmount, invoiceID, tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to finance invoice", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "financed", "invoice_id": invoiceID})
}

func applyForLoan(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		BorrowerID   string  `json:"borrower_id" binding:"required"`
		LoanProduct  string  `json:"loan_product" binding:"required"`
		Amount       float64 `json:"amount" binding:"required"`
		InterestRate float64 `json:"interest_rate" binding:"required"`
		TermMonths   int     `json:"term_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	loanID := generateID("LOAN")

	query := `
		INSERT INTO loans (loan_id, tenant_id, borrower_id, loan_product, amount, interest_rate, term_months)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at
	`

	var createdAt time.Time
	err := db.QueryRow(query, loanID, tenantID, req.BorrowerID, req.LoanProduct, req.Amount, req.InterestRate, req.TermMonths).Scan(&createdAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to apply for loan", "details": err.Error()})
		return
	}

	c.JSON(201, gin.H{"loan_id": loanID, "status": "pending", "created_at": createdAt})
}

func listLoans(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")
	status := c.Query("status")

	query := "SELECT loan_id, borrower_id, loan_product, amount, interest_rate, term_months, status FROM loans WHERE tenant_id = $1"
	args := []interface{}{tenantID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch loans", "details": err.Error()})
		return
	}
	defer rows.Close()

	loans := []map[string]interface{}{}
	for rows.Next() {
		var loanID, borrowerID, loanProduct, status string
		var amount, interestRate float64
		var termMonths int
		rows.Scan(&loanID, &borrowerID, &loanProduct, &amount, &interestRate, &termMonths, &status)
		loans = append(loans, map[string]interface{}{
			"loan_id":       loanID,
			"borrower_id":   borrowerID,
			"loan_product":  loanProduct,
			"amount":        amount,
			"interest_rate": interestRate,
			"term_months":   termMonths,
			"status":        status,
		})
	}

	c.JSON(200, gin.H{"loans": loans})
}

func getLoan(c *gin.Context) {
	loanID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	query := "SELECT loan_id, borrower_id, loan_product, amount, interest_rate, term_months, status, disbursed_at, fully_repaid_at FROM loans WHERE loan_id = $1 AND tenant_id = $2"

	var borrowerID, loanProduct, status string
	var amount, interestRate float64
	var termMonths int
	var disbursedAt, fullyRepaidAt sql.NullTime

	err := db.QueryRow(query, loanID, tenantID).Scan(&loanID, &borrowerID, &loanProduct, &amount, &interestRate, &termMonths, &status, &disbursedAt, &fullyRepaidAt)

	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "Loan not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch loan", "details": err.Error()})
		return
	}

	result := gin.H{
		"loan_id":       loanID,
		"borrower_id":   borrowerID,
		"loan_product":  loanProduct,
		"amount":        amount,
		"interest_rate": interestRate,
		"term_months":   termMonths,
		"status":        status,
	}

	if disbursedAt.Valid {
		result["disbursed_at"] = disbursedAt.Time
	}
	if fullyRepaidAt.Valid {
		result["fully_repaid_at"] = fullyRepaidAt.Time
	}

	c.JSON(200, result)
}

func disburseLoan(c *gin.Context) {
	loanID := c.Param("id")
	tenantID := c.GetHeader("X-Tenant-ID")

	// Record journal entry in Chart of Accounts (fail-fast)
	coaEntry := CreateJournalEntryRequest{
		Date:        time.Now(),
		Description: fmt.Sprintf("Loan disbursement for loan %s", loanID),
		Reference:   loanID,
		Lines: []JournalLineRequest{
			{AccountID: "loan", Description: "Disburse loan", DebitAmount: 0, CreditAmount: 100000}, // Example amount
			{AccountID: "customer", Description: "Receive loan", DebitAmount: 100000, CreditAmount: 0},
		},
		PostedBy: "system",
		Metadata: map[string]interface{}{"loan_id": loanID},
	}
	_, err := coaClient.CreateJournalEntry(tenantID, "system", "finance_admin", coaEntry)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to record accounting entry", "details": err.Error()})
		return
	}

	query := "UPDATE loans SET status = 'disbursed', disbursed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE loan_id = $1 AND tenant_id = $2"
	_, err = db.Exec(query, loanID, tenantID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to disburse loan", "details": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "disbursed", "loan_id": loanID})
}

func makeRepayment(c *gin.Context) {
	tenantID := c.GetHeader("X-Tenant-ID")

	var req struct {
		LoanID          string  `json:"loan_id" binding:"required"`
		Amount          float64 `json:"amount" binding:"required"`
		PrincipalAmount float64 `json:"principal_amount" binding:"required"`
		InterestAmount  float64 `json:"interest_amount" binding:"required"`
		PaymentDate     string  `json:"payment_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	repaymentID := generateID("REP")

	// Record journal entry in Chart of Accounts (fail-fast)
	coaEntry := CreateJournalEntryRequest{
		Date:        time.Now(),
		Description: fmt.Sprintf("Loan repayment for loan %s", req.LoanID),
		Reference:   repaymentID,
		Lines: []JournalLineRequest{
			{AccountID: "customer", Description: "Repay loan", DebitAmount: int64(req.Amount * 100), CreditAmount: 0},
			{AccountID: "loan", Description: "Receive repayment", DebitAmount: 0, CreditAmount: int64(req.PrincipalAmount * 100)},
			{AccountID: "interest", Description: "Interest payment", DebitAmount: 0, CreditAmount: int64(req.InterestAmount * 100)},
		},
		PostedBy: "system",
		Metadata: map[string]interface{}{"loan_id": req.LoanID},
	}
	_, err := coaClient.CreateJournalEntry(tenantID, "system", "finance_admin", coaEntry)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to record accounting entry", "details": err.Error()})
		return
	}

	query := `
		       INSERT INTO repayments (repayment_id, tenant_id, loan_id, amount, principal_amount, interest_amount, payment_date)
		       VALUES ($1, $2, $3, $4, $5, $6, $7)
		       RETURNING created_at
	       `

	var createdAt time.Time
	err = db.QueryRow(query, repaymentID, tenantID, req.LoanID, req.Amount, req.PrincipalAmount, req.InterestAmount, req.PaymentDate).Scan(&createdAt)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to make repayment", "details": err.Error()})
		return
	}

	c.JSON(201, gin.H{"repayment_id": repaymentID, "status": "completed", "created_at": createdAt})
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s%s%d", prefix, hex.EncodeToString(b)[:8], time.Now().Unix()%10000)
}
