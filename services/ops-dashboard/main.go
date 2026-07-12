package main

import (
	"database/sql"
	"fmt"
	"log"
	"maps"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	opsActionsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{Name: "ops_actions_total", Help: "Total operational actions performed"},
		[]string{"action", "resource_type", "status"},
	)
	opsActionLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{Name: "ops_action_latency_seconds", Help: "Operational action latency", Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1, 2.5, 5}},
		[]string{"action"},
	)
)

func init() {
	prometheus.MustRegister(opsActionsTotal)
	prometheus.MustRegister(opsActionLatency)
}

type Config struct {
	Port            string
	PlatformEnv     string
	TenantID        string
	BankID          string
	PrometheusURL   string
	PostgresURL     string
	RedisURL        string
	KafkaURL        string
	OpenSearchURL   string
	AlertManagerURL string
}

func LoadConfig() *Config {
	return &Config{
		Port:            getEnv("PORT", "8090"),
		PlatformEnv:     getEnv("PLATFORM_ENV", "production-baseline"),
		TenantID:        getEnv("TENANT_ID", "tenant-54bank-primary"),
		BankID:          getEnv("BANK_ID", "bank-54core-001"),
		PrometheusURL:   getEnv("PROMETHEUS_URL", "http://prometheus:9090"),
		PostgresURL:     getEnv("DATABASE_URL", "postgres://app_user:54bank-postgres-secret@postgres-primary:5432/app_db?sslmode=require"),
		RedisURL:        getEnv("REDIS_URL", "redis://:54bank-redis-secret@redis-master:6379/0"),
		KafkaURL:        getEnv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"),
		OpenSearchURL:   getEnv("OPENSEARCH_URL", "http://opensearch:9200"),
		AlertManagerURL: getEnv("ALERTMANAGER_URL", "http://alertmanager:9093"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

type ServiceHealth struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	LatencyMS float64   `json:"latency_ms"`
	ErrorRate float64   `json:"error_rate"`
	LastCheck time.Time `json:"last_check"`
}

type Alert struct {
	Name      string            `json:"name"`
	Severity  string            `json:"severity"`
	Message   string            `json:"message"`
	Service   string            `json:"service"`
	StartedAt time.Time         `json:"started_at"`
	Labels    map[string]string `json:"labels"`
}

type SystemMetrics struct {
	TotalTransactions24h int64   `json:"total_transactions_24h"`
	SuccessRate24h       float64 `json:"success_rate_24h"`
	AvgLatencyMS         float64 `json:"avg_latency_ms"`
	ActiveUsers          int64   `json:"active_users"`
	PendingTransfers     int64   `json:"pending_transfers"`
	FailedTransactions   int64   `json:"failed_transactions"`
	WarehouseQueue       int64   `json:"warehouse_queue"`
	ManualAdjustments    int64   `json:"manual_adjustments"`
	DisputesOpen         int64   `json:"disputes_open"`
}

type ManualAdjustment struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	AccountID  string                 `json:"account_id"`
	Amount     float64                `json:"amount"`
	Currency   string                 `json:"currency"`
	Reason     string                 `json:"reason"`
	Reference  string                 `json:"reference"`
	ApprovedBy string                 `json:"approved_by,omitempty"`
	ExecutedBy string                 `json:"executed_by,omitempty"`
	Status     string                 `json:"status"`
	Metadata   map[string]interface{} `json:"metadata"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type DisputeCase struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transaction_id"`
	CustomerID    string    `json:"customer_id"`
	Type          string    `json:"type"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	Priority      string    `json:"priority"`
	AssignedTo    string    `json:"assigned_to"`
	Description   string    `json:"description"`
	Resolution    string    `json:"resolution,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	SLADeadline   time.Time `json:"sla_deadline"`
}

type WarehouseReceiptCase struct {
	ReceiptID          string    `json:"receipt_id"`
	FarmerID           string    `json:"farmer_id"`
	Commodity          string    `json:"commodity"`
	WarehouseID        string    `json:"warehouse_id"`
	QuantityMT         float64   `json:"quantity_mt"`
	CollateralValue    float64   `json:"collateral_value"`
	FinanceStatus      string    `json:"finance_status"`
	VerificationStatus string    `json:"verification_status"`
	SettlementStatus   string    `json:"settlement_status"`
	LastUpdated        time.Time `json:"last_updated"`
}

type PartnerSettlement struct {
	SettlementID string    `json:"settlement_id"`
	PartnerType  string    `json:"partner_type"`
	PartnerName  string    `json:"partner_name"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"`
	Status       string    `json:"status"`
	ExpectedAt   time.Time `json:"expected_at"`
	Reference    string    `json:"reference"`
}

type OpsDashboard struct {
	config        *Config
	mutex         sync.RWMutex
	manuals       []ManualAdjustment
	disputes      []DisputeCase
	receipts      []WarehouseReceiptCase
	settlements   []PartnerSettlement
	serviceHealth map[string]ServiceHealth
	activeAlerts  []Alert
	promClient    *PrometheusClient
	amClient      *AlertManagerClient
	k8sClient     *KubernetesClient
	smokeDB       *sql.DB
}

func NewOpsDashboard(config *Config) *OpsDashboard {
	k8s := NewKubernetesClient()
	if k8s != nil {
		log.Printf("Kubernetes client initialised (namespace=%s)", k8s.namespace)
	} else {
		log.Printf("Kubernetes client unavailable — falling back to Prometheus only")
	}
	od := &OpsDashboard{
		config:        config,
		manuals:       []ManualAdjustment{},
		disputes:      []DisputeCase{},
		receipts:      []WarehouseReceiptCase{},
		settlements:   []PartnerSettlement{},
		serviceHealth: make(map[string]ServiceHealth),
		activeAlerts:  []Alert{},
		promClient:    NewPrometheusClient(config.PrometheusURL),
		amClient:      NewAlertManagerClient(config.AlertManagerURL),
		k8sClient:     k8s,
	}
	od.smokeDB = openSmokeDB(config.PostgresURL)
	if od.smokeDB != nil {
		log.Printf("smoke-results DB connected")
	} else {
		log.Printf("smoke-results DB not available (DATABASE_URL not set or unreachable)")
	}
	return od
}

// refreshHealthAndAlerts fetches live service health and alerts.
//
// Strategy:
//  1. Kubernetes pod list  → primary source of service discovery and readiness
//  2. Prometheus metrics   → supplements latency_ms and error_rate for each service
//  3. AlertManager         → active alerts
//
// On any error the existing in-memory state is kept unchanged.
func (od *OpsDashboard) refreshHealthAndAlerts() {
	health := make(map[string]ServiceHealth)

	// 1. Kubernetes pod health (covers every deployed service)
	if od.k8sClient != nil {
		if k8sHealth, err := od.k8sClient.FetchPodHealth(); err == nil {
			maps.Copy(health, k8sHealth)
			log.Printf("k8s health: %d services", len(k8sHealth))
		} else {
			log.Printf("k8s health refresh failed: %v", err)
		}
	}

	// 2. Prometheus metrics — overlay latency + error_rate; also catches
	//    services not yet in Kubernetes (e.g. external scraped targets).
	if promHealth, err := od.promClient.FetchServiceHealth(); err == nil {
		for name, ph := range promHealth {
			if existing, ok := health[name]; ok {
				// Kubernetes has the authoritative up/down; Prometheus adds metrics
				existing.LatencyMS = ph.LatencyMS
				existing.ErrorRate = ph.ErrorRate
				// Prometheus degradation signal takes precedence over "healthy"
				if ph.Status == "degraded" && existing.Status == "healthy" {
					existing.Status = "degraded"
				}
				health[name] = existing
			} else {
				// Service is scraped by Prometheus but not a K8s pod (external)
				health[name] = ph
			}
		}
		log.Printf("prometheus supplement: %d services", len(promHealth))
	} else {
		log.Printf("prometheus refresh failed: %v", err)
	}

	// 3. Direct HTTP health probes — tries /health, /healthz, /ready, /livez per service.
	//    Result is authoritative for Status and LatencyMS when any path responds.
	if od.k8sClient != nil {
		if probed, err := od.k8sClient.ProbeServiceHealth(); err == nil {
			for name, ph := range probed {
				if existing, ok := health[name]; ok {
					existing.Status = ph.Status
					if ph.LatencyMS > 0 {
						existing.LatencyMS = ph.LatencyMS
					}
					existing.LastCheck = ph.LastCheck
					health[name] = existing
				} else {
					health[name] = ph
				}
			}
			log.Printf("http probe: %d services", len(probed))
		} else {
			log.Printf("http probe failed: %v", err)
		}
	}

	if len(health) > 0 {
		od.mutex.Lock()
		od.serviceHealth = health
		od.mutex.Unlock()
	}

	// 4. AlertManager alerts
	if alerts, err := od.amClient.FetchActiveAlerts(); err == nil {
		od.mutex.Lock()
		od.activeAlerts = alerts
		od.mutex.Unlock()
		log.Printf("alert refresh: %d active alerts", len(alerts))
	} else {
		log.Printf("alertmanager refresh failed: %v", err)
	}
}

// startBackgroundRefresh does an immediate refresh then repeats on interval.
func (od *OpsDashboard) startBackgroundRefresh(interval time.Duration) {
	od.refreshHealthAndAlerts()
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			od.refreshHealthAndAlerts()
		}
	}()
}

