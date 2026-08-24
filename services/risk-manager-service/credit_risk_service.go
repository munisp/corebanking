package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// CreditRiskService handles credit risk operations
type CreditRiskService struct {
	tenantID string
	risks    map[string]*CreditRisk
	mu       sync.RWMutex
}

// NewCreditRiskService creates a new credit risk service
func NewCreditRiskService(tenantID string) *CreditRiskService {
	svc := &CreditRiskService{
		tenantID: tenantID,
		risks:    make(map[string]*CreditRisk),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *CreditRiskService) initializeDefaultData(tenantID string) {
	// Corporate portfolio
	s.risks["cr-001"] = &CreditRisk{
		RiskID:             "cr-001",
		TenantID:           tenantID,
		EntityType:         "portfolio",
		EntityID:           "corporate",
		EntityName:         "Corporate Loans Portfolio",
		ExposureAmount:     500000000000, // 500B NGN
		Currency:           "NGN",
		PD:                 0.025,
		LGD:                0.45,
		EAD:                500000000000,
		ExpectedLoss:       5625000000,
		RiskRating:         "BBB",
		RiskScore:          65.0,
		WatchlistStatus:    "normal",
		ProvisionRate:      0.01,
		ProvisionAmount:    5000000000,
		CollateralValue:    350000000000,
		CollateralCoverage: 0.70,
		LastReviewDate:     time.Now().AddDate(0, -1, 0),
		NextReviewDate:     time.Now().AddDate(0, 2, 0),
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(-1, 0, 0),
		UpdatedAt:          time.Now(),
	}

	// Retail portfolio
	s.risks["cr-002"] = &CreditRisk{
		RiskID:             "cr-002",
		TenantID:           tenantID,
		EntityType:         "portfolio",
		EntityID:           "retail",
		EntityName:         "Retail Loans Portfolio",
		ExposureAmount:     200000000000, // 200B NGN
		Currency:           "NGN",
		PD:                 0.035,
		LGD:                0.60,
		EAD:                200000000000,
		ExpectedLoss:       4200000000,
		RiskRating:         "BB",
		RiskScore:          55.0,
		WatchlistStatus:    "normal",
		ProvisionRate:      0.02,
		ProvisionAmount:    4000000000,
		CollateralValue:    80000000000,
		CollateralCoverage: 0.40,
		LastReviewDate:     time.Now().AddDate(0, -1, 0),
		NextReviewDate:     time.Now().AddDate(0, 2, 0),
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(-1, 0, 0),
		UpdatedAt:          time.Now(),
	}

	// SME portfolio
	s.risks["cr-003"] = &CreditRisk{
		RiskID:             "cr-003",
		TenantID:           tenantID,
		EntityType:         "portfolio",
		EntityID:           "sme",
		EntityName:         "SME Loans Portfolio",
		ExposureAmount:     150000000000, // 150B NGN
		Currency:           "NGN",
		PD:                 0.045,
		LGD:                0.55,
		EAD:                150000000000,
		ExpectedLoss:       3712500000,
		RiskRating:         "BB",
		RiskScore:          50.0,
		WatchlistStatus:    "watch",
		ProvisionRate:      0.03,
		ProvisionAmount:    4500000000,
		CollateralValue:    75000000000,
		CollateralCoverage: 0.50,
		LastReviewDate:     time.Now().AddDate(0, 0, -15),
		NextReviewDate:     time.Now().AddDate(0, 1, 0),
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(-1, 0, 0),
		UpdatedAt:          time.Now(),
	}

	// Agriculture sector
	s.risks["cr-004"] = &CreditRisk{
		RiskID:             "cr-004",
		TenantID:           tenantID,
		EntityType:         "sector",
		EntityID:           "agriculture",
		EntityName:         "Agriculture Sector Exposure",
		ExposureAmount:     80000000000, // 80B NGN
		Currency:           "NGN",
		PD:                 0.055,
		LGD:                0.65,
		EAD:                80000000000,
		ExpectedLoss:       2860000000,
		RiskRating:         "B",
		RiskScore:          45.0,
		WatchlistStatus:    "watch",
		ProvisionRate:      0.05,
		ProvisionAmount:    4000000000,
		CollateralValue:    40000000000,
		CollateralCoverage: 0.50,
		LastReviewDate:     time.Now().AddDate(0, 0, -7),
		NextReviewDate:     time.Now().AddDate(0, 0, 23),
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(-1, 0, 0),
		UpdatedAt:          time.Now(),
	}

	// NPL customer
	s.risks["cr-005"] = &CreditRisk{
		RiskID:             "cr-005",
		TenantID:           tenantID,
		EntityType:         "customer",
		EntityID:           "cust-npl-001",
		EntityName:         "XYZ Manufacturing Ltd",
		ExposureAmount:     5000000000, // 5B NGN
		Currency:           "NGN",
		PD:                 0.80,
		LGD:                0.70,
		EAD:                5000000000,
		ExpectedLoss:       2800000000,
		RiskRating:         "CCC",
		RiskScore:          20.0,
		WatchlistStatus:    "substandard",
		ProvisionRate:      0.50,
		ProvisionAmount:    2500000000,
		CollateralValue:    2000000000,
		CollateralCoverage: 0.40,
		LastReviewDate:     time.Now().AddDate(0, 0, -3),
		NextReviewDate:     time.Now().AddDate(0, 0, 7),
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(-2, 0, 0),
		UpdatedAt:          time.Now(),
	}
}

// ListRisks returns credit risks based on filters
func (s *CreditRiskService) ListRisks(tenantID, rating, watchlist string) []*CreditRisk {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CreditRisk
	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		if rating != "" && risk.RiskRating != rating {
			continue
		}
		if watchlist != "" && risk.WatchlistStatus != watchlist {
			continue
		}
		result = append(result, risk)
	}
	return result
}

