package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// ═══════════════════════════════════════════════════════════════════════════════
// ML INFERENCE CLIENT — Integrates with 54Bank ML Pipeline (port 8500)
// Provides real-time scoring for fraud, credit, AML, anomaly, and churn models
// ═══════════════════════════════════════════════════════════════════════════════

var mlInferenceURL = getMLURL()

func getMLURL() string {
	url := os.Getenv("ML_INFERENCE_URL")
	if url == "" {
		return "http://ml-inference-server:8500"
	}
	return url
}

// MLFraudRequest contains transaction features for fraud scoring
type MLFraudRequest struct {
	Amount          float64 `json:"amount"`
	Hour            int     `json:"hour"`
	DayOfWeek       int     `json:"day_of_week"`
	Velocity1H      int     `json:"velocity_1h"`
	Velocity24H     int     `json:"velocity_24h"`
	AmountVsAvg     float64 `json:"amount_vs_avg"`
	GeoDistanceKM   float64 `json:"geo_distance_km"`
	DeviceAgeDays   int     `json:"device_age_days"`
	IsNewBeneficiary int    `json:"is_new_beneficiary"`
	IsInternational  int    `json:"is_international"`
	AccountAgeDays   int    `json:"account_age_days"`
	BalanceRatio     float64 `json:"balance_ratio"`
}

// MLFraudResponse contains fraud scoring results
type MLFraudResponse struct {
	Predictions []struct {
		FraudProbability float64 `json:"fraud_probability"`
		RiskAction       string  `json:"risk_action"`
		Model            string  `json:"model"`
	} `json:"predictions"`
	LatencyMs float64 `json:"latency_ms"`
}

// MLCreditRequest contains borrower features for credit scoring
type MLCreditRequest struct {
	Age                  int     `json:"age"`
	MonthlyIncome        int64   `json:"monthly_income"`
	TotalDebt            int64   `json:"total_debt"`
	DTIRatio             float64 `json:"dti_ratio"`
	EmploymentYears      int     `json:"employment_years"`
	NumPriorLoans        int     `json:"num_prior_loans"`
	NumDefaults          int     `json:"num_defaults"`
	LoanAmountRequested  int64   `json:"loan_amount_requested"`
	LoanTenureMonths     int     `json:"loan_tenure_months"`
	CollateralValue      int64   `json:"collateral_value"`
	HasGuarantor         int     `json:"has_guarantor"`
	AccountAgeMonths     int     `json:"account_age_months"`
	AvgMonthlyBalance    int64   `json:"avg_monthly_balance"`
	NumDependents        int     `json:"num_dependents"`
	SectorIdx            int     `json:"sector_idx"`
	StateIdx             int     `json:"state_idx"`
}

// MLCreditResponse contains credit scoring results
type MLCreditResponse struct {
	DefaultProbability float64 `json:"default_probability"`
	CreditScore        float64 `json:"credit_score"`
	CreditBand         string  `json:"credit_band"`
	Approved           bool    `json:"approved"`
	MaxLoanAmount      float64 `json:"max_loan_amount"`
	Model              string  `json:"model"`
	LatencyMs          float64 `json:"latency_ms"`
}

// MLAMLRequest contains customer behavior features for AML scoring
type MLAMLRequest struct {
	TransactionCount30D      int     `json:"transaction_count_30d"`
	UniqueCounterparties30D  int     `json:"unique_counterparties_30d"`
	CashRatio                float64 `json:"cash_ratio"`
	InternationalRatio       float64 `json:"international_ratio"`
	AvgTransactionAmount     float64 `json:"avg_transaction_amount"`
	MaxTransactionAmount     float64 `json:"max_transaction_amount"`
	RoundAmountRatio         float64 `json:"round_amount_ratio"`
	NightRatio               float64 `json:"night_ratio"`
	StructuringScore         float64 `json:"structuring_score"`
	DaysSinceLastKYCUpdate   int     `json:"days_since_last_kyc_update"`
	PEPFlag                  int     `json:"pep_flag"`
	HighRiskCountry          int     `json:"high_risk_country"`
	AccountTypeIdx           int     `json:"account_type_idx"`
	KYCLevelIdx              int     `json:"kyc_level_idx"`
}

// MLAMLResponse contains AML risk scoring results
type MLAMLResponse struct {
	SuspiciousProbability float64 `json:"suspicious_probability"`
	RiskTier              string  `json:"risk_tier"`
	RequiresSTR           bool    `json:"requires_str"`
	RequiresEDD           bool    `json:"requires_edd"`
	Model                 string  `json:"model"`
	LatencyMs             float64 `json:"latency_ms"`
}

// callMLInference makes an HTTP POST to the ML inference server
func callMLInference(endpoint string, payload interface{}) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("ml_client: marshal error: %w", err)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(
		mlInferenceURL+endpoint,
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("ml_client: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("ml_client: status %d from %s", resp.StatusCode, endpoint)
	}

	return io.ReadAll(resp.Body)
}

// ScoreFraudML calls the ML fraud detection model
func ScoreFraudML(req MLFraudRequest) (*MLFraudResponse, error) {
	data, err := callMLInference("/v1/fraud/predict", req)
	if err != nil {
		return nil, err
	}
	var result MLFraudResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("ml_client: unmarshal fraud response: %w", err)
	}
	return &result, nil
}

// ScoreCreditML calls the ML credit scoring model
func ScoreCreditML(req MLCreditRequest) (*MLCreditResponse, error) {
	data, err := callMLInference("/v1/credit/predict", req)
	if err != nil {
		return nil, err
	}
	var result MLCreditResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("ml_client: unmarshal credit response: %w", err)
	}
	return &result, nil
}

// ScoreAMLML calls the ML AML risk scoring model
func ScoreAMLML(req MLAMLRequest) (*MLAMLResponse, error) {
	data, err := callMLInference("/v1/aml/predict", req)
	if err != nil {
		return nil, err
	}
	var result MLAMLResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("ml_client: unmarshal AML response: %w", err)
	}
	return &result, nil
}
