package main

import (
	"context"
	"database/sql"
	"strings"

	// "encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	mortgageApplicationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mortgage_applications_total",
			Help: "Total mortgage applications by status",
		},
		[]string{"status", "product_type", "tenant_id"},
	)

	mortgageDisbursementsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mortgage_disbursements_total",
			Help: "Total mortgage disbursements",
		},
		[]string{"product_type", "tenant_id"},
	)

	mortgageAmountDisbursed = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "mortgage_amount_disbursed_naira",
			Help: "Total mortgage amount disbursed in Naira",
		},
		[]string{"product_type", "tenant_id"},
	)

	mortgageProcessingLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "mortgage_processing_latency_seconds",
			Help:    "Mortgage processing latency",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
		},
		[]string{"operation"},
	)

	mortgageDefaultRate = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "mortgage_default_rate",
			Help: "Mortgage default rate by product type",
		},
		[]string{"product_type", "tenant_id"},
	)
)

func init() {
	prometheus.MustRegister(mortgageApplicationsTotal)
	prometheus.MustRegister(mortgageDisbursementsTotal)
	prometheus.MustRegister(mortgageAmountDisbursed)
	prometheus.MustRegister(mortgageProcessingLatency)
	prometheus.MustRegister(mortgageDefaultRate)
}

// MortgageProductType represents mortgage product types
type MortgageProductType string

const (
	ProductFixedRate        MortgageProductType = "fixed_rate"
	ProductVariableRate     MortgageProductType = "variable_rate"
	ProductNHFBacked        MortgageProductType = "nhf_backed"
	ProductFMBNBacked       MortgageProductType = "fmbn_backed"
	ProductConstructionLoan MortgageProductType = "construction_loan"
	ProductEquityRelease    MortgageProductType = "equity_release"
	ProductBuyToLet         MortgageProductType = "buy_to_let"
)

// MortgageStatus represents mortgage application status
type MortgageStatus string

const (
	StatusDraft               MortgageStatus = "draft"
	StatusSubmitted           MortgageStatus = "submitted"
	StatusPreQualified        MortgageStatus = "pre_qualified"
	StatusDocumentsPending    MortgageStatus = "documents_pending"
	StatusUnderwriting        MortgageStatus = "underwriting"
	StatusValuationPending    MortgageStatus = "valuation_pending"
	StatusTitleVerification   MortgageStatus = "title_verification"
	StatusCreditCommittee     MortgageStatus = "credit_committee"
	StatusApproved            MortgageStatus = "approved"
	StatusOfferIssued         MortgageStatus = "offer_issued"
	StatusOfferAccepted       MortgageStatus = "offer_accepted"
	StatusDisbursementPending MortgageStatus = "disbursement_pending"
	StatusDisbursing          MortgageStatus = "disbursing"
	StatusDisbursed           MortgageStatus = "disbursed"
	StatusCompensationFailed  MortgageStatus = "compensation_failed"
	StatusActive              MortgageStatus = "active"
	StatusInArrears           MortgageStatus = "in_arrears"
	StatusDefault             MortgageStatus = "default"
	StatusForeclosure         MortgageStatus = "foreclosure"
	StatusSettled             MortgageStatus = "settled"
	StatusDeclined            MortgageStatus = "declined"
	StatusCancelled           MortgageStatus = "cancelled"
)

// PropertyType represents property types
type PropertyType string

const (
	PropertyDetachedHouse PropertyType = "detached_house"
	PropertySemiDetached  PropertyType = "semi_detached"
	PropertyTerrace       PropertyType = "terrace"
	PropertyBungalow      PropertyType = "bungalow"
	PropertyDuplex        PropertyType = "duplex"
	PropertyFlat          PropertyType = "flat"
	PropertyMaisonette    PropertyType = "maisonette"
	PropertyCommercial    PropertyType = "commercial"
	PropertyLand          PropertyType = "land"
	PropertyOffPlan       PropertyType = "off_plan"
)

// OccupancyType represents property occupancy
type OccupancyType string

const (
	OccupancyOwnerOccupied OccupancyType = "owner_occupied"
	OccupancyInvestment    OccupancyType = "investment"
	OccupancySecondHome    OccupancyType = "second_home"
	OccupancyBuyToLet      OccupancyType = "buy_to_let"
)

// TitleStatus represents property title status
type TitleStatus string

const (
	TitleCofO             TitleStatus = "c_of_o"           // Certificate of Occupancy
	TitleGovernorConsent  TitleStatus = "governor_consent" // Governor's Consent obtained
	TitleDeedOfAssignment TitleStatus = "deed_of_assignment"
	TitleSurveyPlan       TitleStatus = "survey_plan"
	TitlePending          TitleStatus = "pending"
	TitleVerified         TitleStatus = "verified"
	TitleDisputed         TitleStatus = "disputed"
)

// MortgageApplication represents a mortgage application
type MortgageApplication struct {
	ID                string              `json:"id" db:"id"`
	TenantID          string              `json:"tenant_id" db:"tenant_id"`
	ApplicationNumber string              `json:"application_number" db:"application_number"`
	Status            MortgageStatus      `json:"status" db:"status"`
	ProductType       MortgageProductType `json:"product_type" db:"product_type"`

	// Primary Applicant
	PrimaryApplicantID   string `json:"primary_applicant_id" db:"primary_applicant_id"`
	PrimaryApplicantName string `json:"primary_applicant_name" db:"primary_applicant_name"`
	PrimaryApplicantBVN  string `json:"primary_applicant_bvn" db:"primary_applicant_bvn"`
	PrimaryApplicantNIN  string `json:"primary_applicant_nin" db:"primary_applicant_nin"`

	// Joint Applicants (co-borrowers)
	JointApplicants []JointApplicant `json:"joint_applicants" db:"-"`

	// Employment & Income
	EmploymentType     string  `json:"employment_type" db:"employment_type"`
	EmployerName       string  `json:"employer_name" db:"employer_name"`
	EmploymentDuration int     `json:"employment_duration" db:"employment_duration"` // months
	MonthlyGrossIncome float64 `json:"monthly_gross_income" db:"monthly_gross_income"`
	MonthlyNetIncome   float64 `json:"monthly_net_income" db:"monthly_net_income"`
	OtherIncome        float64 `json:"other_income" db:"other_income"`
	TotalMonthlyIncome float64 `json:"total_monthly_income" db:"total_monthly_income"`

	// Existing Obligations
	ExistingLoanPayments    float64 `json:"existing_loan_payments" db:"existing_loan_payments"`
	CreditCardPayments      float64 `json:"credit_card_payments" db:"credit_card_payments"`
	OtherObligations        float64 `json:"other_obligations" db:"other_obligations"`
	TotalMonthlyObligations float64 `json:"total_monthly_obligations" db:"total_monthly_obligations"`

	// Loan Details
	RequestedAmount      float64 `json:"requested_amount" db:"requested_amount"`
	ApprovedAmount       float64 `json:"approved_amount" db:"approved_amount"`
	DownPayment          float64 `json:"down_payment" db:"down_payment"`
	RequestedTenorMonths int     `json:"requested_tenor_months" db:"requested_tenor_months"`
	ApprovedTenorMonths  int     `json:"approved_tenor_months" db:"approved_tenor_months"`
	InterestRate         float64 `json:"interest_rate" db:"interest_rate"`
	InterestRateType     string  `json:"interest_rate_type" db:"interest_rate_type"` // fixed, variable
	BaseRate             float64 `json:"base_rate" db:"base_rate"`
	Margin               float64 `json:"margin" db:"margin"`
	MonthlyPayment       float64 `json:"monthly_payment" db:"monthly_payment"`

	// Property Details
	Property PropertyDetails `json:"property" db:"-"`

	// Credit Assessment
	CreditScore int     `json:"credit_score" db:"credit_score"`
	DTIRatio    float64 `json:"dti_ratio" db:"dti_ratio"`
	LTVRatio    float64 `json:"ltv_ratio" db:"ltv_ratio"`
	RiskScore   float64 `json:"risk_score" db:"risk_score"`

	// NHF Details (if applicable)
	NHFContributor        bool    `json:"nhf_contributor" db:"nhf_contributor"`
	NHFAccountNumber      string  `json:"nhf_account_number" db:"nhf_account_number"`
	NHFContributionMonths int     `json:"nhf_contribution_months" db:"nhf_contribution_months"`
	NHFBalance            float64 `json:"nhf_balance" db:"nhf_balance"`

	// TigerBeetle Integration
	LedgerAccountID    string `json:"ledger_account_id" db:"ledger_account_id"`
	EscrowAccountID    string `json:"escrow_account_id" db:"escrow_account_id"`
	PrincipalAccountID string `json:"principal_account_id" db:"principal_account_id"`
	InterestAccountID  string `json:"interest_account_id" db:"interest_account_id"`

	// Timestamps
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	SubmittedAt  *time.Time `json:"submitted_at" db:"submitted_at"`
	ApprovedAt   *time.Time `json:"approved_at" db:"approved_at"`
	DisbursedAt  *time.Time `json:"disbursed_at" db:"disbursed_at"`
	MaturityDate *time.Time `json:"maturity_date" db:"maturity_date"`
}

