package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

// ==================== RISK SCORING TYPES ====================

type RiskAssessment struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	EntityID       string    `json:"entity_id"`
	EntityName     string    `json:"entity_name"`
	EntityType     string    `json:"entity_type"`
	RiskType       string    `json:"risk_type"`
	PD             float64   `json:"pd"`
	LGD            float64   `json:"lgd"`
	EAD            float64   `json:"ead"`
	ExpectedLoss   float64   `json:"expected_loss"`
	RiskWeight     float64   `json:"risk_weight"`
	RWA            float64   `json:"rwa"`
	Rating         string    `json:"rating"`
	IFRS9Stage     int       `json:"ifrs9_stage"`
	AssessmentDate string    `json:"assessment_date"`
	NextReview     string    `json:"next_review"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type ScoreEntityPayload struct {
	EntityID        string  `json:"entity_id"`
	EntityName      string  `json:"entity_name"`
	Exposure        float64 `json:"exposure"`
	CollateralValue float64 `json:"collateral_value"`
	DaysPastDue     int     `json:"days_past_due"`
	AnnualRevenue   float64 `json:"annual_revenue"`
	YearsInBusiness int     `json:"years_in_business"`
	Sector          string  `json:"sector"`
}

type ScoreEntityResult struct {
	EntityID           string  `json:"entityId"`
	EntityName         string  `json:"entityName"`
	PD                 float64 `json:"pd"`
	LGD                float64 `json:"lgd"`
	EAD                float64 `json:"ead"`
	ExpectedLoss       float64 `json:"expectedLoss"`
	RiskWeight         float64 `json:"riskWeight"`
	RWA                float64 `json:"rwa"`
	Rating             string  `json:"rating"`
	IFRS9Stage         int     `json:"ifrs9Stage"`
	Sector             string  `json:"sector"`
	CollateralCoverage float64 `json:"collateralCoverage"`
}

type RiskPortfolio struct {
	TotalAssessments    int                `json:"totalAssessments"`
	TotalEAD            float64            `json:"totalEAD"`
	TotalRWA            float64            `json:"totalRWA"`
	TotalExpectedLoss   float64            `json:"totalExpectedLoss"`
	RWAByType           map[string]float64 `json:"rwaByType"`
	CountByIFRS9Stage   map[string]int     `json:"countByIFRS9Stage"`
}

// ==================== CREDIT BUREAU TYPES ====================

type CreditReport struct {
	ID                   string  `json:"id"`
	TenantID             string  `json:"tenant_id"`
	CustomerID           string  `json:"customer_id"`
	CustomerName         string  `json:"customer_name"`
	BVN                  string  `json:"bvn"`
	Bureau               string  `json:"bureau"`
	CreditScore          int     `json:"credit_score"`
	ScoreBand            string  `json:"score_band"`
	TotalFacilities      int     `json:"total_facilities"`
	ActiveFacilities     int     `json:"active_facilities"`
	TotalOutstanding     float64 `json:"total_outstanding"`
	TotalOverdue         float64 `json:"total_overdue"`
	MaxDaysPastDue       int     `json:"max_days_past_due"`
	PerformingPercentage float64 `json:"performing_percentage"`
	EnquiryCount6m       int     `json:"enquiry_count_6m"`
	ReportDate           string  `json:"report_date"`
	NextRefresh          string  `json:"next_refresh"`
	Status               string  `json:"status"`
}

type BureauFacilityRecord struct {
	ID                 string  `json:"id"`
	ReportID           string  `json:"report_id"`
	Institution        string  `json:"institution"`
	FacilityType       string  `json:"facility_type"`
	OriginalAmount     float64 `json:"original_amount"`
	OutstandingBalance float64 `json:"outstanding_balance"`
	OverdueAmount      float64 `json:"overdue_amount"`
	Classification     string  `json:"classification"`
	StartDate          string  `json:"start_date"`
	MaturityDate       string  `json:"maturity_date"`
	DaysPastDue        int     `json:"days_past_due"`
}

type ScoreCheckPayload struct {
	BVN          string `json:"bvn"`
	CustomerName string `json:"customer_name"`
	Bureau       string `json:"bureau"`
}

type ScoreCheckResult struct {
	Found                bool    `json:"found"`
	BVN                  string  `json:"bvn"`
	Bureau               string  `json:"bureau"`
	CreditScore          *int    `json:"creditScore"`
	ScoreBand            string  `json:"scoreBand,omitempty"`
	TotalOutstanding     float64 `json:"totalOutstanding,omitempty"`
	TotalOverdue         float64 `json:"totalOverdue,omitempty"`
	PerformingPercentage float64 `json:"performingPercentage,omitempty"`
	Recommendation       string  `json:"recommendation"`
	Message              string  `json:"message,omitempty"`
}

type CreditBureauStats struct {
	TotalReports     int                `json:"totalReports"`
	AverageScore     float64            `json:"averageScore"`
	TotalOutstanding float64            `json:"totalOutstanding"`
	TotalOverdue     float64            `json:"totalOverdue"`
	ByScoreBand      map[string]int     `json:"byScoreBand"`
	ByBureau         map[string]int     `json:"byBureau"`
}

// ==================== CREDIT FACILITY TYPES ====================

type SubFacility struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Limit          float64  `json:"limit"`
	Utilized       float64  `json:"utilized"`
	LinkedAccounts []string `json:"linkedAccounts"`
}

type CollateralLink struct {
	ID              string  `json:"id"`
	Type            string  `json:"type"`
	Description     string  `json:"description"`
	MarketValue     float64 `json:"marketValue"`
	ForcedSaleValue float64 `json:"forcedSaleValue"`
	HaircutPct      float64 `json:"haircutPct"`
}

type CreditFacility struct {
	ID                    string           `json:"id"`
	TenantID              string           `json:"tenantId"`
	CustomerID            string           `json:"customerId"`
	CustomerName          string           `json:"customerName"`
	Type                  string           `json:"type"`
	Limit                 float64          `json:"limit"`
	Currency              string           `json:"currency"`
	Utilized              float64          `json:"utilized"`
	Available             float64          `json:"available"`
	UtilizationPct        float64          `json:"utilizationPct"`
	Status                string           `json:"status"`
	ExpiryDate            string           `json:"expiryDate"`
	SubFacilities         []SubFacility    `json:"subFacilities"`
	Collaterals           []CollateralLink `json:"collaterals"`
	CollateralCoveragePct float64          `json:"collateralCoveragePct"`
	ApprovedBy            string           `json:"approvedBy"`
	RiskRating            string           `json:"riskRating"`
	CreatedAt             time.Time        `json:"createdAt"`
}

type FacilityStats struct {
	TotalFacilities int                `json:"totalFacilities"`
	TotalLimit      float64            `json:"totalLimit"`
	TotalUtilized   float64            `json:"totalUtilized"`
	TotalAvailable  float64            `json:"totalAvailable"`
	AvgUtilization  float64            `json:"avgUtilization"`
	Breached        int                `json:"breached"`
	NearBreach      int                `json:"nearBreach"`
	ByType          map[string]int     `json:"byType"`
}

// ==================== SERVER ====================

type CreditServer struct{ db *sql.DB }

func newCreditServer(db *sql.DB) *CreditServer { return &CreditServer{db: db} }

func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func tenantID(r *http.Request) string { return r.Header.Get("X-Tenant-ID") }

// ==================== DB INIT ====================

func initTables(db *sql.DB) {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS risk_assessments (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64),
			entity_id VARCHAR(64),
			entity_name VARCHAR(255),
			entity_type VARCHAR(64),
			risk_type VARCHAR(32),
			pd NUMERIC(10,6),
			lgd NUMERIC(10,6),
			ead NUMERIC(18,2),
			expected_loss NUMERIC(18,2),
			risk_weight NUMERIC(10,6),
			rwa NUMERIC(18,2),
			rating VARCHAR(8),
			ifrs9_stage INT,
			assessment_date DATE,
			next_review DATE,
			status VARCHAR(32) DEFAULT 'active',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS credit_reports (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64),
			customer_id VARCHAR(64),
			customer_name VARCHAR(255),
			bvn VARCHAR(20),
			bureau VARCHAR(64),
			credit_score INT,
			score_band VARCHAR(32),
			total_facilities INT DEFAULT 0,
			active_facilities INT DEFAULT 0,
			total_outstanding NUMERIC(18,2) DEFAULT 0,
			total_overdue NUMERIC(18,2) DEFAULT 0,
			max_days_past_due INT DEFAULT 0,
			performing_percentage NUMERIC(5,2) DEFAULT 100,
			enquiry_count_6m INT DEFAULT 0,
			report_date DATE,
			next_refresh DATE,
			status VARCHAR(32) DEFAULT 'current',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS bureau_facilities (
			id VARCHAR(64) PRIMARY KEY,
			report_id VARCHAR(64),
			tenant_id VARCHAR(64),
			institution VARCHAR(255),
			facility_type VARCHAR(64),
			original_amount NUMERIC(18,2) DEFAULT 0,
			outstanding_balance NUMERIC(18,2) DEFAULT 0,
			overdue_amount NUMERIC(18,2) DEFAULT 0,
			classification VARCHAR(32) DEFAULT 'performing',
			start_date DATE,
			maturity_date DATE,
			days_past_due INT DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS credit_facilities (
			id VARCHAR(64) PRIMARY KEY,
			tenant_id VARCHAR(64),
			customer_id VARCHAR(64),
			customer_name VARCHAR(255),
			facility_type VARCHAR(64),
			limit_amount NUMERIC(18,2) DEFAULT 0,
			currency VARCHAR(8) DEFAULT 'NGN',
			utilized NUMERIC(18,2) DEFAULT 0,
			available NUMERIC(18,2) DEFAULT 0,
			utilization_pct NUMERIC(5,2) DEFAULT 0,
			status VARCHAR(32) DEFAULT 'active',
			expiry_date DATE,
			collateral_coverage_pct NUMERIC(5,2) DEFAULT 0,
			approved_by VARCHAR(64),
			risk_rating VARCHAR(8) DEFAULT 'B',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Printf("table init warning: %v", err)
		}
	}
}

// ==================== RISK SCORING HANDLERS ====================

func calcRisk(p ScoreEntityPayload) (pd, lgd, ead, el, rw, rwa float64, rating string, stage int) {
	pd = 0.01
	if p.DaysPastDue > 0 {
		pd += math.Min(float64(p.DaysPastDue)/365.0, 0.5)
	}
	if p.YearsInBusiness < 2 {
		pd = math.Min(pd*2, 0.99)
	}
	if p.AnnualRevenue > 0 && p.Exposure/p.AnnualRevenue > 0.5 {
		pd = math.Min(pd*1.5, 0.99)
	}
	collateralCoverage := 0.0
	if p.Exposure > 0 {
		collateralCoverage = math.Min(p.CollateralValue/p.Exposure, 1.0)
	}
	lgd = math.Max(0.45-(collateralCoverage*0.3), 0.05)
	ead = p.Exposure
	el = pd * lgd * ead
	rw = math.Min(0.5+pd*2, 1.5)
	rwa = ead * rw
	switch {
	case pd < 0.02:
		rating = "A"
	case pd < 0.05:
		rating = "B"
	case pd < 0.15:
		rating = "C"
	default:
		rating = "D"
	}
	switch {
	case p.DaysPastDue >= 90 || pd > 0.2:
		stage = 3
	case p.DaysPastDue >= 30 || pd > 0.05:
		stage = 2
	default:
		stage = 1
	}
	return
}

func (s *CreditServer) listAssessmentsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, entity_id, entity_name, entity_type, risk_type,
		       pd, lgd, ead, expected_loss, risk_weight, rwa, rating, ifrs9_stage,
		       TO_CHAR(assessment_date,'YYYY-MM-DD'), TO_CHAR(next_review,'YYYY-MM-DD'),
		       status, created_at
		FROM risk_assessments WHERE tenant_id = $1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]RiskAssessment, 0)
	for rows.Next() {
		var a RiskAssessment
		rows.Scan(&a.ID, &a.TenantID, &a.EntityID, &a.EntityName, &a.EntityType, &a.RiskType,
			&a.PD, &a.LGD, &a.EAD, &a.ExpectedLoss, &a.RiskWeight, &a.RWA, &a.Rating, &a.IFRS9Stage,
			&a.AssessmentDate, &a.NextReview, &a.Status, &a.CreatedAt)
		items = append(items, a)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *CreditServer) scoreEntityHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	var p ScoreEntityPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	pd, lgd, ead, el, rw, rwa, rating, stage := calcRisk(p)
	collCov := 0.0
	if p.Exposure > 0 {
		collCov = math.Min(p.CollateralValue/p.Exposure*100, 100)
	}
	id := uuid.New().String()
	now := time.Now()
	nextReview := now.AddDate(0, 6, 0)
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO risk_assessments (id, tenant_id, entity_id, entity_name, entity_type, risk_type,
			pd, lgd, ead, expected_loss, risk_weight, rwa, rating, ifrs9_stage,
			assessment_date, next_review, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active')`,
		id, tid, p.EntityID, p.EntityName, "borrower", "credit",
		pd, lgd, ead, el, rw, rwa, rating, stage,
		now.Format("2006-01-02"), nextReview.Format("2006-01-02"))
	if err != nil {
		log.Printf("insert risk_assessment: %v", err)
	}
	respondJSON(w, http.StatusOK, ScoreEntityResult{
		EntityID: p.EntityID, EntityName: p.EntityName,
		PD: pd, LGD: lgd, EAD: ead, ExpectedLoss: el,
		RiskWeight: rw, RWA: rwa, Rating: rating, IFRS9Stage: stage,
		Sector: p.Sector, CollateralCoverage: collCov,
	})
}

