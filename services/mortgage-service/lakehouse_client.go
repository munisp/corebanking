package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// LakehouseClient handles all lakehouse operations for mortgage service
type LakehouseClient struct {
	apiURL     string
	httpClient *http.Client
}

// LakehouseEvent represents an event to publish to lakehouse
type LakehouseEvent struct {
	EventType     string                 `json:"event_type"`
	Data          map[string]interface{} `json:"data"`
	SourceService string                 `json:"source_service"`
	Timestamp     string                 `json:"timestamp"`
}

// LakehouseQueryRequest represents a query request
type LakehouseQueryRequest struct {
	Query  string `json:"query"`
	Engine string `json:"engine"`
}

// LakehouseQueryResponse represents a query response
type LakehouseQueryResponse struct {
	Status    string                   `json:"status"`
	Engine    string                   `json:"engine"`
	Rows      int                      `json:"rows"`
	Data      []map[string]interface{} `json:"data"`
	Timestamp string                   `json:"timestamp"`
}

// FeatureRequest represents a feature retrieval request
type FeatureRequest struct {
	FeatureService string                   `json:"feature_service"`
	EntityRows     []map[string]interface{} `json:"entity_rows"`
}

// NewLakehouseClient creates a new lakehouse client
func NewLakehouseClient() *LakehouseClient {
	apiURL := os.Getenv("LAKEHOUSE_API_URL")
	if apiURL == "" {
		apiURL = "http://data-intelligence.54link.svc.cluster.local:8000"
	}

	client := &LakehouseClient{
		apiURL: apiURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	log.Printf("Lakehouse client initialized: %s", apiURL)
	return client
}

// PublishEvent publishes an event to the lakehouse for ingestion
func (c *LakehouseClient) PublishEvent(eventType string, data map[string]interface{}, sourceService string) error {
	event := LakehouseEvent{
		EventType:     eventType,
		Data:          data,
		SourceService: sourceService,
		Timestamp:     time.Now().Format(time.RFC3339),
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	log.Printf("Publishing to lakehouse: %s from %s", eventType, sourceService)

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/events/publish", c.apiURL),
		"application/json",
		bytes.NewBuffer(eventJSON),
	)
	if err != nil {
		log.Printf("Warning: Failed to publish to lakehouse: %v", err)
		return nil // Don't fail the main operation
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Warning: Lakehouse publish failed: %s", string(body))
	}

	return nil
}

// Query executes a SQL query on the lakehouse
func (c *LakehouseClient) Query(sql string, engine string) ([]map[string]interface{}, error) {
	if engine == "" {
		engine = "clickhouse"
	}

	request := LakehouseQueryRequest{
		Query:  sql,
		Engine: engine,
	}

	requestJSON, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/query", c.apiURL),
		"application/json",
		bytes.NewBuffer(requestJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("query failed: %s", string(body))
	}

	var response LakehouseQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return response.Data, nil
}

// GetFeatures retrieves features from the Feast feature store
func (c *LakehouseClient) GetFeatures(featureService string, entityRows []map[string]interface{}) (map[string]interface{}, error) {
	request := FeatureRequest{
		FeatureService: featureService,
		EntityRows:     entityRows,
	}

	requestJSON, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal feature request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/features/get", c.apiURL),
		"application/json",
		bytes.NewBuffer(requestJSON),
	)
	if err != nil {
		return nil, fmt.Errorf("feature retrieval failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("feature retrieval failed: %s", string(body))
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if features, ok := response["features"].(map[string]interface{}); ok {
		return features, nil
	}

	return response, nil
}

// GetApplicantCreditFeatures retrieves credit features for a mortgage applicant
func (c *LakehouseClient) GetApplicantCreditFeatures(applicantBVN string) (map[string]interface{}, error) {
	return c.GetFeatures("mortgage_applicant_features_v1", []map[string]interface{}{
		{"bvn": applicantBVN},
	})
}

// GetPropertyRiskScore retrieves risk score for a property
func (c *LakehouseClient) GetPropertyRiskScore(propertyID string, state string, lga string) (float64, error) {
	sql := fmt.Sprintf(`
		SELECT risk_score
		FROM gold.property_risk_scores
		WHERE state = '%s' AND lga = '%s'
		ORDER BY computed_at DESC
		LIMIT 1
	`, state, lga)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		return 0.5, nil // Default risk score
	}

	if len(results) > 0 {
		if score, ok := results[0]["risk_score"].(float64); ok {
			return score, nil
		}
	}

	return 0.5, nil
}

// GetDefaultPrediction gets ML prediction for mortgage default probability
func (c *LakehouseClient) GetDefaultPrediction(applicantBVN string, loanAmount float64, propertyType string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			default_probability,
			expected_loss,
			risk_tier,
			recommended_interest_rate
		FROM gold.mortgage_default_predictions
		WHERE applicant_bvn = '%s'
		ORDER BY predicted_at DESC
		LIMIT 1
	`, applicantBVN)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		// Return default predictions
		return map[string]interface{}{
			"default_probability":       0.03,
			"expected_loss":             loanAmount * 0.03,
			"risk_tier":                 "medium",
			"recommended_interest_rate": 14.0,
		}, nil
	}

	if len(results) > 0 {
		return results[0], nil
	}

	return map[string]interface{}{
		"default_probability":       0.03,
		"expected_loss":             loanAmount * 0.03,
		"risk_tier":                 "medium",
		"recommended_interest_rate": 14.0,
	}, nil
}

// GetPortfolioAnalytics retrieves mortgage portfolio analytics from lakehouse
func (c *LakehouseClient) GetPortfolioAnalytics(tenantID string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_mortgages,
			SUM(approved_amount) as total_approved,
			SUM(CASE WHEN status = 'disbursed' OR status = 'active' THEN approved_amount ELSE 0 END) as total_disbursed,
			SUM(outstanding_balance) as total_outstanding,
			AVG(interest_rate) as avg_interest_rate,
			AVG(ltv_ratio) as avg_ltv,
			AVG(dti_ratio) as avg_dti,
			COUNT(CASE WHEN status = 'in_arrears' THEN 1 END) as mortgages_in_arrears,
			COUNT(CASE WHEN status = 'default' THEN 1 END) as mortgages_in_default,
			COUNT(CASE WHEN status = 'foreclosure' THEN 1 END) as mortgages_in_foreclosure,
			SUM(CASE WHEN status IN ('in_arrears', 'default', 'foreclosure') THEN outstanding_balance ELSE 0 END) as at_risk_amount
		FROM gold.mortgages
		WHERE tenant_id = '%s'
	`, tenantID)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		return nil, err
	}

	if len(results) > 0 {
		return results[0], nil
	}

	return map[string]interface{}{}, nil
}

