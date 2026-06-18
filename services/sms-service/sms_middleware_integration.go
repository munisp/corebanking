// sms_middleware_integration.go — middleware layer for SMS banking service
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/go-redis/redis/v8"
)

// SMSCommand represents an SMS banking command
type SMSCommand string

const (
	CmdBalance  SMSCommand = "BAL"
	CmdTransfer SMSCommand = "SEND"
	CmdHistory  SMSCommand = "HIST"
	CmdHelp     SMSCommand = "HELP"
	CmdMini     SMSCommand = "MINI"
	CmdStop     SMSCommand = "STOP"
)

type SMSMiddlewareConfig struct {
	RedisURL     string
	KafkaBrokers string
	KeycloakURL  string
	PermifyURL   string
	DaprURL      string
	TenantID     string

	TransactionServiceURL string
	AccountServiceURL     string
	UserServiceURL        string
}

type SMSMiddlewareIntegration struct {
	redis         *redis.Client
	kafkaProducer *kafka.Producer
	httpClient    *http.Client
	config        *SMSMiddlewareConfig
}

func NewSMSMiddlewareIntegration(cfg *SMSMiddlewareConfig) (*SMSMiddlewareIntegration, error) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.RedisURL,
	})

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.KafkaBrokers,
		"client.id":         "sms-banking-service",
		"acks":              "all",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka producer: %w", err)
	}

	return &SMSMiddlewareIntegration{
		redis:         redisClient,
		kafkaProducer: producer,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		config:        cfg,
	}, nil
}

func (m *SMSMiddlewareIntegration) PublishCommandEvent(
	ctx context.Context,
	eventType string,
	command SMSCommand,
	phoneNumber string,
	data map[string]interface{},
) error {

	event := map[string]interface{}{
		"event_type":   eventType,
		"command":      command,
		"phone_number": phoneNumber,
		"tenant_id":    m.config.TenantID,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"channel":      "sms",
	}

	for k, v := range data {
		event[k] = v
	}

	payload, _ := json.Marshal(event)
	topic := "sms.commands"

	return m.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Value: payload,
	}, nil)
}

func (m *SMSMiddlewareIntegration) PublishTransactionEvent(
	ctx context.Context,
	eventType string,
	data map[string]interface{},
) error {

	data["event_type"] = eventType
	data["tenant_id"] = m.config.TenantID
	data["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	data["channel"] = "sms"

	payload, _ := json.Marshal(data)
	topic := "sms.transactions"

	return m.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Value: payload,
	}, nil)
}

func (m *SMSMiddlewareIntegration) PublishOutboundSMS(
	ctx context.Context,
	phoneNumber, message, reference string,
) error {

	event := map[string]interface{}{
		"phone_number": phoneNumber,
		"message":      message,
		"reference":    reference,
		"tenant_id":    m.config.TenantID,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"status":       "pending",
	}

	payload, _ := json.Marshal(event)
	topic := "sms.outbound"

	return m.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Value: payload,
	}, nil)
}

func (m *SMSMiddlewareIntegration) CacheCustomerData(
	ctx context.Context,
	phoneNumber string,
	data map[string]interface{},
) error {

	key := fmt.Sprintf("sms:customer:%s", phoneNumber)

	jsonData, _ := json.Marshal(data)

	return m.redis.Set(ctx, key, jsonData, 15*time.Minute).Err()
}

func (m *SMSMiddlewareIntegration) GetCachedCustomerData(
	ctx context.Context,
	phoneNumber string,
) (map[string]interface{}, error) {

	key := fmt.Sprintf("sms:customer:%s", phoneNumber)

	data, err := m.redis.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (m *SMSMiddlewareIntegration) CheckRateLimit(
	ctx context.Context,
	phoneNumber string,
	limit int,
	window time.Duration,
) (bool, error) {

	key := fmt.Sprintf("sms:ratelimit:%s", phoneNumber)

	pipe := m.redis.Pipeline()

	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}

	return incr.Val() <= int64(limit), nil
}

func (m *SMSMiddlewareIntegration) InvokeServiceViaDapr(
	ctx context.Context,
	appID, method string,
	data interface{},
) ([]byte, error) {

	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s",
		m.config.DaprURL,
		appID,
		method,
	)

	body, _ := json.Marshal(data)

	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		url,
		bytes.NewBuffer(body),
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func (m *SMSMiddlewareIntegration) Close() {
	m.redis.Close()
	m.kafkaProducer.Close()
}
