package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// StaffService handles staff operations
type StaffService struct {
	tenantID string
	staff    map[string]*BranchStaff
	mu       sync.RWMutex
}

// NewStaffService creates a new staff service
func NewStaffService(tenantID string) *StaffService {
	return &StaffService{
		tenantID: tenantID,
		staff:    make(map[string]*BranchStaff),
	}
}

// ListStaff returns staff based on filters
func (s *StaffService) ListStaff(tenantID, branchID, role, status string) []*BranchStaff {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*BranchStaff
	for _, st := range s.staff {
		if st.TenantID != tenantID {
			continue
		}
		if branchID != "" && st.BranchID != branchID {
			continue
		}
		if role != "" && st.Role != role {
			continue
		}
		if status != "" && st.Status != status {
			continue
		}
		result = append(result, st)
	}
	return result
}

// GetStaff retrieves a staff member by ID
func (s *StaffService) GetStaff(tenantID, staffID string) (*BranchStaff, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	st, exists := s.staff[staffID]
	if !exists || st.TenantID != tenantID {
		return nil, errors.New("staff not found")
	}
	return st, nil
}

// CreateStaff creates a new staff member
func (s *StaffService) CreateStaff(tenantID, branchID string, req *CreateStaffRequest) (*BranchStaff, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	st := &BranchStaff{
		StaffID:        uuid.New().String(),
		TenantID:       tenantID,
		BranchID:       branchID,
		EmployeeID:     req.EmployeeID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		Email:          req.Email,
		Phone:          req.Phone,
		Role:           req.Role,
		Department:     req.Department,
		Status:         "active",
		JoinDate:       time.Now(),
		Supervisor:     req.Supervisor,
		Skills:         req.Skills,
		Certifications: req.Certifications,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	s.staff[st.StaffID] = st
	return st, nil
}

// UpdateStaff updates a staff member
func (s *StaffService) UpdateStaff(st *BranchStaff) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.staff[st.StaffID]
	if !exists || existing.TenantID != st.TenantID {
		return errors.New("staff not found")
	}

	st.CreatedAt = existing.CreatedAt
	st.JoinDate = existing.JoinDate
	st.UpdatedAt = time.Now()
	s.staff[st.StaffID] = st
	return nil
}

// UpdateStaffStatus updates staff status
func (s *StaffService) UpdateStaffStatus(tenantID, staffID, status string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, exists := s.staff[staffID]
	if !exists || st.TenantID != tenantID {
		return errors.New("staff not found")
	}

	st.Status = status
	st.UpdatedAt = time.Now()
	return nil
}

// TransferStaff transfers staff to another branch
func (s *StaffService) TransferStaff(tenantID, staffID, toBranchID, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, exists := s.staff[staffID]
	if !exists || st.TenantID != tenantID {
		return errors.New("staff not found")
	}

	st.BranchID = toBranchID
	st.UpdatedAt = time.Now()
	return nil
}

// GetStaffByBranch returns all staff for a branch
func (s *StaffService) GetStaffByBranch(tenantID, branchID string) []*BranchStaff {
	return s.ListStaff(tenantID, branchID, "", "")
}

// GetActiveStaffCount returns count of active staff
func (s *StaffService) GetActiveStaffCount(tenantID, branchID string) int {
	staff := s.ListStaff(tenantID, branchID, "", "active")
	return len(staff)
}
