package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// BranchService handles branch operations
type BranchService struct {
	tenantID string
	branches *repo[Branch]
	mu       sync.RWMutex
}

// NewBranchService creates a new branch service
func NewBranchService(tenantID string) *BranchService {
	svc := &BranchService{
		tenantID: tenantID,
		branches: newRepo[Branch](serviceDB, "bm_branches"),
	}
	svc.initializeDefaultBranches()
	return svc
}

// initializeDefaultBranches creates sample branches
func (s *BranchService) initializeDefaultBranches() {
	defaultBranches := []Branch{
		{
			BranchID:    uuid.New().String(),
			TenantID:    s.tenantID,
			BranchCode:  "HQ001",
			BranchName:  "Head Office",
			BranchType:  "main",
			Region:      "Lagos",
			State:       "Lagos",
			LGA:         "Lagos Island",
			Address:     "1 Marina Street, Lagos Island",
			Phone:       "+234-1-2345678",
			Email:       "headoffice@54bank.com",
			Status:      "active",
			OpeningTime: "08:00",
			ClosingTime: "16:00",
			WorkingDays: []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
			Latitude:    6.4541,
			Longitude:   3.3947,
		},
		{
			BranchID:    uuid.New().String(),
			TenantID:    s.tenantID,
			BranchCode:  "VI001",
			BranchName:  "Victoria Island Branch",
			BranchType:  "regional",
			Region:      "Lagos",
			State:       "Lagos",
			LGA:         "Eti-Osa",
			Address:     "25 Adeola Odeku Street, Victoria Island",
			Phone:       "+234-1-2345679",
			Email:       "vi@54bank.com",
			Status:      "active",
			OpeningTime: "08:00",
			ClosingTime: "16:00",
			WorkingDays: []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
			Latitude:    6.4281,
			Longitude:   3.4219,
		},
		{
			BranchID:    uuid.New().String(),
			TenantID:    s.tenantID,
			BranchCode:  "IK001",
			BranchName:  "Ikeja Branch",
			BranchType:  "regional",
			Region:      "Lagos",
			State:       "Lagos",
			LGA:         "Ikeja",
			Address:     "10 Allen Avenue, Ikeja",
			Phone:       "+234-1-2345680",
			Email:       "ikeja@54bank.com",
			Status:      "active",
			OpeningTime: "08:00",
			ClosingTime: "16:00",
			WorkingDays: []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
			Latitude:    6.6018,
			Longitude:   3.3515,
		},
		{
			BranchID:    uuid.New().String(),
			TenantID:    s.tenantID,
			BranchCode:  "ABJ001",
			BranchName:  "Abuja Main Branch",
			BranchType:  "regional",
			Region:      "North Central",
			State:       "FCT",
			LGA:         "Abuja Municipal",
			Address:     "15 Ahmadu Bello Way, Wuse",
			Phone:       "+234-9-2345678",
			Email:       "abuja@54bank.com",
			Status:      "active",
			OpeningTime: "08:00",
			ClosingTime: "16:00",
			WorkingDays: []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
			Latitude:    9.0765,
			Longitude:   7.3986,
		},
		{
			BranchID:    uuid.New().String(),
			TenantID:    s.tenantID,
			BranchCode:  "PH001",
			BranchName:  "Port Harcourt Branch",
			BranchType:  "regional",
			Region:      "South South",
			State:       "Rivers",
			LGA:         "Port Harcourt",
			Address:     "20 Aba Road, Port Harcourt",
			Phone:       "+234-84-2345678",
			Email:       "portharcourt@54bank.com",
			Status:      "active",
			OpeningTime: "08:00",
			ClosingTime: "16:00",
			WorkingDays: []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"},
			Latitude:    4.8156,
			Longitude:   7.0498,
		},
	}

	for _, branch := range defaultBranches {
		branch := branch
		branch.CreatedAt = time.Now()
		branch.UpdatedAt = time.Now()
		s.branches.seed(s.tenantID, branch.BranchID, &branch)
	}
}

