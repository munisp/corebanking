package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Kafka metrics
var (
	kafkaMessagesPublished = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_messages_published_total",
			Help: "Total Kafka messages published",
		},
		[]string{"topic", "status"},
	)

	kafkaPublishLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "kafka_publish_latency_seconds",
			Help:    "Kafka publish latency",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
		},
		[]string{"topic"},
	)
)

func init() {
	prometheus.MustRegister(kafkaMessagesPublished)
	prometheus.MustRegister(kafkaPublishLatency)
}

// MortgageEvent represents a mortgage domain event
type MortgageEvent struct {
	Type          string                 `json:"type"`
	MortgageID    string                 `json:"mortgage_id"`
	TenantID      string                 `json:"tenant_id"`
	Status        string                 `json:"status,omitempty"`
	Amount        float64                `json:"amount,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	CausationID   string                 `json:"causation_id,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// KafkaClient handles Kafka operations for mortgage events
type KafkaClient struct {
	brokers       []string
	producerID    string
	mutex         sync.RWMutex
	connected     bool
	eventBuffer   []bufferedEvent
	bufferSize    int
	flushInterval time.Duration
}

type bufferedEvent struct {
	topic   string
	event   MortgageEvent
	created time.Time
}

// Kafka topics for mortgage events
const (
	TopicMortgageApplications    = "mortgages.applications"
	TopicMortgageUnderwriting    = "mortgages.underwriting"
	TopicMortgageApprovals       = "mortgages.approvals"
	TopicMortgageOffers          = "mortgages.offers"
	TopicMortgageDisbursements   = "mortgages.disbursements"
	TopicMortgagePayments        = "mortgages.payments"
	TopicMortgagePrepayments     = "mortgages.prepayments"
	TopicMortgageValuations      = "mortgages.valuations"
	TopicMortgageTitleVerify     = "mortgages.title-verification"
	TopicMortgageNHF             = "mortgages.nhf"
	TopicMortgageProperties      = "mortgages.properties"
	TopicMortgageCreditCommittee = "mortgages.credit-committee"
	TopicMortgageRestructuring   = "mortgages.restructuring"
	TopicMortgageForbearance     = "mortgages.forbearance"
	TopicMortgageRefinancing     = "mortgages.refinancing"
	TopicMortgageDefault         = "mortgages.default"
	TopicMortgageForeclosure     = "mortgages.foreclosure"
	TopicMortgageAudit           = "mortgages.audit"
)

// NewKafkaClient creates a new Kafka client
func NewKafkaClient() *KafkaClient {
	brokersEnv := os.Getenv("KAFKA_BROKERS")
	brokers := []string{"kafka.kafka.svc.cluster.local:9092"}
	if brokersEnv != "" {
		brokers = []string{brokersEnv}
	}

	client := &KafkaClient{
		brokers:       brokers,
		producerID:    fmt.Sprintf("mortgage-service-%d", time.Now().UnixNano()%10000),
		connected:     true, // Simulated connection
		eventBuffer:   make([]bufferedEvent, 0),
		bufferSize:    100,
		flushInterval: time.Second * 5,
	}

	// Start background flusher
	go client.backgroundFlusher()

	log.Printf("Kafka client initialized: %v", brokers)
	return client
}

// PublishEvent publishes a mortgage event to Kafka
func (c *KafkaClient) PublishEvent(topic string, event MortgageEvent) error {
	start := time.Now()
	defer func() {
		kafkaPublishLatency.WithLabelValues(topic).Observe(time.Since(start).Seconds())
	}()

	// Add correlation ID if not present
	if event.CorrelationID == "" {
		event.CorrelationID = generateCorrelationID()
	}

	// Serialize event
	payload, err := json.Marshal(event)
	if err != nil {
		kafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("failed to serialize event: %w", err)
	}

	// In production, this would use actual Kafka producer
	// For now, log and buffer
	log.Printf("Publishing to %s: %s", topic, string(payload))

	c.mutex.Lock()
	c.eventBuffer = append(c.eventBuffer, bufferedEvent{
		topic:   topic,
		event:   event,
		created: time.Now(),
	})
	c.mutex.Unlock()

	kafkaMessagesPublished.WithLabelValues(topic, "success").Inc()

	return nil
}

// PublishEventAsync publishes an event asynchronously
func (c *KafkaClient) PublishEventAsync(topic string, event MortgageEvent) {
	go func() {
		if err := c.PublishEvent(topic, event); err != nil {
			log.Printf("Failed to publish event: %v", err)
		}
	}()
}

// PublishBatch publishes multiple events in a batch
func (c *KafkaClient) PublishBatch(topic string, events []MortgageEvent) error {
	for _, event := range events {
		if err := c.PublishEvent(topic, event); err != nil {
			return err
		}
	}
	return nil
}

// backgroundFlusher periodically flushes the event buffer
func (c *KafkaClient) backgroundFlusher() {
	ticker := time.NewTicker(c.flushInterval)
	defer ticker.Stop()

	for range ticker.C {
		c.flushBuffer()
	}
}

// flushBuffer flushes buffered events
func (c *KafkaClient) flushBuffer() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if len(c.eventBuffer) == 0 {
		return
	}

	// In production, batch send to Kafka
	log.Printf("Flushing %d buffered events", len(c.eventBuffer))
	c.eventBuffer = make([]bufferedEvent, 0)
}

// Subscribe subscribes to a topic (for consuming events)
func (c *KafkaClient) Subscribe(ctx context.Context, topic string, handler func(MortgageEvent) error) error {
	log.Printf("Subscribed to topic: %s", topic)

	// In production, this would use actual Kafka consumer
	// For now, just log
	go func() {
		<-ctx.Done()
		log.Printf("Unsubscribed from topic: %s", topic)
	}()

	return nil
}

