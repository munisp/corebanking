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

// LakehouseClient handles all lakehouse operations for education loans
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
		apiURL = "http://data-intelligence"
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

// GetStudentCreditFeatures retrieves credit features for a student
func (c *LakehouseClient) GetStudentCreditFeatures(studentID string) (map[string]interface{}, error) {
	return c.GetFeatures("student_credit_features_v1", []map[string]interface{}{
		{"student_id": studentID},
	})
}

// GetGuarantorFeatures retrieves features for a guarantor
func (c *LakehouseClient) GetGuarantorFeatures(guarantorBVN string) (map[string]interface{}, error) {
	return c.GetFeatures("guarantor_features_v1", []map[string]interface{}{
		{"bvn": guarantorBVN},
	})
}

// GetInstitutionRiskScore retrieves risk score for an institution
func (c *LakehouseClient) GetInstitutionRiskScore(institutionID string) (float64, error) {
	sql := fmt.Sprintf(`
		SELECT risk_score
		FROM gold.institution_risk_scores
		WHERE institution_id = '%s'
		ORDER BY computed_at DESC
		LIMIT 1
	`, institutionID)

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

// GetStudentRepaymentPrediction gets ML prediction for student repayment behavior
func (c *LakehouseClient) GetStudentRepaymentPrediction(studentID string, loanAmount float64, institutionType string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			default_probability,
			expected_repayment_rate,
			risk_tier,
			recommended_interest_rate
		FROM gold.student_repayment_predictions
		WHERE student_id = '%s'
		ORDER BY predicted_at DESC
		LIMIT 1
	`, studentID)

	results, err := c.Query(sql, "clickhouse")
	if err != nil {
		// Return default predictions
		return map[string]interface{}{
			"default_probability":       0.05,
			"expected_repayment_rate":   0.95,
			"risk_tier":                 "medium",
			"recommended_interest_rate": 12.0,
		}, nil
	}

	if len(results) > 0 {
		return results[0], nil
	}

	return map[string]interface{}{
		"default_probability":       0.05,
		"expected_repayment_rate":   0.95,
		"risk_tier":                 "medium",
		"recommended_interest_rate": 12.0,
	}, nil
}

// GetPortfolioAnalytics retrieves portfolio analytics from lakehouse
func (c *LakehouseClient) GetPortfolioAnalytics(tenantID string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_loans,
			SUM(approved_amount) as total_approved,
			SUM(disbursed_amount) as total_disbursed,
			SUM(outstanding_balance) as total_outstanding,
			AVG(interest_rate) as avg_interest_rate,
			COUNT(CASE WHEN status = 'in_arrears' THEN 1 END) as loans_in_arrears,
			COUNT(CASE WHEN status = 'default' THEN 1 END) as loans_in_default,
			SUM(CASE WHEN status IN ('in_arrears', 'default') THEN outstanding_balance ELSE 0 END) as at_risk_amount
		FROM gold.education_loans
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

// GetDisbursementTrends retrieves disbursement trends
func (c *LakehouseClient) GetDisbursementTrends(tenantID string, months int) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			toStartOfMonth(disbursed_at) as month,
			institution_type,
			COUNT(*) as disbursement_count,
			SUM(amount) as total_amount,
			AVG(amount) as avg_amount
		FROM gold.education_loan_disbursements
		WHERE tenant_id = '%s'
		AND disbursed_at >= NOW() - INTERVAL %d MONTH
		GROUP BY month, institution_type
		ORDER BY month
	`, tenantID, months)

	return c.Query(sql, "clickhouse")
}

