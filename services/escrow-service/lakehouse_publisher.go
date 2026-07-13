package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// ============================================
// LAKEHOUSE PUBLISHER FOR ESCROW SERVICE
// ============================================

// LakehousePublisher publishes escrow events to the lakehouse
// for advanced analytics and ML/AI integration
type LakehousePublisher struct {
	apiURL     string
	httpClient *http.Client
}

func NewLakehousePublisher(apiURL string) *LakehousePublisher {
	if apiURL == "" {
		apiURL = "http://lakehouse-api:8000"
	}
	return &LakehousePublisher{
		apiURL: apiURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// LakehouseEvent represents the standard event envelope for lakehouse ingestion
type LakehouseEvent struct {
	EventID       string                 `json:"event_id"`
	EventType     string                 `json:"event_type"`
	OccurredAt    string                 `json:"occurred_at"`
	TenantID      string                 `json:"tenant_id"`
	CustomerID    string                 `json:"customer_id,omitempty"`
	EntityID      string                 `json:"entity_id"`
	EntityType    string                 `json:"entity_type"`
	SourceService string                 `json:"source_service"`
	TraceID       string                 `json:"trace_id,omitempty"`
	Payload       map[string]interface{} `json:"payload"`
}

// PublishEvent publishes an event to the lakehouse API
func (p *LakehousePublisher) PublishEvent(ctx context.Context, event *LakehouseEvent) error {
	if event.EventID == "" {
		event.EventID = uuid.New().String()
	}
	if event.OccurredAt == "" {
		event.OccurredAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	event.SourceService = "escrow-service"

	payload := map[string]interface{}{
		"event_type":     event.EventType,
		"data":           event,
		"source_service": event.SourceService,
		"timestamp":      event.OccurredAt,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL+"/api/v1/events/publish", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("lakehouse API returned status %d", resp.StatusCode)
	}

	return nil
}

// ============================================
// ESCROW EVENT PUBLISHERS
// ============================================

// PublishEscrowCreatedEvent publishes escrow creation event
func (p *LakehousePublisher) PublishEscrowCreatedEvent(ctx context.Context, escrow *EscrowTransaction) error {
	event := &LakehouseEvent{
		EventType: EventEscrowCreated,
		// TenantID and CustomerID must be fetched from related contract or party, or from Metadata if present
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":        escrow.ID,
			"reference":        escrow.Reference,
			"contract_id":      escrow.ContractID,
			"transaction_type": escrow.TransactionType,
			"amount":           escrow.Amount,
			"currency":         escrow.Currency,
			"status":           escrow.Status,
			"created_at":       escrow.CreatedAt,
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishEscrowFundedEvent publishes escrow funding event
func (p *LakehousePublisher) PublishEscrowFundedEvent(ctx context.Context, escrow *EscrowTransaction, fundedAmount float64) error {
	event := &LakehouseEvent{
		EventType:  EventEscrowFunded,
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":     escrow.ID,
			"reference":     escrow.Reference,
			"funded_amount": fundedAmount,
			"total_amount":  escrow.Amount,
			"funded_at":     time.Now().UTC(),
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishMilestoneEvent publishes milestone lifecycle events
func (p *LakehousePublisher) PublishMilestoneEvent(ctx context.Context, eventType string, escrow *EscrowTransaction, milestone *EscrowMilestone) error {
	event := &LakehouseEvent{
		EventType:  eventType,
		EntityID:   milestone.ID,
		EntityType: "escrow_milestone",
		Payload: map[string]interface{}{
			"milestone_id":     milestone.ID,
			"escrow_id":        escrow.ID,
			"reference":        escrow.Reference,
			"milestone_name":   milestone.Name,
			"milestone_amount": milestone.Amount,
			"sequence":         milestone.Sequence,
			"status":           milestone.Status,
			"due_date":         milestone.DueDate,
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishEscrowReleasedEvent publishes escrow release event
func (p *LakehousePublisher) PublishEscrowReleasedEvent(ctx context.Context, escrow *EscrowTransaction, releasedAmount float64, recipientID string) error {
	event := &LakehouseEvent{
		EventType:  EventEscrowReleased,
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":       escrow.ID,
			"reference":       escrow.Reference,
			"released_amount": releasedAmount,
			"recipient_id":    recipientID,
			"released_at":     time.Now().UTC(),
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishDisputeEvent publishes dispute lifecycle events
func (p *LakehousePublisher) PublishDisputeEvent(ctx context.Context, eventType string, escrow *EscrowTransaction, dispute *EscrowDispute) error {
	event := &LakehouseEvent{
		EventType:  eventType,
		EntityID:   dispute.ID,
		EntityType: "escrow_dispute",
		Payload: map[string]interface{}{
			"dispute_id":      dispute.ID,
			"escrow_id":       escrow.ID,
			"reference":       escrow.Reference,
			"raised_by":       dispute.RaisedBy,
			"reason":          dispute.Reason,
			"disputed_amount": dispute.DisputedAmount,
			"status":          dispute.Status,
			"resolution":      dispute.Resolution,
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishEscrowCompletedEvent publishes escrow completion event
func (p *LakehousePublisher) PublishEscrowCompletedEvent(ctx context.Context, escrow *EscrowTransaction) error {
	event := &LakehouseEvent{
		EventType:  EventEscrowCompleted,
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":     escrow.ID,
			"reference":     escrow.Reference,
			"total_amount":  escrow.Amount,
			"currency":      escrow.Currency,
			"duration_days": time.Since(escrow.CreatedAt).Hours() / 24,
			"completed_at":  time.Now().UTC(),
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishEscrowCancelledEvent publishes escrow cancellation event
func (p *LakehousePublisher) PublishEscrowCancelledEvent(ctx context.Context, escrow *EscrowTransaction, reason string) error {
	event := &LakehouseEvent{
		EventType:  EventEscrowCancelled,
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":     escrow.ID,
			"reference":     escrow.Reference,
			"cancel_reason": reason,
			"refund_amount": escrow.Amount,
			"cancelled_at":  time.Now().UTC(),
		},
	}
	return p.PublishEvent(ctx, event)
}

// PublishEscrowExpiredEvent publishes escrow expiry event
func (p *LakehousePublisher) PublishEscrowExpiredEvent(ctx context.Context, escrow *EscrowTransaction) error {
	event := &LakehouseEvent{
		EventType:  EventEscrowExpired,
		EntityID:   escrow.ID,
		EntityType: "escrow_transaction",
		Payload: map[string]interface{}{
			"escrow_id":  escrow.ID,
			"reference":  escrow.Reference,
			"amount":     escrow.Amount,
			"expired_at": time.Now().UTC(),
		},
	}
	return p.PublishEvent(ctx, event)
}

// ============================================
// EVENT TYPE CONSTANTS
// ============================================

const (
	// Escrow Lifecycle Events
	EventEscrowCreated   = "escrow.created"
	EventEscrowFunded    = "escrow.funded"
	EventEscrowReleased  = "escrow.released"
	EventEscrowCompleted = "escrow.completed"
	EventEscrowCancelled = "escrow.cancelled"
	EventEscrowExpired   = "escrow.expired"
	EventEscrowRefunded  = "escrow.refunded"

	// Milestone Events
	EventMilestoneCreated   = "escrow.milestone.created"
	EventMilestoneCompleted = "escrow.milestone.completed"
	EventMilestoneApproved  = "escrow.milestone.approved"
	EventMilestoneRejected  = "escrow.milestone.rejected"
	EventMilestoneReleased  = "escrow.milestone.released"

	// Dispute Events
	EventDisputeRaised    = "escrow.dispute.raised"
	EventDisputeEscalated = "escrow.dispute.escalated"
	EventDisputeResolved  = "escrow.dispute.resolved"

	// Party Events
	EventPartyAdded   = "escrow.party.added"
	EventPartyRemoved = "escrow.party.removed"

	// Document Events
	EventDocumentUploaded = "escrow.document.uploaded"
	EventDocumentVerified = "escrow.document.verified"
)

// ============================================
// Use EscrowTransaction from escrow_service.go

type EscrowMilestone struct {
	ID       string
	EscrowID string
	Name     string
	Amount   float64
	Sequence int
	Status   string
	DueDate  time.Time
}

type EscrowDispute struct {
	ID             string
	EscrowID       string
	RaisedBy       string
	Reason         string
	DisputedAmount float64
	Status         string
	Resolution     string
}
