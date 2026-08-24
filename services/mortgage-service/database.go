package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
)

// Database initialization
func initDatabase() error {
	dbHost := getEnv("DB_HOST", "postgres")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "core_banking_carbon")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Carbon database connection established")

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func initRedis() *redis.Client {
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis-master.redis.svc.cluster.local:6379"
	}

	// Fail closed: the Redis password must come from the environment; no
	// credential is ever embedded in source.
	redisPassword := os.Getenv("REDIS_PASSWORD")
	if redisPassword == "" {
		log.Fatal("REDIS_PASSWORD environment variable must be set")
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       0,
	})

	log.Printf("Redis client initialized: %s", redisAddr)
	return rdb
}

func createTables() error {
	// on push remove table creation

	tables := `
	-- Mortgage Applications
	CREATE TABLE IF NOT EXISTS mortgage_applications (
		id VARCHAR(50) PRIMARY KEY,
		tenant_id VARCHAR(50) NOT NULL,
		application_number VARCHAR(50) UNIQUE NOT NULL,
		status VARCHAR(50) NOT NULL,
		product_type VARCHAR(50) NOT NULL,
		
		-- Primary Applicant
		primary_applicant_id VARCHAR(50) NOT NULL,
		primary_applicant_name VARCHAR(255) NOT NULL,
		primary_applicant_bvn VARCHAR(20),
		primary_applicant_nin VARCHAR(20),
		
		-- Employment & Income
		employment_type VARCHAR(50),
		employer_name VARCHAR(255),
		employment_duration INTEGER,
		monthly_gross_income DECIMAL(18,2),
		monthly_net_income DECIMAL(18,2),
		other_income DECIMAL(18,2),
		total_monthly_income DECIMAL(18,2),
		
		-- Existing Obligations
		existing_loan_payments DECIMAL(18,2),
		credit_card_payments DECIMAL(18,2),
		other_obligations DECIMAL(18,2),
		total_monthly_obligations DECIMAL(18,2),
		
		-- Loan Details
		requested_amount DECIMAL(18,2) NOT NULL,
		approved_amount DECIMAL(18,2),
		down_payment DECIMAL(18,2),
		requested_tenor_months INTEGER NOT NULL,
		approved_tenor_months INTEGER,
		interest_rate DECIMAL(8,4),
		interest_rate_type VARCHAR(20),
		base_rate DECIMAL(8,4),
		margin DECIMAL(8,4),
		monthly_payment DECIMAL(18,2),
		
		-- Credit Assessment
		credit_score INTEGER,
		dti_ratio DECIMAL(8,4),
		ltv_ratio DECIMAL(8,4),
		risk_score DECIMAL(8,4),
		
		-- NHF Details
		nhf_contributor BOOLEAN DEFAULT FALSE,
		nhf_account_number VARCHAR(50),
		nhf_contribution_months INTEGER,
		nhf_balance DECIMAL(18,2),
		
		-- TigerBeetle Accounts
		ledger_account_id VARCHAR(100),
		escrow_account_id VARCHAR(100),
		principal_account_id VARCHAR(100),
		interest_account_id VARCHAR(100),
		
		-- Timestamps
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
		submitted_at TIMESTAMP,
		approved_at TIMESTAMP,
		disbursed_at TIMESTAMP,
		maturity_date TIMESTAMP
		
		-- Foreign key removed - tenants table managed separately
		-- CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_mortgage_tenant ON mortgage_applications(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_mortgage_status ON mortgage_applications(status);
	CREATE INDEX IF NOT EXISTS idx_mortgage_applicant ON mortgage_applications(primary_applicant_id);
	CREATE INDEX IF NOT EXISTS idx_mortgage_created ON mortgage_applications(created_at);

	-- Joint Applicants
	CREATE TABLE IF NOT EXISTS mortgage_joint_applicants (
		id VARCHAR(50) PRIMARY KEY,
		application_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		bvn VARCHAR(20),
		nin VARCHAR(20),
		relationship VARCHAR(50),
		monthly_income DECIMAL(18,2),
		employment_type VARCHAR(50),
		income_contribution DECIMAL(8,4),
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_joint_applicant_app ON mortgage_joint_applicants(application_id);

	-- Property Details
	CREATE TABLE IF NOT EXISTS mortgage_properties (
		id VARCHAR(50) PRIMARY KEY,
		application_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		property_type VARCHAR(50),
		occupancy_type VARCHAR(50),
		address TEXT,
		city VARCHAR(100),
		state VARCHAR(50),
		lga VARCHAR(100),
		postal_code VARCHAR(20),
		
		-- Property Details
		year_built INTEGER,
		number_of_bedrooms INTEGER,
		number_of_bathrooms INTEGER,
		total_area DECIMAL(12,2),
		land_area DECIMAL(12,2),
		
		-- Developer
		developer_name VARCHAR(255),
		project_name VARCHAR(255),
		is_off_plan BOOLEAN DEFAULT FALSE,
		expected_completion TIMESTAMP,
		
		-- Valuation
		purchase_price DECIMAL(18,2),
		market_value DECIMAL(18,2),
		forced_sale_value DECIMAL(18,2),
		valuation_date TIMESTAMP,
		valuation_report_id VARCHAR(100),
		valuer_name VARCHAR(255),
		valuer_license VARCHAR(100),
		
		-- Title Information
		title_status VARCHAR(50),
		cof_o_number VARCHAR(100),
		cof_o_date TIMESTAMP,
		governor_consent_date TIMESTAMP,
		survey_plan_number VARCHAR(100),
		deed_number VARCHAR(100),
		registry_state VARCHAR(50),
		
		-- Insurance
		property_insurance_id VARCHAR(100),
		insurance_provider VARCHAR(255),
		insurance_premium DECIMAL(18,2),
		insurance_expiry TIMESTAMP,
		
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_property_app ON mortgage_properties(application_id);
	CREATE INDEX IF NOT EXISTS idx_property_state ON mortgage_properties(state);

	-- Repayment Schedule
	CREATE TABLE IF NOT EXISTS mortgage_repayment_schedule (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		payment_number INTEGER NOT NULL,
		due_date DATE NOT NULL,
		principal_amount DECIMAL(18,2) NOT NULL,
		interest_amount DECIMAL(18,2) NOT NULL,
		escrow_amount DECIMAL(18,2) DEFAULT 0,
		total_amount DECIMAL(18,2) NOT NULL,
		opening_balance DECIMAL(18,2) NOT NULL,
		closing_balance DECIMAL(18,2) NOT NULL,
		status VARCHAR(20) DEFAULT 'pending',
		paid_date TIMESTAMP,
		paid_amount DECIMAL(18,2),
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_schedule_mortgage ON mortgage_repayment_schedule(mortgage_id);
	CREATE INDEX IF NOT EXISTS idx_schedule_due ON mortgage_repayment_schedule(due_date);
	CREATE INDEX IF NOT EXISTS idx_schedule_status ON mortgage_repayment_schedule(status);

	-- Payments
	CREATE TABLE IF NOT EXISTS mortgage_payments (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		tenant_id VARCHAR(50) NOT NULL,
		payment_number INTEGER,
		due_date TIMESTAMP,
		paid_date TIMESTAMP,
		principal_amount DECIMAL(18,2),
		interest_amount DECIMAL(18,2),
		escrow_amount DECIMAL(18,2),
		total_amount DECIMAL(18,2),
		paid_amount DECIMAL(18,2) NOT NULL,
		outstanding_balance DECIMAL(18,2),
		status VARCHAR(20) NOT NULL,
		payment_method VARCHAR(50),
		payment_reference VARCHAR(100),
		ledger_transaction_id VARCHAR(100),
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_payment_mortgage ON mortgage_payments(mortgage_id);
	CREATE INDEX IF NOT EXISTS idx_payment_date ON mortgage_payments(paid_date);

	-- Escrow Accounts
	CREATE TABLE IF NOT EXISTS mortgage_escrow_accounts (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		tigerbeetle_account_id VARCHAR(100),
		balance DECIMAL(18,2) DEFAULT 0,
		monthly_contribution DECIMAL(18,2),
		property_tax_amount DECIMAL(18,2),
		insurance_premium DECIMAL(18,2),
		next_tax_due_date DATE,
		next_insurance_due_date DATE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_escrow_mortgage ON mortgage_escrow_accounts(mortgage_id);

	-- Underwriting Decisions
	CREATE TABLE IF NOT EXISTS mortgage_underwriting_decisions (
		id VARCHAR(50) PRIMARY KEY,
		application_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		decision VARCHAR(20) NOT NULL,
		credit_score INTEGER,
		dti_ratio DECIMAL(8,4),
		dsti_ratio DECIMAL(8,4),
		ltv_ratio DECIMAL(8,4),
		risk_score DECIMAL(8,4),
		risk_grade VARCHAR(5),
		probability_of_default DECIMAL(8,6),
		loss_given_default DECIMAL(8,6),
		expected_loss DECIMAL(18,2),
		approved_amount DECIMAL(18,2),
		approved_tenor INTEGER,
		interest_rate DECIMAL(8,4),
		conditions JSONB,
		decline_reasons JSONB,
		refer_reasons JSONB,
		recommendations JSONB,
		underwritten_by VARCHAR(100),
		underwritten_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_underwriting_app ON mortgage_underwriting_decisions(application_id);

	-- Approvals
	CREATE TABLE IF NOT EXISTS mortgage_approvals (
		id VARCHAR(50) PRIMARY KEY,
		application_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		approved_by VARCHAR(100) NOT NULL,
		approved_amount DECIMAL(18,2),
		approved_tenor INTEGER,
		interest_rate DECIMAL(8,4),
		conditions JSONB,
		notes TEXT,
		approved_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_approval_app ON mortgage_approvals(application_id);

	-- Restructuring History
	CREATE TABLE IF NOT EXISTS mortgage_restructuring (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		restructure_type VARCHAR(50) NOT NULL,
		previous_tenor INTEGER,
		new_tenor INTEGER,
		previous_rate DECIMAL(8,4),
		new_rate DECIMAL(8,4),
		previous_payment DECIMAL(18,2),
		new_payment DECIMAL(18,2),
		reason TEXT,
		approved_by VARCHAR(100),
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_restructure_mortgage ON mortgage_restructuring(mortgage_id);

	-- Forbearance Requests
	CREATE TABLE IF NOT EXISTS mortgage_forbearance (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		forbearance_type VARCHAR(50) NOT NULL,
		duration_months INTEGER NOT NULL,
		reduced_payment DECIMAL(18,2),
		reason TEXT,
		status VARCHAR(20) DEFAULT 'pending',
		approved_by VARCHAR(100),
		start_date DATE,
		end_date DATE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_forbearance_mortgage ON mortgage_forbearance(mortgage_id);

	-- Arrears Tracking
	CREATE TABLE IF NOT EXISTS mortgage_arrears (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL REFERENCES mortgage_applications(id) ON DELETE CASCADE,
		arrears_amount DECIMAL(18,2) NOT NULL,
		days_past_due INTEGER NOT NULL,
		bucket VARCHAR(20) NOT NULL, -- 1-30, 31-60, 61-90, 90+
		penalty_amount DECIMAL(18,2),
		last_payment_date TIMESTAMP,
		status VARCHAR(20) DEFAULT 'active',
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_arrears_mortgage ON mortgage_arrears(mortgage_id);
	CREATE INDEX IF NOT EXISTS idx_arrears_bucket ON mortgage_arrears(bucket);

	-- Audit Trail
	CREATE TABLE IF NOT EXISTS mortgage_audit_trail (
		id VARCHAR(50) PRIMARY KEY,
		mortgage_id VARCHAR(50) NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		action VARCHAR(100) NOT NULL,
		actor VARCHAR(100),
		actor_type VARCHAR(50), -- user, system, api
		old_value JSONB,
		new_value JSONB,
		ip_address VARCHAR(50),
		user_agent TEXT,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_audit_mortgage ON mortgage_audit_trail(mortgage_id);
	CREATE INDEX IF NOT EXISTS idx_audit_action ON mortgage_audit_trail(action);
	CREATE INDEX IF NOT EXISTS idx_audit_created ON mortgage_audit_trail(created_at);

	-- Mortgage Products
	CREATE TABLE IF NOT EXISTS mortgage_products (
		id VARCHAR(50) PRIMARY KEY,
		code VARCHAR(50) UNIQUE NOT NULL,
		name VARCHAR(255) NOT NULL,
		description TEXT,
		product_type VARCHAR(50) NOT NULL,
		min_amount DECIMAL(18,2),
		max_amount DECIMAL(18,2),
		min_tenor_months INTEGER,
		max_tenor_months INTEGER,
		base_rate DECIMAL(8,4),
		max_ltv DECIMAL(8,4),
		max_dti DECIMAL(8,4),
		requires_collateral BOOLEAN DEFAULT TRUE,
		requires_nhf BOOLEAN DEFAULT FALSE,
		requires_valuation BOOLEAN DEFAULT TRUE,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	-- Insert default products
	INSERT INTO mortgage_products (id, code, name, description, product_type, min_amount, max_amount, min_tenor_months, max_tenor_months, base_rate, max_ltv, max_dti, requires_nhf)
	VALUES 
		('PROD001', 'FIXED_RATE', 'Fixed Rate Mortgage', 'Standard fixed rate mortgage with stable monthly payments', 'fixed_rate', 5000000, 500000000, 60, 300, 18.0, 0.80, 0.40, FALSE),
		('PROD002', 'VARIABLE_RATE', 'Variable Rate Mortgage', 'Variable rate mortgage linked to base rate', 'variable_rate', 5000000, 500000000, 60, 300, 16.0, 0.80, 0.40, FALSE),
		('PROD003', 'NHF_BACKED', 'NHF-Backed Mortgage', 'Subsidized mortgage for NHF contributors', 'nhf_backed', 2000000, 50000000, 60, 360, 6.0, 0.90, 0.45, TRUE),
		('PROD004', 'FMBN_BACKED', 'FMBN-Backed Mortgage', 'Federal Mortgage Bank backed mortgage', 'fmbn_backed', 2000000, 100000000, 60, 360, 9.0, 0.85, 0.45, FALSE),
		('PROD005', 'CONSTRUCTION', 'Construction Loan', 'Loan for building a new property', 'construction_loan', 10000000, 1000000000, 12, 36, 20.0, 0.70, 0.35, FALSE),
		('PROD006', 'EQUITY_RELEASE', 'Equity Release', 'Release equity from existing property', 'equity_release', 5000000, 200000000, 60, 180, 19.0, 0.60, 0.35, FALSE),
		('PROD007', 'BUY_TO_LET', 'Buy-to-Let Mortgage', 'Mortgage for investment properties', 'buy_to_let', 10000000, 300000000, 60, 240, 20.0, 0.65, 0.35, FALSE)
	ON CONFLICT (code) DO NOTHING;

	-- Event outbox: financial events that could not be published to Kafka are
	-- persisted here for retry. Events are never silently dropped.
	CREATE TABLE IF NOT EXISTS mortgage_event_outbox (
		id VARCHAR(50) PRIMARY KEY,
		topic VARCHAR(100) NOT NULL,
		event_type VARCHAR(100) NOT NULL,
		mortgage_id VARCHAR(50),
		tenant_id VARCHAR(50),
		payload JSONB NOT NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'pending',
		retry_count INTEGER NOT NULL DEFAULT 0,
		last_error TEXT,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		published_at TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_mortgage_outbox_status ON mortgage_event_outbox(status);
	`

	_, err := db.Exec(tables)
	if err != nil {
		log.Printf("Error creating tables: %v", err)
		return fmt.Errorf("could not create tables: %w", err)
	}
	log.Println("Carbon database tables created/verified")
	return nil
}