func (s *CreditServer) portfolioHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	var total int
	var totalEAD, totalRWA, totalEL float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(ead),0), COALESCE(SUM(rwa),0), COALESCE(SUM(expected_loss),0)
		FROM risk_assessments WHERE tenant_id = $1`, tid).Scan(&total, &totalEAD, &totalRWA, &totalEL)

	rwaRows, _ := s.db.QueryContext(r.Context(),
		`SELECT risk_type, COALESCE(SUM(rwa),0) FROM risk_assessments WHERE tenant_id=$1 GROUP BY risk_type`, tid)
	rwaByType := map[string]float64{}
	if rwaRows != nil {
		defer rwaRows.Close()
		for rwaRows.Next() {
			var rt string
			var v float64
			rwaRows.Scan(&rt, &v)
			rwaByType[rt] = v
		}
	}

	stageRows, _ := s.db.QueryContext(r.Context(),
		`SELECT ifrs9_stage, COUNT(*) FROM risk_assessments WHERE tenant_id=$1 GROUP BY ifrs9_stage`, tid)
	countByStage := map[string]int{}
	if stageRows != nil {
		defer stageRows.Close()
		for stageRows.Next() {
			var st, cnt int
			stageRows.Scan(&st, &cnt)
			countByStage[strconv.Itoa(st)] = cnt
		}
	}
	respondJSON(w, http.StatusOK, RiskPortfolio{
		TotalAssessments: total, TotalEAD: totalEAD, TotalRWA: totalRWA,
		TotalExpectedLoss: totalEL, RWAByType: rwaByType, CountByIFRS9Stage: countByStage,
	})
}

// ==================== CREDIT BUREAU HANDLERS ====================

func scoreBandFromScore(score int) string {
	switch {
	case score >= 750:
		return "Excellent"
	case score >= 650:
		return "Good"
	case score >= 500:
		return "Fair"
	default:
		return "Poor"
	}
}

func (s *CreditServer) listCreditReportsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, customer_id, customer_name, bvn, bureau, credit_score, score_band,
		       total_facilities, active_facilities, total_outstanding, total_overdue,
		       max_days_past_due, performing_percentage, enquiry_count_6m,
		       TO_CHAR(report_date,'YYYY-MM-DD'), TO_CHAR(next_refresh,'YYYY-MM-DD'), status
		FROM credit_reports WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]CreditReport, 0)
	for rows.Next() {
		var c CreditReport
		rows.Scan(&c.ID, &c.TenantID, &c.CustomerID, &c.CustomerName, &c.BVN, &c.Bureau,
			&c.CreditScore, &c.ScoreBand, &c.TotalFacilities, &c.ActiveFacilities,
			&c.TotalOutstanding, &c.TotalOverdue, &c.MaxDaysPastDue, &c.PerformingPercentage,
			&c.EnquiryCount6m, &c.ReportDate, &c.NextRefresh, &c.Status)
		items = append(items, c)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *CreditServer) listBureauFacilitiesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT f.id, f.report_id, f.institution, f.facility_type, f.original_amount,
		       f.outstanding_balance, f.overdue_amount, f.classification,
		       TO_CHAR(f.start_date,'YYYY-MM-DD'), TO_CHAR(f.maturity_date,'YYYY-MM-DD'), f.days_past_due
		FROM bureau_facilities f WHERE f.tenant_id=$1 ORDER BY f.created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]BureauFacilityRecord, 0)
	for rows.Next() {
		var f BureauFacilityRecord
		rows.Scan(&f.ID, &f.ReportID, &f.Institution, &f.FacilityType, &f.OriginalAmount,
			&f.OutstandingBalance, &f.OverdueAmount, &f.Classification,
			&f.StartDate, &f.MaturityDate, &f.DaysPastDue)
		items = append(items, f)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *CreditServer) bureauStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	var total int
	var avgScore, totalOut, totalOvd float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(AVG(credit_score),0), COALESCE(SUM(total_outstanding),0), COALESCE(SUM(total_overdue),0)
		FROM credit_reports WHERE tenant_id=$1`, tid).Scan(&total, &avgScore, &totalOut, &totalOvd)

	bandRows, _ := s.db.QueryContext(r.Context(),
		`SELECT score_band, COUNT(*) FROM credit_reports WHERE tenant_id=$1 GROUP BY score_band`, tid)
	byBand := map[string]int{}
	if bandRows != nil {
		defer bandRows.Close()
		for bandRows.Next() {
			var band string
			var cnt int
			bandRows.Scan(&band, &cnt)
			byBand[band] = cnt
		}
	}
	bureauRows, _ := s.db.QueryContext(r.Context(),
		`SELECT bureau, COUNT(*) FROM credit_reports WHERE tenant_id=$1 GROUP BY bureau`, tid)
	byBureau := map[string]int{}
	if bureauRows != nil {
		defer bureauRows.Close()
		for bureauRows.Next() {
			var b string
			var cnt int
			bureauRows.Scan(&b, &cnt)
			byBureau[b] = cnt
		}
	}
	respondJSON(w, http.StatusOK, CreditBureauStats{
		TotalReports: total, AverageScore: avgScore,
		TotalOutstanding: totalOut, TotalOverdue: totalOvd,
		ByScoreBand: byBand, ByBureau: byBureau,
	})
}

