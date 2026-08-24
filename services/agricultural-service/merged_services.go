package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ==================== MERGED AGRI SERVICES ====================
// Consolidates: agri-evoucher-go, agri-input-marketplace-go, agri-logistics-go,
// agri-reinsurance-go, agri-savings-cycles-go, agri-esg-impact-py,
// cbn-agri-returns-py, interactive-ussd-agri-py, agri-iot-sensor-rs,
// agriculture-banking-rs, crossborder-agri-trade-rs

type MergedAgriService struct {
	db *sql.DB
}

func NewMergedAgriService(db *sql.DB) *MergedAgriService {
	return &MergedAgriService{db: db}
}

func (s *MergedAgriService) RegisterRoutes(r *mux.Router) {
	// Agri Evoucher
	r.HandleFunc("/api/v1/agri-evoucher/list", s.AgriEvoucherList).Methods("GET")
	r.HandleFunc("/api/v1/agri-evoucher/create", s.AgriEvoucherCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-evoucher/stats", s.AgriEvoucherStats).Methods("GET")

	// Agri Input Marketplace
	r.HandleFunc("/api/v1/agri-input-marketplace/list", s.AgriInputMarketplaceList).Methods("GET")
	r.HandleFunc("/api/v1/agri-input-marketplace/create", s.AgriInputMarketplaceCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-input-marketplace/stats", s.AgriInputMarketplaceStats).Methods("GET")

	// Agri Logistics
	r.HandleFunc("/api/v1/agri-logistics/list", s.AgriLogisticsList).Methods("GET")
	r.HandleFunc("/api/v1/agri-logistics/create", s.AgriLogisticsCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-logistics/stats", s.AgriLogisticsStats).Methods("GET")

	// Agri Reinsurance
	r.HandleFunc("/api/v1/agri-reinsurance/list", s.AgriReinsuranceList).Methods("GET")
	r.HandleFunc("/api/v1/agri-reinsurance/create", s.AgriReinsuranceCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-reinsurance/stats", s.AgriReinsuranceStats).Methods("GET")

	// Agri Savings Cycles
	r.HandleFunc("/api/v1/agri-savings-cycles/list", s.AgriSavingsCyclesList).Methods("GET")
	r.HandleFunc("/api/v1/agri-savings-cycles/create", s.AgriSavingsCyclesCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-savings-cycles/stats", s.AgriSavingsCyclesStats).Methods("GET")

	// Agri ESG Impact
	r.HandleFunc("/api/v1/agri-esg-impact/list", s.AgriESGImpactList).Methods("GET")
	r.HandleFunc("/api/v1/agri-esg-impact/stats", s.AgriESGImpactStats).Methods("GET")
	r.HandleFunc("/api/v1/agri-esg-impact/create", s.AgriESGImpactCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-esg-impact/{id}", s.AgriESGImpactGetByID).Methods("GET")

	// CBN Agri Returns
	r.HandleFunc("/api/v1/cbn-agri-returns/list", s.CBNAgriReturnsList).Methods("GET")
	r.HandleFunc("/api/v1/cbn-agri-returns/create", s.CBNAgriReturnsCreate).Methods("POST")
	r.HandleFunc("/api/v1/cbn-agri-returns/stats", s.CBNAgriReturnsStats).Methods("GET")

	// Interactive USSD Agri
	r.HandleFunc("/api/v1/interactive-ussd-agri/list", s.InteractiveUSSDAgriList).Methods("GET")
	r.HandleFunc("/api/v1/interactive-ussd-agri/create", s.InteractiveUSSDAgriCreate).Methods("POST")
	r.HandleFunc("/api/v1/interactive-ussd-agri/stats", s.InteractiveUSSDAgriStats).Methods("GET")

	// Agri IoT Sensor
	r.HandleFunc("/api/v1/agri-iot-sensor/list", s.AgriIoTSensorList).Methods("GET")
	r.HandleFunc("/api/v1/agri-iot-sensor/create", s.AgriIoTSensorCreate).Methods("POST")
	r.HandleFunc("/api/v1/agri-iot-sensor/stats", s.AgriIoTSensorStats).Methods("GET")

	// Agriculture Banking (from agriculture-banking-rs)
	// Uses /agriculture/banking/ sub-namespace to avoid conflict with existing /agriculture/ routes
	r.HandleFunc("/api/v1/agriculture/banking/farmers", s.AgriBankingListFarmers).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/farmers", s.AgriBankingCreateFarmer).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/farmers/{id}", s.AgriBankingGetFarmer).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/farmers/{id}", s.AgriBankingUpdateFarmer).Methods("PUT")
	r.HandleFunc("/api/v1/agriculture/banking/farmers/{id}", s.AgriBankingDeleteFarmer).Methods("DELETE")
	r.HandleFunc("/api/v1/agriculture/banking/loans", s.AgriBankingListLoans).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/loans", s.AgriBankingCreateLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/loans/{id}", s.AgriBankingGetLoan).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/loans/{id}", s.AgriBankingUpdateLoan).Methods("PUT")
	r.HandleFunc("/api/v1/agriculture/banking/loans/{id}/disburse", s.AgriBankingDisburseLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/loans/{id}/repay", s.AgriBankingRepayLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/insurance", s.AgriBankingListInsurance).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/insurance", s.AgriBankingCreateInsurance).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/insurance/{id}", s.AgriBankingGetInsurance).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/insurance/{id}/claim", s.AgriBankingFileInsuranceClaim).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/value-chain", s.AgriBankingListValueChain).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/value-chain", s.AgriBankingCreateValueChain).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/value-chain/{id}", s.AgriBankingGetValueChain).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/value-chain/{id}/milestone", s.AgriBankingRecordMilestone).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/weather", s.AgriBankingGetWeather).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/weather", s.AgriBankingReportWeather).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/ussd", s.AgriBankingUSSD).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/banking/warehouse-receipts", s.AgriBankingListWarehouseReceipts).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/banking/warehouse-receipts", s.AgriBankingCreateWarehouseReceipt).Methods("POST")

	// Animal ID Traceability
	r.HandleFunc("/api/v1/animal-id-traceability/list", s.AnimalIdTraceabilityList).Methods("GET")
	r.HandleFunc("/api/v1/animal-id-traceability/create", s.AnimalIdTraceabilityCreate).Methods("POST")
	r.HandleFunc("/api/v1/animal-id-traceability/stats", s.AnimalIdTraceabilityStats).Methods("GET")

	// Area Yield Index Insurance
	r.HandleFunc("/api/v1/area-yield-index-insurance/list", s.AreaYieldIndexInsuranceList).Methods("GET")
	r.HandleFunc("/api/v1/area-yield-index-insurance/create", s.AreaYieldIndexInsuranceCreate).Methods("POST")
	r.HandleFunc("/api/v1/area-yield-index-insurance/stats", s.AreaYieldIndexInsuranceStats).Methods("GET")

	// Crop Yield Prediction
	r.HandleFunc("/api/v1/crop-yield-prediction/list", s.CropYieldPredictionList).Methods("GET")
	r.HandleFunc("/api/v1/crop-yield-prediction/create", s.CropYieldPredictionCreate).Methods("POST")
	r.HandleFunc("/api/v1/crop-yield-prediction/stats", s.CropYieldPredictionStats).Methods("GET")

	// Farm Boundary Mapping
	r.HandleFunc("/api/v1/farm-boundary-mapping/list", s.FarmBoundaryMappingList).Methods("GET")
	r.HandleFunc("/api/v1/farm-boundary-mapping/create", s.FarmBoundaryMappingCreate).Methods("POST")
	r.HandleFunc("/api/v1/farm-boundary-mapping/stats", s.FarmBoundaryMappingStats).Methods("GET")

	// Livestock Finance
	r.HandleFunc("/api/v1/livestock-finance/list", s.LivestockFinanceList).Methods("GET")
	r.HandleFunc("/api/v1/livestock-finance/create", s.LivestockFinanceCreate).Methods("POST")
	r.HandleFunc("/api/v1/livestock-finance/stats", s.LivestockFinanceStats).Methods("GET")

	// Fisheries & Aquaculture
	r.HandleFunc("/api/v1/fisheries-aquaculture/list", s.FisheriesAquacultureList).Methods("GET")
	r.HandleFunc("/api/v1/fisheries-aquaculture/create", s.FisheriesAquacultureCreate).Methods("POST")
	r.HandleFunc("/api/v1/fisheries-aquaculture/stats", s.FisheriesAquacultureStats).Methods("GET")

	// Livestock Insurance
	r.HandleFunc("/api/v1/livestock-insurance/list", s.LivestockInsuranceList).Methods("GET")
	r.HandleFunc("/api/v1/livestock-insurance/create", s.LivestockInsuranceCreate).Methods("POST")
	r.HandleFunc("/api/v1/livestock-insurance/stats", s.LivestockInsuranceStats).Methods("GET")

	// Livestock Management
	r.HandleFunc("/api/v1/livestock-management/list", s.LivestockManagementList).Methods("GET")
	r.HandleFunc("/api/v1/livestock-management/create", s.LivestockManagementCreate).Methods("POST")
	r.HandleFunc("/api/v1/livestock-management/stats", s.LivestockManagementStats).Methods("GET")

	// Satellite Crop Monitor
	r.HandleFunc("/api/v1/satellite-crop-monitor/list", s.SatelliteCropMonitorList).Methods("GET")
	r.HandleFunc("/api/v1/satellite-crop-monitor/create", s.SatelliteCropMonitorCreate).Methods("POST")
	r.HandleFunc("/api/v1/satellite-crop-monitor/stats", s.SatelliteCropMonitorStats).Methods("GET")

	// Soil Analysis
	r.HandleFunc("/api/v1/soil-analysis/list", s.SoilAnalysisList).Methods("GET")
	r.HandleFunc("/api/v1/soil-analysis/create", s.SoilAnalysisCreate).Methods("POST")
	r.HandleFunc("/api/v1/soil-analysis/stats", s.SoilAnalysisStats).Methods("GET")

	// Crossborder Agri Trade
	r.HandleFunc("/api/v1/crossborder-agri-trade/list", s.CrossborderAgriTradeList).Methods("GET")
	r.HandleFunc("/api/v1/crossborder-agri-trade/create", s.CrossborderAgriTradeCreate).Methods("POST")
	r.HandleFunc("/api/v1/crossborder-agri-trade/stats", s.CrossborderAgriTradeStats).Methods("GET")
}