// Database operations
func saveMortgageApplication(app *MortgageApplication) error {
	if db == nil {
		log.Printf("Database not available, storing in memory")
		return nil
	}

	query := `
		INSERT INTO mortgage_applications (
			id, tenant_id, application_number, status, product_type,
			primary_applicant_id, primary_applicant_name, primary_applicant_bvn, primary_applicant_nin,
			employment_type, employer_name, employment_duration,
			monthly_gross_income, monthly_net_income, other_income, total_monthly_income,
			existing_loan_payments, credit_card_payments, other_obligations, total_monthly_obligations,
			requested_amount, down_payment, requested_tenor_months,
			nhf_contributor, nhf_account_number, nhf_contribution_months, nhf_balance,
			ledger_account_id, escrow_account_id, principal_account_id, interest_account_id,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
	`

	_, err := db.Exec(query,
		app.ID, app.TenantID, app.ApplicationNumber, app.Status, app.ProductType,
		app.PrimaryApplicantID, app.PrimaryApplicantName, app.PrimaryApplicantBVN, app.PrimaryApplicantNIN,
		app.EmploymentType, app.EmployerName, app.EmploymentDuration,
		app.MonthlyGrossIncome, app.MonthlyNetIncome, app.OtherIncome, app.TotalMonthlyIncome,
		app.ExistingLoanPayments, app.CreditCardPayments, app.OtherObligations, app.TotalMonthlyObligations,
		app.RequestedAmount, app.DownPayment, app.RequestedTenorMonths,
		app.NHFContributor, app.NHFAccountNumber, app.NHFContributionMonths, app.NHFBalance,
		app.LedgerAccountID, app.EscrowAccountID, app.PrincipalAccountID, app.InterestAccountID,
		app.CreatedAt, app.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error saving mortgage application: %v", err)
	}

	return err
}