// JointApplicant represents a co-borrower
type JointApplicant struct {
	ID                 string  `json:"id"`
	ApplicationID      string  `json:"application_id"`
	Name               string  `json:"name"`
	BVN                string  `json:"bvn"`
	NIN                string  `json:"nin"`
	Relationship       string  `json:"relationship"` // spouse, parent, sibling, other
	MonthlyIncome      float64 `json:"monthly_income"`
	EmploymentType     string  `json:"employment_type"`
	IncomeContribution float64 `json:"income_contribution"` // percentage
}

// PropertyDetails represents property information
type PropertyDetails struct {
	ID            string        `json:"id"`
	ApplicationID string        `json:"application_id"`
	PropertyType  PropertyType  `json:"property_type"`
	OccupancyType OccupancyType `json:"occupancy_type"`
	Address       string        `json:"address"`
	City          string        `json:"city"`
	State         string        `json:"state"`
	LGA           string        `json:"lga"`
	PostalCode    string        `json:"postal_code"`

	// Property Details
	YearBuilt         int     `json:"year_built"`
	NumberOfBedrooms  int     `json:"number_of_bedrooms"`
	NumberOfBathrooms int     `json:"number_of_bathrooms"`
	TotalArea         float64 `json:"total_area"` // sqm
	LandArea          float64 `json:"land_area"`  // sqm

	// Developer (for new builds)
	DeveloperName      string     `json:"developer_name"`
	ProjectName        string     `json:"project_name"`
	IsOffPlan          bool       `json:"is_off_plan"`
	ExpectedCompletion *time.Time `json:"expected_completion"`

	// Valuation
	PurchasePrice     float64    `json:"purchase_price"`
	MarketValue       float64    `json:"market_value"`
	ForcedSaleValue   float64    `json:"forced_sale_value"`
	ValuationDate     *time.Time `json:"valuation_date"`
	ValuationReportID string     `json:"valuation_report_id"`
	ValuerName        string     `json:"valuer_name"`
	ValuerLicense     string     `json:"valuer_license"`

	// Title Information
	TitleStatus         TitleStatus `json:"title_status"`
	CofONumber          string      `json:"cof_o_number"`
	CofODate            *time.Time  `json:"cof_o_date"`
	GovernorConsentDate *time.Time  `json:"governor_consent_date"`
	SurveyPlanNumber    string      `json:"survey_plan_number"`
	DeedNumber          string      `json:"deed_number"`
	RegistryState       string      `json:"registry_state"`

	// Insurance
	PropertyInsuranceID string     `json:"property_insurance_id"`
	InsuranceProvider   string     `json:"insurance_provider"`
	InsurancePremium    float64    `json:"insurance_premium"`
	InsuranceExpiry     *time.Time `json:"insurance_expiry"`
}

// MortgageEscrowAccount represents escrow for taxes/insurance
type MortgageEscrowAccount struct {
	ID                   string    `json:"id"`
	MortgageID           string    `json:"mortgage_id"`
	TigerBeetleAccountID string    `json:"tigerbeetle_account_id"`
	Balance              float64   `json:"balance"`
	MonthlyContribution  float64   `json:"monthly_contribution"`
	PropertyTaxAmount    float64   `json:"property_tax_amount"`
	InsurancePremium     float64   `json:"insurance_premium"`
	NextTaxDueDate       time.Time `json:"next_tax_due_date"`
	NextInsuranceDueDate time.Time `json:"next_insurance_due_date"`
}

// MortgagePayment represents a mortgage payment
type MortgagePayment struct {
	ID                  string     `json:"id"`
	MortgageID          string     `json:"mortgage_id"`
	TenantID            string     `json:"tenant_id"`
	PaymentNumber       int        `json:"payment_number"`
	DueDate             time.Time  `json:"due_date"`
	PaidDate            *time.Time `json:"paid_date"`
	PrincipalAmount     float64    `json:"principal_amount"`
	InterestAmount      float64    `json:"interest_amount"`
	EscrowAmount        float64    `json:"escrow_amount"`
	TotalAmount         float64    `json:"total_amount"`
	PaidAmount          float64    `json:"paid_amount"`
	OutstandingBalance  float64    `json:"outstanding_balance"`
	Status              string     `json:"status"` // pending, paid, partial, overdue
	LedgerTransactionID string     `json:"ledger_transaction_id"`
}

// Global variables
var (
	db              *sql.DB
	rdb             *redis.Client
	kafkaClient     *KafkaClient
	tbClient        *TigerBeetleClient
	lakehouseClient *LakehouseClient
	coaClient       *CoAClient
)

type Config struct {
	Port              string
	DatabaseURL       string
	TigerBeetleAddr   string
	TemporalAddr      string
	TemporalNamespace string
	TemporalTaskQueue string
	KYCServiceURL     string
	FraudServiceURL   string
	NotificationURL   string
	AuditServiceURL   string
	SMSProviderURL    string
	SMSProviderKey    string
}

func loadConfig() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://localhost:5432/escrow"),
		TigerBeetleAddr:   getEnv("TB_ADDRESS", "192.168.152.250:3000,192.168.14.240:3000,192.168.96.166:3000"),
		TemporalAddr:      getEnv("TEMPORAL_ADDRESS", "temporal-frontend.temporal.svc:7233"),
		TemporalNamespace: getEnv("TEMPORAL_NAMESPACE", "54link"),
		TemporalTaskQueue: getEnv("TEMPORAL_TASK_QUEUE", "core_banking_mortgage"),
		KYCServiceURL:     getEnv("KYC_SERVICE_URL", "http://verification-service"),
		FraudServiceURL:   getEnv("FRAUD_SERVICE_URL", "http://fraud-service:8080"),
		NotificationURL:   getEnv("NOTIFICATION_URL", "http://notification-service:8080"),
		AuditServiceURL:   getEnv("AUDIT_SERVICE_URL", "http://audit-service:8080"),
		SMSProviderURL:    getEnv("SMS_PROVIDER_URL", ""),
		SMSProviderKey:    getEnv("SMS_PROVIDER_KEY", ""),
	}
}

