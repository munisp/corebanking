package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	universitieslist "github.com/afrong/54link-education-service/utils/universities-list"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	db              *sql.DB
	lakehouseClient *LakehouseClient
	engine          *EducationLoanUnderwritingEngine
	eduKafkaClient  = NewEduKafkaClient()
	coaClient       *CoAClient
)

// Prometheus metrics
var (
	applicationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "education_loan_applications_total",
			Help: "Total number of education loan applications",
		},
		[]string{"status", "loan_type"},
	)
	disbursementsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "education_loan_disbursements_total",
			Help: "Total disbursements",
		},
		[]string{"institution_type"},
	)
	requestLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "education_loan_request_duration_seconds",
			Help:    "Request latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"endpoint"},
	)
)

func init() {
	prometheus.MustRegister(applicationsTotal)
	prometheus.MustRegister(disbursementsTotal)
	prometheus.MustRegister(requestLatency)
}

// Education Loan Status
type EducationLoanStatus string

const (
	StatusDraft               EducationLoanStatus = "draft"
	StatusSubmitted           EducationLoanStatus = "submitted"
	StatusDocumentsPending    EducationLoanStatus = "documents_pending"
	StatusInstitutionVerified EducationLoanStatus = "institution_verified"
	StatusAdmissionVerified   EducationLoanStatus = "admission_verified"
	StatusUnderwriting        EducationLoanStatus = "underwriting"
	StatusApproved            EducationLoanStatus = "approved"
	StatusOfferIssued         EducationLoanStatus = "offer_issued"
	StatusOfferAccepted       EducationLoanStatus = "offer_accepted"
	StatusDisbursementPending EducationLoanStatus = "disbursement_pending"
	StatusPartiallyDisbursed  EducationLoanStatus = "partially_disbursed"
	StatusFullyDisbursed      EducationLoanStatus = "fully_disbursed"
	StatusInMoratorium        EducationLoanStatus = "in_moratorium"
	StatusRepaymentActive     EducationLoanStatus = "repayment_active"
	StatusInArrears           EducationLoanStatus = "in_arrears"
	StatusDefault             EducationLoanStatus = "default"
	StatusSettled             EducationLoanStatus = "settled"
	StatusWrittenOff          EducationLoanStatus = "written_off"
)

// Education Loan Type
type EducationLoanType string

const (
	LoanTypeUndergraduate EducationLoanType = "undergraduate"
	LoanTypePostgraduate  EducationLoanType = "postgraduate"
	LoanTypeProfessional  EducationLoanType = "professional" // Law, Medicine, etc.
	LoanTypeVocational    EducationLoanType = "vocational"   // Technical/Trade schools
	LoanTypeStudyAbroad   EducationLoanType = "study_abroad"
	LoanTypeTuitionOnly   EducationLoanType = "tuition_only"
	LoanTypeComprehensive EducationLoanType = "comprehensive" // Tuition + Living expenses
	LoanTypeTopUp         EducationLoanType = "top_up"        // Additional funding
)

// Institution Type
type InstitutionType string

const (
	InstitutionUniversity   InstitutionType = "university"
	InstitutionPolytechnic  InstitutionType = "polytechnic"
	InstitutionCollegeOfEd  InstitutionType = "college_of_education"
	InstitutionMonotechnic  InstitutionType = "monotechnic"
	InstitutionPrivate      InstitutionType = "private_university"
	InstitutionForeign      InstitutionType = "foreign_institution"
	InstitutionVocational   InstitutionType = "vocational_institute"
	InstitutionProfessional InstitutionType = "professional_institute"
)

// Repayment Type
type RepaymentType string

const (
	RepaymentStandard     RepaymentType = "standard"      // Fixed monthly payments
	RepaymentGraduated    RepaymentType = "graduated"     // Payments increase over time
	RepaymentIncomeBased  RepaymentType = "income_based"  // Based on income after graduation
	RepaymentExtended     RepaymentType = "extended"      // Longer term, lower payments
	RepaymentInterestOnly RepaymentType = "interest_only" // During moratorium
)

// EducationLoanApplication represents a student loan application
type EducationLoanApplication struct {
	ID                string              `json:"id"`
	TenantID          string              `json:"tenant_id"`
	ApplicationNumber string              `json:"application_number"`
	Status            EducationLoanStatus `json:"status"`
	LoanType          EducationLoanType   `json:"loan_type"`

	// Student Information
	StudentID     string    `json:"student_id"`
	StudentName   string    `json:"student_name"`
	StudentBVN    string    `json:"student_bvn"`
	StudentNIN    string    `json:"student_nin"`
	StudentEmail  string    `json:"student_email"`
	StudentPhone  string    `json:"student_phone"`
	DateOfBirth   time.Time `json:"date_of_birth"`
	Gender        string    `json:"gender"`
	StateOfOrigin string    `json:"state_of_origin"`
	LGA           string    `json:"lga"`

	// Institution Details
	Institution InstitutionDetails `json:"institution"`

	// Program Details
	ProgramName        string    `json:"program_name"`
	ProgramDuration    int       `json:"program_duration_years"`
	CurrentYear        int       `json:"current_year"`
	ExpectedGraduation time.Time `json:"expected_graduation"`
	AdmissionNumber    string    `json:"admission_number"`
	AdmissionLetterID  string    `json:"admission_letter_id"`

	// Financial Details
	TuitionFeePerYear    float64 `json:"tuition_fee_per_year"`
	AccommodationPerYear float64 `json:"accommodation_per_year"`
	BooksAndMaterials    float64 `json:"books_and_materials"`
	LivingExpenses       float64 `json:"living_expenses"`
	TotalCostPerYear     float64 `json:"total_cost_per_year"`
	RequestedAmount      float64 `json:"requested_amount"`
	ApprovedAmount       float64 `json:"approved_amount"`
	DisbursedAmount      float64 `json:"disbursed_amount"`
	OutstandingBalance   float64 `json:"outstanding_balance"`

	// Loan Terms
	InterestRate         float64       `json:"interest_rate"`
	RepaymentType        RepaymentType `json:"repayment_type"`
	MoratoriumMonths     int           `json:"moratorium_months"` // Grace period during studies
	RepaymentTenorMonths int           `json:"repayment_tenor_months"`
	MonthlyPayment       float64       `json:"monthly_payment"`

	// Guarantor/Co-signer
	Guarantors []Guarantor `json:"guarantors"`

	// Disbursement Schedule
	DisbursementSchedule []DisbursementEntry `json:"disbursement_schedule"`

	// TigerBeetle Accounts
	PrincipalAccountID    string `json:"principal_account_id"`
	InterestAccountID     string `json:"interest_account_id"`
	DisbursementAccountID string `json:"disbursement_account_id"`

	// Timestamps
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	SubmittedAt         *time.Time `json:"submitted_at,omitempty"`
	ApprovedAt          *time.Time `json:"approved_at,omitempty"`
	FirstDisbursementAt *time.Time `json:"first_disbursement_at,omitempty"`
	MoratoriumEndDate   *time.Time `json:"moratorium_end_date,omitempty"`
	RepaymentStartDate  *time.Time `json:"repayment_start_date,omitempty"`
	MaturityDate        *time.Time `json:"maturity_date,omitempty"`
}

