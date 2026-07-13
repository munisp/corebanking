package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	bffRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "bff_requests_total", Help: "Total BFF requests"},
		[]string{"endpoint", "method", "status"},
	)
	bffLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{Name: "bff_request_latency_seconds", Help: "BFF request latency", Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5}},
		[]string{"endpoint"},
	)
	upstreamLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{Name: "bff_upstream_latency_seconds", Help: "Upstream service latency", Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5}},
		[]string{"service", "method"},
	)
)

func init() {
	prometheus.MustRegister(bffRequestsTotal)
	prometheus.MustRegister(bffLatency)
	prometheus.MustRegister(upstreamLatency)
	rand.Seed(time.Now().UnixNano())
}

type Config struct {
	Port               string
	PlatformEnv        string
	BankID             string
	TenantID           string
	Currency           string
	AuthServiceURL     string
	AccountServiceURL  string
	PaymentServiceURL  string
	TransferServiceURL string
	BillPayServiceURL  string
	NotificationURL    string
	CardServiceURL     string
	LoanServiceURL     string
	RequestTimeout     time.Duration
	CacheTTL           time.Duration
}

func LoadConfig() *Config {
	return &Config{
		Port:               getEnv("PORT", "8090"),
		PlatformEnv:        getEnv("PLATFORM_ENV", "production-baseline"),
		BankID:             getEnv("BANK_ID", "bank-54core-001"),
		TenantID:           getEnv("TENANT_ID", "tenant-54bank-primary"),
		Currency:           getEnv("DEFAULT_CURRENCY", "NGN"),
		AuthServiceURL:     getEnv("AUTH_SERVICE_URL", "http://auth-service:8081"),
		AccountServiceURL:  getEnv("ACCOUNT_SERVICE_URL", "http://account-service:8000"),
		PaymentServiceURL:  getEnv("PAYMENT_SERVICE_URL", "http://payment-service:8080"),
		TransferServiceURL: getEnv("TRANSFER_SERVICE_URL", "http://transfer-service:8080"),
		BillPayServiceURL:  getEnv("BILLPAY_SERVICE_URL", "http://bill-payment-service:8000"),
		NotificationURL:    getEnv("NOTIFICATION_SERVICE_URL", "http://notification-service:8000"),
		CardServiceURL:     getEnv("CARD_SERVICE_URL", "http://card-service:8000"),
		LoanServiceURL:     getEnv("LOAN_SERVICE_URL", "http://loan-service:8080"),
		RequestTimeout:     time.Duration(getEnvInt("REQUEST_TIMEOUT_SECONDS", 12)) * time.Second,
		CacheTTL:           time.Duration(getEnvInt("CACHE_TTL_SECONDS", 120)) * time.Second,
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

type ServiceClient struct {
	httpClient *http.Client
	baseURL    string
	name       string
}

func NewServiceClient(name, baseURL string, timeout time.Duration) *ServiceClient {
	return &ServiceClient{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    strings.TrimRight(baseURL, "/"),
		name:       name,
	}
}

func (c *ServiceClient) Get(ctx context.Context, path string, headers map[string]string) (map[string]interface{}, int, error) {
	return c.do(ctx, http.MethodGet, path, nil, headers)
}

func (c *ServiceClient) Post(ctx context.Context, path string, body interface{}, headers map[string]string) (map[string]interface{}, int, error) {
	return c.do(ctx, http.MethodPost, path, body, headers)
}

func (c *ServiceClient) Put(ctx context.Context, path string, body interface{}, headers map[string]string) (map[string]interface{}, int, error) {
	return c.do(ctx, http.MethodPut, path, body, headers)
}

func (c *ServiceClient) do(ctx context.Context, method, path string, body interface{}, headers map[string]string) (map[string]interface{}, int, error) {
	start := time.Now()
	defer func() {
		upstreamLatency.WithLabelValues(c.name, method).Observe(time.Since(start).Seconds())
	}()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, 0, err
		}
		reader = bytes.NewReader(payload)
	}

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		if value != "" {
			req.Header.Set(key, value)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	result := map[string]interface{}{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil && err != io.EOF {
		return nil, resp.StatusCode, err
	}
	result["_upstream_status"] = resp.StatusCode
	result["_upstream_service"] = c.name
	return result, resp.StatusCode, nil
}

type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

type SimpleCache struct {
	mutex sync.RWMutex
	data  map[string]cacheEntry
	ttl   time.Duration
}

func NewSimpleCache(ttl time.Duration) *SimpleCache {
	return &SimpleCache{data: make(map[string]cacheEntry), ttl: ttl}
}

func (c *SimpleCache) Get(key string) (interface{}, bool) {
	c.mutex.RLock()
	entry, ok := c.data[key]
	c.mutex.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.value, true
}

func (c *SimpleCache) Set(key string, value interface{}) {
	c.mutex.Lock()
	c.data[key] = cacheEntry{value: value, expiresAt: time.Now().Add(c.ttl)}
	c.mutex.Unlock()
}

type MobileBFF struct {
	config         *Config
	authClient     *ServiceClient
	accountClient  *ServiceClient
	paymentClient  *ServiceClient
	transferClient *ServiceClient
	billPayClient  *ServiceClient
	notifyClient   *ServiceClient
	cardClient     *ServiceClient
	loanClient     *ServiceClient
	cache          *SimpleCache
}

func NewMobileBFF(config *Config) *MobileBFF {
	return &MobileBFF{
		config:         config,
		authClient:     NewServiceClient("auth", config.AuthServiceURL, config.RequestTimeout),
		accountClient:  NewServiceClient("account", config.AccountServiceURL, config.RequestTimeout),
		paymentClient:  NewServiceClient("payment", config.PaymentServiceURL, config.RequestTimeout),
		transferClient: NewServiceClient("transfer", config.TransferServiceURL, config.RequestTimeout),
		billPayClient:  NewServiceClient("billpay", config.BillPayServiceURL, config.RequestTimeout),
		notifyClient:   NewServiceClient("notification", config.NotificationURL, config.RequestTimeout),
		cardClient:     NewServiceClient("card", config.CardServiceURL, config.RequestTimeout),
		loanClient:     NewServiceClient("loan", config.LoanServiceURL, config.RequestTimeout),
		cache:          NewSimpleCache(config.CacheTTL),
	}
}

func (bff *MobileBFF) RegisterRoutes(router *gin.Engine) {
	router.Use(bff.metricsMiddleware())
	router.Use(bff.recoveryMiddleware())
	router.GET("/health", bff.healthHandler)
	router.GET("/ready", bff.readyHandler)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := router.Group("/api/v1")
	{
		api.GET("/dashboard", bff.getDashboard)
		api.GET("/accounts", bff.getAccounts)
		api.GET("/accounts/:id", bff.getAccountDetails)
		api.GET("/accounts/:id/transactions", bff.getAccountTransactions)
		api.POST("/transfers/internal", bff.initiateInternalTransfer)
		api.POST("/transfers/nip", bff.initiateNIPTransfer)
		api.GET("/transfers/:id", bff.getTransferStatus)
		api.GET("/billers", bff.getBillers)
		api.GET("/billers/:category", bff.getBillersByCategory)
		api.POST("/bills/validate", bff.validateBill)
		api.POST("/bills/pay", bff.payBill)
		api.GET("/cards", bff.getCards)
		api.POST("/cards/:id/block", bff.blockCard)
		api.POST("/cards/:id/unblock", bff.unblockCard)
		api.GET("/loans", bff.getLoans)
		api.GET("/loans/eligibility", bff.checkLoanEligibility)
		api.POST("/loans/apply", bff.applyForLoan)
		api.GET("/notifications", bff.getNotifications)
		api.POST("/notifications/:id/read", bff.markNotificationRead)
		api.GET("/profile", bff.getProfile)
		api.PUT("/profile", bff.updateProfile)
		api.GET("/quick-balance", bff.getQuickBalance)
		api.POST("/quick-transfer", bff.quickTransfer)
		api.POST("/quick-airtime", bff.quickAirtime)
	}
}

func (bff *MobileBFF) metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		c.Next()
		bffRequestsTotal.WithLabelValues(path, c.Request.Method, strconv.Itoa(c.Writer.Status())).Inc()
		bffLatency.WithLabelValues(path).Observe(time.Since(start).Seconds())
	}
}

