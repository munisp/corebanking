package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	fxDealsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "treasury_fx_deals_total",
			Help: "Total number of FX deals",
		},
		[]string{"deal_type", "status"},
	)

	interbankDealsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "treasury_interbank_deals_total",
			Help: "Total number of interbank deals",
		},
		[]string{"deal_type", "status"},
	)

	liquidityPosition = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "treasury_liquidity_position",
			Help: "Current liquidity position",
		},
		[]string{"currency"},
	)

	fxPositionGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "treasury_fx_position",
			Help: "Current FX position",
		},
		[]string{"currency"},
	)

	lcrGauge = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "treasury_lcr",
			Help: "Liquidity Coverage Ratio",
		},
	)
)

// TreasuryServer holds all services
type TreasuryServer struct {
	liquidityService  *LiquidityService
	fxService         *FXService
	investmentService *InvestmentService
	interbankService  *InterbankService
	almService        *ALMService
	limitService      *LimitService
	officerService    *OfficerService
	middleware        *MiddlewareIntegration
}

// NewTreasuryServer creates a new server instance
func NewTreasuryServer() *TreasuryServer {
	tenantID := os.Getenv("DEFAULT_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	return &TreasuryServer{
		liquidityService:  NewLiquidityService(tenantID),
		fxService:         NewFXService(tenantID),
		investmentService: NewInvestmentService(tenantID),
		interbankService:  NewInterbankService(tenantID),
		almService:        NewALMService(tenantID),
		limitService:      NewLimitService(tenantID),
		officerService:    NewOfficerService(tenantID),
		middleware:        NewMiddlewareIntegration(tenantID),
	}
}

