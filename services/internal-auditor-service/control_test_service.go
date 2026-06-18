package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ControlTestService handles control test operations
type ControlTestService struct {
	tenantID string
	tests    map[string]*ControlTest
	mu       sync.RWMutex
}

// NewControlTestService creates a new control test service
func NewControlTestService(tenantID string) *ControlTestService {
	svc := &ControlTestService{
		tenantID: tenantID,
		tests:    make(map[string]*ControlTest),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *ControlTestService) initializeDefaultData(tenantID string) {
	testedAt := time.Now().AddDate(0, 0, -5)
	reviewedAt := time.Now().AddDate(0, 0, -3)

	// Effective control
	s.tests["test-001"] = &ControlTest{
		TestID:          "test-001",
		TenantID:        tenantID,
		EngagementID:    "eng-001",
		ControlID:       "ctrl-001",
		ControlName:     "Cash Count Verification",
		ControlCategory: "detective",
		ControlType:     "manual",
		TestProcedure:   "Select sample of daily cash counts and verify accuracy",
		SampleSize:      30,
		SampleTested:    30,
		ExceptionsFound: 0,
		TestResult:      "effective",
		Conclusion:      "Control is operating effectively with no exceptions noted",
		TestedBy:        "auditor-002",
		TestedAt:        &testedAt,
		ReviewedBy:      "auditor-001",
		ReviewedAt:      &reviewedAt,
		Status:          "reviewed",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -10),
		UpdatedAt:       time.Now().AddDate(0, 0, -3),
	}

	// Partially effective control
	s.tests["test-002"] = &ControlTest{
		TestID:          "test-002",
		TenantID:        tenantID,
		EngagementID:    "eng-001",
		ControlID:       "ctrl-002",
		ControlName:     "Dual Authorization for Large Transactions",
		ControlCategory: "preventive",
		ControlType:     "manual",
		TestProcedure:   "Select sample of large transactions and verify dual authorization",
		SampleSize:      25,
		SampleTested:    25,
		ExceptionsFound: 3,
		TestResult:      "partially_effective",
		Conclusion:      "3 exceptions noted where dual authorization was not obtained",
		TestedBy:        "auditor-002",
		TestedAt:        &testedAt,
		ReviewedBy:      "auditor-001",
		ReviewedAt:      &reviewedAt,
		Status:          "reviewed",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -10),
		UpdatedAt:       time.Now().AddDate(0, 0, -3),
	}

	// Ineffective control
	s.tests["test-003"] = &ControlTest{
		TestID:          "test-003",
		TenantID:        tenantID,
		EngagementID:    "eng-001",
		ControlID:       "ctrl-003",
		ControlName:     "Daily Reconciliation Review",
		ControlCategory: "detective",
		ControlType:     "manual",
		TestProcedure:   "Verify daily reconciliations are reviewed and signed off",
		SampleSize:      20,
		SampleTested:    20,
		ExceptionsFound: 12,
		TestResult:      "ineffective",
		Conclusion:      "60% of reconciliations lacked evidence of supervisory review",
		TestedBy:        "auditor-002",
		TestedAt:        &testedAt,
		Status:          "completed",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -8),
		UpdatedAt:       time.Now().AddDate(0, 0, -5),
	}

	// In progress control test
	s.tests["test-004"] = &ControlTest{
		TestID:          "test-004",
		TenantID:        tenantID,
		EngagementID:    "eng-001",
		ControlID:       "ctrl-004",
		ControlName:     "Customer Identification Verification",
		ControlCategory: "preventive",
		ControlType:     "hybrid",
		TestProcedure:   "Verify customer identification documents are properly verified",
		SampleSize:      40,
		SampleTested:    15,
		ExceptionsFound: 1,
		TestResult:      "",
		Conclusion:      "",
		TestedBy:        "auditor-002",
		Status:          "in_progress",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -3),
		UpdatedAt:       time.Now(),
	}

	// Pending control test
	s.tests["test-005"] = &ControlTest{
		TestID:          "test-005",
		TenantID:        tenantID,
		EngagementID:    "eng-001",
		ControlID:       "ctrl-005",
		ControlName:     "System Access Review",
		ControlCategory: "preventive",
		ControlType:     "automated",
		TestProcedure:   "Review system access logs and verify appropriate access levels",
		SampleSize:      50,
		SampleTested:    0,
		ExceptionsFound: 0,
		TestResult:      "",
		Conclusion:      "",
		Status:          "pending",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, 0, -2),
		UpdatedAt:       time.Now().AddDate(0, 0, -2),
	}
}