// GetRisk retrieves a risk by ID
func (s *CreditRiskService) GetRisk(tenantID, riskID string) (*CreditRisk, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risk, exists := s.risks[riskID]
	if !exists || risk.TenantID != tenantID {
		return nil, errors.New("risk not found")
	}
	return risk, nil
}

// CreateRisk creates a new credit risk
func (s *CreditRiskService) CreateRisk(tenantID string, req *CreateCreditRiskRequest) (*CreditRisk, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	risk := &CreditRisk{
		RiskID:          uuid.New().String(),
		TenantID:        tenantID,
		EntityType:      req.EntityType,
		EntityID:        req.EntityID,
		EntityName:      req.EntityName,
		ExposureAmount:  req.ExposureAmount,
		Currency:        req.Currency,
		CollateralValue: req.CollateralValue,
		RiskRating:      "BBB",
		RiskScore:       60.0,
		WatchlistStatus: "normal",
		LastReviewDate:  time.Now(),
		NextReviewDate:  time.Now().AddDate(0, 3, 0),
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Calculate derived fields
	if req.CollateralValue > 0 {
		risk.CollateralCoverage = float64(req.CollateralValue) / float64(req.ExposureAmount)
	}

	s.risks[risk.RiskID] = risk
	return risk, nil
}

// UpdateRisk updates a credit risk
func (s *CreditRiskService) UpdateRisk(risk *CreditRisk) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.risks[risk.RiskID]
	if !exists || existing.TenantID != risk.TenantID {
		return errors.New("risk not found")
	}

	risk.CreatedAt = existing.CreatedAt
	risk.UpdatedAt = time.Now()
	s.risks[risk.RiskID] = risk
	return nil
}

// UpdateRating updates risk rating
func (s *CreditRiskService) UpdateRating(tenantID, riskID, userID string, req *UpdateRiskRatingRequest) (*CreditRisk, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	risk, exists := s.risks[riskID]
	if !exists || risk.TenantID != tenantID {
		return nil, errors.New("risk not found")
	}

	risk.RiskRating = req.RiskRating
	risk.WatchlistStatus = req.WatchlistStatus
	risk.LastReviewDate = time.Now()
	risk.UpdatedAt = time.Now()

	// Update provision rate based on watchlist status
	switch req.WatchlistStatus {
	case "normal":
		risk.ProvisionRate = 0.01
	case "watch":
		risk.ProvisionRate = 0.05
	case "substandard":
		risk.ProvisionRate = 0.20
	case "doubtful":
		risk.ProvisionRate = 0.50
	case "loss":
		risk.ProvisionRate = 1.00
	}

	risk.ProvisionAmount = int64(float64(risk.ExposureAmount) * risk.ProvisionRate)

	return risk, nil
}