// GetDisbursementTrends retrieves mortgage disbursement trends
func (c *LakehouseClient) GetDisbursementTrends(tenantID string, months int) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			toStartOfMonth(disbursed_at) as month,
			product_type,
			property_type,
			COUNT(*) as disbursement_count,
			SUM(approved_amount) as total_amount,
			AVG(approved_amount) as avg_amount,
			AVG(interest_rate) as avg_rate,
			AVG(ltv_ratio) as avg_ltv
		FROM gold.mortgages
		WHERE tenant_id = '%s'
		AND disbursed_at >= NOW() - INTERVAL %d MONTH
		AND disbursed_at IS NOT NULL
		GROUP BY month, product_type, property_type
		ORDER BY month
	`, tenantID, months)

	return c.Query(sql, "clickhouse")
}

// GetRepaymentPerformance retrieves mortgage repayment performance metrics
func (c *LakehouseClient) GetRepaymentPerformance(tenantID string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_payments,
			SUM(paid_amount) as total_collected,
			SUM(CASE WHEN paid_date <= due_date THEN 1 ELSE 0 END) as on_time_payments,
			SUM(CASE WHEN paid_date > due_date THEN 1 ELSE 0 END) as late_payments,
			AVG(CASE WHEN paid_date > due_date THEN DATEDIFF(paid_date, due_date) ELSE 0 END) as avg_days_late,
			SUM(principal_amount) as total_principal_collected,
			SUM(interest_amount) as total_interest_collected
		FROM gold.mortgage_payments
		WHERE tenant_id = '%s'
		AND paid_date IS NOT NULL
	`, tenantID)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		return nil, err
	}

	if len(results) > 0 {
		return results[0], nil
	}

	return map[string]interface{}{}, nil
}

