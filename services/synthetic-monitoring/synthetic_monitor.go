package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	syntheticTestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "synthetic_test_duration_seconds",
			Help:    "Duration of synthetic tests",
			Buckets: []float64{0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
		},
		[]string{"test_name", "journey", "step"},
	)

	syntheticTestSuccess = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "synthetic_test_success_total",
			Help: "Total number of successful synthetic tests",
		},
		[]string{"test_name", "journey"},
	)

	syntheticTestFailure = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "synthetic_test_failure_total",
			Help: "Total number of failed synthetic tests",
		},
		[]string{"test_name", "journey", "error_type"},
	)

	syntheticTestLastRun = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "synthetic_test_last_run_timestamp",
			Help: "Timestamp of last synthetic test run",
		},
		[]string{"test_name", "journey"},
	)

	syntheticJourneyHealth = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "synthetic_journey_health",
			Help: "Health status of user journey (1=healthy, 0=unhealthy)",
		},
		[]string{"journey"},
	)
)

func init() {
	prometheus.MustRegister(syntheticTestDuration)
	prometheus.MustRegister(syntheticTestSuccess)
	prometheus.MustRegister(syntheticTestFailure)
	prometheus.MustRegister(syntheticTestLastRun)
	prometheus.MustRegister(syntheticJourneyHealth)
}

// SyntheticConfig holds configuration for synthetic monitoring
type SyntheticConfig struct {
	BaseURL           string
	AuthServiceURL    string
	PaymentServiceURL string
	TransferServiceURL string
	BillPayServiceURL string
	USSDServiceURL    string
	MobileAPIURL      string
	TestInterval      time.Duration
	Timeout           time.Duration
	TestUserEmail     string
	TestUserPassword  string
	TestAccountID     string
	AlertWebhookURL   string
}

// DefaultSyntheticConfig returns sensible defaults
func DefaultSyntheticConfig() SyntheticConfig {
	return SyntheticConfig{
		BaseURL:           os.Getenv("BASE_URL"),
		AuthServiceURL:    os.Getenv("AUTH_SERVICE_URL"),
		PaymentServiceURL: os.Getenv("PAYMENT_SERVICE_URL"),
		TransferServiceURL: os.Getenv("TRANSFER_SERVICE_URL"),
		BillPayServiceURL: os.Getenv("BILLPAY_SERVICE_URL"),
		USSDServiceURL:    os.Getenv("USSD_SERVICE_URL"),
		MobileAPIURL:      os.Getenv("MOBILE_API_URL"),
		TestInterval:      time.Minute * 5,
		Timeout:           time.Second * 30,
		TestUserEmail:     os.Getenv("SYNTHETIC_TEST_USER_EMAIL"),
		TestUserPassword:  os.Getenv("SYNTHETIC_TEST_USER_PASSWORD"),
		TestAccountID:     os.Getenv("SYNTHETIC_TEST_ACCOUNT_ID"),
		AlertWebhookURL:   os.Getenv("ALERT_WEBHOOK_URL"),
	}
}

// TestStep represents a single step in a synthetic test
type TestStep struct {
	Name        string
	Description string
	Execute     func(ctx context.Context, state map[string]interface{}) error
	Timeout     time.Duration
}

// TestJourney represents a complete user journey
type TestJourney struct {
	Name        string
	Description string
	Steps       []TestStep
	Interval    time.Duration
}

