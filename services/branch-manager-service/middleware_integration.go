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

// PublishBranchEvent publishes a branch event to Kafka
func (m *MiddlewareIntegration) PublishBranchEvent(eventType string, payload interface{}) error {
	event := map[string]interface{}{
		"eventType": eventType,
		"tenantID":  m.tenantID,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payload,
	}

	return m.publishToKafka("branch-events", event)
}

// PublishApprovalEvent publishes an approval event
func (m *MiddlewareIntegration) PublishApprovalEvent(approval *ApprovalRequest, action string) error {
	event := map[string]interface{}{
		"action":      action,
		"requestID":   approval.RequestID,
		"requestType": approval.RequestType,
		"branchID":    approval.BranchID,
		"amount":      approval.Amount,
		"status":      approval.Status,
	}
	return m.PublishBranchEvent("branch.approval."+action, event)
}

// PublishStaffEvent publishes a staff event
func (m *MiddlewareIntegration) PublishStaffEvent(staff *BranchStaff, action string) error {
	event := map[string]interface{}{
		"action":   action,
		"staffID":  staff.StaffID,
		"branchID": staff.BranchID,
		"role":     staff.Role,
		"status":   staff.Status,
	}
	return m.PublishBranchEvent("branch.staff."+action, event)
}

// PublishCashEvent publishes a cash management event
func (m *MiddlewareIntegration) PublishCashEvent(cash *CashManagement, action string) error {
	event := map[string]interface{}{
		"action":         action,
		"branchID":       cash.BranchID,
		"closingBalance": cash.ClosingBalance,
		"status":         cash.Status,
	}
	return m.PublishBranchEvent("branch.cash."+action, event)
}

// PublishIncidentEvent publishes an incident event
func (m *MiddlewareIntegration) PublishIncidentEvent(incident *BranchIncident, action string) error {
	event := map[string]interface{}{
		"action":       action,
		"incidentID":   incident.IncidentID,
		"branchID":     incident.BranchID,
		"incidentType": incident.IncidentType,
		"severity":     incident.Severity,
		"status":       incident.Status,
	}
	return m.PublishBranchEvent("branch.incident."+action, event)
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

// PostBranchToLedger posts branch-related transactions to TigerBeetle
func (m *MiddlewareIntegration) PostBranchToLedger(transactionType string, amount int64, currency, reference, branchID string) error {
	var entries []map[string]interface{}

	switch transactionType {
	case "cash_requisition":
		entries = []map[string]interface{}{
			{
				"id":            reference + "-req",
				"debitAccount":  "1100-" + branchID, // Branch Cash
				"creditAccount": "1100-HQ",          // HQ Cash
				"amount":        amount,
				"currency":      currency,
				"ledger":        1,
				"code":          4001,
				"flags":         0,
				"timestamp":     time.Now().UnixNano(),
			},
		}
	case "cash_evacuation":
		entries = []map[string]interface{}{
			{
				"id":            reference + "-evac",
				"debitAccount":  "1100-HQ",          // HQ Cash
				"creditAccount": "1100-" + branchID, // Branch Cash
				"amount":        amount,
				"currency":      currency,
				"ledger":        1,
				"code":          4002,
				"flags":         0,
				"timestamp":     time.Now().UnixNano(),
			},
		}
	case "fee_income":
		entries = []map[string]interface{}{
			{
				"id":            reference + "-fee",
				"debitAccount":  "1100-" + branchID, // Branch Cash
				"creditAccount": "4100-" + branchID, // Fee Income
				"amount":        amount,
				"currency":      currency,
				"ledger":        1,
				"code":          4003,
				"flags":         0,
				"timestamp":     time.Now().UnixNano(),
			},
		}
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

// CacheBranchData caches branch data in Redis
func (m *MiddlewareIntegration) CacheBranchData(key string, data interface{}, ttlSeconds int) error {
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

// SendApprovalNotification sends approval notification
func (m *MiddlewareIntegration) SendApprovalNotification(approval *ApprovalRequest, recipientID string) error {
	return m.SendNotification(
		"approval_request",
		recipientID,
		fmt.Sprintf("New %s approval request: %s", approval.RequestType, approval.Description),
		map[string]interface{}{
			"requestID":   approval.RequestID,
			"requestType": approval.RequestType,
			"amount":      approval.Amount,
			"priority":    approval.Priority,
		},
	)
}

// SendIncidentNotification sends incident notification
func (m *MiddlewareIntegration) SendIncidentNotification(incident *BranchIncident, recipientID string) error {
	return m.SendNotification(
		"incident_alert",
		recipientID,
		fmt.Sprintf("%s incident: %s", incident.Severity, incident.Title),
		map[string]interface{}{
			"incidentID":   incident.IncidentID,
			"incidentType": incident.IncidentType,
			"severity":     incident.Severity,
		},
	)
}

// PublishToLakehouse publishes branch data to Lakehouse for analytics
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

// PublishPerformanceAnalytics publishes performance analytics to Lakehouse
func (m *MiddlewareIntegration) PublishPerformanceAnalytics(performance *BranchPerformance) error {
	analytics := map[string]interface{}{
		"branchID":             performance.BranchID,
		"period":               performance.Period,
		"totalTransactions":    performance.TotalTransactions,
		"totalDeposits":        performance.TotalDepositAmount,
		"totalWithdrawals":     performance.TotalWithdrawalAmount,
		"customersServed":      performance.CustomersServed,
		"customerSatisfaction": performance.CustomerSatisfaction,
		"totalRevenue":         performance.TotalRevenue,
		"date":                 performance.Date.Format(time.RFC3339),
	}
	return m.PublishToLakehouse("branch_performance", analytics)
}
