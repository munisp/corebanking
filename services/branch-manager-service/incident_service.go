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
	incidents map[string]*BranchIncident
	mu        sync.RWMutex
}

// NewIncidentService creates a new incident service
func NewIncidentService(tenantID string) *IncidentService {
	return &IncidentService{
		tenantID:  tenantID,
		incidents: make(map[string]*BranchIncident),
	}
}

// ListIncidents returns incidents based on filters
func (s *IncidentService) ListIncidents(tenantID, branchID, status, severity string) []*BranchIncident {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*BranchIncident
	for _, incident := range s.incidents {
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
	return result
}

// GetIncident retrieves an incident by ID
func (s *IncidentService) GetIncident(tenantID, incidentID string) (*BranchIncident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	incident, exists := s.incidents[incidentID]
	if !exists || incident.TenantID != tenantID {
		return nil, errors.New("incident not found")
	}
	return incident, nil
}

// CreateIncident creates a new incident
func (s *IncidentService) CreateIncident(tenantID, branchID, userID string, req *CreateIncidentRequest) (*BranchIncident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

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

	s.incidents[incident.IncidentID] = incident
	return incident, nil
}

// UpdateIncident updates an incident
func (s *IncidentService) UpdateIncident(incident *BranchIncident) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.incidents[incident.IncidentID]
	if !exists || existing.TenantID != incident.TenantID {
		return errors.New("incident not found")
	}

	incident.CreatedAt = existing.CreatedAt
	incident.ReportedBy = existing.ReportedBy
	incident.ReportedAt = existing.ReportedAt
	incident.UpdatedAt = time.Now()
	s.incidents[incident.IncidentID] = incident
	return nil
}

// AssignIncident assigns an incident to a staff member
func (s *IncidentService) AssignIncident(tenantID, incidentID, assignTo string) (*BranchIncident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	incident, exists := s.incidents[incidentID]
	if !exists || incident.TenantID != tenantID {
		return nil, errors.New("incident not found")
	}

	incident.AssignedTo = assignTo
	incident.Status = "investigating"
	incident.UpdatedAt = time.Now()

	return incident, nil
}

// ResolveIncident resolves an incident
func (s *IncidentService) ResolveIncident(tenantID, incidentID, userID, resolution string) (*BranchIncident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	incident, exists := s.incidents[incidentID]
	if !exists || incident.TenantID != tenantID {
		return nil, errors.New("incident not found")
	}

	now := time.Now()
	incident.Status = "resolved"
	incident.Resolution = resolution
	incident.ResolvedBy = userID
	incident.ResolvedAt = &now
	incident.UpdatedAt = time.Now()

	return incident, nil
}

// CloseIncident closes an incident
func (s *IncidentService) CloseIncident(tenantID, incidentID, userID string) (*BranchIncident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	incident, exists := s.incidents[incidentID]
	if !exists || incident.TenantID != tenantID {
		return nil, errors.New("incident not found")
	}

	if incident.Status != "resolved" {
		return nil, errors.New("can only close resolved incidents")
	}

	incident.Status = "closed"
	incident.UpdatedAt = time.Now()

	return incident, nil
}

// GetOpenIncidentsCount returns count of open incidents
func (s *IncidentService) GetOpenIncidentsCount(tenantID, branchID string) int {
	incidents := s.ListIncidents(tenantID, branchID, "open", "")
	investigating := s.ListIncidents(tenantID, branchID, "investigating", "")
	return len(incidents) + len(investigating)
}

// GetCriticalIncidentsCount returns count of critical incidents
func (s *IncidentService) GetCriticalIncidentsCount(tenantID, branchID string) int {
	incidents := s.ListIncidents(tenantID, branchID, "", "critical")
	count := 0
	for _, inc := range incidents {
		if inc.Status == "open" || inc.Status == "investigating" {
			count++
		}
	}
	return count
}
