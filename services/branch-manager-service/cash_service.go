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
	cashRecords  *repo[CashManagement]
	cashRequests *repo[CashRequest]
	mu           sync.RWMutex
}

// NewCashService creates a new cash service
func NewCashService(tenantID string) *CashService {
	return &CashService{
		tenantID:     tenantID,
		cashRecords:  newRepo[CashManagement](serviceDB, "cash_management"),
		cashRequests: newRepo[CashRequest](serviceDB, "cash_requests"),
	}
}

// GetCashPosition returns current cash position. Fail-closed: when no real
// reconciled record exists for today an error is returned — fabricated
// balances are never served on a money path.
func (s *CashService) GetCashPosition(tenantID, branchID string) (*CashManagement, error) {

	today := time.Now().Format("2006-01-02")
	key := branchID + "-" + today

	record, err := s.cashRecords.get(tenantID, key)
	if err != nil {
		return nil, err
	}
	return record, nil
}

// GetDailyCash returns cash record for a specific date. Fail-closed on miss.
func (s *CashService) GetDailyCash(tenantID, branchID, date string) (*CashManagement, error) {

	key := branchID + "-" + date
	record, err := s.cashRecords.get(tenantID, key)
	if err != nil {
		return nil, err
	}
	return record, nil
}

// ReconcileCash reconciles daily cash
func (s *CashService) ReconcileCash(tenantID, branchID, userID, date, notes string) (*CashManagement, error) {

	key := branchID + "-" + date
	return s.cashRecords.update(tenantID, key, func(record *CashManagement) error {
		record.Status = "reconciled"
		record.ReconciliationNotes = notes
		record.ReconcililedBy = userID
		record.UpdatedAt = time.Now()
		return nil
	})
}

// ListCashRequests returns cash requests
func (s *CashService) ListCashRequests(tenantID, branchID, status string) ([]*CashRequest, error) {

	var result []*CashRequest
	__ALL__, __ERR__ := s.cashRequests.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, req := range __ALL__ {
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
	return result, nil
}

// GetCashRequest retrieves a cash request
func (s *CashService) GetCashRequest(tenantID, requestID string) (*CashRequest, error) {

	req, err := s.cashRequests.get(tenantID, requestID)
	if err != nil {
		return nil, errors.New("cash request not found")
	}
	return req, nil
}

// CreateCashRequest creates a new cash request
func (s *CashService) CreateCashRequest(tenantID, branchID, userID string, req *CreateCashRequestPayload) (*CashRequest, error) {

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

	if err := s.cashRequests.put(tenantID, cashReq.RequestID, cashReq); err != nil {
		return nil, err
	}
	return cashReq, nil
}

// ApproveCashRequest approves a cash request
func (s *CashService) ApproveCashRequest(tenantID, requestID, userID string) (*CashRequest, error) {

	return s.cashRequests.update(tenantID, requestID, func(req *CashRequest) error {
		if req.Status != "pending" {
			return errors.New("can only approve pending requests")
		}
		now := time.Now()
		req.Status = "approved"
		req.ApprovedBy = userID
		req.ApprovedAt = &now
		req.UpdatedAt = time.Now()
		return nil
	})
}

// CompleteCashRequest marks a cash request as completed
func (s *CashService) CompleteCashRequest(tenantID, requestID, notes string) (*CashRequest, error) {

	return s.cashRequests.update(tenantID, requestID, func(req *CashRequest) error {
		if req.Status != "approved" && req.Status != "in_transit" {
			return errors.New("can only complete approved or in-transit requests")
		}
		now := time.Now()
		req.Status = "completed"
		req.CompletedAt = &now
		req.Notes = notes
		req.UpdatedAt = time.Now()
		return nil
	})
}
