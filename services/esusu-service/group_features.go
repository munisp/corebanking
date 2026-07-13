package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// ============================================
// DB MODELS — reuse esusu tables as foreign keys
// ============================================

type DBEsusuMeeting struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID     string    `gorm:"type:varchar(36);index;not null"`
	TenantID    string    `gorm:"type:varchar(50);index"`
	Title       string    `gorm:"type:varchar(255);not null"`
	Agenda      string    `gorm:"type:text"`
	Minutes     string    `gorm:"type:text"`
	Location    string    `gorm:"type:varchar(255)"`
	ScheduledAt time.Time `gorm:"not null"`
	Status      string    `gorm:"type:varchar(20);default:'scheduled'"` // scheduled, completed, cancelled
	Attendees   string    `gorm:"type:jsonb"`                            // JSON array of member IDs
	CreatedBy   string    `gorm:"type:varchar(36)"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuMeeting) TableName() string { return "esusu_meetings" }

type DBEsusuPenalty struct {
	ID        string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID   string    `gorm:"type:varchar(36);index;not null"`
	MemberID  string    `gorm:"type:varchar(36);index;not null"`
	TenantID  string    `gorm:"type:varchar(50);index"`
	Amount    float64   `gorm:"type:decimal(15,2);not null"`
	Reason    string    `gorm:"type:varchar(50);not null"` // late_payment, missed_payment, early_withdrawal
	Status    string    `gorm:"type:varchar(20);default:'pending'"`  // pending, deducted, waived
	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuPenalty) TableName() string { return "esusu_penalties" }

type DBEsusuManagementRecord struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID     string    `gorm:"type:varchar(36);index;not null"`
	TenantID    string    `gorm:"type:varchar(50);index"`
	Type        string    `gorm:"type:varchar(50);not null"` // decision, policy_change, dispute, vote
	Title       string    `gorm:"type:varchar(255);not null"`
	Description string    `gorm:"type:text"`
	Resolution  string    `gorm:"type:text"`
	Status      string    `gorm:"type:varchar(20);default:'open'"` // open, resolved, pending
	RecordedBy  string    `gorm:"type:varchar(36)"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuManagementRecord) TableName() string { return "esusu_management_records" }

type DBEsusuRotation struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)"`
	GroupID     string    `gorm:"type:varchar(36);uniqueIndex;not null"`
	TenantID    string    `gorm:"type:varchar(50);index"`
	CycleNumber int       `gorm:"not null"`
	MemberOrder string    `gorm:"type:jsonb"` // ordered list of member IDs
	CurrentIdx  int       `gorm:"default:0"`
	NextPayDate time.Time
	Status      string    `gorm:"type:varchar(20);default:'active'"` // active, completed, paused
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime"`
}

func (DBEsusuRotation) TableName() string { return "esusu_rotations" }

// ============================================
// MEETINGS
// ============================================

func (h *EsusuHandler) ListMeetings(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var meetings []DBEsusuMeeting
	h.service.db.Where("group_id = ?", groupID).Order("scheduled_at desc").Find(&meetings)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"meetings": meetings, "total": len(meetings)})
}

