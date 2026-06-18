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

// PublishAuditEvent publishes audit events to Kafka
func (m *MiddlewareIntegration) PublishAuditEvent(eventType string, data interface{}) error {
	event := map[string]interface{}{
		"eventType": eventType,
		"tenantID":  m.tenantID,
		"data":      data,
		"timestamp": time.Now().Format(time.RFC3339),
	}
	return m.publishToKafka("audit-events", event)
}

// PublishFindingEvent publishes finding events to Kafka
func (m *MiddlewareIntegration) PublishFindingEvent(eventType string, finding *AuditFinding) error {
	event := map[string]interface{}{
		"eventType":  eventType,
		"tenantID":   m.tenantID,
		"findingID":  finding.FindingID,
		"title":      finding.Title,
		"riskRating": finding.RiskRating,
		"status":     finding.Status,
		"department": finding.Department,
		"timestamp":  time.Now().Format(time.RFC3339),
	}
	return m.publishToKafka("audit-finding-events", event)
}

// PublishEngagementEvent publishes engagement events to Kafka
func (m *MiddlewareIntegration) PublishEngagementEvent(eventType string, engagement *AuditEngagement) error {
	event := map[string]interface{}{
		"eventType":    eventType,
		"tenantID":     m.tenantID,
		"engagementID": engagement.EngagementID,
		"name":         engagement.EngagementName,
		"auditType":    engagement.AuditType,
		"status":       engagement.Status,
		"timestamp":    time.Now().Format(time.RFC3339),
	}
	return m.publishToKafka("audit-engagement-events", event)
}

