package outbox

import (
	"fmt"
	"testing"
	"time"
)

type mockPublisher struct {
	published []string
	failNext  bool
}

func (m *mockPublisher) Publish(topic, key string, payload []byte) error {
	if m.failNext {
		return fmt.Errorf("publish failed")
	}
	m.published = append(m.published, topic+":"+key)
	return nil
}

func TestAppendAndRelay(t *testing.T) {
	pub := &mockPublisher{}
	ob := NewOutbox(pub, 0, 3) // no auto-relay
	defer ob.Stop()

	_, err := ob.Append("banking.payments", "txn-1", map[string]string{"type": "transfer"}, "IDEM-1")
	if err != nil {
		t.Fatal(err)
	}

	stats := ob.Stats()
	if stats["pending"].(int) != 1 {
		t.Errorf("pending = %v, want 1", stats["pending"])
	}

	published := ob.Relay()
	if published != 1 {
		t.Errorf("published = %d, want 1", published)
	}
	if len(pub.published) != 1 {
		t.Errorf("publisher received %d events, want 1", len(pub.published))
	}
	if pub.published[0] != "banking.payments:txn-1" {
		t.Errorf("published event = %s", pub.published[0])
	}
}

func TestRelay_RetryAndDLQ(t *testing.T) {
	pub := &mockPublisher{failNext: true}
	ob := NewOutbox(pub, 0, 3)
	defer ob.Stop()

	event, _ := ob.Append("banking.payments", "txn-1", "payload", "IDEM-1")

	// First 2 retries
	ob.Relay()
	ob.Relay()
	if event.Status != "pending" {
		t.Errorf("after 2 failures, status = %s, want pending", event.Status)
	}

	// 3rd failure → DLQ
	ob.Relay()
	if event.Status != "dlq" {
		t.Errorf("after 3 failures, status = %s, want dlq", event.Status)
	}

	stats := ob.Stats()
	if stats["dlq"].(int64) != 1 {
		t.Errorf("dlq = %v, want 1", stats["dlq"])
	}
}

func TestAppendBatch(t *testing.T) {
	ob := NewOutbox(nil, 0, 3)
	defer ob.Stop()

	events, err := ob.AppendBatch([]struct {
		Topic          string
		Key            string
		Payload        interface{}
		IdempotencyKey string
	}{
		{"banking.payments", "txn-1", "payload1", "IDEM-1"},
		{"banking.payments", "txn-2", "payload2", "IDEM-2"},
		{"banking.lending", "loan-1", "payload3", "IDEM-3"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 {
		t.Fatalf("got %d events, want 3", len(events))
	}

	stats := ob.Stats()
	if stats["total_events"].(int) != 3 {
		t.Errorf("total = %v, want 3", stats["total_events"])
	}
}

func TestNilPublisher_DryRun(t *testing.T) {
	ob := NewOutbox(nil, 0, 3)
	defer ob.Stop()

	ob.Append("topic", "key", "payload", "IDEM-1")
	published := ob.Relay()
	if published != 1 {
		t.Errorf("dry run should still count as published, got %d", published)
	}
}

func TestAutoRelay(t *testing.T) {
	pub := &mockPublisher{}
	ob := NewOutbox(pub, 50*time.Millisecond, 3)
	defer ob.Stop()

	ob.Append("topic", "key", "payload", "IDEM-1")
	time.Sleep(200 * time.Millisecond)

	if len(pub.published) == 0 {
		t.Error("auto-relay should have published the event")
	}
}

func TestSQLHelpers(t *testing.T) {
	if InsertSQL() == "" {
		t.Error("InsertSQL should not be empty")
	}
	if SelectPendingSQL(10) == "" {
		t.Error("SelectPendingSQL should not be empty")
	}
	if MarkPublishedSQL() == "" {
		t.Error("MarkPublishedSQL should not be empty")
	}
	if MarkDLQSQL() == "" {
		t.Error("MarkDLQSQL should not be empty")
	}
	if CreateTableSQL() == "" {
		t.Error("CreateTableSQL should not be empty")
	}
}