// InstitutionDetails represents educational institution information
type InstitutionDetails struct {
	ID                  string          `json:"id"`
	Name                string          `json:"name"`
	Type                InstitutionType `json:"type"`
	NUCAccredited       bool            `json:"nuc_accredited"`
	AccreditationNumber string          `json:"accreditation_number"`
	Country             string          `json:"country"`
	State               string          `json:"state"`
	City                string          `json:"city"`
	Address             string          `json:"address"`
	BankAccountNumber   string          `json:"bank_account_number"`
	BankName            string          `json:"bank_name"`
	BankCode            string          `json:"bank_code"`
	ContactPerson       string          `json:"contact_person"`
	ContactEmail        string          `json:"contact_email"`
	ContactPhone        string          `json:"contact_phone"`
	VerificationStatus  string          `json:"verification_status"`
	VerifiedAt          *time.Time      `json:"verified_at,omitempty"`
}

// Guarantor represents a loan guarantor/co-signer
type Guarantor struct {
	ID                 string     `json:"id"`
	ApplicationID      string     `json:"application_id"`
	Name               string     `json:"name"`
	Relationship       string     `json:"relationship"` // parent, guardian, employer, etc.
	BVN                string     `json:"bvn"`
	NIN                string     `json:"nin"`
	Phone              string     `json:"phone"`
	Email              string     `json:"email"`
	EmployerName       string     `json:"employer_name"`
	EmployerAddress    string     `json:"employer_address"`
	MonthlyIncome      float64    `json:"monthly_income"`
	EmploymentDuration int        `json:"employment_duration_months"`
	GuaranteeAmount    float64    `json:"guarantee_amount"`
	VerificationStatus string     `json:"verification_status"`
	VerifiedAt         *time.Time `json:"verified_at,omitempty"`
	ConsentGiven       bool       `json:"consent_given"`
	ConsentDate        *time.Time `json:"consent_date,omitempty"`
}

// DisbursementEntry represents a scheduled or completed disbursement
type DisbursementEntry struct {
	ID                   string     `json:"id"`
	ApplicationID        string     `json:"application_id"`
	Semester             string     `json:"semester"` // e.g., "2024/2025 First Semester"
	AcademicYear         string     `json:"academic_year"`
	ScheduledDate        time.Time  `json:"scheduled_date"`
	DisbursedDate        *time.Time `json:"disbursed_date,omitempty"`
	TuitionAmount        float64    `json:"tuition_amount"`
	AccommodationAmount  float64    `json:"accommodation_amount"`
	OtherAmount          float64    `json:"other_amount"`
	TotalAmount          float64    `json:"total_amount"`
	Status               string     `json:"status"` // scheduled, pending_verification, disbursed, cancelled
	InstitutionAccountID string     `json:"institution_account_id"`
	StudentAccountID     string     `json:"student_account_id"`
	TransactionReference string     `json:"transaction_reference"`
	LedgerTransactionID  string     `json:"ledger_transaction_id"`
}

// EducationLoanPayment represents a repayment
type EducationLoanPayment struct {
	ID                  string     `json:"id"`
	LoanID              string     `json:"loan_id"`
	TenantID            string     `json:"tenant_id"`
	PaymentNumber       int        `json:"payment_number"`
	DueDate             time.Time  `json:"due_date"`
	PaidDate            *time.Time `json:"paid_date,omitempty"`
	PrincipalAmount     float64    `json:"principal_amount"`
	InterestAmount      float64    `json:"interest_amount"`
	TotalAmount         float64    `json:"total_amount"`
	PaidAmount          float64    `json:"paid_amount"`
	Status              string     `json:"status"`
	PaymentMethod       string     `json:"payment_method"`
	PaymentReference    string     `json:"payment_reference"`
	LedgerTransactionID string     `json:"ledger_transaction_id"`
}

// AcademicProgress tracks student's academic performance
type AcademicProgress struct {
	ID               string    `json:"id"`
	ApplicationID    string    `json:"application_id"`
	Semester         string    `json:"semester"`
	AcademicYear     string    `json:"academic_year"`
	GPA              float64   `json:"gpa"`
	CGPA             float64   `json:"cgpa"`
	CreditsCompleted int       `json:"credits_completed"`
	CreditsRequired  int       `json:"credits_required"`
	EnrollmentStatus string    `json:"enrollment_status"` // full_time, part_time, withdrawn, graduated
	VerifiedBy       string    `json:"verified_by"`
	VerifiedAt       time.Time `json:"verified_at"`
	Notes            string    `json:"notes"`
}

func main() {
	godotenv.Load()

	db = initDatabase()
	if db != nil {
		defer db.Close()
	}

	lakehouseClient = NewLakehouseClient()
	engine = NewEducationLoanUnderwritingEngine()
	coaClient = NewCoAClient()

	router := gin.Default()
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	router.Use(tenantMiddleware())
	router.Use(metricsMiddleware())

	registerRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8028"
	}

	addr := ":" + port

	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	log.Printf("Education Loan Service started on %s", addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func registerRoutes(router *gin.Engine) {
	router.GET("/health", healthCheck)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := router.Group("")
	{
		// Application Management
		api.POST("/applications", createApplication)
		api.GET("/applications", listApplications)
		api.GET("/applications/:id", getApplication)
		api.PUT("/applications/:id", updateApplication)
		api.POST("/applications/:id/submit", submitApplication)

		// Document Verification
		api.POST("/applications/:id/verify-institution", verifyInstitution)
		api.POST("/applications/:id/verify-admission", verifyAdmission)
		api.POST("/applications/:id/verify-guarantor", verifyGuarantor)

		// Underwriting
		api.POST("/applications/:id/underwrite", underwriteApplication)
		api.POST("/applications/:id/approve", approveApplication)
		api.POST("/applications/:id/decline", declineApplication)

		// Offer Management
		api.POST("/applications/:id/generate-offer", generateOffer)
		api.POST("/applications/:id/accept-offer", acceptOffer)
		api.POST("/applications/:id/reject-offer", rejectOffer)

		// Disbursement
		api.GET("/applications/:id/disbursement-schedule", getDisbursementSchedule)
		api.POST("/applications/:id/disburse", processDisbursement)
		api.POST("/applications/:id/disburse-semester", disburseSemester)

		// Repayment
		api.GET("/:id/repayment-schedule", getRepaymentSchedule)
		api.POST("/:id/payments", recordPayment)
		api.GET("/:id/payments", getPaymentHistory)
		api.POST("/:id/calculate-payoff", calculatePayoff)

		// Academic Progress
		api.POST("/:id/academic-progress", recordAcademicProgress)
		api.GET("/:id/academic-progress", getAcademicProgress)

		// Moratorium & Deferment
		api.POST("/:id/extend-moratorium", extendMoratorium)
		api.POST("/:id/request-deferment", requestDeferment)

		// Guarantor Management
		api.POST("/applications/:id/guarantors", addGuarantor)
		api.DELETE("/applications/:id/guarantors/:guarantorId", removeGuarantor)

		// Calculators
		api.POST("/calculate/eligibility", calculateEligibility)
		api.POST("/calculate/repayment", calculateRepayment)
		api.POST("/calculate/income-based-payment", calculateIncomeBasedPayment)

		// Institution Management
		api.GET("/institutions", listInstitutions)
		api.GET("/institutions/:id", getInstitution)
		api.POST("/institutions", registerInstitution)

		// verify institution NUC accreditation
		api.GET("/load-nuc-accredited-institutions", getInstitutionListFromNUC)
		api.GET("/institutions/nuc-accredited", getInstitutionListFromNUCCached)
		api.POST("/institutions/verify-nuc", nucInstitutionVerification)
		api.GET("/institutions/verify-nuc", nucInstitutionVerification) // Support both GET and POST

		// Products
		api.GET("/products", getEducationLoanProducts)
		api.GET("/products/:code", getEducationLoanProduct)

		// Reports
		api.GET("/reports/portfolio", getPortfolioReport)
		api.GET("/reports/disbursements", getDisbursementReport)
		api.GET("/reports/arrears", getArrearsReport)
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":  "healthy",
		"service": "education-loan-service",
		"version": "1.0.0",
	})
}

