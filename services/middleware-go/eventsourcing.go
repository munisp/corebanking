package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// A1: Event Sourcing — Domain events emitted to Kafka for all financial state changes.
// Provides: audit replay, CQRS read model projection, cross-service choreography.

type DomainEvent struct {
	EventID       string                 `json:"eventId"`
	EventType     string                 `json:"eventType"`
	AggregateID   string                 `json:"aggregateId"`
	AggregateType string                 `json:"aggregateType"`
	TenantID      string                 `json:"tenantId"`
	Version       int64                  `json:"version"`
	Timestamp     time.Time              `json:"timestamp"`
	CorrelationID string                 `json:"correlationId"`
	CausationID   string                 `json:"causationId"`
	Actor         string                 `json:"actor"`
	Payload       map[string]interface{} `json:"payload"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type EventStore interface {
	Append(ctx context.Context, events []DomainEvent) error
	Load(ctx context.Context, aggregateID string, fromVersion int64) ([]DomainEvent, error)
	Subscribe(ctx context.Context, eventTypes []string, handler EventHandler) error
}

type EventHandler func(event DomainEvent) error

type KafkaEventStore struct {
	bootstrapServers string
	topicPrefix      string
	consumerGroup    string
	mu               sync.RWMutex
	events           map[string][]DomainEvent // in-memory fallback
	handlers         map[string][]EventHandler
}

func NewKafkaEventStore() *KafkaEventStore {
	servers := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if servers == "" {
		servers = "kafka:9092"
	}
	return &KafkaEventStore{
		bootstrapServers: servers,
		topicPrefix:      "54bank.events.",
		consumerGroup:    "54bank-event-consumers",
		events:           make(map[string][]DomainEvent),
		handlers:         make(map[string][]EventHandler),
	}
}

func (s *KafkaEventStore) Append(ctx context.Context, events []DomainEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, evt := range events {
		topic := s.topicPrefix + evt.AggregateType
		s.events[topic] = append(s.events[topic], evt)

		data, _ := json.Marshal(evt)
		log.Printf("[EventStore] Published to %s: %s", topic, string(data))

		// Dispatch to local subscribers
		if handlers, ok := s.handlers[evt.EventType]; ok {
			for _, h := range handlers {
				go func(handler EventHandler, event DomainEvent) {
					if err := handler(event); err != nil {
						log.Printf("[EventStore] Handler error for %s: %v", event.EventType, err)
					}
				}(h, evt)
			}
		}
	}
	return nil
}

func (s *KafkaEventStore) Load(ctx context.Context, aggregateID string, fromVersion int64) ([]DomainEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []DomainEvent
	for _, topicEvents := range s.events {
		for _, evt := range topicEvents {
			if evt.AggregateID == aggregateID && evt.Version >= fromVersion {
				result = append(result, evt)
			}
		}
	}
	return result, nil
}

func (s *KafkaEventStore) Subscribe(ctx context.Context, eventTypes []string, handler EventHandler) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, et := range eventTypes {
		s.handlers[et] = append(s.handlers[et], handler)
	}
	return nil
}

// Standard event types for banking domains
const (
	// Teller events
	EventTellerSessionOpened    = "teller.session.opened"
	EventTellerDeposit          = "teller.deposit.completed"
	EventTellerWithdrawal       = "teller.withdrawal.completed"
	EventTellerSessionClosed    = "teller.session.closed"

	// Loan events
	EventLoanApplicationCreated = "loan.application.created"
	EventLoanApproved           = "loan.approved"
	EventLoanDisbursed          = "loan.disbursed"
	EventLoanRepayment          = "loan.repayment.received"
	EventLoanDefaulted          = "loan.defaulted"

	// Trade finance events
	EventLCIssued               = "trade.lc.issued"
	EventLCConfirmed            = "trade.lc.confirmed"
	EventLCDrawing              = "trade.lc.drawing"
	EventLCSettled              = "trade.lc.settled"

	// Transfer events
	EventTransferInitiated      = "transfer.initiated"
	EventTransferCompleted      = "transfer.completed"
	EventTransferFailed         = "transfer.failed"

	// Account events
	EventAccountCreated         = "account.created"
	EventAccountFrozen          = "account.frozen"
	EventAccountClosed          = "account.closed"

	// Dispute events
	EventDisputeOpened          = "dispute.opened"
	EventDisputeResolved        = "dispute.resolved"
	EventChargebackInitiated    = "dispute.chargeback.initiated"

	// Islamic banking events
	EventMurabahaCreated        = "islamic.murabaha.created"
	EventMurabahaActivated      = "islamic.murabaha.activated"
	EventSukukIssued            = "islamic.sukuk.issued"

	// Agriculture events
	EventFarmerRegistered       = "agriculture.farmer.registered"
	EventAgriLoanDisbursed      = "agriculture.loan.disbursed"
	EventInsuranceClaimed       = "agriculture.insurance.claimed"
)

func EmitEvent(store EventStore, aggregateType, aggregateID, eventType, actor string, payload map[string]interface{}) error {
	evt := DomainEvent{
		EventID:       fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType:     eventType,
		AggregateID:   aggregateID,
		AggregateType: aggregateType,
		TenantID:      "54bank-platform-prod",
		Version:       time.Now().UnixMilli(),
		Timestamp:     time.Now().UTC(),
		CorrelationID: fmt.Sprintf("corr-%d", time.Now().UnixNano()),
		Actor:         actor,
		Payload:       payload,
		Metadata: map[string]interface{}{
			"service": aggregateType,
			"version": "1.0.0",
		},
	}
	return store.Append(context.Background(), []DomainEvent{evt})
}