func main() {
	server := NewTreasuryServer()
	router := mux.NewRouter()

	// Middleware
	router.Use(corsMiddleware)
	router.Use(tenantMiddleware)
	router.Use(loggingMiddleware)
	router.Use(auditMiddleware)

	// Health and metrics
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// API routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Liquidity Management
	api.HandleFunc("/liquidity/position", server.getLiquidityPositionHandler).Methods("GET")
	api.HandleFunc("/liquidity/position/{currency}", server.getLiquidityByCurrencyHandler).Methods("GET")
	api.HandleFunc("/liquidity/cash-flow", server.getCashFlowHandler).Methods("GET")
	api.HandleFunc("/liquidity/cash-flow/projection", server.getCashFlowProjectionHandler).Methods("GET")
	api.HandleFunc("/liquidity/ratios", server.getLiquidityRatiosHandler).Methods("GET")
	api.HandleFunc("/liquidity/nostro", server.getNostroBalancesHandler).Methods("GET")
	api.HandleFunc("/liquidity/vostro", server.getVostroBalancesHandler).Methods("GET")
	api.HandleFunc("/liquidity/crr", server.getCRRPositionHandler).Methods("GET")

	// FX Operations
	api.HandleFunc("/fx/positions", server.listFXPositionsHandler).Methods("GET")
	api.HandleFunc("/fx/positions/{currency}", server.getFXPositionHandler).Methods("GET")
	api.HandleFunc("/fx/deals", server.listFXDealsHandler).Methods("GET")
	api.HandleFunc("/fx/deals", server.createFXDealHandler).Methods("POST")
	api.HandleFunc("/fx/deals/{deal_id}", server.getFXDealHandler).Methods("GET")
	api.HandleFunc("/fx/deals/{deal_id}", server.updateFXDealHandler).Methods("PUT")
	api.HandleFunc("/fx/deals/{deal_id}/approve", server.approveFXDealHandler).Methods("POST")
	api.HandleFunc("/fx/deals/{deal_id}/execute", server.executeFXDealHandler).Methods("POST")
	api.HandleFunc("/fx/deals/{deal_id}/settle", server.settleFXDealHandler).Methods("POST")
	api.HandleFunc("/fx/deals/{deal_id}/cancel", server.cancelFXDealHandler).Methods("POST")
	api.HandleFunc("/fx/rates", server.getFXRatesHandler).Methods("GET")
	api.HandleFunc("/fx/pnl", server.getFXPnLHandler).Methods("GET")

	// Investments
	api.HandleFunc("/investments", server.listInvestmentsHandler).Methods("GET")
	api.HandleFunc("/investments", server.createInvestmentHandler).Methods("POST")
	api.HandleFunc("/investments/{investment_id}", server.getInvestmentHandler).Methods("GET")
	api.HandleFunc("/investments/{investment_id}", server.updateInvestmentHandler).Methods("PUT")
	api.HandleFunc("/investments/{investment_id}/sell", server.sellInvestmentHandler).Methods("POST")
	api.HandleFunc("/investments/portfolio", server.getPortfolioSummaryHandler).Methods("GET")
	api.HandleFunc("/investments/maturing", server.getMaturingInvestmentsHandler).Methods("GET")
	api.HandleFunc("/investments/yield", server.getPortfolioYieldHandler).Methods("GET")

	// Customer portfolio (investment workspace)
	api.HandleFunc("/portfolios", server.listPortfoliosHandler).Methods("GET")
	api.HandleFunc("/portfolios", server.createPortfolioHandler).Methods("POST")
	api.HandleFunc("/portfolios/{id}", server.getPortfolioHandler).Methods("GET")
	api.HandleFunc("/portfolios/{id}", server.updatePortfolioHandler).Methods("PUT")
	api.HandleFunc("/portfolios/{id}", server.deletePortfolioHandler).Methods("DELETE")

	// Interbank Operations
	api.HandleFunc("/interbank/deals", server.listInterbankDealsHandler).Methods("GET")
	api.HandleFunc("/interbank/deals", server.createInterbankDealHandler).Methods("POST")
	api.HandleFunc("/interbank/deals/{deal_id}", server.getInterbankDealHandler).Methods("GET")
	api.HandleFunc("/interbank/deals/{deal_id}", server.updateInterbankDealHandler).Methods("PUT")
	api.HandleFunc("/interbank/deals/{deal_id}/approve", server.approveInterbankDealHandler).Methods("POST")
	api.HandleFunc("/interbank/deals/{deal_id}/rollover", server.rolloverInterbankDealHandler).Methods("POST")
	api.HandleFunc("/interbank/position", server.getInterbankPositionHandler).Methods("GET")
	api.HandleFunc("/interbank/rates", server.getInterbankRatesHandler).Methods("GET")

	// ALM (Asset-Liability Management)
	api.HandleFunc("/alm/gap", server.getALMGapHandler).Methods("GET")
	api.HandleFunc("/alm/gap/analysis", server.getGapAnalysisHandler).Methods("GET")
	api.HandleFunc("/alm/interest-rate-risk", server.getInterestRateRiskHandler).Methods("GET")
	api.HandleFunc("/alm/duration", server.getDurationAnalysisHandler).Methods("GET")
	api.HandleFunc("/alm/stress-test", server.runStressTestHandler).Methods("POST")
	api.HandleFunc("/alm/scenarios", server.getScenarioAnalysisHandler).Methods("GET")

	// Limits Management
	api.HandleFunc("/limits", server.listLimitsHandler).Methods("GET")
	api.HandleFunc("/limits", server.createLimitHandler).Methods("POST")
	api.HandleFunc("/limits/{limit_id}", server.getLimitHandler).Methods("GET")
	api.HandleFunc("/limits/{limit_id}", server.updateLimitHandler).Methods("PUT")
	api.HandleFunc("/limits/utilization", server.getLimitUtilizationHandler).Methods("GET")
	api.HandleFunc("/limits/breaches", server.getLimitBreachesHandler).Methods("GET")

	// Officers
	api.HandleFunc("/officers", server.listOfficersHandler).Methods("GET")
	api.HandleFunc("/officers", server.registerOfficerHandler).Methods("POST")
	api.HandleFunc("/officers/{officer_id}", server.getOfficerHandler).Methods("GET")
	api.HandleFunc("/officers/{officer_id}", server.updateOfficerHandler).Methods("PUT")
	api.HandleFunc("/officers/{officer_id}/deals", server.getOfficerDealsHandler).Methods("GET")

	// Dashboard
	api.HandleFunc("/dashboard", server.getDashboardHandler).Methods("GET")
	api.HandleFunc("/dashboard/summary", server.getDashboardSummaryHandler).Methods("GET")
	api.HandleFunc("/dashboard/alerts", server.getAlertsHandler).Methods("GET")

	// Reports
	api.HandleFunc("/reports/daily", server.getDailyReportHandler).Methods("GET")
	api.HandleFunc("/reports/weekly", server.getWeeklyReportHandler).Methods("GET")
	api.HandleFunc("/reports/monthly", server.getMonthlyReportHandler).Methods("GET")
	api.HandleFunc("/reports/regulatory", server.getRegulatoryReportHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8127"
	}

	log.Printf("Treasury Service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}

// Middleware functions
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-Officer-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func tenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		r.Header.Set("X-Tenant-ID", tenantID)
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s %v", r.Method, r.RequestURI, r.Header.Get("X-Tenant-ID"), time.Since(start))
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "treasury-service"})
}

