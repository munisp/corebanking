package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// IncidentService handles incident operations
type IncidentService struct {
	tenantID  string
	incidents *repo[BranchIncident]
	mu        sync.RWMutex
}

// NewIncidentService creates a new incident service
func NewIncidentService(tenantID string) *IncidentService {
	return &IncidentService{
		tenantID:  tenantID,
		incidents: newRepo[BranchIncident](serviceDB, "branch_incidents"),
	}
}

// ListIncidents returns incidents based on filters
func (s *IncidentService) ListIncidents(tenantID, branchID, status, severity string) ([]*BranchIncident, error) {

	var result []*BranchIncident
	__ALL__, __ERR__ := s.incidents.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, incident := range __ALL__ {
		if incident.TenantID != tenantID {
			continue
		}
		if branchID != "" && incident.BranchID != branchID {
			continue
		}
		if status != "" && incident.Status != status {
			continue
		}
		if severity != "" && incident.Severity != severity {
			continue
		}
		result = append(result, incident)
	}
	return result, nil
}

// GetIncident retrieves an incident by ID
func (s *IncidentService) GetIncident(tenantID, incidentID string) (*BranchIncident, error) {

	incident, err := s.incidents.get(tenantID, incidentID)
	if err != nil {
		return nil, errors.New("incident not found")
	}
	return incident, nil
}

// CreateIncident creates a new incident
func (s *IncidentService) CreateIncident(tenantID, branchID, userID string, req *CreateIncidentRequest) (*BranchIncident, error) {

	incident := &BranchIncident{
		IncidentID:   uuid.New().String(),
		TenantID:     tenantID,
		BranchID:     branchID,
		IncidentType: req.IncidentType,
		Severity:     req.Severity,
		Title:        req.Title,
		Description:  req.Description,
		ReportedBy:   userID,
		ReportedAt:   time.Now(),
		Status:       "open",
		Attachments:  req.Attachments,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.incidents.put(tenantID, incident.IncidentID, incident); err != nil {
		return nil, err
	}
	return incident, nil
}

// UpdateIncident updates an incident
func (s *IncidentService) UpdateIncident(incident *BranchIncident) error {

	existing, err := s.incidents.get(incident.TenantID, incident.IncidentID)
	if err != nil {
		return errors.New("incident not found")
	}

	incident.CreatedAt = existing.CreatedAt
	incident.ReportedBy = existing.ReportedBy
	incident.ReportedAt = existing.ReportedAt
	incident.UpdatedAt = time.Now()
	return s.incidents.put(incident.TenantID, incident.IncidentID, incident)
}

// AssignIncident assigns an incident to a staff member
func (s *IncidentService) AssignIncident(tenantID, incidentID, assignTo string) (*BranchIncident, error) {
	return s.incidents.update(tenantID, incidentID, func(incident *BranchIncident) error {
		incident.AssignedTo = assignTo
		incident.Status = "investigating"
		incident.UpdatedAt = time.Now()

		return nil
	})
}

// ResolveIncident resolves an incident
func (s *IncidentService) ResolveIncident(tenantID, incidentID, userID, resolution string) (*BranchIncident, error) {
	return s.incidents.update(tenantID, incidentID, func(incident *BranchIncident) error {
		now := time.Now()
		incident.Status = "resolved"
		incident.Resolution = resolution
		incident.ResolvedBy = userID
		incident.ResolvedAt = &now
		incident.UpdatedAt = time.Now()

		return nil
	})
}

// CloseIncident closes an incident
func (s *IncidentService) CloseIncident(tenantID, incidentID, userID string) (*BranchIncident, error) {
	return s.incidents.update(tenantID, incidentID, func(incident *BranchIncident) error {
		if incident.Status != "resolved" {
			return errors.New("can only close resolved incidents")
		}

		incident.Status = "closed"
		incident.UpdatedAt = time.Now()

		return nil
	})
}

// GetOpenIncidentsCount returns count of open incidents
func (s *IncidentService) GetOpenIncidentsCount(tenantID, branchID string) (int, error) {
	incidents, err := s.ListIncidents(tenantID, branchID, "open", "")
	if err != nil {
		return 0, err
	}
	investigating, err := s.ListIncidents(tenantID, branchID, "investigating", "")
	if err != nil {
		return 0, err
	}
	return len(incidents) + len(investigating), nil
}

// GetCriticalIncidentsCount returns count of critical incidents
func (s *IncidentService) GetCriticalIncidentsCount(tenantID, branchID string) (int, error) {
	incidents, err := s.ListIncidents(tenantID, branchID, "", "critical")
	if err != nil {
		return 0, err
	}
	count := 0
	for _, inc := range incidents {
		if inc.Status == "open" || inc.Status == "investigating" {
			count++
		}
	}
	return count, nil
}
