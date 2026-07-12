package main

import (
	"database/sql"
	"log"
	"os"
	"time"

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
		`CREATE TABLE IF NOT EXISTS murabaha_products (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(50) NOT NULL,
			asset_name VARCHAR(255) NOT NULL,
			cost_price DECIMAL(15,2) NOT NULL,
			selling_price DECIMAL(15,2) NOT NULL,
			profit_margin DECIMAL(5,2) NOT NULL,
			tenure_months INT NOT NULL,
			monthly_installment DECIMAL(15,2) NOT NULL,
			status VARCHAR(50) NOT NULL,
			reference_number VARCHAR(100) UNIQUE NOT NULL,
			application_date TIMESTAMP NOT NULL,
			approval_date TIMESTAMP,
			completion_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS musharaka_products (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(50) NOT NULL,
			business_name VARCHAR(255) NOT NULL,
			bank_contribution DECIMAL(15,2) NOT NULL,
			customer_contribution DECIMAL(15,2) NOT NULL,
			total_capital DECIMAL(15,2) NOT NULL,
			bank_profit_share DECIMAL(5,2) NOT NULL,
			customer_profit_share DECIMAL(5,2) NOT NULL,
			status VARCHAR(50) NOT NULL,
			reference_number VARCHAR(100) UNIQUE NOT NULL,
			application_date TIMESTAMP NOT NULL,
			approval_date TIMESTAMP,
			partnership_end_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS ijara_products (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(50) NOT NULL,
			asset_name VARCHAR(255) NOT NULL,
			asset_value DECIMAL(15,2) NOT NULL,
			monthly_rental DECIMAL(15,2) NOT NULL,
			tenure_months INT NOT NULL,
			lease_type VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL,
			reference_number VARCHAR(100) UNIQUE NOT NULL,
			application_date TIMESTAMP NOT NULL,
			approval_date TIMESTAMP,
			lease_start_date TIMESTAMP,
			lease_end_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS takaful_products (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(50) NOT NULL,
			policy_type VARCHAR(50) NOT NULL,
			policy_name VARCHAR(255) NOT NULL,
			contribution_amount DECIMAL(15,2) NOT NULL,
			coverage_amount DECIMAL(15,2) NOT NULL,
			frequency VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL,
			reference_number VARCHAR(100) UNIQUE NOT NULL,
			application_date TIMESTAMP NOT NULL,
			approval_date TIMESTAMP,
			policy_start_date TIMESTAMP,
			policy_end_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS sukuk_products (
			id VARCHAR(50) PRIMARY KEY,
			tenant_id VARCHAR(50) NOT NULL,
			user_id VARCHAR(50) NOT NULL,
			sukuk_type VARCHAR(50) NOT NULL,
			sukuk_name VARCHAR(255) NOT NULL,
			investment_amount DECIMAL(15,2) NOT NULL,
			expected_return DECIMAL(5,2) NOT NULL,
			tenure_months INT NOT NULL,
			status VARCHAR(50) NOT NULL,
			reference_number VARCHAR(100) UNIQUE NOT NULL,
			application_date TIMESTAMP NOT NULL,
			approval_date TIMESTAMP,
			maturity_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP
		)`,
	}

	for _, query := range tables {
		if _, err := db.Exec(query); err != nil {
			log.Printf("Error creating table: %v", err)
		}
	}

	log.Println("Database tables initialized")
}

// ============================================================
// MURABAHA DATABASE OPERATIONS
// ============================================================