// Application Handlers
func createApplication(c *gin.Context) {
	var req struct {
		StudentID            string            `json:"student_id" binding:"required"`
		StudentName          string            `json:"student_name" binding:"required"`
		StudentBVN           string            `json:"student_bvn"`
		StudentNIN           string            `json:"student_nin"`
		StudentEmail         string            `json:"student_email" binding:"required"`
		StudentPhone         string            `json:"student_phone" binding:"required"`
		LoanType             EducationLoanType `json:"loan_type" binding:"required"`
		InstitutionID        string            `json:"institution_id" binding:"required"`
		ProgramName          string            `json:"program_name" binding:"required"`
		ProgramDuration      int               `json:"program_duration_years" binding:"required"`
		CurrentYear          int               `json:"current_year"`
		TuitionFeePerYear    float64           `json:"tuition_fee_per_year" binding:"required"`
		AccommodationPerYear float64           `json:"accommodation_per_year"`
		RequestedAmount      float64           `json:"requested_amount" binding:"required"`
		RepaymentType        RepaymentType     `json:"repayment_type"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	tenantID := c.GetString("tenant_id")

	app := &EducationLoanApplication{
		ID:                   generateID("EDU"),
		TenantID:             tenantID,
		ApplicationNumber:    generateApplicationNumber(),
		Status:               StatusDraft,
		LoanType:             req.LoanType,
		StudentID:            req.StudentID,
		StudentName:          req.StudentName,
		StudentBVN:           req.StudentBVN,
		StudentNIN:           req.StudentNIN,
		StudentEmail:         req.StudentEmail,
		StudentPhone:         req.StudentPhone,
		ProgramName:          req.ProgramName,
		ProgramDuration:      req.ProgramDuration,
		CurrentYear:          req.CurrentYear,
		TuitionFeePerYear:    req.TuitionFeePerYear,
		AccommodationPerYear: req.AccommodationPerYear,
		RequestedAmount:      req.RequestedAmount,
		RepaymentType:        req.RepaymentType,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	// Calculate total cost
	app.TotalCostPerYear = app.TuitionFeePerYear + app.AccommodationPerYear + app.BooksAndMaterials + app.LivingExpenses

	// Fetch institution details
	institution := fetchInstitution(req.InstitutionID)
	if institution != nil {
		app.Institution = *institution
	}

	// Create TigerBeetle accounts
	var accounts interface{} = nil

	if accounts != nil {
		app.PrincipalAccountID = ""
		app.InterestAccountID = ""
		app.DisbursementAccountID = ""
	}

	// Save to database
	if err := saveEducationLoanApplication(app); err != nil {
		SendError(c.Writer, "internal_error", "Failed to save application", http.StatusInternalServerError, nil)
		return
	}

	// Publish event to Kafka
	event := EduEvent{
		Type:      "education_loan.application.created",
		EntityID:  app.ID,
		TenantID:  app.TenantID,
		Status:    string(app.Status),
		Amount:    app.RequestedAmount,
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"student_id": app.StudentID,
			"student_name": app.StudentName,
			"loan_type": app.LoanType,
			"program_name": app.ProgramName,
			"program_duration": app.ProgramDuration,
			"requested_amount": app.RequestedAmount,
		},
	}
	eduKafkaClient.PublishEvent("education_loan.application", event)

	// Publish to lakehouse
	lakehouseClient.PublishEvent("education_loan_application", map[string]interface{}{
		"application_id":   app.ID,
		"tenant_id":        app.TenantID,
		"student_id":       app.StudentID,
		"loan_type":        app.LoanType,
		"institution_type": app.Institution.Type,
		"requested_amount": app.RequestedAmount,
		"status":           app.Status,
		"created_at":       app.CreatedAt,
	}, "education-loan-service")

	applicationsTotal.WithLabelValues("created", string(app.LoanType)).Inc()

	c.JSON(201, app)
}

func listApplications(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	status := c.Query("status")
	loanType := c.Query("loan_type")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	// Build COUNT query with same filters as fetchEducationLoanApplications
	countQuery := "SELECT COUNT(*) FROM education_loan_applications WHERE tenant_id = $1"
	countArgs := []interface{}{tenantID}
	argCount := 1
	if status != "" {
		argCount++
		countQuery += fmt.Sprintf(" AND status = $%d", argCount)
		countArgs = append(countArgs, status)
	}
	if loanType != "" {
		argCount++
		countQuery += fmt.Sprintf(" AND loan_type = $%d", argCount)
		countArgs = append(countArgs, loanType)
	}

	var total int
	if err := db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		SendError(c.Writer, "internal_error", "Failed to count applications", http.StatusInternalServerError, nil)
		return
	}

	apps, err := fetchEducationLoanApplications(tenantID, status, loanType, limit, (page-1)*limit)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch applications", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{
		"applications": apps,
		"total":        total,
		"page":         page,
		"limit":        limit,
	})
}

func getApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, app)
}

func updateApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	if app.Status != StatusDraft {
		SendError(c.Writer, "bad_request", "Can only update draft applications", http.StatusBadRequest, nil)
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	if err := updateEducationLoanApplicationFields(id, tenantID, updates); err != nil {
		SendError(c.Writer, "internal_error", "Failed to update application", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"status": "updated"})
}

func submitApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Validate required fields
	if err := validateApplicationForSubmission(app); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Update status
	now := time.Now()
	app.Status = StatusSubmitted
	app.SubmittedAt = &now
	app.UpdatedAt = now

	if err := updateEducationLoanStatus(id, tenantID, StatusSubmitted); err != nil {
		SendError(c.Writer, "internal_error", "Failed to submit application", http.StatusInternalServerError, nil)
		return
	}

	// Publish events
	// PublishApplicationEvent("education_loan.application.submitted", app)
	lakehouseClient.PublishEvent("education_loan_status_change", map[string]interface{}{
		"application_id": app.ID,
		"old_status":     StatusDraft,
		"new_status":     StatusSubmitted,
		"timestamp":      now,
	}, "education-loan-service")

	applicationsTotal.WithLabelValues("submitted", string(app.LoanType)).Inc()

	c.JSON(200, gin.H{"status": "submitted", "application_number": app.ApplicationNumber})
}

func verifyInstitution(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Verify institution with NUC or relevant body
	verification := verifyInstitutionWithNUC(app.Institution.AccreditationNumber)

	if verification.Verified {
		now := time.Now()
		app.Institution.VerificationStatus = "verified"
		app.Institution.VerifiedAt = &now

		// Update application status
		app.Status = StatusInstitutionVerified
		updateEducationLoanStatus(id, tenantID, StatusInstitutionVerified)

		// PublishEvent("education-loans.verification", MortgageEvent{
		// 	Type:       "education_loan.institution.verified",
		// 	MortgageID: app.ID,
		// 	TenantID:   tenantID,
		// 	Timestamp:  now,
		// 	Metadata: map[string]interface{}{
		// 		"institution_name": app.Institution.Name,
		// 		"accreditation":    app.Institution.AccreditationNumber,
		// 	},
		// })
	}

	c.JSON(200, gin.H{
		"verified":    verification.Verified,
		"institution": app.Institution.Name,
		"message":     verification.Message,
	})
}

func verifyAdmission(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	var req struct {
		AdmissionNumber   string `json:"admission_number" binding:"required"`
		AdmissionLetterID string `json:"admission_letter_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Verify admission with institution
	verification := verifyAdmissionWithInstitution(app.Institution.ID, req.AdmissionNumber)

	if verification.Verified {
		app.AdmissionNumber = req.AdmissionNumber
		app.AdmissionLetterID = req.AdmissionLetterID
		app.Status = StatusAdmissionVerified
		updateEducationLoanStatus(id, tenantID, StatusAdmissionVerified)

		// PublishApplicationEvent("education_loan.admission.verified", app)
	}

	c.JSON(200, gin.H{
		"verified":         verification.Verified,
		"admission_number": req.AdmissionNumber,
		"student_name":     verification.StudentName,
		"program":          verification.Program,
		"message":          verification.Message,
	})
}

func verifyGuarantor(c *gin.Context) {
	var req struct {
		GuarantorID string `json:"guarantor_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Fetch guarantor
	guarantor := fetchGuarantor(req.GuarantorID)
	if guarantor == nil {
		SendError(c.Writer, "not_found", "Guarantor not found", http.StatusNotFound, nil)
		return
	}

	// Verify BVN and employment
	verification := verifyGuarantorDetails(guarantor)

	if verification.Verified {
		now := time.Now()
		guarantor.VerificationStatus = "verified"
		guarantor.VerifiedAt = &now
		updateGuarantorStatus(req.GuarantorID, "verified")

		// PublishEvent("education-loans.verification", MortgageEvent{
		// 	Type:       "education_loan.guarantor.verified",
		// 	MortgageID: id,
		// 	TenantID:   tenantID,
		// 	Timestamp:  now,
		// 	Metadata: map[string]interface{}{
		// 		"guarantor_id":   req.GuarantorID,
		// 		"guarantor_name": guarantor.Name,
		// 	},
		// })
	}

	c.JSON(200, gin.H{
		"verified":       verification.Verified,
		"guarantor_name": guarantor.Name,
		"message":        verification.Message,
	})
}

func underwriteApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Run underwriting
	decision := engine.Underwrite(app)

	// Update application with decision
	app.Status = StatusUnderwriting
	app.ApprovedAmount = decision.ApprovedAmount
	app.InterestRate = decision.InterestRate
	app.MoratoriumMonths = decision.MoratoriumMonths
	app.RepaymentTenorMonths = decision.RepaymentTenorMonths
	app.MonthlyPayment = decision.MonthlyPayment

	saveUnderwritingResults(app, decision)

	// Publish to lakehouse for ML training
	lakehouseClient.PublishEvent("education_loan_underwriting", map[string]interface{}{
		"application_id":   app.ID,
		"loan_type":        app.LoanType,
		"institution_type": app.Institution.Type,
		"requested_amount": app.RequestedAmount,
		"approved_amount":  decision.ApprovedAmount,
		"decision":         decision.Decision,
		"risk_score":       decision.RiskScore,
		"guarantor_count":  len(app.Guarantors),
		"program_duration": app.ProgramDuration,
	}, "education-loan-service")

	// PublishApplicationEvent("education_loan.underwriting.completed", app)

	c.JSON(200, decision)
}

func approveApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		ApprovedBy string   `json:"approved_by" binding:"required"`
		Conditions []string `json:"conditions"`
		Notes      string   `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	now := time.Now()
	app.Status = StatusApproved
	app.ApprovedAt = &now
	app.UpdatedAt = now

	// Generate disbursement schedule
	schedule := generateDisbursementSchedule(app)
	app.DisbursementSchedule = schedule

	saveApprovalDetails(app, req.ApprovedBy, req.Conditions, req.Notes)

	// Publish events
	// PublishApplicationEvent("education_loan.application.approved", app)
	lakehouseClient.PublishEvent("education_loan_approval", map[string]interface{}{
		"application_id":  app.ID,
		"approved_amount": app.ApprovedAmount,
		"interest_rate":   app.InterestRate,
		"approved_by":     req.ApprovedBy,
		"approved_at":     now,
	}, "education-loan-service")

	applicationsTotal.WithLabelValues("approved", string(app.LoanType)).Inc()

	c.JSON(200, gin.H{
		"status":                "approved",
		"approved_amount":       app.ApprovedAmount,
		"interest_rate":         app.InterestRate,
		"moratorium_months":     app.MoratoriumMonths,
		"repayment_tenor":       app.RepaymentTenorMonths,
		"monthly_payment":       app.MonthlyPayment,
		"disbursement_schedule": schedule,
	})
}

func declineApplication(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		DeclinedBy string `json:"declined_by" binding:"required"`
		Reasons    []string
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	updateEducationLoanStatus(id, tenantID, EducationLoanStatus("declined"))

	// PublishEvent("education-loans.decisions", MortgageEvent{
	// 	Type:       "education_loan.application.declined",
	// 	MortgageID: id,
	// 	TenantID:   tenantID,
	// 	Timestamp:  time.Now(),
	// 	Metadata: map[string]interface{}{
	// 		"declined_by": req.DeclinedBy,
	// 		"reasons":     req.Reasons,
	// 	},
	// })

	applicationsTotal.WithLabelValues("declined", "").Inc()

	c.JSON(200, gin.H{"status": "declined", "reasons": req.Reasons})
}

func generateOffer(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	offer := generateEducationLoanOffer(app)

	app.Status = StatusOfferIssued
	updateEducationLoanStatus(id, tenantID, StatusOfferIssued)

	// PublishApplicationEvent("education_loan.offer.issued", app)

	c.JSON(200, offer)
}

func acceptOffer(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	app.Status = StatusOfferAccepted
	updateEducationLoanStatus(id, tenantID, StatusOfferAccepted)

	// PublishApplicationEvent("education_loan.offer.accepted", app)

	c.JSON(200, gin.H{"status": "offer_accepted"})
}

func rejectOffer(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	updateEducationLoanStatus(id, tenantID, EducationLoanStatus("offer_rejected"))

	c.JSON(200, gin.H{"status": "offer_rejected"})
}

func getDisbursementSchedule(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{
		"disbursement_schedule": app.DisbursementSchedule,
		"total_approved":        app.ApprovedAmount,
		"total_disbursed":       app.DisbursedAmount,
		"remaining":             app.ApprovedAmount - app.DisbursedAmount,
	})
}

func processDisbursement(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		DisbursementID string `json:"disbursement_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Find disbursement entry
	var disbursement *DisbursementEntry
	for i := range app.DisbursementSchedule {
		if app.DisbursementSchedule[i].ID == req.DisbursementID {
			disbursement = &app.DisbursementSchedule[i]
			break
		}
	}

	if disbursement == nil {
		SendError(c.Writer, "not_found", "Disbursement not found", http.StatusNotFound, nil)
		return
	}

	// Process disbursement via TigerBeetle
	// Tuition goes directly to institution
	// tuitionTxID, err := CreateDisbursementTransfer(
	// 	tenantID,
	// 	app.DisbursementAccountID,
	// 	disbursement.InstitutionAccountID,
	// 	disbursement.TuitionAmount,
	// 	app.ID,
	// )
	// if err != nil {
	// 	SendError(c.Writer, "internal_error", "Failed to disburse tuition", http.StatusInternalServerError, nil)
	// 	return
	// }

	// Other amounts go to student
	if disbursement.AccommodationAmount+disbursement.OtherAmount > 0 {
		// CreateDisbursementTransfer(
		// 	tenantID,
		// 	app.DisbursementAccountID,
		// 	disbursement.StudentAccountID,
		// 	disbursement.AccommodationAmount+disbursement.OtherAmount,
		// 	app.ID,
		// )
	}

	// Update disbursement status
	now := time.Now()
	disbursement.Status = "disbursed"
	disbursement.DisbursedDate = &now
	disbursement.LedgerTransactionID = "" // tuitionTxID

	// Update application
	app.DisbursedAmount += disbursement.TotalAmount
	if app.FirstDisbursementAt == nil {
		app.FirstDisbursementAt = &now

		// Calculate moratorium end date
		moratoriumEnd := now.AddDate(0, app.MoratoriumMonths, 0)
		app.MoratoriumEndDate = &moratoriumEnd

		// Calculate repayment start date (1 month after moratorium)
		repaymentStart := moratoriumEnd.AddDate(0, 1, 0)
		app.RepaymentStartDate = &repaymentStart

		// Calculate maturity date
		maturity := repaymentStart.AddDate(0, app.RepaymentTenorMonths, 0)
		app.MaturityDate = &maturity
	}

	if app.DisbursedAmount >= app.ApprovedAmount {
		app.Status = StatusFullyDisbursed
	} else {
		app.Status = StatusPartiallyDisbursed
	}

	saveDisbursementDetails(app, disbursement)

	// Publish events
	// PublishEvent("education-loans.disbursements", MortgageEvent{
	// 	Type:       "education_loan.disbursement.completed",
	// 	MortgageID: app.ID,
	// 	TenantID:   tenantID,
	// 	Amount:     disbursement.TotalAmount,
	// 	Timestamp:  now,
	// 	Metadata: map[string]interface{}{
	// 		"disbursement_id":  disbursement.ID,
	// 		"semester":         disbursement.Semester,
	// 		"tuition_amount":   disbursement.TuitionAmount,
	// 		"institution_name": app.Institution.Name,
	// 	},
	// })

	lakehouseClient.PublishEvent("education_loan_disbursement", map[string]interface{}{
		"application_id":   app.ID,
		"disbursement_id":  disbursement.ID,
		"amount":           disbursement.TotalAmount,
		"institution_type": app.Institution.Type,
		"semester":         disbursement.Semester,
		"disbursed_at":     now,
	}, "education-loan-service")

	disbursementsTotal.WithLabelValues(string(app.Institution.Type)).Inc()

	c.JSON(200, gin.H{
		"status":          "disbursed",
		"disbursement_id": disbursement.ID,
		"amount":          disbursement.TotalAmount,
		"transaction_id":  "",
		"total_disbursed": app.DisbursedAmount,
		"remaining":       app.ApprovedAmount - app.DisbursedAmount,
	})
}

func disburseSemester(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Semester     string `json:"semester" binding:"required"`
		AcademicYear string `json:"academic_year" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Find matching disbursement
	for i := range app.DisbursementSchedule {
		if app.DisbursementSchedule[i].Semester == req.Semester &&
			app.DisbursementSchedule[i].AcademicYear == req.AcademicYear {
			// Process this disbursement
			c.Set("disbursement_id", app.DisbursementSchedule[i].ID)
			processDisbursement(c)
			return
		}
	}

	SendError(c.Writer, "not_found", "Semester disbursement not found", http.StatusNotFound, nil)
}

func getRepaymentSchedule(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	schedule := generateRepaymentSchedule(app)

	c.JSON(200, gin.H{
		"repayment_schedule":   schedule,
		"monthly_payment":      app.MonthlyPayment,
		"repayment_start_date": app.RepaymentStartDate,
		"maturity_date":        app.MaturityDate,
		"total_repayment":      app.MonthlyPayment * float64(app.RepaymentTenorMonths),
	})
}

func recordPayment(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Amount           float64 `json:"amount" binding:"required"`
		PaymentMethod    string  `json:"payment_method"`
		PaymentReference string  `json:"payment_reference"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Process payment via TigerBeetle
	// txID, err := CreatePaymentTransfer(
	// 	tenantID,
	// 	"CUSTOMER_ACCOUNT", // Would be actual customer account
	// 	app.PrincipalAccountID,
	// 	app.InterestAccountID,
	// 	req.Amount,
	// 	app.ID,
	// )
	// if err != nil {
	// 	SendError(c.Writer, "internal_error", "Failed to process payment", http.StatusInternalServerError, nil)
	// 	return
	// }

	// Create payment record
	payment := &EducationLoanPayment{
		ID:                  generateID("PAY"),
		LoanID:              app.ID,
		TenantID:            tenantID,
		PaidDate:            timePtr(time.Now()),
		PaidAmount:          req.Amount,
		Status:              "completed",
		PaymentMethod:       req.PaymentMethod,
		PaymentReference:    req.PaymentReference,
		LedgerTransactionID: "", // txID
	}

	savePayment(payment)

	// Update outstanding balance
	app.OutstandingBalance -= req.Amount
	if app.OutstandingBalance <= 0 {
		app.Status = StatusSettled
		updateEducationLoanStatus(id, tenantID, StatusSettled)
	}

	// Publish events
	// PublishEvent("education-loans.payments", MortgageEvent{
	// 	Type:       "education_loan.payment.received",
	// 	MortgageID: app.ID,
	// 	TenantID:   tenantID,
	// 	Amount:     req.Amount,
	// 	Timestamp:  time.Now(),
	// })

	lakehouseClient.PublishEvent("education_loan_payment", map[string]interface{}{
		"application_id":      app.ID,
		"payment_id":          payment.ID,
		"amount":              req.Amount,
		"outstanding_balance": app.OutstandingBalance,
		"payment_method":      req.PaymentMethod,
		"paid_at":             time.Now(),
	}, "education-loan-service")

	c.JSON(200, gin.H{
		"status":              "payment_recorded",
		"payment_id":          payment.ID,
		"amount":              req.Amount,
		"transaction_id":      "",
		"outstanding_balance": app.OutstandingBalance,
	})
}

func getPaymentHistory(c *gin.Context) {
	id := c.Param("id")

	payments, err := fetchPaymentHistory(id)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch payment history", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"payments": payments})
}

func calculatePayoff(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	print(app)

	// Get current balances from TigerBeetle
	// principalBalance, _ := GetAccountBalance(app.PrincipalAccountID)
	// interestBalance, _ := GetAccountBalance(app.InterestAccountID)

	principalBalance := 0
	interestBalance := 0

	// Calculate payoff amount (principal + accrued interest + any fees)
	payoffAmount := principalBalance + interestBalance

	c.JSON(200, gin.H{
		"principal_balance": principalBalance,
		"interest_balance":  interestBalance,
		"payoff_amount":     payoffAmount,
		"valid_until":       time.Now().AddDate(0, 0, 10), // Valid for 10 days
	})
}

func recordAcademicProgress(c *gin.Context) {
	id := c.Param("id")
	// tenantID := c.GetString("tenant_id")

	var req struct {
		Semester         string  `json:"semester" binding:"required"`
		AcademicYear     string  `json:"academic_year" binding:"required"`
		GPA              float64 `json:"gpa" binding:"required"`
		CGPA             float64 `json:"cgpa"`
		CreditsCompleted int     `json:"credits_completed"`
		EnrollmentStatus string  `json:"enrollment_status"`
		VerifiedBy       string  `json:"verified_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	progress := &AcademicProgress{
		ID:               generateID("ACP"),
		ApplicationID:    id,
		Semester:         req.Semester,
		AcademicYear:     req.AcademicYear,
		GPA:              req.GPA,
		CGPA:             req.CGPA,
		CreditsCompleted: req.CreditsCompleted,
		EnrollmentStatus: req.EnrollmentStatus,
		VerifiedBy:       req.VerifiedBy,
		VerifiedAt:       time.Now(),
	}

	saveAcademicProgress(progress)

	// Check if student is still eligible (minimum GPA requirement)
	if req.GPA < 2.0 {
		// Flag for review - may need to pause disbursements
		// PublishEvent("education-loans.alerts", MortgageEvent{
		// 	Type:       "education_loan.academic.warning",
		// 	MortgageID: id,
		// 	TenantID:   tenantID,
		// 	Timestamp:  time.Now(),
		// 	Metadata: map[string]interface{}{
		// 		"gpa":      req.GPA,
		// 		"semester": req.Semester,
		// 		"message":  "Student GPA below minimum requirement",
		// 	},
		// })
	}

	// Publish to lakehouse for analytics
	lakehouseClient.PublishEvent("education_loan_academic_progress", map[string]interface{}{
		"application_id":    id,
		"semester":          req.Semester,
		"gpa":               req.GPA,
		"cgpa":              req.CGPA,
		"enrollment_status": req.EnrollmentStatus,
		"recorded_at":       time.Now(),
	}, "education-loan-service")

	c.JSON(200, gin.H{"status": "recorded", "progress_id": progress.ID})
}

