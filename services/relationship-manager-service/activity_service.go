package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ActivityService handles activity operations
type ActivityService struct {
	tenantID   string
	activities map[string]*Activity
	mu         sync.RWMutex
}

// NewActivityService creates a new activity service
func NewActivityService(tenantID string) *ActivityService {
	svc := &ActivityService{
		tenantID:   tenantID,
		activities: make(map[string]*Activity),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *ActivityService) initializeDefaultData(tenantID string) {
	followUp1 := time.Now().AddDate(0, 0, 3)
	followUp2 := time.Now().AddDate(0, 0, 7)

	// Recent call
	s.activities["act-001"] = &Activity{
		ActivityID:    "act-001",
		TenantID:      tenantID,
		CustomerID:    "cust-001",
		CustomerName:  "Adaeze Okonkwo",
		ActivityType:  "call",
		Subject:       "Quarterly Portfolio Review",
		Description:   "Discussed investment performance and upcoming opportunities",
		Outcome:       "Customer interested in T-Bills allocation",
		FollowUpDate:  &followUp1,
		FollowUpNotes: "Send T-Bills proposal",
		RMID:          "rm-001",
		Duration:      30,
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -2),
		UpdatedAt:     time.Now().AddDate(0, 0, -2),
	}

	// Meeting
	s.activities["act-002"] = &Activity{
		ActivityID:    "act-002",
		TenantID:      tenantID,
		CustomerID:    "cust-002",
		CustomerName:  "Dangote Industries Ltd",
		ActivityType:  "meeting",
		Subject:       "Working Capital Facility Discussion",
		Description:   "Met with CFO to discuss expanded working capital needs",
		Outcome:       "Agreed on terms, pending board approval",
		FollowUpDate:  &followUp2,
		FollowUpNotes: "Follow up on board decision",
		RMID:          "rm-001",
		Duration:      60,
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -5),
		UpdatedAt:     time.Now().AddDate(0, 0, -5),
	}

	// Email
	s.activities["act-003"] = &Activity{
		ActivityID:   "act-003",
		TenantID:     tenantID,
		CustomerID:   "cust-003",
		CustomerName: "Lagos Tech Solutions",
		ActivityType: "email",
		Subject:      "Insurance Quote Follow-up",
		Description:  "Sent business insurance quote as requested",
		Outcome:      "Awaiting customer response",
		RMID:         "rm-001",
		Duration:     15,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(0, 0, -3),
		UpdatedAt:    time.Now().AddDate(0, 0, -3),
	}

	// Site visit
	s.activities["act-004"] = &Activity{
		ActivityID:   "act-004",
		TenantID:     tenantID,
		CustomerID:   "cust-003",
		CustomerName: "Lagos Tech Solutions",
		ActivityType: "visit",
		Subject:      "Business Assessment Visit",
		Description:  "Visited customer premises to assess business operations",
		Outcome:      "Good growth potential, recommended for credit increase",
		RMID:         "rm-001",
		Duration:     120,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(0, 0, -10),
		UpdatedAt:    time.Now().AddDate(0, 0, -10),
	}

	// Annual review
	overdueFollowUp := time.Now().AddDate(0, 0, -2)
	s.activities["act-005"] = &Activity{
		ActivityID:    "act-005",
		TenantID:      tenantID,
		CustomerID:    "cust-005",
		CustomerName:  "Folake Adeyemi",
		ActivityType:  "review",
		Subject:       "Annual Relationship Review",
		Description:   "Conducted annual review, customer expressed concerns about service",
		Outcome:       "Need to address service issues urgently",
		FollowUpDate:  &overdueFollowUp,
		FollowUpNotes: "Schedule meeting with branch manager",
		RMID:          "rm-001",
		Duration:      45,
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -7),
		UpdatedAt:     time.Now().AddDate(0, 0, -7),
	}
}

