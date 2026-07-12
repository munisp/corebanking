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

// LakehousePublisher handles publishing reconciliation events to the lakehouse.
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
		serviceName: "reconciliation-service",
	}
}

type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

func (p *LakehousePublisher) PublishReconciliationRun(ctx context.Context, run *ReconciliationRun) error {
	endTime := ""
	if run.EndTime != nil {
		endTime = run.EndTime.Format(time.RFC3339)
	}
	payload := map[string]interface{}{
		"run_id":              run.ID,
		"status":              run.Status,
		"start_time":          run.StartTime.Format(time.RFC3339),
		"end_time":            endTime,
		"total_accounts":      run.TotalAccounts,
		"accounts_reconciled": run.AccountsReconciled,
		"discrepancies_found": run.DiscrepanciesFound,
		"auto_resolved":       run.AutoResolved,
		"duration_seconds":    run.Duration,
		"error":               run.Error,
	}
	return p.publishEvent(ctx, "RECONCILIATION_RUN_COMPLETED", payload)
}

func (p *LakehousePublisher) PublishDiscrepancy(ctx context.Context, disc Discrepancy) error {
	resolvedAt := ""
	if disc.ResolvedAt != nil {
		resolvedAt = disc.ResolvedAt.Format(time.RFC3339)
	}
	payload := map[string]interface{}{
		"discrepancy_id":    disc.ID,
		"reconciliation_id": disc.ReconciliationID,
		"account_id":        disc.AccountID,
		"tenant_id":         disc.TenantID,
		"type":              disc.Type,
		"severity":          disc.Severity,
		"tigerbeetle_value": disc.TigerBeetleValue,
		"postgres_value":    disc.PostgresValue,
		"difference":        disc.Difference,
		"description":       disc.Description,
		"status":            disc.Status,
		"created_at":        disc.CreatedAt.Format(time.RFC3339),
		"resolved_at":       resolvedAt,
		"resolved_by":       disc.ResolvedBy,
		"resolution_notes":  disc.ResolutionNotes,
		"auto_resolved":     disc.AutoResolved,
	}
	return p.publishEvent(ctx, "RECONCILIATION_DISCREPANCY", payload)
}

func (p *LakehousePublisher) PublishSettlementException(ctx context.Context, runID string, disc Discrepancy, settlementNetwork string) error {
	payload := map[string]interface{}{
		"run_id":             runID,
		"discrepancy_id":     disc.ID,
		"account_id":         disc.AccountID,
		"tenant_id":          disc.TenantID,
		"type":               disc.Type,
		"severity":           disc.Severity,
		"difference":         disc.Difference,
		"status":             disc.Status,
		"settlement_network": settlementNetwork,
		"mojaloop_relevant":  settlementNetwork == "mojaloop",
	}
	return p.publishEvent(ctx, "SETTLEMENT_EXCEPTION", payload)
}

func (p *LakehousePublisher) PublishDiscrepancyResolution(ctx context.Context, discID, resolvedBy, resolutionNotes string) error {
	payload := map[string]interface{}{
		"discrepancy_id":   discID,
		"resolved_by":      resolvedBy,
		"resolution_notes": resolutionNotes,
		"resolved_at":      time.Now().Format(time.RFC3339),
	}
	return p.publishEvent(ctx, "RECONCILIATION_DISCREPANCY_RESOLVED", payload)
}

func (p *LakehousePublisher) publishEvent(ctx context.Context, eventType string, payload map[string]interface{}) error {
	payload["event_type"] = eventType
	payload["service_name"] = p.serviceName
	payload["timestamp"] = time.Now().Format(time.RFC3339)
	payload["ingestion_time"] = time.Now().Format(time.RFC3339)
	return p.writeToDelta(ctx, "bronze.reconciliation_events", []map[string]interface{}{payload}, "append")
}

func (p *LakehousePublisher) writeToDelta(ctx context.Context, tableName string, data []map[string]interface{}, mode string) error {
	req := DeltaWriteRequest{TableName: tableName, Data: data, Mode: mode}
	jsonBody, err := json.Marshal(req)
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/v1/delta/write", bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
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
