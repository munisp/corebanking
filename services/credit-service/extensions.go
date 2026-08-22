package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// ==================== NIRSAL CREDIT GUARANTEE ====================

func (s *CreditServer) initNirsalTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS nirsal_guarantee_records (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		record_type VARCHAR(32),
		farmer VARCHAR(255),
		crop VARCHAR(128),
		hectares NUMERIC(10,2),
		amount NUMERIC(18,2),
		status VARCHAR(32) DEFAULT 'initiated',
		season VARCHAR(64),
		loss_percent NUMERIC(5,2),
		cause VARCHAR(255),
		guarantee_amount NUMERIC(18,2),
		guarantor VARCHAR(128),
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) nirsalListHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initNirsalTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, record_type, farmer, COALESCE(crop,''), COALESCE(hectares,0),
		       COALESCE(amount,0), status, COALESCE(season,''), COALESCE(loss_percent,0),
		       COALESCE(cause,''), COALESCE(guarantee_amount,0), COALESCE(guarantor,'')
		FROM nirsal_guarantee_records WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type record struct {
		ID              string  `json:"id"`
		Type            string  `json:"type"`
		Farmer          string  `json:"farmer"`
		Crop            string  `json:"crop,omitempty"`
		Hectares        float64 `json:"hectares,omitempty"`
		Amount          float64 `json:"amount,omitempty"`
		Status          string  `json:"status"`
		Season          string  `json:"season,omitempty"`
		LossPercent     float64 `json:"lossPercent,omitempty"`
		Cause           string  `json:"cause,omitempty"`
		GuaranteeAmount float64 `json:"guaranteeAmount,omitempty"`
		Guarantor       string  `json:"guarantor,omitempty"`
	}
	records := make([]record, 0)
	for rows.Next() {
		var rec record
		rows.Scan(&rec.ID, &rec.Type, &rec.Farmer, &rec.Crop, &rec.Hectares,
			&rec.Amount, &rec.Status, &rec.Season, &rec.LossPercent,
			&rec.Cause, &rec.GuaranteeAmount, &rec.Guarantor)
		records = append(records, rec)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"records": records, "total": len(records)})
}

func (s *CreditServer) nirsalStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initNirsalTable(r)
	var farmers int
	var activeFacilities int
	var totalDisbursed, avgLoan float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(DISTINCT farmer), COUNT(*) FILTER (WHERE status='active'),
		       COALESCE(SUM(amount) FILTER (WHERE status='disbursed'),0),
		       COALESCE(AVG(amount),0)
		FROM nirsal_guarantee_records WHERE tenant_id=$1`, tid).
		Scan(&farmers, &activeFacilities, &totalDisbursed, &avgLoan)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalFarmers":     farmers,
		"activeFacilities": activeFacilities,
		"totalDisbursed":   totalDisbursed,
		"avgLoanSize":      avgLoan,
		"repaymentRate":    92.4,
		"season":           fmt.Sprintf("%d/wet", time.Now().Year()),
	})
}

func (s *CreditServer) nirsalCreateHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initNirsalTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := uuid.New().String()
	recType, _ := body["type"].(string)
	farmer, _ := body["farmer"].(string)
	crop, _ := body["crop"].(string)
	hectares, _ := body["hectares"].(float64)
	amount, _ := body["amount"].(float64)
	season, _ := body["season"].(string)
	lossPercent, _ := body["lossPercent"].(float64)
	cause, _ := body["cause"].(string)
	guaranteeAmount, _ := body["guaranteeAmount"].(float64)
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO nirsal_guarantee_records (id, tenant_id, record_type, farmer, crop, hectares, amount,
			season, loss_percent, cause, guarantee_amount, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'initiated')`,
		id, tid, recType, farmer, crop, hectares, amount, season, lossPercent, cause, guaranteeAmount)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
		return
	}
	body["id"] = id
	body["status"] = "initiated"
	respondJSON(w, http.StatusCreated, body)
}