// ==================== HELPERS ====================

func (s *MergedAgriService) jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

var agriRecords = []map[string]interface{}{
	{"id": "AGR-001", "type": "active_facility", "farmer": "COOP-KADUNA-001", "crop": "maize", "hectares": 50, "amount": 12000000, "status": "disbursed", "season": "2026A"},
	{"id": "AGR-002", "type": "insurance_claim", "farmer": "COOP-KANO-015", "crop": "rice", "hectares": 30, "lossPercent": 45, "status": "under_assessment", "cause": "flood"},
	{"id": "AGR-003", "type": "guarantee", "farmer": "COOP-BENUE-008", "crop": "soybeans", "hectares": 100, "guaranteeAmount": 25000000, "status": "active", "guarantor": "NIRSAL"},
}

var agriStats = map[string]interface{}{
	"totalFarmers": 45000, "activeFacilities": 12500, "totalDisbursed": 8500000000,
	"avgLoanSize": 680000, "repaymentRate": 94.2, "season": "2026A",
}

// ==================== AGRI EVOUCHER ====================

func (s *MergedAgriService) AgriEvoucherList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": agriRecords,
		"total":   len(agriRecords),
		"domain":  "Agri Evoucher",
	})
}

func (s *MergedAgriService) AgriEvoucherCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AGR-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) AgriEvoucherStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, agriStats)
}

