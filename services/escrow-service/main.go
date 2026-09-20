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
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
	"go.opentelemetry.io/otel/attribute"

	"shared/otel/go/otelkit"
)

var coaClient *CoAClient

// Config holds service configuration
type Config struct {
	Port            string
	DatabaseURL     string
	TigerBeetleAddr string
	// OR-19/W2 (Wave-10): Temporal configuration was removed — the registered
	// workflows were never started and their milestone/dispute activities
	// fabricated state (see below). Escrow lifecycle automation is the
	// database-backed sweeper in runEscrowLifecycleSweeper (F11-02).
	KYCServiceURL   string
	FraudServiceURL string
	NotificationURL string
	AuditServiceURL string
	SMSProviderURL  string
	SMSProviderKey  string
}

func loadConfig() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", getEnv("DATABASE_URI", "postgres://localhost:5432/escrow")),
		TigerBeetleAddr: getEnv("TB_ADDRESS", getEnv("TIGERBEETLE_ADDR", "localhost:3000")),
		KYCServiceURL:   getEnv("KYC_SERVICE_URL", "http://kyc-service:8080"),
		FraudServiceURL: getEnv("FRAUD_SERVICE_URL", "http://fraud-service:8080"),
		NotificationURL: getEnv("NOTIFICATION_URL", "http://notification-service:8080"),
		AuditServiceURL: getEnv("AUDIT_SERVICE_URL", "http://audit-service:8080"),
		SMSProviderURL:  getEnv("SMS_PROVIDER_URL", ""),
		SMSProviderKey:  getEnv("SMS_PROVIDER_KEY", ""),
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
	shutdown, oerr := otelkit.Init(context.Background(), "escrow-service")
	if oerr != nil {
		log.Fatalf("otelkit init: %v", oerr)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if serr := shutdown(sctx); serr != nil {
			log.Printf("otelkit shutdown: %v", serr)
		}
	}()

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

	// OR-19/W2 (Wave-10): the Temporal client dial, worker and workflow
	// registrations were REMOVED. The three registered workflows
	// (EscrowLifecycleWorkflow/MilestoneProcessingWorkflow/DisputeResolutionWorkflow)
	// were never started (zero ExecuteWorkflow call sites), waited on signals
	// no component ever sent, and two of their activities fabricated state
	// (VerifyMilestoneDocuments always returned verified; ProcessMilestoneRelease
	// minted a fake transaction id without moving money; the dispute workflow
	// auto-split funds 50/50 after a timer with no human decision). Starting
	// them would have created phantom automation racing the synchronous HTTP
	// money paths. Escrow lifecycle automation is now the DB-backed sweeper
	// (F11-02) started below — real, atomic, and idempotent.

	// Initialize ID generator
	// idGenerator := NewIDGenerator()

	// Initialize external service clients
	kycService := NewKYCServiceClient(cfg.KYCServiceURL)
	fraudService := NewFraudServiceClient(cfg.FraudServiceURL)
	notificationSvc := NewNotificationServiceClient(cfg.NotificationURL)
	auditService := NewAuditServiceClient(cfg.AuditServiceURL)
	auditService = auditShipCountingService{inner: auditService} // telemetry: audit_ship_failures_total

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

	// F11-02 (Wave-10): start the escrow lifecycle sweeper — expires unfunded
	// contracts past their funding deadline and auto-releases funded contracts
	// whose auto_release_after_days has elapsed (via the atomic, idempotent,
	// fail-closed ReleaseContract path). This replaces the deleted Temporal
	// registrations with automation that actually runs.
	sweeperCtx, stopSweeper := context.WithCancel(context.Background())
	defer stopSweeper()
	go runEscrowLifecycleSweeper(sweeperCtx, escrowService)

	// Initialize API
	api := NewEscrowAPI(escrowService, ussdService, smsService)
	router := api.SetupRoutes()

	// Add metrics endpoint
	router.Handle("/metrics", promhttp.Handler())

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      otelkit.HTTPMiddleware(router),
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

