package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	db              *sql.DB
	lakehouseClient *LakehouseClient
)

// Prometheus metrics
var (
	applicationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "islamic_banking_applications_total",
			Help: "Total number of Islamic banking applications",
		},
		[]string{"status", "product_type"},
	)
	productsActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "islamic_banking_products_active",
			Help: "Number of active Islamic banking products",
		},
		[]string{"product_type"},
	)
	requestLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "islamic_banking_request_duration_seconds",
			Help:    "Request latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"endpoint"},
	)
)

func init() {
	prometheus.MustRegister(applicationsTotal)
	prometheus.MustRegister(productsActive)
	prometheus.MustRegister(requestLatency)
}

// Product Status
type ProductStatus string

const (
	StatusPending   ProductStatus = "pending"
	StatusApproved  ProductStatus = "approved"
	StatusActive    ProductStatus = "active"
	StatusRejected  ProductStatus = "rejected"
	StatusCancelled ProductStatus = "cancelled"
	StatusCompleted ProductStatus = "completed"
	StatusPaused    ProductStatus = "paused"
)

// Product Types
type ProductType string

const (
	ProductMurabaha  ProductType = "murabaha"
	ProductMusharaka ProductType = "musharaka"
	ProductIjara     ProductType = "ijara"
	ProductTakaful   ProductType = "takaful"
	ProductSukuk     ProductType = "sukuk"
)

// Lease Type for Ijara
type LeaseType string

const (
	LeaseTypeOperating LeaseType = "operating"
	LeaseTypeFinance   LeaseType = "finance"
)

// Policy Type for Takaful
type PolicyType string

const (
	PolicyTypeFamily  PolicyType = "family"
	PolicyTypeGeneral PolicyType = "general"
	PolicyTypeHealth  PolicyType = "health"
)

// Frequency Type
type FrequencyType string

const (
	FrequencyMonthly   FrequencyType = "monthly"
	FrequencyQuarterly FrequencyType = "quarterly"
	FrequencyAnnually  FrequencyType = "annually"
)

// Sukuk Type
type SukukType string

const (
	SukukTypeIjara     SukukType = "ijara"
	SukukTypeMurabaha  SukukType = "murabaha"
	SukukTypeMusharaka SukukType = "musharaka"
)

// ============================================================
// MURABAHA - Cost-Plus Financing
// ============================================================

