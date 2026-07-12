package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	universitieslist "github.com/afrong/54link-education-service/utils/universities-list"
	_ "github.com/lib/pq"
)

// Database initialization
func initDatabase() *sql.DB {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = ""
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		return nil
	}

	if err := db.Ping(); err != nil {
		log.Printf("Warning: Failed to ping database: %v", err)
		return nil
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Initialize tables
	initTables(db)

	log.Println("Database connected successfully")
	return db
}

func initTables(db *sql.DB) {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS education_loan_applications (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			application_number VARCHAR(50) UNIQUE NOT NULL,
			status VARCHAR(50) NOT NULL,
			loan_type VARCHAR(50) NOT NULL,
			student_id VARCHAR(50) NOT NULL,
			student_name VARCHAR(255) NOT NULL,
			student_bvn VARCHAR(20),
			student_nin VARCHAR(20),
			student_email VARCHAR(255),
			student_phone VARCHAR(20),
			date_of_birth TIMESTAMP,
			gender VARCHAR(20),
			state_of_origin VARCHAR(100),
			lga VARCHAR(100),
			institution_id VARCHAR(50),
			institution_data JSONB,
			program_name VARCHAR(255),
			program_duration INT,
			current_year INT,
			expected_graduation TIMESTAMP,
			admission_number VARCHAR(100),
			admission_letter_id VARCHAR(100),
			tuition_fee_per_year DECIMAL(15,2),
			accommodation_per_year DECIMAL(15,2),
			books_and_materials DECIMAL(15,2),
			living_expenses DECIMAL(15,2),
			total_cost_per_year DECIMAL(15,2),
			requested_amount DECIMAL(15,2),
			approved_amount DECIMAL(15,2),
			disbursed_amount DECIMAL(15,2),
			outstanding_balance DECIMAL(15,2),
			interest_rate DECIMAL(5,2),
			repayment_type VARCHAR(50),
			moratorium_months INT,
			repayment_tenor_months INT,
			monthly_payment DECIMAL(15,2),
			principal_account_id VARCHAR(100),
			interest_account_id VARCHAR(100),
			disbursement_account_id VARCHAR(100),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			submitted_at TIMESTAMP,
			approved_at TIMESTAMP,
			first_disbursement_at TIMESTAMP,
			moratorium_end_date TIMESTAMP,
			repayment_start_date TIMESTAMP,
			maturity_date TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_guarantors (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			name VARCHAR(255) NOT NULL,
			relationship VARCHAR(100),
			bvn VARCHAR(20),
			nin VARCHAR(20),
			phone VARCHAR(20),
			email VARCHAR(255),
			employer_name VARCHAR(255),
			employer_address TEXT,
			monthly_income DECIMAL(15,2),
			employment_duration INT,
			guarantee_amount DECIMAL(15,2),
			verification_status VARCHAR(50),
			verified_at TIMESTAMP,
			consent_given BOOLEAN DEFAULT FALSE,
			consent_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_disbursements (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			semester VARCHAR(100),
			academic_year VARCHAR(20),
			scheduled_date TIMESTAMP,
			disbursed_date TIMESTAMP,
			tuition_amount DECIMAL(15,2),
			accommodation_amount DECIMAL(15,2),
			other_amount DECIMAL(15,2),
			total_amount DECIMAL(15,2),
			status VARCHAR(50),
			institution_account_id VARCHAR(100),
			student_account_id VARCHAR(100),
			transaction_reference VARCHAR(100),
			ledger_transaction_id VARCHAR(100),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_payments (
			id VARCHAR(50) PRIMARY KEY,
			loan_id VARCHAR(50) REFERENCES education_loan_applications(id),
			tenant_id VARCHAR(50),
			payment_number INT,
			due_date TIMESTAMP,
			paid_date TIMESTAMP,
			principal_amount DECIMAL(15,2),
			interest_amount DECIMAL(15,2),
			total_amount DECIMAL(15,2),
			paid_amount DECIMAL(15,2),
			status VARCHAR(50),
			payment_method VARCHAR(50),
			payment_reference VARCHAR(100),
			ledger_transaction_id VARCHAR(100),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_academic_progress (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			semester VARCHAR(100),
			academic_year VARCHAR(20),
			gpa DECIMAL(3,2),
			cgpa DECIMAL(3,2),
			credits_completed INT,
			credits_required INT,
			enrollment_status VARCHAR(50),
			verified_by VARCHAR(100),
			verified_at TIMESTAMP,
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_institutions (
			id VARCHAR(50) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(50),
			nuc_accredited BOOLEAN DEFAULT FALSE,
			accreditation_number VARCHAR(100),
			country VARCHAR(100),
			state VARCHAR(100),
			city VARCHAR(100),
			address TEXT,
			bank_account_number VARCHAR(50),
			bank_name VARCHAR(100),
			bank_code VARCHAR(20),
			contact_person VARCHAR(255),
			contact_email VARCHAR(255),
			contact_phone VARCHAR(20),
			verification_status VARCHAR(50),
			verified_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_underwriting_decisions (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			decision VARCHAR(50),
			approved_amount DECIMAL(15,2),
			interest_rate DECIMAL(5,2),
			moratorium_months INT,
			repayment_tenor_months INT,
			monthly_payment DECIMAL(15,2),
			risk_score DECIMAL(5,4),
			risk_tier VARCHAR(50),
			decision_reasons JSONB,
			conditions JSONB,
			decision_date TIMESTAMP,
			valid_until TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_deferments (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			deferment_type VARCHAR(50),
			duration_months INT,
			reason TEXT,
			supporting_doc_id VARCHAR(100),
			status VARCHAR(50),
			approved_by VARCHAR(100),
			approved_at TIMESTAMP,
			start_date TIMESTAMP,
			end_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_moratorium_extensions (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50) REFERENCES education_loan_applications(id),
			additional_months INT,
			reason TEXT,
			approved_by VARCHAR(100),
			old_moratorium_end TIMESTAMP,
			new_moratorium_end TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS education_loan_audit_trail (
			id VARCHAR(50) PRIMARY KEY,
			application_id VARCHAR(50),
			tenant_id VARCHAR(50),
			action VARCHAR(100),
			user_id VARCHAR(100),
			old_value JSONB,
			new_value JSONB,
			ip_address VARCHAR(50),
			user_agent TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,

		// Indexes
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_apps_tenant ON education_loan_applications(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_apps_status ON education_loan_applications(status)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_apps_student ON education_loan_applications(student_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_guarantors_app ON education_loan_guarantors(application_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_disbursements_app ON education_loan_disbursements(application_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_payments_loan ON education_loan_payments(loan_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edu_loan_academic_app ON education_loan_academic_progress(application_id)`,
	}

	for _, table := range tables {
		if _, err := db.Exec(table); err != nil {
			log.Printf("Warning: Failed to create table: %v", err)
		}
	}

	log.Println("Database tables initialized")
}

// Application CRUD operations
func saveEducationLoanApplication(app *EducationLoanApplication) error {
	if db == nil {
		return nil
	}

	institutionJSON, _ := json.Marshal(app.Institution)

	query := `
		INSERT INTO education_loan_applications (
			id, tenant_id, application_number, status, loan_type,
			student_id, student_name, student_bvn, student_nin, student_email, student_phone,
			date_of_birth, gender, state_of_origin, lga,
			institution_id, institution_data, program_name, program_duration, current_year,
			expected_graduation, admission_number, admission_letter_id,
			tuition_fee_per_year, accommodation_per_year, books_and_materials, living_expenses,
			total_cost_per_year, requested_amount, approved_amount, disbursed_amount, outstanding_balance,
			interest_rate, repayment_type, moratorium_months, repayment_tenor_months, monthly_payment,
			principal_account_id, interest_account_id, disbursement_account_id,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
			$33, $34, $35, $36, $37, $38, $39, $40, $41, $42
		)
	`

	_, err := db.Exec(query,
		app.ID, app.TenantID, app.ApplicationNumber, app.Status, app.LoanType,
		app.StudentID, app.StudentName, app.StudentBVN, app.StudentNIN, app.StudentEmail, app.StudentPhone,
		app.DateOfBirth, app.Gender, app.StateOfOrigin, app.LGA,
		app.Institution.ID, institutionJSON, app.ProgramName, app.ProgramDuration, app.CurrentYear,
		app.ExpectedGraduation, app.AdmissionNumber, app.AdmissionLetterID,
		app.TuitionFeePerYear, app.AccommodationPerYear, app.BooksAndMaterials, app.LivingExpenses,
		app.TotalCostPerYear, app.RequestedAmount, app.ApprovedAmount, app.DisbursedAmount, app.OutstandingBalance,
		app.InterestRate, app.RepaymentType, app.MoratoriumMonths, app.RepaymentTenorMonths, app.MonthlyPayment,
		app.PrincipalAccountID, app.InterestAccountID, app.DisbursementAccountID,
		app.CreatedAt, app.UpdatedAt,
	)

	return err
}

func fetchEducationLoanApplication(id, tenantID string) (*EducationLoanApplication, error) {
	if db == nil {
		return &EducationLoanApplication{ID: id, TenantID: tenantID}, nil
	}

	app := &EducationLoanApplication{}
	var institutionJSON []byte

	query := `
		SELECT id, tenant_id, application_number, status, loan_type,
			student_id, student_name, student_bvn, student_nin, student_email, student_phone,
			institution_data, program_name, program_duration, current_year,
			admission_number, tuition_fee_per_year, accommodation_per_year,
			requested_amount, approved_amount, disbursed_amount, outstanding_balance,
			interest_rate, repayment_type, moratorium_months, repayment_tenor_months, monthly_payment,
			principal_account_id, interest_account_id, disbursement_account_id,
			created_at, updated_at, submitted_at, approved_at, first_disbursement_at,
			moratorium_end_date, repayment_start_date, maturity_date
		FROM education_loan_applications
		WHERE id = $1 AND tenant_id = $2
	`

	err := db.QueryRow(query, id, tenantID).Scan(
		&app.ID, &app.TenantID, &app.ApplicationNumber, &app.Status, &app.LoanType,
		&app.StudentID, &app.StudentName, &app.StudentBVN, &app.StudentNIN, &app.StudentEmail, &app.StudentPhone,
		&institutionJSON, &app.ProgramName, &app.ProgramDuration, &app.CurrentYear,
		&app.AdmissionNumber, &app.TuitionFeePerYear, &app.AccommodationPerYear,
		&app.RequestedAmount, &app.ApprovedAmount, &app.DisbursedAmount, &app.OutstandingBalance,
		&app.InterestRate, &app.RepaymentType, &app.MoratoriumMonths, &app.RepaymentTenorMonths, &app.MonthlyPayment,
		&app.PrincipalAccountID, &app.InterestAccountID, &app.DisbursementAccountID,
		&app.CreatedAt, &app.UpdatedAt, &app.SubmittedAt, &app.ApprovedAt, &app.FirstDisbursementAt,
		&app.MoratoriumEndDate, &app.RepaymentStartDate, &app.MaturityDate,
	)

	if err != nil {
		return nil, err
	}

	json.Unmarshal(institutionJSON, &app.Institution)

	// Fetch guarantors
	app.Guarantors = fetchGuarantors(app.ID)

	// Fetch disbursement schedule
	app.DisbursementSchedule = fetchDisbursementSchedule(app.ID)

	return app, nil
}

func fetchEducationLoanApplications(tenantID, status, loanType string, limit, offset int) ([]*EducationLoanApplication, error) {
	if db == nil {
		return []*EducationLoanApplication{}, nil
	}

	query := `
		SELECT id, tenant_id, application_number, status, loan_type,
			student_id, student_name, requested_amount, approved_amount, created_at,
			institution_data, program_name
		FROM education_loan_applications
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}
	argCount := 1

	if status != "" {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, status)
	}

	if loanType != "" {
		argCount++
		query += fmt.Sprintf(" AND loan_type = $%d", argCount)
		args = append(args, loanType)
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []*EducationLoanApplication
	for rows.Next() {
		app := &EducationLoanApplication{}
		var institutionJSON []byte
		err := rows.Scan(
			&app.ID, &app.TenantID, &app.ApplicationNumber, &app.Status, &app.LoanType,
			&app.StudentID, &app.StudentName, &app.RequestedAmount, &app.ApprovedAmount, &app.CreatedAt,
			&institutionJSON, &app.ProgramName,
		)
		if err != nil {
			continue
		}
		json.Unmarshal(institutionJSON, &app.Institution)
		apps = append(apps, app)
	}

	return apps, nil
}

func updateEducationLoanStatus(id, tenantID string, status EducationLoanStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE education_loan_applications SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`
	_, err := db.Exec(query, status, time.Now(), id, tenantID)
	return err
}

func updateEducationLoanApplicationFields(id, tenantID string, updates map[string]interface{}) error {
	if db == nil {
		return nil
	}
	// Implementation would dynamically build UPDATE query
	return nil
}

// Guarantor operations
func saveGuarantor(g *Guarantor) error {
	if db == nil {
		return nil
	}

	query := `
		INSERT INTO education_loan_guarantors (
			id, application_id, name, relationship, bvn, nin, phone, email,
			employer_name, employer_address, monthly_income, employment_duration,
			guarantee_amount, verification_status, consent_given
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := db.Exec(query,
		g.ID, g.ApplicationID, g.Name, g.Relationship, g.BVN, g.NIN, g.Phone, g.Email,
		g.EmployerName, g.EmployerAddress, g.MonthlyIncome, g.EmploymentDuration,
		g.GuaranteeAmount, g.VerificationStatus, g.ConsentGiven,
	)

	return err
}

func nucInstitutionVerification2(instName string) (bool, string) {
	// Load NUC accredited institutions from JSON file
	data, err := universitieslist.LoadFromJSON("data/nigerian-universities.json")
	if err != nil {
		log.Printf("Error loading NUC data: %v", err)
		return false, ""
	}

	if len(data) == 0 {
		log.Printf("No NUC institution data available")
		return false, ""
	}

	if instName == "" {
		return false, ""
	}

	// Normalize search term
	searchTerm := strings.ToLower(strings.TrimSpace(instName))
	if searchTerm == "" {
		return false, ""
	}

	var matched []universitieslist.University
	var exactMatch *universitieslist.University

	// Search for matching institutions
	for _, inst := range data {
		instNameLower := strings.ToLower(strings.TrimSpace(inst.Name))

		// Check for exact match
		if instNameLower == searchTerm {
			exactMatch = &inst
			break
		}

		// Check for partial match
		if strings.Contains(instNameLower, searchTerm) || strings.Contains(searchTerm, instNameLower) {
			matched = append(matched, inst)
		}
	}

	// Return exact match if found
	if exactMatch != nil {
		return true, exactMatch.Name
	}

	// Return first partial match if found
	if len(matched) > 0 {
		return true, matched[0].Name
	}

	// No match found
	return false, ""
}

func fetchGuarantor(id string) *Guarantor {
	if db == nil {
		return nil
	}

	g := &Guarantor{}
	query := `SELECT id, application_id, name, relationship, bvn, nin, phone, email,
		employer_name, monthly_income, guarantee_amount, verification_status
		FROM education_loan_guarantors WHERE id = $1`

	err := db.QueryRow(query, id).Scan(
		&g.ID, &g.ApplicationID, &g.Name, &g.Relationship, &g.BVN, &g.NIN, &g.Phone, &g.Email,
		&g.EmployerName, &g.MonthlyIncome, &g.GuaranteeAmount, &g.VerificationStatus,
	)

	if err != nil {
		return nil
	}
	return g
}

func fetchGuarantors(applicationID string) []Guarantor {
	if db == nil {
		return []Guarantor{}
	}

	query := `SELECT id, application_id, name, relationship, bvn, nin, phone, email,
		employer_name, monthly_income, guarantee_amount, verification_status, verified_at
		FROM education_loan_guarantors WHERE application_id = $1`

	rows, err := db.Query(query, applicationID)
	if err != nil {
		return []Guarantor{}
	}
	defer rows.Close()

	var guarantors []Guarantor
	for rows.Next() {
		g := Guarantor{}
		rows.Scan(
			&g.ID, &g.ApplicationID, &g.Name, &g.Relationship, &g.BVN, &g.NIN, &g.Phone, &g.Email,
			&g.EmployerName, &g.MonthlyIncome, &g.GuaranteeAmount, &g.VerificationStatus, &g.VerifiedAt,
		)
		guarantors = append(guarantors, g)
	}

	return guarantors
}

func updateGuarantorStatus(id, status string) error {
	if db == nil {
		return nil
	}

	query := `UPDATE education_loan_guarantors SET verification_status = $1, verified_at = $2 WHERE id = $3`
	_, err := db.Exec(query, status, time.Now(), id)
	return err
}

func deleteGuarantor(id string) error {
	if db == nil {
		return nil
	}

	query := `DELETE FROM education_loan_guarantors WHERE id = $1`
	_, err := db.Exec(query, id)
	return err
}

// Disbursement operations
func fetchDisbursementSchedule(applicationID string) []DisbursementEntry {
	if db == nil {
		return []DisbursementEntry{}
	}

	query := `SELECT id, application_id, semester, academic_year, scheduled_date, disbursed_date,
		tuition_amount, accommodation_amount, other_amount, total_amount, status,
		institution_account_id, student_account_id, transaction_reference, ledger_transaction_id
		FROM education_loan_disbursements WHERE application_id = $1 ORDER BY scheduled_date`

	rows, err := db.Query(query, applicationID)
	if err != nil {
		return []DisbursementEntry{}
	}
	defer rows.Close()

	var schedule []DisbursementEntry
	for rows.Next() {
		d := DisbursementEntry{}
		rows.Scan(
			&d.ID, &d.ApplicationID, &d.Semester, &d.AcademicYear, &d.ScheduledDate, &d.DisbursedDate,
			&d.TuitionAmount, &d.AccommodationAmount, &d.OtherAmount, &d.TotalAmount, &d.Status,
			&d.InstitutionAccountID, &d.StudentAccountID, &d.TransactionReference, &d.LedgerTransactionID,
		)
		schedule = append(schedule, d)
	}

	return schedule
}

func saveDisbursementDetails(app *EducationLoanApplication, disbursement *DisbursementEntry) error {
	if db == nil {
		return nil
	}

	// Update disbursement record
	query := `UPDATE education_loan_disbursements 
		SET status = $1, disbursed_date = $2, ledger_transaction_id = $3
		WHERE id = $4`
	db.Exec(query, disbursement.Status, disbursement.DisbursedDate, disbursement.LedgerTransactionID, disbursement.ID)

	// Update application
	query = `UPDATE education_loan_applications 
		SET disbursed_amount = $1, status = $2, first_disbursement_at = $3,
		moratorium_end_date = $4, repayment_start_date = $5, maturity_date = $6, updated_at = $7
		WHERE id = $8`
	_, err := db.Exec(query,
		app.DisbursedAmount, app.Status, app.FirstDisbursementAt,
		app.MoratoriumEndDate, app.RepaymentStartDate, app.MaturityDate, time.Now(), app.ID,
	)

	return err
}

// Payment operations
func savePayment(payment *EducationLoanPayment) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO education_loan_payments (
		id, loan_id, tenant_id, payment_number, due_date, paid_date,
		principal_amount, interest_amount, total_amount, paid_amount,
		status, payment_method, payment_reference, ledger_transaction_id
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`

	_, err := db.Exec(query,
		payment.ID, payment.LoanID, payment.TenantID, payment.PaymentNumber, payment.DueDate, payment.PaidDate,
		payment.PrincipalAmount, payment.InterestAmount, payment.TotalAmount, payment.PaidAmount,
		payment.Status, payment.PaymentMethod, payment.PaymentReference, payment.LedgerTransactionID,
	)

	return err
}

func fetchPaymentHistory(loanID string) ([]EducationLoanPayment, error) {
	if db == nil {
		return []EducationLoanPayment{}, nil
	}

	query := `SELECT id, loan_id, tenant_id, payment_number, due_date, paid_date,
		principal_amount, interest_amount, total_amount, paid_amount,
		status, payment_method, payment_reference
		FROM education_loan_payments WHERE loan_id = $1 ORDER BY paid_date DESC`

	rows, err := db.Query(query, loanID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []EducationLoanPayment
	for rows.Next() {
		p := EducationLoanPayment{}
		rows.Scan(
			&p.ID, &p.LoanID, &p.TenantID, &p.PaymentNumber, &p.DueDate, &p.PaidDate,
			&p.PrincipalAmount, &p.InterestAmount, &p.TotalAmount, &p.PaidAmount,
			&p.Status, &p.PaymentMethod, &p.PaymentReference,
		)
		payments = append(payments, p)
	}

	return payments, nil
}

// Academic progress operations
func saveAcademicProgress(progress *AcademicProgress) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO education_loan_academic_progress (
		id, application_id, semester, academic_year, gpa, cgpa,
		credits_completed, credits_required, enrollment_status, verified_by, verified_at, notes
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := db.Exec(query,
		progress.ID, progress.ApplicationID, progress.Semester, progress.AcademicYear,
		progress.GPA, progress.CGPA, progress.CreditsCompleted, progress.CreditsRequired,
		progress.EnrollmentStatus, progress.VerifiedBy, progress.VerifiedAt, progress.Notes,
	)

	return err
}

func fetchAcademicProgress(applicationID string) ([]AcademicProgress, error) {
	if db == nil {
		return []AcademicProgress{}, nil
	}

	query := `SELECT id, application_id, semester, academic_year, gpa, cgpa,
		credits_completed, enrollment_status, verified_by, verified_at
		FROM education_loan_academic_progress WHERE application_id = $1 ORDER BY verified_at DESC`

	rows, err := db.Query(query, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var progress []AcademicProgress
	for rows.Next() {
		p := AcademicProgress{}
		rows.Scan(
			&p.ID, &p.ApplicationID, &p.Semester, &p.AcademicYear, &p.GPA, &p.CGPA,
			&p.CreditsCompleted, &p.EnrollmentStatus, &p.VerifiedBy, &p.VerifiedAt,
		)
		progress = append(progress, p)
	}

	return progress, nil
}

// Institution operations
func saveInstitution(inst *InstitutionDetails) error {
	if db == nil {
		return fmt.Errorf("database connection not available")
	}

	query := `INSERT INTO education_loan_institutions (
		id, name, type, nuc_accredited, accreditation_number, country, state, city, address,
		bank_account_number, bank_name, bank_code, contact_person, contact_email, contact_phone,
		verification_status
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`

	_, err := db.Exec(query,
		inst.ID, inst.Name, inst.Type, inst.NUCAccredited, inst.AccreditationNumber,
		inst.Country, inst.State, inst.City, inst.Address,
		inst.BankAccountNumber, inst.BankName, inst.BankCode,
		inst.ContactPerson, inst.ContactEmail, inst.ContactPhone, inst.VerificationStatus,
	)

	return err
}

func fetchInstitution(id string) *InstitutionDetails {
	if db == nil {
		return &InstitutionDetails{ID: id}
	}

	inst := &InstitutionDetails{}
	query := `SELECT id, name, type, nuc_accredited, accreditation_number, country, state, city,
		bank_account_number, bank_name, bank_code, contact_person, contact_email, contact_phone,
		verification_status
		FROM education_loan_institutions WHERE id = $1`

	err := db.QueryRow(query, id).Scan(
		&inst.ID, &inst.Name, &inst.Type, &inst.NUCAccredited, &inst.AccreditationNumber,
		&inst.Country, &inst.State, &inst.City,
		&inst.BankAccountNumber, &inst.BankName, &inst.BankCode,
		&inst.ContactPerson, &inst.ContactEmail, &inst.ContactPhone, &inst.VerificationStatus,
	)

	if err != nil {
		return nil
	}
	return inst
}

func fetchInstitutions(instType, state string) []InstitutionDetails {
	if db == nil {
		return []InstitutionDetails{}
	}

	query := `SELECT id, name, type, nuc_accredited, state, city FROM education_loan_institutions WHERE 1=1`
	args := []interface{}{}
	argCount := 0

	if instType != "" {
		argCount++
		query += fmt.Sprintf(" AND type = $%d", argCount)
		args = append(args, instType)
	}

	if state != "" {
		argCount++
		query += fmt.Sprintf(" AND state = $%d", argCount)
		args = append(args, state)
	}

	query += " ORDER BY name"

	rows, err := db.Query(query, args...)
	if err != nil {
		return []InstitutionDetails{}
	}
	defer rows.Close()

	var institutions []InstitutionDetails
	for rows.Next() {
		inst := InstitutionDetails{}
		rows.Scan(&inst.ID, &inst.Name, &inst.Type, &inst.NUCAccredited, &inst.State, &inst.City)
		institutions = append(institutions, inst)
	}

	return institutions
}

// Underwriting and approval operations
func saveUnderwritingResults(app *EducationLoanApplication, decision *UnderwritingDecision) error {
	if db == nil {
		return nil
	}

	reasonsJSON, _ := json.Marshal(decision.DecisionReasons)
	conditionsJSON, _ := json.Marshal(decision.Conditions)

	query := `INSERT INTO education_loan_underwriting_decisions (
		id, application_id, decision, approved_amount, interest_rate,
		moratorium_months, repayment_tenor_months, monthly_payment,
		risk_score, risk_tier, decision_reasons, conditions, decision_date, valid_until
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`

	_, err := db.Exec(query,
		generateID("UND"), app.ID, decision.Decision, decision.ApprovedAmount, decision.InterestRate,
		decision.MoratoriumMonths, decision.RepaymentTenorMonths, decision.MonthlyPayment,
		decision.RiskScore, decision.RiskTier, reasonsJSON, conditionsJSON,
		decision.DecisionDate, decision.ValidUntil,
	)

	// Update application
	updateQuery := `UPDATE education_loan_applications 
		SET approved_amount = $1, interest_rate = $2, moratorium_months = $3,
		repayment_tenor_months = $4, monthly_payment = $5, updated_at = $6
		WHERE id = $7`
	db.Exec(updateQuery,
		decision.ApprovedAmount, decision.InterestRate, decision.MoratoriumMonths,
		decision.RepaymentTenorMonths, decision.MonthlyPayment, time.Now(), app.ID,
	)

	return err
}

func saveApprovalDetails(app *EducationLoanApplication, approvedBy string, conditions []string, notes string) error {
	if db == nil {
		return nil
	}

	// Save disbursement schedule
	for _, d := range app.DisbursementSchedule {
		query := `INSERT INTO education_loan_disbursements (
			id, application_id, semester, academic_year, scheduled_date,
			tuition_amount, accommodation_amount, other_amount, total_amount, status,
			institution_account_id, student_account_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

		db.Exec(query,
			d.ID, app.ID, d.Semester, d.AcademicYear, d.ScheduledDate,
			d.TuitionAmount, d.AccommodationAmount, d.OtherAmount, d.TotalAmount, d.Status,
			d.InstitutionAccountID, d.StudentAccountID,
		)
	}

	// Update application status
	query := `UPDATE education_loan_applications 
		SET status = $1, approved_at = $2, updated_at = $3
		WHERE id = $4`
	_, err := db.Exec(query, StatusApproved, time.Now(), time.Now(), app.ID)

	return err
}

// Deferment and moratorium operations
func saveDefermentRequest(applicationID, defermentID, defermentType string, durationMonths int, reason string) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO education_loan_deferments (
		id, application_id, deferment_type, duration_months, reason, status
	) VALUES ($1, $2, $3, $4, $5, 'pending')`

	_, err := db.Exec(query, defermentID, applicationID, defermentType, durationMonths, reason)
	return err
}

func saveMoratoriumExtension(app *EducationLoanApplication, additionalMonths int, reason, approvedBy string) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO education_loan_moratorium_extensions (
		id, application_id, additional_months, reason, approved_by,
		old_moratorium_end, new_moratorium_end
	) VALUES ($1, $2, $3, $4, $5, $6, $7)`

	oldEnd := app.MoratoriumEndDate.AddDate(0, -additionalMonths, 0)
	db.Exec(query,
		generateID("MOR"), app.ID, additionalMonths, reason, approvedBy,
		oldEnd, app.MoratoriumEndDate,
	)

	// Update application
	updateQuery := `UPDATE education_loan_applications 
		SET moratorium_months = $1, moratorium_end_date = $2, repayment_start_date = $3, maturity_date = $4, updated_at = $5
		WHERE id = $6`
	_, err := db.Exec(updateQuery,
		app.MoratoriumMonths, app.MoratoriumEndDate, app.RepaymentStartDate, app.MaturityDate, time.Now(), app.ID,
	)

	return err
}

// Product operations
func getEducationLoanProductList() []*EducationLoanProductConfig {
	return engine.GetAllProducts()
}

func getEducationLoanProductByCode(code string) (*EducationLoanProductConfig, error) {
	for _, p := range engine.GetAllProducts() {
		if p.Code == code {
			return p, nil
		}
	}
	return nil, fmt.Errorf("product not found")
}

// Helper functions for verification (simulated)
type VerificationResult struct {
	Verified    bool
	Message     string
	StudentName string
	Program     string
}

func verifyInstitutionWithNUC(accreditationNumber string) *VerificationResult {
	// Simulated NUC verification
	return &VerificationResult{
		Verified: true,
		Message:  "Institution verified with NUC",
	}
}

func verifyAdmissionWithInstitution(institutionID, admissionNumber string) *VerificationResult {
	// Simulated admission verification
	return &VerificationResult{
		Verified:    true,
		Message:     "Admission verified",
		StudentName: "Student Name",
		Program:     "Computer Science",
	}
}

func verifyGuarantorDetails(guarantor *Guarantor) *VerificationResult {
	// Simulated guarantor verification
	return &VerificationResult{
		Verified: true,
		Message:  "Guarantor verified",
	}
}

func validateApplicationForSubmission(app *EducationLoanApplication) error {
	if app.StudentName == "" {
		return fmt.Errorf("student name is required")
	}
	if app.RequestedAmount <= 0 {
		return fmt.Errorf("requested amount must be positive")
	}
	if app.Institution.ID == "" {
		return fmt.Errorf("institution is required")
	}
	return nil
}

func generateDisbursementSchedule(app *EducationLoanApplication) []DisbursementEntry {
	var schedule []DisbursementEntry

	remainingYears := app.ProgramDuration - app.CurrentYear + 1
	// amountPerYear := app.ApprovedAmount / float64(remainingYears)
	tuitionPerSemester := app.TuitionFeePerYear / 2
	accommodationPerSemester := app.AccommodationPerYear / 2

	currentDate := time.Now()
	for year := 0; year < remainingYears; year++ {
		academicYear := fmt.Sprintf("%d/%d", currentDate.Year()+year, currentDate.Year()+year+1)

		// First semester
		schedule = append(schedule, DisbursementEntry{
			ID:                   generateID("DIS"),
			ApplicationID:        app.ID,
			Semester:             "First Semester",
			AcademicYear:         academicYear,
			ScheduledDate:        time.Date(currentDate.Year()+year, 9, 1, 0, 0, 0, 0, time.UTC),
			TuitionAmount:        tuitionPerSemester,
			AccommodationAmount:  accommodationPerSemester,
			TotalAmount:          tuitionPerSemester + accommodationPerSemester,
			Status:               "scheduled",
			InstitutionAccountID: app.Institution.BankAccountNumber,
		})

		// Second semester
		schedule = append(schedule, DisbursementEntry{
			ID:                   generateID("DIS"),
			ApplicationID:        app.ID,
			Semester:             "Second Semester",
			AcademicYear:         academicYear,
			ScheduledDate:        time.Date(currentDate.Year()+year+1, 1, 15, 0, 0, 0, 0, time.UTC),
			TuitionAmount:        tuitionPerSemester,
			AccommodationAmount:  accommodationPerSemester,
			TotalAmount:          tuitionPerSemester + accommodationPerSemester,
			Status:               "scheduled",
			InstitutionAccountID: app.Institution.BankAccountNumber,
		})
	}

	return schedule
}

func generateRepaymentSchedule(app *EducationLoanApplication) []map[string]interface{} {
	var schedule []map[string]interface{}

	if app.RepaymentStartDate == nil || app.RepaymentTenorMonths == 0 {
		return schedule
	}

	balance := app.ApprovedAmount
	monthlyRate := app.InterestRate / 12.0 / 100.0
	payment := app.MonthlyPayment

	currentDate := *app.RepaymentStartDate
	for i := 1; i <= app.RepaymentTenorMonths && balance > 0; i++ {
		interest := balance * monthlyRate
		principal := payment - interest
		if principal > balance {
			principal = balance
		}
		balance -= principal

		schedule = append(schedule, map[string]interface{}{
			"payment_number":    i,
			"due_date":          currentDate,
			"principal_amount":  principal,
			"interest_amount":   interest,
			"total_amount":      principal + interest,
			"remaining_balance": balance,
		})

		currentDate = currentDate.AddDate(0, 1, 0)
	}

	return schedule
}

func generateEducationLoanOffer(app *EducationLoanApplication) map[string]interface{} {
	return map[string]interface{}{
		"offer_id":              generateID("OFF"),
		"application_id":        app.ID,
		"student_name":          app.StudentName,
		"institution":           app.Institution.Name,
		"program":               app.ProgramName,
		"approved_amount":       app.ApprovedAmount,
		"interest_rate":         app.InterestRate,
		"moratorium_months":     app.MoratoriumMonths,
		"repayment_tenor":       app.RepaymentTenorMonths,
		"monthly_payment":       app.MonthlyPayment,
		"total_repayment":       app.MonthlyPayment * float64(app.RepaymentTenorMonths),
		"disbursement_schedule": app.DisbursementSchedule,
		"conditions": []string{
			"Maintain satisfactory academic progress",
			"Remain enrolled as full-time student",
			"Provide semester transcripts",
		},
		"valid_until":  time.Now().AddDate(0, 0, 30),
		"generated_at": time.Now(),
	}
}
