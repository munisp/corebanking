package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ScheduleService handles schedule and leave operations
type ScheduleService struct {
	tenantID      string
	schedules     map[string]*StaffSchedule
	leaveRequests map[string]*LeaveRequest
	mu            sync.RWMutex
}

// NewScheduleService creates a new schedule service
func NewScheduleService(tenantID string) *ScheduleService {
	return &ScheduleService{
		tenantID:      tenantID,
		schedules:     make(map[string]*StaffSchedule),
		leaveRequests: make(map[string]*LeaveRequest),
	}
}

// ListSchedules returns schedules based on filters
func (s *ScheduleService) ListSchedules(tenantID, branchID, date string) []*StaffSchedule {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*StaffSchedule
	for _, schedule := range s.schedules {
		if schedule.TenantID != tenantID {
			continue
		}
		if branchID != "" && schedule.BranchID != branchID {
			continue
		}
		if date != "" {
			schedDate := schedule.ScheduleDate.Format("2006-01-02")
			if schedDate != date {
				continue
			}
		}
		result = append(result, schedule)
	}
	return result
}

// GetSchedule retrieves a schedule by ID
func (s *ScheduleService) GetSchedule(tenantID, scheduleID string) (*StaffSchedule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	schedule, exists := s.schedules[scheduleID]
	if !exists || schedule.TenantID != tenantID {
		return nil, errors.New("schedule not found")
	}
	return schedule, nil
}

// CreateSchedule creates a new schedule
func (s *ScheduleService) CreateSchedule(tenantID, branchID, userID string, req *CreateScheduleRequest) (*StaffSchedule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	schedDate, err := time.Parse("2006-01-02", req.ScheduleDate)
	if err != nil {
		return nil, errors.New("invalid schedule date")
	}

	schedule := &StaffSchedule{
		ScheduleID:   uuid.New().String(),
		TenantID:     tenantID,
		BranchID:     branchID,
		StaffID:      req.StaffID,
		ScheduleDate: schedDate,
		ShiftType:    req.ShiftType,
		StartTime:    req.StartTime,
		EndTime:      req.EndTime,
		Position:     req.Position,
		Status:       "scheduled",
		Notes:        req.Notes,
		CreatedBy:    userID,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	s.schedules[schedule.ScheduleID] = schedule
	return schedule, nil
}

// UpdateSchedule updates a schedule
func (s *ScheduleService) UpdateSchedule(schedule *StaffSchedule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.schedules[schedule.ScheduleID]
	if !exists || existing.TenantID != schedule.TenantID {
		return errors.New("schedule not found")
	}

	schedule.CreatedAt = existing.CreatedAt
	schedule.CreatedBy = existing.CreatedBy
	schedule.UpdatedAt = time.Now()
	s.schedules[schedule.ScheduleID] = schedule
	return nil
}

// UpdateScheduleStatus updates schedule status
func (s *ScheduleService) UpdateScheduleStatus(tenantID, scheduleID, status string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	schedule, exists := s.schedules[scheduleID]
	if !exists || schedule.TenantID != tenantID {
		return errors.New("schedule not found")
	}

	schedule.Status = status
	schedule.UpdatedAt = time.Now()
	return nil
}

// GetWeeklySchedule returns weekly schedule
func (s *ScheduleService) GetWeeklySchedule(tenantID, branchID, startDate string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var start time.Time
	if startDate != "" {
		start, _ = time.Parse("2006-01-02", startDate)
	} else {
		start = time.Now()
		// Get start of week (Monday)
		for start.Weekday() != time.Monday {
			start = start.AddDate(0, 0, -1)
		}
	}

	end := start.AddDate(0, 0, 7)
	
	weeklySchedule := make(map[string][]*StaffSchedule)
	for i := 0; i < 7; i++ {
		day := start.AddDate(0, 0, i)
		dayStr := day.Format("2006-01-02")
		weeklySchedule[dayStr] = []*StaffSchedule{}
	}

	for _, schedule := range s.schedules {
		if schedule.TenantID != tenantID {
			continue
		}
		if branchID != "" && schedule.BranchID != branchID {
			continue
		}
		if schedule.ScheduleDate.Before(start) || schedule.ScheduleDate.After(end) {
			continue
		}
		dayStr := schedule.ScheduleDate.Format("2006-01-02")
		weeklySchedule[dayStr] = append(weeklySchedule[dayStr], schedule)
	}

	return map[string]interface{}{
		"startDate": start.Format("2006-01-02"),
		"endDate":   end.Format("2006-01-02"),
		"schedule":  weeklySchedule,
	}
}

// GenerateSchedule auto-generates schedules for a date range
func (s *ScheduleService) GenerateSchedule(tenantID, branchID, userID, startDate, endDate string, staffService *StaffService) ([]*StaffSchedule, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, errors.New("invalid start date")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, errors.New("invalid end date")
	}

	staff := staffService.ListStaff(tenantID, branchID, "", "active")
	if len(staff) == 0 {
		return nil, errors.New("no active staff found")
	}

	var schedules []*StaffSchedule
	
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		// Skip weekends
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}

		for i, st := range staff {
			var shiftType, startTime, endTime, position string
			
			// Rotate shifts
			if i%2 == 0 {
				shiftType = "morning"
				startTime = "08:00"
				endTime = "14:00"
			} else {
				shiftType = "afternoon"
				startTime = "14:00"
				endTime = "20:00"
			}

			// Assign positions based on role
			switch st.Role {
			case "teller":
				position = "teller_" + string(rune('1'+i%4))
			case "cso":
				position = "cso"
			case "supervisor":
				position = "supervisor"
			default:
				position = st.Role
			}

			schedule := &StaffSchedule{
				ScheduleID:   uuid.New().String(),
				TenantID:     tenantID,
				BranchID:     branchID,
				StaffID:      st.StaffID,
				StaffName:    st.FirstName + " " + st.LastName,
				ScheduleDate: d,
				ShiftType:    shiftType,
				StartTime:    startTime,
				EndTime:      endTime,
				Position:     position,
				Status:       "scheduled",
				CreatedBy:    userID,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			}

			s.mu.Lock()
			s.schedules[schedule.ScheduleID] = schedule
			s.mu.Unlock()
			
			schedules = append(schedules, schedule)
		}
	}

	return schedules, nil
}