func main() {
	godotenv.Load()

	cfg := loadConfig()

	// Initialize connections
	if err := initDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	defer db.Close()

	rdb = initRedis()
	defer rdb.Close()

	kafkaClient = NewKafkaClient()
	tbClient = NewTigerBeetleClient()
	lakehouseClient = NewLakehouseClient()
	coaClient = NewCoAClient()

	// Initialize Gin router
	router := gin.Default()
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	router.Use(tenantMiddleware())
	router.Use(metricsMiddleware())
	router.Use(auditMiddleware())

	// Register routes
	registerRoutes(router)

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	log.Printf("Mortgage service started on :%s", cfg.Port)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("ERROR: HTTP server shutdown: %v", err)
	}

	// Stop the event pipeline after in-flight requests drain: halt the
	// background flusher, flush buffered events with a timeout, then close.
	// Never return from main with the producer still running.
	if kafkaClient != nil {
		if err := kafkaClient.Close(); err != nil {
			log.Printf("ERROR: Kafka client close (buffered events may be unpublished): %v", err)
		}
	}
}

func registerRoutes(router *gin.Engine) {
	router.GET("/health", healthCheck)
	router.GET("/ready", readyCheck)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	router.GET("/kafka/metrics", getKafkaMetricsHandler)

	api := router.Group("/api/v1/mortgages")
	{
		// Application lifecycle
		api.POST("/applications", createMortgageApplication)
		api.GET("/applications", listMortgageApplications)
		api.GET("/applications/:id", getMortgageApplication)
		api.PUT("/applications/:id", updateMortgageApplication)
		api.POST("/applications/:id/submit", submitMortgageApplication)
		api.POST("/applications/:id/pre-qualify", preQualifyApplication)

		// Underwriting
		api.POST("/applications/:id/underwrite", underwriteApplication)
		api.POST("/applications/:id/credit-committee", submitToCreditCommittee)
		api.POST("/applications/:id/approve", approveApplication)
		api.POST("/applications/:id/decline", declineApplication)

		// Offer management
		api.POST("/applications/:id/offer", issueOffer)
		api.POST("/applications/:id/offer/accept", acceptOffer)

		// Disbursement
		api.POST("/applications/:id/disburse", disburseMortgage)

		// Property & Valuation
		api.POST("/applications/:id/property", addPropertyDetails)
		api.PUT("/applications/:id/property", updatePropertyDetails)
		api.POST("/applications/:id/valuation", submitValuation)
		api.POST("/applications/:id/title-verification", verifyTitle)

		// NHF Integration
		api.POST("/applications/:id/nhf/verify", verifyNHFContribution)
		api.GET("/applications/:id/nhf/balance", getNHFBalance)

		// Joint Applicants
		api.POST("/applications/:id/joint-applicants", addJointApplicant)
		api.DELETE("/applications/:id/joint-applicants/:applicant_id", removeJointApplicant)

		// Active Mortgages
		api.GET("/:id", getMortgage)
		api.GET("/:id/schedule", getRepaymentSchedule)
		api.GET("/:id/payments", getPaymentHistory)
		api.POST("/:id/payments", recordPayment)
		api.GET("/:id/balance", getMortgageBalance)
		api.GET("/:id/escrow", getEscrowDetails)

		// Prepayment & Refinancing
		api.POST("/:id/prepayment", processPrepayment)
		api.POST("/:id/refinance", initiateRefinancing)

		// Arrears & Default
		api.GET("/:id/arrears", getArrearsStatus)
		api.POST("/:id/restructure", restructureMortgage)
		api.POST("/:id/forbearance", requestForbearance)

		// Products
		api.GET("/products", listMortgageProducts)
		api.GET("/products/:code", getMortgageProduct)

		// Calculators
		api.POST("/calculate/affordability", calculateAffordability)
		api.POST("/calculate/repayment", calculateRepayment)
		api.POST("/calculate/ltv", calculateLTV)
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "mortgage-service"})
}

func readyCheck(c *gin.Context) {
	// Check all dependencies
	if err := db.Ping(); err != nil {
		c.JSON(503, gin.H{"status": "not_ready", "error": "database unavailable"})
		return
	}
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		c.JSON(503, gin.H{"status": "not_ready", "error": "redis unavailable"})
		return
	}
	c.JSON(200, gin.H{"status": "ready"})
}

type KafkaMetricsResponse struct {
	MessagesPublished map[string]map[string]float64 `json:"messages_published"`
	PublishLatency    map[string]LatencyStats       `json:"latencies"`
}

type LatencyStats struct {
	Avg   float64 `json:"avg"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Count int     `json:"count"`
}

func getKafkaMetricsHandler(c *gin.Context) {
	metrics := KafkaMetricsResponse{
		MessagesPublished: map[string]map[string]float64{},
		PublishLatency:    map[string]LatencyStats{},
	}

	// Gather published message counts
	mf, err := prometheus.DefaultGatherer.Gather()
	if err == nil {
		for _, family := range mf {
			if family.GetName() == "kafka_messages_published_total" {
				for _, m := range family.GetMetric() {
					labels := m.GetLabel()
					topic := ""
					status := ""
					for _, l := range labels {
						if l.GetName() == "topic" {
							topic = l.GetValue()
						}
						if l.GetName() == "status" {
							status = l.GetValue()
						}
					}
					if _, ok := metrics.MessagesPublished[topic]; !ok {
						metrics.MessagesPublished[topic] = map[string]float64{}
					}
					metrics.MessagesPublished[topic][status] = m.GetCounter().GetValue()
				}
			}
		}
	}

	// Gather latency stats
	if err == nil {
		for _, family := range mf {
			if family.GetName() == "kafka_publish_latency_seconds" {
				for _, m := range family.GetMetric() {
					labels := m.GetLabel()
					topic := ""
					for _, l := range labels {
						if l.GetName() == "topic" {
							topic = l.GetValue()
						}
					}
					if topic == "" {
						continue
					}
					hist := m.GetHistogram()
					count := int(hist.GetSampleCount())
					min := 0.0
					max := 0.0
					avg := 0.0
					if count > 0 {
						avg = hist.GetSampleSum() / float64(count)
						// Prometheus histograms do not store min/max, so we approximate
						min = avg // Not exact
						max = avg // Not exact
					}
					metrics.PublishLatency[topic] = LatencyStats{
						Avg:   avg,
						Min:   min,
						Max:   max,
						Count: count,
					}
				}
			}
		}
	}

	c.JSON(200, metrics)
}

// Application handlers
func createMortgageApplication(c *gin.Context) {
	start := time.Now()
	tenantID := c.GetString("tenant_id")

	var req struct {
		ProductType          MortgageProductType `json:"product_type" binding:"required"`
		PrimaryApplicantID   string              `json:"primary_applicant_id" binding:"required"`
		PrimaryApplicantName string              `json:"primary_applicant_name" binding:"required"`
		RequestedAmount      float64             `json:"requested_amount" binding:"required"`
		RequestedTenorMonths int                 `json:"requested_tenor_months" binding:"required"`
		DownPayment          float64             `json:"down_payment"`
		EmploymentType       string              `json:"employment_type"`
		MonthlyGrossIncome   float64             `json:"monthly_gross_income"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Validate product type
	if !isValidProductType(req.ProductType) {
		c.JSON(400, gin.H{"error": "invalid product type"})
		return
	}

	// Validate tenor (max 30 years = 360 months)
	if req.RequestedTenorMonths < 12 || req.RequestedTenorMonths > 360 {
		c.JSON(400, gin.H{"error": "tenor must be between 12 and 360 months"})
		return
	}

	// Create application
	app := &MortgageApplication{
		ID:                   generateID("MTG"),
		TenantID:             tenantID,
		ApplicationNumber:    generateApplicationNumber(),
		Status:               "submitted",
		ProductType:          req.ProductType,
		PrimaryApplicantID:   req.PrimaryApplicantID,
		PrimaryApplicantName: req.PrimaryApplicantName,
		RequestedAmount:      req.RequestedAmount,
		RequestedTenorMonths: req.RequestedTenorMonths,
		DownPayment:          req.DownPayment,
		EmploymentType:       req.EmploymentType,
		MonthlyGrossIncome:   req.MonthlyGrossIncome,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	// Create TigerBeetle accounts for the mortgage
	accounts, err := tbClient.CreateMortgageAccounts(tenantID, app.ID)
	if err != nil {
		log.Printf("Failed to create TigerBeetle accounts: %v", err)
		c.JSON(500, gin.H{"error": "failed to create ledger accounts"})
		return
	}

	app.LedgerAccountID = accounts.LedgerAccountID
	app.EscrowAccountID = accounts.EscrowAccountID
	app.PrincipalAccountID = accounts.PrincipalAccountID
	app.InterestAccountID = accounts.InterestAccountID

	// Save to database
	if err := saveMortgageApplication(app); err != nil {
		c.JSON(500, gin.H{"error": "failed to save application"})
		return
	}

	// Publish event to Kafka
	kafkaClient.PublishEventReliably("mortgages.applications", MortgageEvent{
		Type:       "mortgage.application.created",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(app.Status),
		Amount:     app.RequestedAmount,
		Timestamp:  time.Now(),
	})

	// Record metrics
	mortgageApplicationsTotal.WithLabelValues("created", string(req.ProductType), tenantID).Inc()
	mortgageProcessingLatency.WithLabelValues("create_application").Observe(time.Since(start).Seconds())

	c.JSON(201, app)
}

func getMortgageApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	c.JSON(200, app)
}