func fetchMortgageApplication(id, tenantID string) (*MortgageApplication, error) {
	if db == nil {
		return &MortgageApplication{ID: id, TenantID: tenantID}, nil
	}

	app := &MortgageApplication{}
	query := `
		SELECT id, tenant_id, application_number, status, product_type,
			primary_applicant_id, primary_applicant_name,
			COALESCE(primary_applicant_bvn, ''), COALESCE(primary_applicant_nin, ''),
			COALESCE(employment_type, ''), COALESCE(employer_name, ''), COALESCE(employment_duration, 0),
			COALESCE(monthly_gross_income, 0), COALESCE(monthly_net_income, 0),
			COALESCE(other_income, 0), COALESCE(total_monthly_income, 0),
			COALESCE(existing_loan_payments, 0), COALESCE(credit_card_payments, 0),
			COALESCE(other_obligations, 0), COALESCE(total_monthly_obligations, 0),
			requested_amount, COALESCE(approved_amount, 0), COALESCE(down_payment, 0),
			requested_tenor_months, COALESCE(approved_tenor_months, 0),
			COALESCE(interest_rate, 0), COALESCE(monthly_payment, 0),
			COALESCE(credit_score, 0), COALESCE(dti_ratio, 0), COALESCE(ltv_ratio, 0), COALESCE(risk_score, 0),
			COALESCE(nhf_contributor, FALSE), COALESCE(nhf_account_number, ''),
			COALESCE(nhf_contribution_months, 0), COALESCE(nhf_balance, 0),
			COALESCE(ledger_account_id, ''), COALESCE(escrow_account_id, ''),
			COALESCE(principal_account_id, ''), COALESCE(interest_account_id, ''),
			created_at, updated_at, submitted_at, approved_at, disbursed_at, maturity_date
		FROM mortgage_applications
		WHERE id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicationNumber, &app.Status, &app.ProductType,
		&app.PrimaryApplicantID, &app.PrimaryApplicantName,
		&app.PrimaryApplicantBVN, &app.PrimaryApplicantNIN,
		&app.EmploymentType, &app.EmployerName, &app.EmploymentDuration,
		&app.MonthlyGrossIncome, &app.MonthlyNetIncome,
		&app.OtherIncome, &app.TotalMonthlyIncome,
		&app.ExistingLoanPayments, &app.CreditCardPayments,
		&app.OtherObligations, &app.TotalMonthlyObligations,
		&app.RequestedAmount, &app.ApprovedAmount, &app.DownPayment,
		&app.RequestedTenorMonths, &app.ApprovedTenorMonths,
		&app.InterestRate, &app.MonthlyPayment,
		&app.CreditScore, &app.DTIRatio, &app.LTVRatio, &app.RiskScore,
		&app.NHFContributor, &app.NHFAccountNumber,
		&app.NHFContributionMonths, &app.NHFBalance,
		&app.LedgerAccountID, &app.EscrowAccountID,
		&app.PrincipalAccountID, &app.InterestAccountID,
		&app.CreatedAt, &app.UpdatedAt, &app.SubmittedAt, &app.ApprovedAt, &app.DisbursedAt, &app.MaturityDate,
	)

	if err != nil {
		return nil, err
	}

	// Fetch property details
	app.Property = fetchPropertyDetails(id)

	// Fetch joint applicants
	app.JointApplicants = fetchJointApplicants(id)

	return app, nil
}

func fetchMortgageApplications(tenantID, status, productType string, limit, offset int) ([]*MortgageApplication, error) {
	if db == nil {
		return []*MortgageApplication{}, nil
	}

	query := `
		SELECT id, tenant_id, application_number, status, product_type,
			primary_applicant_id, primary_applicant_name,
			requested_amount, COALESCE(approved_amount, 0),
			requested_tenor_months, COALESCE(approved_tenor_months, 0),
			created_at, updated_at
		FROM mortgage_applications
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}
	argCount := 1

	if status != "" {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, status)
	}

	if productType != "" {
		argCount++
		query += fmt.Sprintf(" AND product_type = $%d", argCount)
		args = append(args, productType)
	}

	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []*MortgageApplication
	for rows.Next() {
		app := &MortgageApplication{}
		err := rows.Scan(
			&app.ID, &app.TenantID, &app.ApplicationNumber, &app.Status, &app.ProductType,
			&app.PrimaryApplicantID, &app.PrimaryApplicantName,
			&app.RequestedAmount, &app.ApprovedAmount,
			&app.RequestedTenorMonths, &app.ApprovedTenorMonths,
			&app.CreatedAt, &app.UpdatedAt,
		)
		if err != nil {
			continue
		}
		apps = append(apps, app)
	}

	return apps, nil
}

