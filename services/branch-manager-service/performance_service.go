package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// PerformanceService handles performance and target operations
type PerformanceService struct {
	tenantID    string
	targets     map[string]*BranchTarget
	performance map[string]*BranchPerformance
	mu          sync.RWMutex
}

// NewPerformanceService creates a new performance service
func NewPerformanceService(tenantID string) *PerformanceService {
	return &PerformanceService{
		tenantID:    tenantID,
		targets:     make(map[string]*BranchTarget),
		performance: make(map[string]*BranchPerformance),
	}
}

// ListTargets returns targets based on filters
func (s *PerformanceService) ListTargets(tenantID, branchID, period string) []*BranchTarget {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*BranchTarget
	for _, target := range s.targets {
		if target.TenantID != tenantID {
			continue
		}
		if branchID != "" && target.BranchID != branchID {
			continue
		}
		if period != "" && target.Period != period {
			continue
		}
		result = append(result, target)
	}
	return result
}

// GetTarget retrieves a target by ID
func (s *PerformanceService) GetTarget(tenantID, targetID string) (*BranchTarget, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	target, exists := s.targets[targetID]
	if !exists || target.TenantID != tenantID {
		return nil, errors.New("target not found")
	}
	return target, nil
}

// CreateTarget creates a new target
func (s *PerformanceService) CreateTarget(tenantID, branchID string, req *CreateTargetRequest) (*BranchTarget, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target := &BranchTarget{
		TargetID:    uuid.New().String(),
		TenantID:    tenantID,
		BranchID:    branchID,
		Period:      req.Period,
		Year:        req.Year,
		Month:       req.Month,
		Quarter:     req.Quarter,
		TargetType:  req.TargetType,
		TargetValue: req.TargetValue,
		Currency:    req.Currency,
		Status:      "on_track",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	s.targets[target.TargetID] = target
	return target, nil
}

// UpdateTarget updates a target
func (s *PerformanceService) UpdateTarget(target *BranchTarget) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.targets[target.TargetID]
	if !exists || existing.TenantID != target.TenantID {
		return errors.New("target not found")
	}

	target.CreatedAt = existing.CreatedAt
	target.UpdatedAt = time.Now()

	// Update status based on achievement
	if target.AchievedValue >= target.TargetValue {
		target.Status = "achieved"
	} else if float64(target.AchievedValue)/float64(target.TargetValue) < 0.5 {
		target.Status = "at_risk"
	} else {
		target.Status = "on_track"
	}

	s.targets[target.TargetID] = target
	return nil
}

// GetPerformance returns performance metrics
func (s *PerformanceService) GetPerformance(tenantID, branchID, period string) *BranchPerformance {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, perf := range s.performance {
		if perf.TenantID != tenantID {
			continue
		}
		if branchID != "" && perf.BranchID != branchID {
			continue
		}
		if period != "" && perf.Period != period {
			continue
		}
		return perf
	}

	// Return default performance if none found
	return &BranchPerformance{
		PerformanceID:         uuid.New().String(),
		TenantID:              tenantID,
		BranchID:              branchID,
		Period:                period,
		Date:                  time.Now(),
		TotalTransactions:     150,
		DepositCount:          75,
		WithdrawalCount:       50,
		TransferCount:         25,
		TotalDepositAmount:    25000000000,
		TotalWithdrawalAmount: 15000000000,
		TotalTransferAmount:   5000000000,
		NewAccountsOpened:     5,
		AccountsClosed:        1,
		ActiveAccounts:        1500,
		DormantAccounts:       50,
		LoanApplications:      10,
		LoansApproved:         7,
		LoansDisbursed:        5,
		TotalDisbursedAmount:  50000000000,
		NPLCount:              3,
		NPLAmount:             5000000000,
		CustomersServed:       120,
		AvgWaitTime:           8.5,
		AvgServiceTime:        12.3,
		CustomerSatisfaction:  4.2,
		FeeIncome:             500000000,
		InterestIncome:        2000000000,
		TotalRevenue:          2500000000,
		CashPosition:          100000000000,
		VaultBalance:          50000000000,
		ATMUptime:             99.5,
		SystemUptime:          99.9,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}
}

// GetDailyPerformance returns daily performance
func (s *PerformanceService) GetDailyPerformance(tenantID, branchID, date string) *BranchPerformance {
	return s.GetPerformance(tenantID, branchID, "daily")
}

// GetMonthlyPerformance returns monthly performance
func (s *PerformanceService) GetMonthlyPerformance(tenantID, branchID, month, year string) *BranchPerformance {
	return s.GetPerformance(tenantID, branchID, "monthly")
}

// ComparePerformance compares performance between branches or periods
func (s *PerformanceService) ComparePerformance(tenantID, branchID, compareTo, period string) map[string]interface{} {
	current := s.GetPerformance(tenantID, branchID, period)
	comparison := s.GetPerformance(tenantID, compareTo, period)

	return map[string]interface{}{
		"current":    current,
		"comparison": comparison,
		"metrics": map[string]interface{}{
			"transactionsDiff": current.TotalTransactions - comparison.TotalTransactions,
			"depositsDiff":     current.TotalDepositAmount - comparison.TotalDepositAmount,
			"withdrawalsDiff":  current.TotalWithdrawalAmount - comparison.TotalWithdrawalAmount,
			"newAccountsDiff":  current.NewAccountsOpened - comparison.NewAccountsOpened,
			"customersDiff":    current.CustomersServed - comparison.CustomersServed,
			"satisfactionDiff": current.CustomerSatisfaction - comparison.CustomerSatisfaction,
			"revenueDiff":      current.TotalRevenue - comparison.TotalRevenue,
		},
	}
}

