// Package outbox implements the Transactional Outbox pattern for reliable
// event emission in the 54Bank platform.
//
// Problem: Services that write to the DB and then publish to Kafka can lose
// events if the process crashes between the DB commit and the Kafka publish.
//
// Solution: Write the event to an "outbox" table within the same DB transaction.
// A separate relay goroutine polls the outbox and publishes to Kafka, marking
// events as published. This guarantees at-least-once delivery.
//
// Flow:
//   1. Business logic + outbox INSERT in same DB transaction
//   2. Transaction commits atomically
//   3. Relay goroutine polls for unpublished events
//   4. Relay publishes to Kafka
//   5. Relay marks events as published
//   6. Consumers must be idempotent (events may be delivered more than once)
package outbox

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// Event represents an outbox event to be published to Kafka.
type Event struct {
	ID            string          `json:"id"`
	Topic         string          `json:"topic"`
	Key           string          `json:"key"`           // Kafka partition key
	Payload       json.RawMessage `json:"payload"`
	IdempotencyKey string         `json:"idempotency_key"`
	CreatedAt     time.Time       `json:"created_at"`
	PublishedAt   *time.Time      `json:"published_at,omitempty"`
	RetryCount    int             `json:"retry_count"`
	MaxRetries    int             `json:"max_retries"`
	Status        string          `json:"status"` // "pending", "published", "failed", "dlq"
}

// Publisher is the interface for publishing events (Kafka, etc.)
type Publisher interface {
	Publish(topic, key string, payload []byte) error
}

// Outbox manages the outbox table and relay.
type Outbox struct {
	mu          sync.Mutex
	events      []*Event
	published   int64
	failed      int64
	dlqCount    int64
	idCounter   uint64
	publisher   Publisher
	maxRetries  int
	relayTicker *time.Ticker
	stopCh      chan struct{}
}

// NewOutbox creates a new outbox with a publisher and relay interval.
func NewOutbox(publisher Publisher, relayInterval time.Duration, maxRetries int) *Outbox {
	ob := &Outbox{
		events:     make([]*Event, 0),
		publisher:  publisher,
		maxRetries: maxRetries,
		stopCh:     make(chan struct{}),
	}
	if relayInterval > 0 {
		ob.relayTicker = time.NewTicker(relayInterval)
		go ob.relayLoop()
	}
	return ob
}

// Append adds an event to the outbox. In production, this is an INSERT within
// the same DB transaction as the business logic.
func (ob *Outbox) Append(topic, key string, payload interface{}, idempotencyKey string) (*Event, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	id := fmt.Sprintf("OBX-%d", atomic.AddUint64(&ob.idCounter, 1))
	event := &Event{
		ID:             id,
		Topic:          topic,
		Key:            key,
		Payload:        data,
		IdempotencyKey: idempotencyKey,
		CreatedAt:      time.Now(),
		RetryCount:     0,
		MaxRetries:     ob.maxRetries,
		Status:         "pending",
	}

	ob.mu.Lock()
	ob.events = append(ob.events, event)
	ob.mu.Unlock()

	return event, nil
}

// AppendBatch adds multiple events atomically.
func (ob *Outbox) AppendBatch(events []struct {
	Topic          string
	Key            string
	Payload        interface{}
	IdempotencyKey string
}) ([]*Event, error) {
	results := make([]*Event, 0, len(events))
	ob.mu.Lock()
	defer ob.mu.Unlock()

	for _, e := range events {
		data, err := json.Marshal(e.Payload)
		if err != nil {
			return nil, fmt.Errorf("marshal payload: %w", err)
		}
		id := fmt.Sprintf("OBX-%d", atomic.AddUint64(&ob.idCounter, 1))
		event := &Event{
			ID:             id,
			Topic:          e.Topic,
			Key:            e.Key,
			Payload:        data,
			IdempotencyKey: e.IdempotencyKey,
			CreatedAt:      time.Now(),
			RetryCount:     0,
			MaxRetries:     ob.maxRetries,
			Status:         "pending",
		}
		ob.events = append(ob.events, event)
		results = append(results, event)
	}

	return results, nil
}