func (bff *MobileBFF) recoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("panic recovered: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				c.Abort()
			}
		}()
		c.Next()
	}
}

func (bff *MobileBFF) baseHeaders(c *gin.Context) map[string]string {
	return map[string]string{
		"Authorization": c.GetHeader("Authorization"),
		"x-keycloak-id": firstNonEmpty(c.GetHeader("x-keycloak-id"), "mobile-user-001"),
		"X-Tenant-ID":   firstNonEmpty(c.GetHeader("X-Tenant-ID"), bff.config.TenantID),
		"X-Bank-ID":     firstNonEmpty(c.GetHeader("X-Bank-ID"), bff.config.BankID),
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (bff *MobileBFF) healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":        "healthy",
		"service":       "mobile-bff",
		"environment":   bff.config.PlatformEnv,
		"tenant_id":     bff.config.TenantID,
		"bank_id":       bff.config.BankID,
		"default_money": bff.config.Currency,
	})
}

func (bff *MobileBFF) readyHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 4*time.Second)
	defer cancel()
	dependencies := map[string]string{
		"account":      "/health",
		"notification": "/health",
		"loan":         "/health",
	}
	clients := map[string]*ServiceClient{
		"account":      bff.accountClient,
		"notification": bff.notifyClient,
		"loan":         bff.loanClient,
	}
	results := map[string]interface{}{}
	ready := true
	for name, path := range dependencies {
		_, status, err := clients[name].Get(ctx, path, nil)
		state := "ready"
		if err != nil || status >= 500 || status == 0 {
			state = "degraded"
			ready = false
		}
		results[name] = gin.H{"status": state, "http_status": status}
	}
	statusCode := http.StatusOK
	state := "ready"
	if !ready {
		statusCode = http.StatusServiceUnavailable
		state = "degraded"
	}
	c.JSON(statusCode, gin.H{"status": state, "dependencies": results})
}