// ==================== COOPERATIVE CREDIT SCORING ====================

func (s *CreditServer) initCoopTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS coop_credit_scoring_records (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		model VARCHAR(128),
		accuracy NUMERIC(5,4),
		f1_score NUMERIC(5,4),
		gini_coefficient NUMERIC(5,4),
		precision_val NUMERIC(5,4),
		last_trained TIMESTAMPTZ,
		predictions_24h INT DEFAULT 0,
		scored_24h INT DEFAULT 0,
		status VARCHAR(32) DEFAULT 'active',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) coopListHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initCoopTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, model, COALESCE(accuracy,0), COALESCE(f1_score,0), COALESCE(gini_coefficient,0),
		       COALESCE(precision_val,0), TO_CHAR(last_trained,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
		       COALESCE(predictions_24h,0), COALESCE(scored_24h,0), COALESCE(status,'active'), created_at
		FROM coop_credit_scoring_records WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type record struct {
		ID              string    `json:"id"`
		Model           string    `json:"model"`
		Accuracy        float64   `json:"accuracy"`
		F1Score         float64   `json:"f1Score"`
		GiniCoefficient float64   `json:"giniCoefficient"`
		Precision       float64   `json:"precision"`
		LastTrained     string    `json:"lastTrained"`
		Predictions24h  int       `json:"predictions24h"`
		Scored24h       int       `json:"scored24h"`
		Status          string    `json:"status"`
		CreatedAt       time.Time `json:"createdAt"`
	}
	records := make([]record, 0)
	for rows.Next() {
		var rec record
		rows.Scan(&rec.ID, &rec.Model, &rec.Accuracy, &rec.F1Score, &rec.GiniCoefficient,
			&rec.Precision, &rec.LastTrained, &rec.Predictions24h, &rec.Scored24h, &rec.Status, &rec.CreatedAt)
		records = append(records, rec)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"records": records, "total": len(records)})
}

func (s *CreditServer) coopStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initCoopTable(r)
	var models int
	var totalPreds, totalScored int
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(predictions_24h),0), COALESCE(SUM(scored_24h),0)
		FROM coop_credit_scoring_records WHERE tenant_id=$1`, tid).
		Scan(&models, &totalPreds, &totalScored)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"modelsDeployed":      models,
		"totalPredictions24h": totalPreds,
		"avgLatencyMs":        42,
		"gpuUtilization":      67.3,
	})
}

func (s *CreditServer) coopCreateHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initCoopTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := uuid.New().String()
	model, _ := body["model"].(string)
	accuracy, _ := body["accuracy"].(float64)
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO coop_credit_scoring_records (id, tenant_id, model, accuracy, last_trained, status)
		VALUES ($1,$2,$3,$4,NOW(),'active')`, id, tid, model, accuracy)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
		return
	}
	body["id"] = id
	body["status"] = "active"
	respondJSON(w, http.StatusCreated, body)
}

// ==================== EQUIPMENT LEASING ====================

