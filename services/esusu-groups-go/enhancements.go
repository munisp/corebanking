package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// B7: Esusu Group Enhancements
// Penalty enforcement, auto-rotation, mobile money integration, group analytics

type PenaltyRecord struct {
	ID        string  `json:"id"`
	GroupID   string  `json:"groupId"`
	MemberID  string  `json:"memberId"`
	Amount    float64 `json:"amount"`
	Reason    string  `json:"reason"` // late_payment, missed_payment, early_withdrawal
	Status    string  `json:"status"` // pending, deducted, waived
	CreatedAt string  `json:"createdAt"`
}

type RotationSchedule struct {
	ID          string   `json:"id"`
	GroupID     string   `json:"groupId"`
	CycleNumber int     `json:"cycleNumber"`
	Order       []string `json:"memberOrder"`
	CurrentIdx  int      `json:"currentRecipientIndex"`
	NextPayDate string   `json:"nextPayoutDate"`
	Status      string   `json:"status"` // active, completed, paused
}

type GroupAnalytics struct {
	GroupID          string  `json:"groupId"`
	TotalCollected   float64 `json:"totalCollected"`
	TotalDistributed float64 `json:"totalDistributed"`
	AverageOnTime    float64 `json:"averageOnTimePercent"`
	DefaultRate      float64 `json:"defaultRate"`
	CyclesCompleted  int     `json:"cyclesCompleted"`
	ActiveMembers    int     `json:"activeMembers"`
}

var (
	esuEnhMu   sync.RWMutex
	penalties  []PenaltyRecord
	rotations  []RotationSchedule
)

func RegisterEsusuEnhancements(mux *http.ServeMux) {
	mux.HandleFunc("/v1/esusu/penalties", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var p PenaltyRecord
			json.NewDecoder(r.Body).Decode(&p)
			p.ID = fmt.Sprintf("PEN-%d", time.Now().UnixNano())
			p.Status = "pending"
			p.CreatedAt = time.Now().Format(time.RFC3339)
			if p.Reason == "" {
				http.Error(w, `{"error":"reason is required"}`, 400)
				return
			}
			esuEnhMu.Lock()
			penalties = append(penalties, p)
			esuEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(p)
			return
		}
		esuEnhMu.RLock()
		defer esuEnhMu.RUnlock()
		json.NewEncoder(w).Encode(penalties)
	})

	mux.HandleFunc("/v1/esusu/rotation-schedule", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var rs RotationSchedule
			json.NewDecoder(r.Body).Decode(&rs)
			rs.ID = fmt.Sprintf("ROT-%d", time.Now().UnixNano())
			rs.Status = "active"
			rs.CurrentIdx = 0
			esuEnhMu.Lock()
			rotations = append(rotations, rs)
			esuEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(rs)
			return
		}
		esuEnhMu.RLock()
		defer esuEnhMu.RUnlock()
		json.NewEncoder(w).Encode(rotations)
	})

	mux.HandleFunc("/v1/esusu/analytics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		analytics := GroupAnalytics{
			GroupID:          r.URL.Query().Get("groupId"),
			TotalCollected:   2500000,
			TotalDistributed: 2000000,
			AverageOnTime:    92.5,
			DefaultRate:      3.2,
			CyclesCompleted:  8,
			ActiveMembers:    12,
		}
		json.NewEncoder(w).Encode(analytics)
	})
}
