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
		serviceName: "gamification-service",
	}
}

type DeltaWriteRequest struct {
	TableName string                   `json:"table_name"`
	Data      []map[string]interface{} `json:"data"`
	Mode      string                   `json:"mode"`
}

func (p *LakehousePublisher) PublishPointsEarned(ctx context.Context, userID, activityType string, points int, tenantID string) error {
	return p.publishEvent(ctx, "POINTS_EARNED", map[string]interface{}{
		"user_id": userID, "activity_type": activityType, "points": points, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishBadgeAwarded(ctx context.Context, userID, badgeID, badgeName, category, tenantID string) error {
	return p.publishEvent(ctx, "BADGE_AWARDED", map[string]interface{}{
		"user_id": userID, "badge_id": badgeID, "badge_name": badgeName, "category": category, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishLevelUp(ctx context.Context, userID string, oldLevel, newLevel int, tenantID string) error {
	return p.publishEvent(ctx, "LEVEL_UP", map[string]interface{}{
		"user_id": userID, "old_level": oldLevel, "new_level": newLevel, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) PublishRewardRedeemed(ctx context.Context, userID, rewardID, rewardType string, pointsCost int, tenantID string) error {
	return p.publishEvent(ctx, "REWARD_REDEEMED", map[string]interface{}{
		"user_id": userID, "reward_id": rewardID, "reward_type": rewardType, "points_cost": pointsCost, "tenant_id": tenantID,
	})
}

func (p *LakehousePublisher) publishEvent(ctx context.Context, eventType string, payload map[string]interface{}) error {
	payload["event_type"] = eventType
	payload["service_name"] = p.serviceName
	payload["timestamp"] = time.Now().Format(time.RFC3339)
	payload["ingestion_time"] = time.Now().Format(time.RFC3339)
	return p.writeToDelta(ctx, "bronze.gamification_events", []map[string]interface{}{payload}, "append")
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
