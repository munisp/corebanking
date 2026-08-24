package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

type EmployeeEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type EmployeeKafkaClient struct {
	writer *kafka.Writer
}

func NewEmployeeKafkaClient() *EmployeeKafkaClient {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}
	topic := os.Getenv("KAFKA_EMPLOYEE_TOPIC")
	if topic == "" {
		topic = "employee-events"
	}
	return &EmployeeKafkaClient{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(strings.Split(brokers, ",")...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

// PublishEvent publishes an employee lifecycle event to Kafka. W7-C-12:
// failures are returned to the caller (which logs them) — employee events
// are never silently dropped.
func (c *EmployeeKafkaClient) PublishEvent(eventType string, event EmployeeEvent) error {
	event.Type = eventType
	msgBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal employee event %s: %w", eventType, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.EntityID),
		Value: msgBytes,
	}); err != nil {
		log.Printf("Failed to publish employee event to Kafka: %v", err)
		return fmt.Errorf("publish employee event %s: %w", eventType, err)
	}
	log.Printf("Published employee event to Kafka: %s", eventType)
	return nil
}

func (c *EmployeeKafkaClient) Close() error {
	return c.writer.Close()
}