// TestResult represents the result of a test run
type TestResult struct {
	JourneyName  string                 `json:"journey_name"`
	StepName     string                 `json:"step_name"`
	Success      bool                   `json:"success"`
	Duration     time.Duration          `json:"duration"`
	Error        string                 `json:"error,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// SyntheticMonitor manages synthetic monitoring
type SyntheticMonitor struct {
	config     SyntheticConfig
	httpClient *http.Client
	journeys   []TestJourney
	results    []TestResult
	resultsMux sync.RWMutex
	stopChan   chan struct{}
	wg         sync.WaitGroup
}

// NewSyntheticMonitor creates a new synthetic monitor
func NewSyntheticMonitor(config SyntheticConfig) *SyntheticMonitor {
	sm := &SyntheticMonitor{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		results:  make([]TestResult, 0),
		stopChan: make(chan struct{}),
	}

	sm.registerJourneys()
	return sm
}

// registerJourneys registers all user journeys to test
func (sm *SyntheticMonitor) registerJourneys() {
	sm.journeys = []TestJourney{
		sm.createLoginJourney(),
		sm.createBalanceCheckJourney(),
		sm.createTransferJourney(),
		sm.createBillPaymentJourney(),
		sm.createUSSDJourney(),
		sm.createMobileAPIJourney(),
	}
}

// createLoginJourney creates the login user journey
func (sm *SyntheticMonitor) createLoginJourney() TestJourney {
	return TestJourney{
		Name:        "user_login",
		Description: "Test user login flow",
		Interval:    time.Minute * 5,
		Steps: []TestStep{
			{
				Name:        "login",
				Description: "Authenticate user",
				Timeout:     time.Second * 10,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.AuthServiceURL + "/api/v1/auth/login"
					body := map[string]string{
						"email":    sm.config.TestUserEmail,
						"password": sm.config.TestUserPassword,
					}
					jsonBody, _ := json.Marshal(body)

					req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
					req.Header.Set("Content-Type", "application/json")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("login request failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("login failed with status %d", resp.StatusCode)
					}

					var result map[string]interface{}
					json.NewDecoder(resp.Body).Decode(&result)
					if token, ok := result["access_token"].(string); ok {
						state["access_token"] = token
					}

					return nil
				},
			},
			{
				Name:        "verify_token",
				Description: "Verify access token",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					token, ok := state["access_token"].(string)
					if !ok || token == "" {
						return fmt.Errorf("no access token available")
					}

					url := sm.config.AuthServiceURL + "/api/v1/auth/verify"
					req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
					req.Header.Set("Authorization", "Bearer "+token)

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("token verification failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("token verification failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
		},
	}
}

// createBalanceCheckJourney creates the balance check journey
func (sm *SyntheticMonitor) createBalanceCheckJourney() TestJourney {
	return TestJourney{
		Name:        "balance_check",
		Description: "Test balance inquiry flow",
		Interval:    time.Minute * 2,
		Steps: []TestStep{
			{
				Name:        "get_balance",
				Description: "Retrieve account balance",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := fmt.Sprintf("%s/api/v1/accounts/%s/balance", sm.config.PaymentServiceURL, sm.config.TestAccountID)
					req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("balance request failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("balance check failed with status %d", resp.StatusCode)
					}

					var result map[string]interface{}
					json.NewDecoder(resp.Body).Decode(&result)
					state["balance"] = result["balance"]

					return nil
				},
			},
		},
	}
}

// createTransferJourney creates the internal transfer journey
func (sm *SyntheticMonitor) createTransferJourney() TestJourney {
	return TestJourney{
		Name:        "internal_transfer",
		Description: "Test internal transfer flow (dry run)",
		Interval:    time.Minute * 10,
		Steps: []TestStep{
			{
				Name:        "validate_transfer",
				Description: "Validate transfer parameters",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.TransferServiceURL + "/api/v1/transfers/validate"
					body := map[string]interface{}{
						"source_account":      sm.config.TestAccountID,
						"destination_account": "TEST_DEST_ACCOUNT",
						"amount":              1.00,
						"currency":            "NGN",
						"dry_run":             true,
					}
					jsonBody, _ := json.Marshal(body)

					req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
					req.Header.Set("Content-Type", "application/json")
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("transfer validation failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
						return fmt.Errorf("transfer validation failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
		},
	}
}

// createBillPaymentJourney creates the bill payment journey
func (sm *SyntheticMonitor) createBillPaymentJourney() TestJourney {
	return TestJourney{
		Name:        "bill_payment",
		Description: "Test bill payment flow (validation only)",
		Interval:    time.Minute * 10,
		Steps: []TestStep{
			{
				Name:        "get_billers",
				Description: "Retrieve available billers",
				Timeout:     time.Second * 10,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.BillPayServiceURL + "/api/v1/billers"
					req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("get billers failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("get billers failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
			{
				Name:        "validate_bill",
				Description: "Validate bill payment",
				Timeout:     time.Second * 15,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.BillPayServiceURL + "/api/v1/bills/validate"
					body := map[string]interface{}{
						"biller_code":    "AIRTIME_MTN",
						"customer_id":    "08012345678",
						"amount":         100.00,
						"dry_run":        true,
					}
					jsonBody, _ := json.Marshal(body)

					req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
					req.Header.Set("Content-Type", "application/json")
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("bill validation failed: %w", err)
					}
					defer resp.Body.Close()

					// Accept 200 or 400 (validation error is expected for test data)
					if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
						return fmt.Errorf("bill validation failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
		},
	}
}

// createUSSDJourney creates the USSD journey
func (sm *SyntheticMonitor) createUSSDJourney() TestJourney {
	return TestJourney{
		Name:        "ussd_session",
		Description: "Test USSD session flow",
		Interval:    time.Minute * 5,
		Steps: []TestStep{
			{
				Name:        "initiate_session",
				Description: "Initiate USSD session",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.USSDServiceURL + "/api/v1/ussd/session"
					body := map[string]interface{}{
						"session_id":   fmt.Sprintf("SYNTH_%d", time.Now().UnixNano()),
						"phone_number": "08012345678",
						"service_code": "*347#",
						"text":         "",
						"synthetic":    true,
					}
					jsonBody, _ := json.Marshal(body)

					req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
					req.Header.Set("Content-Type", "application/json")
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("USSD session initiation failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("USSD session failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
		},
	}
}

// createMobileAPIJourney creates the mobile API journey
func (sm *SyntheticMonitor) createMobileAPIJourney() TestJourney {
	return TestJourney{
		Name:        "mobile_api",
		Description: "Test mobile API endpoints",
		Interval:    time.Minute * 3,
		Steps: []TestStep{
			{
				Name:        "health_check",
				Description: "Check mobile API health",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.MobileAPIURL + "/health"
					req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("mobile API health check failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("mobile API unhealthy with status %d", resp.StatusCode)
					}

					return nil
				},
			},
			{
				Name:        "get_config",
				Description: "Retrieve mobile app config",
				Timeout:     time.Second * 5,
				Execute: func(ctx context.Context, state map[string]interface{}) error {
					url := sm.config.MobileAPIURL + "/api/v1/config"
					req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
					req.Header.Set("X-Synthetic-Test", "true")

					resp, err := sm.httpClient.Do(req)
					if err != nil {
						return fmt.Errorf("get config failed: %w", err)
					}
					defer resp.Body.Close()

					if resp.StatusCode != http.StatusOK {
						return fmt.Errorf("get config failed with status %d", resp.StatusCode)
					}

					return nil
				},
			},
		},
	}
}

// Start begins synthetic monitoring
func (sm *SyntheticMonitor) Start() {
	log.Println("Starting synthetic monitoring...")

	for _, journey := range sm.journeys {
		sm.wg.Add(1)
		go sm.runJourneyLoop(journey)
	}
}

// Stop stops synthetic monitoring
func (sm *SyntheticMonitor) Stop() {
	close(sm.stopChan)
	sm.wg.Wait()
	log.Println("Synthetic monitoring stopped")
}

// runJourneyLoop runs a journey at its configured interval
func (sm *SyntheticMonitor) runJourneyLoop(journey TestJourney) {
	defer sm.wg.Done()

	// Run immediately
	sm.runJourney(journey)

	ticker := time.NewTicker(journey.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-sm.stopChan:
			return
		case <-ticker.C:
			sm.runJourney(journey)
		}
	}
}

// runJourney executes a single journey
func (sm *SyntheticMonitor) runJourney(journey TestJourney) {
	log.Printf("Running synthetic journey: %s", journey.Name)

	state := make(map[string]interface{})
	journeySuccess := true

	for _, step := range journey.Steps {
		result := sm.runStep(journey.Name, step, state)
		sm.recordResult(result)

		if !result.Success {
			journeySuccess = false
			log.Printf("Journey %s failed at step %s: %s", journey.Name, step.Name, result.Error)
			break
		}
	}

	// Update journey health metric
	if journeySuccess {
		syntheticJourneyHealth.WithLabelValues(journey.Name).Set(1)
	} else {
		syntheticJourneyHealth.WithLabelValues(journey.Name).Set(0)
		sm.sendAlert(journey.Name, "Journey failed")
	}
}

// runStep executes a single test step
func (sm *SyntheticMonitor) runStep(journeyName string, step TestStep, state map[string]interface{}) TestResult {
	ctx, cancel := context.WithTimeout(context.Background(), step.Timeout)
	defer cancel()

	start := time.Now()
	err := step.Execute(ctx, state)
	duration := time.Since(start)

	result := TestResult{
		JourneyName: journeyName,
		StepName:    step.Name,
		Success:     err == nil,
		Duration:    duration,
		Timestamp:   time.Now(),
	}

	if err != nil {
		result.Error = err.Error()
		syntheticTestFailure.WithLabelValues(step.Name, journeyName, "execution_error").Inc()
	} else {
		syntheticTestSuccess.WithLabelValues(step.Name, journeyName).Inc()
	}

	syntheticTestDuration.WithLabelValues(step.Name, journeyName, step.Name).Observe(duration.Seconds())
	syntheticTestLastRun.WithLabelValues(step.Name, journeyName).Set(float64(time.Now().Unix()))

	return result
}

// recordResult stores a test result
func (sm *SyntheticMonitor) recordResult(result TestResult) {
	sm.resultsMux.Lock()
	defer sm.resultsMux.Unlock()

	sm.results = append(sm.results, result)

	// Keep only last 1000 results
	if len(sm.results) > 1000 {
		sm.results = sm.results[len(sm.results)-1000:]
	}
}

// sendAlert sends an alert for failed journeys
func (sm *SyntheticMonitor) sendAlert(journeyName, message string) {
	if sm.config.AlertWebhookURL == "" {
		return
	}

	alert := map[string]interface{}{
		"type":      "synthetic_test_failure",
		"journey":   journeyName,
		"message":   message,
		"timestamp": time.Now().Format(time.RFC3339),
		"severity":  "warning",
	}

	jsonBody, _ := json.Marshal(alert)
	req, _ := http.NewRequest("POST", sm.config.AlertWebhookURL, bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	sm.httpClient.Do(req)
}

// GetResults returns recent test results
func (sm *SyntheticMonitor) GetResults(limit int) []TestResult {
	sm.resultsMux.RLock()
	defer sm.resultsMux.RUnlock()

	if limit <= 0 || limit > len(sm.results) {
		limit = len(sm.results)
	}

	results := make([]TestResult, limit)
	copy(results, sm.results[len(sm.results)-limit:])
	return results
}

// RegisterRoutes registers HTTP routes
func (sm *SyntheticMonitor) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api/v1/synthetic")
	{
		api.GET("/results", sm.handleGetResults)
		api.GET("/health", sm.handleHealth)
		api.POST("/run/:journey", sm.handleRunJourney)
	}

	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
}

func (sm *SyntheticMonitor) handleGetResults(c *gin.Context) {
	results := sm.GetResults(100)
	c.JSON(http.StatusOK, gin.H{"results": results})
}

func (sm *SyntheticMonitor) handleHealth(c *gin.Context) {
	health := make(map[string]interface{})
	health["status"] = "healthy"
	health["journeys"] = len(sm.journeys)

	c.JSON(http.StatusOK, health)
}

func (sm *SyntheticMonitor) handleRunJourney(c *gin.Context) {
	journeyName := c.Param("journey")

	for _, journey := range sm.journeys {
		if journey.Name == journeyName {
			go sm.runJourney(journey)
			c.JSON(http.StatusOK, gin.H{"status": "started", "journey": journeyName})
			return
		}
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "journey not found"})
}

func main() {
	config := DefaultSyntheticConfig()
	monitor := NewSyntheticMonitor(config)

	router := gin.Default()
	monitor.RegisterRoutes(router)

	monitor.Start()
	defer monitor.Stop()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	log.Printf("Synthetic monitoring service starting on port %s", port)
	router.Run(":" + port)
}
