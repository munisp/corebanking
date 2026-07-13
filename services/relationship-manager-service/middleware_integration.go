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

// PublishRMEvent publishes an RM event to Kafka
func (m *MiddlewareIntegration) PublishRMEvent(eventType string, payload interface{}) error {
	event := map[string]interface{}{
		"eventType": eventType,
		"tenantID":  m.tenantID,
		"payload":   payload,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	return m.publishToKafka("rm-events", event)
}

// PublishCustomerEvent publishes customer events
func (m *MiddlewareIntegration) PublishCustomerEvent(action string, customer *Customer) error {
	return m.PublishRMEvent("customer."+action, map[string]interface{}{
		"customerID":   customer.CustomerID,
		"customerType": customer.CustomerType,
		"segment":      customer.Segment,
		"assignedRM":   customer.AssignedRM,
		"status":       customer.Status,
	})
}

// PublishOpportunityEvent publishes opportunity events
func (m *MiddlewareIntegration) PublishOpportunityEvent(action string, opp *Opportunity) error {
	return m.PublishRMEvent("opportunity."+action, map[string]interface{}{
		"opportunityID": opp.OpportunityID,
		"customerID":    opp.CustomerID,
		"productType":   opp.ProductType,
		"expectedValue": opp.ExpectedValue,
		"stage":         opp.Stage,
		"assignedRM":    opp.AssignedRM,
	})
}

// PublishActivityEvent publishes activity events
func (m *MiddlewareIntegration) PublishActivityEvent(action string, activity *Activity) error {
	return m.PublishRMEvent("activity."+action, map[string]interface{}{
		"activityID":   activity.ActivityID,
		"customerID":   activity.CustomerID,
		"activityType": activity.ActivityType,
		"rmID":         activity.RMID,
	})
}

// PublishCrossSellEvent publishes cross-sell events
func (m *MiddlewareIntegration) PublishCrossSellEvent(action string, rec *CrossSellRecommendation) error {
	return m.PublishRMEvent("crosssell."+action, map[string]interface{}{
		"recommendationID": rec.RecommendationID,
		"customerID":       rec.CustomerID,
		"productType":      rec.ProductType,
		"expectedValue":    rec.ExpectedValue,
		"status":           rec.Status,
	})
}

// PublishCampaignEvent publishes campaign events
func (m *MiddlewareIntegration) PublishCampaignEvent(action string, campaign *Campaign) error {
	return m.PublishRMEvent("campaign."+action, map[string]interface{}{
		"campaignID":      campaign.CampaignID,
		"campaignName":    campaign.CampaignName,
		"campaignType":    campaign.CampaignType,
		"targetSegment":   campaign.TargetSegment,
		"conversionCount": campaign.ConversionCount,
		"status":          campaign.Status,
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

// PostRevenueToLedger posts revenue entries to TigerBeetle
func (m *MiddlewareIntegration) PostRevenueToLedger(rmID string, amount int64, revenueType string) error {
	entry := map[string]interface{}{
		"id":            fmt.Sprintf("rev-%s-%d", rmID, time.Now().UnixNano()),
		"debitAccount":  "customer_revenue",
		"creditAccount": "rm_revenue_" + rmID,
		"amount":        amount,
		"currency":      "NGN",
		"reference":     revenueType,
		"tenantID":      m.tenantID,
		"timestamp":     time.Now().Format(time.RFC3339),
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

// CacheRMData caches RM data in Redis
func (m *MiddlewareIntegration) CacheRMData(key string, data interface{}, ttlSeconds int) error {
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
func (m *MiddlewareIntegration) CacheDashboard(rmID string, dashboard *RMDashboard) error {
	return m.CacheRMData(fmt.Sprintf("rm:dashboard:%s", rmID), dashboard, 300)
}

// CachePortfolio caches portfolio data
func (m *MiddlewareIntegration) CachePortfolio(rmID string, portfolio *Portfolio) error {
	return m.CacheRMData(fmt.Sprintf("rm:portfolio:%s", rmID), portfolio, 300)
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

// SendAtRiskAlert sends at-risk customer alert
func (m *MiddlewareIntegration) SendAtRiskAlert(customer *Customer, rmEmail string) error {
	message := fmt.Sprintf("Customer %s %s (ID: %s) is at risk. NPS: %d, Risk Rating: %s",
		customer.FirstName, customer.LastName, customer.CustomerID, customer.NPS, customer.RiskRating)
	return m.SendNotification("email", rmEmail, "At-Risk Customer Alert", message)
}

// SendOpportunityAlert sends opportunity stage change alert
func (m *MiddlewareIntegration) SendOpportunityAlert(opp *Opportunity, rmEmail string) error {
	message := fmt.Sprintf("Opportunity '%s' for %s has moved to %s stage. Value: NGN %d",
		opp.ProductName, opp.CustomerName, opp.Stage, opp.ExpectedValue)
	return m.SendNotification("email", rmEmail, "Opportunity Update", message)
}

// SendFollowUpReminder sends follow-up reminder
func (m *MiddlewareIntegration) SendFollowUpReminder(activity *Activity, rmEmail string) error {
	message := fmt.Sprintf("Follow-up due for %s: %s", activity.CustomerName, activity.FollowUpNotes)
	return m.SendNotification("email", rmEmail, "Follow-up Reminder", message)
}

// Lakehouse Integration

// PublishToLakehouse publishes RM data to Lakehouse for analytics
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

// PublishCustomerAnalytics publishes customer data to Lakehouse
func (m *MiddlewareIntegration) PublishCustomerAnalytics(customer *Customer) error {
	return m.PublishToLakehouse("rm_customers", map[string]interface{}{
		"customerID":      customer.CustomerID,
		"customerType":    customer.CustomerType,
		"segment":         customer.Segment,
		"relationshipAge": customer.RelationshipAge,
		"totalBalance":    customer.TotalBalance,
		"totalProducts":   customer.TotalProducts,
		"revenue":         customer.Revenue,
		"profitability":   customer.Profitability,
		"nps":             customer.NPS,
		"assignedRM":      customer.AssignedRM,
		"status":          customer.Status,
	})
}

// PublishOpportunityAnalytics publishes opportunity data to Lakehouse
func (m *MiddlewareIntegration) PublishOpportunityAnalytics(opp *Opportunity) error {
	return m.PublishToLakehouse("rm_opportunities", map[string]interface{}{
		"opportunityID": opp.OpportunityID,
		"customerID":    opp.CustomerID,
		"productType":   opp.ProductType,
		"expectedValue": opp.ExpectedValue,
		"probability":   opp.Probability,
		"stage":         opp.Stage,
		"source":        opp.Source,
		"assignedRM":    opp.AssignedRM,
	})
}

// PublishPortfolioAnalytics publishes portfolio data to Lakehouse
func (m *MiddlewareIntegration) PublishPortfolioAnalytics(portfolio *Portfolio) error {
	return m.PublishToLakehouse("rm_portfolios", map[string]interface{}{
		"portfolioID":    portfolio.PortfolioID,
		"rmID":           portfolio.RMID,
		"totalCustomers": portfolio.TotalCustomers,
		"totalBalance":   portfolio.TotalBalance,
		"totalRevenue":   portfolio.TotalRevenue,
		"averageNPS":     portfolio.AverageNPS,
		"churnRate":      portfolio.ChurnRate,
		"crossSellRatio": portfolio.CrossSellRatio,
		"achievement":    portfolio.Achievement,
	})
}

// PublishCampaignAnalytics publishes campaign data to Lakehouse
func (m *MiddlewareIntegration) PublishCampaignAnalytics(campaign *Campaign) error {
	return m.PublishToLakehouse("rm_campaigns", map[string]interface{}{
		"campaignID":      campaign.CampaignID,
		"campaignName":    campaign.CampaignName,
		"campaignType":    campaign.CampaignType,
		"targetSegment":   campaign.TargetSegment,
		"targetCount":     campaign.TargetCount,
		"contactedCount":  campaign.ContactedCount,
		"responseCount":   campaign.ResponseCount,
		"conversionCount": campaign.ConversionCount,
		"budget":          campaign.Budget,
		"spent":           campaign.Spent,
		"revenue":         campaign.Revenue,
		"status":          campaign.Status,
	})
}