// Helper functions
func getTenantID(r *http.Request) string {
	return r.Header.Get("X-Tenant-ID")
}

func getUserID(r *http.Request) string {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID = "system"
	}
	return userID
}

func getOfficerID(r *http.Request) string {
	officerID := r.Header.Get("X-Officer-ID")
	if officerID == "" {
		officerID = getUserID(r)
	}
	return officerID
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Liquidity handlers
func (s *TreasuryServer) getLiquidityPositionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	position := s.liquidityService.GetLiquidityPosition(tenantID, "NGN")
	respondJSON(w, http.StatusOK, position)
}

func (s *TreasuryServer) getLiquidityByCurrencyHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	currency := vars["currency"]
	tenantID := getTenantID(r)
	position := s.liquidityService.GetLiquidityPosition(tenantID, currency)
	respondJSON(w, http.StatusOK, position)
}

func (s *TreasuryServer) getCashFlowHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	cashFlows := s.liquidityService.GetCashFlows(tenantID, startDate, endDate)
	respondJSON(w, http.StatusOK, map[string]interface{}{"cashFlows": cashFlows})
}

func (s *TreasuryServer) getCashFlowProjectionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	days := r.URL.Query().Get("days")
	projection := s.liquidityService.GetCashFlowProjection(tenantID, days)
	respondJSON(w, http.StatusOK, map[string]interface{}{"projection": projection})
}

func (s *TreasuryServer) getLiquidityRatiosHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	ratios := s.liquidityService.GetLiquidityRatios(tenantID)
	respondJSON(w, http.StatusOK, ratios)
}

func (s *TreasuryServer) getNostroBalancesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	balances := s.liquidityService.GetNostroBalances(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"nostroBalances": balances})
}

func (s *TreasuryServer) getVostroBalancesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	balances := s.liquidityService.GetVostroBalances(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"vostroBalances": balances})
}

func (s *TreasuryServer) getCRRPositionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	crr := s.liquidityService.GetCRRPosition(tenantID)
	respondJSON(w, http.StatusOK, crr)
}

// FX handlers
func (s *TreasuryServer) listFXPositionsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	positions := s.fxService.ListFXPositions(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"positions": positions})
}

func (s *TreasuryServer) getFXPositionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	currency := vars["currency"]
	tenantID := getTenantID(r)
	position := s.fxService.GetFXPosition(tenantID, currency)
	respondJSON(w, http.StatusOK, position)
}

func (s *TreasuryServer) listFXDealsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	dealType := r.URL.Query().Get("type")
	deals := s.fxService.ListFXDeals(tenantID, status, dealType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"deals": deals})
}

func (s *TreasuryServer) createFXDealHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	officerID := getOfficerID(r)

	var req CreateFXDealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	deal, err := s.fxService.CreateFXDeal(tenantID, officerID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	fxDealsTotal.WithLabelValues(req.DealType, "pending").Inc()
	respondJSON(w, http.StatusCreated, deal)
}

