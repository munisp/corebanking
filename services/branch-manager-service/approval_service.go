package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ApprovalService handles approval operations
type ApprovalService struct {
	tenantID  string
	approvals *repo[ApprovalRequest]
	mu        sync.RWMutex
}

// NewApprovalService creates a new approval service
func NewApprovalService(tenantID string) *ApprovalService {
	return &ApprovalService{
		tenantID:  tenantID,
		approvals: newRepo[ApprovalRequest](serviceDB, "approval_requests"),
	}
}

// ListApprovals returns approvals based on filters
func (s *ApprovalService) ListApprovals(tenantID, branchID, status, requestType string) ([]*ApprovalRequest, error) {

	var result []*ApprovalRequest
	__ALL__, __ERR__ := s.approvals.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, approval := range __ALL__ {
		if approval.TenantID != tenantID {
			continue
		}
		if branchID != "" && approval.BranchID != branchID {
			continue
		}
		if status != "" && approval.Status != status {
			continue
		}
		if requestType != "" && approval.RequestType != requestType {
			continue
		}
		result = append(result, approval)
	}
	return result, nil
}

// GetApproval retrieves an approval by ID
func (s *ApprovalService) GetApproval(tenantID, requestID string) (*ApprovalRequest, error) {

	approval, err := s.approvals.get(tenantID, requestID)
	if err != nil {
		return nil, errors.New("approval request not found")
	}
	return approval, nil
}

// CreateApproval creates a new approval request
func (s *ApprovalService) CreateApproval(tenantID, branchID, userID string, req *CreateApprovalRequest) (*ApprovalRequest, error) {

	approval := &ApprovalRequest{
		RequestID:    uuid.New().String(),
		TenantID:     tenantID,
		BranchID:     branchID,
		RequestType:  req.RequestType,
		ReferenceID:  req.ReferenceID,
		RequestedBy:  userID,
		CustomerID:   req.CustomerID,
		CustomerName: req.CustomerName,
		Amount:       req.Amount,
		Currency:     req.Currency,
		Description:  req.Description,
		Priority:     req.Priority,
		Status:       "pending",
		Details:      req.Details,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// Set due date based on priority
	switch req.Priority {
	case "urgent":
		dueDate := time.Now().Add(2 * time.Hour)
		approval.DueDate = &dueDate
	case "high":
		dueDate := time.Now().Add(4 * time.Hour)
		approval.DueDate = &dueDate
	case "medium":
		dueDate := time.Now().Add(24 * time.Hour)
		approval.DueDate = &dueDate
	default:
		dueDate := time.Now().Add(48 * time.Hour)
		approval.DueDate = &dueDate
	}

	if err := s.approvals.put(tenantID, approval.RequestID, approval); err != nil {
		return nil, err
	}
	return approval, nil
}

// ApproveRequest approves a request
func (s *ApprovalService) ApproveRequest(tenantID, userID string, req *ApproveRequestPayload) (*ApprovalRequest, error) {
	return s.approvals.update(tenantID, req.RequestID, func(approval *ApprovalRequest) error {
		if approval.Status != "pending" {
			return errors.New("can only approve pending requests")
		}

		now := time.Now()
		approval.Status = "approved"
		approval.ApprovedBy = userID
		approval.ApprovedAt = &now
		approval.UpdatedAt = time.Now()

		return nil
	})
}

// RejectRequest rejects a request
func (s *ApprovalService) RejectRequest(tenantID, userID string, req *RejectRequestPayload) (*ApprovalRequest, error) {
	return s.approvals.update(tenantID, req.RequestID, func(approval *ApprovalRequest) error {
		if approval.Status != "pending" {
			return errors.New("can only reject pending requests")
		}

		now := time.Now()
		approval.Status = "rejected"
		approval.ApprovedBy = userID
		approval.ApprovedAt = &now
		approval.RejectionNote = req.Reason
		approval.UpdatedAt = time.Now()

		return nil
	})
}

// EscalateRequest escalates a request
func (s *ApprovalService) EscalateRequest(tenantID, requestID, userID, escalateTo, reason string) (*ApprovalRequest, error) {
	return s.approvals.update(tenantID, requestID, func(approval *ApprovalRequest) error {
		if approval.Status != "pending" {
			return errors.New("can only escalate pending requests")
		}

		now := time.Now()
		approval.Status = "escalated"
		approval.EscalatedTo = escalateTo
		approval.EscalatedAt = &now
		approval.UpdatedAt = time.Now()

		return nil
	})
}

// ListUrgentApprovals returns urgent pending approvals
func (s *ApprovalService) ListUrgentApprovals(tenantID, branchID string) ([]*ApprovalRequest, error) {

	var result []*ApprovalRequest
	__ALL__, __ERR__ := s.approvals.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, approval := range __ALL__ {
		if approval.TenantID != tenantID {
			continue
		}
		if branchID != "" && approval.BranchID != branchID {
			continue
		}
		if approval.Status != "pending" {
			continue
		}
		if approval.Priority == "urgent" || approval.Priority == "high" {
			result = append(result, approval)
		}
	}
	return result, nil
}

// GetPendingCount returns count of pending approvals
func (s *ApprovalService) GetPendingCount(tenantID, branchID string) (int, error) {
	approvals, err := s.ListApprovals(tenantID, branchID, "pending", "")
	if err != nil {
		return 0, err
	}
	return len(approvals), nil
}