func (h *EsusuHandler) CreateMeeting(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var req struct {
		Title       string    `json:"title"`
		Agenda      string    `json:"agenda"`
		Location    string    `json:"location"`
		ScheduledAt time.Time `json:"scheduled_at"`
		Attendees   []string  `json:"attendees"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	attendeesJSON, _ := json.Marshal(req.Attendees)
	meeting := DBEsusuMeeting{
		ID:          uuid.New().String(),
		GroupID:     groupID,
		TenantID:    r.Header.Get("x-tenant-id"),
		Title:       req.Title,
		Agenda:      req.Agenda,
		Location:    req.Location,
		ScheduledAt: req.ScheduledAt,
		Status:      "scheduled",
		Attendees:   string(attendeesJSON),
		CreatedBy:   r.Header.Get("x-keycloak-id"),
	}

	if err := h.service.db.Create(&meeting).Error; err != nil {
		SendError(w, "internal_error", "Failed to create meeting", http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(meeting)
}

func (h *EsusuHandler) GetMeetingStats(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var total, scheduled, completed, cancelled int64
	h.service.db.Model(&DBEsusuMeeting{}).Where("group_id = ?", groupID).Count(&total)
	h.service.db.Model(&DBEsusuMeeting{}).Where("group_id = ? AND status = 'scheduled'", groupID).Count(&scheduled)
	h.service.db.Model(&DBEsusuMeeting{}).Where("group_id = ? AND status = 'completed'", groupID).Count(&completed)
	h.service.db.Model(&DBEsusuMeeting{}).Where("group_id = ? AND status = 'cancelled'", groupID).Count(&cancelled)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id":  groupID,
		"total":     total,
		"scheduled": scheduled,
		"completed": completed,
		"cancelled": cancelled,
	})
}

// ============================================
// FINANCIALS — derived from existing esusu tables
// ============================================

func (h *EsusuHandler) GetFinancials(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var totalContributed float64
	h.service.db.Model(&DBContribution{}).
		Where("group_id = ? AND status IN ('PAID','LATE')", groupID).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalContributed)

	var totalPaidOut float64
	h.service.db.Model(&DBPayout{}).
		Where("group_id = ? AND status = 'COMPLETED'", groupID).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalPaidOut)

	var activeMembers, totalContribs, lateContribs, missedContribs int64
	h.service.db.Model(&DBEsusuMember{}).Where("group_id = ? AND status = 'ACTIVE'", groupID).Count(&activeMembers)
	h.service.db.Model(&DBContribution{}).Where("group_id = ?", groupID).Count(&totalContribs)
	h.service.db.Model(&DBContribution{}).Where("group_id = ? AND is_late = true", groupID).Count(&lateContribs)
	h.service.db.Model(&DBContribution{}).Where("group_id = ? AND status = 'MISSED'", groupID).Count(&missedContribs)

	var totalPenalties float64
	h.service.db.Model(&DBEsusuPenalty{}).
		Where("group_id = ? AND status = 'deducted'", groupID).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalPenalties)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id":             groupID,
		"total_contributed":    totalContributed,
		"total_paid_out":       totalPaidOut,
		"balance":              totalContributed - totalPaidOut,
		"total_penalties":      totalPenalties,
		"active_members":       activeMembers,
		"total_contributions":  totalContribs,
		"late_contributions":   lateContribs,
		"missed_contributions": missedContribs,
	})
}

// ============================================
// CREDIT SCORING — uses existing member AI profiles
// ============================================

func (h *EsusuHandler) GetCreditScores(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var dbMembers []DBEsusuMember
	h.service.db.Where("group_id = ?", groupID).Find(&dbMembers)

	type MemberScore struct {
		MemberID    string          `json:"member_id"`
		Name        string          `json:"name"`
		CreditScore float64         `json:"credit_score"`
		RiskScore   float64         `json:"risk_score"`
		RiskCategory string         `json:"risk_category"`
		AIProfile   MemberAIProfile `json:"ai_profile"`
	}

	scores := make([]MemberScore, 0, len(dbMembers))
	for _, dm := range dbMembers {
		m, _ := FromDBMember(&dm)
		scores = append(scores, MemberScore{
			MemberID:     m.ID,
			Name:         m.Name,
			CreditScore:  m.CreditScore,
			RiskScore:    m.RiskScore,
			RiskCategory: m.AIProfile.RiskCategory,
			AIProfile:    m.AIProfile,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id": groupID,
		"members":  scores,
		"total":    len(scores),
	})
}

// ============================================
// MANAGEMENT RECORDS
// ============================================

func (h *EsusuHandler) ListManagement(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var records []DBEsusuManagementRecord
	h.service.db.Where("group_id = ?", groupID).Order("created_at desc").Find(&records)

	var open, resolved int64
	h.service.db.Model(&DBEsusuManagementRecord{}).Where("group_id = ? AND status = 'open'", groupID).Count(&open)
	h.service.db.Model(&DBEsusuManagementRecord{}).Where("group_id = ? AND status = 'resolved'", groupID).Count(&resolved)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"records":  records,
		"total":    len(records),
		"open":     open,
		"resolved": resolved,
	})
}

func (h *EsusuHandler) CreateManagementRecord(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var req struct {
		Type        string `json:"type"`
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	record := DBEsusuManagementRecord{
		ID:          uuid.New().String(),
		GroupID:     groupID,
		TenantID:    r.Header.Get("x-tenant-id"),
		Type:        req.Type,
		Title:       req.Title,
		Description: req.Description,
		Status:      "open",
		RecordedBy:  r.Header.Get("x-keycloak-id"),
	}

	if err := h.service.db.Create(&record).Error; err != nil {
		SendError(w, "internal_error", "Failed to create record", http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(record)
}

// ============================================
// PENALTIES
// ============================================

func (h *EsusuHandler) ListPenalties(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var penalties []DBEsusuPenalty
	h.service.db.Where("group_id = ?", groupID).Order("created_at desc").Find(&penalties)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"penalties": penalties, "total": len(penalties)})
}

func (h *EsusuHandler) CreatePenalty(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var req struct {
		MemberID string  `json:"member_id"`
		Amount   float64 `json:"amount"`
		Reason   string  `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	if req.Reason == "" {
		SendError(w, "validation_error", "reason is required", http.StatusBadRequest, nil)
		return
	}

	penalty := DBEsusuPenalty{
		ID:       uuid.New().String(),
		GroupID:  groupID,
		MemberID: req.MemberID,
		TenantID: r.Header.Get("x-tenant-id"),
		Amount:   req.Amount,
		Reason:   req.Reason,
		Status:   "pending",
	}

	if err := h.service.db.Create(&penalty).Error; err != nil {
		SendError(w, "internal_error", "Failed to create penalty", http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(penalty)
}

func (h *EsusuHandler) UpdatePenaltyStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	penaltyID := vars["penaltyId"]

	var req struct {
		Status string `json:"status"` // pending, deducted, waived
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	result := h.service.db.Model(&DBEsusuPenalty{}).
		Where("id = ? AND group_id = ?", penaltyID, groupID).
		Update("status", req.Status)
	if result.RowsAffected == 0 {
		SendError(w, "not_found", "Penalty not found", http.StatusNotFound, nil)
		return
	}

	var penalty DBEsusuPenalty
	h.service.db.First(&penalty, "id = ?", penaltyID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(penalty)
}

// ============================================
// ROTATION SCHEDULE
// ============================================

func (h *EsusuHandler) GetRotation(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var rotation DBEsusuRotation
	if err := h.service.db.First(&rotation, "group_id = ?", groupID).Error; err != nil {
		// Fall back to the payout_order stored on the group itself
		var dbGroup DBEsusuGroup
		if err2 := h.service.db.First(&dbGroup, "id = ?", groupID).Error; err2 != nil {
			SendError(w, "not_found", "Group not found", http.StatusNotFound, nil)
			return
		}
		var order []string
		json.Unmarshal([]byte(dbGroup.PayoutOrder), &order)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"group_id":     groupID,
			"cycle_number": dbGroup.CurrentCycle,
			"member_order": order,
			"current_idx":  dbGroup.CurrentCycle,
			"next_pay_date": dbGroup.NextPayoutDate,
			"status":       string(dbGroup.Status),
			"source":       "group",
		})
		return
	}

	var order []string
	json.Unmarshal([]byte(rotation.MemberOrder), &order)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id":     rotation.GroupID,
		"cycle_number": rotation.CycleNumber,
		"member_order": order,
		"current_idx":  rotation.CurrentIdx,
		"next_pay_date": rotation.NextPayDate,
		"status":       rotation.Status,
		"source":       "rotation",
	})
}

