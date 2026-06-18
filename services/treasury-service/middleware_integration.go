package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// MiddlewareIntegration handles integration with platform middleware
type MiddlewareIntegration struct {
	tenantID          string
	kafkaClient       *KafkaClient
	tigerBeetleClient *TigerBeetleClient
	redisClient       *RedisClient
	permifyClient     *PermifyClient
}

// KafkaClient handles Kafka operations
type KafkaClient struct {
	brokerURL string
}

// TigerBeetleClient handles TigerBeetle operations
type TigerBeetleClient struct {
	serviceURL string
}

// RedisClient handles Redis operations
type RedisClient struct {
	serviceURL string
}

// PermifyClient handles Permify operations
type PermifyClient struct {
	serviceURL string
}

// NewMiddlewareIntegration creates a new middleware integration
func NewMiddlewareIntegration(tenantID string) *MiddlewareIntegration {
	return &MiddlewareIntegration{
		tenantID:          tenantID,
		kafkaClient:       &KafkaClient{brokerURL: getEnv("KAFKA_BROKER_URL", "http://localhost:9092")},
		tigerBeetleClient: &TigerBeetleClient{serviceURL: getEnv("TIGERBEETLE_URL", "http://localhost:3000")},
		redisClient:       &RedisClient{serviceURL: getEnv("REDIS_URL", "http://localhost:6379")},
		permifyClient:     &PermifyClient{serviceURL: getEnv("PERMIFY_URL", "http://localhost:3476")},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// PublishTreasuryEvent publishes a treasury event to Kafka
func (m *MiddlewareIntegration) PublishTreasuryEvent(eventType string, payload interface{}) error {
	event := map[string]interface{}{
		"eventType": eventType,
		"tenantID":  m.tenantID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payload,
	}

	return m.publishToKafka("treasury-events", event)
}

// PublishFXDealEvent publishes an FX deal event
func (m *MiddlewareIntegration) PublishFXDealEvent(deal *FXDeal, action string) error {
	event := map[string]interface{}{
		"action":       action,
		"dealID":       deal.DealID,
		"dealNumber":   deal.DealNumber,
		"dealType":     deal.DealType,
		"buyCurrency":  deal.BuyCurrency,
		"sellCurrency": deal.SellCurrency,
		"buyAmount":    deal.BuyAmount,
		"sellAmount":   deal.SellAmount,
		"rate":         deal.Rate,
		"status":       deal.Status,
	}
	return m.PublishTreasuryEvent("treasury.fx."+action, event)
}

// PublishInterbankDealEvent publishes an interbank deal event
func (m *MiddlewareIntegration) PublishInterbankDealEvent(deal *InterbankDeal, action string) error {
	event := map[string]interface{}{
		"action":       action,
		"dealID":       deal.DealID,
		"dealNumber":   deal.DealNumber,
		"dealType":     deal.DealType,
		"counterParty": deal.CounterParty,
		"principal":    deal.Principal,
		"interestRate": deal.InterestRate,
		"status":       deal.Status,
	}
	return m.PublishTreasuryEvent("treasury.interbank."+action, event)
}

// PublishInvestmentEvent publishes an investment event
func (m *MiddlewareIntegration) PublishInvestmentEvent(investment *Investment, action string) error {
	event := map[string]interface{}{
		"action":         action,
		"investmentID":   investment.InvestmentID,
		"investmentType": investment.InvestmentType,
		"issuer":         investment.Issuer,
		"faceValue":      investment.FaceValue,
		"currentValue":   investment.CurrentValue,
		"status":         investment.Status,
	}
	return m.PublishTreasuryEvent("treasury.investment."+action, event)
}

// PublishLimitEvent publishes a limit event
func (m *MiddlewareIntegration) PublishLimitEvent(limit *TreasuryLimit, action string) error {
	event := map[string]interface{}{
		"action":      action,
		"limitID":     limit.LimitID,
		"limitType":   limit.LimitType,
		"currency":    limit.Currency,
		"limitValue":  limit.LimitValue,
		"utilization": limit.Utilization,
		"status":      limit.Status,
	}
	return m.PublishTreasuryEvent("treasury.limit."+action, event)
}

// publishToKafka publishes a message to Kafka
func (m *MiddlewareIntegration) publishToKafka(topic string, message interface{}) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", m.kafkaClient.brokerURL+"/topics/"+topic, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Kafka publish error (non-fatal): %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// PostFXDealToLedger posts FX deal to TigerBeetle
func (m *MiddlewareIntegration) PostFXDealToLedger(deal *FXDeal) error {
	entries := []map[string]interface{}{
		{
			"id":            deal.DealID + "-buy",
			"debitAccount":  "1200-fx-" + deal.BuyCurrency,
			"creditAccount": "1200-fx-" + deal.SellCurrency,
			"amount":        deal.BuyAmount,
			"currency":      deal.BuyCurrency,
			"ledger":        1,
			"code":          2001,
			"flags":         0,
			"timestamp":     time.Now().UnixNano(),
		},
	}

	return m.postToTigerBeetle(entries)
}

// PostInterbankDealToLedger posts interbank deal to TigerBeetle
func (m *MiddlewareIntegration) PostInterbankDealToLedger(deal *InterbankDeal) error {
	var debitAccount, creditAccount string
	if deal.DealType == "placement" {
		debitAccount = "1300-interbank-placements"
		creditAccount = "1100-cash"
	} else {
		debitAccount = "1100-cash"
		creditAccount = "2300-interbank-takings"
	}

	entries := []map[string]interface{}{
		{
			"id":            deal.DealID,
			"debitAccount":  debitAccount,
			"creditAccount": creditAccount,
			"amount":        deal.Principal,
			"currency":      deal.Currency,
			"ledger":        1,
			"code":          2002,
			"flags":         0,
			"timestamp":     time.Now().UnixNano(),
		},
	}

	return m.postToTigerBeetle(entries)
}

// PostInvestmentToLedger posts investment to TigerBeetle
func (m *MiddlewareIntegration) PostInvestmentToLedger(investment *Investment) error {
	entries := []map[string]interface{}{
		{
			"id":            investment.InvestmentID,
			"debitAccount":  "1400-investments-" + investment.InvestmentType,
			"creditAccount": "1100-cash",
			"amount":        investment.PurchasePrice,
			"currency":      investment.Currency,
			"ledger":        1,
			"code":          2003,
			"flags":         0,
			"timestamp":     time.Now().UnixNano(),
		},
	}

	return m.postToTigerBeetle(entries)
}

// postToTigerBeetle posts entries to TigerBeetle
func (m *MiddlewareIntegration) postToTigerBeetle(entries []map[string]interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
		"transfers": entries,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", m.tigerBeetleClient.serviceURL+"/transfers", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("TigerBeetle post error (non-fatal): %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// CacheTreasuryData caches treasury data in Redis
func (m *MiddlewareIntegration) CacheTreasuryData(key string, data interface{}, ttlSeconds int) error {
	payload, err := json.Marshal(map[string]interface{}{
		"key":   key,
		"value": data,
		"ttl":   ttlSeconds,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", m.redisClient.serviceURL+"/cache/set", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Redis cache error (non-fatal): %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// CheckPermission checks if a user has permission via Permify
func (m *MiddlewareIntegration) CheckPermission(userID, permission, resource, resourceID string) (bool, error) {
	payload, err := json.Marshal(map[string]interface{}{
		"tenant_id": m.tenantID,
		"entity": map[string]string{
			"type": resource,
			"id":   resourceID,
		},
		"permission": permission,
		"subject": map[string]string{
			"type": "user",
			"id":   userID,
		},
	})
	if err != nil {
		return false, err
	}

	req, err := http.NewRequest("POST", m.permifyClient.serviceURL+"/v1/tenants/"+m.tenantID+"/permissions/check", bytes.NewBuffer(payload))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("permify unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("permify bad response: %w", err)
	}

	if can, ok := result["can"].(string); ok {
		return can == "CHECK_RESULT_ALLOWED", nil
	}

	return false, fmt.Errorf("permify: unexpected response format")
}

// SendNotification sends a notification via Dapr
func (m *MiddlewareIntegration) SendNotification(notificationType, recipientID, message string, data map[string]interface{}) error {
	daprURL := getEnv("DAPR_HTTP_PORT", "3500")

	payload, err := json.Marshal(map[string]interface{}{
		"type":        notificationType,
		"recipientID": recipientID,
		"message":     message,
		"data":        data,
		"tenantID":    m.tenantID,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "http://localhost:"+daprURL+"/v1.0/invoke/notification-service/method/send", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Dapr notification error (non-fatal): %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// SendLimitBreachAlert sends limit breach alert
func (m *MiddlewareIntegration) SendLimitBreachAlert(limit *TreasuryLimit) error {
	return m.SendNotification(
		"limit_breach",
		"treasury_head",
		fmt.Sprintf("Limit breach: %s %s at %.2f%% utilization", limit.LimitType, limit.Currency, limit.Utilization),
		map[string]interface{}{
			"limitID":     limit.LimitID,
			"limitType":   limit.LimitType,
			"utilization": limit.Utilization,
		},
	)
}

// PublishToLakehouse publishes treasury data to Lakehouse for analytics
func (m *MiddlewareIntegration) PublishToLakehouse(dataType string, data interface{}) error {
	lakehouseURL := getEnv("LAKEHOUSE_URL", "http://localhost:8080")

	payload, err := json.Marshal(map[string]interface{}{
		"dataType":  dataType,
		"tenantID":  m.tenantID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      data,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", lakehouseURL+"/api/v1/ingest/"+dataType, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Lakehouse publish error (non-fatal): %v\n", err)
		return nil
	}
	defer resp.Body.Close()

	return nil
}

// PublishTreasuryAnalytics publishes treasury analytics to Lakehouse
func (m *MiddlewareIntegration) PublishTreasuryAnalytics(metrics map[string]interface{}) error {
	return m.PublishToLakehouse("treasury_analytics", metrics)
}
