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

// Kafka metrics
var (
	eduKafkaMessagesPublished = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "edu_kafka_messages_published_total",
			Help: "Total Kafka messages published by education-loan service",
		},
		[]string{"topic", "status"},
	)

	eduKafkaPublishLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "edu_kafka_publish_latency_seconds",
			Help:    "Kafka publish latency (education-loan service)",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
		},
		[]string{"topic"},
	)
)

func init() {
	prometheus.MustRegister(eduKafkaMessagesPublished)
	prometheus.MustRegister(eduKafkaPublishLatency)
}

type EduEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status,omitempty"`
	Amount    float64                `json:"amount,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type EduKafkaClient struct {
	brokers    []string
	producerID string
	mutex      sync.RWMutex
	connected  bool
}

func NewEduKafkaClient() *EduKafkaClient {
	brokersEnv := os.Getenv("KAFKA_BROKERS")
	brokers := []string{"kafka.kafka.svc.cluster.local:9092"}
	if brokersEnv != "" {
		brokers = []string{brokersEnv}
	}
	return &EduKafkaClient{
		brokers:    brokers,
		producerID: fmt.Sprintf("edu-loan-service-%d", time.Now().UnixNano()%10000),
		connected:  true,
	}
}

func (c *EduKafkaClient) PublishEvent(topic string, event EduEvent) error {
	start := time.Now()
	defer func() {
		eduKafkaPublishLatency.WithLabelValues(topic).Observe(time.Since(start).Seconds())
	}()

	payload, err := json.Marshal(event)
	if err != nil {
		eduKafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("failed to serialize event: %w", err)
	}

	log.Printf("Publishing to %s: %s", topic, string(payload))

	eduKafkaMessagesPublished.WithLabelValues(topic, "success").Inc()
	return nil
}

func (c *EduKafkaClient) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.connected
}