func (s *TreasuryServer) getFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	deal, err := s.fxService.GetFXDeal(tenantID, dealID)
	if err != nil {
		respondError(w, http.StatusNotFound, "FX deal not found")
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) updateFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	var deal FXDeal
	if err := json.NewDecoder(r.Body).Decode(&deal); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	deal.DealID = dealID
	deal.TenantID = tenantID

	if err := s.fxService.UpdateFXDeal(&deal); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) approveFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	deal, err := s.fxService.ApproveFXDeal(tenantID, dealID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) executeFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	deal, err := s.fxService.ExecuteFXDeal(tenantID, dealID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	fxDealsTotal.WithLabelValues(deal.DealType, "executed").Inc()
	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) settleFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	deal, err := s.fxService.SettleFXDeal(tenantID, dealID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	fxDealsTotal.WithLabelValues(deal.DealType, "settled").Inc()
	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) cancelFXDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	deal, err := s.fxService.CancelFXDeal(tenantID, dealID, req.Reason)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) getFXRatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rates, err := s.fxService.GetFXRates(tenantID)
	if err != nil {
		respondError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"rates": rates})
}

func (s *TreasuryServer) getFXPnLHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	pnl, err := s.fxService.GetFXPnL(tenantID)
	if err != nil {
		respondError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, pnl)
}

// Investment handlers
func (s *TreasuryServer) listInvestmentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	investmentType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")
	investments := s.investmentService.ListInvestments(tenantID, investmentType, status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"investments": investments})
}

func (s *TreasuryServer) createInvestmentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var req CreateInvestmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	investment, err := s.investmentService.CreateInvestment(tenantID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, investment)
}

func (s *TreasuryServer) getInvestmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	investmentID := vars["investment_id"]
	tenantID := getTenantID(r)

	investment, err := s.investmentService.GetInvestment(tenantID, investmentID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Investment not found")
		return
	}

	respondJSON(w, http.StatusOK, investment)
}

func (s *TreasuryServer) updateInvestmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	investmentID := vars["investment_id"]
	tenantID := getTenantID(r)

	var investment Investment
	if err := json.NewDecoder(r.Body).Decode(&investment); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	investment.InvestmentID = investmentID
	investment.TenantID = tenantID

	if err := s.investmentService.UpdateInvestment(&investment); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, investment)
}

func (s *TreasuryServer) sellInvestmentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	investmentID := vars["investment_id"]
	tenantID := getTenantID(r)

	var req struct {
		SalePrice int64 `json:"salePrice"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	investment, err := s.investmentService.SellInvestment(tenantID, investmentID, req.SalePrice)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, investment)
}

func (s *TreasuryServer) getPortfolioSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	summary := s.investmentService.GetPortfolioSummary(tenantID)
	respondJSON(w, http.StatusOK, summary)
}

func (s *TreasuryServer) getMaturingInvestmentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	days := r.URL.Query().Get("days")
	investments := s.investmentService.GetMaturingInvestments(tenantID, days)
	respondJSON(w, http.StatusOK, map[string]interface{}{"investments": investments})
}

func (s *TreasuryServer) getPortfolioYieldHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	yield := s.investmentService.GetPortfolioYield(tenantID)
	respondJSON(w, http.StatusOK, yield)
}

// Interbank handlers
func (s *TreasuryServer) listInterbankDealsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	dealType := r.URL.Query().Get("type")
	deals := s.interbankService.ListInterbankDeals(tenantID, status, dealType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"deals": deals})
}

func (s *TreasuryServer) createInterbankDealHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	officerID := getOfficerID(r)

	var req CreateInterbankDealRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	deal, err := s.interbankService.CreateInterbankDeal(tenantID, officerID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	interbankDealsTotal.WithLabelValues(req.DealType, "pending").Inc()
	respondJSON(w, http.StatusCreated, deal)
}

func (s *TreasuryServer) getInterbankDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	deal, err := s.interbankService.GetInterbankDeal(tenantID, dealID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Interbank deal not found")
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) updateInterbankDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	var deal InterbankDeal
	if err := json.NewDecoder(r.Body).Decode(&deal); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	deal.DealID = dealID
	deal.TenantID = tenantID

	if err := s.interbankService.UpdateInterbankDeal(&deal); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) approveInterbankDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)
	userID := getUserID(r)

	deal, err := s.interbankService.ApproveInterbankDeal(tenantID, dealID, userID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	interbankDealsTotal.WithLabelValues(deal.DealType, "active").Inc()
	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) rolloverInterbankDealHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dealID := vars["deal_id"]
	tenantID := getTenantID(r)

	var req struct {
		NewMaturityDate string  `json:"newMaturityDate"`
		NewRate         float64 `json:"newRate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	deal, err := s.interbankService.RolloverDeal(tenantID, dealID, req.NewMaturityDate, req.NewRate)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, deal)
}