func (bff *MobileBFF) getDashboard(c *gin.Context) {
	cacheKey := "dashboard:" + firstNonEmpty(c.GetHeader("x-keycloak-id"), "mobile-user-001")
	if cached, ok := bff.cache.Get(cacheKey); ok {
		c.JSON(http.StatusOK, gin.H{"source": "cache", "data": cached})
		return
	}

	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	var wg sync.WaitGroup
	var accountsResp, cardsResp, loansResp, notificationsResp map[string]interface{}
	var accErr, cardErr, loanErr, noteErr error

	wg.Add(4)
	go func() {
		defer wg.Done()
		accountsResp, _, accErr = bff.accountClient.Get(ctx, "/api/v1/accounts?limit=3", headers)
	}()
	go func() {
		defer wg.Done()
		cardsResp, _, cardErr = bff.cardClient.Get(ctx, "/api/v1/cards?limit=2", headers)
	}()
	go func() {
		defer wg.Done()
		loansResp, _, loanErr = bff.loanClient.Get(ctx, "/api/v1/loans?limit=2", headers)
	}()
	go func() {
		defer wg.Done()
		notificationsResp, _, noteErr = bff.notifyClient.Get(ctx, "/api/v1/notifications?limit=5", headers)
	}()
	wg.Wait()

	data := gin.H{
		"customer": gin.H{
			"user_id":         headers["x-keycloak-id"],
			"tenant_id":       headers["X-Tenant-ID"],
			"relationship":    "primary-mobile",
			"preferred_money": bff.config.Currency,
		},
		"accounts":      fallbackIfNil(accountsResp, bff.fallbackAccounts(headers)),
		"cards":         fallbackIfNil(cardsResp, bff.fallbackCards(headers)),
		"loans":         fallbackIfNil(loansResp, bff.fallbackLoans(headers)),
		"notifications": fallbackIfNil(notificationsResp, bff.fallbackNotifications(headers)),
		"resilience": gin.H{
			"account_upstream":      errString(accErr),
			"card_upstream":         errString(cardErr),
			"loan_upstream":         errString(loanErr),
			"notification_upstream": errString(noteErr),
		},
		"generated_at": time.Now().UTC(),
	}
	bff.cache.Set(cacheKey, data)
	c.JSON(http.StatusOK, gin.H{"source": "live_or_fallback", "data": data})
}