// Relay publishes all pending events. Called periodically by relayLoop.
func (ob *Outbox) Relay() int {
	ob.mu.Lock()
	pending := make([]*Event, 0)
	for _, e := range ob.events {
		if e.Status == "pending" {
			pending = append(pending, e)
		}
	}
	ob.mu.Unlock()

	published := 0
	for _, e := range pending {
		if ob.publisher == nil {
			// No publisher configured — mark as published (dry run)
			e.Status = "published"
			now := time.Now()
			e.PublishedAt = &now
			atomic.AddInt64(&ob.published, 1)
			published++
			continue
		}

		err := ob.publisher.Publish(e.Topic, e.Key, e.Payload)
		if err != nil {
			e.RetryCount++
			if e.RetryCount >= e.MaxRetries {
				e.Status = "dlq"
				atomic.AddInt64(&ob.dlqCount, 1)
			} else {
				atomic.AddInt64(&ob.failed, 1)
			}
			continue
		}

		e.Status = "published"
		now := time.Now()
		e.PublishedAt = &now
		atomic.AddInt64(&ob.published, 1)
		published++
	}

	return published
}

// Stats returns outbox statistics.
func (ob *Outbox) Stats() map[string]interface{} {
	ob.mu.Lock()
	pendingCount := 0
	for _, e := range ob.events {
		if e.Status == "pending" {
			pendingCount++
		}
	}
	total := len(ob.events)
	ob.mu.Unlock()

	return map[string]interface{}{
		"total_events":   total,
		"pending":        pendingCount,
		"published":      atomic.LoadInt64(&ob.published),
		"failed_retries": atomic.LoadInt64(&ob.failed),
		"dlq":            atomic.LoadInt64(&ob.dlqCount),
	}
}

// Stop halts the relay loop.
func (ob *Outbox) Stop() {
	close(ob.stopCh)
	if ob.relayTicker != nil {
		ob.relayTicker.Stop()
	}
}

func (ob *Outbox) relayLoop() {
	for {
		select {
		case <-ob.stopCh:
			// Final relay before shutdown
			ob.Relay()
			return
		case <-ob.relayTicker.C:
			ob.Relay()
		}
	}
}

// --- SQL helpers for production use ---

// InsertSQL returns the SQL to insert an outbox event within a transaction.
func InsertSQL() string {
	return `INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status, retry_count, max_retries)
VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, $7)`
}

// SelectPendingSQL returns the SQL to select pending outbox events for relay.
func SelectPendingSQL(limit int) string {
	return fmt.Sprintf(
		`SELECT id, topic, key, payload, idempotency_key, created_at, retry_count, max_retries
FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT %d FOR UPDATE SKIP LOCKED`, limit)
}

// MarkPublishedSQL returns the SQL to mark an event as published.
func MarkPublishedSQL() string {
	return `UPDATE outbox SET status = 'published', published_at = NOW() WHERE id = $1`
}

// MarkDLQSQL returns the SQL to move an event to the dead letter queue.
func MarkDLQSQL() string {
	return `UPDATE outbox SET status = 'dlq', retry_count = retry_count + 1 WHERE id = $1`
}

// CreateTableSQL returns the DDL for the outbox table.
func CreateTableSQL() string {
	return `CREATE TABLE IF NOT EXISTS outbox (
	id VARCHAR(64) PRIMARY KEY,
	topic VARCHAR(128) NOT NULL,
	key VARCHAR(256) NOT NULL,
	payload JSONB NOT NULL,
	idempotency_key VARCHAR(128) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	published_at TIMESTAMPTZ,
	status VARCHAR(16) NOT NULL DEFAULT 'pending',
	retry_count INTEGER NOT NULL DEFAULT 0,
	max_retries INTEGER NOT NULL DEFAULT 3,
	CONSTRAINT unique_idempotency UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (status, created_at) WHERE status = 'pending';`
}