func listMortgageApplications(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	productType := c.Query("product_type")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	// Build COUNT query with same filters as fetchMortgageApplications
	countQuery := "SELECT COUNT(*) FROM mortgage_applications WHERE tenant_id = $1"
	countArgs := []interface{}{tenantID}
	argCount := 1
	if status != "" {
		argCount++
		countQuery += fmt.Sprintf(" AND status = $%d", argCount)
		countArgs = append(countArgs, status)
	}
	if productType != "" {
		argCount++
		countQuery += fmt.Sprintf(" AND product_type = $%d", argCount)
		countArgs = append(countArgs, productType)
	}

	var total int
	if err := db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		c.JSON(500, gin.H{"error": "failed to count applications"})
		return
	}

	apps, err := fetchMortgageApplications(tenantID, status, productType, limit, (page-1)*limit)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch applications"})
		return
	}

	c.JSON(200, gin.H{"applications": apps, "total": total, "page": page, "limit": limit})
}

func updateMortgageApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if app.Status != StatusDraft {
		c.JSON(400, gin.H{"error": "can only update draft applications"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Apply updates
	if err := updateMortgageApplicationFields(id, tenantID, updates); err != nil {
		c.JSON(500, gin.H{"error": "failed to update application"})
		return
	}

	c.JSON(200, gin.H{"status": "updated"})
}

func submitMortgageApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if app.Status != StatusDraft {
		c.JSON(400, gin.H{"error": "application already submitted"})
		return
	}

	// Validate required fields
	if err := validateApplicationForSubmission(app); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Update status
	now := time.Now()
	app.Status = StatusSubmitted
	app.SubmittedAt = &now
	app.UpdatedAt = now

	if err := updateMortgageStatus(id, tenantID, StatusSubmitted); err != nil {
		c.JSON(500, gin.H{"error": "failed to submit application"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.applications", MortgageEvent{
		Type:       "mortgage.application.submitted",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusSubmitted),
		Amount:     app.RequestedAmount,
		Timestamp:  time.Now(),
	})

	mortgageApplicationsTotal.WithLabelValues("submitted", string(app.ProductType), tenantID).Inc()

	c.JSON(200, gin.H{"status": "submitted", "application_number": app.ApplicationNumber})
}

func preQualifyApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Perform pre-qualification checks
	result := performPreQualification(app)

	if result.Qualified {
		app.Status = StatusPreQualified
		updateMortgageStatus(id, tenantID, StatusPreQualified)
	}

	c.JSON(200, result)
}

func underwriteApplication(c *gin.Context) {
	start := time.Now()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Perform full underwriting
	engine := NewMortgageUnderwritingEngine()
	decision := engine.Underwrite(app)

	// Update application with underwriting results
	app.CreditScore = decision.CreditScore
	app.DTIRatio = decision.DTIRatio
	app.LTVRatio = decision.LTVRatio
	app.RiskScore = decision.RiskScore
	app.ApprovedAmount = decision.ApprovedAmount
	app.ApprovedTenorMonths = decision.ApprovedTenor
	app.InterestRate = decision.InterestRate

	if err := saveUnderwritingResults(app); err != nil {
		c.JSON(500, gin.H{"error": "failed to save underwriting results"})
		return
	}

	// Update status based on decision
	if decision.Decision == "APPROVED" || decision.Decision == "REFER" {
		updateMortgageStatus(id, tenantID, StatusCreditCommittee)
	} else {
		updateMortgageStatus(id, tenantID, StatusDeclined)
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.underwriting", MortgageEvent{
		Type:       "mortgage.underwriting.completed",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     decision.Decision,
		Amount:     decision.ApprovedAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"credit_score": decision.CreditScore,
			"dti_ratio":    decision.DTIRatio,
			"ltv_ratio":    decision.LTVRatio,
			"risk_score":   decision.RiskScore,
		},
	})

	mortgageProcessingLatency.WithLabelValues("underwriting").Observe(time.Since(start).Seconds())

	c.JSON(200, decision)
}

func submitToCreditCommittee(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Notes          string `json:"notes"`
		RecommendedBy  string `json:"recommended_by"`
		Recommendation string `json:"recommendation"` // approve, decline, modify
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Update status
	updateMortgageStatus(id, tenantID, StatusCreditCommittee)

	// Publish event for workflow
	kafkaClient.PublishEventReliably("mortgages.credit-committee", MortgageEvent{
		Type:       "mortgage.credit_committee.submitted",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     "pending_review",
		Amount:     app.ApprovedAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"notes":          req.Notes,
			"recommended_by": req.RecommendedBy,
			"recommendation": req.Recommendation,
		},
	})

	c.JSON(200, gin.H{"status": "submitted_to_credit_committee"})
}

func approveApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		ApprovedBy     string   `json:"approved_by" binding:"required"`
		ApprovedAmount float64  `json:"approved_amount"`
		ApprovedTenor  int      `json:"approved_tenor"`
		InterestRate   float64  `json:"interest_rate"`
		Conditions     []string `json:"conditions"`
		Notes          string   `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Update with approval details
	now := time.Now()
	app.Status = StatusApproved
	app.ApprovedAt = &now
	if req.ApprovedAmount > 0 {
		app.ApprovedAmount = req.ApprovedAmount
	}
	if req.ApprovedTenor > 0 {
		app.ApprovedTenorMonths = req.ApprovedTenor
	}
	if req.InterestRate > 0 {
		app.InterestRate = req.InterestRate
	}

	if err := saveApprovalDetails(app, req.ApprovedBy, req.Conditions, req.Notes); err != nil {
		c.JSON(500, gin.H{"error": "failed to save approval"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.approvals", MortgageEvent{
		Type:       "mortgage.application.approved",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusApproved),
		Amount:     app.ApprovedAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"approved_by":   req.ApprovedBy,
			"interest_rate": app.InterestRate,
			"tenor_months":  app.ApprovedTenorMonths,
		},
	})

	mortgageApplicationsTotal.WithLabelValues("approved", string(app.ProductType), tenantID).Inc()

	c.JSON(200, gin.H{"status": "approved", "approved_amount": app.ApprovedAmount})
}

func declineApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		DeclinedBy string   `json:"declined_by" binding:"required"`
		Reasons    []string `json:"reasons" binding:"required"`
		Notes      string   `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Update status
	updateMortgageStatus(id, tenantID, StatusDeclined)

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.applications", MortgageEvent{
		Type:       "mortgage.application.declined",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusDeclined),
		Amount:     app.RequestedAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"declined_by": req.DeclinedBy,
			"reasons":     req.Reasons,
		},
	})

	mortgageApplicationsTotal.WithLabelValues("declined", string(app.ProductType), tenantID).Inc()

	c.JSON(200, gin.H{"status": "declined"})
}

func issueOffer(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if app.Status != StatusApproved {
		c.JSON(400, gin.H{"error": "application must be approved before issuing offer"})
		return
	}

	// Generate offer letter
	offer := generateOfferLetter(app)

	// Update status
	updateMortgageStatus(id, tenantID, StatusOfferIssued)

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.offers", MortgageEvent{
		Type:       "mortgage.offer.issued",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusOfferIssued),
		Amount:     app.ApprovedAmount,
		Timestamp:  time.Now(),
	})

	c.JSON(200, offer)
}

func acceptOffer(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		AcceptedBy      string `json:"accepted_by" binding:"required"`
		SignatureBase64 string `json:"signature_base64"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if app.Status != StatusOfferIssued {
		c.JSON(400, gin.H{"error": "no offer to accept"})
		return
	}

	// Update status
	updateMortgageStatus(id, tenantID, StatusOfferAccepted)

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.offers", MortgageEvent{
		Type:       "mortgage.offer.accepted",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusOfferAccepted),
		Amount:     app.ApprovedAmount,
		Timestamp:  time.Now(),
	})

	c.JSON(200, gin.H{"status": "offer_accepted"})
}

// disburseMortgage runs the disbursement as a saga:
//
//  1. CLAIM (atomic): UPDATE ... WHERE status IN (offer_accepted,
//     disbursement_pending) RETURNING — exactly one concurrent request can
//     claim the mortgage; the double-disbursement race is closed at the DB.
//  2. The amount ALWAYS comes from the approved mortgage record returned by
//     the claim — never from the request body.
//  3. FORWARD: create the TigerBeetle disbursement transfer (deterministic
//     transfer ID, idempotent under retry).
//  4. COMMIT: persist status=disbursed + schedule.
//  5. COMPENSATION: any post-claim failure reverses the ledger transfer and
//     rolls the claim back. If the reversal itself fails the mortgage is
//     marked compensation_failed and an ALERT is logged — never silent.
func disburseMortgage(c *gin.Context) {
	start := time.Now()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		DisbursementAccountID string  `json:"disbursement_account_id" binding:"required"`
		DisbursementAmount    float64 `json:"disbursement_amount"`
		DisbursedBy           string  `json:"disbursed_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Step 1 — atomic claim. A nil app with nil error means another request
	// holds or has completed the disbursement.
	app, err := claimMortgageForDisbursement(id, tenantID)
	if err != nil {
		log.Printf("ERROR: disbursement claim failed for mortgage %s: %v", id, err)
		c.JSON(500, gin.H{"error": "failed to initiate disbursement"})
		return
	}
	if app == nil {
		c.JSON(409, gin.H{"error": "mortgage not ready for disbursement or disbursement already in progress"})
		return
	}

	// compensate rolls back every side effect of a failed disbursement. A
	// failed compensation is surfaced as status=compensation_failed + ALERT.
	compensate := func(transferID string, cause error) {
		if transferID != "" {
			if _, rerr := tbClient.ReverseDisbursementTransfer(
				tenantID, app.PrincipalAccountID, req.DisbursementAccountID,
				app.ApprovedAmount, app.ID, transferID,
			); rerr != nil {
				log.Printf("ALERT: COMPENSATION FAILED for mortgage %s disbursement (transfer %s): reversal error: %v (original failure: %v) — manual reconciliation required",
					app.ID, transferID, rerr, cause)
				if merr := markDisbursementCompensationFailed(app.ID, tenantID); merr != nil {
					log.Printf("ALERT: could not mark mortgage %s compensation_failed: %v", app.ID, merr)
				}
				return
			}
			log.Printf("Compensated failed disbursement for mortgage %s: reversed transfer %s (cause: %v)", app.ID, transferID, cause)
		}
		if rerr := releaseDisbursementClaim(app.ID, tenantID, StatusDisbursementPending); rerr != nil {
			log.Printf("ALERT: failed to release disbursement claim for mortgage %s: %v", app.ID, rerr)
			if merr := markDisbursementCompensationFailed(app.ID, tenantID); merr != nil {
				log.Printf("ALERT: could not mark mortgage %s compensation_failed: %v", app.ID, merr)
			}
		}
	}

	// Step 2 — server-side amount from the approved record. A client-supplied
	// amount that disagrees is rejected (fail closed), never silently used.
	disbursementAmount := app.ApprovedAmount
	if req.DisbursementAmount > 0 && req.DisbursementAmount != disbursementAmount {
		compensate("", fmt.Errorf("client-supplied amount %.2f disagrees with approved %.2f", req.DisbursementAmount, disbursementAmount))
		c.JSON(400, gin.H{"error": "disbursement amount does not match the approved amount"})
		return
	}
	if disbursementAmount <= 0 || app.PrincipalAccountID == "" {
		compensate("", fmt.Errorf("mortgage %s has no approved amount or principal ledger account", app.ID))
		c.JSON(400, gin.H{"error": "mortgage has no approved amount or ledger account"})
		return
	}

	// Step 3 — forward: move the funds in TigerBeetle.
	transferID, err := tbClient.CreateDisbursementTransfer(
		tenantID,
		app.PrincipalAccountID,
		req.DisbursementAccountID,
		disbursementAmount,
		app.ID,
	)
	if err != nil {
		log.Printf("Failed to create disbursement transfer for mortgage %s: %v", app.ID, err)
		compensate("", err)
		c.JSON(502, gin.H{"error": "failed to process disbursement"})
		return
	}

	// Step 4 — commit the disbursed state.
	now := time.Now()
	maturityDate := now.AddDate(0, app.ApprovedTenorMonths, 0)
	app.Status = StatusDisbursed
	app.DisbursedAt = &now
	app.MaturityDate = &maturityDate

	// Calculate monthly payment
	app.MonthlyPayment = calculateMonthlyPayment(disbursementAmount, app.InterestRate, app.ApprovedTenorMonths)

	if err := saveDisbursementDetails(app, transferID); err != nil {
		compensate(transferID, err)
		c.JSON(500, gin.H{"error": "failed to save disbursement details"})
		return
	}

	// Generate repayment schedule — a money-path write; failure means the
	// disbursement terms are uncollectible, so compensate rather than proceed.
	schedule := generateRepaymentSchedule(app)
	if err := saveRepaymentSchedule(app.ID, schedule); err != nil {
		log.Printf("Failed to save repayment schedule for mortgage %s: %v", app.ID, err)
		compensate(transferID, err)
		c.JSON(500, gin.H{"error": "failed to save repayment schedule"})
		return
	}

	// Create escrow account entries
	if err := setupEscrowAccount(app); err != nil {
		log.Printf("ERROR: Failed to setup escrow account for mortgage %s: %v", app.ID, err)
	}

	// Publish event — failures are persisted to the outbox for retry, never
	// silently dropped.
	if err := kafkaClient.PublishEventReliably("mortgages.disbursements", MortgageEvent{
		Type:       "mortgage.disbursed",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Status:     string(StatusDisbursed),
		Amount:     disbursementAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"transfer_id":     transferID,
			"monthly_payment": app.MonthlyPayment,
			"maturity_date":   maturityDate,
		},
	}); err != nil {
		log.Printf("ERROR: disbursement event for mortgage %s could not be published or outboxed: %v", app.ID, err)
	}

	mortgageDisbursementsTotal.WithLabelValues(string(app.ProductType), tenantID).Inc()
	mortgageAmountDisbursed.WithLabelValues(string(app.ProductType), tenantID).Add(disbursementAmount)
	mortgageProcessingLatency.WithLabelValues("disbursement").Observe(time.Since(start).Seconds())

	// Record journal entry in Chart of Accounts
	amountInKobo := int64(disbursementAmount * 100)
	if _, err := coaClient.RecordLoanDisbursement(
		tenantID,
		req.DisbursedBy,
		"finance_admin",
		app.ID,
		amountInKobo,
		req.DisbursementAccountID,
	); err != nil {
		log.Printf("ERROR: Failed to record journal entry for mortgage disbursement %s: %v — GL reconciliation required", app.ID, err)
	}

	c.JSON(200, gin.H{
		"status":          "disbursed",
		"transfer_id":     transferID,
		"amount":          disbursementAmount,
		"monthly_payment": app.MonthlyPayment,
		"maturity_date":   maturityDate,
	})
}