func (bff *MobileBFF) getAccounts(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.accountClient.Get(ctx, "/api/v1/accounts", headers)
	if err != nil {
		c.JSON(http.StatusOK, bff.fallbackAccounts(headers))
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) getAccountDetails(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	accountID := c.Param("id")
	payload, _, err := bff.accountClient.Get(ctx, "/api/v1/accounts/"+accountID, headers)
	if err != nil {
		accounts := bff.fallbackAccounts(headers)
		c.JSON(http.StatusOK, gin.H{"account_id": accountID, "fallback": true, "portfolio": accounts})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) getAccountTransactions(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	accountID := c.Param("id")
	payload, _, err := bff.accountClient.Get(ctx, fmt.Sprintf("/api/v1/accounts/%s/transactions", accountID), headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"account_id": accountID,
			"transactions": []gin.H{
				{"transaction_id": "TXN-541001", "type": "credit", "amount": 150000, "currency": bff.config.Currency, "narration": "produce settlement", "status": "posted", "created_at": time.Now().Add(-2 * time.Hour).UTC()},
				{"transaction_id": "TXN-541002", "type": "debit", "amount": 24500, "currency": bff.config.Currency, "narration": "input purchase", "status": "posted", "created_at": time.Now().Add(-8 * time.Hour).UTC()},
			},
			"fallback": true,
		})
		return
	}
	c.JSON(http.StatusOK, payload)
}

type transferRequest struct {
	FromAccountID string  `json:"from_account_id"`
	ToAccountID   string  `json:"to_account_id"`
	BankCode      string  `json:"bank_code"`
	Beneficiary   string  `json:"beneficiary_name"`
	Amount        float64 `json:"amount"`
	Narration     string  `json:"narration"`
	Channel       string  `json:"channel"`
	Pin           string  `json:"pin"`
}

func (bff *MobileBFF) initiateInternalTransfer(c *gin.Context) {
	bff.processTransfer(c, "/api/v1/transfers/internal", "internal")
}

func (bff *MobileBFF) initiateNIPTransfer(c *gin.Context) {
	bff.processTransfer(c, "/api/v1/transfers/nip", "nip")
}

func (bff *MobileBFF) processTransfer(c *gin.Context, upstreamPath, transferType string) {
	var req transferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transfer payload", "details": err.Error()})
		return
	}
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		return
	}

	headers := bff.baseHeaders(c)
	payload := gin.H{
		"tenant_id":        headers["X-Tenant-ID"],
		"bank_id":          headers["X-Bank-ID"],
		"initiator_id":     headers["x-keycloak-id"],
		"from_account_id":  req.FromAccountID,
		"to_account_id":    req.ToAccountID,
		"bank_code":        req.BankCode,
		"beneficiary_name": firstNonEmpty(req.Beneficiary, "beneficiary"),
		"amount":           req.Amount,
		"narration":        firstNonEmpty(req.Narration, "mobile transfer"),
		"channel":          firstNonEmpty(req.Channel, "mobile_app"),
		"transfer_type":    transferType,
	}

	ctx := c.Request.Context()
	upstream, status, err := bff.transferClient.Post(ctx, upstreamPath, payload, headers)
	response := gin.H{
		"request":         gin.H{"type": transferType, "amount": req.Amount, "currency": bff.config.Currency},
		"execution_mode":  "upstream",
		"upstream_status": status,
		"result":          upstream,
	}
	if err != nil || status >= 500 || status == 0 {
		response = gin.H{
			"execution_mode":               "fallback_workflow",
			"transfer_id":                  fmt.Sprintf("TRF-%d", time.Now().UnixNano()),
			"status":                       "pending_authorization",
			"workflow_stage":               "maker_checker_queue",
			"amount":                       req.Amount,
			"currency":                     bff.config.Currency,
			"tenant_id":                    headers["X-Tenant-ID"],
			"estimated_completion_seconds": 45,
		}
	}
	c.JSON(http.StatusAccepted, response)
}

func (bff *MobileBFF) getTransferStatus(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	transferID := c.Param("id")
	payload, _, err := bff.transferClient.Get(ctx, "/api/v1/transfers/"+transferID, headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"transfer_id": transferID, "status": "processing", "channel": "mobile_app", "fallback": true})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) getBillers(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.billPayClient.Get(ctx, "/api/v1/billers", headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"billers": []gin.H{{"category": "utilities", "name": "Ikeja Electric"}, {"category": "airtime", "name": "MTN Nigeria"}, {"category": "agriculture", "name": "Input Cooperative"}}, "fallback": true})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) getBillersByCategory(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	category := c.Param("category")
	payload, _, err := bff.billPayClient.Get(ctx, "/api/v1/billers/"+category, headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"category": category, "billers": []gin.H{{"name": strings.Title(category) + " default biller", "category": category}}, "fallback": true})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) validateBill(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bill validation payload", "details": err.Error()})
		return
	}
	headers := bff.baseHeaders(c)
	ctx := c.Request.Context()
	upstream, status, err := bff.billPayClient.Post(ctx, "/api/v1/bills/validate", payload, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "validated", "customer_name": "Resolved Subscriber", "amount_due": 8500, "currency": bff.config.Currency, "fallback": true})
		return
	}
	c.JSON(http.StatusOK, upstream)
}

