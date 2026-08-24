package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	tigerbeetle "github.com/tigerbeetle/tigerbeetle-go"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

var coaClient *CoAClient

// Config holds service configuration
type Config struct {
	Port              string
	DatabaseURL       string
	TigerBeetleAddr   string
	TemporalAddr      string
	TemporalNamespace string
	TemporalTaskQueue string
	KYCServiceURL     string
	FraudServiceURL   string
	NotificationURL   string
	AuditServiceURL   string
	SMSProviderURL    string
	SMSProviderKey    string
}

func loadConfig() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", getEnv("DATABASE_URI", "postgres://localhost:5432/escrow")),
		TigerBeetleAddr:   getEnv("TB_ADDRESS", getEnv("TIGERBEETLE_ADDR", "localhost:3000")),
		TemporalAddr:      getEnv("TEMPORAL_ADDRESS", getEnv("TEMPORAL_ADDR", "localhost:7233")),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "default"),
		TemporalTaskQueue: getEnv("TEMPORAL_TASK_QUEUE", "escrow-tasks"),
		KYCServiceURL:     getEnv("KYC_SERVICE_URL", "http://kyc-service:8080"),
		FraudServiceURL:   getEnv("FRAUD_SERVICE_URL", "http://fraud-service:8080"),
		NotificationURL:   getEnv("NOTIFICATION_URL", "http://notification-service:8080"),
		AuditServiceURL:   getEnv("AUDIT_SERVICE_URL", "http://audit-service:8080"),
		SMSProviderURL:    getEnv("SMS_PROVIDER_URL", ""),
		SMSProviderKey:    getEnv("SMS_PROVIDER_KEY", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	log.Println("Starting 54Bank Escrow Service...")

	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// Load configuration
	cfg := loadConfig()

	// Initialize database connection
	ctx := context.Background()
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to create database pool: %v", err)
	}
	defer dbPool.Close()

	// Verify database connection (non-fatal — service starts in degraded mode if DB unavailable)
	if err := dbPool.Ping(ctx); err != nil {
		log.Printf("WARNING: database ping failed: %v — service starting in degraded mode", err)
	} else {
		log.Println("Connected to PostgreSQL database")
	}

	// Initialize CoA Client
	coaClient = NewCoAClient()

	// Initialize TigerBeetle client
	tbClient, err := initTigerBeetleClient(cfg.TigerBeetleAddr)
	if err != nil {
		log.Printf("Warning: Failed to connect to TigerBeetle: %v", err)
		// Continue without TigerBeetle for development
	} else {
		log.Println("Connected to TigerBeetle ledger")
	}

	// Initialize Temporal client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalAddr,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		log.Printf("Warning: Failed to connect to Temporal: %v", err)
		// Continue without Temporal for development
	} else {
		defer temporalClient.Close()
		log.Println("Connected to Temporal workflow engine")
	}

	// Initialize ID generator
	// idGenerator := NewIDGenerator()

	// Initialize external service clients
	kycService := NewKYCServiceClient(cfg.KYCServiceURL)
	fraudService := NewFraudServiceClient(cfg.FraudServiceURL)
	notificationSvc := NewNotificationServiceClient(cfg.NotificationURL)
	auditService := NewAuditServiceClient(cfg.AuditServiceURL)

	// Initialize escrow service
	escrowService := NewEscrowService(
		dbPool,
		tbClient,
		// idGenerator,
		kycService,
		fraudService,
		notificationSvc,
		auditService,
	)
	log.Println("Initialized escrow service")

	// Initialize USSD service
	ussdService := NewUSSDEscrowService(escrowService)
	log.Println("Initialized USSD escrow service")

	// Initialize SMS service
	smsProvider := NewSMSProvider(cfg.SMSProviderURL, cfg.SMSProviderKey)
	smsService := NewSMSEscrowService(smsProvider, escrowService)
	log.Println("Initialized SMS escrow service")

	// Initialize reporting service
	// reportingService := NewReportingService(dbPool)
	// log.Println("Initialized reporting service")

	// Start Temporal worker
	if temporalClient != nil {
		w := worker.New(temporalClient, cfg.TemporalTaskQueue, worker.Options{})

		// Register workflows
		w.RegisterWorkflow(EscrowLifecycleWorkflow)
		w.RegisterWorkflow(MilestoneProcessingWorkflow)
		w.RegisterWorkflow(DisputeResolutionWorkflow)

		// Register activities
		activities := NewEscrowActivities(escrowService, kycService, fraudService, notificationSvc, auditService)
		w.RegisterActivity(activities)

		// Start worker in background
		go func() {
			if err := w.Run(worker.InterruptCh()); err != nil {
				log.Printf("Temporal worker error: %v", err)
			}
		}()
		log.Println("Started Temporal workflow worker")
	}

	// Initialize API
	api := NewEscrowAPI(escrowService, ussdService, smsService)
	router := api.SetupRoutes()

	// Add metrics endpoint
	router.Handle("/metrics", promhttp.Handler())

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Escrow service listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down escrow service...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Escrow service stopped")
}