// MurabahaProduct represents a Murabaha financing agreement
type MurabahaProduct struct {
	ID                 string        `json:"id"`
	TenantID           string        `json:"tenant_id"`
	UserID             string        `json:"user_id"`
	AssetName          string        `json:"asset_name"`
	CostPrice          float64       `json:"cost_price"`
	SellingPrice       float64       `json:"selling_price"`
	ProfitMargin       float64       `json:"profit_margin"`
	TenureMonths       int           `json:"tenure_months"`
	MonthlyInstallment float64       `json:"monthly_installment"`
	Status             ProductStatus `json:"status"`
	ReferenceNumber    string        `json:"reference_number"`
	ApplicationDate    time.Time     `json:"application_date"`
	ApprovalDate       *time.Time    `json:"approval_date,omitempty"`
	CompletionDate     *time.Time    `json:"completion_date,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// MUSHARAKA - Partnership Financing
// ============================================================

// MusharakaProduct represents a Musharaka partnership agreement
type MusharakaProduct struct {
	ID                   string        `json:"id"`
	TenantID             string        `json:"tenant_id"`
	UserID               string        `json:"user_id"`
	BusinessName         string        `json:"business_name"`
	BankContribution     float64       `json:"bank_contribution"`
	CustomerContribution float64       `json:"customer_contribution"`
	TotalCapital         float64       `json:"total_capital"`
	BankProfitShare      float64       `json:"bank_profit_share"`
	CustomerProfitShare  float64       `json:"customer_profit_share"`
	Status               ProductStatus `json:"status"`
	ReferenceNumber      string        `json:"reference_number"`
	ApplicationDate      time.Time     `json:"application_date"`
	ApprovalDate         *time.Time    `json:"approval_date,omitempty"`
	PartnershipEndDate   *time.Time    `json:"partnership_end_date,omitempty"`
	CreatedAt            time.Time     `json:"created_at"`
	UpdatedAt            *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// IJARA - Islamic Leasing
// ============================================================

// IjaraProduct represents an Ijara leasing agreement
type IjaraProduct struct {
	ID              string        `json:"id"`
	TenantID        string        `json:"tenant_id"`
	UserID          string        `json:"user_id"`
	AssetName       string        `json:"asset_name"`
	AssetValue      float64       `json:"asset_value"`
	MonthlyRental   float64       `json:"monthly_rental"`
	TenureMonths    int           `json:"tenure_months"`
	LeaseType       LeaseType     `json:"lease_type"`
	Status          ProductStatus `json:"status"`
	ReferenceNumber string        `json:"reference_number"`
	ApplicationDate time.Time     `json:"application_date"`
	ApprovalDate    *time.Time    `json:"approval_date,omitempty"`
	LeaseStartDate  *time.Time    `json:"lease_start_date,omitempty"`
	LeaseEndDate    *time.Time    `json:"lease_end_date,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// TAKAFUL - Islamic Insurance
// ============================================================

// TakafulProduct represents a Takaful insurance policy
type TakafulProduct struct {
	ID                 string        `json:"id"`
	TenantID           string        `json:"tenant_id"`
	UserID             string        `json:"user_id"`
	PolicyType         PolicyType    `json:"policy_type"`
	PolicyName         string        `json:"policy_name"`
	ContributionAmount float64       `json:"contribution_amount"`
	CoverageAmount     float64       `json:"coverage_amount"`
	Frequency          FrequencyType `json:"frequency"`
	Status             ProductStatus `json:"status"`
	ReferenceNumber    string        `json:"reference_number"`
	ApplicationDate    time.Time     `json:"application_date"`
	ApprovalDate       *time.Time    `json:"approval_date,omitempty"`
	PolicyStartDate    *time.Time    `json:"policy_start_date,omitempty"`
	PolicyEndDate      *time.Time    `json:"policy_end_date,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          *time.Time    `json:"updated_at,omitempty"`
}

// ============================================================
// SUKUK - Islamic Bonds
// ============================================================

// SukukProduct represents a Sukuk investment
type SukukProduct struct {
	ID               string        `json:"id"`
	TenantID         string        `json:"tenant_id"`
	UserID           string        `json:"user_id"`
	SukukType        SukukType     `json:"sukuk_type"`
	SukukName        string        `json:"sukuk_name"`
	InvestmentAmount float64       `json:"investment_amount"`
	ExpectedReturn   float64       `json:"expected_return"`
	TenureMonths     int           `json:"tenure_months"`
	Status           ProductStatus `json:"status"`
	ReferenceNumber  string        `json:"reference_number"`
	ApplicationDate  time.Time     `json:"application_date"`
	ApprovalDate     *time.Time    `json:"approval_date,omitempty"`
	MaturityDate     *time.Time    `json:"maturity_date,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        *time.Time    `json:"updated_at,omitempty"`
}

var islamicBankingKafkaClient = NewIslamicBankingKafkaClient()

func main() {
	godotenv.Load()

	db = initDatabase()
	if db != nil {
		defer db.Close()
	}

	lakehouseClient = NewLakehouseClient()

	router := gin.Default()
	router.Use(corsMiddleware())
	router.Use(loggingMiddleware())
	router.Use(tenantMiddleware())
	router.Use(metricsMiddleware())

	registerRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8029"
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

	log.Printf("Islamic Banking Service started on %s", addr)

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

	api := router.Group("/api/v1")
	{
		// Murabaha Endpoints
		murabaha := api.Group("/murabaha")
		{
			murabaha.GET("", getAllMurabaha)
			murabaha.GET("/:id", getMurabahaByID)
			murabaha.POST("", applyForMurabaha)
			murabaha.DELETE("/:id", cancelMurabaha)
			murabaha.PATCH("/:id/status", updateMurabahaStatus)
		}

		// Musharaka Endpoints
		musharaka := api.Group("/musharaka")
		{
			musharaka.GET("", getAllMusharaka)
			musharaka.GET("/:id", getMusharakaByID)
			musharaka.POST("", applyForMusharaka)
			musharaka.DELETE("/:id", cancelMusharaka)
			musharaka.PATCH("/:id/status", updateMusharakaStatus)
		}

		// Ijara Endpoints
		ijara := api.Group("/ijara")
		{
			ijara.GET("", getAllIjara)
			ijara.GET("/:id", getIjaraByID)
			ijara.POST("", applyForIjara)
			ijara.DELETE("/:id", cancelIjara)
			ijara.PATCH("/:id/status", updateIjaraStatus)
		}

		// Takaful Endpoints
		takaful := api.Group("/takaful")
		{
			takaful.GET("", getAllTakaful)
			takaful.GET("/:id", getTakafulByID)
			takaful.POST("", applyForTakaful)
			takaful.DELETE("/:id", cancelTakaful)
			takaful.PATCH("/:id/status", updateTakafulStatus)
		}

		// Sukuk Endpoints
		sukuk := api.Group("/sukuk")
		{
			sukuk.GET("", getAllSukuk)
			sukuk.GET("/:id", getSukukByID)
			sukuk.POST("", investInSukuk)
			sukuk.DELETE("/:id", cancelSukuk)
			sukuk.PATCH("/:id/status", updateSukukStatus)
		}

		// Common Endpoints
		api.GET("/products", getAllProducts)
		api.GET("/products/tenant", getProductsByTenant)
		api.GET("/products/:id", getProductByID)
		api.PATCH("/products/:id/status", updateProductStatusGeneric)
		api.DELETE("/products/:id", cancelProductGeneric)
	}
}

// Health check endpoint
func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{"status": "healthy", "service": "islamic-banking-service"})
}