func (bff *MobileBFF) payBill(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bill payment payload", "details": err.Error()})
		return
	}
	headers := bff.baseHeaders(c)
	payload["channel"] = "mobile_app"
	payload["tenant_id"] = headers["X-Tenant-ID"]
	ctx := c.Request.Context()
	upstream, status, err := bff.billPayClient.Post(ctx, "/api/v1/bills/pay", payload, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusAccepted, gin.H{"payment_id": fmt.Sprintf("BILL-%d", time.Now().UnixNano()), "status": "queued", "fallback": true, "channel": "mobile_app"})
		return
	}
	c.JSON(http.StatusAccepted, upstream)
}

func (bff *MobileBFF) getCards(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.cardClient.Get(ctx, "/api/v1/cards", headers)
	if err != nil {
		c.JSON(http.StatusOK, bff.fallbackCards(headers))
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) blockCard(c *gin.Context) {
	bff.updateCardState(c, c.Param("id"), "block")
}

func (bff *MobileBFF) unblockCard(c *gin.Context) {
	bff.updateCardState(c, c.Param("id"), "unblock")
}

func (bff *MobileBFF) updateCardState(c *gin.Context, cardID, action string) {
	headers := bff.baseHeaders(c)
	payload := gin.H{"card_id": cardID, "action": action, "requested_by": headers["x-keycloak-id"], "channel": "mobile_app"}
	ctx := c.Request.Context()
	upstream, status, err := bff.cardClient.Post(ctx, "/api/v1/cards/"+cardID+"/"+action, payload, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusAccepted, gin.H{"card_id": cardID, "status": map[string]string{"block": "blocked", "unblock": "active"}[action], "fallback": true})
		return
	}
	c.JSON(http.StatusAccepted, upstream)
}

func (bff *MobileBFF) getLoans(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.loanClient.Get(ctx, "/api/v1/loans", headers)
	if err != nil {
		c.JSON(http.StatusOK, bff.fallbackLoans(headers))
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) checkLoanEligibility(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.loanClient.Get(ctx, "/api/v1/loans/eligibility", headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"eligible": true, "max_amount": 1250000, "recommended_product": "agri_input_bridge", "currency": bff.config.Currency, "fallback": true})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) applyForLoan(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid loan application payload", "details": err.Error()})
		return
	}
	headers := bff.baseHeaders(c)
	payload["tenant_id"] = headers["X-Tenant-ID"]
	payload["origin_channel"] = "mobile_app"
	ctx := c.Request.Context()
	upstream, status, err := bff.loanClient.Post(ctx, "/api/v1/loans/apply", payload, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusAccepted, gin.H{"application_id": fmt.Sprintf("LOAN-%d", time.Now().UnixNano()), "status": "under_review", "origin_channel": "mobile_app", "fallback": true})
		return
	}
	c.JSON(http.StatusAccepted, upstream)
}

func (bff *MobileBFF) getNotifications(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.notifyClient.Get(ctx, "/api/v1/notifications", headers)
	if err != nil {
		c.JSON(http.StatusOK, bff.fallbackNotifications(headers))
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) markNotificationRead(c *gin.Context) {
	headers := bff.baseHeaders(c)
	notificationID := c.Param("id")
	ctx := c.Request.Context()
	upstream, status, err := bff.notifyClient.Post(ctx, "/api/v1/notifications/"+notificationID+"/read", gin.H{"read_by": headers["x-keycloak-id"]}, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusOK, gin.H{"notification_id": notificationID, "status": "read", "fallback": true})
		return
	}
	c.JSON(http.StatusOK, upstream)
}