// ListLeaveRequests returns leave requests
func (s *ScheduleService) ListLeaveRequests(tenantID, branchID, status string) []*LeaveRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*LeaveRequest
	for _, req := range s.leaveRequests {
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

// GetLeaveRequest retrieves a leave request
func (s *ScheduleService) GetLeaveRequest(tenantID, requestID string) (*LeaveRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	req, exists := s.leaveRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("leave request not found")
	}
	return req, nil
}

// CreateLeaveRequest creates a new leave request
func (s *ScheduleService) CreateLeaveRequest(tenantID, branchID string, req *CreateLeaveRequest, staffService *StaffService) (*LeaveRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, errors.New("invalid start date")
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, errors.New("invalid end date")
	}

	// Calculate total days
	totalDays := int(endDate.Sub(startDate).Hours()/24) + 1

	// Get staff name
	var staffName string
	if staff, err := staffService.GetStaff(tenantID, req.StaffID); err == nil {
		staffName = staff.FirstName + " " + staff.LastName
	}

	leaveReq := &LeaveRequest{
		RequestID: uuid.New().String(),
		TenantID:  tenantID,
		BranchID:  branchID,
		StaffID:   req.StaffID,
		StaffName: staffName,
		LeaveType: req.LeaveType,
		StartDate: startDate,
		EndDate:   endDate,
		TotalDays: totalDays,
		Reason:    req.Reason,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	s.leaveRequests[leaveReq.RequestID] = leaveReq
	return leaveReq, nil
}

// ApproveLeaveRequest approves a leave request
func (s *ScheduleService) ApproveLeaveRequest(tenantID, requestID, userID string) (*LeaveRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.leaveRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("leave request not found")
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

// RejectLeaveRequest rejects a leave request
func (s *ScheduleService) RejectLeaveRequest(tenantID, requestID, userID, reason string) (*LeaveRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.leaveRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("leave request not found")
	}

	if req.Status != "pending" {
		return nil, errors.New("can only reject pending requests")
	}

	now := time.Now()
	req.Status = "rejected"
	req.ApprovedBy = userID
	req.ApprovedAt = &now
	req.RejectionNote = reason
	req.UpdatedAt = time.Now()

	return req, nil
}

// CancelLeaveRequest cancels a leave request
func (s *ScheduleService) CancelLeaveRequest(tenantID, requestID string) (*LeaveRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.leaveRequests[requestID]
	if !exists || req.TenantID != tenantID {
		return nil, errors.New("leave request not found")
	}

	if req.Status != "pending" && req.Status != "approved" {
		return nil, errors.New("cannot cancel this request")
	}

	req.Status = "cancelled"
	req.UpdatedAt = time.Now()

	return req, nil
}