func (s *CreditServer) scoreCheckHandler(w http.ResponseWriter, r *http.Request) {
	var p ScoreCheckPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	bureau := p.Bureau
	if bureau == "" {
		bureau = "CRC"
	}
	var cr CreditReport
	err := s.db.QueryRowContext(r.Context(), `
		SELECT credit_score, score_band, total_outstanding, total_overdue, performing_percentage
		FROM credit_reports WHERE bvn=$1 LIMIT 1`, p.BVN).Scan(
		&cr.CreditScore, &cr.ScoreBand, &cr.TotalOutstanding, &cr.TotalOverdue, &cr.PerformingPercentage)
	if err == sql.ErrNoRows {
		respondJSON(w, http.StatusOK, ScoreCheckResult{
			Found: false, BVN: p.BVN, Bureau: bureau,
			Recommendation: "REFER", Message: "No credit history found in bureau",
		})
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rec := "APPROVE"
	if cr.CreditScore < 500 {
		rec = "DECLINE"
	} else if cr.CreditScore < 650 {
		rec = "REFER"
	}
	respondJSON(w, http.StatusOK, ScoreCheckResult{
		Found: true, BVN: p.BVN, Bureau: bureau,
		CreditScore: &cr.CreditScore, ScoreBand: cr.ScoreBand,
		TotalOutstanding: cr.TotalOutstanding, TotalOverdue: cr.TotalOverdue,
		PerformingPercentage: cr.PerformingPercentage,
		Recommendation: rec,
	})
}

// ==================== CREDIT FACILITY HANDLERS ====================

func (s *CreditServer) listFacilitiesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, customer_id, customer_name, facility_type, limit_amount, currency,
		       utilized, available, utilization_pct, status,
		       TO_CHAR(expiry_date,'YYYY-MM-DD'), collateral_coverage_pct, approved_by, risk_rating, created_at
		FROM credit_facilities WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	items := make([]CreditFacility, 0)
	for rows.Next() {
		var f CreditFacility
		rows.Scan(&f.ID, &f.TenantID, &f.CustomerID, &f.CustomerName, &f.Type, &f.Limit,
			&f.Currency, &f.Utilized, &f.Available, &f.UtilizationPct, &f.Status,
			&f.ExpiryDate, &f.CollateralCoveragePct, &f.ApprovedBy, &f.RiskRating, &f.CreatedAt)
		f.SubFacilities = []SubFacility{}
		f.Collaterals = []CollateralLink{}
		items = append(items, f)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *CreditServer) getFacilityHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	id := mux.Vars(r)["id"]
	var f CreditFacility
	err := s.db.QueryRowContext(r.Context(), `
		SELECT id, tenant_id, customer_id, customer_name, facility_type, limit_amount, currency,
		       utilized, available, utilization_pct, status,
		       TO_CHAR(expiry_date,'YYYY-MM-DD'), collateral_coverage_pct, approved_by, risk_rating, created_at
		FROM credit_facilities WHERE id=$1 AND tenant_id=$2`, id, tid).Scan(
		&f.ID, &f.TenantID, &f.CustomerID, &f.CustomerName, &f.Type, &f.Limit,
		&f.Currency, &f.Utilized, &f.Available, &f.UtilizationPct, &f.Status,
		&f.ExpiryDate, &f.CollateralCoveragePct, &f.ApprovedBy, &f.RiskRating, &f.CreatedAt)
	if err == sql.ErrNoRows {
		respondError(w, http.StatusNotFound, "facility not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	f.SubFacilities = []SubFacility{}
	f.Collaterals = []CollateralLink{}
	respondJSON(w, http.StatusOK, f)
}

func (s *CreditServer) createFacilityHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	var f CreditFacility
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	f.ID = uuid.New().String()
	f.TenantID = tid
	if f.Currency == "" {
		f.Currency = "NGN"
	}
	f.Available = f.Limit - f.Utilized
	if f.Limit > 0 {
		f.UtilizationPct = (f.Utilized / f.Limit) * 100
	}
	if f.Status == "" {
		f.Status = "active"
	}
	f.CreatedAt = time.Now()
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO credit_facilities (id, tenant_id, customer_id, customer_name, facility_type,
			limit_amount, currency, utilized, available, utilization_pct, status, expiry_date,
			collateral_coverage_pct, approved_by, risk_rating)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		f.ID, f.TenantID, f.CustomerID, f.CustomerName, f.Type,
		f.Limit, f.Currency, f.Utilized, f.Available, f.UtilizationPct, f.Status, f.ExpiryDate,
		f.CollateralCoveragePct, f.ApprovedBy, f.RiskRating)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create facility: %v", err))
		return
	}
	f.SubFacilities = []SubFacility{}
	f.Collaterals = []CollateralLink{}
	if f.Utilized > 0 {
		postLedgerTransfer(f.ID, f.Utilized, f.TenantID, f.Currency)
	}
	publishDomainEvent("credit.facility.created", f.TenantID, f)
	respondJSON(w, http.StatusCreated, f)
}

