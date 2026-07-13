package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type ERPNextIntegrationService struct {
	db            *sql.DB
	httpClient    *http.Client
	encryptionKey []byte
	connections   map[string]map[string]*ERPConnection
	mu            sync.RWMutex
}

type HealthStatus struct {
	DatabaseHealthy bool      `json:"database_healthy"`
	Timestamp       time.Time `json:"timestamp"`
}

type ERPConnection struct {
	ID            string                 `json:"id"`
	TenantID      string                 `json:"tenant_id"`
	CustomerID    string                 `json:"customer_id"`
	Name          string                 `json:"name"`
	ERPType       string                 `json:"erp_type"`
	BaseURL       string                 `json:"base_url"`
	APIKey        string                 `json:"api_key,omitempty"`
	APISecret     string                 `json:"api_secret,omitempty"`
	OAuthToken    string                 `json:"oauth_token,omitempty"`
	OAuthRefresh  string                 `json:"oauth_refresh,omitempty"`
	OAuthExpiry   time.Time              `json:"oauth_expiry,omitempty"`
	Status        ConnectionStatus       `json:"status"`
	LastSyncAt    time.Time              `json:"last_sync_at,omitempty"`
	SyncFrequency string                 `json:"sync_frequency"`
	Settings      map[string]interface{} `json:"settings,omitempty"`
	BankAccounts  []string               `json:"bank_accounts,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type ConnectionStatus string

const (
	ConnectionStatusActive       ConnectionStatus = "active"
	ConnectionStatusInactive     ConnectionStatus = "inactive"
	ConnectionStatusError        ConnectionStatus = "error"
	ConnectionStatusPending      ConnectionStatus = "pending"
	ConnectionStatusDisconnected ConnectionStatus = "disconnected"
)

type SyncJob struct {
	ID           string                 `json:"id"`
	ConnectionID string                 `json:"connection_id"`
	TenantID     string                 `json:"tenant_id"`
	CustomerID   string                 `json:"customer_id"`
	JobType      SyncJobType            `json:"job_type"`
	Status       SyncJobStatus          `json:"status"`
	StartedAt    time.Time              `json:"started_at"`
	CompletedAt  time.Time              `json:"completed_at,omitempty"`
	ItemsTotal   int                    `json:"items_total"`
	ItemsSynced  int                    `json:"items_synced"`
	ItemsFailed  int                    `json:"items_failed"`
	Errors       []SyncError            `json:"errors,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type SyncJobType string

const (
	SyncJobTypeAccounts     SyncJobType = "accounts"
	SyncJobTypeTransactions SyncJobType = "transactions"
	SyncJobTypeInvoices     SyncJobType = "invoices"
	SyncJobTypePayments     SyncJobType = "payments"
	SyncJobTypeFull         SyncJobType = "full"
)

type SyncJobStatus string

const (
	SyncJobStatusPending   SyncJobStatus = "pending"
	SyncJobStatusRunning   SyncJobStatus = "running"
	SyncJobStatusCompleted SyncJobStatus = "completed"
	SyncJobStatusFailed    SyncJobStatus = "failed"
	SyncJobStatusCancelled SyncJobStatus = "cancelled"
)

type SyncError struct {
	ItemID     string    `json:"item_id"`
	ItemType   string    `json:"item_type"`
	Error      string    `json:"error"`
	OccurredAt time.Time `json:"occurred_at"`
}

type BankAccount struct {
	ID               string    `json:"id"`
	AccountNumber    string    `json:"account_number"`
	AccountName      string    `json:"account_name"`
	BankName         string    `json:"bank_name"`
	Currency         string    `json:"currency"`
	Balance          float64   `json:"balance"`
	AvailableBalance float64   `json:"available_balance"`
	AccountType      string    `json:"account_type"`
	Status           string    `json:"status"`
	LastUpdated      time.Time `json:"last_updated"`
}

type BankTransaction struct {
	ID              string                 `json:"id"`
	AccountID       string                 `json:"account_id"`
	TransactionDate time.Time              `json:"transaction_date"`
	ValueDate       time.Time              `json:"value_date"`
	Description     string                 `json:"description"`
	Reference       string                 `json:"reference"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	Type            string                 `json:"type"`
	Balance         float64                `json:"balance"`
	Category        string                 `json:"category,omitempty"`
	Reconciled      bool                   `json:"reconciled"`
	ERPEntryID      string                 `json:"erp_entry_id,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

type Payment struct {
	ID              string                 `json:"id"`
	ConnectionID    string                 `json:"connection_id"`
	TenantID        string                 `json:"tenant_id"`
	CustomerID      string                 `json:"customer_id"`
	PaymentType     PaymentType            `json:"payment_type"`
	Status          PaymentStatus          `json:"status"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	SourceAccount   string                 `json:"source_account"`
	DestAccount     string                 `json:"dest_account"`
	DestBankCode    string                 `json:"dest_bank_code,omitempty"`
	DestBankName    string                 `json:"dest_bank_name,omitempty"`
	BeneficiaryName string                 `json:"beneficiary_name"`
	Reference       string                 `json:"reference"`
	Narration       string                 `json:"narration"`
	ERPDocType      string                 `json:"erp_doc_type,omitempty"`
	ERPDocID        string                 `json:"erp_doc_id,omitempty"`
	BankReference   string                 `json:"bank_reference,omitempty"`
	ScheduledDate   time.Time              `json:"scheduled_date,omitempty"`
	ExecutedAt      time.Time              `json:"executed_at,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

type PaymentType string

const (
	PaymentTypeInternal PaymentType = "internal"
	PaymentTypeNIP      PaymentType = "nip"
	PaymentTypeNEFT     PaymentType = "neft"
	PaymentTypeRTGS     PaymentType = "rtgs"
	PaymentTypeSWIFT    PaymentType = "swift"
)

type PaymentStatus string

const (
	PaymentStatusPending    PaymentStatus = "pending"
	PaymentStatusApproved   PaymentStatus = "approved"
	PaymentStatusProcessing PaymentStatus = "processing"
	PaymentStatusCompleted  PaymentStatus = "completed"
	PaymentStatusFailed     PaymentStatus = "failed"
	PaymentStatusCancelled  PaymentStatus = "cancelled"
)

type Invoice struct {
	ID                  string    `json:"id"`
	ERPInvoiceID        string    `json:"erp_invoice_id"`
	InvoiceNumber       string    `json:"invoice_number"`
	CustomerName        string    `json:"customer_name"`
	Amount              float64   `json:"amount"`
	Currency            string    `json:"currency"`
	DueDate             time.Time `json:"due_date"`
	Status              string    `json:"status"`
	PaidAmount          float64   `json:"paid_amount"`
	OutstandingAmount   float64   `json:"outstanding_amount"`
	MatchedTransactions []string  `json:"matched_transactions,omitempty"`
}

type Loan struct {
	ID                 string    `json:"id"`
	LoanAccountNumber  string    `json:"loan_account_number"`
	LoanType           string    `json:"loan_type"`
	PrincipalAmount    float64   `json:"principal_amount"`
	OutstandingBalance float64   `json:"outstanding_balance"`
	InterestRate       float64   `json:"interest_rate"`
	Currency           string    `json:"currency"`
	DisbursementDate   time.Time `json:"disbursement_date"`
	MaturityDate       time.Time `json:"maturity_date"`
	NextPaymentDate    time.Time `json:"next_payment_date"`
	NextPaymentAmount  float64   `json:"next_payment_amount"`
	Status             string    `json:"status"`
}

type LoanSchedule struct {
	LoanID       string            `json:"loan_id"`
	Installments []LoanInstallment `json:"installments"`
}

type LoanInstallment struct {
	InstallmentNumber int       `json:"installment_number"`
	DueDate           time.Time `json:"due_date"`
	Principal         float64   `json:"principal"`
	Interest          float64   `json:"interest"`
	TotalAmount       float64   `json:"total_amount"`
	Status            string    `json:"status"`
	PaidDate          time.Time `json:"paid_date,omitempty"`
	PaidAmount        float64   `json:"paid_amount,omitempty"`
}

type AccountMapping struct {
	ID             string    `json:"id"`
	ConnectionID   string    `json:"connection_id"`
	TenantID       string    `json:"tenant_id"`
	CustomerID     string    `json:"customer_id"`
	BankAccountID  string    `json:"bank_account_id"`
	ERPAccountID   string    `json:"erp_account_id"`
	ERPAccountName string    `json:"erp_account_name"`
	MappingType    string    `json:"mapping_type"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
}

type Webhook struct {
	ID           string    `json:"id"`
	ConnectionID string    `json:"connection_id"`
	TenantID     string    `json:"tenant_id"`
	CustomerID   string    `json:"customer_id"`
	EventType    string    `json:"event_type"`
	TargetURL    string    `json:"target_url"`
	Secret       string    `json:"secret,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type ReconciliationResult struct {
	TotalTransactions     int                   `json:"total_transactions"`
	MatchedTransactions   int                   `json:"matched_transactions"`
	UnmatchedTransactions int                   `json:"unmatched_transactions"`
	MatchedAmount         float64               `json:"matched_amount"`
	UnmatchedAmount       float64               `json:"unmatched_amount"`
	Matches               []ReconciliationMatch `json:"matches"`
	Unmatched             []BankTransaction     `json:"unmatched"`
}

type ReconciliationMatch struct {
	BankTransactionID string  `json:"bank_transaction_id"`
	ERPEntryID        string  `json:"erp_entry_id"`
	Amount            float64 `json:"amount"`
	MatchType         string  `json:"match_type"`
	Confidence        float64 `json:"confidence"`
}

type CashPosition struct {
	TenantID     string             `json:"tenant_id"`
	CustomerID   string             `json:"customer_id"`
	AsOfDate     time.Time          `json:"as_of_date"`
	TotalBalance float64            `json:"total_balance"`
	ByCurrency   map[string]float64 `json:"by_currency"`
	ByAccount    []AccountBalance   `json:"by_account"`
}

type AccountBalance struct {
	AccountID        string  `json:"account_id"`
	AccountName      string  `json:"account_name"`
	BankName         string  `json:"bank_name"`
	Currency         string  `json:"currency"`
	Balance          float64 `json:"balance"`
	AvailableBalance float64 `json:"available_balance"`
}

type CashForecast struct {
	TenantID       string           `json:"tenant_id"`
	CustomerID     string           `json:"customer_id"`
	StartDate      time.Time        `json:"start_date"`
	EndDate        time.Time        `json:"end_date"`
	OpeningBalance float64          `json:"opening_balance"`
	Projections    []CashProjection `json:"projections"`
}

type CashProjection struct {
	Date             time.Time `json:"date"`
	ExpectedInflows  float64   `json:"expected_inflows"`
	ExpectedOutflows float64   `json:"expected_outflows"`
	NetCashFlow      float64   `json:"net_cash_flow"`
	ProjectedBalance float64   `json:"projected_balance"`
}

func NewERPNextIntegrationService(ctx context.Context) (*ERPNextIntegrationService, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require",
			os.Getenv("DB_USER"),
			os.Getenv("DB_PASSWORD"),
			os.Getenv("DB_HOST"),
			os.Getenv("DB_PORT"),
			os.Getenv("DB_NAME"),
		)
	}

	log.Printf("Connecting to database...")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("ERROR: Failed to open database connection: %v", err)
		return nil, err
	}

	if err := db.Ping(); err != nil {
		log.Printf("ERROR: Database ping failed: %v", err)
		return nil, err
	}

	log.Printf("Database connection established successfully")

	encKey := os.Getenv("ENCRYPTION_KEY")
	if encKey == "" {
		encKey = "54bank-erp-integration-key-32b!"
	}

	service := &ERPNextIntegrationService{
		db:            db,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		encryptionKey: []byte(encKey),
		connections:   make(map[string]map[string]*ERPConnection),
	}

	log.Printf("Initializing database schema...")
	if err := service.initializeSchema(ctx); err != nil {
		log.Printf("ERROR: Failed to initialize schema: %v", err)
		return nil, err
	}
	log.Printf("Database schema initialized successfully")

	return service, nil
}