func getAcademicProgress(c *gin.Context) {
	id := c.Param("id")

	progress, err := fetchAcademicProgress(id)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch academic progress", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"academic_progress": progress})
}

func extendMoratorium(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		AdditionalMonths int    `json:"additional_months" binding:"required"`
		Reason           string `json:"reason" binding:"required"`
		ApprovedBy       string `json:"approved_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	app, err := fetchEducationLoanApplication(id, tenantID)
	if err != nil {
		SendError(c.Writer, "not_found", "Application not found", http.StatusNotFound, nil)
		return
	}

	// Extend moratorium
	app.MoratoriumMonths += req.AdditionalMonths
	if app.MoratoriumEndDate != nil {
		newEnd := app.MoratoriumEndDate.AddDate(0, req.AdditionalMonths, 0)
		app.MoratoriumEndDate = &newEnd

		// Adjust repayment start and maturity
		repaymentStart := newEnd.AddDate(0, 1, 0)
		app.RepaymentStartDate = &repaymentStart

		maturity := repaymentStart.AddDate(0, app.RepaymentTenorMonths, 0)
		app.MaturityDate = &maturity
	}

	saveMoratoriumExtension(app, req.AdditionalMonths, req.Reason, req.ApprovedBy)

	// PublishApplicationEvent("education_loan.moratorium.extended", app)

	c.JSON(200, gin.H{
		"status":              "moratorium_extended",
		"new_moratorium_end":  app.MoratoriumEndDate,
		"new_repayment_start": app.RepaymentStartDate,
		"new_maturity_date":   app.MaturityDate,
	})
}

func requestDeferment(c *gin.Context) {
	id := c.Param("id")
	// tenantID := c.GetString("tenant_id")

	var req struct {
		DefermentType   string `json:"deferment_type" binding:"required"` // unemployment, economic_hardship, military, etc.
		DurationMonths  int    `json:"duration_months" binding:"required"`
		Reason          string `json:"reason" binding:"required"`
		SupportingDocID string `json:"supporting_doc_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Create deferment request
	defermentID := generateID("DEF")
	saveDefermentRequest(id, defermentID, req.DefermentType, req.DurationMonths, req.Reason)

	// PublishEvent("education-loans.deferments", MortgageEvent{
	// 	Type:       "education_loan.deferment.requested",
	// 	MortgageID: id,
	// 	TenantID:   tenantID,
	// 	Timestamp:  time.Now(),
	// 	Metadata: map[string]interface{}{
	// 		"deferment_id":   defermentID,
	// 		"deferment_type": req.DefermentType,
	// 		"duration":       req.DurationMonths,
	// 	},
	// })

	c.JSON(200, gin.H{
		"status":       "deferment_requested",
		"deferment_id": defermentID,
		"message":      "Deferment request submitted for review",
	})
}