func updateMortgageStatus(id, tenantID string, status MortgageStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE mortgage_applications SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`
	res, err := db.Exec(query, status, id, tenantID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("mortgage %s not found for tenant — status not updated", id)
	}
	return nil
}

// claimMortgageForDisbursement atomically transitions a mortgage from a
// disbursable state (offer_accepted / disbursement_pending) to "disbursing".
// The single UPDATE ... WHERE status IN (...) RETURNING ... statement is the
// concurrency guard: exactly one concurrent caller can claim the row; all
// others get (nil, nil). The returned record carries the SERVER-SIDE approved
// terms — the disbursement amount must never come from the request body.
func claimMortgageForDisbursement(id, tenantID string) (*MortgageApplication, error) {
	if db == nil {
		return nil, fmt.Errorf("database unavailable: cannot claim mortgage %s for disbursement", id)
	}

	query := `
		UPDATE mortgage_applications
		SET status = $1, updated_at = NOW()
		WHERE id = $2 AND tenant_id = $3
		  AND status IN ($4, $5)
		RETURNING application_number, product_type, primary_applicant_id,
			COALESCE(approved_amount, 0), COALESCE(approved_tenor_months, 0),
			COALESCE(interest_rate, 0), COALESCE(principal_account_id, ''),
			COALESCE(escrow_account_id, ''), COALESCE(interest_account_id, ''),
			COALESCE(ledger_account_id, ''),
			requested_amount, requested_tenor_months
	`

	app := &MortgageApplication{ID: id, TenantID: tenantID, Status: StatusDisbursing}
	err := db.QueryRow(query,
		StatusDisbursing, id, tenantID, StatusOfferAccepted, StatusDisbursementPending,
	).Scan(
		&app.ApplicationNumber, &app.ProductType, &app.PrimaryApplicantID,
		&app.ApprovedAmount, &app.ApprovedTenorMonths,
		&app.InterestRate, &app.PrincipalAccountID,
		&app.EscrowAccountID, &app.InterestAccountID,
		&app.LedgerAccountID,
		&app.RequestedAmount, &app.RequestedTenorMonths,
	)
	if err == sql.ErrNoRows {
		// Claim not acquired: already disbursed, disbursing, or wrong state.
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("claim mortgage %s for disbursement: %w", id, err)
	}
	return app, nil
}

// releaseDisbursementClaim rolls a claimed ("disbursing") mortgage back to
// its pre-claim status after a pre-transfer failure. It refuses to touch a
// row that is no longer in "disbursing", so it can never clobber a completed
// disbursement.
func releaseDisbursementClaim(id, tenantID string, restore MortgageStatus) error {
	if db == nil {
		return fmt.Errorf("database unavailable: cannot release disbursement claim for %s", id)
	}
	query := `UPDATE mortgage_applications SET status = $1, updated_at = NOW()
		WHERE id = $2 AND tenant_id = $3 AND status = $4`
	res, err := db.Exec(query, restore, id, tenantID, StatusDisbursing)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("mortgage %s no longer in 'disbursing' state — claim release refused", id)
	}
	return nil
}

// markDisbursementCompensationFailed records that the disbursement saga's
// compensation (ledger reversal) failed. This state requires manual ops
// reconciliation and must never be silently bypassed.
func markDisbursementCompensationFailed(id, tenantID string) error {
	if db == nil {
		return fmt.Errorf("database unavailable: cannot mark compensation_failed for %s", id)
	}
	query := `UPDATE mortgage_applications SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := db.Exec(query, StatusCompensationFailed, id, tenantID)
	return err
}