// Middlewares
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
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID")
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
		log.Printf("[%s] %s %s - %d (%v)", c.Request.Method, c.Request.URL.Path, c.ClientIP(), c.Writer.Status(), duration)
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
		duration := time.Since(start)
		requestLatency.WithLabelValues(c.FullPath()).Observe(duration.Seconds())
	}
}

// Helper function to generate reference numbers
func generateReferenceNumber(prefix string) string {
	year := time.Now().Year()
	sequence := uuid.New().ID()
	return fmt.Sprintf("%s-%d-%06d", prefix, year, sequence%1000000)
}

// Helper function to extract user ID from context/token
func getUserID(c *gin.Context) string {
	// TODO: Extract from JWT token
	// For now, return from header or default
	userID := c.GetHeader("x-keycloak-id")
	if userID == "" {
		userID = "user_default"
	}
	return userID
}

// ============================================================
// MURABAHA HANDLERS
// ============================================================

func getAllMurabaha(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	products, err := fetchAllMurabaha(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Murabaha products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getMurabahaByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	product, err := fetchMurabahaByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForMurabaha(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		AssetName    string  `json:"asset_name" binding:"required"`
		CostPrice    float64 `json:"cost_price" binding:"required"`
		ProfitMargin float64 `json:"profit_margin" binding:"required"`
		TenureMonths int     `json:"tenure_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate selling price and monthly installment
	sellingPrice := req.CostPrice * (1 + req.ProfitMargin/100)
	monthlyInstallment := sellingPrice / float64(req.TenureMonths)

	now := time.Now()
	product := MurabahaProduct{
		ID:                 "murabaha_" + uuid.New().String()[:8],
		TenantID:           tenantID,
		UserID:             userID,
		AssetName:          req.AssetName,
		CostPrice:          req.CostPrice,
		SellingPrice:       sellingPrice,
		ProfitMargin:       req.ProfitMargin,
		TenureMonths:       req.TenureMonths,
		MonthlyInstallment: monthlyInstallment,
		Status:             StatusPending,
		ReferenceNumber:    generateReferenceNumber("MUR"),
		ApplicationDate:    now,
		CreatedAt:          now,
	}

	if err := saveMurabaha(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Murabaha application", http.StatusInternalServerError, nil)
		return
	}

	// Publish event to Kafka
	event := IslamicBankingEvent{
		Type:      "islamic_banking.murabaha.created",
		EntityID:  product.ID,
		TenantID:  tenantID,
		Status:    string(product.Status),
		Timestamp: now,
		Metadata: map[string]interface{}{
			"user_id":          userID,
			"asset_name":       req.AssetName,
			"cost_price":       req.CostPrice,
			"selling_price":    sellingPrice,
			"profit_margin":    req.ProfitMargin,
			"tenure_months":    req.TenureMonths,
			"application_date": now,
		},
	}
	islamicBankingKafkaClient.PublishEvent("islamic_banking.murabaha.created", event)

	// Publish event to lakehouse (existing)
	lakehouseClient.PublishEvent("islamic_banking_application", map[string]interface{}{
		"product_type":     "murabaha",
		"application_id":   product.ID,
		"user_id":          userID,
		"tenant_id":        tenantID,
		"asset_name":       req.AssetName,
		"cost_price":       req.CostPrice,
		"selling_price":    sellingPrice,
		"profit_margin":    req.ProfitMargin,
		"tenure_months":    req.TenureMonths,
		"application_date": now,
	}, "islamic-banking-service")

	applicationsTotal.WithLabelValues("pending", "murabaha").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Murabaha application submitted successfully", "data": product})
}

func cancelMurabaha(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	if err := updateMurabahaStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateMurabahaStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateMurabahaStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Murabaha product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// MUSHARAKA HANDLERS
// ============================================================

func getAllMusharaka(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	products, err := fetchAllMusharaka(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Musharaka products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getMusharakaByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	product, err := fetchMusharakaByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForMusharaka(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		BusinessName         string  `json:"business_name" binding:"required"`
		CustomerContribution float64 `json:"customer_contribution" binding:"required"`
		BankContribution     float64 `json:"bank_contribution" binding:"required"`
		CustomerProfitShare  float64 `json:"customer_profit_share" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate total capital and bank profit share
	totalCapital := req.BankContribution + req.CustomerContribution
	bankProfitShare := 100 - req.CustomerProfitShare

	now := time.Now()
	product := MusharakaProduct{
		ID:                   "musharaka_" + uuid.New().String()[:8],
		TenantID:             tenantID,
		UserID:               userID,
		BusinessName:         req.BusinessName,
		BankContribution:     req.BankContribution,
		CustomerContribution: req.CustomerContribution,
		TotalCapital:         totalCapital,
		BankProfitShare:      bankProfitShare,
		CustomerProfitShare:  req.CustomerProfitShare,
		Status:               StatusPending,
		ReferenceNumber:      generateReferenceNumber("MSH"),
		ApplicationDate:      now,
		CreatedAt:            now,
	}

	if err := saveMusharaka(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Musharaka application", http.StatusInternalServerError, nil)
		return
	}

	lakehouseClient.PublishEvent("islamic_banking_application", map[string]interface{}{
		"product_type":          "musharaka",
		"application_id":        product.ID,
		"business_name":         req.BusinessName,
		"total_capital":         totalCapital,
		"customer_contribution": req.CustomerContribution,
		"bank_contribution":     req.BankContribution,
	}, "islamic-banking-service")

	applicationsTotal.WithLabelValues("pending", "musharaka").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Musharaka application submitted successfully", "data": product})
}

func cancelMusharaka(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	if err := updateMusharakaStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateMusharakaStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateMusharakaStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Musharaka product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// IJARA HANDLERS
// ============================================================

func getAllIjara(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	products, err := fetchAllIjara(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Ijara products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getIjaraByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	product, err := fetchIjaraByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForIjara(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		AssetName    string  `json:"asset_name" binding:"required"`
		AssetValue   float64 `json:"asset_value" binding:"required"`
		TenureMonths int     `json:"tenure_months" binding:"required"`
		LeaseType    string  `json:"lease_type" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate monthly rental (simplified: 10% annual rate)
	monthlyRental := (req.AssetValue * 0.10) / 12

	now := time.Now()
	product := IjaraProduct{
		ID:              "ijara_" + uuid.New().String()[:8],
		TenantID:        tenantID,
		UserID:          userID,
		AssetName:       req.AssetName,
		AssetValue:      req.AssetValue,
		MonthlyRental:   monthlyRental,
		TenureMonths:    req.TenureMonths,
		LeaseType:       LeaseType(req.LeaseType),
		Status:          StatusPending,
		ReferenceNumber: generateReferenceNumber("IJA"),
		ApplicationDate: now,
		CreatedAt:       now,
	}

	if err := saveIjara(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Ijara application", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "ijara").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Ijara application submitted successfully", "data": product})
}

func cancelIjara(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	if err := updateIjaraStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateIjaraStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateIjaraStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Ijara product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// TAKAFUL HANDLERS
// ============================================================

func getAllTakaful(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	products, err := fetchAllTakaful(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Takaful products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getTakafulByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	product, err := fetchTakafulByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func applyForTakaful(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		PolicyType     string  `json:"policy_type" binding:"required"`
		PolicyName     string  `json:"policy_name" binding:"required"`
		CoverageAmount float64 `json:"coverage_amount" binding:"required"`
		Frequency      string  `json:"frequency" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Calculate contribution amount (simplified: 1% of coverage)
	contributionAmount := req.CoverageAmount * 0.01

	now := time.Now()
	product := TakafulProduct{
		ID:                 "takaful_" + uuid.New().String()[:8],
		TenantID:           tenantID,
		UserID:             userID,
		PolicyType:         PolicyType(req.PolicyType),
		PolicyName:         req.PolicyName,
		ContributionAmount: contributionAmount,
		CoverageAmount:     req.CoverageAmount,
		Frequency:          FrequencyType(req.Frequency),
		Status:             StatusPending,
		ReferenceNumber:    generateReferenceNumber("TKF"),
		ApplicationDate:    now,
		CreatedAt:          now,
	}

	if err := saveTakaful(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Takaful application", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "takaful").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Takaful application submitted successfully", "data": product})
}

func cancelTakaful(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	if err := updateTakafulStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateTakafulStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateTakafulStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Takaful product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// SUKUK HANDLERS
// ============================================================

func getAllSukuk(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	products, err := fetchAllSukuk(tenantID, userID)
	if err != nil {
		SendError(c.Writer, "internal_error", "Failed to fetch Sukuk products", http.StatusInternalServerError, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": products})
}

func getSukukByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	product, err := fetchSukukByID(id, tenantID, userID)
	if err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "data": product})
}

func investInSukuk(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		SukukType        string  `json:"sukuk_type" binding:"required"`
		SukukName        string  `json:"sukuk_name" binding:"required"`
		InvestmentAmount float64 `json:"investment_amount" binding:"required"`
		TenureMonths     int     `json:"tenure_months" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	// Expected return based on sukuk type (simplified)
	expectedReturn := 8.5

	now := time.Now()
	product := SukukProduct{
		ID:               "sukuk_" + uuid.New().String()[:8],
		TenantID:         tenantID,
		UserID:           userID,
		SukukType:        SukukType(req.SukukType),
		SukukName:        req.SukukName,
		InvestmentAmount: req.InvestmentAmount,
		ExpectedReturn:   expectedReturn,
		TenureMonths:     req.TenureMonths,
		Status:           StatusPending,
		ReferenceNumber:  generateReferenceNumber("SKK"),
		ApplicationDate:  now,
		CreatedAt:        now,
	}

	if err := saveSukuk(&product); err != nil {
		SendError(c.Writer, "internal_error", "Failed to create Sukuk investment", http.StatusInternalServerError, nil)
		return
	}

	applicationsTotal.WithLabelValues("pending", "sukuk").Inc()

	c.JSON(201, gin.H{"success": true, "message": "Sukuk investment submitted successfully", "data": product})
}

func cancelSukuk(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	if err := updateSukukStatusDB(id, tenantID, userID, StatusCancelled); err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product application cancelled successfully"})
}

func updateSukukStatus(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)
	if err := updateSukukStatusDB(id, tenantID, userID, status); err != nil {
		SendError(c.Writer, "not_found", "Sukuk product not found", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully", "data": gin.H{"id": id, "status": status, "updated_at": time.Now()}})
}

// ============================================================
// COMMON HANDLERS
// ============================================================

func getAllProducts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := getUserID(c)

	murabaha, _ := fetchAllMurabaha(tenantID, userID)
	musharaka, _ := fetchAllMusharaka(tenantID, userID)
	ijara, _ := fetchAllIjara(tenantID, userID)
	takaful, _ := fetchAllTakaful(tenantID, userID)
	sukuk, _ := fetchAllSukuk(tenantID, userID)

	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"murabaha":  murabaha,
			"musharaka": musharaka,
			"ijara":     ijara,
			"takaful":   takaful,
			"sukuk":     sukuk,
		},
	})
}

func getProductsByTenant(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	// Fetch all products for this tenant without user filtering
	murabaha, _ := fetchAllMurabahaByTenant(tenantID)
	musharaka, _ := fetchAllMusharakaByTenant(tenantID)
	ijara, _ := fetchAllIjaraByTenant(tenantID)
	takaful, _ := fetchAllTakafulByTenant(tenantID)
	sukuk, _ := fetchAllSukukByTenant(tenantID)

	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"murabaha":  murabaha,
			"musharaka": musharaka,
			"ijara":     ijara,
			"takaful":   takaful,
			"sukuk":     sukuk,
		},
	})
}

func getProductByID(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	// Try to fetch from each product type
	if product, err := fetchProductByIDFromAllTypes(id, tenantID); err == nil {
		c.JSON(200, gin.H{"success": true, "data": product})
		return
	}

	SendError(c.Writer, "not_found", "Product not found", http.StatusNotFound, nil)
}

func updateProductStatusGeneric(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		SendError(c.Writer, "validation_failed", err.Error(), http.StatusBadRequest, nil)
		return
	}

	status := ProductStatus(req.Status)

	// Try to update status in each product type
	if err := updateProductStatusInAllTypes(id, tenantID, status); err != nil {
		SendError(c.Writer, "not_found", "Product not found or update failed", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product status updated successfully"})
}

func cancelProductGeneric(c *gin.Context) {
	id := c.Param("id")
	tenantID := c.GetString("tenant_id")

	// Try to cancel in each product type
	if err := cancelProductInAllTypes(id, tenantID); err != nil {
		SendError(c.Writer, "not_found", "Product not found or cancellation failed", http.StatusNotFound, nil)
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "Product cancelled successfully"})
}