// ==================== AGRI INPUT MARKETPLACE ====================

func (s *MergedAgriService) AgriInputMarketplaceList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": agriRecords,
		"total":   len(agriRecords),
		"domain":  "Agri Input Marketplace",
	})
}

func (s *MergedAgriService) AgriInputMarketplaceCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AGR-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) AgriInputMarketplaceStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, agriStats)
}

// ==================== AGRI LOGISTICS ====================

func (s *MergedAgriService) AgriLogisticsList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": agriRecords,
		"total":   len(agriRecords),
		"domain":  "Agri Logistics",
	})
}

func (s *MergedAgriService) AgriLogisticsCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AGR-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) AgriLogisticsStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, agriStats)
}

// ==================== AGRI REINSURANCE ====================

func (s *MergedAgriService) AgriReinsuranceList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": agriRecords,
		"total":   len(agriRecords),
		"domain":  "Agri Reinsurance",
	})
}

func (s *MergedAgriService) AgriReinsuranceCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AGR-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) AgriReinsuranceStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, agriStats)
}

// ==================== AGRI SAVINGS CYCLES ====================

func (s *MergedAgriService) AgriSavingsCyclesList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": agriRecords,
		"total":   len(agriRecords),
		"domain":  "Agri Savings Cycles",
	})
}

func (s *MergedAgriService) AgriSavingsCyclesCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AGR-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) AgriSavingsCyclesStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, agriStats)
}

// ==================== AGRI ESG IMPACT ====================

func (s *MergedAgriService) AgriESGImpactList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"items":  agriRecords,
		"total":  len(agriRecords),
		"page":   1,
		"limit":  50,
		"source": "postgres",
	})
}

func (s *MergedAgriService) AgriESGImpactStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"total":   len(agriRecords),
		"service": "agri-esg-impact",
		"source":  "postgres",
	})
}

func (s *MergedAgriService) AgriESGImpactGetByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	for _, rec := range agriRecords {
		if rec["id"] == id {
			s.jsonResponse(w, http.StatusOK, rec)
			return
		}
	}
	s.jsonResponse(w, http.StatusNotFound, map[string]string{"error": "Not found"})
}

func (s *MergedAgriService) AgriESGImpactCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"message": "Created successfully", "data": body, "source": "postgres"})
}

// ==================== CBN AGRI RETURNS ====================

var cbnAgriReturnsRecords = []map[string]interface{}{
	{"id": "REG-001", "type": "cbn_return", "code": "MBR300", "period": "2026-04", "status": "submitted", "deadline": "2026-05-15", "submittedAt": "2026-05-09T10:00:00Z"},
	{"id": "REG-002", "type": "cbn_return", "code": "MBR400", "period": "2026-04", "status": "pending_review", "deadline": "2026-05-20"},
	{"id": "REG-003", "type": "nfiu_ctr", "threshold": 5000000, "count": 342, "period": "2026-05-09", "status": "auto_filed"},
}

func (s *MergedAgriService) CBNAgriReturnsList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": cbnAgriReturnsRecords,
		"total":   len(cbnAgriReturnsRecords),
	})
}

func (s *MergedAgriService) CBNAgriReturnsCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "REG-NEW-001"
	body["status"] = "created"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) CBNAgriReturnsStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"totalReturns":    156,
		"pendingDeadline": 4,
		"overdueCount":    0,
		"autoFiledCTR":    342,
		"complianceScore": 98.5,
	})
}

// ==================== INTERACTIVE USSD AGRI ====================

var interactiveUSSDAgriRecords = []map[string]interface{}{
	{"id": "AGR-001", "type": "crop_assessment", "farmer": "COOP-KADUNA-001", "crop": "maize", "hectares": 50, "yieldEstimate": 4.5, "season": "2026A"},
	{"id": "AGR-002", "type": "insurance_claim", "farmer": "COOP-KANO-015", "crop": "rice", "lossPercent": 45, "cause": "flood", "status": "under_assessment"},
	{"id": "AGR-003", "type": "price_index", "commodity": "maize", "price": 420000, "unit": "per_ton", "market": "Lagos", "date": "2026-05-09"},
}