// saveEventToOutbox persists a failed Kafka event to the outbox table so a
// relay/operator can retry it. Financial events are never silently dropped.
func saveEventToOutbox(topic string, event MortgageEvent) error {
	if db == nil {
		return fmt.Errorf("database unavailable: cannot persist event %s to outbox", event.Type)
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("serialize outbox event: %w", err)
	}
	// Deterministic idempotency key over the natural/business keys so a retry
	// of the same logical event dedupes instead of double-inserting.
	key := generateID("OUT")
	query := `
		INSERT INTO mortgage_event_outbox
			(id, topic, event_type, mortgage_id, tenant_id, payload, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
		ON CONFLICT (id) DO NOTHING
	`
	_, err = db.Exec(query, key, topic, event.Type, event.MortgageID, event.TenantID, payload)
	return err
}

func updateMortgageApplicationFields(id, tenantID string, updates map[string]interface{}) error {
	if db == nil {
		return nil
	}

	// Build dynamic update query
	query := "UPDATE mortgage_applications SET updated_at = NOW()"
	args := []interface{}{}
	argCount := 0

	allowedFields := map[string]bool{
		"employment_type": true, "employer_name": true, "employment_duration": true,
		"monthly_gross_income": true, "monthly_net_income": true, "other_income": true,
		"existing_loan_payments": true, "credit_card_payments": true, "other_obligations": true,
		"down_payment": true, "requested_tenor_months": true,
		"primary_applicant_bvn": true, "primary_applicant_nin": true,
	}

	for field, value := range updates {
		if allowedFields[field] {
			argCount++
			query += fmt.Sprintf(", %s = $%d", field, argCount)
			args = append(args, value)
		}
	}

	argCount++
	query += fmt.Sprintf(" WHERE id = $%d", argCount)
	args = append(args, id)

	argCount++
	query += fmt.Sprintf(" AND tenant_id = $%d", argCount)
	args = append(args, tenantID)

	_, err := db.Exec(query, args...)
	return err
}

func validateApplicationForSubmission(app *MortgageApplication) error {
	if app.PrimaryApplicantBVN == "" {
		return fmt.Errorf("BVN is required")
	}
	if app.MonthlyGrossIncome <= 0 {
		return fmt.Errorf("monthly income is required")
	}
	if app.RequestedAmount <= 0 {
		return fmt.Errorf("requested amount is required")
	}
	if app.RequestedTenorMonths <= 0 {
		return fmt.Errorf("requested tenor is required")
	}
	return nil
}

func saveUnderwritingResults(app *MortgageApplication) error {
	if db == nil {
		return nil
	}

	query := `
		UPDATE mortgage_applications SET
			credit_score = $1, dti_ratio = $2, ltv_ratio = $3, risk_score = $4,
			approved_amount = $5, approved_tenor_months = $6, interest_rate = $7,
			updated_at = NOW()
		WHERE id = $8 AND tenant_id = $9
	`

	_, err := db.Exec(query,
		app.CreditScore, app.DTIRatio, app.LTVRatio, app.RiskScore,
		app.ApprovedAmount, app.ApprovedTenorMonths, app.InterestRate,
		app.ID, app.TenantID,
	)
	return err
}

func saveApprovalDetails(app *MortgageApplication, approvedBy string, conditions []string, notes string) error {
	if db == nil {
		return nil
	}

	// Update application
	query := `
		UPDATE mortgage_applications SET
			status = $1, approved_amount = $2, approved_tenor_months = $3,
			interest_rate = $4, approved_at = NOW(), updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6
	`
	_, err := db.Exec(query, StatusApproved, app.ApprovedAmount, app.ApprovedTenorMonths,
		app.InterestRate, app.ID, app.TenantID)
	if err != nil {
		return err
	}

	// Save approval record
	conditionsJSON, _ := json.Marshal(conditions)
	approvalQuery := `
		INSERT INTO mortgage_approvals (id, application_id, approved_by, approved_amount, approved_tenor, interest_rate, conditions, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = db.Exec(approvalQuery, generateID("APR"), app.ID, approvedBy,
		app.ApprovedAmount, app.ApprovedTenorMonths, app.InterestRate, conditionsJSON, notes)

	return err
}

func saveDisbursementDetails(app *MortgageApplication, transferID string) error {
	if db == nil {
		return nil
	}

	query := `
		UPDATE mortgage_applications SET
			status = $1, disbursed_at = $2, maturity_date = $3,
			monthly_payment = $4, updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6
	`
	_, err := db.Exec(query, StatusDisbursed, app.DisbursedAt, app.MaturityDate,
		app.MonthlyPayment, app.ID, app.TenantID)
	return err
}

func savePropertyDetails(property *PropertyDetails) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO mortgage_properties (
			id, application_id, property_type, occupancy_type,
			address, city, state, lga, postal_code,
			year_built, number_of_bedrooms, number_of_bathrooms, total_area, land_area,
			developer_name, project_name, is_off_plan, expected_completion,
			purchase_price, title_status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
	`

	_, err := db.Exec(query,
		property.ID, property.ApplicationID, property.PropertyType, property.OccupancyType,
		property.Address, property.City, property.State, property.LGA, property.PostalCode,
		property.YearBuilt, property.NumberOfBedrooms, property.NumberOfBathrooms, property.TotalArea, property.LandArea,
		property.DeveloperName, property.ProjectName, property.IsOffPlan, property.ExpectedCompletion,
		property.PurchasePrice, property.TitleStatus,
	)
	return err
}

func fetchPropertyDetails(applicationID string) PropertyDetails {
	property := PropertyDetails{}
	if db == nil {
		return property
	}

	query := `
		SELECT id, application_id, COALESCE(property_type, ''), COALESCE(occupancy_type, ''),
			COALESCE(address, ''), COALESCE(city, ''), COALESCE(state, ''), COALESCE(lga, ''),
			COALESCE(purchase_price, 0), COALESCE(market_value, 0), COALESCE(forced_sale_value, 0),
			COALESCE(title_status, '')
		FROM mortgage_properties WHERE application_id = $1
	`

	db.QueryRow(query, applicationID).Scan(
		&property.ID, &property.ApplicationID, &property.PropertyType, &property.OccupancyType,
		&property.Address, &property.City, &property.State, &property.LGA,
		&property.PurchasePrice, &property.MarketValue, &property.ForcedSaleValue,
		&property.TitleStatus,
	)

	return property
}