// initTigerBeetleClient connects to the TigerBeetle cluster. F1-03: this used
// to be a stub returning (nil, nil), so every `if s.tbClient != nil` money
// guard was dead in every deployment and fund/release/refund stamped terminal
// statuses without moving a single kobo. The client is now real; money
// handlers fail closed when it is unavailable.
func initTigerBeetleClient(addr string) (tigerbeetle.Client, error) {
	clusterID := types.ToUint128(0) // TB_CLUSTER_ID reserved; cluster 0 is the fleet default
	addresses := strings.Split(addr, ",")
	for i := range addresses {
		addresses[i] = strings.TrimSpace(addresses[i])
	}
	return tigerbeetle.NewClient(clusterID, addresses)
}

// Service client implementations

type kycServiceClient struct {
	baseURL string
}

func NewKYCServiceClient(baseURL string) KYCService {
	return &kycServiceClient{baseURL: baseURL}
}

// VerifyUser previously fabricated `true, 3, nil` for every party (F1-04) —
// every escrow counterparty appeared "KYC level 3 verified" without any check.
// No kyc-service with a verified endpoint contract exists in the fleet (the
// default KYC_SERVICE_URL is dangling), so the honest behavior is to report
// the verification as unavailable: CreateContract records the party as
// UNVERIFIED and logs the outage. Re-enable with a real call once a KYC
// endpoint contract is adopted.
func (c *kycServiceClient) VerifyUser(ctx context.Context, userID string) (bool, int, error) {
	return false, 0, fmt.Errorf("kyc verification unavailable: no verified kyc-service endpoint contract (F1-04); party %s recorded unverified", userID)
}

func (c *kycServiceClient) VerifyBusiness(ctx context.Context, businessID string) (bool, int, error) {
	return false, 0, fmt.Errorf("kyc verification unavailable: no verified kyc-service endpoint contract (F1-04); business %s recorded unverified", businessID)
}

type fraudServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewFraudServiceClient(baseURL string) FraudService {
	return &fraudServiceClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// ScoreEscrow performs a REAL fraud check against fraud-service
// (POST /api/v1/fraud/check — contract verified against
// services/fraud-service/main.py). F1-04: the previous stub always returned
// score 0.1 with no alerts, so the fraud gate in CreateContract never fired.
// Fail-closed: any transport/contract failure returns an error and
// CreateContract refuses to create the escrow unscored.
func (c *fraudServiceClient) ScoreEscrow(ctx context.Context, contract *EscrowContract) (float64, []string, error) {
	buyerID := contract.CreatedBy
	for _, p := range contract.Parties {
		if p.Role == RoleBuyer && p.UserID != nil {
			buyerID = *p.UserID
			break
		}
	}
	payload := map[string]interface{}{
		"transaction_id":   contract.ID,
		"customer_id":      buyerID,
		"tenant_id":        contract.TenantID,
		"amount":           contract.TotalAmount,
		"currency":         contract.Currency,
		"transaction_type": "escrow_funding",
		"metadata": map[string]interface{}{
			"contract_id": contract.ID,
			"use_case":    string(contract.UseCase),
			"source":      "escrow-service",
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, fmt.Errorf("marshal fraud check: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/fraud/check", bytes.NewReader(body))
	if err != nil {
		return 0, nil, fmt.Errorf("build fraud check request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", contract.TenantID)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("fraud check request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return 0, nil, fmt.Errorf("fraud service returned status %d", resp.StatusCode)
	}
	var result struct {
		FraudScore        float64  `json:"fraud_score"` // 0-100
		RiskLevel         string   `json:"risk_level"`
		RecommendedAction string   `json:"recommended_action"`
		FraudIndicators   []string `json:"fraud_indicators"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, nil, fmt.Errorf("decode fraud check response: %w", err)
	}
	if result.RecommendedAction == "block" {
		result.FraudScore = 100 // honour the service's explicit block decision
	}
	return result.FraudScore / 100.0, result.FraudIndicators, nil
}

// CheckParty: fraud-service exposes no party-screening endpoint. Honest error
// instead of the previous fabricated `true` (F1-04). Currently unused.
func (c *fraudServiceClient) CheckParty(ctx context.Context, partyID string) (bool, error) {
	return false, fmt.Errorf("party screening not available: fraud-service has no party-screening endpoint (F1-04)")
}

type notificationServiceClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewNotificationServiceClient(baseURL string) NotificationService {
	return &notificationServiceClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// sendNotification queues a real notification via notification-service
// (POST /notifications — contract verified against
// services/notification-service/handlers.py). F1-04: the previous stub only
// logged and returned nil, so every escrow lifecycle notification was
// silently dropped. Failures are now returned (and logged) instead of
// fabricated as sent.
func (c *notificationServiceClient) sendNotification(ctx context.Context, tenantID, userID, notifType, recipient, subject, message string) error {
	if tenantID == "" {
		if tid, ok := otelkit.TenantIDFromContext(ctx); ok {
			tenantID = tid
		}
	}
	if tenantID == "" {
		return fmt.Errorf("tenant id unavailable for notification to %s", userID)
	}
	payload := map[string]interface{}{
		"tenant_id": tenantID,
		"user_id":   userID,
		"type":      notifType,
		"recipient": recipient,
		"subject":   subject,
		"message":   message,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal notification: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/notifications", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build notification request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("ERROR: notification to user %s not delivered: %v", userID, err)
		return fmt.Errorf("deliver notification: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("ERROR: notification service rejected notification for user %s: status %d", userID, resp.StatusCode)
		return fmt.Errorf("notification service returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *notificationServiceClient) SendNotification(ctx context.Context, userID string, notification interface{}) error {
	msgBytes, _ := json.Marshal(notification)
	subject := "Escrow update"
	if m, ok := notification.(map[string]interface{}); ok {
		if t, ok := m["type"].(string); ok {
			subject = "Escrow: " + t
		}
	}
	// In-app mailbox notification; tenant is taken from the request context.
	return c.sendNotification(ctx, "", userID, "in_app", userID, subject, string(msgBytes))
}

func (c *notificationServiceClient) SendSMS(ctx context.Context, phone, message string) error {
	return c.sendNotification(ctx, "", phone, "sms", phone, "Escrow", message)
}

func (c *notificationServiceClient) SendEmail(ctx context.Context, email, subject, body string) error {
	return c.sendNotification(ctx, "", email, "email", email, subject, body)
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
	// AU-01 (F15-1): shared ingest credential; audit-service fails closed without it.
	if token := os.Getenv("AUDIT_INGEST_TOKEN"); token != "" {
		req.Header.Set("X-Audit-Ingest-Token", token)
	}
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

// OR-19/W2 (Wave-10): the Temporal EscrowActivities were deleted together
// with the workflow registrations. VerifyMilestoneDocuments always returned
// verified=true and ProcessMilestoneRelease minted a fabricated transaction id
// without moving money — registering them as Temporal activities would have
// been phantom automation. Real lifecycle automation is the sweeper in
// runEscrowLifecycleSweeper (F11-02).

// runEscrowLifecycleSweeper (F11-02) runs the escrow lifecycle maintenance
// loop every minute: expires unfunded contracts whose funding deadline has
// passed and auto-releases funded contracts whose auto_release_after_days
// window has elapsed (through the atomic, idempotent, fail-closed
// ReleaseContract path). Previously the `expired` status was unreachable and
// funded contracts stranded forever.
func runEscrowLifecycleSweeper(ctx context.Context, svc *EscrowService) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			svc.SweepEscrowLifecycle(sctx)
			cancel()
		}
	}
}

// auditShipCountingService decorates AuditService with telemetry: every failed
// LogEvent increments audit_ship_failures_total{service,tenant_id}
// (Wave-9 SPEC addendum; feeds the AuditShipFailureRate alert rule).
type auditShipCountingService struct{ inner AuditService }

func (a auditShipCountingService) LogEvent(ctx context.Context, event AuditEvent) error {
	err := a.inner.LogEvent(ctx, event)
	if err != nil {
		attrs := []attribute.KeyValue{attribute.String("service", "escrow-service")}
		if tid, ok := otelkit.TenantIDFromContext(ctx); ok {
			attrs = append(attrs, otelkit.TenantIDAttributeKV(tid))
		}
		otelkit.IncCounter(ctx, "audit_ship_failures_total", attrs...)
	}
	return err
}