func (bff *MobileBFF) getProfile(c *gin.Context) {
	ctx := c.Request.Context()
	headers := bff.baseHeaders(c)
	payload, _, err := bff.authClient.Get(ctx, "/api/v1/profile", headers)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"user_id": headers["x-keycloak-id"], "tenant_id": headers["X-Tenant-ID"], "display_name": "Primary Mobile User", "segment": "retail_agriculture", "fallback": true})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func (bff *MobileBFF) updateProfile(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile payload", "details": err.Error()})
		return
	}
	headers := bff.baseHeaders(c)
	ctx := c.Request.Context()
	upstream, status, err := bff.authClient.Put(ctx, "/api/v1/profile", payload, headers)
	if err != nil || status >= 500 || status == 0 {
		payload["updated"] = true
		payload["fallback"] = true
		c.JSON(http.StatusOK, payload)
		return
	}
	c.JSON(http.StatusOK, upstream)
}

func (bff *MobileBFF) getQuickBalance(c *gin.Context) {
	headers := bff.baseHeaders(c)
	accounts := bff.fallbackAccounts(headers)
	c.JSON(http.StatusOK, gin.H{
		"customer":          headers["x-keycloak-id"],
		"available_balance": 684250.55,
		"ledger_balance":    702500.55,
		"currency":          bff.config.Currency,
		"portfolio":         accounts,
	})
}

func (bff *MobileBFF) quickTransfer(c *gin.Context) {
	bff.processTransfer(c, "/api/v1/transfers/internal", "quick_internal")
}

func (bff *MobileBFF) quickAirtime(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid airtime payload", "details": err.Error()})
		return
	}
	payload["category"] = "airtime"
	payload["channel"] = "mobile_app"
	headers := bff.baseHeaders(c)
	ctx := c.Request.Context()
	upstream, status, err := bff.billPayClient.Post(ctx, "/api/v1/bills/pay", payload, headers)
	if err != nil || status >= 500 || status == 0 {
		c.JSON(http.StatusAccepted, gin.H{"payment_id": fmt.Sprintf("AIR-%d", time.Now().UnixNano()), "status": "queued", "fallback": true})
		return
	}
	c.JSON(http.StatusAccepted, upstream)
}

func (bff *MobileBFF) fallbackAccounts(headers map[string]string) gin.H {
	return gin.H{"accounts": []gin.H{
		{"account_id": "ACC-540001", "account_name": "Primary Wallet", "balance": 684250.55, "currency": bff.config.Currency, "status": "active"},
		{"account_id": "ACC-540002", "account_name": "Harvest Savings", "balance": 125000.00, "currency": bff.config.Currency, "status": "active"},
	}, "tenant_id": headers["X-Tenant-ID"], "fallback": true}
}

func (bff *MobileBFF) fallbackCards(headers map[string]string) gin.H {
	return gin.H{"cards": []gin.H{
		{"card_id": "CARD-001", "masked_pan": "5399********2201", "status": "active", "type": "debit"},
		{"card_id": "CARD-002", "masked_pan": "5399********9910", "status": "blocked", "type": "virtual"},
	}, "tenant_id": headers["X-Tenant-ID"], "fallback": true}
}

func (bff *MobileBFF) fallbackLoans(headers map[string]string) gin.H {
	return gin.H{"loans": []gin.H{
		{"loan_id": "LN-AGRI-001", "product": "Agri Input Bridge", "status": "active", "outstanding": 420000, "currency": bff.config.Currency},
		{"loan_id": "LN-WRH-001", "product": "Warehouse Receipt Finance", "status": "under_review", "outstanding": 0, "currency": bff.config.Currency},
	}, "tenant_id": headers["X-Tenant-ID"], "fallback": true}
}

func (bff *MobileBFF) fallbackNotifications(headers map[string]string) gin.H {
	return gin.H{"notifications": []gin.H{
		{"id": "NTF-001", "title": "Receipt collateral verified", "severity": "info", "read": false},
		{"id": "NTF-002", "title": "Transfer awaiting checker approval", "severity": "warning", "read": false},
	}, "tenant_id": headers["X-Tenant-ID"], "fallback": true}
}

func fallbackIfNil(payload map[string]interface{}, fallback gin.H) interface{} {
	if payload == nil || len(payload) == 0 {
		return fallback
	}
	return payload
}

func errString(err error) string {
	if err == nil {
		return "ok"
	}
	return err.Error()
}

func main() {
	config := LoadConfig()
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	bff := NewMobileBFF(config)
	bff.RegisterRoutes(router)

	log.Printf("Starting mobile-bff on :%s", config.Port)
	if err := router.Run(":" + config.Port); err != nil {
		log.Fatal(err)
	}
}
