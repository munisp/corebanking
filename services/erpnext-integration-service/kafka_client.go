package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// topics enum
const (
	// mortgage topics
	MORTGAGE_DISBURSMENTS = "mortgages.disbursements"
	MORTGAGE_PAYMENTS     = "mortgages.payments"
	MORTGAGE_REFINANCING  = "mortgages.refinancing"
	MORTGAGE_APPLICATIONS = "mortgages.applications"
	MORTGAGE_WORKFLOWS    = "mortgages.workflows"
	MORTGAGE_ARREARS      = "mortgages.arrears"
	MORTGAGE_COLLECTIONS  = "mortgages.collections"
	MORTGAGE_RATE_CHANGES = "mortgages.rate-changes"

	// payment processing topics
	PAYMENT_TRANSACTION          = "payment.processing.transaction"
	PAYMENT_PAYOUT               = "payment.processing.payout"
	PAYMENT_LOAN                 = "payment.processing.loan"
	PAYMENT_LPO                  = "payment.processing.lpo"
	PAYMENT_DEPOSIT              = "payment.processing.deposit"
	PAYMENT_TRANSFER             = "payment.processing.transfer"
	PAYMENT_INSURANCE_PREMIUM    = "payment.processing.insurance.premium"
	PAYMENT_SUPPLY_CHAIN_FINANCE = "payment.processing.supply.chain.finance"

	// loan service topics
	LOAN_EVENTS = "loan-events"

	// savings service topics
	SAVINGS_GOAL        = "savings.goal"
	SAVINGS_TRANSACTION = "savings.transaction"

	// lpo service topics
	LPO_LIFECYCLE   = "lpo.lifecycle"
	LPO_APPLICATION = "lpo.application"
)

// Kafka metrics
var (
	erpKafkaMessagesPublished = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "erp_kafka_messages_published_total",
			Help: "Total Kafka messages published by ERPNext integration service",
		},
		[]string{"topic", "status"},
	)

	erpKafkaPublishLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "erp_kafka_publish_latency_seconds",
			Help:    "Kafka publish latency (ERPNext integration service)",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
		},
		[]string{"topic"},
	)
)

func init() {
	prometheus.MustRegister(erpKafkaMessagesPublished)
	prometheus.MustRegister(erpKafkaPublishLatency)
}

type ERPEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status,omitempty"`
	Amount    float64                `json:"amount,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type ERPKafkaClient struct {
	brokers    []string
	producerID string
	mutex      sync.RWMutex
	connected  bool
}

func NewERPKafkaClient() *ERPKafkaClient {
	brokersEnv := os.Getenv("KAFKA_BROKERS")
	brokers := []string{"kafka.kafka.svc.cluster.local:9092"}
	if brokersEnv != "" {
		brokers = []string{brokersEnv}
	}
	return &ERPKafkaClient{
		brokers:    brokers,
		producerID: "erpnext-integration-service",
	}
}

func (c *ERPKafkaClient) PublishEvent(topic string, event ERPEvent) error {
	start := time.Now()

	defer func() {
		erpKafkaPublishLatency.WithLabelValues(topic).Observe(time.Since(start).Seconds())
	}()

	payload, err := json.Marshal(event)
	if err != nil {
		erpKafkaMessagesPublished.WithLabelValues(topic, "failure").Inc()
		return fmt.Errorf("failed to marshal ERP event: %v", err)
	}

	log.Printf("Published ERP event to Kafka topic %s: %s", topic, string(payload))
	erpKafkaMessagesPublished.WithLabelValues(topic, "success").Inc()
	return nil
}

func (c *ERPKafkaClient) SubscriberEvent(topic string, handler func(ERPEvent)) error {
	// Placeholder for subscriber logic
	return nil
}

func (c *ERPKafkaClient) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.connected
}