func addPropertyDetails(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var property PropertyDetails
	if err := c.ShouldBindJSON(&property); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	property.ID = generateID("PROP")
	property.ApplicationID = app.ID

	if err := savePropertyDetails(&property); err != nil {
		c.JSON(500, gin.H{"error": "failed to save property details"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.properties", MortgageEvent{
		Type:       "mortgage.property.added",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"property_id":   property.ID,
			"property_type": property.PropertyType,
			"state":         property.State,
		},
	})

	c.JSON(201, property)
}

func updatePropertyDetails(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if err := updatePropertyDetailsFields(id, updates); err != nil {
		c.JSON(500, gin.H{"error": "failed to update property details"})
		return
	}

	c.JSON(200, gin.H{"status": "updated"})
}

func submitValuation(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		MarketValue     float64   `json:"market_value" binding:"required"`
		ForcedSaleValue float64   `json:"forced_sale_value" binding:"required"`
		ValuationDate   time.Time `json:"valuation_date" binding:"required"`
		ValuerName      string    `json:"valuer_name" binding:"required"`
		ValuerLicense   string    `json:"valuer_license" binding:"required"`
		ReportID        string    `json:"report_id"`
		Notes           string    `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Update property valuation
	if err := saveValuationDetails(id, req.MarketValue, req.ForcedSaleValue, req.ValuationDate, req.ValuerName, req.ValuerLicense, req.ReportID); err != nil {
		c.JSON(500, gin.H{"error": "failed to save valuation"})
		return
	}

	// Calculate LTV based on new valuation
	ltv := app.RequestedAmount / req.MarketValue * 100

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.valuations", MortgageEvent{
		Type:       "mortgage.valuation.submitted",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"market_value":      req.MarketValue,
			"forced_sale_value": req.ForcedSaleValue,
			"ltv_ratio":         ltv,
			"valuer_name":       req.ValuerName,
		},
	})

	c.JSON(200, gin.H{
		"status":       "valuation_submitted",
		"ltv_ratio":    ltv,
		"market_value": req.MarketValue,
	})
}

func verifyTitle(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		TitleStatus         TitleStatus `json:"title_status" binding:"required"`
		CofONumber          string      `json:"cof_o_number"`
		CofODate            *time.Time  `json:"cof_o_date"`
		GovernorConsentDate *time.Time  `json:"governor_consent_date"`
		SurveyPlanNumber    string      `json:"survey_plan_number"`
		DeedNumber          string      `json:"deed_number"`
		RegistryState       string      `json:"registry_state"`
		VerifiedBy          string      `json:"verified_by" binding:"required"`
		Notes               string      `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Save title verification
	if err := saveTitleVerification(id, req.TitleStatus, req.CofONumber, req.CofODate, req.GovernorConsentDate, req.SurveyPlanNumber, req.DeedNumber, req.RegistryState, req.VerifiedBy); err != nil {
		c.JSON(500, gin.H{"error": "failed to save title verification"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.title-verification", MortgageEvent{
		Type:       "mortgage.title.verified",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"title_status":   req.TitleStatus,
			"cof_o_number":   req.CofONumber,
			"registry_state": req.RegistryState,
			"verified_by":    req.VerifiedBy,
		},
	})

	c.JSON(200, gin.H{"status": "title_verified", "title_status": req.TitleStatus})
}

