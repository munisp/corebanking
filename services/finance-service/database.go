package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

func InitDB() error {
	dbHost := getEnv("DB_HOST", "postgres")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "finance_db")

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

	log.Println("Finance database connection established")

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS invoices (
		id SERIAL PRIMARY KEY,
		invoice_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		supplier_id VARCHAR(50) NOT NULL,
		buyer_id VARCHAR(50) NOT NULL,
		invoice_number VARCHAR(100) NOT NULL,
		amount DECIMAL(15,2) NOT NULL,
		currency VARCHAR(3) DEFAULT 'NGN',
		issue_date DATE NOT NULL,
		due_date DATE NOT NULL,
		status VARCHAR(20) DEFAULT 'pending',
		financed_amount DECIMAL(15,2) DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS loans (
		id SERIAL PRIMARY KEY,
		loan_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		borrower_id VARCHAR(50) NOT NULL,
		loan_product VARCHAR(100) NOT NULL,
		amount DECIMAL(15,2) NOT NULL,
		currency VARCHAR(3) DEFAULT 'NGN',
		interest_rate DECIMAL(5,4) NOT NULL,
		term_months INT NOT NULL,
		status VARCHAR(20) DEFAULT 'pending',
		disbursed_at TIMESTAMP,
		fully_repaid_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS collateral (
		id SERIAL PRIMARY KEY,
		collateral_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		loan_id VARCHAR(50) REFERENCES loans(loan_id),
		collateral_type VARCHAR(100) NOT NULL,
		description TEXT,
		appraised_value DECIMAL(15,2) NOT NULL,
		status VARCHAR(20) DEFAULT 'active',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS repayments (
		id SERIAL PRIMARY KEY,
		repayment_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		loan_id VARCHAR(50) REFERENCES loans(loan_id),
		amount DECIMAL(15,2) NOT NULL,
		principal_amount DECIMAL(15,2) NOT NULL,
		interest_amount DECIMAL(15,2) NOT NULL,
		payment_date DATE NOT NULL,
		status VARCHAR(20) DEFAULT 'completed',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	log.Println("Finance database tables created/verified")
	return nil
}

func CloseDB() error {
	if db != nil {
		return db.Close()
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