func (od *OpsDashboard) RegisterRoutes(router *gin.Engine) {
	router.Use(od.metricsMiddleware())
	router.GET("/health", od.healthHandler)
	router.GET("/ready", od.readyHandler)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	api := router.Group("/api/v1/ops")
	{
		api.GET("/overview", od.getOverview)
		api.GET("/services/health", od.getServiceHealth)
		api.GET("/smoke-results", od.getSmokeResults)
		api.GET("/alerts", od.getAlerts)
		api.GET("/adjustments", od.listManualAdjustments)
		api.POST("/adjustments", od.createManualAdjustment)
		api.POST("/adjustments/:id/approve", od.approveAdjustment)
		api.GET("/disputes", od.listDisputes)
		api.POST("/disputes/:id/resolve", od.resolveDispute)
		api.GET("/warehouse-receipts", od.listWarehouseReceipts)
		api.POST("/warehouse-receipts/:id/advance", od.advanceWarehouseReceipt)
		api.GET("/partner-settlements", od.listPartnerSettlements)
		api.POST("/partner-settlements/:id/release", od.releasePartnerSettlement)
	}
}

func (od *OpsDashboard) metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		action := c.FullPath()
		if action == "" {
			action = c.Request.URL.Path
		}
		opsActionsTotal.WithLabelValues(action, c.Request.Method, strconv.Itoa(c.Writer.Status())).Inc()
		opsActionLatency.WithLabelValues(action).Observe(time.Since(start).Seconds())
	}
}