// GetPortfolioRisk returns portfolio risk summary
func (s *CreditRiskService) GetPortfolioRisk(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalExposure, totalProvisions, totalNPL int64
	var totalEL int64

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		totalExposure += risk.ExposureAmount
		totalProvisions += risk.ProvisionAmount
		totalEL += risk.ExpectedLoss

		if risk.WatchlistStatus == "substandard" || risk.WatchlistStatus == "doubtful" || risk.WatchlistStatus == "loss" {
			totalNPL += risk.ExposureAmount
		}
	}

	nplRatio := 0.0
	provisionCoverage := 0.0
	if totalExposure > 0 {
		nplRatio = float64(totalNPL) / float64(totalExposure) * 100
	}
	if totalNPL > 0 {
		provisionCoverage = float64(totalProvisions) / float64(totalNPL) * 100
	}

	return map[string]interface{}{
		"totalExposure":     totalExposure,
		"totalProvisions":   totalProvisions,
		"totalExpectedLoss": totalEL,
		"totalNPL":          totalNPL,
		"nplRatio":          nplRatio,
		"provisionCoverage": provisionCoverage,
		"timestamp":         time.Now().Format(time.RFC3339),
	}
}

// GetConcentrationRisk returns concentration risk analysis
func (s *CreditRiskService) GetConcentrationRisk(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sectorExposure := make(map[string]int64)
	var totalExposure int64

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		if risk.EntityType == "sector" {
			sectorExposure[risk.EntityID] = risk.ExposureAmount
		}
		totalExposure += risk.ExposureAmount
	}

	return map[string]interface{}{
		"sectorExposure":      sectorExposure,
		"totalExposure":       totalExposure,
		"largestSector":       "corporate",
		"largestSectorShare":  53.8,
		"herfindahlIndex":     0.35,
		"concentrationStatus": "moderate",
		"timestamp":           time.Now().Format(time.RFC3339),
	}
}

// GetWatchlist returns watchlist items
func (s *CreditRiskService) GetWatchlist(tenantID string) []*CreditRisk {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CreditRisk
	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		if risk.WatchlistStatus != "normal" {
			result = append(result, risk)
		}
	}
	return result
}

// GetProvisions returns provision summary
func (s *CreditRiskService) GetProvisions(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	provisions := make(map[string]int64)
	var totalProvisions int64

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		provisions[risk.WatchlistStatus] += risk.ProvisionAmount
		totalProvisions += risk.ProvisionAmount
	}

	return map[string]interface{}{
		"byCategory":      provisions,
		"totalProvisions": totalProvisions,
		"stage1":          provisions["normal"],
		"stage2":          provisions["watch"],
		"stage3":          provisions["substandard"] + provisions["doubtful"] + provisions["loss"],
		"timestamp":       time.Now().Format(time.RFC3339),
	}
}

// GetNPLAnalysis returns NPL analysis
func (s *CreditRiskService) GetNPLAnalysis(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalExposure, totalNPL int64
	nplByCategory := make(map[string]int64)

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		totalExposure += risk.ExposureAmount

		if risk.WatchlistStatus == "substandard" || risk.WatchlistStatus == "doubtful" || risk.WatchlistStatus == "loss" {
			totalNPL += risk.ExposureAmount
			nplByCategory[risk.WatchlistStatus] += risk.ExposureAmount
		}
	}

	nplRatio := 0.0
	if totalExposure > 0 {
		nplRatio = float64(totalNPL) / float64(totalExposure) * 100
	}

	return map[string]interface{}{
		"totalNPL":        totalNPL,
		"nplRatio":        nplRatio,
		"byCategory":      nplByCategory,
		"substandard":     nplByCategory["substandard"],
		"doubtful":        nplByCategory["doubtful"],
		"loss":            nplByCategory["loss"],
		"regulatoryLimit": 5.0,
		"status":          "within_limit",
		"timestamp":       time.Now().Format(time.RFC3339),
	}
}
