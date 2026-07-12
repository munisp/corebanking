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

type IslamicBankingEvent struct {
	Type      string                 `json:"type"`
	EntityID  string                 `json:"entity_id"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type IslamicBankingKafkaClient struct {
	writer *kafka.Writer
}

func NewIslamicBankingKafkaClient() *IslamicBankingKafkaClient {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}
	topic := os.Getenv("KAFKA_ISLAMIC_BANKING_TOPIC")
	if topic == "" {
		topic = "islamic-banking-events"
	}
	return &IslamicBankingKafkaClient{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(strings.Split(brokers, ",")...),
			Topic:    topic,
			Balancer: &kafka.LeastBytes{},
		},
	}
}

func (c *IslamicBankingKafkaClient) PublishEvent(eventType string, event IslamicBankingEvent) {
	event.Type = eventType
	msgBytes, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal islamic banking event: %v", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = c.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.EntityID),
		Value: msgBytes,
	})
	if err != nil {
		log.Printf("Failed to publish islamic banking event to Kafka: %v", err)
	} else {
		log.Printf("Published islamic banking event to Kafka: %s", eventType)
	}
}

func (c *IslamicBankingKafkaClient) Close() error {
	return c.writer.Close()
}