func (od *OpsDashboard) healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "ops-dashboard", "tenant_id": od.config.TenantID, "bank_id": od.config.BankID})
}

func (od *OpsDashboard) readyHandler(c *gin.Context) {
	od.mutex.RLock()
	degraded := 0
	for _, svc := range od.serviceHealth {
		if svc.Status != "healthy" {
			degraded++
		}
	}
	od.mutex.RUnlock()
	status := "ready"
	code := http.StatusOK
	if degraded > 0 {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}
	c.JSON(code, gin.H{"status": status, "degraded_dependencies": degraded})
}

func (od *OpsDashboard) getOverview(c *gin.Context) {
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	metrics := SystemMetrics{
		TotalTransactions24h: 58210,
		SuccessRate24h:       98.7,
		AvgLatencyMS:         86.3,
		ActiveUsers:          14285,
		PendingTransfers:     18,
		FailedTransactions:   22,
		WarehouseQueue:       int64(len(od.receipts)),
		ManualAdjustments:    int64(len(od.manuals)),
		DisputesOpen:         int64(len(od.disputes)),
	}
	services := make([]ServiceHealth, 0, len(od.serviceHealth))
	for _, svc := range od.serviceHealth {
		services = append(services, svc)
	}
	sort.Slice(services, func(i, j int) bool { return services[i].Name < services[j].Name })
	c.JSON(http.StatusOK, gin.H{
		"generated_at": time.Now().UTC(),
		"metrics":      metrics,
		"alerts":       od.activeAlerts,
		"services":     services,
		"queues": gin.H{
			"warehouse_receipts":  len(od.receipts),
			"manual_adjustments":  len(od.manuals),
			"disputes":            len(od.disputes),
			"partner_settlements": len(od.settlements),
		},
	})
}