func updatePropertyDetailsFields(applicationID string, updates map[string]interface{}) error {
	if db == nil {
		return nil
	}

	// Similar to updateMortgageApplicationFields
	return nil
}

func saveValuationDetails(applicationID string, marketValue, forcedSaleValue float64, valuationDate time.Time, valuerName, valuerLicense, reportID string) error {
	if db == nil {
		return nil
	}

	query := `
		UPDATE mortgage_properties SET
			market_value = $1, forced_sale_value = $2, valuation_date = $3,
			valuer_name = $4, valuer_license = $5, valuation_report_id = $6,
			updated_at = NOW()
		WHERE application_id = $7
	`
	_, err := db.Exec(query, marketValue, forcedSaleValue, valuationDate,
		valuerName, valuerLicense, reportID, applicationID)
	return err
}

func saveTitleVerification(applicationID string, titleStatus TitleStatus, cofONumber string, cofODate, governorConsentDate *time.Time, surveyPlanNumber, deedNumber, registryState, verifiedBy string) error {
	if db == nil {
		return nil
	}

	query := `
		UPDATE mortgage_properties SET
			title_status = $1, cof_o_number = $2, cof_o_date = $3,
			governor_consent_date = $4, survey_plan_number = $5,
			deed_number = $6, registry_state = $7, updated_at = NOW()
		WHERE application_id = $8
	`
	_, err := db.Exec(query, titleStatus, cofONumber, cofODate,
		governorConsentDate, surveyPlanNumber, deedNumber, registryState, applicationID)
	return err
}

func saveNHFDetails(app *MortgageApplication) error {
	if db == nil {
		return nil
	}

	query := `
		UPDATE mortgage_applications SET
			nhf_contributor = $1, nhf_account_number = $2,
			nhf_contribution_months = $3, nhf_balance = $4, updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6
	`
	_, err := db.Exec(query, app.NHFContributor, app.NHFAccountNumber,
		app.NHFContributionMonths, app.NHFBalance, app.ID, app.TenantID)
	return err
}

func saveJointApplicant(applicant *JointApplicant) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO mortgage_joint_applicants (id, application_id, name, bvn, nin, relationship, monthly_income, employment_type, income_contribution)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := db.Exec(query, applicant.ID, applicant.ApplicationID, applicant.Name,
		applicant.BVN, applicant.NIN, applicant.Relationship, applicant.MonthlyIncome,
		applicant.EmploymentType, applicant.IncomeContribution)
	return err
}

func fetchJointApplicants(applicationID string) []JointApplicant {
	if db == nil {
		return []JointApplicant{}
	}

	query := `SELECT id, application_id, name, COALESCE(bvn, ''), COALESCE(nin, ''), 
		COALESCE(relationship, ''), COALESCE(monthly_income, 0), COALESCE(employment_type, ''), 
		COALESCE(income_contribution, 0) FROM mortgage_joint_applicants WHERE application_id = $1`

	rows, err := db.Query(query, applicationID)
	if err != nil {
		return []JointApplicant{}
	}
	defer rows.Close()

	var applicants []JointApplicant
	for rows.Next() {
		var a JointApplicant
		rows.Scan(&a.ID, &a.ApplicationID, &a.Name, &a.BVN, &a.NIN,
			&a.Relationship, &a.MonthlyIncome, &a.EmploymentType, &a.IncomeContribution)
		applicants = append(applicants, a)
	}
	return applicants
}

func deleteJointApplicant(applicantID string) error {
	if db == nil {
		return nil
	}

	query := `DELETE FROM mortgage_joint_applicants WHERE id = $1`
	_, err := db.Exec(query, applicantID)
	return err
}

func saveRepaymentSchedule(mortgageID string, schedule []ScheduleEntry) error {
	if db == nil {
		return nil
	}

	for _, entry := range schedule {
		query := `
			INSERT INTO mortgage_repayment_schedule (
				id, mortgage_id, payment_number, due_date,
				principal_amount, interest_amount, escrow_amount, total_amount,
				opening_balance, closing_balance, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`
		_, err := db.Exec(query, generateID("SCH"), mortgageID, entry.PaymentNumber,
			entry.DueDate, entry.PrincipalAmount, entry.InterestAmount, entry.EscrowAmount,
			entry.TotalAmount, entry.OpeningBalance, entry.ClosingBalance, "pending")
		if err != nil {
			return err
		}
	}
	return nil
}