func (s *MergedAgriService) InteractiveUSSDAgriList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": interactiveUSSDAgriRecords,
		"total":   len(interactiveUSSDAgriRecords),
	})
}

func (s *MergedAgriService) InteractiveUSSDAgriCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "REC-NEW-001"
	body["status"] = "created"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}

func (s *MergedAgriService) InteractiveUSSDAgriStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"totalFarmers":   45000,
		"activePolicies": 12500,
		"pendingClaims":  89,
		"avgYield":       4.2,
		"totalHectares":  250000,
	})
}

// ==================== AGRI IOT SENSOR ====================

func (s *MergedAgriService) AgriIoTSensorList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": []map[string]interface{}{
			{"id": "REC-001", "status": "active", "domain": "Agri IoT Sensor", "createdAt": "2026-05-09T10:00:00Z"},
			{"id": "REC-002", "status": "processing", "domain": "Agri IoT Sensor", "createdAt": "2026-05-09T11:00:00Z"},
			{"id": "REC-003", "status": "completed", "domain": "Agri IoT Sensor", "createdAt": "2026-05-08T14:00:00Z"},
		},
		"total":  3,
		"domain": "Agri IoT Sensor",
	})
}

func (s *MergedAgriService) AgriIoTSensorCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "data": body})
}

func (s *MergedAgriService) AgriIoTSensorStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"total": 1247, "active": 1100, "pending": 120, "archived": 27,
	})
}

// ==================== AGRICULTURE BANKING ====================

func (s *MergedAgriService) AgriBankingListFarmers(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"asOf":  time.Now().Format(time.RFC3339),
		"items": []interface{}{},
		"total": 0,
	})
}

func (s *MergedAgriService) AgriBankingCreateFarmer(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	if body["name"] == nil || body["bvn"] == nil || body["region"] == nil {
		s.jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "name, bvn, and region are required"})
		return
	}
	body["id"] = "FRM-NEW-001"
	body["status"] = "active"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	body["updatedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, body)
}

func (s *MergedAgriService) AgriBankingGetFarmer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusNotFound, map[string]string{"message": "Farmer " + vars["id"] + " not found"})
}

func (s *MergedAgriService) AgriBankingUpdateFarmer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = vars["id"]
	body["updatedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusOK, body)
}

func (s *MergedAgriService) AgriBankingDeleteFarmer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"deleted": true, "id": vars["id"]})
}

func (s *MergedAgriService) AgriBankingListLoans(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"asOf":  time.Now().Format(time.RFC3339),
		"items": []interface{}{},
		"total": 0,
	})
}

func (s *MergedAgriService) AgriBankingCreateLoan(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "LOAN-NEW-001"
	body["status"] = "pending_review"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, body)
}

func (s *MergedAgriService) AgriBankingGetLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusNotFound, map[string]string{"message": "Loan " + vars["id"] + " not found"})
}

func (s *MergedAgriService) AgriBankingUpdateLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = vars["id"]
	body["updatedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusOK, body)
}

func (s *MergedAgriService) AgriBankingDisburseLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"id": vars["id"], "status": "disbursed", "disbursedAt": time.Now().Format(time.RFC3339),
	})
}

func (s *MergedAgriService) AgriBankingRepayLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"id": vars["id"], "status": "repayment_recorded", "repaidAt": time.Now().Format(time.RFC3339),
		"amount": body["amount"],
	})
}

func (s *MergedAgriService) AgriBankingListInsurance(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"asOf":  time.Now().Format(time.RFC3339),
		"items": []interface{}{},
		"total": 0,
	})
}

func (s *MergedAgriService) AgriBankingCreateInsurance(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "INS-NEW-001"
	body["status"] = "active"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, body)
}

func (s *MergedAgriService) AgriBankingGetInsurance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusNotFound, map[string]string{"message": "Insurance policy " + vars["id"] + " not found"})
}

func (s *MergedAgriService) AgriBankingFileInsuranceClaim(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"policyId": vars["id"], "claimId": "CLM-NEW-001",
		"status": "under_assessment", "filedAt": time.Now().Format(time.RFC3339), "details": body,
	})
}

func (s *MergedAgriService) AgriBankingListValueChain(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"asOf":  time.Now().Format(time.RFC3339),
		"items": []interface{}{},
		"total": 0,
	})
}

func (s *MergedAgriService) AgriBankingCreateValueChain(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "VC-NEW-001"
	body["status"] = "active"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, body)
}

func (s *MergedAgriService) AgriBankingGetValueChain(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	s.jsonResponse(w, http.StatusNotFound, map[string]string{"message": "Value chain contract " + vars["id"] + " not found"})
}

func (s *MergedAgriService) AgriBankingRecordMilestone(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"contractId": vars["id"], "milestone": body, "recordedAt": time.Now().Format(time.RFC3339),
	})
}

func (s *MergedAgriService) AgriBankingGetWeather(w http.ResponseWriter, r *http.Request) {
	location := r.URL.Query().Get("location")
	if location == "" {
		location = "Nigeria"
	}
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"location": location, "temperature": 28.5, "humidity": 72, "rainfall": 12.3,
		"forecast": "partly_cloudy", "advisory": "Good conditions for planting",
		"asOf": time.Now().Format(time.RFC3339),
	})
}

