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

// LakehousePublisher handles publishing virtual account events to the lakehouse
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
		httpClient:  &http.Client{Timeout: 60 * time.Second},
		baseURL:     baseURL,
		apiKey:      os.Getenv("LAKEHOUSE_API_KEY"),
		serviceName: "virtual-account-service",
	}
}

type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

func (p *LakehousePublisher) PublishVANCreated(ctx context.Context, vanID, accountNumber, vanType, merchantID, tenantID string) error {
	return p.publishEvent(ctx, "VAN_CREATED", map[string]interface{}{
		"van_id": vanID, "account_number": accountNumber, "van_type": vanType, "merchant_id": merchantID, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishVANCollection(ctx context.Context, vanID, transactionRef string, amount float64, currency, payerName, payerBank, tenantID string) error {
	return p.publishEvent(ctx, "VAN_COLLECTION", map[string]interface{}{
		"van_id": vanID, "transaction_ref": transactionRef, "amount": amount, "currency": currency,
		"payer_name": payerName, "payer_bank": payerBank, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishVANSettlement(ctx context.Context, vanID, settlementRef string, amount float64, destinationAccount, tenantID string) error {
	return p.publishEvent(ctx, "VAN_SETTLEMENT", map[string]interface{}{
		"van_id": vanID, "settlement_ref": settlementRef, "amount": amount, "destination_account": destinationAccount, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) publishEvent(ctx context.Context, eventType string, payload map[string]interface{}) error {
	payload["event_type"] = eventType
	payload["service_name"] = p.serviceName
	payload["timestamp"] = time.Now().Format(time.RFC3339)
	payload["ingestion_time"] = time.Now().Format(time.RFC3339)
	return p.writeToDelta(ctx, "bronze.virtual_account_events", []map[string]interface{}{payload}, "append")
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
