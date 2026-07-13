package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

type EscrowEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type EscrowKafkaClient struct {
	writer *kafka.Writer
}

func NewEscrowKafkaClient() *EscrowKafkaClient {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}
	topic := os.Getenv("KAFKA_ESCROW_TOPIC")
	if topic == "" {
		topic = "escrow-events"
	}
	return &EscrowKafkaClient{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(strings.Split(brokers, ",")...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

func (c *EscrowKafkaClient) PublishEvent(eventType string, event EscrowEvent) {
	event.Type = eventType
	msgBytes, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal escrow event: %v", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = c.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.EntityID),
		Value: msgBytes,
	})
	if err != nil {
		log.Printf("Failed to publish escrow event to Kafka: %v", err)
	} else {
		log.Printf("Published escrow event to Kafka: %s", eventType)
	}
}

func (c *EscrowKafkaClient) Close() error {
	return c.writer.Close()
}