func (s *CreditServer) facilityStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	var total int
	var totalLimit, totalUtilized, totalAvail, avgUtil float64
	var breached, nearBreach int
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(limit_amount),0), COALESCE(SUM(utilized),0),
		       COALESCE(SUM(available),0), COALESCE(AVG(utilization_pct),0),
		       COUNT(*) FILTER (WHERE status='breached'),
		       COUNT(*) FILTER (WHERE status='near-breach')
		FROM credit_facilities WHERE tenant_id=$1`, tid).
		Scan(&total, &totalLimit, &totalUtilized, &totalAvail, &avgUtil, &breached, &nearBreach)

	typeRows, _ := s.db.QueryContext(r.Context(),
		`SELECT facility_type, COUNT(*) FROM credit_facilities WHERE tenant_id=$1 GROUP BY facility_type`, tid)
	byType := map[string]int{}
	if typeRows != nil {
		defer typeRows.Close()
		for typeRows.Next() {
			var t string
			var cnt int
			typeRows.Scan(&t, &cnt)
			byType[t] = cnt
		}
	}
	respondJSON(w, http.StatusOK, FacilityStats{
		TotalFacilities: total, TotalLimit: totalLimit, TotalUtilized: totalUtilized,
		TotalAvailable: totalAvail, AvgUtilization: avgUtil,
		Breached: breached, NearBreach: nearBreach, ByType: byType,
	})
}

// ==================== MAIN ====================

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/credit_db?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Printf("WARNING: db ping failed at startup: %v — will retry on first request", err)
	} else {
		initTables(db)
	}

	srv := newCreditServer(db)
	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "credit-service"})
	}).Methods("GET")
	r.HandleFunc("/ready", func(w http.ResponseWriter, req *http.Request) {
		if err := db.PingContext(req.Context()); err != nil {
			http.Error(w, "not ready", http.StatusServiceUnavailable)
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}).Methods("GET")

	// Risk scoring — APISIX strips /risk-scoring/ prefix
	r.HandleFunc("/v1/scores", srv.listAssessmentsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/risk/assessments", srv.listAssessmentsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/risk/score", srv.scoreEntityHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/v1/risk/portfolio", srv.portfolioHandler).Methods("GET", "OPTIONS")

	// Credit bureau — APISIX strips /credit-bureau/ prefix
	r.HandleFunc("/v1/credit-bureau/reports", srv.listCreditReportsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/credit-bureau/facilities", srv.listBureauFacilitiesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/credit-bureau/stats", srv.bureauStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/credit-bureau/score-check", srv.scoreCheckHandler).Methods("POST", "OPTIONS")

	// Credit facility — APISIX strips /credit-facility/ prefix
	r.HandleFunc("/v1/facilities", srv.listFacilitiesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/facilities", srv.createFacilityHandler).Methods("POST")
	r.HandleFunc("/v1/facilities/{id}", srv.getFacilityHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/stats", srv.facilityStatsHandler).Methods("GET", "OPTIONS")

	// NIRSAL Credit Guarantee
	r.HandleFunc("/v1/nirsal-credit-guarantee/list", srv.nirsalListHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/nirsal-credit-guarantee/stats", srv.nirsalStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/nirsal-credit-guarantee/create", srv.nirsalCreateHandler).Methods("POST", "OPTIONS")

	// Cooperative Credit Scoring
	r.HandleFunc("/v1/cooperative-credit-scoring/list", srv.coopListHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/cooperative-credit-scoring/stats", srv.coopStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/cooperative-credit-scoring/create", srv.coopCreateHandler).Methods("POST", "OPTIONS")

	// Equipment Leasing
	r.HandleFunc("/v1/equipment-leasing/list", srv.equipmentListHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/equipment-leasing/stats", srv.equipmentStatsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/equipment-leasing/create", srv.equipmentCreateHandler).Methods("POST", "OPTIONS")

	// Collateral Valuation
	r.HandleFunc("/v1/valuations", srv.collateralListHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/valuations/summary", srv.collateralSummaryHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/valuations/compute-fsv", srv.computeFSVHandler).Methods("POST", "OPTIONS")

	// Multicurrency Revaluation
	r.HandleFunc("/v1/multicurrency/revaluation", srv.multicurrencyRevaluationHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/multicurrency/run", srv.multicurrencyRunHandler).Methods("POST", "OPTIONS")

	// OTC Derivatives
	r.HandleFunc("/v1/otc/derivatives", srv.otcDerivativesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/otc/derivatives", srv.otcCreateHandler).Methods("POST")
	r.HandleFunc("/v1/otc/stats", srv.otcStatsHandler).Methods("GET", "OPTIONS")

	// ETD Trading
	r.HandleFunc("/v1/etd/trades", srv.etdTradesHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/etd/stats", srv.etdStatsHandler).Methods("GET", "OPTIONS")

	// Banking Clearing Ops
	r.HandleFunc("/v1/banking-clearing-ops/instructions", srv.clearingInstructionsHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/v1/banking-clearing-ops/instructions", srv.clearingCreateHandler).Methods("POST")
	r.HandleFunc("/v1/banking-clearing-ops/stats", srv.clearingStatsHandler).Methods("GET", "OPTIONS")

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "*")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "80"
	}
	log.Printf("credit-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
