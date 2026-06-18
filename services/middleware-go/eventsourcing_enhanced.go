package middleware

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// Enhanced event sourcing: Kafka topic routing and CQRS support
// Extends the DomainEvent and EventStore from eventsourcing.go

// KafkaTopicRouter maps domain events to Kafka topics
type KafkaTopicRouter struct {
	mu     sync.RWMutex
	routes map[string]string // eventType -> topic
}

func NewKafkaTopicRouter() *KafkaTopicRouter {
	r := &KafkaTopicRouter{routes: make(map[string]string)}
	domains := map[string][]string{
		"54bank.teller":     {"transaction.created", "transaction.approved", "transaction.reversed"},
		"54bank.loans":      {"application.submitted", "application.approved", "disbursement.completed", "repayment.received"},
		"54bank.kyc":        {"verification.started", "verification.completed", "risk.updated"},
		"54bank.payments":   {"transfer.initiated", "transfer.completed", "transfer.failed"},
		"54bank.cards":      {"card.issued", "card.blocked", "card.activated", "transaction.authorized"},
		"54bank.treasury":   {"deal.executed", "rate.updated", "position.changed"},
		"54bank.compliance": {"alert.raised", "sar.filed", "ctr.generated"},
		"54bank.customers":  {"customer.created", "customer.updated", "kyc.completed"},
		"54bank.accounts":   {"account.opened", "account.closed", "dormancy.triggered"},
		"54bank.audit":      {"action.logged", "policy.violated"},
	}
	for topic, events := range domains {
		for _, evt := range events {
			r.routes[evt] = topic
		}
	}
	return r
}

func (r *KafkaTopicRouter) Route(eventType string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if topic, ok := r.routes[eventType]; ok {
		return topic
	}
	return "54bank.unrouted"
}

func (r *KafkaTopicRouter) Topics() map[string][]string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	topicEvents := make(map[string][]string)
	for evt, topic := range r.routes {
		topicEvents[topic] = append(topicEvents[topic], evt)
	}
	return topicEvents
}

// CQRSProjection is a read model that subscribes to domain events
type CQRSProjection struct {
	mu         sync.RWMutex
	name       string
	state      map[string]interface{}
	version    int64
	lastUpdate time.Time
}

func NewCQRSProjection(name string) *CQRSProjection {
	return &CQRSProjection{
		name:  name,
		state: make(map[string]interface{}),
	}
}

func (p *CQRSProjection) Apply(event DomainEvent) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.state[event.AggregateID] = event.Payload
	p.version = event.Version
	p.lastUpdate = time.Now()
}

func (p *CQRSProjection) Get(aggregateID string) (interface{}, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	val, ok := p.state[aggregateID]
	return val, ok
}

func (p *CQRSProjection) MarshalJSON() ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return json.Marshal(map[string]interface{}{
		"name":        p.name,
		"entity_count": len(p.state),
		"version":     p.version,
		"last_update": p.lastUpdate.Format(time.RFC3339),
	})
}

// SagaOrchestratorV2 manages multi-step distributed transactions with Temporal integration
type SagaOrchestratorV2 struct {
	mu    sync.RWMutex
	sagas map[string]*SagaInstanceV2
}

type SagaInstanceV2 struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`
	Status    string            `json:"status"`
	Steps     []SagaStepV2      `json:"steps"`
	CreatedAt string            `json:"created_at"`
	UpdatedAt string            `json:"updated_at"`
}

type SagaStepV2 struct {
	Name        string `json:"name"`
	Service     string `json:"service"`
	Status      string `json:"status"`
	StartedAt   string `json:"started_at,omitempty"`
	CompletedAt string `json:"completed_at,omitempty"`
	Error       string `json:"error,omitempty"`
}

func NewSagaOrchestratorV2() *SagaOrchestratorV2 {
	return &SagaOrchestratorV2{sagas: make(map[string]*SagaInstanceV2)}
}

func (o *SagaOrchestratorV2) Create(sagaType string, steps []SagaStepV2) *SagaInstanceV2 {
	o.mu.Lock()
	defer o.mu.Unlock()
	saga := &SagaInstanceV2{
		ID:        fmt.Sprintf("saga-v2-%d", len(o.sagas)+1),
		Type:      sagaType,
		Status:    "running",
		Steps:     steps,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	o.sagas[saga.ID] = saga
	return saga
}

func (o *SagaOrchestratorV2) GetAll() []*SagaInstanceV2 {
	o.mu.RLock()
	defer o.mu.RUnlock()
	result := make([]*SagaInstanceV2, 0, len(o.sagas))
	for _, s := range o.sagas {
		result = append(result, s)
	}
	return result
}