func (od *OpsDashboard) getServiceHealth(c *gin.Context) {
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	result := make([]ServiceHealth, 0, len(od.serviceHealth))
	for _, svc := range od.serviceHealth {
		if filter := c.Query("status"); filter != "" && svc.Status != filter {
			continue
		}
		result = append(result, svc)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	c.JSON(http.StatusOK, gin.H{"services": result, "total": len(result)})
}

func (od *OpsDashboard) getAlerts(c *gin.Context) {
	severity := strings.TrimSpace(c.Query("severity"))
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	alerts := make([]Alert, 0, len(od.activeAlerts))
	for _, alert := range od.activeAlerts {
		if severity != "" && alert.Severity != severity {
			continue
		}
		alerts = append(alerts, alert)
	}
	c.JSON(http.StatusOK, gin.H{"alerts": alerts, "total": len(alerts)})
}

func (od *OpsDashboard) listManualAdjustments(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	items := make([]ManualAdjustment, 0, len(od.manuals))
	for _, item := range od.manuals {
		if status != "" && item.Status != status {
			continue
		}
		items = append(items, item)
	}
	c.JSON(http.StatusOK, gin.H{"adjustments": items, "total": len(items)})
}

func (od *OpsDashboard) createManualAdjustment(c *gin.Context) {
	var request ManualAdjustment
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid adjustment payload", "details": err.Error()})
		return
	}
	if request.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		return
	}
	now := time.Now().UTC()
	request.ID = fmt.Sprintf("ADJ-%d", now.UnixNano())
	request.Status = "pending"
	request.CreatedAt = now
	request.UpdatedAt = now
	if request.Currency == "" {
		request.Currency = "NGN"
	}
	if request.Metadata == nil {
		request.Metadata = map[string]interface{}{}
	}
	request.Metadata["workflow_stage"] = "maker_checker_queue"
	od.mutex.Lock()
	od.manuals = append([]ManualAdjustment{request}, od.manuals...)
	od.mutex.Unlock()
	c.JSON(http.StatusCreated, gin.H{"adjustment": request})
}

func (od *OpsDashboard) approveAdjustment(c *gin.Context) {
	id := c.Param("id")
	approvedBy := firstNonEmpty(c.GetHeader("x-keycloak-id"), "ops.supervisor")
	od.mutex.Lock()
	defer od.mutex.Unlock()
	for idx, item := range od.manuals {
		if item.ID == id {
			od.manuals[idx].Status = "approved"
			od.manuals[idx].ApprovedBy = approvedBy
			od.manuals[idx].ExecutedBy = approvedBy
			od.manuals[idx].UpdatedAt = time.Now().UTC()
			c.JSON(http.StatusOK, gin.H{"adjustment": od.manuals[idx]})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "adjustment not found"})
}