// ListBranches returns branches based on filters
func (s *BranchService) ListBranches(tenantID, region, status string) ([]*Branch, error) {

	var result []*Branch
	__ALL__, __ERR__ := s.branches.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	if s.tenantID != tenantID {
		more, err := s.branches.list(s.tenantID)
		if err != nil {
			return nil, err
		}
		__ALL__ = append(__ALL__, more...)
	}
	for _, branch := range __ALL__ {
		if branch.TenantID != tenantID && branch.TenantID != s.tenantID {
			continue
		}
		if region != "" && branch.Region != region {
			continue
		}
		if status != "" && branch.Status != status {
			continue
		}
		result = append(result, branch)
	}
	return result, nil
}

// getBranch loads a branch, falling back to the service tenant (seeded
// branches live under the service tenant, matching the legacy map semantics).
func (s *BranchService) getBranch(tenantID, branchID string) (*Branch, error) {
	branch, err := s.branches.get(tenantID, branchID)
	if errors.Is(err, ErrNotFound) && tenantID != s.tenantID {
		return s.branches.get(s.tenantID, branchID)
	}
	return branch, err
}

// updateBranch is the transactional counterpart of getBranch.
func (s *BranchService) updateBranch(tenantID, branchID string, fn func(*Branch) error) (*Branch, error) {
	branch, err := s.branches.update(tenantID, branchID, fn)
	if errors.Is(err, ErrNotFound) && tenantID != s.tenantID {
		return s.branches.update(s.tenantID, branchID, fn)
	}
	return branch, err
}

// GetBranch retrieves a branch by ID
func (s *BranchService) GetBranch(tenantID, branchID string) (*Branch, error) {
	branch, err := s.getBranch(tenantID, branchID)
	if err != nil {
		return nil, errors.New("branch not found")
	}
	return branch, nil
}

// CreateBranch creates a new branch
func (s *BranchService) CreateBranch(tenantID string, req *CreateBranchRequest) (*Branch, error) {

	branch := &Branch{
		BranchID:    uuid.New().String(),
		TenantID:    tenantID,
		BranchCode:  req.BranchCode,
		BranchName:  req.BranchName,
		BranchType:  req.BranchType,
		Region:      req.Region,
		State:       req.State,
		LGA:         req.LGA,
		Address:     req.Address,
		Phone:       req.Phone,
		Email:       req.Email,
		Status:      "active",
		OpeningTime: req.OpeningTime,
		ClosingTime: req.ClosingTime,
		WorkingDays: req.WorkingDays,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.branches.put(tenantID, branch.BranchID, branch); err != nil {
		return nil, err
	}
	return branch, nil
}

// UpdateBranch updates a branch
func (s *BranchService) UpdateBranch(branch *Branch) error {

	existing, err := s.getBranch(branch.TenantID, branch.BranchID)
	if err != nil {
		return errors.New("branch not found")
	}

	branch.CreatedAt = existing.CreatedAt
	branch.UpdatedAt = time.Now()
	return s.branches.put(branch.TenantID, branch.BranchID, branch)
}

// UpdateBranchStatus updates branch status
func (s *BranchService) UpdateBranchStatus(tenantID, branchID, status string) error {

	_, err := s.updateBranch(tenantID, branchID, func(branch *Branch) error {
		branch.Status = status
		branch.UpdatedAt = time.Now()
		return nil
	})
	return err
}

// AssignManager assigns a manager to a branch
func (s *BranchService) AssignManager(tenantID, branchID, managerID, managerName string) error {

	_, err := s.updateBranch(tenantID, branchID, func(branch *Branch) error {
		branch.ManagerID = managerID
		branch.ManagerName = managerName
		branch.UpdatedAt = time.Now()
		return nil
	})
	return err
}