// TigerBeetle client initialization stub
func initTigerBeetleClient(addr string) (tigerbeetle.Client, error) {
	// In production, use actual TigerBeetle client
	// For now, return nil to allow service to start without TigerBeetle
	return nil, nil
}

// Service client implementations

type kycServiceClient struct {
	baseURL string
}

func NewKYCServiceClient(baseURL string) KYCService {
	return &kycServiceClient{baseURL: baseURL}
}

func (c *kycServiceClient) VerifyUser(ctx context.Context, userID string) (bool, int, error) {
	// Implementation would call KYC service
	// For now, return default verified with level 3
	return true, 3, nil
}

func (c *kycServiceClient) VerifyBusiness(ctx context.Context, businessID string) (bool, int, error) {
	// Implementation would call KYC service
	// For now, return default verified with level 3
	return true, 3, nil
}

type fraudServiceClient struct {
	baseURL string
}

func NewFraudServiceClient(baseURL string) FraudService {
	return &fraudServiceClient{baseURL: baseURL}
}

func (c *fraudServiceClient) ScoreEscrow(ctx context.Context, contract *EscrowContract) (float64, []string, error) {
	// Implementation would call fraud service
	// For now, return low risk score and no alerts
	return 0.1, []string{}, nil
}

func (c *fraudServiceClient) CheckParty(ctx context.Context, partyID string) (bool, error) {
	// Implementation would call fraud service
	// For now, return true (party is safe)
	return true, nil
}

type notificationServiceClient struct {
	baseURL string
}

func NewNotificationServiceClient(baseURL string) NotificationService {
	return &notificationServiceClient{baseURL: baseURL}
}

func (c *notificationServiceClient) SendNotification(ctx context.Context, userID string, notification interface{}) error {
	// Implementation would call notification service
	log.Printf("Sending notification to user %s: %+v", userID, notification)
	return nil
}

func (c *notificationServiceClient) SendSMS(ctx context.Context, phone, message string) error {
	// Implementation would call notification service
	log.Printf("Sending SMS to %s: %s", phone, message)
	return nil
}

func (c *notificationServiceClient) SendEmail(ctx context.Context, email, subject, body string) error {
	// Implementation would call notification service
	log.Printf("Sending email to %s: %s", email, subject)
	return nil
}

type auditServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewAuditServiceClient(baseURL string) AuditService {
	return &auditServiceClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// LogEvent persists the event to the audit-service (POST /audits, the same
// append-only audit trail used platform-wide). W7-C-14: previously every
// escrow audit event was silently discarded here. Failures are logged AND
// returned so callers can decide whether the operation may proceed.
func (c *auditServiceClient) LogEvent(ctx context.Context, event AuditEvent) error {
	payload := map[string]interface{}{
		"actor_id":   event.ActorID,
		"tenant_id":  event.TenantID,
		"event_type": event.EventType,
		"event_data": map[string]interface{}{
			"entity_type":    event.EntityType,
			"entity_id":      event.EntityID,
			"actor_type":     event.ActorType,
			"details":        event.Details,
			"previous_state": event.PreviousState,
			"new_state":      event.NewState,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[audit] failed to marshal audit event %s/%s: %v", event.EntityType, event.EventType, err)
		return fmt.Errorf("marshal audit event: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/audits", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build audit request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[audit] failed to deliver audit event %s/%s: %v", event.EntityType, event.EventType, err)
		return fmt.Errorf("deliver audit event: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("[audit] audit service rejected event %s/%s: status %d", event.EntityType, event.EventType, resp.StatusCode)
		return fmt.Errorf("audit service returned status %d", resp.StatusCode)
	}
	return nil
}

// SMS Provider implementation

type smsProviderImpl struct {
	baseURL string
	apiKey  string
}

func NewSMSProvider(baseURL, apiKey string) SMSProvider {
	return &smsProviderImpl{
		baseURL: baseURL,
		apiKey:  apiKey,
	}
}

func (p *smsProviderImpl) SendSMS(ctx context.Context, phone, message string) error {
	// Implementation would call SMS provider API
	log.Printf("SMS to %s: %s", phone, message)
	return nil
}

func (p *smsProviderImpl) SendBulkSMS(ctx context.Context, phones []string, message string) error {
	for _, phone := range phones {
		if err := p.SendSMS(ctx, phone, message); err != nil {
			return err
		}
	}
	return nil
}

// Escrow Activities for Temporal

type EscrowActivities struct {
	escrowService   *EscrowService
	kycService      KYCService
	fraudService    FraudService
	notificationSvc NotificationService
	auditService    AuditService
}

func NewEscrowActivities(
	escrowSvc *EscrowService,
	kycSvc KYCService,
	fraudSvc FraudService,
	notifSvc NotificationService,
	auditSvc AuditService,
) *EscrowActivities {
	return &EscrowActivities{
		escrowService:   escrowSvc,
		kycService:      kycSvc,
		fraudService:    fraudSvc,
		notificationSvc: notifSvc,
		auditService:    auditSvc,
	}
}

func (a *EscrowActivities) VerifyKYC(ctx context.Context, input KYCInput) (*KYCVerificationResult, error) {
	buyerVerified, buyerLevel, err := a.kycService.VerifyUser(ctx, input.BuyerID)
	if err != nil {
		return nil, err
	}

	sellerVerified, sellerLevel, err := a.kycService.VerifyUser(ctx, input.SellerID)
	if err != nil {
		return nil, err
	}

	return &KYCVerificationResult{
		BuyerVerified:  buyerVerified,
		SellerVerified: sellerVerified,
		BuyerLevel:     buyerLevel,
		SellerLevel:    sellerLevel,
	}, nil
}

func (a *EscrowActivities) PerformFraudCheck(ctx context.Context, input FraudCheckInput) (*FraudCheckResult, error) {
	// Create a dummy contract for fraud check
	contract := &EscrowContract{
		TotalAmount: input.Amount,
	}
	riskScore, alerts, err := a.fraudService.ScoreEscrow(ctx, contract)
	if err != nil {
		return nil, err
	}

	return &FraudCheckResult{
		RiskScore:        riskScore,
		BlockTransaction: riskScore > 0.8,
		Alerts:           alerts,
	}, nil
}

func (a *EscrowActivities) ReleaseFunds(ctx context.Context, input ReleaseInput) (*ReleaseResult, error) {
	txn, err := a.escrowService.ReleaseContract(ctx, input.ContractID, "system", "Workflow release")
	if err != nil {
		return nil, err
	}

	return &ReleaseResult{
		ReleasedAmount: txn.Amount,
		FeeAmount:      0, // Fee calculated separately
		TransactionID:  txn.ID,
	}, nil
}

func (a *EscrowActivities) RefundFunds(ctx context.Context, input RefundInput) error {
	_, err := a.escrowService.RefundContract(ctx, input.ContractID, "system", input.Reason)
	return err
}

func (a *EscrowActivities) SendNotification(ctx context.Context, input NotificationInput) error {
	// Send notification to each user
	for _, userID := range input.UserIDs {
		if err := a.notificationSvc.SendNotification(ctx, userID, map[string]interface{}{
			"type":    input.Type,
			"message": input.Message,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (a *EscrowActivities) RecordAuditLog(ctx context.Context, input AuditLogInput) error {
	return a.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   input.TenantID,
		EntityType: input.EntityType,
		EntityID:   input.EntityID,
		EventType:  input.Action,
		ActorID:    input.ActorID,
		ActorType:  "system",
		Details:    input.Details,
	})
}

func (a *EscrowActivities) VerifyMilestoneDocuments(ctx context.Context, input MilestoneVerifyInput) (*MilestoneVerifyResult, error) {
	// Implementation would verify documents
	return &MilestoneVerifyResult{
		Verified: true,
	}, nil
}

func (a *EscrowActivities) ProcessMilestoneRelease(ctx context.Context, input MilestoneReleaseInput) (*MilestoneReleaseResult, error) {
	// Implementation would process milestone release
	return &MilestoneReleaseResult{
		ReleasedAmount: input.Amount,
		TransactionID:  fmt.Sprintf("MS-TXN-%d", time.Now().Unix()),
	}, nil
}

func (a *EscrowActivities) EscalateDispute(ctx context.Context, input EscalateInput) error {
	// W7-C-05: real escalation — state transition to "escalated", audit event
	// and party notifications all happen inside EscrowService.EscalateDispute.
	// Errors propagate so Temporal retries instead of silently succeeding.
	_, err := a.escrowService.EscalateDispute(ctx, input.DisputeID, input.Reason)
	return err
}

func (a *EscrowActivities) CalculateFee(ctx context.Context, input FeeInput) (*FeeResult, error) {
	// Default 1.5% fee
	feeAmount := input.Amount * 0.015
	return &FeeResult{
		FeeAmount: feeAmount,
		FeeType:   "percentage",
	}, nil
}

// Additional types needed

type KYCResult struct {
	Verified bool
	Level    int
}

type FraudResult struct {
	RiskScore float64
	Approved  bool
	Alerts    []string
}

type Notification struct {
	Type    string
	UserIDs []string
	Message string
}
