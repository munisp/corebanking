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

type LakehousePublisher struct {
	httpClient  *http.Client
	baseURL     string
	apiKey      string
	serviceName string
}

func NewLakehousePublisher() *LakehousePublisher {
	baseURL := os.Getenv("LAKEHOUSE_API_URL")
	if baseURL == "" {
		baseURL = "http://lakehouse-api:8000"
	}
	return &LakehousePublisher{
		httpClient: &http.Client{Timeout: 60 * time.Second},
		baseURL:     baseURL,
		apiKey:      os.Getenv("LAKEHOUSE_API_KEY"),
		serviceName: "customer-onboarding",
	}
}

type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

func (p *LakehousePublisher) PublishOnboardingStarted(ctx context.Context, applicationID, customerType, channel, tenantID string) error {
	return p.publishEvent(ctx, "ONBOARDING_STARTED", map[string]interface{}{
		"application_id": applicationID, "customer_type": customerType, "channel": channel, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishOnboardingStep(ctx context.Context, applicationID, stepName, status, tenantID string, durationMs int64) error {
	return p.publishEvent(ctx, "ONBOARDING_STEP", map[string]interface{}{
		"application_id": applicationID, "step_name": stepName, "status": status, "duration_ms": durationMs, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishOnboardingCompleted(ctx context.Context, applicationID, customerID, accountType, tenantID string, totalDurationMs int64) error {
	return p.publishEvent(ctx, "ONBOARDING_COMPLETED", map[string]interface{}{
		"application_id": applicationID, "customer_id": customerID, "account_type": accountType, "total_duration_ms": totalDurationMs, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishOnboardingAbandoned(ctx context.Context, applicationID, lastStep, reason, tenantID string) error {
	return p.publishEvent(ctx, "ONBOARDING_ABANDONED", map[string]interface{}{
		"application_id": applicationID, "last_step": lastStep, "reason": reason, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) publishEvent(ctx context.Context, eventType string, payload map[string]interface{}) error {
	payload["event_type"] = eventType
	payload["service_name"] = p.serviceName
	payload["timestamp"] = time.Now().Format(time.RFC3339)
	payload["ingestion_time"] = time.Now().Format(time.RFC3339)
	return p.writeToDelta(ctx, "bronze.onboarding_events", []map[string]interface{}{payload}, "append")
}

func (p *LakehousePublisher) writeToDelta(ctx context.Context, tableName string, data []map[string]interface{}, mode string) error {
	req := DeltaWriteRequest{TableName: tableName, Data: data, Mode: mode}
	jsonBody, _ := json.Marshal(req)
	httpReq, _ := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/v1/delta/write", bytes.NewBuffer(jsonBody))
	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("write failed: %s", string(body))
	}
	return nil
}
