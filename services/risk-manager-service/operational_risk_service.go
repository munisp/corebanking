package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// OperationalRiskService handles operational risk operations
type OperationalRiskService struct {
	tenantID string
	risks    map[string]*OperationalRisk
	mu       sync.RWMutex
}

// NewOperationalRiskService creates a new operational risk service
func NewOperationalRiskService(tenantID string) *OperationalRiskService {
	svc := &OperationalRiskService{
		tenantID: tenantID,
		risks:    make(map[string]*OperationalRisk),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *OperationalRiskService) initializeDefaultData(tenantID string) {
	// Fraud event
	resolvedAt := time.Now().AddDate(0, 0, -5)
	s.risks["or-001"] = &OperationalRisk{
		RiskID:           "or-001",
		TenantID:         tenantID,
		EventType:        "fraud",
		EventCategory:    "external_fraud",
		Description:      "ATM skimming incident at Victoria Island branch",
		Department:       "card_operations",
		BusinessLine:     "retail_banking",
		DiscoveryDate:    time.Now().AddDate(0, 0, -10),
		OccurrenceDate:   time.Now().AddDate(0, 0, -12),
		GrossLoss:        25000000, // 25M NGN
		Recovery:         15000000,
		NetLoss:          10000000,
		Currency:         "NGN",
		Status:           "resolved",
		Severity:         "high",
		RootCause:        "Compromised ATM card reader",
		CorrectiveAction: "Replaced ATM hardware, enhanced monitoring",
		PreventiveAction: "Implemented anti-skimming devices on all ATMs",
		ReportedBy:       "branch-manager-001",
		AssignedTo:       "risk-officer-001",
		ResolvedBy:       "risk-officer-001",
		ResolvedAt:       &resolvedAt,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, 0, -10),
		UpdatedAt:        time.Now().AddDate(0, 0, -5),
	}

	// System failure
	s.risks["or-002"] = &OperationalRisk{
		RiskID:         "or-002",
		TenantID:       tenantID,
		EventType:      "system_failure",
		EventCategory:  "business_disruption",
		Description:    "Core banking system downtime during peak hours",
		Department:     "it_operations",
		BusinessLine:   "enterprise",
		DiscoveryDate:  time.Now().AddDate(0, 0, -3),
		OccurrenceDate: time.Now().AddDate(0, 0, -3),
		GrossLoss:      50000000, // 50M NGN (estimated revenue loss)
		Recovery:       0,
		NetLoss:        50000000,
		Currency:       "NGN",
		Status:         "investigating",
		Severity:       "critical",
		ReportedBy:     "it-admin-001",
		AssignedTo:     "risk-officer-002",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -3),
		UpdatedAt:      time.Now(),
	}

	// Process error
	s.risks["or-003"] = &OperationalRisk{
		RiskID:         "or-003",
		TenantID:       tenantID,
		EventType:      "process_error",
		EventCategory:  "execution",
		Description:    "Duplicate payment processing in batch settlement",
		Department:     "operations",
		BusinessLine:   "payments",
		DiscoveryDate:  time.Now().AddDate(0, 0, -1),
		OccurrenceDate: time.Now().AddDate(0, 0, -1),
		GrossLoss:      5000000, // 5M NGN
		Recovery:       5000000,
		NetLoss:        0,
		Currency:       "NGN",
		Status:         "open",
		Severity:       "medium",
		ReportedBy:     "ops-officer-001",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -1),
		UpdatedAt:      time.Now(),
	}

	// Compliance breach
	s.risks["or-004"] = &OperationalRisk{
		RiskID:         "or-004",
		TenantID:       tenantID,
		EventType:      "compliance",
		EventCategory:  "legal",
		Description:    "Late submission of regulatory report to CBN",
		Department:     "compliance",
		BusinessLine:   "enterprise",
		DiscoveryDate:  time.Now().AddDate(0, 0, -7),
		OccurrenceDate: time.Now().AddDate(0, 0, -7),
		GrossLoss:      10000000, // 10M NGN (potential fine)
		Recovery:       0,
		NetLoss:        10000000,
		Currency:       "NGN",
		Status:         "open",
		Severity:       "high",
		ReportedBy:     "compliance-officer-001",
		AssignedTo:     "risk-officer-001",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -7),
		UpdatedAt:      time.Now(),
	}
}

