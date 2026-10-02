package main

// LN-12 (w8:F1-10): real Kafka producer. The previous implementation logged
// the payload and counted a success metric without any broker interaction.
// This producer performs a synchronous write via segmentio/kafka-go and
// returns an honest error when the broker cannot be reached. Callers on the
// money path must treat a publish failure as a failure (or persist to an
// outbox); the error is never swallowed here.

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/segmentio/kafka-go"
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
	brokers []string
	mutex   sync.RWMutex
	writers map[string]*kafka.Writer
	enabled bool
}

func NewEduKafkaClient() *EduKafkaClient {
	brokersEnv := os.Getenv("KAFKA_BROKERS")
	brokers := []string{"kafka.kafka.svc.cluster.local:9092"}
	if brokersEnv != "" {
		brokers = strings.Split(brokersEnv, ",")
		for i := range brokers {
			brokers[i] = strings.TrimSpace(brokers[i])
		}
	}
	return &EduKafkaClient{
		brokers: brokers,
		writers: make(map[string]*kafka.Writer),
		enabled: true,
	}
}

// writerFor returns (lazily creating) a sync writer for the topic.
func (c *EduKafkaClient) writerFor(topic string) *kafka.Writer {
	c.mutex.RLock()
	w, ok := c.writers[topic]
	c.mutex.RUnlock()
	if ok {
		return w
	}
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if w, ok := c.writers[topic]; ok {
		return w
	}
	w = &kafka.Writer{
		Addr:         kafka.TCP(c.brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireOne,
		Async:        false, // synchronous: WriteMessages returns the broker's verdict
	}
	c.writers[topic] = w
	return w
}

// PublishEvent synchronously writes the event to Kafka. A non-nil error
// means the broker did NOT acknowledge the event.
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err = c.writerFor(topic).WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.EntityID),
		Value: payload,
		Time:  event.Timestamp,
	})
	if err != nil {
		eduKafkaMessagesPublished.WithLabelValues(topic, "error").Inc()
		return fmt.Errorf("kafka publish to %s failed: %w", topic, err)
	}

	eduKafkaMessagesPublished.WithLabelValues(topic, "success").Inc()
	return nil
}

// IsConnected reports whether the client is configured to publish. It does
// NOT claim broker health without a write having succeeded.
func (c *EduKafkaClient) IsConnected() bool {
	return c.enabled
}

// Close flushes and closes all topic writers.
func (c *EduKafkaClient) Close() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	for _, w := range c.writers {
		_ = w.Close()
	}
}