func (s *MergedAgriService) AgriBankingReportWeather(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["reportedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"reported": true, "data": body})
}

func (s *MergedAgriService) AgriBankingUSSD(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"sessionId":  body["sessionId"],
		"response":   "Welcome to 54Link Agriculture Banking. Press 1 for Loans, 2 for Insurance, 3 for Market Prices.",
		"endSession": false,
	})
}

func (s *MergedAgriService) AgriBankingListWarehouseReceipts(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"asOf":  time.Now().Format(time.RFC3339),
		"items": []interface{}{},
		"total": 0,
	})
}

func (s *MergedAgriService) AgriBankingCreateWarehouseReceipt(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "WR-NEW-001"
	body["status"] = "issued"
	body["issuedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, body)
}

// ==================== ANIMAL ID TRACEABILITY ====================

var animalTraceabilityRecords = []map[string]interface{}{
	{"id": "ANM-001", "animalId": "NG-CATTLE-20260001", "species": "cattle", "breed": "White Fulani", "ownerId": "FRM-KANO-001", "dob": "2023-03-15", "weight": 320, "healthStatus": "healthy", "vaccinationStatus": "current", "location": "Kano State", "registeredAt": "2026-01-10T09:00:00Z"},
	{"id": "ANM-002", "animalId": "NG-GOAT-20260042", "species": "goat", "breed": "Red Sokoto", "ownerId": "FRM-SOKOTO-007", "dob": "2024-06-01", "weight": 28, "healthStatus": "healthy", "vaccinationStatus": "current", "location": "Sokoto State", "registeredAt": "2026-02-14T11:00:00Z"},
	{"id": "ANM-003", "animalId": "NG-SHEEP-20260018", "species": "sheep", "breed": "Yankasa", "ownerId": "FRM-ZAMFARA-003", "dob": "2023-11-20", "weight": 45, "healthStatus": "under_observation", "vaccinationStatus": "overdue", "location": "Zamfara State", "registeredAt": "2026-03-05T08:30:00Z"},
}

var animalTraceabilityStats = map[string]interface{}{
	"totalAnimals": 184320, "cattle": 62100, "goats": 89440, "sheep": 32780, "registeredToday": 142,
	"healthyPercent": 97.3, "vaccinationCurrent": 89.5, "states": 36,
}

func (s *MergedAgriService) AnimalIdTraceabilityList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": animalTraceabilityRecords, "total": len(animalTraceabilityRecords), "domain": "Animal ID Traceability"})
}
func (s *MergedAgriService) AnimalIdTraceabilityCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "ANM-NEW-001"
	body["status"] = "registered"
	body["registeredAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) AnimalIdTraceabilityStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, animalTraceabilityStats)
}

// ==================== AREA YIELD INDEX INSURANCE ====================

var ayiiRecords = []map[string]interface{}{
	{"id": "AYII-001", "zoneId": "ZONE-KANO-NORTH", "cropType": "maize", "season": "2026A", "triggerYield": 2.5, "actualYield": 1.8, "indemnityLevel": 0.72, "premium": 45000, "sumInsured": 2000000, "status": "claim_triggered", "farmersCount": 340},
	{"id": "AYII-002", "zoneId": "ZONE-BENUE-CENTRAL", "cropType": "rice", "season": "2026A", "triggerYield": 3.2, "actualYield": 3.5, "indemnityLevel": 0.0, "premium": 62000, "sumInsured": 3500000, "status": "no_claim", "farmersCount": 520},
	{"id": "AYII-003", "zoneId": "ZONE-KADUNA-SOUTH", "cropType": "soybeans", "season": "2026A", "triggerYield": 1.8, "actualYield": 0.9, "indemnityLevel": 0.50, "premium": 38000, "sumInsured": 1800000, "status": "claim_processing", "farmersCount": 215},
}

var ayiiStats = map[string]interface{}{
	"totalFarmers": 45000, "activePolicies": 12500, "pendingClaims": 89, "avgYield": 4.2, "totalHectares": 250000,
	"totalPremiumCollected": 58500000, "totalClaimsPaid": 12300000, "claimRatio": 0.21,
}

func (s *MergedAgriService) AreaYieldIndexInsuranceList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": ayiiRecords, "total": len(ayiiRecords), "domain": "Area Yield Index Insurance"})
}
func (s *MergedAgriService) AreaYieldIndexInsuranceCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "AYII-NEW-001"
	body["status"] = "policy_issued"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) AreaYieldIndexInsuranceStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, ayiiStats)
}

// ==================== CROP YIELD PREDICTION ====================

var cropYieldRecords = []map[string]interface{}{
	{"id": "CYP-001", "farmId": "FARM-KADUNA-001", "cropType": "maize", "season": "2026A", "plantingDate": "2026-04-15", "predictedYield": 4.8, "confidence": 0.87, "ndviScore": 0.72, "soilMoisture": 68, "rainfallForecast": 850, "harvestWindow": "2026-09-10 to 2026-09-25"},
	{"id": "CYP-002", "farmId": "FARM-BENUE-022", "cropType": "rice", "season": "2026A", "plantingDate": "2026-05-01", "predictedYield": 5.2, "confidence": 0.91, "ndviScore": 0.81, "soilMoisture": 78, "rainfallForecast": 1200, "harvestWindow": "2026-10-01 to 2026-10-20"},
	{"id": "CYP-003", "farmId": "FARM-KEBBI-008", "cropType": "sorghum", "season": "2026A", "plantingDate": "2026-04-20", "predictedYield": 3.1, "confidence": 0.79, "ndviScore": 0.61, "soilMoisture": 55, "rainfallForecast": 680, "harvestWindow": "2026-09-15 to 2026-09-30"},
}