// GetPropertyTypePerformance retrieves performance metrics by property type
func (c *LakehouseClient) GetPropertyTypePerformance(tenantID string) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			property_type,
			COUNT(*) as mortgage_count,
			SUM(approved_amount) as total_approved,
			AVG(interest_rate) as avg_rate,
			AVG(ltv_ratio) as avg_ltv,
			AVG(dti_ratio) as avg_dti,
			COUNT(CASE WHEN status IN ('in_arrears', 'default') THEN 1 END) as problem_loans,
			SUM(CASE WHEN status IN ('in_arrears', 'default') THEN outstanding_balance ELSE 0 END) as problem_amount
		FROM gold.mortgages
		WHERE tenant_id = '%s'
		GROUP BY property_type
		ORDER BY mortgage_count DESC
	`, tenantID)

	return c.Query(sql, "clickhouse")
}

// GetStatePerformance retrieves performance metrics by state
func (c *LakehouseClient) GetStatePerformance(tenantID string) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			property_state as state,
			COUNT(*) as mortgage_count,
			SUM(approved_amount) as total_approved,
			AVG(approved_amount) as avg_loan_size,
			AVG(interest_rate) as avg_rate,
			COUNT(CASE WHEN status IN ('in_arrears', 'default') THEN 1 END) as problem_loans
		FROM gold.mortgages
		WHERE tenant_id = '%s'
		GROUP BY property_state
		ORDER BY mortgage_count DESC
		LIMIT 20
	`, tenantID)

	return c.Query(sql, "clickhouse")
}