// Close closes the Kafka client
func (c *KafkaClient) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.connected = false
	c.flushBuffer()
	log.Println("Kafka client closed")
	return nil
}

// IsConnected returns connection status
func (c *KafkaClient) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.connected
}

// Helper functions
func generateCorrelationID() string {
	return fmt.Sprintf("corr-%d", time.Now().UnixNano())
}

// Event type constants for mortgage lifecycle
const (
	// Application events
	EventApplicationCreated   = "mortgage.application.created"
	EventApplicationSubmitted = "mortgage.application.submitted"
	EventApplicationUpdated   = "mortgage.application.updated"

	// Pre-qualification events
	EventPreQualificationStarted   = "mortgage.prequalification.started"
	EventPreQualificationCompleted = "mortgage.prequalification.completed"
	EventPreQualificationFailed    = "mortgage.prequalification.failed"

	// Underwriting events
	EventUnderwritingStarted   = "mortgage.underwriting.started"
	EventUnderwritingCompleted = "mortgage.underwriting.completed"
	EventUnderwritingReferred  = "mortgage.underwriting.referred"

	// Credit committee events
	EventCreditCommitteeSubmitted = "mortgage.credit_committee.submitted"
	EventCreditCommitteeApproved  = "mortgage.credit_committee.approved"
	EventCreditCommitteeDeclined  = "mortgage.credit_committee.declined"

	// Approval events
	EventApplicationApproved = "mortgage.application.approved"
	EventApplicationDeclined = "mortgage.application.declined"

	// Offer events
	EventOfferIssued   = "mortgage.offer.issued"
	EventOfferAccepted = "mortgage.offer.accepted"
	EventOfferRejected = "mortgage.offer.rejected"
	EventOfferExpired  = "mortgage.offer.expired"

	// Disbursement events
	EventDisbursementInitiated = "mortgage.disbursement.initiated"
	EventDisbursementCompleted = "mortgage.disbursement.completed"
	EventDisbursementFailed    = "mortgage.disbursement.failed"

	// Payment events
	EventPaymentReceived  = "mortgage.payment.received"
	EventPaymentProcessed = "mortgage.payment.processed"
	EventPaymentFailed    = "mortgage.payment.failed"
	EventPaymentReversed  = "mortgage.payment.reversed"

	// Prepayment events
	EventPrepaymentReceived  = "mortgage.prepayment.received"
	EventPrepaymentProcessed = "mortgage.prepayment.processed"

	// Arrears events
	EventArrearsDetected  = "mortgage.arrears.detected"
	EventArrearsCleared   = "mortgage.arrears.cleared"
	EventArrearsEscalated = "mortgage.arrears.escalated"

	// Default events
	EventDefaultDeclared = "mortgage.default.declared"
	EventDefaultCured    = "mortgage.default.cured"

	// Foreclosure events
	EventForeclosureInitiated = "mortgage.foreclosure.initiated"
	EventForeclosureCompleted = "mortgage.foreclosure.completed"
	EventForeclosureCancelled = "mortgage.foreclosure.cancelled"

	// Restructuring events
	EventRestructuringRequested = "mortgage.restructuring.requested"
	EventRestructuringApproved  = "mortgage.restructuring.approved"
	EventRestructuringCompleted = "mortgage.restructuring.completed"

	// Forbearance events
	EventForbearanceRequested = "mortgage.forbearance.requested"
	EventForbearanceApproved  = "mortgage.forbearance.approved"
	EventForbearanceEnded     = "mortgage.forbearance.ended"

	// Property events
	EventPropertyAdded     = "mortgage.property.added"
	EventPropertyUpdated   = "mortgage.property.updated"
	EventValuationReceived = "mortgage.valuation.received"
	EventTitleVerified     = "mortgage.title.verified"

	// NHF events
	EventNHFVerified    = "mortgage.nhf.verified"
	EventNHFContributed = "mortgage.nhf.contributed"

	// Settlement events
	EventMortgageSettled = "mortgage.settled"
	EventMortgageClosed  = "mortgage.closed"
)

// PublishApplicationEvent publishes an application lifecycle event
func (c *KafkaClient) PublishApplicationEvent(eventType string, app *MortgageApplication) error {
	event := MortgageEvent{
		Type:       eventType,
		MortgageID: app.ID,
		TenantID:   app.TenantID,
		Status:     string(app.Status),
		Amount:     app.RequestedAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"application_number": app.ApplicationNumber,
			"product_type":       app.ProductType,
			"applicant_id":       app.PrimaryApplicantID,
		},
	}
	return c.PublishEvent(TopicMortgageApplications, event)
}

// PublishPaymentEvent publishes a payment event
func (c *KafkaClient) PublishPaymentEvent(eventType string, payment *MortgagePayment) error {
	event := MortgageEvent{
		Type:       eventType,
		MortgageID: payment.MortgageID,
		TenantID:   payment.TenantID,
		Amount:     payment.PaidAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"payment_id":     payment.ID,
			"payment_number": payment.PaymentNumber,
			"status":         payment.Status,
		},
	}
	return c.PublishEvent(TopicMortgagePayments, event)
}

// PublishAuditEvent publishes an audit event
func (c *KafkaClient) PublishAuditEvent(mortgageID, tenantID, action, actor string, details map[string]interface{}) error {
	event := MortgageEvent{
		Type:       "mortgage.audit." + action,
		MortgageID: mortgageID,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"action":  action,
			"actor":   actor,
			"details": details,
		},
	}
	return c.PublishEvent(TopicMortgageAudit, event)
}
