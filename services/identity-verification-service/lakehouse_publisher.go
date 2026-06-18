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
		serviceName: "identity-verification-service",
	}
}

type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

func (p *LakehousePublisher) PublishIDVerification(ctx context.Context, verificationID, userID, idType, issuer, status, tenantID string, confidenceScore float64) error {
	return p.publishEvent(ctx, "ID_VERIFICATION", map[string]interface{}{
		"verification_id": verificationID, "user_id": userID, "id_type": idType, "issuer": issuer,
		"status": status, "confidence_score": confidenceScore, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishBVNVerification(ctx context.Context, userID, bvnHash, status, tenantID string) error {
	return p.publishEvent(ctx, "BVN_VERIFICATION", map[string]interface{}{
		"user_id": userID, "bvn_hash": bvnHash, "status": status, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishNINVerification(ctx context.Context, userID, ninHash, status, tenantID string) error {
	return p.publishEvent(ctx, "NIN_VERIFICATION", map[string]interface{}{
		"user_id": userID, "nin_hash": ninHash, "status": status, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) publishEvent(ctx context.Context, eventType string, payload map[string]interface{}) error {
	payload["event_type"] = eventType
	payload["service_name"] = p.serviceName
	payload["timestamp"] = time.Now().Format(time.RFC3339)
	payload["ingestion_time"] = time.Now().Format(time.RFC3339)
	return p.writeToDelta(ctx, "bronze.identity_verification_events", []map[string]interface{}{payload}, "append")
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