// ListRisks returns operational risks based on filters
func (s *OperationalRiskService) ListRisks(tenantID, status, eventType string) []*OperationalRisk {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*OperationalRisk
	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		if status != "" && risk.Status != status {
			continue
		}
		if eventType != "" && risk.EventType != eventType {
			continue
		}
		result = append(result, risk)
	}
	return result
}

// GetRisk retrieves a risk by ID
func (s *OperationalRiskService) GetRisk(tenantID, riskID string) (*OperationalRisk, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risk, exists := s.risks[riskID]
	if !exists || risk.TenantID != tenantID {
		return nil, errors.New("risk not found")
	}
	return risk, nil
}

// CreateRisk creates a new operational risk
func (s *OperationalRiskService) CreateRisk(tenantID, userID string, req *CreateOperationalRiskRequest) (*OperationalRisk, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	occurrenceDate, _ := time.Parse("2006-01-02", req.OccurrenceDate)

	risk := &OperationalRisk{
		RiskID:         uuid.New().String(),
		TenantID:       tenantID,
		EventType:      req.EventType,
		EventCategory:  req.EventCategory,
		Description:    req.Description,
		Department:     req.Department,
		BusinessLine:   req.BusinessLine,
		DiscoveryDate:  time.Now(),
		OccurrenceDate: occurrenceDate,
		GrossLoss:      req.GrossLoss,
		NetLoss:        req.GrossLoss,
		Currency:       "NGN",
		Status:         "open",
		Severity:       req.Severity,
		ReportedBy:     userID,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	s.risks[risk.RiskID] = risk
	return risk, nil
}

// UpdateRisk updates an operational risk
func (s *OperationalRiskService) UpdateRisk(risk *OperationalRisk) error {
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

// AssignRisk assigns a risk to an officer
func (s *OperationalRiskService) AssignRisk(tenantID, riskID, assignTo string) (*OperationalRisk, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	risk, exists := s.risks[riskID]
	if !exists || risk.TenantID != tenantID {
		return nil, errors.New("risk not found")
	}

	risk.AssignedTo = assignTo
	risk.Status = "investigating"
	risk.UpdatedAt = time.Now()

	return risk, nil
}

// ResolveRisk resolves an operational risk
func (s *OperationalRiskService) ResolveRisk(tenantID, riskID, userID, rootCause, correctiveAction, preventiveAction string) (*OperationalRisk, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	risk, exists := s.risks[riskID]
	if !exists || risk.TenantID != tenantID {
		return nil, errors.New("risk not found")
	}

	now := time.Now()
	risk.Status = "resolved"
	risk.RootCause = rootCause
	risk.CorrectiveAction = correctiveAction
	risk.PreventiveAction = preventiveAction
	risk.ResolvedBy = userID
	risk.ResolvedAt = &now
	risk.UpdatedAt = time.Now()

	return risk, nil
}

// GetSummary returns operational risk summary
func (s *OperationalRiskService) GetSummary(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var openEvents, investigatingEvents, resolvedEvents int
	var totalLosses, totalRecovery int64
	severityCounts := make(map[string]int)
	eventTypeCounts := make(map[string]int)

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}

		switch risk.Status {
		case "open":
			openEvents++
		case "investigating":
			investigatingEvents++
		case "resolved":
			resolvedEvents++
		}

		totalLosses += risk.NetLoss
		totalRecovery += risk.Recovery
		severityCounts[risk.Severity]++
		eventTypeCounts[risk.EventType]++
	}

	return map[string]interface{}{
		"openEvents":          openEvents,
		"investigatingEvents": investigatingEvents,
		"resolvedEvents":      resolvedEvents,
		"totalLosses":         totalLosses,
		"totalRecovery":       totalRecovery,
		"bySeverity":          severityCounts,
		"byEventType":         eventTypeCounts,
		"timestamp":           time.Now().Format(time.RFC3339),
	}
}

// GetLossDistribution returns loss distribution analysis
func (s *OperationalRiskService) GetLossDistribution(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	byCategory := make(map[string]int64)
	byDepartment := make(map[string]int64)
	byBusinessLine := make(map[string]int64)

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		byCategory[risk.EventCategory] += risk.NetLoss
		byDepartment[risk.Department] += risk.NetLoss
		byBusinessLine[risk.BusinessLine] += risk.NetLoss
	}

	return map[string]interface{}{
		"byCategory":     byCategory,
		"byDepartment":   byDepartment,
		"byBusinessLine": byBusinessLine,
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}