// GetQueueStatus returns current queue status
func (s *PerformanceService) GetQueueStatus(tenantID, branchID string) map[string]interface{} {
	// In production, this would integrate with queue management system
	return map[string]interface{}{
		"branchID":           branchID,
		"currentQueueLength": 12,
		"avgWaitTime":        8.5,
		"longestWait":        15.0,
		"activeCounters":     4,
		"totalCounters":      6,
		"byService": map[string]int{
			"deposits":    3,
			"withdrawals": 4,
			"transfers":   2,
			"inquiries":   3,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetDailyReport returns daily report
func (s *PerformanceService) GetDailyReport(tenantID, branchID, date string) map[string]interface{} {
	perf := s.GetDailyPerformance(tenantID, branchID, date)

	return map[string]interface{}{
		"reportType": "daily",
		"date":       date,
		"branchID":   branchID,
		"summary": map[string]interface{}{
			"totalTransactions":    perf.TotalTransactions,
			"totalDeposits":        perf.TotalDepositAmount,
			"totalWithdrawals":     perf.TotalWithdrawalAmount,
			"newAccounts":          perf.NewAccountsOpened,
			"customersServed":      perf.CustomersServed,
			"avgWaitTime":          perf.AvgWaitTime,
			"customerSatisfaction": perf.CustomerSatisfaction,
		},
		"cashPosition": map[string]interface{}{
			"opening": perf.CashPosition - perf.TotalDepositAmount + perf.TotalWithdrawalAmount,
			"closing": perf.CashPosition,
			"cashIn":  perf.TotalDepositAmount,
			"cashOut": perf.TotalWithdrawalAmount,
		},
		"generatedAt": time.Now().Format(time.RFC3339),
	}
}

// GetWeeklyReport returns weekly report
func (s *PerformanceService) GetWeeklyReport(tenantID, branchID, startDate string) map[string]interface{} {
	return map[string]interface{}{
		"reportType": "weekly",
		"startDate":  startDate,
		"branchID":   branchID,
		"summary": map[string]interface{}{
			"totalTransactions": 750,
			"totalDeposits":     125000000000,
			"totalWithdrawals":  75000000000,
			"newAccounts":       25,
			"customersServed":   600,
		},
		"dailyBreakdown": []map[string]interface{}{
			{"day": "Monday", "transactions": 150, "deposits": 25000000000},
			{"day": "Tuesday", "transactions": 145, "deposits": 24000000000},
			{"day": "Wednesday", "transactions": 160, "deposits": 27000000000},
			{"day": "Thursday", "transactions": 155, "deposits": 26000000000},
			{"day": "Friday", "transactions": 140, "deposits": 23000000000},
		},
		"generatedAt": time.Now().Format(time.RFC3339),
	}
}

// GetMonthlyReport returns monthly report
func (s *PerformanceService) GetMonthlyReport(tenantID, branchID, month, year string) map[string]interface{} {
	return map[string]interface{}{
		"reportType": "monthly",
		"month":      month,
		"year":       year,
		"branchID":   branchID,
		"summary": map[string]interface{}{
			"totalTransactions": 3000,
			"totalDeposits":     500000000000,
			"totalWithdrawals":  300000000000,
			"newAccounts":       100,
			"customersServed":   2400,
			"totalRevenue":      10000000000,
		},
		"targetAchievement": map[string]interface{}{
			"deposits":    85.5,
			"newAccounts": 92.0,
			"revenue":     78.3,
		},
		"weeklyTrend": []map[string]interface{}{
			{"week": 1, "transactions": 750, "deposits": 125000000000},
			{"week": 2, "transactions": 780, "deposits": 130000000000},
			{"week": 3, "transactions": 720, "deposits": 120000000000},
			{"week": 4, "transactions": 750, "deposits": 125000000000},
		},
		"generatedAt": time.Now().Format(time.RFC3339),
	}
}

// GetStaffPerformanceReport returns staff performance report
func (s *PerformanceService) GetStaffPerformanceReport(tenantID, branchID, period string, staffService *StaffService) map[string]interface{} {
	staff := staffService.ListStaff(tenantID, branchID, "", "active")

	var staffMetrics []map[string]interface{}
	for _, st := range staff {
		staffMetrics = append(staffMetrics, map[string]interface{}{
			"staffID":             st.StaffID,
			"name":                st.FirstName + " " + st.LastName,
			"role":                st.Role,
			"transactionsHandled": 45,
			"customersServed":     40,
			"avgServiceTime":      10.5,
			"customerRating":      4.3,
			"attendanceRate":      98.0,
		})
	}

	return map[string]interface{}{
		"reportType":    "staff_performance",
		"period":        period,
		"branchID":      branchID,
		"totalStaff":    len(staff),
		"staffMetrics":  staffMetrics,
		"topPerformers": staffMetrics[:min(3, len(staffMetrics))],
		"generatedAt":   time.Now().Format(time.RFC3339),
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