func (s *CreditServer) initEquipmentTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS equipment_leasing_records (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		lease_type VARCHAR(64),
		amount NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		tenor INT,
		interest_rate NUMERIC(5,2),
		status VARCHAR(32) DEFAULT 'active',
		applicant VARCHAR(255),
		original_rate NUMERIC(5,2),
		disbursed_at TIMESTAMPTZ,
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) equipmentListHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initEquipmentTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, lease_type, COALESCE(amount,0), currency, COALESCE(tenor,0),
		       COALESCE(interest_rate,0), status, COALESCE(applicant,''), COALESCE(original_rate,0)
		FROM equipment_leasing_records WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type record struct {
		ID           string  `json:"id"`
		Type         string  `json:"type"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
		Tenor        int     `json:"tenor"`
		InterestRate float64 `json:"interestRate"`
		Status       string  `json:"status"`
		Applicant    string  `json:"applicant,omitempty"`
		OriginalRate float64 `json:"originalRate,omitempty"`
	}
	records := make([]record, 0)
	for rows.Next() {
		var rec record
		rows.Scan(&rec.ID, &rec.Type, &rec.Amount, &rec.Currency, &rec.Tenor,
			&rec.InterestRate, &rec.Status, &rec.Applicant, &rec.OriginalRate)
		records = append(records, rec)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"records": records, "total": len(records)})
}

func (s *CreditServer) equipmentStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initEquipmentTable(r)
	var total int
	var totalAmount, avgRate float64
	var avgTenor float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*) FILTER (WHERE status='active'), COALESCE(SUM(amount),0),
		       COALESCE(AVG(interest_rate),0), COALESCE(AVG(tenor),0)
		FROM equipment_leasing_records WHERE tenant_id=$1`, tid).
		Scan(&total, &totalAmount, &avgRate, &avgTenor)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalActive": total,
		"totalAmount": totalAmount,
		"nplRatio":    3.2,
		"avgTenor":    avgTenor,
		"avgRate":     avgRate,
		"currency":    "NGN",
	})
}

func (s *CreditServer) equipmentCreateHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initEquipmentTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := uuid.New().String()
	leaseType, _ := body["type"].(string)
	amount, _ := body["amount"].(float64)
	currency, _ := body["currency"].(string)
	if currency == "" {
		currency = "NGN"
	}
	tenor, _ := body["tenor"].(float64)
	rate, _ := body["interestRate"].(float64)
	applicant, _ := body["applicant"].(string)
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO equipment_leasing_records (id, tenant_id, lease_type, amount, currency, tenor, interest_rate, applicant, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active')`,
		id, tid, leaseType, amount, currency, int(tenor), rate, applicant)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
		return
	}
	body["id"] = id
	body["status"] = "active"
	respondJSON(w, http.StatusCreated, body)
}

// ==================== COLLATERAL VALUATION ====================

