package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ReportService handles risk report operations
type ReportService struct {
	tenantID string
	reports  map[string]*RiskReport
	mu       sync.RWMutex
}

// NewReportService creates a new report service
func NewReportService(tenantID string) *ReportService {
	svc := &ReportService{
		tenantID: tenantID,
		reports:  make(map[string]*RiskReport),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *ReportService) initializeDefaultData(tenantID string) {
	approvedAt := time.Now().AddDate(0, 0, -5)
	submittedAt := time.Now().AddDate(0, 0, -4)

	// Daily risk report
	s.reports["rpt-001"] = &RiskReport{
		ReportID:    "rpt-001",
		TenantID:    tenantID,
		ReportType:  "daily",
		ReportName:  "Daily Risk Dashboard Report",
		ReportDate:  time.Now().AddDate(0, 0, -1),
		Status:      "approved",
		GeneratedBy: "system",
		ApprovedBy:  "risk-officer-001",
		ApprovedAt:  &approvedAt,
		Content: map[string]interface{}{
			"creditRisk": map[string]interface{}{
				"totalExposure": 930000000000,
				"nplRatio":      3.2,
			},
			"marketRisk": map[string]interface{}{
				"totalVaR":     5300000000,
				"utilization":  53.0,
			},
			"operationalRisk": map[string]interface{}{
				"openIncidents": 3,
				"totalLosses":   70000000,
			},
		},
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now().AddDate(0, 0, -1),
		UpdatedAt: time.Now().AddDate(0, 0, -1),
	}

	// Monthly risk report
	s.reports["rpt-002"] = &RiskReport{
		ReportID:    "rpt-002",
		TenantID:    tenantID,
		ReportType:  "monthly",
		ReportName:  "Monthly Risk Management Report - January 2026",
		ReportDate:  time.Now().AddDate(0, -1, 0),
		Status:      "submitted",
		GeneratedBy: "risk-officer-001",
		ApprovedBy:  "cro",
		ApprovedAt:  &approvedAt,
		SubmittedAt: &submittedAt,
		Content: map[string]interface{}{
			"executiveSummary": "Risk profile remains within appetite...",
			"creditRisk":       map[string]interface{}{},
			"marketRisk":       map[string]interface{}{},
			"operationalRisk":  map[string]interface{}{},
			"capitalAdequacy":  map[string]interface{}{},
			"stressTestResults": map[string]interface{}{},
		},
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now().AddDate(0, -1, 5),
		UpdatedAt: time.Now().AddDate(0, 0, -4),
	}

	// Quarterly regulatory report
	s.reports["rpt-003"] = &RiskReport{
		ReportID:    "rpt-003",
		TenantID:    tenantID,
		ReportType:  "regulatory",
		ReportName:  "CBN Quarterly Risk Return - Q4 2025",
		ReportDate:  time.Now().AddDate(0, -1, 0),
		Status:      "submitted",
		GeneratedBy: "compliance-officer-001",
		ApprovedBy:  "cro",
		ApprovedAt:  &approvedAt,
		SubmittedAt: &submittedAt,
		Content: map[string]interface{}{
			"capitalAdequacy": map[string]interface{}{
				"tier1Ratio":  13.88,
				"totalRatio":  18.50,
				"compliant":   true,
			},
			"creditRisk": map[string]interface{}{
				"nplRatio":           3.2,
				"provisionCoverage":  125.0,
			},
			"liquidityRisk": map[string]interface{}{
				"lcr": 125.0,
				"nsfr": 115.0,
			},
		},
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now().AddDate(0, -1, 10),
		UpdatedAt: time.Now().AddDate(0, 0, -4),
	}

	// Pending report
	s.reports["rpt-004"] = &RiskReport{
		ReportID:    "rpt-004",
		TenantID:    tenantID,
		ReportType:  "weekly",
		ReportName:  "Weekly Risk Summary - Week 7 2026",
		ReportDate:  time.Now(),
		Status:      "pending_review",
		GeneratedBy: "risk-officer-002",
		Content: map[string]interface{}{
			"highlights": []string{
				"VaR utilization increased to 53%",
				"New operational risk event reported",
				"Oil & Gas sector limit at 85% utilization",
			},
		},
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ListReports returns reports based on filters
func (s *ReportService) ListReports(tenantID, reportType string) []*RiskReport {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RiskReport
	for _, report := range s.reports {
		if report.TenantID != tenantID {
			continue
		}
		if reportType != "" && report.ReportType != reportType {
			continue
		}
		result = append(result, report)
	}
	return result
}

// GetReport retrieves a report by ID
func (s *ReportService) GetReport(tenantID, reportID string) (*RiskReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}
	return report, nil
}

// CreateReport creates a new report
func (s *ReportService) CreateReport(tenantID, userID, reportType, reportName string) (*RiskReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report := &RiskReport{
		ReportID:    uuid.New().String(),
		TenantID:    tenantID,
		ReportType:  reportType,
		ReportName:  reportName,
		ReportDate:  time.Now(),
		Status:      "draft",
		GeneratedBy: userID,
		Content:     make(map[string]interface{}),
		Metadata:    make(map[string]interface{}),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	s.reports[report.ReportID] = report
	return report, nil
}

// ApproveReport approves a report
func (s *ReportService) ApproveReport(tenantID, reportID, userID string) (*RiskReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}

	if report.Status != "pending_review" && report.Status != "draft" {
		return nil, errors.New("report cannot be approved in current status")
	}

	now := time.Now()
	report.Status = "approved"
	report.ApprovedBy = userID
	report.ApprovedAt = &now
	report.UpdatedAt = time.Now()

	return report, nil
}

// SubmitReport submits a report
func (s *ReportService) SubmitReport(tenantID, reportID string) (*RiskReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}

	if report.Status != "approved" {
		return nil, errors.New("report must be approved before submission")
	}

	now := time.Now()
	report.Status = "submitted"
	report.SubmittedAt = &now
	report.UpdatedAt = time.Now()

	return report, nil
}

// GetRegulatoryReports returns regulatory reports
func (s *ReportService) GetRegulatoryReports(tenantID string) []*RiskReport {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RiskReport
	for _, report := range s.reports {
		if report.TenantID != tenantID {
			continue
		}
		if report.ReportType == "regulatory" {
			result = append(result, report)
		}
	}
	return result
}
