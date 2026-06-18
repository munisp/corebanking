package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// MiddlewareIntegration handles integration with middleware components
type MiddlewareIntegration struct {
	tenantID       string
	kafkaURL       string
	tigerBeetleURL string
	redisURL       string
	permifyURL     string
	daprHTTPPort   string
	lakehouseURL   string
}

// NewMiddlewareIntegration creates a new middleware integration
func NewMiddlewareIntegration(tenantID string) *MiddlewareIntegration {
	return &MiddlewareIntegration{
		tenantID:       tenantID,
		kafkaURL:       getEnvOrDefault("KAFKA_BROKER_URL", "http://localhost:9092"),
		tigerBeetleURL: getEnvOrDefault("TIGERBEETLE_URL", "http://localhost:3000"),
		redisURL:       getEnvOrDefault("REDIS_URL", "http://localhost:6379"),
		permifyURL:     getEnvOrDefault("PERMIFY_URL", "http://localhost:3476"),
		daprHTTPPort:   getEnvOrDefault("DAPR_HTTP_PORT", "3500"),
		lakehouseURL:   getEnvOrDefault("LAKEHOUSE_URL", "http://localhost:8181"),
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Kafka Integration

// PublishRiskEvent publishes a risk event to Kafka
func (m *MiddlewareIntegration) PublishRiskEvent(eventType string, payload interface{}) error {
	event := map[string]interface{}{
		"eventType": eventType,
		"tenantID":  m.tenantID,
		"payload":   payload,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	return m.publishToKafka("risk-events", event)
}

// PublishCreditRiskEvent publishes credit risk events
func (m *MiddlewareIntegration) PublishCreditRiskEvent(action string, risk *CreditRisk) error {
	return m.PublishRiskEvent("credit_risk."+action, map[string]interface{}{
		"riskID":         risk.RiskID,
		"entityType":     risk.EntityType,
		"entityID":       risk.EntityID,
		"exposureAmount": risk.ExposureAmount,
		"riskRating":     risk.RiskRating,
		"watchlistStatus": risk.WatchlistStatus,
	})
}

// PublishOperationalRiskEvent publishes operational risk events
func (m *MiddlewareIntegration) PublishOperationalRiskEvent(action string, risk *OperationalRisk) error {
	return m.PublishRiskEvent("operational_risk."+action, map[string]interface{}{
		"riskID":      risk.RiskID,
		"eventType":   risk.EventType,
		"severity":    risk.Severity,
		"grossLoss":   risk.GrossLoss,
		"status":      risk.Status,
	})
}

// PublishMarketRiskEvent publishes market risk events
func (m *MiddlewareIntegration) PublishMarketRiskEvent(action string, risk *MarketRisk) error {
	return m.PublishRiskEvent("market_risk."+action, map[string]interface{}{
		"riskID":    risk.RiskID,
		"portfolio": risk.Portfolio,
		"var":       risk.VaR,
		"status":    risk.Status,
	})
}

// PublishLimitBreachEvent publishes limit breach events
func (m *MiddlewareIntegration) PublishLimitBreachEvent(limit *RiskLimit) error {
	return m.PublishRiskEvent("limit.breach", map[string]interface{}{
		"limitID":     limit.LimitID,
		"limitName":   limit.LimitName,
		"limitType":   limit.LimitType,
		"limitValue":  limit.LimitValue,
		"currentUsage": limit.CurrentUsage,
		"utilization": limit.Utilization,
		"status":      limit.Status,
	})
}

// PublishKRIAlertEvent publishes KRI alert events
func (m *MiddlewareIntegration) PublishKRIAlertEvent(indicator *RiskIndicator) error {
	return m.PublishRiskEvent("kri.alert", map[string]interface{}{
		"indicatorID":   indicator.IndicatorID,
		"indicatorName": indicator.IndicatorName,
		"category":      indicator.Category,
		"currentValue":  indicator.CurrentValue,
		"threshold":     indicator.Threshold,
		"status":        indicator.Status,
	})
}

// PublishStressTestEvent publishes stress test events
func (m *MiddlewareIntegration) PublishStressTestEvent(action string, test *StressTest) error {
	return m.PublishRiskEvent("stress_test."+action, map[string]interface{}{
		"testID":        test.TestID,
		"testName":      test.TestName,
		"scenario":      test.Scenario,
		"stressedRatio": test.StressedRatio,
		"status":        test.Status,
	})
}

func (m *MiddlewareIntegration) publishToKafka(topic string, event interface{}) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/topics/%s", m.kafkaURL, topic)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// TigerBeetle Integration

// PostProvisionToLedger posts provision entries to TigerBeetle
func (m *MiddlewareIntegration) PostProvisionToLedger(riskID string, provisionAmount int64, currency string) error {
	entry := map[string]interface{}{
		"id":          fmt.Sprintf("prov-%s-%d", riskID, time.Now().UnixNano()),
		"debitAccount": "provision_expense",
		"creditAccount": "loan_loss_provision",
		"amount":       provisionAmount,
		"currency":     currency,
		"reference":    riskID,
		"tenantID":     m.tenantID,
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	return m.postToTigerBeetle("/transfers", entry)
}

// PostCapitalChargeToLedger posts capital charge entries
func (m *MiddlewareIntegration) PostCapitalChargeToLedger(riskType string, amount int64) error {
	entry := map[string]interface{}{
		"id":           fmt.Sprintf("cap-%s-%d", riskType, time.Now().UnixNano()),
		"debitAccount": "capital_charge_" + riskType,
		"creditAccount": "regulatory_capital",
		"amount":       amount,
		"currency":     "NGN",
		"tenantID":     m.tenantID,
		"timestamp":    time.Now().Format(time.RFC3339),
	}

	return m.postToTigerBeetle("/transfers", entry)
}

func (m *MiddlewareIntegration) postToTigerBeetle(endpoint string, data interface{}) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}

	url := m.tigerBeetleURL + endpoint
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// Redis Integration

// CacheRiskData caches risk data in Redis
func (m *MiddlewareIntegration) CacheRiskData(key string, data interface{}, ttlSeconds int) error {
	payload, err := json.Marshal(map[string]interface{}{
		"key":   fmt.Sprintf("%s:%s", m.tenantID, key),
		"value": data,
		"ttl":   ttlSeconds,
	})
	if err != nil {
		return err
	}

	url := m.redisURL + "/set"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// CacheDashboard caches dashboard data
func (m *MiddlewareIntegration) CacheDashboard(dashboard *RiskDashboard) error {
	return m.CacheRiskData("risk:dashboard", dashboard, 300) // 5 minutes
}

// CacheVaR caches VaR data
func (m *MiddlewareIntegration) CacheVaR(var_ map[string]interface{}) error {
	return m.CacheRiskData("risk:var", var_, 300)
}

// Permify Integration

// CheckPermission checks permission with Permify
func (m *MiddlewareIntegration) CheckPermission(userID, resource, action string) (bool, error) {
	payload, err := json.Marshal(map[string]interface{}{
		"tenant_id": m.tenantID,
		"entity": map[string]string{
			"type": resource,
			"id":   m.tenantID,
		},
		"permission": action,
		"subject": map[string]string{
			"type": "user",
			"id":   userID,
		},
	})
	if err != nil {
		return false, err
	}

	url := m.permifyURL + "/v1/tenants/" + m.tenantID + "/permissions/check"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
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

// Dapr Integration

// SendNotification sends notification via Dapr
func (m *MiddlewareIntegration) SendNotification(channel, recipient, subject, message string) error {
	payload, err := json.Marshal(map[string]interface{}{
		"channel":   channel,
		"recipient": recipient,
		"subject":   subject,
		"message":   message,
		"tenantID":  m.tenantID,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("http://localhost:%s/v1.0/invoke/notification-service/method/send", m.daprHTTPPort)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// SendRiskAlert sends risk alert notification
func (m *MiddlewareIntegration) SendRiskAlert(alertType, severity, message string, recipients []string) error {
	for _, recipient := range recipients {
		if err := m.SendNotification("email", recipient, fmt.Sprintf("[%s] Risk Alert: %s", severity, alertType), message); err != nil {
			return err
		}
	}
	return nil
}

// SendLimitBreachAlert sends limit breach alert
func (m *MiddlewareIntegration) SendLimitBreachAlert(limit *RiskLimit) error {
	message := fmt.Sprintf("Risk limit '%s' has been breached. Current utilization: %.2f%%, Limit: %d", 
		limit.LimitName, limit.Utilization, limit.LimitValue)
	return m.SendRiskAlert("Limit Breach", "HIGH", message, []string{"risk-team@54bank.com", "cro@54bank.com"})
}

// SendKRIAlert sends KRI alert
func (m *MiddlewareIntegration) SendKRIAlert(indicator *RiskIndicator) error {
	message := fmt.Sprintf("KRI '%s' is in %s status. Current value: %.2f %s, Threshold: %.2f %s",
		indicator.IndicatorName, indicator.Status, indicator.CurrentValue, indicator.Unit, indicator.Threshold, indicator.Unit)
	return m.SendRiskAlert("KRI Alert", "MEDIUM", message, []string{"risk-team@54bank.com"})
}

// Lakehouse Integration

// PublishToLakehouse publishes risk data to Lakehouse for analytics
func (m *MiddlewareIntegration) PublishToLakehouse(table string, data interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
		"table":     table,
		"tenantID":  m.tenantID,
		"data":      data,
		"timestamp": time.Now().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	url := m.lakehouseURL + "/api/v1/ingest"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", m.tenantID)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// PublishCreditRiskAnalytics publishes credit risk data to Lakehouse
func (m *MiddlewareIntegration) PublishCreditRiskAnalytics(risk *CreditRisk) error {
	return m.PublishToLakehouse("risk_credit", map[string]interface{}{
		"riskID":           risk.RiskID,
		"entityType":       risk.EntityType,
		"entityID":         risk.EntityID,
		"exposureAmount":   risk.ExposureAmount,
		"pd":               risk.PD,
		"lgd":              risk.LGD,
		"expectedLoss":     risk.ExpectedLoss,
		"riskRating":       risk.RiskRating,
		"watchlistStatus":  risk.WatchlistStatus,
		"provisionAmount":  risk.ProvisionAmount,
		"collateralCoverage": risk.CollateralCoverage,
	})
}

// PublishMarketRiskAnalytics publishes market risk data to Lakehouse
func (m *MiddlewareIntegration) PublishMarketRiskAnalytics(risk *MarketRisk) error {
	return m.PublishToLakehouse("risk_market", map[string]interface{}{
		"riskID":            risk.RiskID,
		"portfolio":         risk.Portfolio,
		"var":               risk.VaR,
		"expectedShortfall": risk.ExpectedShortfall,
		"stressVaR":         risk.StressVaR,
		"status":            risk.Status,
	})
}

// PublishOperationalRiskAnalytics publishes operational risk data to Lakehouse
func (m *MiddlewareIntegration) PublishOperationalRiskAnalytics(risk *OperationalRisk) error {
	return m.PublishToLakehouse("risk_operational", map[string]interface{}{
		"riskID":        risk.RiskID,
		"eventType":     risk.EventType,
		"eventCategory": risk.EventCategory,
		"department":    risk.Department,
		"grossLoss":     risk.GrossLoss,
		"netLoss":       risk.NetLoss,
		"severity":      risk.Severity,
		"status":        risk.Status,
	})
}

// PublishRiskDashboardAnalytics publishes dashboard data to Lakehouse
func (m *MiddlewareIntegration) PublishRiskDashboardAnalytics(dashboard *RiskDashboard) error {
	return m.PublishToLakehouse("risk_dashboard", map[string]interface{}{
		"date":                 dashboard.Date.Format("2006-01-02"),
		"totalExposure":        dashboard.TotalExposure,
		"nplRatio":             dashboard.NPLRatio,
		"totalVaR":             dashboard.TotalVaR,
		"openIncidents":        dashboard.OpenIncidents,
		"capitalAdequacyRatio": dashboard.CapitalAdequacyRatio,
		"kriBreaches":          dashboard.KRIBreaches,
	})
}