func (s *TreasuryServer) getInterbankPositionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	position := s.interbankService.GetInterbankPosition(tenantID)
	respondJSON(w, http.StatusOK, position)
}

func (s *TreasuryServer) getInterbankRatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	rates := s.interbankService.GetInterbankRates(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"rates": rates})
}

// ALM handlers
func (s *TreasuryServer) getALMGapHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	currency := r.URL.Query().Get("currency")
	if currency == "" {
		currency = "NGN"
	}
	gap := s.almService.GetALMGap(tenantID, currency)
	respondJSON(w, http.StatusOK, gap)
}

func (s *TreasuryServer) getGapAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	analysis := s.almService.GetGapAnalysis(tenantID)
	respondJSON(w, http.StatusOK, analysis)
}

func (s *TreasuryServer) getInterestRateRiskHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	risk := s.almService.GetInterestRateRisk(tenantID)
	respondJSON(w, http.StatusOK, risk)
}

func (s *TreasuryServer) getDurationAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	analysis := s.almService.GetDurationAnalysis(tenantID)
	respondJSON(w, http.StatusOK, analysis)
}

func (s *TreasuryServer) runStressTestHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var req struct {
		Scenario  string  `json:"scenario"`
		RateShift float64 `json:"rateShift"`
		FXShift   float64 `json:"fxShift"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result := s.almService.RunStressTest(tenantID, req.Scenario, req.RateShift, req.FXShift)
	respondJSON(w, http.StatusOK, result)
}

func (s *TreasuryServer) getScenarioAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	scenarios := s.almService.GetScenarioAnalysis(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"scenarios": scenarios})
}

// Limit handlers
func (s *TreasuryServer) listLimitsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	limitType := r.URL.Query().Get("type")
	limits := s.limitService.ListLimits(tenantID, limitType)
	respondJSON(w, http.StatusOK, map[string]interface{}{"limits": limits})
}

func (s *TreasuryServer) createLimitHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	userID := getUserID(r)

	var req CreateLimitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	limit, err := s.limitService.CreateLimit(tenantID, userID, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, limit)
}

func (s *TreasuryServer) getLimitHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	limitID := vars["limit_id"]
	tenantID := getTenantID(r)

	limit, err := s.limitService.GetLimit(tenantID, limitID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Limit not found")
		return
	}

	respondJSON(w, http.StatusOK, limit)
}

func (s *TreasuryServer) updateLimitHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	limitID := vars["limit_id"]
	tenantID := getTenantID(r)

	var limit TreasuryLimit
	if err := json.NewDecoder(r.Body).Decode(&limit); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	limit.LimitID = limitID
	limit.TenantID = tenantID

	if err := s.limitService.UpdateLimit(&limit); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, limit)
}

func (s *TreasuryServer) getLimitUtilizationHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	utilization := s.limitService.GetLimitUtilization(tenantID)
	respondJSON(w, http.StatusOK, utilization)
}

func (s *TreasuryServer) getLimitBreachesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	breaches := s.limitService.GetLimitBreaches(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"breaches": breaches})
}

// Officer handlers
func (s *TreasuryServer) listOfficersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	desk := r.URL.Query().Get("desk")
	officers := s.officerService.ListOfficers(tenantID, desk)
	respondJSON(w, http.StatusOK, map[string]interface{}{"officers": officers})
}

func (s *TreasuryServer) registerOfficerHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)

	var officer TreasuryOfficer
	if err := json.NewDecoder(r.Body).Decode(&officer); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	newOfficer, err := s.officerService.RegisterOfficer(tenantID, &officer)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, newOfficer)
}

func (s *TreasuryServer) getOfficerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	officerID := vars["officer_id"]
	tenantID := getTenantID(r)

	officer, err := s.officerService.GetOfficer(tenantID, officerID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Officer not found")
		return
	}

	respondJSON(w, http.StatusOK, officer)
}

func (s *TreasuryServer) updateOfficerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	officerID := vars["officer_id"]
	tenantID := getTenantID(r)

	var officer TreasuryOfficer
	if err := json.NewDecoder(r.Body).Decode(&officer); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	officer.OfficerID = officerID
	officer.TenantID = tenantID

	if err := s.officerService.UpdateOfficer(&officer); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, officer)
}

func (s *TreasuryServer) getOfficerDealsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	officerID := vars["officer_id"]
	tenantID := getTenantID(r)

	deals := s.officerService.GetOfficerDeals(tenantID, officerID, s.fxService, s.interbankService)
	respondJSON(w, http.StatusOK, deals)
}

// Dashboard handlers
func (s *TreasuryServer) getDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	respondJSON(w, http.StatusOK, dashboard)
}

func (s *TreasuryServer) getDashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	dashboard := s.getDashboard(tenantID)
	summary := map[string]interface{}{
		"totalLiquidity":   dashboard.TotalLiquidity,
		"lcr":              dashboard.LCR,
		"totalFXPosition":  dashboard.TotalFXPosition,
		"totalInvestments": dashboard.TotalInvestments,
		"limitsBreached":   dashboard.LimitsBreached,
	}
	respondJSON(w, http.StatusOK, summary)
}

func (s *TreasuryServer) getAlertsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	alerts := s.getAlerts(tenantID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"alerts": alerts})
}

func (s *TreasuryServer) getDashboard(tenantID string) *TreasuryDashboard {
	dashboard := &TreasuryDashboard{
		Date: time.Now(),
	}

	// Get liquidity data
	liquidity := s.liquidityService.GetLiquidityPosition(tenantID, "NGN")
	dashboard.TotalLiquidity = liquidity.NetPosition
	dashboard.LCR = liquidity.LCR
	dashboard.NSFR = liquidity.NSFR
	dashboard.CRR = liquidity.CRR
	dashboard.LiquidityStatus = liquidity.Status

	// Get FX data
	fxPositions := s.fxService.ListFXPositions(tenantID)
	for _, pos := range fxPositions {
		dashboard.TotalFXPosition += pos.NetPosition
		dashboard.FXPnL += pos.UnrealizedPnL
	}
	fxDeals := s.fxService.ListFXDeals(tenantID, "pending", "")
	dashboard.OpenFXDeals = len(fxDeals)

	// Get investment data
	portfolio := s.investmentService.GetPortfolioSummary(tenantID)
	if total, ok := portfolio["totalValue"].(int64); ok {
		dashboard.TotalInvestments = total
	}
	if yield, ok := portfolio["avgYield"].(float64); ok {
		dashboard.InvestmentYield = yield
	}

	// Get interbank data
	interbankPos := s.interbankService.GetInterbankPosition(tenantID)
	if placements, ok := interbankPos["placements"].(int64); ok {
		dashboard.Placements = placements
	}
	if takings, ok := interbankPos["takings"].(int64); ok {
		dashboard.Takings = takings
	}
	dashboard.NetInterbankPosition = dashboard.Placements - dashboard.Takings

	// Get ALM data
	almGap := s.almService.GetALMGap(tenantID, "NGN")
	dashboard.GapRatio = almGap.GapRatio
	dashboard.ALMStatus = almGap.Status

	// Get limit data
	breaches := s.limitService.GetLimitBreaches(tenantID)
	dashboard.LimitsBreached = len(breaches)

	return dashboard
}

func (s *TreasuryServer) getAlerts(tenantID string) []map[string]interface{} {
	var alerts []map[string]interface{}

	// Check liquidity alerts
	liquidity := s.liquidityService.GetLiquidityPosition(tenantID, "NGN")
	if liquidity.LCR < 100 {
		alerts = append(alerts, map[string]interface{}{
			"type":     "liquidity",
			"severity": "critical",
			"message":  "LCR below regulatory minimum",
			"value":    liquidity.LCR,
		})
	}

	// Check limit breaches
	breaches := s.limitService.GetLimitBreaches(tenantID)
	for _, breach := range breaches {
		alerts = append(alerts, map[string]interface{}{
			"type":     "limit_breach",
			"severity": "high",
			"message":  "Limit breached: " + breach.LimitType,
			"value":    breach.Utilization,
		})
	}

	return alerts
}

// Report handlers
func (s *TreasuryServer) getDailyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	date := r.URL.Query().Get("date")
	report := s.generateDailyReport(tenantID, date)
	respondJSON(w, http.StatusOK, report)
}

func (s *TreasuryServer) getWeeklyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	startDate := r.URL.Query().Get("start_date")
	report := s.generateWeeklyReport(tenantID, startDate)
	respondJSON(w, http.StatusOK, report)
}

func (s *TreasuryServer) getMonthlyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	month := r.URL.Query().Get("month")
	year := r.URL.Query().Get("year")
	report := s.generateMonthlyReport(tenantID, month, year)
	respondJSON(w, http.StatusOK, report)
}

func (s *TreasuryServer) getRegulatoryReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	reportType := r.URL.Query().Get("type")
	report := s.generateRegulatoryReport(tenantID, reportType)
	respondJSON(w, http.StatusOK, report)
}

func (s *TreasuryServer) generateDailyReport(tenantID, date string) map[string]interface{} {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}
	dashboard := s.getDashboard(tenantID)
	return map[string]interface{}{
		"reportType":        "daily",
		"date":              date,
		"liquidity":         dashboard.TotalLiquidity,
		"lcr":               dashboard.LCR,
		"nsfr":              dashboard.NSFR,
		"fxPosition":        dashboard.TotalFXPosition,
		"fxPnL":             dashboard.FXPnL,
		"investments":       dashboard.TotalInvestments,
		"interbankPosition": dashboard.NetInterbankPosition,
		"limitsBreached":    dashboard.LimitsBreached,
		"generatedAt":       time.Now().Format(time.RFC3339),
	}
}

func (s *TreasuryServer) generateWeeklyReport(tenantID, startDate string) map[string]interface{} {
	return map[string]interface{}{
		"reportType":   "weekly",
		"startDate":    startDate,
		"avgLCR":       125.5,
		"avgNSFR":      115.2,
		"fxVolume":     50000000000,
		"fxPnL":        250000000,
		"newDeals":     25,
		"maturedDeals": 18,
		"generatedAt":  time.Now().Format(time.RFC3339),
	}
}

func (s *TreasuryServer) generateMonthlyReport(tenantID, month, year string) map[string]interface{} {
	return map[string]interface{}{
		"reportType":       "monthly",
		"month":            month,
		"year":             year,
		"avgLiquidity":     500000000000,
		"avgLCR":           128.5,
		"avgNSFR":          118.2,
		"totalFXVolume":    200000000000,
		"totalFXPnL":       1000000000,
		"investmentIncome": 2500000000,
		"interbankIncome":  500000000,
		"generatedAt":      time.Now().Format(time.RFC3339),
	}
}

func (s *TreasuryServer) generateRegulatoryReport(tenantID, reportType string) map[string]interface{} {
	return map[string]interface{}{
		"reportType":  reportType,
		"tenantID":    tenantID,
		"lcr":         125.5,
		"nsfr":        115.2,
		"crr":         27.5,
		"fxPosition":  "within_limit",
		"generatedAt": time.Now().Format(time.RFC3339),
	}
}