func verifyNHFContribution(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		NHFAccountNumber string `json:"nhf_account_number" binding:"required"`
		EmployerCode     string `json:"employer_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	// Call NHF verification service (simulated)
	nhfResult := verifyNHFContributionExternal(req.NHFAccountNumber, req.EmployerCode)

	// Update application with NHF details
	app.NHFContributor = nhfResult.IsContributor
	app.NHFAccountNumber = req.NHFAccountNumber
	app.NHFContributionMonths = nhfResult.ContributionMonths
	app.NHFBalance = nhfResult.Balance

	if err := saveNHFDetails(app); err != nil {
		c.JSON(500, gin.H{"error": "failed to save NHF details"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.nhf", MortgageEvent{
		Type:       "mortgage.nhf.verified",
		MortgageID: app.ID,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"is_contributor":      nhfResult.IsContributor,
			"contribution_months": nhfResult.ContributionMonths,
			"balance":             nhfResult.Balance,
		},
	})

	c.JSON(200, nhfResult)
}

func getNHFBalance(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if !app.NHFContributor {
		c.JSON(400, gin.H{"error": "applicant is not an NHF contributor"})
		return
	}

	c.JSON(200, gin.H{
		"nhf_account_number":   app.NHFAccountNumber,
		"contribution_months":  app.NHFContributionMonths,
		"balance":              app.NHFBalance,
		"eligible_loan_amount": app.NHFBalance * 3, // NHF typically allows 3x contribution
	})
}

func addJointApplicant(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var applicant JointApplicant
	if err := c.ShouldBindJSON(&applicant); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	applicant.ID = generateID("JAPP")
	applicant.ApplicationID = id

	if err := saveJointApplicant(&applicant); err != nil {
		c.JSON(500, gin.H{"error": "failed to add joint applicant"})
		return
	}

	c.JSON(201, applicant)
}

func removeJointApplicant(c *gin.Context) {
	id := c.Param("id")
	applicantID := c.Param("applicant_id")
	tenantID := c.GetString("tenant_id")

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "application not found"})
		return
	}

	if err := deleteJointApplicant(applicantID); err != nil {
		c.JSON(500, gin.H{"error": "failed to remove joint applicant"})
		return
	}

	c.JSON(200, gin.H{"status": "removed"})
}

func getMortgage(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Get current balance from TigerBeetle
	balance, err := tbClient.GetAccountBalance(app.PrincipalAccountID)
	if err != nil {
		log.Printf("Failed to get balance from TigerBeetle: %v", err)
	}

	c.JSON(200, gin.H{
		"mortgage":            app,
		"outstanding_balance": balance,
	})
}

func getRepaymentSchedule(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	schedule, err := fetchRepaymentSchedule(id)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch repayment schedule"})
		return
	}

	c.JSON(200, gin.H{
		"mortgage_id":     id,
		"monthly_payment": app.MonthlyPayment,
		"schedule":        schedule,
	})
}

func getPaymentHistory(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	payments, err := fetchPaymentHistory(id)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch payment history"})
		return
	}

	c.JSON(200, gin.H{"payments": payments})
}

func recordPayment(c *gin.Context) {
	start := time.Now()
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Amount           float64 `json:"amount" binding:"required"`
		PaymentMethod    string  `json:"payment_method"`
		PaymentReference string  `json:"payment_reference"`
		SourceAccountID  string  `json:"source_account_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Create TigerBeetle transfer for payment
	transferID, err := tbClient.CreatePaymentTransfer(
		tenantID,
		req.SourceAccountID,
		app.PrincipalAccountID,
		app.InterestAccountID,
		app.EscrowAccountID,
		req.Amount,
		app.ID,
	)
	if err != nil {
		log.Printf("Failed to create payment transfer: %v", err)
		c.JSON(500, gin.H{"error": "failed to process payment"})
		return
	}

	// Record payment
	payment := &MortgagePayment{
		ID:                  generateID("PAY"),
		MortgageID:          id,
		TenantID:            tenantID,
		PaidDate:            timePtr(time.Now()),
		PaidAmount:          req.Amount,
		Status:              "paid",
		LedgerTransactionID: transferID,
	}

	if err := savePayment(payment); err != nil {
		c.JSON(500, gin.H{"error": "failed to record payment"})
		return
	}

	// Update arrears status if applicable
	updateArrearsStatus(id, tenantID)

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.payments", MortgageEvent{
		Type:       "mortgage.payment.received",
		MortgageID: id,
		TenantID:   tenantID,
		Amount:     req.Amount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"transfer_id":       transferID,
			"payment_reference": req.PaymentReference,
		},
	})

	mortgageProcessingLatency.WithLabelValues("payment").Observe(time.Since(start).Seconds())

	c.JSON(200, gin.H{
		"status":      "payment_recorded",
		"payment_id":  payment.ID,
		"transfer_id": transferID,
	})
}

func getMortgageBalance(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Get balances from TigerBeetle
	principalBalance, _ := tbClient.GetAccountBalance(app.PrincipalAccountID)
	interestBalance, _ := tbClient.GetAccountBalance(app.InterestAccountID)
	escrowBalance, _ := tbClient.GetAccountBalance(app.EscrowAccountID)

	c.JSON(200, gin.H{
		"mortgage_id":       id,
		"principal_balance": principalBalance,
		"interest_balance":  interestBalance,
		"escrow_balance":    escrowBalance,
		"total_outstanding": principalBalance + interestBalance,
	})
}

func getEscrowDetails(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	escrow, err := fetchEscrowAccount(id)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch escrow details"})
		return
	}

	// Get current balance from TigerBeetle
	balance, _ := tbClient.GetAccountBalance(app.EscrowAccountID)
	escrow.Balance = balance

	c.JSON(200, escrow)
}

func processPrepayment(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Amount          float64 `json:"amount" binding:"required"`
		PrepaymentType  string  `json:"prepayment_type"` // partial, full
		RecastSchedule  bool    `json:"recast_schedule"` // true = lower payment, false = shorter tenor
		SourceAccountID string  `json:"source_account_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Calculate prepayment fee (if applicable)
	prepaymentFee := calculatePrepaymentFee(app, req.Amount)

	// Create TigerBeetle transfer for prepayment
	transferID, err := tbClient.CreatePrepaymentTransfer(
		tenantID,
		req.SourceAccountID,
		app.PrincipalAccountID,
		req.Amount,
		prepaymentFee,
		app.ID,
	)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to process prepayment"})
		return
	}

	// Recalculate schedule if requested
	if req.RecastSchedule {
		// Recast: same tenor, lower payment
		newSchedule := recastRepaymentSchedule(app, req.Amount)
		saveRepaymentSchedule(id, newSchedule)
	} else {
		// Curtailment: same payment, shorter tenor
		newSchedule := curtailRepaymentSchedule(app, req.Amount)
		saveRepaymentSchedule(id, newSchedule)
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.prepayments", MortgageEvent{
		Type:       "mortgage.prepayment.processed",
		MortgageID: id,
		TenantID:   tenantID,
		Amount:     req.Amount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"prepayment_type": req.PrepaymentType,
			"recast_schedule": req.RecastSchedule,
			"prepayment_fee":  prepaymentFee,
		},
	})

	c.JSON(200, gin.H{
		"status":         "prepayment_processed",
		"transfer_id":    transferID,
		"prepayment_fee": prepaymentFee,
	})
}

func initiateRefinancing(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		NewAmount       float64 `json:"new_amount"`
		NewTenorMonths  int     `json:"new_tenor_months"`
		NewInterestRate float64 `json:"new_interest_rate"`
		CashOut         float64 `json:"cash_out"` // Additional cash to borrower
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Create new application for refinancing
	newApp := &MortgageApplication{
		ID:                   generateID("MTG"),
		TenantID:             tenantID,
		ApplicationNumber:    generateApplicationNumber(),
		Status:               StatusDraft,
		ProductType:          app.ProductType,
		PrimaryApplicantID:   app.PrimaryApplicantID,
		PrimaryApplicantName: app.PrimaryApplicantName,
		RequestedAmount:      req.NewAmount,
		RequestedTenorMonths: req.NewTenorMonths,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	// Link to original mortgage
	// Save refinancing application
	if err := saveMortgageApplication(newApp); err != nil {
		c.JSON(500, gin.H{"error": "failed to create refinancing application"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.refinancing", MortgageEvent{
		Type:       "mortgage.refinancing.initiated",
		MortgageID: newApp.ID,
		TenantID:   tenantID,
		Amount:     req.NewAmount,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"original_mortgage_id": id,
			"cash_out":             req.CashOut,
		},
	})

	c.JSON(201, gin.H{
		"status":                 "refinancing_initiated",
		"new_application_id":     newApp.ID,
		"new_application_number": newApp.ApplicationNumber,
	})
}

func getArrearsStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	arrears, err := calculateArrearsStatus(id)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to calculate arrears"})
		return
	}

	c.JSON(200, arrears)
}

func restructureMortgage(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		RestructureType string  `json:"restructure_type" binding:"required"` // term_extension, rate_reduction, payment_holiday
		NewTenorMonths  int     `json:"new_tenor_months"`
		NewInterestRate float64 `json:"new_interest_rate"`
		HolidayMonths   int     `json:"holiday_months"`
		Reason          string  `json:"reason" binding:"required"`
		ApprovedBy      string  `json:"approved_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	app, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Apply restructuring
	switch req.RestructureType {
	case "term_extension":
		app.ApprovedTenorMonths = req.NewTenorMonths
	case "rate_reduction":
		app.InterestRate = req.NewInterestRate
	case "payment_holiday":
		// Extend maturity by holiday months
		if app.MaturityDate != nil {
			newMaturity := app.MaturityDate.AddDate(0, req.HolidayMonths, 0)
			app.MaturityDate = &newMaturity
		}
	}

	// Recalculate monthly payment
	balance, _ := tbClient.GetAccountBalance(app.PrincipalAccountID)
	app.MonthlyPayment = calculateMonthlyPayment(balance, app.InterestRate, app.ApprovedTenorMonths)

	// Save restructuring
	if err := saveRestructuringDetails(app, req.RestructureType, req.Reason, req.ApprovedBy); err != nil {
		c.JSON(500, gin.H{"error": "failed to save restructuring"})
		return
	}

	// Generate new schedule
	newSchedule := generateRepaymentSchedule(app)
	saveRepaymentSchedule(id, newSchedule)

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.restructuring", MortgageEvent{
		Type:       "mortgage.restructured",
		MortgageID: id,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"restructure_type": req.RestructureType,
			"reason":           req.Reason,
			"approved_by":      req.ApprovedBy,
		},
	})

	c.JSON(200, gin.H{
		"status":      "restructured",
		"new_payment": app.MonthlyPayment,
		"new_tenor":   app.ApprovedTenorMonths,
		"new_rate":    app.InterestRate,
	})
}