// ListControlTests returns control tests based on filters
func (s *ControlTestService) ListControlTests(tenantID, status string) []*ControlTest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*ControlTest
	for _, test := range s.tests {
		if test.TenantID != tenantID {
			continue
		}
		if status != "" && test.Status != status {
			continue
		}
		result = append(result, test)
	}
	return result
}

// GetControlTest retrieves a control test by ID
func (s *ControlTestService) GetControlTest(tenantID, testID string) (*ControlTest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("control test not found")
	}
	return test, nil
}

// CreateControlTest creates a new control test
func (s *ControlTestService) CreateControlTest(tenantID string, test *ControlTest) (*ControlTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test.TestID = uuid.New().String()
	test.TenantID = tenantID
	test.Status = "pending"
	test.SampleTested = 0
	test.ExceptionsFound = 0
	test.Metadata = make(map[string]interface{})
	test.CreatedAt = time.Now()
	test.UpdatedAt = time.Now()

	s.tests[test.TestID] = test
	return test, nil
}

// UpdateControlTest updates a control test
func (s *ControlTestService) UpdateControlTest(test *ControlTest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.tests[test.TestID]
	if !exists || existing.TenantID != test.TenantID {
		return errors.New("control test not found")
	}

	test.CreatedAt = existing.CreatedAt
	test.UpdatedAt = time.Now()
	s.tests[test.TestID] = test
	return nil
}

// ExecuteTest executes a control test
func (s *ControlTestService) ExecuteTest(tenantID, testID, auditorID string, sampleTested, exceptionsFound int, testResult, conclusion string) (*ControlTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("control test not found")
	}

	now := time.Now()
	test.SampleTested = sampleTested
	test.ExceptionsFound = exceptionsFound
	test.TestResult = testResult
	test.Conclusion = conclusion
	test.TestedBy = auditorID
	test.TestedAt = &now
	test.Status = "completed"
	test.UpdatedAt = now

	return test, nil
}

// ReviewTest reviews a control test
func (s *ControlTestService) ReviewTest(tenantID, testID, reviewerID string) (*ControlTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("control test not found")
	}

	if test.Status != "completed" {
		return nil, errors.New("control test is not completed")
	}

	now := time.Now()
	test.ReviewedBy = reviewerID
	test.ReviewedAt = &now
	test.Status = "reviewed"
	test.UpdatedAt = now

	return test, nil
}

// GetEngagementControls returns controls for an engagement
func (s *ControlTestService) GetEngagementControls(tenantID, engagementID string) []*ControlTest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*ControlTest
	for _, test := range s.tests {
		if test.TenantID != tenantID {
			continue
		}
		if test.EngagementID == engagementID {
			result = append(result, test)
		}
	}
	return result
}

// GetSummary returns control test summary
func (s *ControlTestService) GetSummary(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var total, effective, partiallyEffective, ineffective, pending int

	for _, test := range s.tests {
		if test.TenantID != tenantID {
			continue
		}
		total++
		switch test.TestResult {
		case "effective":
			effective++
		case "partially_effective":
			partiallyEffective++
		case "ineffective":
			ineffective++
		case "":
			pending++
		}
	}

	effectiveness := 0.0
	tested := effective + partiallyEffective + ineffective
	if tested > 0 {
		effectiveness = float64(effective) / float64(tested) * 100
	}

	return map[string]interface{}{
		"totalControls":       total,
		"totalTested":         tested,
		"effectiveControls":   effective,
		"partiallyEffective":  partiallyEffective,
		"ineffectiveControls": ineffective,
		"pendingTests":        pending,
		"effectiveness":       effectiveness,
		"timestamp":           time.Now().Format(time.RFC3339),
	}
}