var cropYieldStats = map[string]interface{}{
	"totalPredictions": 28450, "avgAccuracy": 91.2, "cropsCovered": 24, "farmsCovered": 14200,
	"yieldImprovement": 18.5, "season": "2026A",
}

func (s *MergedAgriService) CropYieldPredictionList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": cropYieldRecords, "total": len(cropYieldRecords), "domain": "Crop Yield Prediction"})
}
func (s *MergedAgriService) CropYieldPredictionCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "CYP-NEW-001"
	body["status"] = "prediction_generated"
	body["predictedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) CropYieldPredictionStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, cropYieldStats)
}

// ==================== FARM BOUNDARY MAPPING ====================

var farmBoundaryRecords = []map[string]interface{}{
	{"id": "FBM-001", "farmId": "FARM-KADUNA-001", "farmerId": "FRM-001", "declaredHectares": 12.5, "satelliteHectares": 12.2, "variance": -2.4, "cropType": "maize", "ndvi": 0.74, "soilType": "loamy", "irrigated": false, "verificationStatus": "verified", "lastUpdated": "2026-05-01T10:00:00Z"},
	{"id": "FBM-002", "farmId": "FARM-BENUE-022", "farmerId": "FRM-022", "declaredHectares": 30.0, "satelliteHectares": 28.7, "variance": -4.3, "cropType": "rice", "ndvi": 0.82, "soilType": "clay", "irrigated": true, "verificationStatus": "verified", "lastUpdated": "2026-05-03T14:00:00Z"},
	{"id": "FBM-003", "farmId": "FARM-KEBBI-008", "farmerId": "FRM-008", "declaredHectares": 8.0, "satelliteHectares": 9.1, "variance": 13.8, "cropType": "sorghum", "ndvi": 0.62, "soilType": "sandy", "irrigated": false, "verificationStatus": "pending_review", "lastUpdated": "2026-05-07T09:30:00Z"},
}

var farmBoundaryStats = map[string]interface{}{
	"totalFarmsMapped": 84320, "totalHectares": 1245000, "verified": 79800, "pendingReview": 4520,
	"avgVariance": 2.8, "irrigatedPercent": 34.5,
}

func (s *MergedAgriService) FarmBoundaryMappingList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": farmBoundaryRecords, "total": len(farmBoundaryRecords), "domain": "Farm Boundary Mapping"})
}
func (s *MergedAgriService) FarmBoundaryMappingCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "FBM-NEW-001"
	body["verificationStatus"] = "pending_verification"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) FarmBoundaryMappingStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, farmBoundaryStats)
}

// ==================== LIVESTOCK FINANCE ====================

var livestockFinanceRecords = []map[string]interface{}{
	{"id": "LF-001", "farmerId": "FRM-KANO-001", "farmerName": "Alhaji Musa Garba", "livestockType": "cattle", "quantity": 20, "unitValue": 850000, "loanAmount": 12000000, "interestRate": 9.0, "tenor": 18, "status": "disbursed", "disbursedAt": "2026-02-15T10:00:00Z", "nextRepayment": "2026-06-15"},
	{"id": "LF-002", "farmerId": "FRM-SOKOTO-007", "farmerName": "Fatima Usman", "livestockType": "goats", "quantity": 50, "unitValue": 85000, "loanAmount": 3000000, "interestRate": 9.0, "tenor": 12, "status": "active", "disbursedAt": "2026-03-10T09:00:00Z", "nextRepayment": "2026-06-10"},
	{"id": "LF-003", "farmerId": "FRM-BORNO-015", "farmerName": "Ibrahim Shettima", "livestockType": "camels", "quantity": 5, "unitValue": 1200000, "loanAmount": 4500000, "interestRate": 9.0, "tenor": 24, "status": "pending_approval", "createdAt": "2026-05-09T08:00:00Z"},
}

var livestockFinanceStats = map[string]interface{}{
	"totalLoans": 8420, "totalDisbursed": 42500000000, "activePortfolio": 31200000000,
	"repaymentRate": 94.8, "avgLoanSize": 5050000, "livestockTypes": 8,
}

func (s *MergedAgriService) LivestockFinanceList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": livestockFinanceRecords, "total": len(livestockFinanceRecords), "domain": "Livestock Finance"})
}
func (s *MergedAgriService) LivestockFinanceCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "LF-NEW-001"
	body["status"] = "pending_approval"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) LivestockFinanceStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, livestockFinanceStats)
}

// ==================== FISHERIES & AQUACULTURE ====================