func (h *EsusuHandler) SetRotation(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["id"]

	var req struct {
		MemberOrder []string  `json:"member_order"`
		NextPayDate time.Time `json:"next_pay_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	orderJSON, _ := json.Marshal(req.MemberOrder)

	// Upsert rotation record
	var rotation DBEsusuRotation
	err := h.service.db.First(&rotation, "group_id = ?", groupID).Error
	if err != nil {
		// Create new
		var dbGroup DBEsusuGroup
		h.service.db.First(&dbGroup, "id = ?", groupID)
		rotation = DBEsusuRotation{
			ID:          uuid.New().String(),
			GroupID:     groupID,
			TenantID:    r.Header.Get("x-tenant-id"),
			CycleNumber: dbGroup.CurrentCycle,
			MemberOrder: string(orderJSON),
			CurrentIdx:  0,
			NextPayDate: req.NextPayDate,
			Status:      "active",
		}
		h.service.db.Create(&rotation)
	} else {
		h.service.db.Model(&rotation).Updates(map[string]interface{}{
			"member_order": string(orderJSON),
			"next_pay_date": req.NextPayDate,
		})
	}

	var order []string
	json.Unmarshal([]byte(rotation.MemberOrder), &order)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group_id":     rotation.GroupID,
		"cycle_number": rotation.CycleNumber,
		"member_order": order,
		"next_pay_date": rotation.NextPayDate,
		"status":       rotation.Status,
	})
}