func addGuarantor(c *gin.Context) {
	id := c.Param("id")
	// tenantID := c.GetString("tenant_id")

	var req struct {
		Name            string  `json:"name" binding:"required"`
		Relationship    string  `json:"relationship" binding:"required"`
		BVN             string  `json:"bvn" binding:"required"`
		NIN             string  `json:"nin"`
		Phone           string  `json:"phone" binding:"required"`
		Email           string  `json:"email" binding:"required"`
		EmployerName    string  `json:"employer_name"`
		MonthlyIncome   float64 `json:"monthly_income"`
		GuaranteeAmount float64 `json:"guarantee_amount"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	guarantor := &Guarantor{
		ID:                 generateID("GUA"),
		ApplicationID:      id,
		Name:               req.Name,
		Relationship:       req.Relationship,
		BVN:                req.BVN,
		NIN:                req.NIN,
		Phone:              req.Phone,
		Email:              req.Email,
		EmployerName:       req.EmployerName,
		MonthlyIncome:      req.MonthlyIncome,
		GuaranteeAmount:    req.GuaranteeAmount,
		VerificationStatus: "pending",
	}

	saveGuarantor(guarantor)

	// PublishEvent("education-loans.guarantors", MortgageEvent{
	// 	Type:       "education_loan.guarantor.added",
	// 	MortgageID: id,
	// 	TenantID:   tenantID,
	// 	Timestamp:  time.Now(),
	// 	Metadata: map[string]interface{}{
	// 		"guarantor_id":   guarantor.ID,
	// 		"guarantor_name": guarantor.Name,
	// 		"relationship":   guarantor.Relationship,
	// 	},
	// })

	c.JSON(201, guarantor)
}

func removeGuarantor(c *gin.Context) {
	guarantorID := c.Param("guarantorId")

	deleteGuarantor(guarantorID)

	c.JSON(200, gin.H{"status": "guarantor_removed"})
}

func calculateEligibility(c *gin.Context) {
	var req struct {
		StudentAge      int             `json:"student_age"`
		InstitutionType InstitutionType `json:"institution_type"`
		ProgramDuration int             `json:"program_duration_years"`
		RequestedAmount float64         `json:"requested_amount"`
		GuarantorIncome float64         `json:"guarantor_income"`
		GuarantorCount  int             `json:"guarantor_count"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	eligibility := engine.CheckEligibility(req.StudentAge, req.InstitutionType, req.ProgramDuration,
		req.RequestedAmount, req.GuarantorIncome, req.GuarantorCount)

	c.JSON(200, eligibility)
}

func calculateRepayment(c *gin.Context) {
	var req struct {
		LoanAmount       float64       `json:"loan_amount" binding:"required"`
		InterestRate     float64       `json:"interest_rate"`
		MoratoriumMonths int           `json:"moratorium_months"`
		RepaymentMonths  int           `json:"repayment_months" binding:"required"`
		RepaymentType    RepaymentType `json:"repayment_type"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	if req.InterestRate == 0 {
		req.InterestRate = 12.0 // Default rate
	}

	// Calculate interest accrued during moratorium
	monthlyRate := req.InterestRate / 12.0 / 100.0
	moratoriumInterest := req.LoanAmount * monthlyRate * float64(req.MoratoriumMonths)
	totalPrincipal := req.LoanAmount + moratoriumInterest

	// Calculate monthly payment
	monthlyPayment := calculateMonthlyPayment(totalPrincipal, req.InterestRate, req.RepaymentMonths)
	totalRepayment := monthlyPayment * float64(req.RepaymentMonths)
	totalInterest := totalRepayment - req.LoanAmount

	c.JSON(200, gin.H{
		"loan_amount":         req.LoanAmount,
		"moratorium_interest": moratoriumInterest,
		"total_principal":     totalPrincipal,
		"monthly_payment":     monthlyPayment,
		"total_repayment":     totalRepayment,
		"total_interest":      totalInterest,
		"repayment_months":    req.RepaymentMonths,
	})
}

func calculateIncomeBasedPayment(c *gin.Context) {
	var req struct {
		OutstandingBalance float64 `json:"outstanding_balance" binding:"required"`
		AnnualIncome       float64 `json:"annual_income" binding:"required"`
		FamilySize         int     `json:"family_size"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Income-based repayment: 10-15% of discretionary income
	// Discretionary income = Annual income - 150% of poverty line
	povertyLine := 500000.0 // NGN per year (example)
	if req.FamilySize > 1 {
		povertyLine += float64(req.FamilySize-1) * 150000.0
	}

	discretionaryIncome := req.AnnualIncome - (povertyLine * 1.5)
	if discretionaryIncome < 0 {
		discretionaryIncome = 0
	}

	// 10% of discretionary income
	annualPayment := discretionaryIncome * 0.10
	monthlyPayment := annualPayment / 12.0

	// Calculate how long it would take to pay off
	monthsToPayoff := 0
	if monthlyPayment > 0 {
		monthsToPayoff = int(math.Ceil(req.OutstandingBalance / monthlyPayment))
	}

	c.JSON(200, gin.H{
		"annual_income":        req.AnnualIncome,
		"discretionary_income": discretionaryIncome,
		"monthly_payment":      monthlyPayment,
		"annual_payment":       annualPayment,
		"months_to_payoff":     monthsToPayoff,
		"years_to_payoff":      float64(monthsToPayoff) / 12.0,
	})
}

func listInstitutions(c *gin.Context) {
	institutionType := c.Query("type")
	state := c.Query("state")

	institutions := fetchInstitutions(institutionType, state)

	c.JSON(200, gin.H{"institutions": institutions})
}

func getInstitution(c *gin.Context) {
	id := c.Param("id")

	institution := fetchInstitution(id)
	if institution == nil {
		SendError(c.Writer, "not_found", "Institution not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, institution)
}

func registerInstitution(c *gin.Context) {
	var institution InstitutionDetails
	if err := c.ShouldBindJSON(&institution); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Verify institution with NUC if it's a Nigerian university
	if institution.Country == "Nigeria" || institution.Country == "" {
		verified, verifiedName := nucInstitutionVerification2(institution.Name)
		if !verified {
			SendError(c.Writer, "validation_failed", "Institution not found in NUC accredited list", http.StatusBadRequest, nil)
			return
		}
		// Update institution name with verified name if found
		if verifiedName != "" {
			institution.Name = verifiedName
		}
		institution.NUCAccredited = true
	}

	institution.ID = generateID("INS")
	institution.VerificationStatus = "pending"

	if err := saveInstitution(&institution); err != nil {
		log.Printf("ERROR saving institution %s: %v", institution.ID, err)
		SendError(c.Writer, "internal_error", "Failed to save institution", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(201, institution)
}

func getInstitutionListFromNUC(c *gin.Context) {
	var allInstitutions []universitieslist.RawUniversity

	federal, err := universitieslist.ExtractUniversities(
		"https://www.nuc.edu.ng/nigerian-univerisities/federal-univeristies/",
		"Federal",
	)
	if err != nil {
		log.Printf("Error extracting federal universities: %v", err)
	}

	state, err := universitieslist.ExtractUniversities(
		"https://www.nuc.edu.ng/nigerian-univerisities/state-univerisity/",
		"State",
	)
	if err != nil {
		log.Printf("Error extracting state universities: %v", err)
	}

	private, err := universitieslist.ExtractUniversities(
		"https://www.nuc.edu.ng/nigerian-univerisities/private-univeristies/",
		"Private",
	)
	if err != nil {
		log.Printf("Error extracting private universities: %v", err)
	}

	allInstitutions = append(allInstitutions, federal...)
	allInstitutions = append(allInstitutions, state...)
	allInstitutions = append(allInstitutions, private...)

	transformed := universitieslist.TransformUniversities(allInstitutions)

	err = universitieslist.SaveToJSON("data/nigerian-universities.json", transformed)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to save institutions", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{
		"institutions": transformed,
		"total":        len(transformed),
		"federal":      len(federal),
		"state":        len(state),
		"private":      len(private),
	})
}

func getInstitutionListFromNUCCached(c *gin.Context) {
	data, err := universitieslist.LoadFromJSON("data/nigerian-universities.json")
	if err != nil {
		log.Printf("Error loading NUC data: %v", err)
		SendError(c.Writer, "internal_error", "Failed to load NUC accredited institutions data", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{
		"institutions": data,
		"total":        len(data),
	})
}

func nucInstitutionVerification(c *gin.Context) {
	// Load NUC accredited institutions from JSON file
	data, err := universitieslist.LoadFromJSON("data/nigerian-universities.json")
	if err != nil {
		log.Printf("Error loading NUC data: %v", err)
		SendError(c.Writer, "internal_error", "Failed to load NUC accredited institutions data", http.StatusInternalServerError, nil)
		return
	}

	if len(data) == 0 {
		SendError(c.Writer, "internal_error", "No NUC institution data available. Please load institutions first.", http.StatusServiceUnavailable, nil)
		return
	}

	// Get institution name from request body or query parameter
	var institutionName string

	// Try GET query parameter first
	if c.Request.Method == "GET" {
		institutionName = c.Query("name")
	}

	// If not in query param, try request body (POST/PUT)
	if institutionName == "" {
		req := struct {
			Name string `json:"name"`
		}{}

		if err := c.ShouldBindJSON(&req); err == nil {
			institutionName = req.Name
		}
	}

	// Validate institution name
	if institutionName == "" {
		SendError(c.Writer, "validation_failed", "Institution name is required (provide as 'name' query parameter or in request body)", http.StatusBadRequest, nil)
		return
	}

	// Normalize search term
	searchTerm := strings.ToLower(strings.TrimSpace(institutionName))
	if searchTerm == "" {
		SendError(c.Writer, "validation_failed", "Institution name cannot be empty", http.StatusBadRequest, nil)
		return
	}

	// Search for matching institutions
	var matched []universitieslist.University
	var exactMatch *universitieslist.University

	for _, inst := range data {
		instName := strings.ToLower(strings.TrimSpace(inst.Name))

		// Check for exact match
		if instName == searchTerm {
			exactMatch = &inst
			break
		}

		// Check for partial match
		if strings.Contains(instName, searchTerm) || strings.Contains(searchTerm, instName) {
			matched = append(matched, inst)
		}
	}

	// If exact match found, return it with verified status
	if exactMatch != nil {
		c.JSON(200, gin.H{
			"verified":             true,
			"exact_match":          true,
			"institution":          exactMatch,
			"matched_institutions": []universitieslist.University{*exactMatch},
		})
		return
	}

	// Return partial matches if found
	if len(matched) > 0 {
		c.JSON(200, gin.H{
			"verified":             len(matched) == 1, // Only verified if single match
			"exact_match":          false,
			"matched_institutions": matched,
			"message":              fmt.Sprintf("Found %d possible matches. Please verify the exact institution name.", len(matched)),
		})
		return
	}

	// No matches found
	c.JSON(200, gin.H{
		"verified":             false,
		"exact_match":          false,
		"matched_institutions": []universitieslist.University{},
		"message":              "Institution not found in NUC accredited list. This institution may not be NUC accredited.",
		"search_term":          institutionName,
	})
}

func getEducationLoanProducts(c *gin.Context) {
	products := getEducationLoanProductList()
	c.JSON(200, gin.H{"products": products})
}

func getEducationLoanProduct(c *gin.Context) {
	code := c.Param("code")
	product, err := getEducationLoanProductByCode(code)
	if err != nil {
		SendError(c.Writer, "not_found", "Product not found", http.StatusNotFound, nil)
		return
	}
	c.JSON(200, product)
}

func getPortfolioReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	// Query lakehouse for portfolio analytics
	report, err := lakehouseClient.Query(`
		SELECT 
			loan_type,
			COUNT(*) as count,
			SUM(approved_amount) as total_approved,
			SUM(disbursed_amount) as total_disbursed,
			AVG(interest_rate) as avg_rate
		FROM gold.education_loans
		WHERE tenant_id = '`+tenantID+`'
		GROUP BY loan_type
	`, "clickhouse")

	if err != nil {
		// Fallback to local calculation
		report = calculateLocalPortfolioReport(tenantID).([]map[string]interface{})
	}

	c.JSON(200, gin.H{"portfolio_report": report})
}

func getDisbursementReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	report, _ := lakehouseClient.Query(fmt.Sprintf(`
		SELECT 
			DATE(disbursed_at) as date,
			institution_type,
			COUNT(*) as count,
			SUM(amount) as total_amount
		FROM gold.education_loan_disbursements
		WHERE tenant_id = '%s'
		AND disbursed_at BETWEEN '%s' AND '%s'
		GROUP BY DATE(disbursed_at), institution_type
		ORDER BY date
	`, tenantID, startDate, endDate), "clickhouse")

	c.JSON(200, gin.H{"disbursement_report": report})
}

func getArrearsReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	report, _ := lakehouseClient.Query(`
		SELECT 
			CASE 
				WHEN days_past_due <= 30 THEN '1-30'
				WHEN days_past_due <= 60 THEN '31-60'
				WHEN days_past_due <= 90 THEN '61-90'
				ELSE '90+'
			END as bucket,
			COUNT(*) as count,
			SUM(outstanding_balance) as total_outstanding
		FROM gold.education_loan_arrears
		WHERE tenant_id = '`+tenantID+`'
		GROUP BY bucket
	`, "clickhouse")

	c.JSON(200, gin.H{"arrears_report": report})
}

// Helper function to verify if an institution is NUC accredited
func isNUCAccredited(institutionName string) (bool, error) {
	data, err := universitieslist.LoadFromJSON("data/nigerian-universities.json")
	if err != nil {
		log.Printf("Error loading NUC data: %v", err)
		return false, err
	}

	if len(data) == 0 {
		return false, fmt.Errorf("no NUC institution data available")
	}

	// Normalize search term
	searchTerm := strings.ToLower(strings.TrimSpace(institutionName))
	if searchTerm == "" {
		return false, fmt.Errorf("institution name cannot be empty")
	}

	// Search for exact match in NUC list
	for _, inst := range data {
		instName := strings.ToLower(strings.TrimSpace(inst.Name))
		if instName == searchTerm {
			return true, nil
		}
	}

	return false, nil
}

// Helper function to find similar NUC accredited institutions
func findSimilarNUCInstitutions(institutionName string) ([]universitieslist.University, error) {
	data, err := universitieslist.LoadFromJSON("data/nigerian-universities.json")
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("no NUC institution data available")
	}

	searchTerm := strings.ToLower(strings.TrimSpace(institutionName))
	var matched []universitieslist.University

	for _, inst := range data {
		instName := strings.ToLower(strings.TrimSpace(inst.Name))
		if strings.Contains(instName, searchTerm) || strings.Contains(searchTerm, instName) {
			matched = append(matched, inst)
		}
	}

	return matched, nil
}

// Middleware
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Correlation-ID")

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
		duration := time.Since(start).Seconds()
		requestLatency.WithLabelValues(c.Request.URL.Path).Observe(duration)
	}
}

// Helper functions
func generateID(prefix string) string {
	return fmt.Sprintf("%s%d", prefix, time.Now().UnixNano())
}

func generateApplicationNumber() string {
	return fmt.Sprintf("EDU%s%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func calculateMonthlyPayment(principal, annualRate float64, termMonths int) float64 {
	if termMonths == 0 {
		return 0
	}
	monthlyRate := annualRate / 12.0 / 100.0
	if monthlyRate == 0 {
		return principal / float64(termMonths)
	}
	payment := principal * (monthlyRate * math.Pow(1+monthlyRate, float64(termMonths))) /
		(math.Pow(1+monthlyRate, float64(termMonths)) - 1)
	return math.Round(payment*100) / 100
}

func calculateLocalPortfolioReport(tenantID string) interface{} {
	return map[string]interface{}{
		"total_applications": 0,
		"total_approved":     0,
		"total_disbursed":    0,
	}
}