// PublishReportEvent publishes report events to Kafka
func (m *MiddlewareIntegration) PublishReportEvent(eventType string, report *AuditReport) error {
	event := map[string]interface{}{
		"eventType":     eventType,
		"tenantID":      m.tenantID,
		"reportID":      report.ReportID,
		"title":         report.ReportTitle,
		"overallRating": report.OverallRating,
		"status":        report.Status,
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	return m.publishToKafka("audit-report-events", event)
}

func (m *MiddlewareIntegration) publishToKafka(topic string, event map[string]interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
		"topic": topic,
		"value": event,
	})
	if err != nil {
		return err
	}

	resp, err := http.Post(m.kafkaURL+"/produce", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// Redis Integration

// CacheAuditData caches audit data in Redis
func (m *MiddlewareIntegration) CacheAuditData(key string, data interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
		"key":   fmt.Sprintf("audit:%s:%s", m.tenantID, key),
		"value": data,
		"ttl":   3600,
	})
	if err != nil {
		return err
	}

	resp, err := http.Post(m.redisURL+"/set", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// CacheDashboard caches dashboard data in Redis
func (m *MiddlewareIntegration) CacheDashboard(dashboard *AuditDashboard) error {
	payload, err := json.Marshal(map[string]interface{}{
		"key":   fmt.Sprintf("audit-dashboard:%s", m.tenantID),
		"value": dashboard,
		"ttl":   300,
	})
	if err != nil {
		return err
	}

	resp, err := http.Post(m.redisURL+"/set", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// Permify Integration

// CheckPermission checks permission via Permify
func (m *MiddlewareIntegration) CheckPermission(userID, resource, action string) (bool, error) {
	payload, err := json.Marshal(map[string]interface{}{
		"tenant_id": m.tenantID,
		"entity": map[string]string{
			"type": resource,
			"id":   m.tenantID,
		},
		"subject": map[string]string{
			"type": "user",
			"id":   userID,
		},
		"permission": action,
	})
	if err != nil {
		return false, err
	}

	resp, err := http.Post(m.permifyURL+"/v1/tenants/"+m.tenantID+"/permissions/check", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	if can, ok := result["can"].(string); ok {
		return can == "CHECK_RESULT_ALLOWED", nil
	}

	return false, nil
}

// Dapr Integration

// SendNotification sends notification via Dapr
func (m *MiddlewareIntegration) SendNotification(recipientID, channel, message string) error {
	payload, err := json.Marshal(map[string]interface{}{
		"tenantID":    m.tenantID,
		"recipientID": recipientID,
		"channel":     channel,
		"message":     message,
		"timestamp":   time.Now().Format(time.RFC3339),
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("http://localhost:%s/v1.0/invoke/notification-service/method/send", m.daprHTTPPort)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// SendCriticalFindingAlert sends critical finding alert
func (m *MiddlewareIntegration) SendCriticalFindingAlert(finding *AuditFinding) error {
	message := fmt.Sprintf("CRITICAL AUDIT FINDING: %s in %s department requires immediate attention", finding.Title, finding.Department)
	return m.SendNotification("audit-committee", "email", message)
}

// SendOverdueFindingAlert sends overdue finding alert
func (m *MiddlewareIntegration) SendOverdueFindingAlert(finding *AuditFinding) error {
	message := fmt.Sprintf("OVERDUE FINDING: %s has exceeded its target remediation date", finding.Title)
	return m.SendNotification(finding.ResponsiblePerson, "email", message)
}

// SendReportIssuedNotification sends report issued notification
func (m *MiddlewareIntegration) SendReportIssuedNotification(report *AuditReport) error {
	message := fmt.Sprintf("Audit Report Issued: %s - Overall Rating: %s", report.ReportTitle, report.OverallRating)
	for _, recipient := range report.Distribution {
		m.SendNotification(recipient, "email", message)
	}
	return nil
}

// Lakehouse Integration

// PublishToLakehouse publishes data to Lakehouse
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

	resp, err := http.Post(m.lakehouseURL+"/api/v1/ingest", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// PublishFindingAnalytics publishes finding analytics to Lakehouse
func (m *MiddlewareIntegration) PublishFindingAnalytics(finding *AuditFinding) error {
	analytics := map[string]interface{}{
		"findingID":    finding.FindingID,
		"engagementID": finding.EngagementID,
		"title":        finding.Title,
		"riskRating":   finding.RiskRating,
		"category":     finding.Category,
		"department":   finding.Department,
		"status":       finding.Status,
		"identifiedAt": finding.IdentifiedAt.Format(time.RFC3339),
	}
	return m.PublishToLakehouse("audit_finding_analytics", analytics)
}

// PublishControlTestAnalytics publishes control test analytics to Lakehouse
func (m *MiddlewareIntegration) PublishControlTestAnalytics(test *ControlTest) error {
	analytics := map[string]interface{}{
		"testID":          test.TestID,
		"engagementID":    test.EngagementID,
		"controlName":     test.ControlName,
		"controlCategory": test.ControlCategory,
		"controlType":     test.ControlType,
		"sampleSize":      test.SampleSize,
		"sampleTested":    test.SampleTested,
		"exceptionsFound": test.ExceptionsFound,
		"testResult":      test.TestResult,
		"status":          test.Status,
	}
	return m.PublishToLakehouse("audit_control_test_analytics", analytics)
}

// PublishEngagementAnalytics publishes engagement analytics to Lakehouse
func (m *MiddlewareIntegration) PublishEngagementAnalytics(engagement *AuditEngagement) error {
	analytics := map[string]interface{}{
		"engagementID":   engagement.EngagementID,
		"engagementName": engagement.EngagementName,
		"auditType":      engagement.AuditType,
		"department":     engagement.Department,
		"status":         engagement.Status,
		"riskAssessment": engagement.RiskAssessment,
		"controlsTested": engagement.ControlsTested,
		"findingsCount":  engagement.FindingsCount,
		"startDate":      engagement.StartDate.Format(time.RFC3339),
		"endDate":        engagement.EndDate.Format(time.RFC3339),
	}
	return m.PublishToLakehouse("audit_engagement_analytics", analytics)
}

// PublishRiskAssessmentAnalytics publishes risk assessment analytics to Lakehouse
func (m *MiddlewareIntegration) PublishRiskAssessmentAnalytics(assessment *RiskAssessment) error {
	analytics := map[string]interface{}{
		"assessmentID":         assessment.AssessmentID,
		"assessmentName":       assessment.AssessmentName,
		"department":           assessment.Department,
		"process":              assessment.Process,
		"inherentRisk":         assessment.InherentRisk,
		"controlEffectiveness": assessment.ControlEffectiveness,
		"residualRisk":         assessment.ResidualRisk,
		"riskScore":            assessment.RiskScore,
		"auditFrequency":       assessment.AuditFrequency,
	}
	return m.PublishToLakehouse("audit_risk_assessment_analytics", analytics)
}