func (s *ERPNextIntegrationService) initializeSchema(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS erp_connections (
		id UUID PRIMARY KEY,
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		name VARCHAR(255) NOT NULL,
		erp_type VARCHAR(50) NOT NULL DEFAULT 'erpnext',
		base_url VARCHAR(500) NOT NULL,
		api_key_encrypted TEXT,
		api_secret_encrypted TEXT,
		oauth_token_encrypted TEXT,
		oauth_refresh_encrypted TEXT,
		oauth_expiry TIMESTAMP,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		last_sync_at TIMESTAMP,
		sync_frequency VARCHAR(50) DEFAULT 'hourly',
		settings JSONB,
		bank_accounts JSONB,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
		UNIQUE(tenant_id, customer_id, name)
	);

	CREATE TABLE IF NOT EXISTS sync_jobs (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		job_type VARCHAR(50) NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		started_at TIMESTAMP,
		completed_at TIMESTAMP,
		items_total INT DEFAULT 0,
		items_synced INT DEFAULT 0,
		items_failed INT DEFAULT 0,
		errors JSONB,
		metadata JSONB,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS bank_transactions (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		account_id VARCHAR(100) NOT NULL,
		transaction_date DATE NOT NULL,
		value_date DATE,
		description TEXT,
		reference VARCHAR(255),
		amount DECIMAL(20,4) NOT NULL,
		currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
		transaction_type VARCHAR(50),
		balance DECIMAL(20,4),
		category VARCHAR(100),
		reconciled BOOLEAN DEFAULT FALSE,
		erp_entry_id VARCHAR(255),
		metadata JSONB,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		UNIQUE(connection_id, account_id, reference, transaction_date)
	);

	CREATE TABLE IF NOT EXISTS payments (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		payment_type VARCHAR(50) NOT NULL,
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		amount DECIMAL(20,4) NOT NULL,
		currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
		source_account VARCHAR(100) NOT NULL,
		dest_account VARCHAR(100) NOT NULL,
		dest_bank_code VARCHAR(20),
		dest_bank_name VARCHAR(255),
		beneficiary_name VARCHAR(255) NOT NULL,
		reference VARCHAR(255) NOT NULL,
		narration TEXT,
		erp_doc_type VARCHAR(100),
		erp_doc_id VARCHAR(255),
		bank_reference VARCHAR(255),
		scheduled_date TIMESTAMP,
		executed_at TIMESTAMP,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS account_mappings (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		bank_account_id VARCHAR(100) NOT NULL,
		erp_account_id VARCHAR(255) NOT NULL,
		erp_account_name VARCHAR(255),
		mapping_type VARCHAR(50) DEFAULT 'bank_account',
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW(),
		UNIQUE(connection_id, bank_account_id, erp_account_id)
	);

	CREATE TABLE IF NOT EXISTS webhooks (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		event_type VARCHAR(100) NOT NULL,
		target_url VARCHAR(500) NOT NULL,
		secret_encrypted TEXT,
		is_active BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS reconciliation_history (
		id UUID PRIMARY KEY,
		connection_id UUID NOT NULL REFERENCES erp_connections(id),
		tenant_id VARCHAR(100) NOT NULL,
		customer_id VARCHAR(100) NOT NULL,
		reconciliation_date DATE NOT NULL,
		total_transactions INT,
		matched_transactions INT,
		unmatched_transactions INT,
		matched_amount DECIMAL(20,4),
		unmatched_amount DECIMAL(20,4),
		created_at TIMESTAMP NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_erp_connections_tenant ON erp_connections(tenant_id, customer_id);
	CREATE INDEX IF NOT EXISTS idx_sync_jobs_connection ON sync_jobs(connection_id);
	CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(connection_id, account_id, transaction_date);
	CREATE INDEX IF NOT EXISTS idx_payments_connection ON payments(connection_id, status);
	CREATE INDEX IF NOT EXISTS idx_account_mappings_connection ON account_mappings(connection_id);

	CREATE TABLE IF NOT EXISTS erp_sync_configs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) UNIQUE NOT NULL,
		auto_sync_enabled BOOLEAN DEFAULT false,
		sync_frequency VARCHAR(50) DEFAULT 'hourly',
		sync_time_of_day VARCHAR(5),
		batch_size INTEGER DEFAULT 100,
		parallel_connections INTEGER DEFAULT 3,
		timeout_seconds INTEGER DEFAULT 30,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS erp_retry_policy_configs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) UNIQUE NOT NULL,
		max_retries INTEGER DEFAULT 3,
		initial_delay_seconds INTEGER DEFAULT 1,
		max_delay_seconds INTEGER DEFAULT 60,
		backoff_multiplier DECIMAL(5,2) DEFAULT 2.0,
		retry_on_status_codes JSONB DEFAULT '[408, 429, 500, 502, 503, 504]',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS erp_notification_configs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) UNIQUE NOT NULL,
		email_notifications_enabled BOOLEAN DEFAULT false,
		notification_emails JSONB DEFAULT '[]',
		notify_on_sync_failure BOOLEAN DEFAULT true,
		notify_on_reconciliation_mismatch BOOLEAN DEFAULT true,
		notify_on_payment_failure BOOLEAN DEFAULT true,
		notify_on_high_value_transactions BOOLEAN DEFAULT true,
		high_value_threshold DECIMAL(15,2) DEFAULT 10000,
		slack_webhook_url TEXT,
		teams_webhook_url TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS erp_security_configs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) UNIQUE NOT NULL,
		require_approval_for_payments_above DECIMAL(15,2) DEFAULT 5000,
		require_approval_for_config_changes BOOLEAN DEFAULT true,
		session_timeout_minutes INTEGER DEFAULT 30,
		allowed_ip_ranges JSONB DEFAULT '["0.0.0.0/0"]',
		mfa_required BOOLEAN DEFAULT false,
		audit_log_retention_days INTEGER DEFAULT 90,
		encryption_enabled BOOLEAN DEFAULT true,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS erp_audit_logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) NOT NULL,
		user_id VARCHAR(255) NOT NULL,
		user_email VARCHAR(255) NOT NULL,
		action VARCHAR(100) NOT NULL,
		resource_type VARCHAR(100) NOT NULL,
		resource_id VARCHAR(255),
		changes JSONB,
		ip_address VARCHAR(45),
		user_agent TEXT,
		status VARCHAR(20) DEFAULT 'success',
		error_message TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS erp_exceptions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tenant_id VARCHAR(255) NOT NULL,
		type VARCHAR(50) NOT NULL,
		severity VARCHAR(20) NOT NULL,
		status VARCHAR(20) DEFAULT 'open',
		title VARCHAR(255) NOT NULL,
		description TEXT,
		resource_type VARCHAR(100),
		resource_id VARCHAR(255),
		data JSONB,
		assigned_to VARCHAR(255),
		resolution_notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		resolved_at TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_erp_audit_logs_tenant_id ON erp_audit_logs(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_erp_audit_logs_created_at ON erp_audit_logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_erp_audit_logs_action ON erp_audit_logs(action);
	CREATE INDEX IF NOT EXISTS idx_erp_audit_logs_resource_type ON erp_audit_logs(resource_type);

	CREATE INDEX IF NOT EXISTS idx_erp_exceptions_tenant_id ON erp_exceptions(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_erp_exceptions_status ON erp_exceptions(status);
	CREATE INDEX IF NOT EXISTS idx_erp_exceptions_severity ON erp_exceptions(severity);
	CREATE INDEX IF NOT EXISTS idx_erp_exceptions_created_at ON erp_exceptions(created_at DESC);
	`

	_, err := s.db.ExecContext(ctx, schema)
	return err
}

func (s *ERPNextIntegrationService) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *ERPNextIntegrationService) HealthCheck() HealthStatus {
	status := HealthStatus{
		Timestamp: time.Now(),
	}

	if s.db != nil {
		if err := s.db.Ping(); err == nil {
			status.DatabaseHealthy = true
		}
	}

	return status
}

func (s *ERPNextIntegrationService) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (s *ERPNextIntegrationService) decrypt(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func (s *ERPNextIntegrationService) CreateConnection(ctx context.Context, tenantID, customerID string, conn *ERPConnection) (*ERPConnection, error) {
	conn.ID = uuid.New().String()
	conn.TenantID = tenantID
	conn.CustomerID = customerID
	conn.Status = ConnectionStatusPending
	conn.CreatedAt = time.Now()
	conn.UpdatedAt = time.Now()

	if conn.ERPType == "" {
		conn.ERPType = "erpnext"
	}

	var apiKeyEnc, apiSecretEnc string
	var err error

	if conn.APIKey != "" {
		apiKeyEnc, err = s.encrypt(conn.APIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt API key: %w", err)
		}
	}

	if conn.APISecret != "" {
		apiSecretEnc, err = s.encrypt(conn.APISecret)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt API secret: %w", err)
		}
	}

	if s.db != nil {
		settingsJSON, _ := json.Marshal(conn.Settings)
		bankAccountsJSON, _ := json.Marshal(conn.BankAccounts)

		_, err = s.db.ExecContext(ctx, `
			INSERT INTO erp_connections (id, tenant_id, customer_id, name, erp_type, base_url, 
				api_key_encrypted, api_secret_encrypted, status, sync_frequency, settings, bank_accounts, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`, conn.ID, tenantID, customerID, conn.Name, conn.ERPType, conn.BaseURL,
			apiKeyEnc, apiSecretEnc, conn.Status, conn.SyncFrequency, settingsJSON, bankAccountsJSON, conn.CreatedAt, conn.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to create connection: %w", err)
		}
	}

	s.mu.Lock()
	if s.connections[tenantID] == nil {
		s.connections[tenantID] = make(map[string]*ERPConnection)
	}
	s.connections[tenantID][conn.ID] = conn
	s.mu.Unlock()

	conn.APIKey = ""
	conn.APISecret = ""

	return conn, nil
}

func (s *ERPNextIntegrationService) GetConnection(ctx context.Context, tenantID, customerID, connectionID string) (*ERPConnection, error) {
	s.mu.RLock()
	if tenantConns, ok := s.connections[tenantID]; ok {
		if conn, ok := tenantConns[connectionID]; ok {
			if conn.CustomerID == customerID {
				s.mu.RUnlock()
				return conn, nil
			}
		}
	}
	s.mu.RUnlock()

	if s.db == nil {
		return nil, fmt.Errorf("connection not found")
	}

	var conn ERPConnection
	var settingsJSON, bankAccountsJSON []byte
	var apiKeyEnc, apiSecretEnc sql.NullString
	var lastSyncAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, customer_id, name, erp_type, base_url, api_key_encrypted, api_secret_encrypted,
			status, last_sync_at, sync_frequency, settings, bank_accounts, created_at, updated_at
		FROM erp_connections
		WHERE id = $1 AND tenant_id = $2 AND customer_id = $3
	`, connectionID, tenantID, customerID).Scan(
		&conn.ID, &conn.TenantID, &conn.CustomerID, &conn.Name, &conn.ERPType, &conn.BaseURL,
		&apiKeyEnc, &apiSecretEnc, &conn.Status, &lastSyncAt, &conn.SyncFrequency,
		&settingsJSON, &bankAccountsJSON, &conn.CreatedAt, &conn.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	if lastSyncAt.Valid {
		conn.LastSyncAt = lastSyncAt.Time
	}

	if len(settingsJSON) > 0 {
		json.Unmarshal(settingsJSON, &conn.Settings)
	}
	if len(bankAccountsJSON) > 0 {
		json.Unmarshal(bankAccountsJSON, &conn.BankAccounts)
	}

	return &conn, nil
}

func (s *ERPNextIntegrationService) ListConnections(ctx context.Context, tenantID, customerID string) ([]*ERPConnection, error) {
	connections := make([]*ERPConnection, 0)

	if s.db == nil {
		s.mu.RLock()
		if tenantConns, ok := s.connections[tenantID]; ok {
			for _, conn := range tenantConns {
				if conn.CustomerID == customerID {
					connections = append(connections, conn)
				}
			}
		}
		s.mu.RUnlock()
		return connections, nil
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, tenant_id, customer_id, name, erp_type, base_url, status, last_sync_at, 
			sync_frequency, settings, bank_accounts, created_at, updated_at
		FROM erp_connections
		WHERE tenant_id = $1 AND customer_id = $2
		ORDER BY created_at DESC
	`, tenantID, customerID)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var conn ERPConnection
		var settingsJSON, bankAccountsJSON []byte
		var lastSyncAt sql.NullTime

		err := rows.Scan(
			&conn.ID, &conn.TenantID, &conn.CustomerID, &conn.Name, &conn.ERPType, &conn.BaseURL,
			&conn.Status, &lastSyncAt, &conn.SyncFrequency, &settingsJSON, &bankAccountsJSON,
			&conn.CreatedAt, &conn.UpdatedAt,
		)
		if err != nil {
			continue
		}

		if lastSyncAt.Valid {
			conn.LastSyncAt = lastSyncAt.Time
		}
		if len(settingsJSON) > 0 {
			json.Unmarshal(settingsJSON, &conn.Settings)
		}
		if len(bankAccountsJSON) > 0 {
			json.Unmarshal(bankAccountsJSON, &conn.BankAccounts)
		}

		connections = append(connections, &conn)
	}

	return connections, nil
}

func (s *ERPNextIntegrationService) UpdateConnection(ctx context.Context, tenantID, customerID, connectionID string, updates map[string]interface{}) (*ERPConnection, error) {
	conn, err := s.GetConnection(ctx, tenantID, customerID, connectionID)
	if err != nil {
		return nil, err
	}

	if name, ok := updates["name"].(string); ok {
		conn.Name = name
	}
	if baseURL, ok := updates["base_url"].(string); ok {
		conn.BaseURL = baseURL
	}
	if syncFreq, ok := updates["sync_frequency"].(string); ok {
		conn.SyncFrequency = syncFreq
	}
	if settings, ok := updates["settings"].(map[string]interface{}); ok {
		conn.Settings = settings
	}
	if bankAccounts, ok := updates["bank_accounts"].([]string); ok {
		conn.BankAccounts = bankAccounts
	}

	conn.UpdatedAt = time.Now()

	if s.db != nil {
		settingsJSON, _ := json.Marshal(conn.Settings)
		bankAccountsJSON, _ := json.Marshal(conn.BankAccounts)

		_, err = s.db.ExecContext(ctx, `
			UPDATE erp_connections 
			SET name = $1, base_url = $2, sync_frequency = $3, settings = $4, bank_accounts = $5, updated_at = $6
			WHERE id = $7 AND tenant_id = $8 AND customer_id = $9
		`, conn.Name, conn.BaseURL, conn.SyncFrequency, settingsJSON, bankAccountsJSON, conn.UpdatedAt, connectionID, tenantID, customerID)

		if err != nil {
			return nil, err
		}
	}

	s.mu.Lock()
	if s.connections[tenantID] != nil {
		s.connections[tenantID][connectionID] = conn
	}
	s.mu.Unlock()

	return conn, nil
}

func (s *ERPNextIntegrationService) DeleteConnection(ctx context.Context, tenantID, customerID, connectionID string) error {
	if s.db != nil {
		_, err := s.db.ExecContext(ctx, `
			DELETE FROM erp_connections WHERE id = $1 AND tenant_id = $2 AND customer_id = $3
		`, connectionID, tenantID, customerID)
		if err != nil {
			return err
		}
	}

	s.mu.Lock()
	if s.connections[tenantID] != nil {
		delete(s.connections[tenantID], connectionID)
	}
	s.mu.Unlock()

	return nil
}

func (s *ERPNextIntegrationService) TestConnection(ctx context.Context, tenantID, customerID, connectionID string) (bool, error) {
	conn, err := s.GetConnection(ctx, tenantID, customerID, connectionID)
	if err != nil {
		return false, err
	}

	testURL := fmt.Sprintf("%s/api/method/frappe.auth.get_logged_user", conn.BaseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", testURL, nil)
	if err != nil {
		return false, err
	}

	if conn.APIKey != "" && conn.APISecret != "" {
		req.Header.Set("Authorization", fmt.Sprintf("token %s:%s", conn.APIKey, conn.APISecret))
	} else if conn.OAuthToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", conn.OAuthToken))
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.updateConnectionStatus(ctx, connectionID, ConnectionStatusError)
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		s.updateConnectionStatus(ctx, connectionID, ConnectionStatusActive)
		return true, nil
	}

	s.updateConnectionStatus(ctx, connectionID, ConnectionStatusError)
	return false, fmt.Errorf("connection test failed with status: %d", resp.StatusCode)
}

func (s *ERPNextIntegrationService) updateConnectionStatus(ctx context.Context, connectionID string, status ConnectionStatus) {
	if s.db != nil {
		s.db.ExecContext(ctx, `UPDATE erp_connections SET status = $1, updated_at = $2 WHERE id = $3`, status, time.Now(), connectionID)
	}
}
