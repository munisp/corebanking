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
	staff    *repo[BranchStaff]
	mu       sync.RWMutex
}

// NewStaffService creates a new staff service
func NewStaffService(tenantID string) *StaffService {
	return &StaffService{
		tenantID: tenantID,
		staff:    newRepo[BranchStaff](serviceDB, "branch_staff"),
	}
}

// ListStaff returns staff based on filters
func (s *StaffService) ListStaff(tenantID, branchID, role, status string) ([]*BranchStaff, error) {

	var result []*BranchStaff
	__ALL__, __ERR__ := s.staff.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, st := range __ALL__ {
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
	return result, nil
}

// GetStaff retrieves a staff member by ID
func (s *StaffService) GetStaff(tenantID, staffID string) (*BranchStaff, error) {

	st, err := s.staff.get(tenantID, staffID)
	if err != nil {
		return nil, errors.New("staff not found")
	}
	return st, nil
}

// CreateStaff creates a new staff member
func (s *StaffService) CreateStaff(tenantID, branchID string, req *CreateStaffRequest) (*BranchStaff, error) {

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

	if err := s.staff.put(tenantID, st.StaffID, st); err != nil {
		return nil, err
	}
	return st, nil
}

// UpdateStaff updates a staff member
func (s *StaffService) UpdateStaff(st *BranchStaff) error {

	existing, err := s.staff.get(st.TenantID, st.StaffID)
	if err != nil {
		return errors.New("staff not found")
	}

	st.CreatedAt = existing.CreatedAt
	st.JoinDate = existing.JoinDate
	st.UpdatedAt = time.Now()
	return s.staff.put(st.TenantID, st.StaffID, st)
}

// UpdateStaffStatus updates staff status
func (s *StaffService) UpdateStaffStatus(tenantID, staffID, status string) error {

	_, err := s.staff.update(tenantID, staffID, func(st *BranchStaff) error {
		st.Status = status
		st.UpdatedAt = time.Now()
		return nil
	})
	return err
}

// TransferStaff transfers staff to another branch
func (s *StaffService) TransferStaff(tenantID, staffID, toBranchID, reason string) error {

	_, err := s.staff.update(tenantID, staffID, func(st *BranchStaff) error {
		st.BranchID = toBranchID
		st.UpdatedAt = time.Now()
		_ = reason // recorded by the audit layer (appendAudit); no free-text field on BranchStaff
		return nil
	})
	return err
}

// GetStaffByBranch returns all staff for a branch
func (s *StaffService) GetStaffByBranch(tenantID, branchID string) ([]*BranchStaff, error) {
	return s.ListStaff(tenantID, branchID, "", "")
}

// GetActiveStaffCount returns count of active staff
func (s *StaffService) GetActiveStaffCount(tenantID, branchID string) (int, error) {
	staff, err := s.ListStaff(tenantID, branchID, "", "active")
	if err != nil {
		return 0, err
	}
	return len(staff), nil
}