// ListActivities returns activities based on filters
func (s *ActivityService) ListActivities(tenantID, rmID, activityType string) []*Activity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Activity
	for _, activity := range s.activities {
		if activity.TenantID != tenantID {
			continue
		}
		if rmID != "" && activity.RMID != rmID {
			continue
		}
		if activityType != "" && activity.ActivityType != activityType {
			continue
		}
		result = append(result, activity)
	}
	return result
}

// GetActivity retrieves an activity by ID
func (s *ActivityService) GetActivity(tenantID, activityID string) (*Activity, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	activity, exists := s.activities[activityID]
	if !exists || activity.TenantID != tenantID {
		return nil, errors.New("activity not found")
	}
	return activity, nil
}

// CreateActivity creates a new activity
func (s *ActivityService) CreateActivity(tenantID, rmID string, req *CreateActivityRequest) (*Activity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var followUpDate *time.Time
	if req.FollowUpDate != "" {
		parsed, err := time.Parse("2006-01-02", req.FollowUpDate)
		if err == nil {
			followUpDate = &parsed
		}
	}

	activity := &Activity{
		ActivityID:   uuid.New().String(),
		TenantID:     tenantID,
		CustomerID:   req.CustomerID,
		ActivityType: req.ActivityType,
		Subject:      req.Subject,
		Description:  req.Description,
		Outcome:      req.Outcome,
		FollowUpDate: followUpDate,
		RMID:         rmID,
		Duration:     req.Duration,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	s.activities[activity.ActivityID] = activity
	return activity, nil
}

// UpdateActivity updates an activity
func (s *ActivityService) UpdateActivity(activity *Activity) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.activities[activity.ActivityID]
	if !exists || existing.TenantID != activity.TenantID {
		return errors.New("activity not found")
	}

	activity.CreatedAt = existing.CreatedAt
	activity.UpdatedAt = time.Now()
	s.activities[activity.ActivityID] = activity
	return nil
}

// GetCustomerActivities returns activities for a customer
func (s *ActivityService) GetCustomerActivities(tenantID, customerID string) []*Activity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Activity
	for _, activity := range s.activities {
		if activity.TenantID != tenantID {
			continue
		}
		if activity.CustomerID == customerID {
			result = append(result, activity)
		}
	}
	return result
}

// GetFollowUps returns pending follow-ups
func (s *ActivityService) GetFollowUps(tenantID, rmID string) []*Activity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Activity
	for _, activity := range s.activities {
		if activity.TenantID != tenantID {
			continue
		}
		if rmID != "" && activity.RMID != rmID {
			continue
		}
		if activity.FollowUpDate != nil {
			result = append(result, activity)
		}
	}
	return result
}

// GetCalendar returns activity calendar
func (s *ActivityService) GetCalendar(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	calendar := make(map[string][]map[string]interface{})

	for _, activity := range s.activities {
		if activity.TenantID != tenantID {
			continue
		}
		if rmID != "" && activity.RMID != rmID {
			continue
		}

		date := activity.CreatedAt.Format("2006-01-02")
		calendar[date] = append(calendar[date], map[string]interface{}{
			"activityID":   activity.ActivityID,
			"activityType": activity.ActivityType,
			"subject":      activity.Subject,
			"customerName": activity.CustomerName,
			"duration":     activity.Duration,
		})
	}

	return map[string]interface{}{
		"calendar":  calendar,
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetActivityStats returns activity statistics
func (s *ActivityService) GetActivityStats(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var today, thisWeek, pendingFollowUps int
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := startOfDay.AddDate(0, 0, -int(now.Weekday()))

	for _, activity := range s.activities {
		if activity.TenantID != tenantID {
			continue
		}
		if rmID != "" && activity.RMID != rmID {
			continue
		}

		if activity.CreatedAt.After(startOfDay) {
			today++
		}
		if activity.CreatedAt.After(startOfWeek) {
			thisWeek++
		}
		if activity.FollowUpDate != nil {
			pendingFollowUps++
		}
	}

	return map[string]interface{}{
		"today":            today,
		"thisWeek":         thisWeek,
		"pendingFollowUps": pendingFollowUps,
	}
}
