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

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS carbon_projects (
		id SERIAL PRIMARY KEY,
		project_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		project_name VARCHAR(255) NOT NULL,
		project_type VARCHAR(100) NOT NULL,
		location VARCHAR(255),
		registry VARCHAR(100),
		registry_id VARCHAR(100),
		total_credits DECIMAL(15,2) DEFAULT 0,
		issued_credits DECIMAL(15,2) DEFAULT 0,
		retired_credits DECIMAL(15,2) DEFAULT 0,
		status VARCHAR(20) DEFAULT 'active',
		verification_standard VARCHAR(100),
		vintage_year INT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON carbon_projects(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_projects_status ON carbon_projects(status);

	CREATE TABLE IF NOT EXISTS carbon_credits (
		id SERIAL PRIMARY KEY,
		credit_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		project_id VARCHAR(50) REFERENCES carbon_projects(project_id),
		serial_number VARCHAR(100) UNIQUE NOT NULL,
		quantity DECIMAL(15,2) NOT NULL,
		unit VARCHAR(20) DEFAULT 'tCO2e',
		status VARCHAR(20) DEFAULT 'issued',
		owner_id VARCHAR(50) NOT NULL,
		price_per_unit DECIMAL(10,2),
		currency VARCHAR(3) DEFAULT 'USD',
		issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		retired_at TIMESTAMP,
		retirement_reason TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_credits_tenant_id ON carbon_credits(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_credits_project_id ON carbon_credits(project_id);
	CREATE INDEX IF NOT EXISTS idx_credits_owner_id ON carbon_credits(owner_id);
	CREATE INDEX IF NOT EXISTS idx_credits_status ON carbon_credits(status);

	CREATE TABLE IF NOT EXISTS carbon_trades (
		id SERIAL PRIMARY KEY,
		trade_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		credit_id VARCHAR(50) REFERENCES carbon_credits(credit_id),
		seller_id VARCHAR(50) NOT NULL,
		buyer_id VARCHAR(50) NOT NULL,
		quantity DECIMAL(15,2) NOT NULL,
		price_per_unit DECIMAL(10,2) NOT NULL,
		total_amount DECIMAL(15,2) NOT NULL,
		currency VARCHAR(3) DEFAULT 'USD',
		status VARCHAR(20) DEFAULT 'pending',
		trade_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		settlement_date TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_trades_tenant_id ON carbon_trades(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON carbon_trades(seller_id);
	CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON carbon_trades(buyer_id);
	CREATE INDEX IF NOT EXISTS idx_trades_status ON carbon_trades(status);

	CREATE TABLE IF NOT EXISTS carbon_retirements (
		id SERIAL PRIMARY KEY,
		retirement_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		credit_id VARCHAR(50) REFERENCES carbon_credits(credit_id),
		quantity DECIMAL(15,2) NOT NULL,
		retired_by VARCHAR(50) NOT NULL,
		retirement_reason TEXT,
		beneficiary VARCHAR(255),
		retirement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		certificate_url TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_retirements_tenant_id ON carbon_retirements(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_retirements_credit_id ON carbon_retirements(credit_id);

	CREATE TABLE IF NOT EXISTS carbon_footprints (
		id SERIAL PRIMARY KEY,
		footprint_id VARCHAR(50) UNIQUE NOT NULL,
		tenant_id VARCHAR(50) NOT NULL,
		entity_id VARCHAR(50) NOT NULL,
		entity_type VARCHAR(50) NOT NULL,
		scope1_emissions DECIMAL(15,2) DEFAULT 0,
		scope2_emissions DECIMAL(15,2) DEFAULT 0,
		scope3_emissions DECIMAL(15,2) DEFAULT 0,
		total_emissions DECIMAL(15,2) NOT NULL,
		unit VARCHAR(20) DEFAULT 'tCO2e',
		calculation_method VARCHAR(100),
		reporting_period_start DATE NOT NULL,
		reporting_period_end DATE NOT NULL,
		verified BOOLEAN DEFAULT FALSE,
		verifier VARCHAR(255),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_footprints_tenant_id ON carbon_footprints(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_footprints_entity_id ON carbon_footprints(entity_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	log.Println("Carbon database tables created/verified")
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