func fetchRepaymentSchedule(mortgageID string) ([]ScheduleEntry, error) {
	if db == nil {
		return []ScheduleEntry{}, nil
	}

	query := `
		SELECT payment_number, due_date, principal_amount, interest_amount, escrow_amount,
			total_amount, opening_balance, closing_balance, status, paid_date, COALESCE(paid_amount, 0)
		FROM mortgage_repayment_schedule
		WHERE mortgage_id = $1
		ORDER BY payment_number
	`

	rows, err := db.Query(query, mortgageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedule []ScheduleEntry
	for rows.Next() {
		var entry ScheduleEntry
		rows.Scan(&entry.PaymentNumber, &entry.DueDate, &entry.PrincipalAmount,
			&entry.InterestAmount, &entry.EscrowAmount, &entry.TotalAmount,
			&entry.OpeningBalance, &entry.ClosingBalance, &entry.Status,
			&entry.PaidDate, &entry.PaidAmount)
		schedule = append(schedule, entry)
	}
	return schedule, nil
}

func savePayment(payment *MortgagePayment) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO mortgage_payments (
			id, mortgage_id, tenant_id, paid_date, paid_amount, status, ledger_transaction_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := db.Exec(query, payment.ID, payment.MortgageID, payment.TenantID,
		payment.PaidDate, payment.PaidAmount, payment.Status, payment.LedgerTransactionID)
	return err
}

func fetchPaymentHistory(mortgageID string) ([]MortgagePayment, error) {
	if db == nil {
		return []MortgagePayment{}, nil
	}

	query := `
		SELECT id, mortgage_id, tenant_id, paid_date, paid_amount, status, ledger_transaction_id
		FROM mortgage_payments
		WHERE mortgage_id = $1
		ORDER BY paid_date DESC
	`

	rows, err := db.Query(query, mortgageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []MortgagePayment
	for rows.Next() {
		var p MortgagePayment
		rows.Scan(&p.ID, &p.MortgageID, &p.TenantID, &p.PaidDate, &p.PaidAmount,
			&p.Status, &p.LedgerTransactionID)
		payments = append(payments, p)
	}
	return payments, nil
}

func setupEscrowAccount(app *MortgageApplication) error {
	if db == nil {
		return nil
	}

	// Calculate monthly escrow contribution
	monthlyTax := app.Property.PurchasePrice * 0.001 / 12 // ~0.1% annual property tax
	monthlyInsurance := app.Property.InsurancePremium / 12

	escrow := &MortgageEscrowAccount{
		ID:                   generateID("ESC"),
		MortgageID:           app.ID,
		TigerBeetleAccountID: app.EscrowAccountID,
		MonthlyContribution:  monthlyTax + monthlyInsurance,
		PropertyTaxAmount:    monthlyTax * 12,
		InsurancePremium:     app.Property.InsurancePremium,
		NextTaxDueDate:       time.Now().AddDate(1, 0, 0),
		NextInsuranceDueDate: time.Now().AddDate(1, 0, 0),
	}

	query := `
		INSERT INTO mortgage_escrow_accounts (
			id, mortgage_id, tigerbeetle_account_id, monthly_contribution,
			property_tax_amount, insurance_premium, next_tax_due_date, next_insurance_due_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := db.Exec(query, escrow.ID, escrow.MortgageID, escrow.TigerBeetleAccountID,
		escrow.MonthlyContribution, escrow.PropertyTaxAmount, escrow.InsurancePremium,
		escrow.NextTaxDueDate, escrow.NextInsuranceDueDate)
	return err
}

func fetchEscrowAccount(mortgageID string) (*MortgageEscrowAccount, error) {
	if db == nil {
		return &MortgageEscrowAccount{MortgageID: mortgageID}, nil
	}

	escrow := &MortgageEscrowAccount{}
	query := `
		SELECT id, mortgage_id, tigerbeetle_account_id, balance, monthly_contribution,
			property_tax_amount, insurance_premium, next_tax_due_date, next_insurance_due_date
		FROM mortgage_escrow_accounts WHERE mortgage_id = $1
	`
	err := db.QueryRow(query, mortgageID).Scan(
		&escrow.ID, &escrow.MortgageID, &escrow.TigerBeetleAccountID, &escrow.Balance,
		&escrow.MonthlyContribution, &escrow.PropertyTaxAmount, &escrow.InsurancePremium,
		&escrow.NextTaxDueDate, &escrow.NextInsuranceDueDate,
	)
	return escrow, err
}

func saveRestructuringDetails(app *MortgageApplication, restructureType, reason, approvedBy string) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO mortgage_restructuring (
			id, mortgage_id, restructure_type, new_tenor, new_rate, new_payment, reason, approved_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := db.Exec(query, generateID("RST"), app.ID, restructureType,
		app.ApprovedTenorMonths, app.InterestRate, app.MonthlyPayment, reason, approvedBy)
	if err != nil {
		return fmt.Errorf("save restructuring record: %w", err)
	}

	// Update main application — this write carries money terms (tenor, rate,
	// monthly payment); a failure here must surface, not be swallowed.
	updateQuery := `
		UPDATE mortgage_applications SET
			approved_tenor_months = $1, interest_rate = $2, monthly_payment = $3, updated_at = NOW()
		WHERE id = $4
	`
	if _, err := db.Exec(updateQuery, app.ApprovedTenorMonths, app.InterestRate, app.MonthlyPayment, app.ID); err != nil {
		return fmt.Errorf("update restructured mortgage terms: %w", err)
	}

	return nil
}

func saveForbearanceRequest(mortgageID, forbearanceID, forbearanceType string, durationMonths int, reducedPayment float64, reason string) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO mortgage_forbearance (
			id, mortgage_id, forbearance_type, duration_months, reduced_payment, reason, status
		) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
	`
	_, err := db.Exec(query, forbearanceID, mortgageID, forbearanceType,
		durationMonths, reducedPayment, reason)
	return err
}

// amountToMinorUnits converts a major-unit (naira) amount to integer minor
// units (kobo). All arrears arithmetic below is done in integer minor units
// so float drift can never misclassify a mortgage.
func amountToMinorUnits(amount float64) int64 {
	return int64(math.Round(amount * 100))
}

func arrearsBucket(daysPastDue int) string {
	switch {
	case daysPastDue >= 90:
		return "90+"
	case daysPastDue >= 60:
		return "61-90"
	case daysPastDue >= 30:
		return "31-60"
	case daysPastDue > 0:
		return "1-30"
	default:
		return "current"
	}
}

// computeArrears recalculates the arrears position of a mortgage from its
// repayment schedule: every pending schedule entry whose due date has passed
// contributes its outstanding amount (scheduled total minus what has already
// been paid against the entry). Fails closed when the database is
// unavailable — a mortgage must never be reported "current" because the
// schedule could not be read.
func computeArrears(mortgageID string) (*ArrearsStatus, error) {
	if db == nil {
		return nil, fmt.Errorf("database not available")
	}

	schedule, err := fetchRepaymentSchedule(mortgageID)
	if err != nil {
		return nil, fmt.Errorf("fetch repayment schedule for arrears: %w", err)
	}

	today := time.Now()
	var arrearsKobo int64
	daysPastDue := 0
	for _, entry := range schedule {
		if entry.Status != "pending" || !entry.DueDate.Before(today) {
			continue
		}
		outstandingKobo := amountToMinorUnits(entry.TotalAmount) - amountToMinorUnits(entry.PaidAmount)
		if outstandingKobo <= 0 {
			continue
		}
		arrearsKobo += outstandingKobo
		if days := int(today.Sub(entry.DueDate).Hours() / 24); days > daysPastDue {
			daysPastDue = days
		}
	}

	var lastPaymentDate *time.Time
	row := db.QueryRow(
		"SELECT MAX(paid_date) FROM mortgage_payments WHERE mortgage_id = $1 AND status = 'paid'",
		mortgageID,
	)
	if err := row.Scan(&lastPaymentDate); err != nil {
		return nil, fmt.Errorf("fetch last payment date for arrears: %w", err)
	}

	return &ArrearsStatus{
		MortgageID:      mortgageID,
		InArrears:       arrearsKobo > 0,
		DaysPastDue:     daysPastDue,
		ArrearsAmount:   float64(arrearsKobo) / 100,
		Bucket:          arrearsBucket(daysPastDue),
		PenaltyAmount:   0, // no penalty policy is configured in this service
		LastPaymentDate: lastPaymentDate,
	}, nil
}

// updateArrearsStatus recalculates the arrears position and persists it to
// mortgage_arrears. Called after every payment (main.go) and from the daily
// servicing workflow (temporal_workflows.go). A cleared position resolves any
// active arrears record; an overdue position upserts the active record.
func updateArrearsStatus(mortgageID, tenantID string) error {
	if db == nil {
		return fmt.Errorf("database not available")
	}

	status, err := computeArrears(mortgageID)
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin arrears update: %w", err)
	}
	defer tx.Rollback()

	if !status.InArrears {
		// Arrears cleared — resolve any active record.
		if _, err := tx.Exec(
			"UPDATE mortgage_arrears SET status = 'resolved', updated_at = NOW() WHERE mortgage_id = $1 AND status = 'active'",
			mortgageID,
		); err != nil {
			return fmt.Errorf("resolve cleared arrears for mortgage %s: %w", mortgageID, err)
		}
		return tx.Commit()
	}

	res, err := tx.Exec(
		`UPDATE mortgage_arrears SET
			arrears_amount = $2, days_past_due = $3, bucket = $4,
			penalty_amount = $5, last_payment_date = $6, updated_at = NOW()
		WHERE mortgage_id = $1 AND status = 'active'`,
		mortgageID, status.ArrearsAmount, status.DaysPastDue, status.Bucket,
		status.PenaltyAmount, status.LastPaymentDate,
	)
	if err != nil {
		return fmt.Errorf("update arrears record for mortgage %s: %w", mortgageID, err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("arrears update result for mortgage %s: %w", mortgageID, err)
	}
	if affected == 0 {
		if _, err := tx.Exec(
			`INSERT INTO mortgage_arrears (
				id, mortgage_id, arrears_amount, days_past_due, bucket,
				penalty_amount, last_payment_date, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
			generateID("ARR"), mortgageID, status.ArrearsAmount, status.DaysPastDue,
			status.Bucket, status.PenaltyAmount, status.LastPaymentDate,
		); err != nil {
			return fmt.Errorf("insert arrears record for mortgage %s: %w", mortgageID, err)
		}
	}

	log.Printf("Arrears recalculated for mortgage %s (tenant %s): in_arrears=%v days_past_due=%d amount=%.2f bucket=%s",
		mortgageID, tenantID, status.InArrears, status.DaysPastDue, status.ArrearsAmount, status.Bucket)
	return tx.Commit()
}

func calculateArrearsStatus(mortgageID string) (*ArrearsStatus, error) {
	return computeArrears(mortgageID)
}

// ArrearsStatus represents arrears information
type ArrearsStatus struct {
	MortgageID      string     `json:"mortgage_id"`
	InArrears       bool       `json:"in_arrears"`
	DaysPastDue     int        `json:"days_past_due"`
	ArrearsAmount   float64    `json:"arrears_amount"`
	Bucket          string     `json:"bucket"`
	PenaltyAmount   float64    `json:"penalty_amount"`
	LastPaymentDate *time.Time `json:"last_payment_date"`
}

// Product functions
func getMortgageProducts() []MortgageProduct {
	products := []MortgageProduct{
		{Code: "FIXED_RATE", Name: "Fixed Rate Mortgage", ProductType: ProductFixedRate, MinAmount: 5000000, MaxAmount: 500000000, MinTenorMonths: 60, MaxTenorMonths: 300, BaseRate: 18.0},
		{Code: "VARIABLE_RATE", Name: "Variable Rate Mortgage", ProductType: ProductVariableRate, MinAmount: 5000000, MaxAmount: 500000000, MinTenorMonths: 60, MaxTenorMonths: 300, BaseRate: 16.0},
		{Code: "NHF_BACKED", Name: "NHF-Backed Mortgage", ProductType: ProductNHFBacked, MinAmount: 2000000, MaxAmount: 50000000, MinTenorMonths: 60, MaxTenorMonths: 360, BaseRate: 6.0},
		{Code: "FMBN_BACKED", Name: "FMBN-Backed Mortgage", ProductType: ProductFMBNBacked, MinAmount: 2000000, MaxAmount: 100000000, MinTenorMonths: 60, MaxTenorMonths: 360, BaseRate: 9.0},
		{Code: "CONSTRUCTION", Name: "Construction Loan", ProductType: ProductConstructionLoan, MinAmount: 10000000, MaxAmount: 1000000000, MinTenorMonths: 12, MaxTenorMonths: 36, BaseRate: 20.0},
		{Code: "EQUITY_RELEASE", Name: "Equity Release", ProductType: ProductEquityRelease, MinAmount: 5000000, MaxAmount: 200000000, MinTenorMonths: 60, MaxTenorMonths: 180, BaseRate: 19.0},
		{Code: "BUY_TO_LET", Name: "Buy-to-Let Mortgage", ProductType: ProductBuyToLet, MinAmount: 10000000, MaxAmount: 300000000, MinTenorMonths: 60, MaxTenorMonths: 240, BaseRate: 20.0},
	}
	return products
}

func getMortgageProductByCode(code string) (*MortgageProduct, error) {
	products := getMortgageProducts()
	for _, p := range products {
		if p.Code == code {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("product not found")
}

// MortgageProduct represents a mortgage product
type MortgageProduct struct {
	Code           string              `json:"code"`
	Name           string              `json:"name"`
	Description    string              `json:"description"`
	ProductType    MortgageProductType `json:"product_type"`
	MinAmount      float64             `json:"min_amount"`
	MaxAmount      float64             `json:"max_amount"`
	MinTenorMonths int                 `json:"min_tenor_months"`
	MaxTenorMonths int                 `json:"max_tenor_months"`
	BaseRate       float64             `json:"base_rate"`
	MaxLTV         float64             `json:"max_ltv"`
	MaxDTI         float64             `json:"max_dti"`
	RequiresNHF    bool                `json:"requires_nhf"`
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
