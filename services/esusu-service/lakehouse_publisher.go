package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// LakehousePublisher handles publishing esusu events to the lakehouse for analytics
type LakehousePublisher struct {
	httpClient  *http.Client
	baseURL     string
	apiKey      string
	serviceName string
}

// NewLakehousePublisher creates a new lakehouse publisher for esusu service
func NewLakehousePublisher() *LakehousePublisher {
	baseURL := os.Getenv("LAKEHOUSE_API_URL")
	if baseURL == "" {
		baseURL = "http://data-intelligence"
	}

	return &LakehousePublisher{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		baseURL:     baseURL,
		serviceName: "esusu-service",
	}
}

// DeltaWriteRequest represents a request to write to Delta Lake
type DeltaWriteRequest struct {
	Topic string                   `json:"topic"`
	Data      []map[string]interface{} `json:"raw"`
	Mode      string                   `json:"mode"`
}

// PublishGroupCreated publishes esusu group creation event
func (p *LakehousePublisher) PublishGroupCreated(ctx context.Context, groupID string, groupName string, memberCount int, contributionAmount float64, frequency string, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":          "GROUP_CREATED",
			"group_id":            groupID,
			"group_name":          groupName,
			"member_count":        memberCount,
			"contribution_amount": contributionAmount,
			"frequency":           frequency,
			"tenant_id":           tenantID,
			"service_name":        p.serviceName,
			"timestamp":           time.Now().Format(time.RFC3339),
			"ingestion_time":      time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishContribution publishes esusu contribution event
func (p *LakehousePublisher) PublishContribution(ctx context.Context, groupID string, memberID string, amount float64, cycleNumber int, status string, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":     "CONTRIBUTION",
			"group_id":       groupID,
			"member_id":      memberID,
			"amount":         amount,
			"cycle_number":   cycleNumber,
			"status":         status,
			"tenant_id":      tenantID,
			"service_name":   p.serviceName,
			"timestamp":      time.Now().Format(time.RFC3339),
			"ingestion_time": time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishPayout publishes esusu payout event
func (p *LakehousePublisher) PublishPayout(ctx context.Context, groupID string, recipientID string, amount float64, cycleNumber int, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":     "PAYOUT",
			"group_id":       groupID,
			"recipient_id":   recipientID,
			"amount":         amount,
			"cycle_number":   cycleNumber,
			"tenant_id":      tenantID,
			"service_name":   p.serviceName,
			"timestamp":      time.Now().Format(time.RFC3339),
			"ingestion_time": time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishMemberJoined publishes member joined event
func (p *LakehousePublisher) PublishMemberJoined(ctx context.Context, groupID string, memberID string, position int, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":     "MEMBER_JOINED",
			"group_id":       groupID,
			"member_id":      memberID,
			"position":       position,
			"tenant_id":      tenantID,
			"service_name":   p.serviceName,
			"timestamp":      time.Now().Format(time.RFC3339),
			"ingestion_time": time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishCycleCompleted publishes cycle completion event
func (p *LakehousePublisher) PublishCycleCompleted(ctx context.Context, groupID string, cycleNumber int, totalCollected float64, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":      "CYCLE_COMPLETED",
			"group_id":        groupID,
			"cycle_number":    cycleNumber,
			"total_collected": totalCollected,
			"tenant_id":       tenantID,
			"service_name":    p.serviceName,
			"timestamp":       time.Now().Format(time.RFC3339),
			"ingestion_time":  time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishDefaultEvent publishes member default event
func (p *LakehousePublisher) PublishDefaultEvent(ctx context.Context, groupID string, memberID string, missedAmount float64, cycleNumber int, tenantID string) error {
	data := []map[string]interface{}{
		{
			"event_type":     "MEMBER_DEFAULT",
			"group_id":       groupID,
			"member_id":      memberID,
			"missed_amount":  missedAmount,
			"cycle_number":   cycleNumber,
			"tenant_id":      tenantID,
			"service_name":   p.serviceName,
			"timestamp":      time.Now().Format(time.RFC3339),
			"ingestion_time": time.Now().Format(time.RFC3339),
		},
	}
	return p.writeToDelta(ctx, "bronze.esusu_events", data, "append")
}

// PublishGroupMetrics publishes group performance metrics
func (p *LakehousePublisher) PublishGroupMetrics(ctx context.Context, groupID string, metrics map[string]interface{}) error {
	metrics["group_id"] = groupID
	metrics["service_name"] = p.serviceName
	metrics["timestamp"] = time.Now().Format(time.RFC3339)
	metrics["ingestion_time"] = time.Now().Format(time.RFC3339)

	return p.writeToDelta(ctx, "bronze.esusu_metrics", []map[string]interface{}{metrics}, "append")
}

// writeToDelta writes data to a Delta Lake table
func (p *LakehousePublisher) writeToDelta(ctx context.Context, tableName string, data []map[string]interface{}, mode string) error {
	req := DeltaWriteRequest{
		Topic: tableName,
		Data:      data,
		Mode:      mode,
	}

	jsonBody, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		p.baseURL+"/api/v1/raw",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("write failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