func requestForbearance(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		ForbearanceType     string   `json:"forbearance_type" binding:"required"` // payment_reduction, payment_pause
		DurationMonths      int      `json:"duration_months" binding:"required"`
		ReducedPayment      float64  `json:"reduced_payment"` // For payment_reduction
		Reason              string   `json:"reason" binding:"required"`
		SupportingDocuments []string `json:"supporting_documents"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	_, err := fetchMortgageApplication(id, tenantID)
	if err != nil {
		c.JSON(404, gin.H{"error": "mortgage not found"})
		return
	}

	// Create forbearance request
	forbearanceID := generateID("FORB")

	// Save forbearance request
	if err := saveForbearanceRequest(id, forbearanceID, req.ForbearanceType, req.DurationMonths, req.ReducedPayment, req.Reason); err != nil {
		c.JSON(500, gin.H{"error": "failed to save forbearance request"})
		return
	}

	// Publish event
	kafkaClient.PublishEventReliably("mortgages.forbearance", MortgageEvent{
		Type:       "mortgage.forbearance.requested",
		MortgageID: id,
		TenantID:   tenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"forbearance_id":   forbearanceID,
			"forbearance_type": req.ForbearanceType,
			"duration_months":  req.DurationMonths,
			"reason":           req.Reason,
		},
	})

	c.JSON(201, gin.H{
		"status":         "forbearance_requested",
		"forbearance_id": forbearanceID,
	})
}

func listMortgageProducts(c *gin.Context) {
	products := getMortgageProducts()
	c.JSON(200, gin.H{"products": products})
}

func getMortgageProduct(c *gin.Context) {
	code := c.Param("code")
	product, err := getMortgageProductByCode(code)
	if err != nil {
		c.JSON(404, gin.H{"error": "product not found"})
		return
	}
	c.JSON(200, product)
}

func calculateAffordability(c *gin.Context) {
	var req struct {
		MonthlyGrossIncome  float64 `json:"monthly_gross_income" binding:"required"`
		MonthlyNetIncome    float64 `json:"monthly_net_income"`
		ExistingObligations float64 `json:"existing_obligations"`
		InterestRate        float64 `json:"interest_rate"`
		TenorMonths         int     `json:"tenor_months"`
		MaxDTI              float64 `json:"max_dti"` // Default 40%
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if req.MaxDTI == 0 {
		req.MaxDTI = 0.40
	}
	if req.InterestRate == 0 {
		req.InterestRate = 18.0 // Default rate
	}
	if req.TenorMonths == 0 {
		req.TenorMonths = 240 // 20 years default
	}

	// Calculate maximum affordable payment
	maxMonthlyPayment := (req.MonthlyGrossIncome * req.MaxDTI) - req.ExistingObligations

	// Calculate maximum loan amount
	maxLoanAmount := calculateMaxLoanAmount(maxMonthlyPayment, req.InterestRate, req.TenorMonths)

	c.JSON(200, gin.H{
		"max_monthly_payment": maxMonthlyPayment,
		"max_loan_amount":     maxLoanAmount,
		"dti_used":            req.MaxDTI * 100,
		"interest_rate":       req.InterestRate,
		"tenor_months":        req.TenorMonths,
	})
}

func calculateRepayment(c *gin.Context) {
	var req struct {
		LoanAmount   float64 `json:"loan_amount" binding:"required"`
		InterestRate float64 `json:"interest_rate" binding:"required"`
		TenorMonths  int     `json:"tenor_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	monthlyPayment := calculateMonthlyPayment(req.LoanAmount, req.InterestRate, req.TenorMonths)
	totalPayment := monthlyPayment * float64(req.TenorMonths)
	totalInterest := totalPayment - req.LoanAmount

	c.JSON(200, gin.H{
		"loan_amount":     req.LoanAmount,
		"interest_rate":   req.InterestRate,
		"tenor_months":    req.TenorMonths,
		"monthly_payment": monthlyPayment,
		"total_payment":   totalPayment,
		"total_interest":  totalInterest,
	})
}

func calculateLTV(c *gin.Context) {
	var req struct {
		LoanAmount    float64 `json:"loan_amount" binding:"required"`
		PropertyValue float64 `json:"property_value" binding:"required"`
		DownPayment   float64 `json:"down_payment"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	effectiveLoan := req.LoanAmount
	if req.DownPayment > 0 {
		effectiveLoan = req.PropertyValue - req.DownPayment
	}

	ltv := (effectiveLoan / req.PropertyValue) * 100

	// Determine if PMI is required (typically > 80% LTV)
	pmiRequired := ltv > 80

	c.JSON(200, gin.H{
		"loan_amount":    effectiveLoan,
		"property_value": req.PropertyValue,
		"ltv_ratio":      ltv,
		"pmi_required":   pmiRequired,
		"equity_percent": 100 - ltv,
	})
}

// Middleware functions
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := c.Request.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Vary", "Origin")
				break
			}
		}
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Request-ID")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func loggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		log.Printf("%s %s %d %v", c.Request.Method, c.Request.URL.Path, c.Writer.Status(), duration)
	}
}

func tenantMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = os.Getenv("DEFAULT_TENANT_ID")
		}
		if tenantID == "" {
			tenantID = "default"
		}
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

func metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		mortgageProcessingLatency.WithLabelValues(c.Request.URL.Path).Observe(duration.Seconds())
	}
}

// Helper functions
func generateID(prefix string) string {
	return fmt.Sprintf("%s%d", prefix, time.Now().UnixNano())
}

func generateApplicationNumber() string {
	return fmt.Sprintf("MTG-%s-%06d", time.Now().Format("20060102"), time.Now().UnixNano()%1000000)
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func isValidProductType(pt MortgageProductType) bool {
	switch pt {
	case ProductFixedRate, ProductVariableRate, ProductNHFBacked, ProductFMBNBacked, ProductConstructionLoan, ProductEquityRelease, ProductBuyToLet:
		return true
	}
	return false
}