func (od *OpsDashboard) listDisputes(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	items := make([]DisputeCase, 0, len(od.disputes))
	for _, dispute := range od.disputes {
		if status != "" && dispute.Status != status {
			continue
		}
		items = append(items, dispute)
	}
	c.JSON(http.StatusOK, gin.H{"disputes": items, "total": len(items)})
}

func (od *OpsDashboard) resolveDispute(c *gin.Context) {
	id := c.Param("id")
	var payload struct {
		Resolution string `json:"resolution"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dispute resolution payload", "details": err.Error()})
		return
	}
	od.mutex.Lock()
	defer od.mutex.Unlock()
	for idx, dispute := range od.disputes {
		if dispute.ID == id {
			od.disputes[idx].Status = "resolved"
			od.disputes[idx].Resolution = firstNonEmpty(payload.Resolution, "case closed after customer remediation")
			od.disputes[idx].UpdatedAt = time.Now().UTC()
			c.JSON(http.StatusOK, gin.H{"dispute": od.disputes[idx]})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "dispute not found"})
}

func (od *OpsDashboard) listWarehouseReceipts(c *gin.Context) {
	status := strings.TrimSpace(c.Query("finance_status"))
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	items := make([]WarehouseReceiptCase, 0, len(od.receipts))
	for _, receipt := range od.receipts {
		if status != "" && receipt.FinanceStatus != status {
			continue
		}
		items = append(items, receipt)
	}
	c.JSON(http.StatusOK, gin.H{"receipts": items, "total": len(items)})
}

func (od *OpsDashboard) advanceWarehouseReceipt(c *gin.Context) {
	id := c.Param("id")
	var payload struct {
		FinanceStatus    string `json:"finance_status"`
		SettlementStatus string `json:"settlement_status"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid receipt update payload", "details": err.Error()})
		return
	}
	od.mutex.Lock()
	defer od.mutex.Unlock()
	for idx, receipt := range od.receipts {
		if receipt.ReceiptID == id {
			if payload.FinanceStatus != "" {
				od.receipts[idx].FinanceStatus = payload.FinanceStatus
			}
			if payload.SettlementStatus != "" {
				od.receipts[idx].SettlementStatus = payload.SettlementStatus
			}
			od.receipts[idx].LastUpdated = time.Now().UTC()
			c.JSON(http.StatusOK, gin.H{"receipt": od.receipts[idx]})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "receipt not found"})
}

func (od *OpsDashboard) listPartnerSettlements(c *gin.Context) {
	status := strings.TrimSpace(c.Query("status"))
	od.mutex.RLock()
	defer od.mutex.RUnlock()
	items := make([]PartnerSettlement, 0, len(od.settlements))
	for _, settlement := range od.settlements {
		if status != "" && settlement.Status != status {
			continue
		}
		items = append(items, settlement)
	}
	c.JSON(http.StatusOK, gin.H{"settlements": items, "total": len(items)})
}

func (od *OpsDashboard) releasePartnerSettlement(c *gin.Context) {
	id := c.Param("id")
	od.mutex.Lock()
	defer od.mutex.Unlock()
	for idx, settlement := range od.settlements {
		if settlement.SettlementID == id {
			od.settlements[idx].Status = "released"
			od.settlements[idx].ExpectedAt = time.Now().UTC()
			c.JSON(http.StatusOK, gin.H{"settlement": od.settlements[idx]})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "settlement not found"})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func main() {
	config := LoadConfig()
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	dashboard := NewOpsDashboard(config)
	dashboard.startBackgroundRefresh(30 * time.Second)
	dashboard.RegisterRoutes(router)
	log.Printf("Starting ops-dashboard on :%s (prometheus=%s alertmanager=%s)", config.Port, config.PrometheusURL, config.AlertManagerURL)
	if err := router.Run(":" + config.Port); err != nil {
		log.Fatal(err)
	}
}