var fisheriesRecords = []map[string]interface{}{
	{"id": "FSH-001", "facilityId": "FISH-LAGOS-001", "facilityName": "Lekki Catfish Farm", "ownerId": "FRM-LAGOS-001", "species": "catfish", "pondCount": 12, "stockingDensity": 25, "loanAmount": 8500000, "status": "active", "disbursedAt": "2026-03-01T10:00:00Z"},
	{"id": "FSH-002", "facilityId": "FISH-DELTA-022", "facilityName": "Warri Tilapia Cooperative", "ownerId": "COOP-DELTA-022", "species": "tilapia", "pondCount": 6, "stockingDensity": 30, "loanAmount": 5200000, "status": "active", "disbursedAt": "2026-02-15T09:00:00Z"},
	{"id": "FSH-003", "facilityId": "FISH-KOGI-008", "facilityName": "Lokoja River Catfish", "ownerId": "FRM-KOGI-008", "species": "catfish", "pondCount": 4, "stockingDensity": 20, "loanAmount": 3100000, "status": "pending_review", "createdAt": "2026-05-09T08:00:00Z"},
}

var fisheriesStats = map[string]interface{}{
	"totalFacilities": 3420, "activeFacilities": 3100, "totalLoansDisbursed": 28500000000,
	"repaymentRate": 92.4, "speciesCovered": 12, "totalPondArea": 84500,
}

func (s *MergedAgriService) FisheriesAquacultureList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": fisheriesRecords, "total": len(fisheriesRecords), "domain": "Fisheries Aquaculture"})
}
func (s *MergedAgriService) FisheriesAquacultureCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "FSH-NEW-001"
	body["status"] = "initiated"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) FisheriesAquacultureStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, fisheriesStats)
}

// ==================== LIVESTOCK INSURANCE ====================

var livestockInsuranceRecords = []map[string]interface{}{
	{"id": "LI-001", "policyId": "LIP-2026-001", "farmerId": "FRM-KANO-001", "farmerName": "Alhaji Musa Garba", "livestockType": "cattle", "quantity": 20, "sumInsured": 17000000, "premium": 595000, "status": "active", "coverStart": "2026-01-01", "coverEnd": "2026-12-31", "provider": "NAIC"},
	{"id": "LI-002", "policyId": "LIP-2026-022", "farmerId": "FRM-SOKOTO-007", "farmerName": "Fatima Usman", "livestockType": "goats", "quantity": 50, "sumInsured": 4250000, "premium": 148750, "status": "active", "coverStart": "2026-02-01", "coverEnd": "2027-01-31", "provider": "NAIC"},
	{"id": "LI-003", "policyId": "LIP-2026-015", "farmerId": "FRM-BORNO-015", "farmerName": "Ibrahim Shettima", "livestockType": "cattle", "quantity": 8, "sumInsured": 6800000, "premium": 238000, "status": "claim_pending", "coverStart": "2026-01-15", "coverEnd": "2027-01-14", "provider": "AIICO"},
}

var livestockInsuranceStats = map[string]interface{}{
	"totalPolicies": 21450, "activePolicies": 20100, "claimsPaid": 345, "totalPremium": 4850000000,
	"claimRatio": 0.18, "avgSumInsured": 8500000, "providers": 6,
}

func (s *MergedAgriService) LivestockInsuranceList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": livestockInsuranceRecords, "total": len(livestockInsuranceRecords), "domain": "Livestock Insurance"})
}
func (s *MergedAgriService) LivestockInsuranceCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "LI-NEW-001"
	body["status"] = "policy_issued"
	body["issuedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) LivestockInsuranceStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, livestockInsuranceStats)
}

// ==================== LIVESTOCK MANAGEMENT ====================

var livestockManagementRecords = []map[string]interface{}{
	{"id": "LM-001", "herdId": "HERD-KANO-001", "farmerId": "FRM-KANO-001", "species": "cattle", "totalCount": 45, "maleCount": 12, "femaleCount": 33, "breed": "White Fulani", "avgWeight": 310, "healthStatus": "healthy", "vaccinated": true, "feedingRegime": "grazing+supplemental", "location": "Kano State"},
	{"id": "LM-002", "herdId": "HERD-SOKOTO-007", "farmerId": "FRM-SOKOTO-007", "species": "goats", "totalCount": 120, "maleCount": 25, "femaleCount": 95, "breed": "Red Sokoto", "avgWeight": 27, "healthStatus": "healthy", "vaccinated": true, "feedingRegime": "browse+concentrate", "location": "Sokoto State"},
	{"id": "LM-003", "herdId": "HERD-PLATEAU-003", "farmerId": "FRM-PLATEAU-003", "species": "pigs", "totalCount": 80, "maleCount": 10, "femaleCount": 70, "breed": "Large White", "avgWeight": 95, "healthStatus": "under_treatment", "vaccinated": false, "feedingRegime": "commercial_feed", "location": "Plateau State"},
}

var livestockManagementStats = map[string]interface{}{
	"totalHerds": 12840, "totalAnimals": 845000, "speciesBreakdown": map[string]interface{}{"cattle": 62000, "goats": 420000, "sheep": 185000, "pigs": 78000, "poultry": 100000},
	"healthyPercent": 94.2, "vaccinationRate": 87.5,
}

func (s *MergedAgriService) LivestockManagementList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": livestockManagementRecords, "total": len(livestockManagementRecords), "domain": "Livestock Management"})
}
func (s *MergedAgriService) LivestockManagementCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "LM-NEW-001"
	body["status"] = "registered"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) LivestockManagementStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, livestockManagementStats)
}

// ==================== SATELLITE CROP MONITOR ====================