// GetRepaymentPerformance retrieves repayment performance metrics
func (c *LakehouseClient) GetRepaymentPerformance(tenantID string) (map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			COUNT(*) as total_payments,
			SUM(paid_amount) as total_collected,
			SUM(CASE WHEN paid_date <= due_date THEN 1 ELSE 0 END) as on_time_payments,
			SUM(CASE WHEN paid_date > due_date THEN 1 ELSE 0 END) as late_payments,
			AVG(CASE WHEN paid_date > due_date THEN DATEDIFF(paid_date, due_date) ELSE 0 END) as avg_days_late
		FROM gold.education_loan_payments
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

// GetAcademicPerformanceCorrelation retrieves correlation between academic and repayment performance
func (c *LakehouseClient) GetAcademicPerformanceCorrelation(tenantID string) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			CASE 
				WHEN cgpa >= 3.5 THEN 'First Class'
				WHEN cgpa >= 3.0 THEN 'Second Class Upper'
				WHEN cgpa >= 2.5 THEN 'Second Class Lower'
				WHEN cgpa >= 2.0 THEN 'Third Class'
				ELSE 'Below Average'
			END as academic_tier,
			COUNT(*) as loan_count,
			AVG(repayment_rate) as avg_repayment_rate,
			AVG(days_past_due) as avg_days_past_due
		FROM gold.education_loan_academic_correlation
		WHERE tenant_id = '%s'
		GROUP BY academic_tier
		ORDER BY avg_repayment_rate DESC
	`, tenantID)

	return c.Query(sql, "clickhouse")
}

// GetInstitutionPerformance retrieves performance metrics by institution
func (c *LakehouseClient) GetInstitutionPerformance(tenantID string) ([]map[string]interface{}, error) {
	sql := fmt.Sprintf(`
		SELECT 
			institution_name,
			institution_type,
			COUNT(*) as loan_count,
			SUM(approved_amount) as total_approved,
			AVG(repayment_rate) as avg_repayment_rate,
			COUNT(CASE WHEN status = 'default' THEN 1 END) as default_count
		FROM gold.education_loans
		WHERE tenant_id = '%s'
		GROUP BY institution_name, institution_type
		ORDER BY loan_count DESC
		LIMIT 20
	`, tenantID)

	return c.Query(sql, "clickhouse")
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

// PublishEducationLoanApplication publishes application data to lakehouse
func (c *LakehouseClient) PublishEducationLoanApplication(app *EducationLoanApplication) error {
	data := map[string]interface{}{
		"application_id":       app.ID,
		"tenant_id":            app.TenantID,
		"application_number":   app.ApplicationNumber,
		"status":               app.Status,
		"loan_type":            app.LoanType,
		"student_id":           app.StudentID,
		"student_name":         app.StudentName,
		"institution_id":       app.Institution.ID,
		"institution_name":     app.Institution.Name,
		"institution_type":     app.Institution.Type,
		"program_name":         app.ProgramName,
		"program_duration":     app.ProgramDuration,
		"current_year":         app.CurrentYear,
		"tuition_fee_per_year": app.TuitionFeePerYear,
		"requested_amount":     app.RequestedAmount,
		"approved_amount":      app.ApprovedAmount,
		"disbursed_amount":     app.DisbursedAmount,
		"outstanding_balance":  app.OutstandingBalance,
		"interest_rate":        app.InterestRate,
		"repayment_type":       app.RepaymentType,
		"moratorium_months":    app.MoratoriumMonths,
		"repayment_tenor":      app.RepaymentTenorMonths,
		"guarantor_count":      len(app.Guarantors),
		"created_at":           app.CreatedAt,
		"updated_at":           app.UpdatedAt,
	}

	return c.PublishEvent("education_loan_application", data, "education-loan-service")
}

// PublishEducationLoanDisbursement publishes disbursement data to lakehouse
func (c *LakehouseClient) PublishEducationLoanDisbursement(app *EducationLoanApplication, disbursement *DisbursementEntry) error {
	data := map[string]interface{}{
		"disbursement_id":      disbursement.ID,
		"application_id":       app.ID,
		"tenant_id":            app.TenantID,
		"semester":             disbursement.Semester,
		"academic_year":        disbursement.AcademicYear,
		"tuition_amount":       disbursement.TuitionAmount,
		"accommodation_amount": disbursement.AccommodationAmount,
		"other_amount":         disbursement.OtherAmount,
		"total_amount":         disbursement.TotalAmount,
		"institution_id":       app.Institution.ID,
		"institution_name":     app.Institution.Name,
		"institution_type":     app.Institution.Type,
		"disbursed_at":         disbursement.DisbursedDate,
		"transaction_ref":      disbursement.TransactionReference,
	}

	return c.PublishEvent("education_loan_disbursement", data, "education-loan-service")
}

// PublishEducationLoanPayment publishes payment data to lakehouse
func (c *LakehouseClient) PublishEducationLoanPayment(payment *EducationLoanPayment) error {
	data := map[string]interface{}{
		"payment_id":        payment.ID,
		"loan_id":           payment.LoanID,
		"tenant_id":         payment.TenantID,
		"payment_number":    payment.PaymentNumber,
		"due_date":          payment.DueDate,
		"paid_date":         payment.PaidDate,
		"principal_amount":  payment.PrincipalAmount,
		"interest_amount":   payment.InterestAmount,
		"total_amount":      payment.TotalAmount,
		"paid_amount":       payment.PaidAmount,
		"status":            payment.Status,
		"payment_method":    payment.PaymentMethod,
		"payment_reference": payment.PaymentReference,
	}

	return c.PublishEvent("education_loan_payment", data, "education-loan-service")
}

// Close closes the lakehouse client
func (c *LakehouseClient) Close() error {
	log.Println("Lakehouse client closed")
	return nil
}
