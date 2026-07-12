package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ReportService handles audit report operations
type ReportService struct {
	tenantID string
	reports  map[string]*AuditReport
	mu       sync.RWMutex
}

// NewReportService creates a new report service
func NewReportService(tenantID string) *ReportService {
	svc := &ReportService{
		tenantID: tenantID,
		reports:  make(map[string]*AuditReport),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *ReportService) initializeDefaultData(tenantID string) {
	issuedDate := time.Now().AddDate(0, -1, 0)

	// Draft report
	s.reports["report-001"] = &AuditReport{
		ReportID:         "report-001",
		TenantID:         tenantID,
		EngagementID:     "eng-003",
		ReportTitle:      "Q4 2025 Financial Controls Review - Audit Report",
		ReportType:       "draft",
		ExecutiveSummary: "This audit assessed the effectiveness of financial controls over the reconciliation and journal entry processes. Overall, controls were found to need improvement with 5 findings identified.",
		Scope:            "Financial reporting controls and reconciliation processes for Q4 2025",
		Methodology:      "We performed walkthroughs, tested controls, and reviewed documentation for a sample of transactions",
		Findings:         []string{"find-003"},
		OverallRating:    "needs_improvement",
		Recommendations:  []string{"Strengthen supervisory review processes", "Enhance documentation standards", "Implement automated controls"},
		PreparedBy:       "auditor-001",
		Status:           "draft",
		Distribution:     []string{"CFO", "Finance Manager", "Audit Committee"},
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, 0, -10),
		UpdatedAt:        time.Now().AddDate(0, 0, -5),
	}

	// Issued report
	s.reports["report-002"] = &AuditReport{
		ReportID:         "report-002",
		TenantID:         tenantID,
		EngagementID:     "eng-004",
		ReportTitle:      "Treasury Operations Audit Report",
		ReportType:       "final",
		ExecutiveSummary: "This audit assessed treasury operations and investment controls. Two significant findings were identified related to system access and segregation of duties.",
		Scope:            "Treasury operations, investment processes, and related controls",
		Methodology:      "We performed control testing, reviewed system configurations, and analyzed transaction samples",
		Findings:         []string{"find-004", "find-005"},
		OverallRating:    "needs_improvement",
		Recommendations:  []string{"Upgrade treasury system", "Implement compensating controls", "Enhance monitoring"},
		PreparedBy:       "auditor-004",
		ReviewedBy:       "auditor-001",
		ApprovedBy:       "auditor-005",
		IssuedDate:       &issuedDate,
		Status:           "issued",
		Distribution:     []string{"CFO", "Treasury Manager", "Audit Committee", "Board"},
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, -1, -15),
		UpdatedAt:        time.Now().AddDate(0, -1, 0),
	}

	// Report in review
	s.reports["report-003"] = &AuditReport{
		ReportID:         "report-003",
		TenantID:         tenantID,
		EngagementID:     "eng-001",
		ReportTitle:      "Branch Operations Audit - Lagos Main - Draft Report",
		ReportType:       "draft",
		ExecutiveSummary: "Preliminary findings from the branch operations audit indicate control weaknesses in reconciliation review and dual authorization processes.",
		Scope:            "Cash handling, customer service, and operational controls at Lagos Main branch",
		Methodology:      "Control testing, observation, and documentation review",
		Findings:         []string{"find-001", "find-002"},
		OverallRating:    "unsatisfactory",
		Recommendations:  []string{"Implement automated reconciliation workflow", "Enforce dual authorization controls", "Increase supervisory oversight"},
		PreparedBy:       "auditor-002",
		ReviewedBy:       "auditor-001",
		Status:           "review",
		Distribution:     []string{"COO", "Branch Manager", "Operations Manager"},
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, 0, -3),
		UpdatedAt:        time.Now().AddDate(0, 0, -1),
	}
}

// ListReports returns reports based on filters
func (s *ReportService) ListReports(tenantID, status string) []*AuditReport {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*AuditReport
	for _, report := range s.reports {
		if report.TenantID != tenantID {
			continue
		}
		if status != "" && report.Status != status {
			continue
		}
		result = append(result, report)
	}
	return result
}

// GetReport retrieves a report by ID
func (s *ReportService) GetReport(tenantID, reportID string) (*AuditReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}
	return report, nil
}

// CreateReport creates a new report
func (s *ReportService) CreateReport(tenantID, auditorID string, report *AuditReport) (*AuditReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report.ReportID = uuid.New().String()
	report.TenantID = tenantID
	report.ReportType = "draft"
	report.Status = "draft"
	report.PreparedBy = auditorID
	report.Metadata = make(map[string]interface{})
	report.CreatedAt = time.Now()
	report.UpdatedAt = time.Now()

	s.reports[report.ReportID] = report
	return report, nil
}

// UpdateReport updates a report
func (s *ReportService) UpdateReport(report *AuditReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.reports[report.ReportID]
	if !exists || existing.TenantID != report.TenantID {
		return errors.New("report not found")
	}

	report.CreatedAt = existing.CreatedAt
	report.UpdatedAt = time.Now()
	s.reports[report.ReportID] = report
	return nil
}

// ReviewReport marks report as reviewed
func (s *ReportService) ReviewReport(tenantID, reportID, reviewerID string) (*AuditReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}

	if report.Status != "draft" {
		return nil, errors.New("report is not in draft status")
	}

	report.ReviewedBy = reviewerID
	report.Status = "review"
	report.UpdatedAt = time.Now()

	return report, nil
}

// ApproveReport approves a report
func (s *ReportService) ApproveReport(tenantID, reportID, approverID string) (*AuditReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}

	if report.Status != "review" {
		return nil, errors.New("report is not in review status")
	}

	report.ApprovedBy = approverID
	report.ReportType = "final"
	report.Status = "approved"
	report.UpdatedAt = time.Now()

	return report, nil
}

// IssueReport issues a report
func (s *ReportService) IssueReport(tenantID, reportID string) (*AuditReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	report, exists := s.reports[reportID]
	if !exists || report.TenantID != tenantID {
		return nil, errors.New("report not found")
	}

	if report.Status != "approved" {
		return nil, errors.New("report is not approved")
	}

	now := time.Now()
	report.IssuedDate = &now
	report.Status = "issued"
	report.UpdatedAt = now

	return report, nil
}
