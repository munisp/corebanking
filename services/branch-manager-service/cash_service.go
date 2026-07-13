package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// CashService handles cash management operations
type CashService struct {
	tenantID     string
	cashRecords  map[string]*CashManagement
	cashRequests map[string]*CashRequest
	mu           sync.RWMutex
}

// NewCashService creates a new cash service
func NewCashService(tenantID string) *CashService {
	return &CashService{
		tenantID:     tenantID,
		cashRecords:  make(map[string]*CashManagement),
		cashRequests: make(map[string]*CashRequest),
	}
}

// GetCashPosition returns current cash position
func (s *CashService) GetCashPosition(tenantID, branchID string) *CashManagement {
	s.mu.RLock()
	defer s.mu.RUnlock()

	today := time.Now().Format("2006-01-02")
	key := branchID + "-" + today

	if record, exists := s.cashRecords[key]; exists {
		return record
	}

	// Return default cash position
	return &CashManagement{
		RecordID:       uuid.New().String(),
		TenantID:       tenantID,
		BranchID:       branchID,
		Date:           time.Now(),
		OpeningBalance: 50000000000,
		ClosingBalance: 55000000000,
		TotalCashIn:    25000000000,
		TotalCashOut:   20000000000,
		VaultBalance:   30000000000,
		TellerBalances: map[string]int64{
			"teller_1": 5000000000,
			"teller_2": 5000000000,
			"teller_3": 5000000000,
			"teller_4": 5000000000,
		},
		CashLimit:    100000000000,
		ExcessCash:   0,
		CashShortage: 0,
		Status:       "open",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// GetDailyCash returns cash record for a specific date
func (s *CashService) GetDailyCash(tenantID, branchID, date string) *CashManagement {
	s.mu.RLock()
	defer s.mu.RUnlock()

	key := branchID + "-" + date
	if record, exists := s.cashRecords[key]; exists {
		return record
	}

	return s.GetCashPosition(tenantID, branchID)
}

// ReconcileCash reconciles daily cash
func (s *CashService) ReconcileCash(tenantID, branchID, userID, date, notes string) (*CashManagement, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := branchID + "-" + date
	record, exists := s.cashRecords[key]
	if !exists {
		record = &CashManagement{
			RecordID:       uuid.New().String(),
			TenantID:       tenantID,
			BranchID:       branchID,
			Date:           time.Now(),
			OpeningBalance: 50000000000,
			ClosingBalance: 55000000000,
			TotalCashIn:    25000000000,
			TotalCashOut:   20000000000,
			VaultBalance:   30000000000,
			TellerBalances: map[string]int64{
				"teller_1": 5000000000,
				"teller_2": 5000000000,
				"teller_3": 5000000000,
				"teller_4": 5000000000,
			},
			CashLimit: 100000000000,
			Status:    "open",
			CreatedAt: time.Now(),
		}
	}

	record.Status = "reconciled"
	record.ReconciliationNotes = notes
	record.ReconcililedBy = userID
	record.UpdatedAt = time.Now()

	s.cashRecords[key] = record
	return record, nil
}

// ListCashRequests returns cash requests
func (s *CashService) ListCashRequests(tenantID, branchID, status string) []*CashRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CashRequest
	for _, req := range s.cashRequests {
		if req.TenantID != tenantID {
			continue
		}
		if branchID != "" && req.BranchID != branchID {
			continue
		}
		if status != "" && req.Status != status {
			continue
		}
		result = append(result, req)
	}
	return result
}

// GetCashRequest retrieves a cash request
func (s *CashService) GetCashRequest(tenantID, requestID string) (*CashRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	req, exists := s.cashRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("cash request not found")
	}
	return req, nil
}

// CreateCashRequest creates a new cash request
func (s *CashService) CreateCashRequest(tenantID, branchID, userID string, req *CreateCashRequestPayload) (*CashRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var scheduledDate *time.Time
	if req.ScheduledDate != "" {
		t, err := time.Parse("2006-01-02", req.ScheduledDate)
		if err == nil {
			scheduledDate = &t
		}
	}

	cashReq := &CashRequest{
		RequestID:     uuid.New().String(),
		TenantID:      tenantID,
		BranchID:      branchID,
		RequestType:   req.RequestType,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Reason:        req.Reason,
		Priority:      req.Priority,
		Status:        "pending",
		RequestedBy:   userID,
		ScheduledDate: scheduledDate,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	s.cashRequests[cashReq.RequestID] = cashReq
	return cashReq, nil
}

// ApproveCashRequest approves a cash request
func (s *CashService) ApproveCashRequest(tenantID, requestID, userID string) (*CashRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.cashRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("cash request not found")
	}

	if req.Status != "pending" {
		return nil, errors.New("can only approve pending requests")
	}

	now := time.Now()
	req.Status = "approved"
	req.ApprovedBy = userID
	req.ApprovedAt = &now
	req.UpdatedAt = time.Now()

	return req, nil
}

// CompleteCashRequest marks a cash request as completed
func (s *CashService) CompleteCashRequest(tenantID, requestID, notes string) (*CashRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.cashRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("cash request not found")
	}

	if req.Status != "approved" && req.Status != "in_transit" {
		return nil, errors.New("can only complete approved or in-transit requests")
	}

	now := time.Now()
	req.Status = "completed"
	req.CompletedAt = &now
	req.Notes = notes
	req.UpdatedAt = time.Now()

	return req, nil
}
