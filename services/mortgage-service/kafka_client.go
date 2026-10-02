package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/segmentio/kafka-go"
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
	brokers    []string
	producerID string
	mutex      sync.Mutex
	writer     *kafka.Writer // nil until a broker is reachable
	connected  bool
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

	// Probe broker reachability: when Kafka is down the client reports
	// connected=false and every publish fails fast (callers persist to the
	// outbox for retry) instead of pretending success.
	var writer *kafka.Writer
	connected := false
	for _, broker := range brokers {
		addr := strings.TrimPrefix(broker, "tcp://")
		addr = strings.TrimPrefix(addr, "kafka://")
		addr = strings.TrimPrefix(addr, "PLAINTEXT://")
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err == nil {
			conn.Close()
			connected = true
			break
		}
		log.Printf("Kafka broker %s unreachable: %v", broker, err)
	}
	if connected {
		// F1-09 (Wave-10): a REAL producer. The previous implementation only
		// buffered events in memory and the flusher discarded them with a log
		// line whenever the broker was reachable — every mortgage lifecycle
		// event evaporated while metrics claimed success.
		writer = kafka.NewWriter(kafka.WriterConfig{
			Brokers:      brokers,
			Balancer:     &kafka.Hash{}, // key by mortgage id: per-mortgage ordering
			BatchTimeout: 200 * time.Millisecond,
			RequiredAcks: 1,
			Async:        false,
		})
	} else {
		log.Printf("ERROR: no Kafka broker reachable (%v) — publishes will fail fast and events go to the outbox", brokers)
	}

	client := &KafkaClient{
		brokers:    brokers,
		producerID: fmt.Sprintf("mortgage-service-%d", time.Now().UnixNano()%10000),
		writer:     writer,
		connected:  connected,
	}

	log.Printf("Kafka client initialized: %v (connected=%v)", brokers, connected)
	return client
}

// PublishEvent publishes a mortgage event to Kafka with a real producer. It
// returns an error when the produce fails or the producer is unavailable —
// callers must handle it (PublishEventReliably does, via the outbox).
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

	c.mutex.Lock()
	writer := c.writer
	connected := c.connected
	c.mutex.Unlock()

	if !connected || writer == nil {
		kafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("kafka producer unavailable (brokers %v): event type %s not published", c.brokers, event.Type)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(event.MortgageID),
		Value: payload,
	}); err != nil {
		kafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("kafka produce to %s failed for event %s (mortgage %s): %w", topic, event.Type, event.MortgageID, err)
	}

	kafkaMessagesPublished.WithLabelValues(topic, "success").Inc()
	return nil
}

// PublishEventReliably publishes an event and, on ANY produce error, persists
// it to the mortgage_event_outbox table for retry. Every failure is logged;
// a financial event is never silently dropped. The returned error is non-nil
// only when the event could be neither published nor outboxed.
func (c *KafkaClient) PublishEventReliably(topic string, event MortgageEvent) error {
	err := c.PublishEvent(topic, event)
	if err == nil {
		return nil
	}
	log.Printf("ERROR: kafka publish failed (topic=%s type=%s mortgage=%s): %v — persisting to outbox for retry",
		topic, event.Type, event.MortgageID, err)
	if oerr := saveEventToOutbox(topic, event); oerr != nil {
		log.Printf("ALERT: outbox persistence failed for event %s (mortgage %s): %v — EVENT AT RISK OF LOSS",
			event.Type, event.MortgageID, oerr)
		kafkaMessagesPublished.WithLabelValues(topic, "outbox_error").Inc()
		return fmt.Errorf("publish failed (%v) and outbox persist failed: %w", err, oerr)
	}
	kafkaMessagesPublished.WithLabelValues(topic, "outboxed").Inc()
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

// Close marks the producer disconnected and closes the underlying writer,
// flushing any in-flight batches. PublishEvent is synchronous (Async=false),
// so a completed PublishEvent is durably acknowledged; there is no hidden
// buffer to drain (F1-09).
func (c *KafkaClient) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.connected = false
	if c.writer != nil {
		if err := c.writer.Close(); err != nil {
			return fmt.Errorf("close kafka writer: %w", err)
		}
		c.writer = nil
	}
	log.Println("Kafka client closed")
	return nil
}

// PublishEventOrAlert publishes through PublishEventReliably and surfaces a
// terminal failure (neither published nor outboxed) with an ALERT log line.
// OR-17/T13 (Wave-10): the 18 lifecycle call sites previously discarded the
// returned error, so the last-resort failure mode was invisible.
func PublishEventOrAlert(c *KafkaClient, topic string, event MortgageEvent) {
	if err := c.PublishEventReliably(topic, event); err != nil {
		log.Printf("ALERT: mortgage event lost — publish and outbox both failed (topic=%s type=%s mortgage=%s): %v",
			topic, event.Type, event.MortgageID, err)
	}
}

// IsConnected returns connection status
func (c *KafkaClient) IsConnected() bool {
	c.mutex.Lock()
	defer c.mutex.Unlock()
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