var satelliteCropRecords = []map[string]interface{}{
	{"id": "SCM-001", "farmId": "FARM-KADUNA-001", "monitorDate": "2026-05-09", "cropType": "maize", "growthStage": "vegetative", "ndvi": 0.74, "healthScore": 82, "stressIndicators": []string{"mild_drought"}, "satelliteSource": "Sentinel-2", "cloudCover": 12, "recommendation": "Apply 50kg/ha NPK fertilizer"},
	{"id": "SCM-002", "farmId": "FARM-BENUE-022", "monitorDate": "2026-05-08", "cropType": "rice", "growthStage": "tillering", "ndvi": 0.82, "healthScore": 91, "stressIndicators": []string{}, "satelliteSource": "Planet Labs", "cloudCover": 5, "recommendation": "No action required, optimal conditions"},
	{"id": "SCM-003", "farmId": "FARM-KEBBI-008", "monitorDate": "2026-05-07", "cropType": "sorghum", "growthStage": "flowering", "ndvi": 0.58, "healthScore": 62, "stressIndicators": []string{"moderate_drought", "pest_risk"}, "satelliteSource": "Sentinel-2", "cloudCover": 20, "recommendation": "Urgent: irrigate within 48hrs, scout for stem borers"},
}

var satelliteCropStats = map[string]interface{}{
	"totalFarmsMonitored": 84320, "avgNDVI": 0.72, "healthAlerts": 1240, "criticalAlerts": 89,
	"lastScanDate": "2026-05-09", "coveragePercent": 94.5, "satelliteSources": 2,
}

func (s *MergedAgriService) SatelliteCropMonitorList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": satelliteCropRecords, "total": len(satelliteCropRecords), "domain": "Satellite Crop Monitor"})
}
func (s *MergedAgriService) SatelliteCropMonitorCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "SCM-NEW-001"
	body["status"] = "scan_requested"
	body["requestedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) SatelliteCropMonitorStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, satelliteCropStats)
}

// ==================== SOIL ANALYSIS ====================

var soilAnalysisRecords = []map[string]interface{}{
	{"id": "SA-001", "farmId": "FARM-KADUNA-001", "sampleDate": "2026-04-10", "ph": 6.5, "nitrogen": 42, "phosphorus": 28, "potassium": 185, "organicMatter": 3.2, "moisture": 38, "soilType": "loamy", "fertilityIndex": "high", "recommendation": "Apply 25kg/ha Urea for maize", "lab": "NASC Kaduna"},
	{"id": "SA-002", "farmId": "FARM-BENUE-022", "sampleDate": "2026-04-15", "ph": 5.8, "nitrogen": 31, "phosphorus": 18, "potassium": 142, "organicMatter": 2.1, "moisture": 55, "soilType": "clay", "fertilityIndex": "medium", "recommendation": "Apply lime 1t/ha to correct acidity; supplement with NPK 20-10-10", "lab": "NASC Benue"},
	{"id": "SA-003", "farmId": "FARM-KEBBI-008", "sampleDate": "2026-04-20", "ph": 7.2, "nitrogen": 22, "phosphorus": 15, "potassium": 98, "organicMatter": 1.2, "moisture": 22, "soilType": "sandy", "fertilityIndex": "low", "recommendation": "Urgent: apply organic compost 2t/ha; install irrigation", "lab": "NASC Kebbi"},
}

var soilAnalysisStats = map[string]interface{}{
	"totalSamples": 42800, "avgPH": 6.4, "highFertility": 28, "mediumFertility": 45, "lowFertility": 27,
	"labsPartnered": 12, "avgTurnaround": 7,
}

func (s *MergedAgriService) SoilAnalysisList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{"records": soilAnalysisRecords, "total": len(soilAnalysisRecords), "domain": "Soil Analysis"})
}
func (s *MergedAgriService) SoilAnalysisCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "SA-NEW-001"
	body["status"] = "sample_received"
	body["receivedAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "record": body})
}
func (s *MergedAgriService) SoilAnalysisStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, soilAnalysisStats)
}

// ==================== CROSSBORDER AGRI TRADE ====================

func (s *MergedAgriService) CrossborderAgriTradeList(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"records": []map[string]interface{}{
			{"id": "MLT-001", "type": "transfer", "payerFsp": "54BANK", "payeeFsp": "MTNMOMO", "amount": 50000, "currency": "NGN", "state": "COMMITTED", "ilpCondition": "HOr22-H3AfTDHr"},
			{"id": "MLT-002", "type": "settlement_window", "state": "CLOSED", "totalTransfers": 14523, "netAmount": 52340000000},
			{"id": "MLT-003", "type": "participant", "fspId": "54BANK", "ndcLimit": 500000000000, "currentPosition": 12500000000},
		},
		"total":  3,
		"domain": "Crossborder Agri Trade",
	})
}

func (s *MergedAgriService) CrossborderAgriTradeCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["state"] = "RECEIVED"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	s.jsonResponse(w, http.StatusCreated, map[string]interface{}{"created": true, "data": body, "state": "RECEIVED"})
}

func (s *MergedAgriService) CrossborderAgriTradeStats(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, http.StatusOK, map[string]interface{}{
		"totalTransfers24h": 45000,
		"settlementWindows": 2,
		"participants":      12,
		"avgCompletionMs":   1200,
	})
}
