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
	carbonKafkaMessagesPublished = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "carbon_kafka_messages_published_total",
			Help: "Total Kafka messages published by carbon service",
		},
		[]string{"topic", "status"},
	)

	carbonKafkaPublishLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "carbon_kafka_publish_latency_seconds",
			Help:    "Kafka publish latency (carbon service)",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
		},
		[]string{"topic"},
	)
)

func init() {
	prometheus.MustRegister(carbonKafkaMessagesPublished)
	prometheus.MustRegister(carbonKafkaPublishLatency)
}

type CarbonEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status,omitempty"`
	Amount    float64                `json:"amount,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type CarbonKafkaClient struct {
	brokers    []string
	producerID string
	mutex      sync.RWMutex
	connected  bool
}

func NewCarbonKafkaClient() *CarbonKafkaClient {
	brokersEnv := os.Getenv("KAFKA_BROKERS")
	brokers := []string{"kafka.kafka.svc.cluster.local:9092"}
	if brokersEnv != "" {
		brokers = []string{brokersEnv}
	}
	return &CarbonKafkaClient{
		brokers:    brokers,
		producerID: fmt.Sprintf("carbon-service-%d", time.Now().UnixNano()%10000),
		connected:  true,
	}
}

func (c *CarbonKafkaClient) PublishEvent(topic string, event CarbonEvent) error {
	start := time.Now()
	defer func() {
		carbonKafkaPublishLatency.WithLabelValues(topic).Observe(time.Since(start).Seconds())
	}()

	payload, err := json.Marshal(event)
	if err != nil {
		carbonKafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("failed to serialize event: %w", err)
	}

	log.Printf("Publishing to %s: %s", topic, string(payload))

	carbonKafkaMessagesPublished.WithLabelValues(topic, "success").Inc()
	return nil
}

func (c *CarbonKafkaClient) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.connected
}