func fetchAllMurabaha(tenantID, userID string) ([]MurabahaProduct, error) {
	if db == nil {
		return []MurabahaProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, asset_name, cost_price, selling_price, profit_margin, 
			  tenure_months, monthly_installment, status, reference_number, application_date, 
			  approval_date, completion_date, created_at, updated_at 
			  FROM murabaha_products WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []MurabahaProduct
	for rows.Next() {
		var p MurabahaProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName, &p.CostPrice, &p.SellingPrice,
			&p.ProfitMargin, &p.TenureMonths, &p.MonthlyInstallment, &p.Status, &p.ReferenceNumber,
			&p.ApplicationDate, &p.ApprovalDate, &p.CompletionDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchMurabahaByID(id, tenantID, userID string) (*MurabahaProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, asset_name, cost_price, selling_price, profit_margin, 
			  tenure_months, monthly_installment, status, reference_number, application_date, 
			  approval_date, completion_date, created_at, updated_at 
			  FROM murabaha_products WHERE id = $1 AND tenant_id = $2 AND user_id = $3`

	var p MurabahaProduct
	err := db.QueryRow(query, id, tenantID, userID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName,
		&p.CostPrice, &p.SellingPrice, &p.ProfitMargin, &p.TenureMonths, &p.MonthlyInstallment,
		&p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.CompletionDate,
		&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func saveMurabaha(product *MurabahaProduct) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO murabaha_products (id, tenant_id, user_id, asset_name, cost_price, selling_price,
			  profit_margin, tenure_months, monthly_installment, status, reference_number, application_date, 
			  created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	_, err := db.Exec(query, product.ID, product.TenantID, product.UserID, product.AssetName,
		product.CostPrice, product.SellingPrice, product.ProfitMargin, product.TenureMonths,
		product.MonthlyInstallment, product.Status, product.ReferenceNumber, product.ApplicationDate,
		product.CreatedAt)

	return err
}

func updateMurabahaStatusDB(id, tenantID, userID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE murabaha_products SET status = $1, updated_at = $2 
			  WHERE id = $3 AND tenant_id = $4 AND user_id = $5`

	_, err := db.Exec(query, status, time.Now(), id, tenantID, userID)
	return err
}

// ============================================================
// MUSHARAKA DATABASE OPERATIONS
// ============================================================

func fetchAllMusharaka(tenantID, userID string) ([]MusharakaProduct, error) {
	if db == nil {
		return []MusharakaProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, business_name, bank_contribution, customer_contribution,
			  total_capital, bank_profit_share, customer_profit_share, status, reference_number,
			  application_date, approval_date, partnership_end_date, created_at, updated_at
			  FROM musharaka_products WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []MusharakaProduct
	for rows.Next() {
		var p MusharakaProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.BusinessName, &p.BankContribution,
			&p.CustomerContribution, &p.TotalCapital, &p.BankProfitShare, &p.CustomerProfitShare,
			&p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.PartnershipEndDate,
			&p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchMusharakaByID(id, tenantID, userID string) (*MusharakaProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, business_name, bank_contribution, customer_contribution,
			  total_capital, bank_profit_share, customer_profit_share, status, reference_number,
			  application_date, approval_date, partnership_end_date, created_at, updated_at
			  FROM musharaka_products WHERE id = $1 AND tenant_id = $2 AND user_id = $3`

	var p MusharakaProduct
	err := db.QueryRow(query, id, tenantID, userID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.BusinessName,
		&p.BankContribution, &p.CustomerContribution, &p.TotalCapital, &p.BankProfitShare,
		&p.CustomerProfitShare, &p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate,
		&p.PartnershipEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func saveMusharaka(product *MusharakaProduct) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO musharaka_products (id, tenant_id, user_id, business_name, bank_contribution,
			  customer_contribution, total_capital, bank_profit_share, customer_profit_share, status,
			  reference_number, application_date, created_at) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	_, err := db.Exec(query, product.ID, product.TenantID, product.UserID, product.BusinessName,
		product.BankContribution, product.CustomerContribution, product.TotalCapital,
		product.BankProfitShare, product.CustomerProfitShare, product.Status, product.ReferenceNumber,
		product.ApplicationDate, product.CreatedAt)

	return err
}

func updateMusharakaStatusDB(id, tenantID, userID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE musharaka_products SET status = $1, updated_at = $2 
			  WHERE id = $3 AND tenant_id = $4 AND user_id = $5`

	_, err := db.Exec(query, status, time.Now(), id, tenantID, userID)
	return err
}

// ============================================================
// IJARA DATABASE OPERATIONS
// ============================================================

func fetchAllIjara(tenantID, userID string) ([]IjaraProduct, error) {
	if db == nil {
		return []IjaraProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, asset_name, asset_value, monthly_rental, tenure_months,
			  lease_type, status, reference_number, application_date, approval_date, lease_start_date,
			  lease_end_date, created_at, updated_at
			  FROM ijara_products WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []IjaraProduct
	for rows.Next() {
		var p IjaraProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName, &p.AssetValue, &p.MonthlyRental,
			&p.TenureMonths, &p.LeaseType, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.LeaseStartDate, &p.LeaseEndDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchIjaraByID(id, tenantID, userID string) (*IjaraProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, asset_name, asset_value, monthly_rental, tenure_months,
			  lease_type, status, reference_number, application_date, approval_date, lease_start_date,
			  lease_end_date, created_at, updated_at
			  FROM ijara_products WHERE id = $1 AND tenant_id = $2 AND user_id = $3`

	var p IjaraProduct
	err := db.QueryRow(query, id, tenantID, userID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName,
		&p.AssetValue, &p.MonthlyRental, &p.TenureMonths, &p.LeaseType, &p.Status, &p.ReferenceNumber,
		&p.ApplicationDate, &p.ApprovalDate, &p.LeaseStartDate, &p.LeaseEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func saveIjara(product *IjaraProduct) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO ijara_products (id, tenant_id, user_id, asset_name, asset_value, monthly_rental,
			  tenure_months, lease_type, status, reference_number, application_date, created_at) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := db.Exec(query, product.ID, product.TenantID, product.UserID, product.AssetName,
		product.AssetValue, product.MonthlyRental, product.TenureMonths, product.LeaseType,
		product.Status, product.ReferenceNumber, product.ApplicationDate, product.CreatedAt)

	return err
}

func updateIjaraStatusDB(id, tenantID, userID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE ijara_products SET status = $1, updated_at = $2 
			  WHERE id = $3 AND tenant_id = $4 AND user_id = $5`

	_, err := db.Exec(query, status, time.Now(), id, tenantID, userID)
	return err
}

// ============================================================
// TAKAFUL DATABASE OPERATIONS
// ============================================================

func fetchAllTakaful(tenantID, userID string) ([]TakafulProduct, error) {
	if db == nil {
		return []TakafulProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, policy_type, policy_name, contribution_amount, coverage_amount,
			  frequency, status, reference_number, application_date, approval_date, policy_start_date,
			  policy_end_date, created_at, updated_at
			  FROM takaful_products WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []TakafulProduct
	for rows.Next() {
		var p TakafulProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.PolicyType, &p.PolicyName, &p.ContributionAmount,
			&p.CoverageAmount, &p.Frequency, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.PolicyStartDate, &p.PolicyEndDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchTakafulByID(id, tenantID, userID string) (*TakafulProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, policy_type, policy_name, contribution_amount, coverage_amount,
			  frequency, status, reference_number, application_date, approval_date, policy_start_date,
			  policy_end_date, created_at, updated_at
			  FROM takaful_products WHERE id = $1 AND tenant_id = $2 AND user_id = $3`

	var p TakafulProduct
	err := db.QueryRow(query, id, tenantID, userID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.PolicyType,
		&p.PolicyName, &p.ContributionAmount, &p.CoverageAmount, &p.Frequency, &p.Status, &p.ReferenceNumber,
		&p.ApplicationDate, &p.ApprovalDate, &p.PolicyStartDate, &p.PolicyEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func saveTakaful(product *TakafulProduct) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO takaful_products (id, tenant_id, user_id, policy_type, policy_name, contribution_amount,
			  coverage_amount, frequency, status, reference_number, application_date, created_at) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := db.Exec(query, product.ID, product.TenantID, product.UserID, product.PolicyType,
		product.PolicyName, product.ContributionAmount, product.CoverageAmount, product.Frequency,
		product.Status, product.ReferenceNumber, product.ApplicationDate, product.CreatedAt)

	return err
}

func updateTakafulStatusDB(id, tenantID, userID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE takaful_products SET status = $1, updated_at = $2 
			  WHERE id = $3 AND tenant_id = $4 AND user_id = $5`

	_, err := db.Exec(query, status, time.Now(), id, tenantID, userID)
	return err
}

// ============================================================
// SUKUK DATABASE OPERATIONS
// ============================================================

func fetchAllSukuk(tenantID, userID string) ([]SukukProduct, error) {
	if db == nil {
		return []SukukProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, sukuk_type, sukuk_name, investment_amount, expected_return,
			  tenure_months, status, reference_number, application_date, approval_date, maturity_date,
			  created_at, updated_at
			  FROM sukuk_products WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []SukukProduct
	for rows.Next() {
		var p SukukProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.SukukType, &p.SukukName, &p.InvestmentAmount,
			&p.ExpectedReturn, &p.TenureMonths, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.MaturityDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchSukukByID(id, tenantID, userID string) (*SukukProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, sukuk_type, sukuk_name, investment_amount, expected_return,
			  tenure_months, status, reference_number, application_date, approval_date, maturity_date,
			  created_at, updated_at
			  FROM sukuk_products WHERE id = $1 AND tenant_id = $2 AND user_id = $3`

	var p SukukProduct
	err := db.QueryRow(query, id, tenantID, userID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.SukukType,
		&p.SukukName, &p.InvestmentAmount, &p.ExpectedReturn, &p.TenureMonths, &p.Status, &p.ReferenceNumber,
		&p.ApplicationDate, &p.ApprovalDate, &p.MaturityDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func saveSukuk(product *SukukProduct) error {
	if db == nil {
		return nil
	}

	query := `INSERT INTO sukuk_products (id, tenant_id, user_id, sukuk_type, sukuk_name, investment_amount,
			  expected_return, tenure_months, status, reference_number, application_date, created_at) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := db.Exec(query, product.ID, product.TenantID, product.UserID, product.SukukType,
		product.SukukName, product.InvestmentAmount, product.ExpectedReturn, product.TenureMonths,
		product.Status, product.ReferenceNumber, product.ApplicationDate, product.CreatedAt)

	return err
}

func updateSukukStatusDB(id, tenantID, userID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	query := `UPDATE sukuk_products SET status = $1, updated_at = $2 
			  WHERE id = $3 AND tenant_id = $4 AND user_id = $5`

	_, err := db.Exec(query, status, time.Now(), id, tenantID, userID)
	return err
}

// ============================================================
// TENANT-SPECIFIC DATABASE OPERATIONS (All Users)
// ============================================================

func fetchAllMurabahaByTenant(tenantID string) ([]MurabahaProduct, error) {
	if db == nil {
		return []MurabahaProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, asset_name, cost_price, selling_price, profit_margin, 
			  tenure_months, monthly_installment, status, reference_number, application_date, 
			  approval_date, completion_date, created_at, updated_at 
			  FROM murabaha_products WHERE tenant_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []MurabahaProduct
	for rows.Next() {
		var p MurabahaProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName, &p.CostPrice, &p.SellingPrice,
			&p.ProfitMargin, &p.TenureMonths, &p.MonthlyInstallment, &p.Status, &p.ReferenceNumber,
			&p.ApplicationDate, &p.ApprovalDate, &p.CompletionDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchAllMusharakaByTenant(tenantID string) ([]MusharakaProduct, error) {
	if db == nil {
		return []MusharakaProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, business_name, bank_contribution, customer_contribution,
			  total_capital, bank_profit_share, customer_profit_share, status, reference_number,
			  application_date, approval_date, partnership_end_date, created_at, updated_at
			  FROM musharaka_products WHERE tenant_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []MusharakaProduct
	for rows.Next() {
		var p MusharakaProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.BusinessName, &p.BankContribution,
			&p.CustomerContribution, &p.TotalCapital, &p.BankProfitShare, &p.CustomerProfitShare,
			&p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.PartnershipEndDate,
			&p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchAllIjaraByTenant(tenantID string) ([]IjaraProduct, error) {
	if db == nil {
		return []IjaraProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, asset_name, asset_value, monthly_rental, tenure_months,
			  lease_type, status, reference_number, application_date, approval_date, lease_start_date,
			  lease_end_date, created_at, updated_at
			  FROM ijara_products WHERE tenant_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []IjaraProduct
	for rows.Next() {
		var p IjaraProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName, &p.AssetValue, &p.MonthlyRental,
			&p.TenureMonths, &p.LeaseType, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.LeaseStartDate, &p.LeaseEndDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchAllTakafulByTenant(tenantID string) ([]TakafulProduct, error) {
	if db == nil {
		return []TakafulProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, policy_type, policy_name, contribution_amount, coverage_amount,
			  frequency, status, reference_number, application_date, approval_date, policy_start_date,
			  policy_end_date, created_at, updated_at
			  FROM takaful_products WHERE tenant_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []TakafulProduct
	for rows.Next() {
		var p TakafulProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.PolicyType, &p.PolicyName, &p.ContributionAmount,
			&p.CoverageAmount, &p.Frequency, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.PolicyStartDate, &p.PolicyEndDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

func fetchAllSukukByTenant(tenantID string) ([]SukukProduct, error) {
	if db == nil {
		return []SukukProduct{}, nil
	}

	query := `SELECT id, tenant_id, user_id, sukuk_type, sukuk_name, investment_amount, expected_return,
			  tenure_months, status, reference_number, application_date, approval_date, maturity_date,
			  created_at, updated_at
			  FROM sukuk_products WHERE tenant_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []SukukProduct
	for rows.Next() {
		var p SukukProduct
		err := rows.Scan(&p.ID, &p.TenantID, &p.UserID, &p.SukukType, &p.SukukName, &p.InvestmentAmount,
			&p.ExpectedReturn, &p.TenureMonths, &p.Status, &p.ReferenceNumber, &p.ApplicationDate,
			&p.ApprovalDate, &p.MaturityDate, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			continue
		}
		products = append(products, p)
	}

	return products, nil
}

// ============================================================
// GENERIC PRODUCT OPERATIONS (Cross-Type)
// ============================================================

func fetchProductByIDFromAllTypes(id, tenantID string) (interface{}, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	// Try Murabaha
	if product, err := fetchMurabahaByIDTenant(id, tenantID); err == nil {
		return product, nil
	}

	// Try Musharaka
	if product, err := fetchMusharakaByIDTenant(id, tenantID); err == nil {
		return product, nil
	}

	// Try Ijara
	if product, err := fetchIjaraByIDTenant(id, tenantID); err == nil {
		return product, nil
	}

	// Try Takaful
	if product, err := fetchTakafulByIDTenant(id, tenantID); err == nil {
		return product, nil
	}

	// Try Sukuk
	if product, err := fetchSukukByIDTenant(id, tenantID); err == nil {
		return product, nil
	}

	return nil, sql.ErrNoRows
}

func updateProductStatusInAllTypes(id, tenantID string, status ProductStatus) error {
	if db == nil {
		return nil
	}

	// Try updating in each table
	queries := []string{
		`UPDATE murabaha_products SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		`UPDATE musharaka_products SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		`UPDATE ijara_products SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		`UPDATE takaful_products SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
		`UPDATE sukuk_products SET status = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`,
	}

	now := time.Now()
	for _, query := range queries {
		result, err := db.Exec(query, status, now, id, tenantID)
		if err == nil {
			if rowsAffected, _ := result.RowsAffected(); rowsAffected > 0 {
				return nil
			}
		}
	}

	return sql.ErrNoRows
}

func cancelProductInAllTypes(id, tenantID string) error {
	return updateProductStatusInAllTypes(id, tenantID, StatusCancelled)
}

func fetchMurabahaByIDTenant(id, tenantID string) (*MurabahaProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, asset_name, cost_price, selling_price, profit_margin, 
			  tenure_months, monthly_installment, status, reference_number, application_date, 
			  approval_date, completion_date, created_at, updated_at 
			  FROM murabaha_products WHERE id = $1 AND tenant_id = $2`

	var p MurabahaProduct
	err := db.QueryRow(query, id, tenantID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName,
		&p.CostPrice, &p.SellingPrice, &p.ProfitMargin, &p.TenureMonths, &p.MonthlyInstallment,
		&p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.CompletionDate,
		&p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func fetchMusharakaByIDTenant(id, tenantID string) (*MusharakaProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, business_name, bank_contribution, customer_contribution,
			  total_capital, bank_profit_share, customer_profit_share, status, reference_number,
			  application_date, approval_date, partnership_end_date, created_at, updated_at
			  FROM musharaka_products WHERE id = $1 AND tenant_id = $2`

	var p MusharakaProduct
	err := db.QueryRow(query, id, tenantID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.BusinessName,
		&p.BankContribution, &p.CustomerContribution, &p.TotalCapital, &p.BankProfitShare,
		&p.CustomerProfitShare, &p.Status, &p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate,
		&p.PartnershipEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func fetchIjaraByIDTenant(id, tenantID string) (*IjaraProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, asset_name, asset_value, monthly_rental, tenure_months,
			  lease_type, status, reference_number, application_date, approval_date, lease_start_date,
			  lease_end_date, created_at, updated_at
			  FROM ijara_products WHERE id = $1 AND tenant_id = $2`

	var p IjaraProduct
	err := db.QueryRow(query, id, tenantID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.AssetName,
		&p.AssetValue, &p.MonthlyRental, &p.TenureMonths, &p.LeaseType, &p.Status, &p.ReferenceNumber,
		&p.ApplicationDate, &p.ApprovalDate, &p.LeaseStartDate, &p.LeaseEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func fetchTakafulByIDTenant(id, tenantID string) (*TakafulProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, policy_type, policy_name, contribution_amount, coverage_amount,
			  frequency, status, reference_number, application_date, approval_date, policy_start_date,
			  policy_end_date, created_at, updated_at
			  FROM takaful_products WHERE id = $1 AND tenant_id = $2`

	var p TakafulProduct
	err := db.QueryRow(query, id, tenantID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.PolicyType,
		&p.PolicyName, &p.ContributionAmount, &p.CoverageAmount, &p.Frequency, &p.Status,
		&p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.PolicyStartDate,
		&p.PolicyEndDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func fetchSukukByIDTenant(id, tenantID string) (*SukukProduct, error) {
	if db == nil {
		return nil, sql.ErrNoRows
	}

	query := `SELECT id, tenant_id, user_id, sukuk_type, sukuk_name, investment_amount, expected_return,
			  tenure_months, status, reference_number, application_date, approval_date, maturity_date,
			  created_at, updated_at
			  FROM sukuk_products WHERE id = $1 AND tenant_id = $2`

	var p SukukProduct
	err := db.QueryRow(query, id, tenantID).Scan(&p.ID, &p.TenantID, &p.UserID, &p.SukukType,
		&p.SukukName, &p.InvestmentAmount, &p.ExpectedReturn, &p.TenureMonths, &p.Status,
		&p.ReferenceNumber, &p.ApplicationDate, &p.ApprovalDate, &p.MaturityDate, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &p, nil
}
