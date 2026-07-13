package main

import (
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RMService handles relationship manager operations
type RMService struct {
	tenantID string
	rms      map[string]*RelationshipManager
	mu       sync.RWMutex
}

// NewRMService creates a new RM service
func NewRMService(tenantID string) *RMService {
	svc := &RMService{
		tenantID: tenantID,
		rms:      make(map[string]*RelationshipManager),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *RMService) initializeDefaultData(tenantID string) {
	// Senior RM - Corporate
	s.rms["rm-001"] = &RelationshipManager{
		RMID:          "rm-001",
		TenantID:      tenantID,
		EmployeeID:    "EMP-RM-001",
		FirstName:     "Adaeze",
		LastName:      "Okonkwo",
		Email:         "adaeze.okonkwo@54bank.com",
		Phone:         "+234-803-555-0001",
		Role:          "senior_rm",
		Segment:       "corporate",
		BranchID:      "branch-001",
		TargetRevenue: 200000000,
		ActualRevenue: 185025000,
		CustomerCount: 45,
		Status:        "active",
		CreatedAt:     time.Now().AddDate(-3, 0, 0),
		UpdatedAt:     time.Now(),
	}

	// RM - SME
	s.rms["rm-002"] = &RelationshipManager{
		RMID:          "rm-002",
		TenantID:      tenantID,
		EmployeeID:    "EMP-RM-002",
		FirstName:     "Chukwuemeka",
		LastName:      "Nwosu",
		Email:         "chukwuemeka.nwosu@54bank.com",
		Phone:         "+234-803-555-0002",
		Role:          "rm",
		Segment:       "sme",
		BranchID:      "branch-001",
		TargetRevenue: 150000000,
		ActualRevenue: 120000000,
		CustomerCount: 38,
		Status:        "active",
		CreatedAt:     time.Now().AddDate(-2, 0, 0),
		UpdatedAt:     time.Now(),
	}

	// Senior RM - HNWI/Private
	s.rms["rm-003"] = &RelationshipManager{
		RMID:          "rm-003",
		TenantID:      tenantID,
		EmployeeID:    "EMP-RM-003",
		FirstName:     "Folake",
		LastName:      "Adeyemi",
		Email:         "folake.adeyemi@54bank.com",
		Phone:         "+234-803-555-0003",
		Role:          "senior_rm",
		Segment:       "hnwi",
		BranchID:      "branch-002",
		TargetRevenue: 300000000,
		ActualRevenue: 285000000,
		CustomerCount: 25,
		Status:        "active",
		CreatedAt:     time.Now().AddDate(-4, 0, 0),
		UpdatedAt:     time.Now(),
	}

	// Team Lead - Retail
	s.rms["rm-004"] = &RelationshipManager{
		RMID:          "rm-004",
		TenantID:      tenantID,
		EmployeeID:    "EMP-RM-004",
		FirstName:     "Olumide",
		LastName:      "Bakare",
		Email:         "olumide.bakare@54bank.com",
		Phone:         "+234-803-555-0004",
		Role:          "team_lead",
		Segment:       "retail",
		BranchID:      "branch-001",
		TargetRevenue: 100000000,
		ActualRevenue: 95000000,
		CustomerCount: 120,
		Status:        "active",
		CreatedAt:     time.Now().AddDate(-5, 0, 0),
		UpdatedAt:     time.Now(),
	}

	// RM - Retail
	s.rms["rm-005"] = &RelationshipManager{
		RMID:          "rm-005",
		TenantID:      tenantID,
		EmployeeID:    "EMP-RM-005",
		FirstName:     "Ngozi",
		LastName:      "Eze",
		Email:         "ngozi.eze@54bank.com",
		Phone:         "+234-803-555-0005",
		Role:          "rm",
		Segment:       "retail",
		BranchID:      "branch-003",
		TargetRevenue: 75000000,
		ActualRevenue: 68000000,
		CustomerCount: 85,
		Status:        "active",
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	}
}

// ListRMs returns RMs based on filters
func (s *RMService) ListRMs(tenantID, segment string) []*RelationshipManager {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RelationshipManager
	for _, rm := range s.rms {
		if rm.TenantID != tenantID {
			continue
		}
		if segment != "" && rm.Segment != segment {
			continue
		}
		result = append(result, rm)
	}
	return result
}

// GetRM retrieves an RM by ID
func (s *RMService) GetRM(tenantID, rmID string) (*RelationshipManager, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rm, exists := s.rms[rmID]
	if !exists || rm.TenantID != tenantID {
		return nil, errors.New("RM not found")
	}
	return rm, nil
}

// RegisterRM registers a new RM
func (s *RMService) RegisterRM(tenantID string, rm *RelationshipManager) (*RelationshipManager, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rm.RMID = uuid.New().String()
	rm.TenantID = tenantID
	rm.Status = "active"
	rm.ActualRevenue = 0
	rm.CustomerCount = 0
	rm.CreatedAt = time.Now()
	rm.UpdatedAt = time.Now()

	s.rms[rm.RMID] = rm
	return rm, nil
}

// UpdateRM updates an RM
func (s *RMService) UpdateRM(rm *RelationshipManager) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.rms[rm.RMID]
	if !exists || existing.TenantID != rm.TenantID {
		return errors.New("RM not found")
	}

	rm.CreatedAt = existing.CreatedAt
	rm.UpdatedAt = time.Now()
	s.rms[rm.RMID] = rm
	return nil
}

// GetRMPerformance returns RM performance metrics
func (s *RMService) GetRMPerformance(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rm, exists := s.rms[rmID]
	if !exists || rm.TenantID != tenantID {
		return map[string]interface{}{"error": "RM not found"}
	}

	var achievement float64
	if rm.TargetRevenue > 0 {
		achievement = float64(rm.ActualRevenue) / float64(rm.TargetRevenue) * 100
	}

	return map[string]interface{}{
		"rmID":          rm.RMID,
		"name":          rm.FirstName + " " + rm.LastName,
		"segment":       rm.Segment,
		"targetRevenue": rm.TargetRevenue,
		"actualRevenue": rm.ActualRevenue,
		"achievement":   achievement,
		"customerCount": rm.CustomerCount,
		"monthly": []map[string]interface{}{
			{"month": "2026-01", "revenue": 15000000, "target": 16666667},
			{"month": "2025-12", "revenue": 16500000, "target": 16666667},
			{"month": "2025-11", "revenue": 14800000, "target": 16666667},
			{"month": "2025-10", "revenue": 15200000, "target": 16666667},
			{"month": "2025-09", "revenue": 16000000, "target": 16666667},
			{"month": "2025-08", "revenue": 15500000, "target": 16666667},
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetLeaderboard returns RM leaderboard
func (s *RMService) GetLeaderboard(tenantID string) []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	type rmScore struct {
		rm          *RelationshipManager
		achievement float64
	}

	var scores []rmScore
	for _, rm := range s.rms {
		if rm.TenantID != tenantID {
			continue
		}
		var achievement float64
		if rm.TargetRevenue > 0 {
			achievement = float64(rm.ActualRevenue) / float64(rm.TargetRevenue) * 100
		}
		scores = append(scores, rmScore{rm: rm, achievement: achievement})
	}

	// Sort by achievement descending
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].achievement > scores[j].achievement
	})

	var leaderboard []map[string]interface{}
	for i, score := range scores {
		leaderboard = append(leaderboard, map[string]interface{}{
			"rank":          i + 1,
			"rmID":          score.rm.RMID,
			"name":          score.rm.FirstName + " " + score.rm.LastName,
			"segment":       score.rm.Segment,
			"targetRevenue": score.rm.TargetRevenue,
			"actualRevenue": score.rm.ActualRevenue,
			"achievement":   score.achievement,
			"customerCount": score.rm.CustomerCount,
		})
	}

	return leaderboard
}