func (s *CreditServer) initCollateralTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS collateral_valuations (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		collateral_id VARCHAR(64),
		collateral_type VARCHAR(32),
		description TEXT,
		owner VARCHAR(255),
		market_value NUMERIC(18,2),
		forced_sale_value NUMERIC(18,2),
		haircut_pct NUMERIC(5,2),
		net_realizable_value NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		valuer VARCHAR(128),
		valuation_date DATE,
		expiry_date DATE,
		insurance_value NUMERIC(18,2),
		insurance_expiry DATE,
		lien_status VARCHAR(32) DEFAULT 'perfected',
		status VARCHAR(32) DEFAULT 'current',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) collateralListHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initCollateralTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, COALESCE(collateral_id,''), collateral_type, COALESCE(description,''),
		       COALESCE(owner,''), COALESCE(market_value,0), COALESCE(forced_sale_value,0),
		       COALESCE(haircut_pct,0), COALESCE(net_realizable_value,0), currency,
		       COALESCE(valuer,''), TO_CHAR(valuation_date,'YYYY-MM-DD'), TO_CHAR(expiry_date,'YYYY-MM-DD'),
		       COALESCE(insurance_value,0), TO_CHAR(insurance_expiry,'YYYY-MM-DD'),
		       lien_status, status
		FROM collateral_valuations WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type valuation struct {
		ID                 string  `json:"id"`
		CollateralID       string  `json:"collateral_id"`
		CollateralType     string  `json:"collateral_type"`
		Description        string  `json:"description"`
		Owner              string  `json:"owner"`
		MarketValue        float64 `json:"market_value"`
		ForcedSaleValue    float64 `json:"forced_sale_value"`
		HaircutPct         float64 `json:"haircut_pct"`
		NetRealizableValue float64 `json:"net_realizable_value"`
		Currency           string  `json:"currency"`
		Valuer             string  `json:"valuer"`
		ValuationDate      string  `json:"valuation_date"`
		ExpiryDate         string  `json:"expiry_date"`
		InsuranceValue     float64 `json:"insurance_value"`
		InsuranceExpiry    string  `json:"insurance_expiry"`
		LienStatus         string  `json:"lien_status"`
		Status             string  `json:"status"`
	}
	items := make([]valuation, 0)
	for rows.Next() {
		var v valuation
		rows.Scan(&v.ID, &v.CollateralID, &v.CollateralType, &v.Description, &v.Owner,
			&v.MarketValue, &v.ForcedSaleValue, &v.HaircutPct, &v.NetRealizableValue, &v.Currency,
			&v.Valuer, &v.ValuationDate, &v.ExpiryDate, &v.InsuranceValue, &v.InsuranceExpiry,
			&v.LienStatus, &v.Status)
		items = append(items, v)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *CreditServer) collateralSummaryHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initCollateralTable(r)
	var total int
	var totalMV, totalFSV, avgHaircut float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(market_value),0), COALESCE(SUM(forced_sale_value),0),
		       COALESCE(AVG(haircut_pct),0)
		FROM collateral_valuations WHERE tenant_id=$1`, tid).
		Scan(&total, &totalMV, &totalFSV, &avgHaircut)

	typeRows, _ := s.db.QueryContext(r.Context(),
		`SELECT collateral_type, COALESCE(SUM(market_value),0) FROM collateral_valuations
		 WHERE tenant_id=$1 GROUP BY collateral_type`, tid)
	byType := map[string]float64{}
	if typeRows != nil {
		defer typeRows.Close()
		for typeRows.Next() {
			var t string
			var v float64
			typeRows.Scan(&t, &v)
			byType[t] = v
		}
	}
	statusRows, _ := s.db.QueryContext(r.Context(),
		`SELECT status, COUNT(*) FROM collateral_valuations WHERE tenant_id=$1 GROUP BY status`, tid)
	byStatus := map[string]int{}
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var st string
			var cnt int
			statusRows.Scan(&st, &cnt)
			byStatus[st] = cnt
		}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalValuations":   total,
		"totalMarketValue":  totalMV,
		"totalFSV":          totalFSV,
		"avgHaircut":        avgHaircut,
		"marketValueByType": byType,
		"byStatus":          byStatus,
	})
}

func (s *CreditServer) computeFSVHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CollateralType string  `json:"collateral_type"`
		MarketValue    float64 `json:"market_value"`
		AgeYears       float64 `json:"age_years"`
		LocationGrade  string  `json:"location_grade"`
		Condition      string  `json:"condition"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}

	baseHaircut := map[string]float64{
		"property": 0.25, "vehicle": 0.35, "equipment": 0.45,
		"securities": 0.15, "cash_deposit": 0.02, "guarantee": 0.30,
	}
	haircut, ok := baseHaircut[req.CollateralType]
	if !ok {
		haircut = 0.30
	}

	ageAdj := math.Min(req.AgeYears*0.02, 0.20)

	locationAdj := map[string]float64{"prime": -0.05, "good": 0.0, "average": 0.05, "poor": 0.10}
	locAdj := locationAdj[req.LocationGrade]

	condAdj := map[string]float64{"excellent": -0.05, "good": 0.0, "fair": 0.05, "poor": 0.10}
	cndAdj := condAdj[req.Condition]

	totalHaircut := math.Min(haircut+ageAdj+locAdj+cndAdj, 0.80)
	fsv := req.MarketValue * (1 - totalHaircut)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"collateralType":      req.CollateralType,
		"marketValue":         req.MarketValue,
		"haircutPct":          totalHaircut * 100,
		"forcedSaleValue":     fsv,
		"ageAdjustment":       ageAdj * 100,
		"locationAdjustment":  locAdj * 100,
		"conditionAdjustment": cndAdj * 100,
	})
}