// GetNHFPortfolioMetrics retrieves NHF-backed mortgage metrics
func (c *LakehouseClient) GetNHFPortfolioMetrics(tenantID string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_nhf_mortgages,
			SUM(approved_amount) as total_nhf_amount,
			AVG(approved_amount) as avg_nhf_loan,
			AVG(interest_rate) as avg_nhf_rate,
			COUNT(CASE WHEN status IN ('in_arrears', 'default') THEN 1 END) as nhf_problem_loans
		FROM gold.mortgages
		WHERE tenant_id = '%s'
		AND product_type = 'nhf_backed'
	`, tenantID)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		return nil, err
	}

	if len(results) > 0 {
		return results[0], nil
	}

	return map[string]interface{}{}, nil
}

// WriteToDeltaLake writes data to Delta Lake table
func (c *LakehouseClient) WriteToDeltaLake(tableName string, data []map[string]interface{}, mode string) error {
	if mode == "" {
		mode = "append"
	}

	request := map[string]interface{}{
		"table_name": tableName,
		"data":       data,
		"mode":       mode,
	}

	requestJSON, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/delta/write", c.apiURL),
		"application/json",
		bytes.NewBuffer(requestJSON),
	)
	if err != nil {
		return fmt.Errorf("delta write failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delta write failed: %s", string(body))
	}

	return nil
}

// PublishMortgageApplication publishes mortgage application data to lakehouse
func (c *LakehouseClient) PublishMortgageApplication(app *MortgageApplication) error {
	data := map[string]interface{}{
		"application_id":     app.ID,
		"tenant_id":          app.TenantID,
		"application_number": app.ApplicationNumber,
		"status":             app.Status,
		"product_type":       app.ProductType,
		"applicant_id":       app.PrimaryApplicantID,
		"applicant_name":     app.PrimaryApplicantName,
		"employment_type":    app.EmploymentType,
		"monthly_income":     app.TotalMonthlyIncome,
		"requested_amount":   app.RequestedAmount,
		"approved_amount":    app.ApprovedAmount,
		"down_payment":       app.DownPayment,
		"interest_rate":      app.InterestRate,
		"tenor_months":       app.ApprovedTenorMonths,
		"monthly_payment":    app.MonthlyPayment,
		"credit_score":       app.CreditScore,
		"dti_ratio":          app.DTIRatio,
		"ltv_ratio":          app.LTVRatio,
		"risk_score":         app.RiskScore,
		"nhf_contributor":    app.NHFContributor,
		"property_type":      app.Property.PropertyType,
		"property_state":     app.Property.State,
		"property_city":      app.Property.City,
		"property_value":     app.Property.MarketValue,
		"created_at":         app.CreatedAt,
		"updated_at":         app.UpdatedAt,
	}

	return c.PublishEvent("mortgage_application", data, "mortgage-service")
}

// PublishMortgageDisbursement publishes disbursement data to lakehouse
func (c *LakehouseClient) PublishMortgageDisbursement(app *MortgageApplication) error {
	data := map[string]interface{}{
		"mortgage_id":      app.ID,
		"tenant_id":        app.TenantID,
		"product_type":     app.ProductType,
		"disbursed_amount": app.ApprovedAmount,
		"interest_rate":    app.InterestRate,
		"tenor_months":     app.ApprovedTenorMonths,
		"monthly_payment":  app.MonthlyPayment,
		"ltv_ratio":        app.LTVRatio,
		"dti_ratio":        app.DTIRatio,
		"property_type":    app.Property.PropertyType,
		"property_state":   app.Property.State,
		"property_value":   app.Property.MarketValue,
		"nhf_backed":       app.ProductType == ProductNHFBacked,
		"disbursed_at":     app.DisbursedAt,
	}

	return c.PublishEvent("mortgage_disbursement", data, "mortgage-service")
}

// PublishMortgagePayment publishes payment data to lakehouse
func (c *LakehouseClient) PublishMortgagePayment(payment *MortgagePayment) error {
	data := map[string]interface{}{
		"payment_id":          payment.ID,
		"mortgage_id":         payment.MortgageID,
		"tenant_id":           payment.TenantID,
		"payment_number":      payment.PaymentNumber,
		"due_date":            payment.DueDate,
		"paid_date":           payment.PaidDate,
		"principal_amount":    payment.PrincipalAmount,
		"interest_amount":     payment.InterestAmount,
		"escrow_amount":       payment.EscrowAmount,
		"total_amount":        payment.TotalAmount,
		"paid_amount":         payment.PaidAmount,
		"outstanding_balance": payment.OutstandingBalance,
		"status":              payment.Status,
	}

	return c.PublishEvent("mortgage_payment", data, "mortgage-service")
}

// PublishMortgageStatusChange publishes status change events
func (c *LakehouseClient) PublishMortgageStatusChange(mortgageID, tenantID string, oldStatus, newStatus MortgageStatus, reason string) error {
	data := map[string]interface{}{
		"mortgage_id": mortgageID,
		"tenant_id":   tenantID,
		"old_status":  oldStatus,
		"new_status":  newStatus,
		"reason":      reason,
		"changed_at":  time.Now(),
	}

	return c.PublishEvent("mortgage_status_change", data, "mortgage-service")
}

// PublishPropertyValuation publishes property valuation data
func (c *LakehouseClient) PublishPropertyValuation(property *PropertyDetails, mortgageID, tenantID string) error {
	data := map[string]interface{}{
		"mortgage_id":       mortgageID,
		"tenant_id":         tenantID,
		"property_id":       property.ID,
		"property_type":     property.PropertyType,
		"state":             property.State,
		"city":              property.City,
		"lga":               property.LGA,
		"purchase_price":    property.PurchasePrice,
		"market_value":      property.MarketValue,
		"forced_sale_value": property.ForcedSaleValue,
		"valuation_date":    property.ValuationDate,
		"valuer_name":       property.ValuerName,
		"title_status":      property.TitleStatus,
	}

	return c.PublishEvent("property_valuation", data, "mortgage-service")
}

// Close closes the lakehouse client
func (c *LakehouseClient) Close() error {
	log.Println("Lakehouse client closed")
	return nil
}
