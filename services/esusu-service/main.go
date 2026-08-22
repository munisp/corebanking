package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/big"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// ...existing code...

// Esusu/Ajo Service - Nigerian Rotating Savings and Credit Association (ROSCA)
// With AI/ML integration for:
// - Default risk prediction
// - Optimal rotation order
// - Fraud detection
// - Group health scoring

// ============================================
// DOMAIN MODELS
// ============================================
// ============================================
// HTTP HANDLERS
// ============================================

// type EsusuHandler struct {
// 	service *EsusuService
// }

// func NewEsusuHandler(service *EsusuService) *EsusuHandler {
// 	return &EsusuHandler{service: service}
// }

func (h *EsusuHandler) ReadyCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready":   true,
		"message": "All required tools and dependencies are ready.",
	})
}

type EsusuGroup struct {
	ID                 string           `json:"id"`
	Name               string           `json:"name"`
	Description        string           `json:"description"`
	CreatedBy          string           `json:"created_by"`
	AdminID            string           `json:"admin_id"`
	ContributionAmount float64          `json:"contribution_amount"`
	Currency           string           `json:"currency"`
	Frequency          ContributionFreq `json:"frequency"`
	MaxMembers         int              `json:"max_members"`
	CurrentCycle       int              `json:"current_cycle"`
	TotalCycles        int              `json:"total_cycles"`
	Status             GroupStatus      `json:"status"`
	StartDate          time.Time        `json:"start_date"`
	NextPayoutDate     time.Time        `json:"next_payout_date"`
	Members            []EsusuMember    `json:"members"`
	PayoutOrder        []string         `json:"payout_order"`
	Rules              GroupRules       `json:"rules"`
	AIMetrics          GroupAIMetrics   `json:"ai_metrics"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

type EsusuMember struct {
	ID                  string          `json:"id"`
	UserID              string          `json:"user_id"`
	GroupID             string          `json:"group_id"`
	Name                string          `json:"name"`
	Phone               string          `json:"phone"`
	Email               string          `json:"email"`
	Role                MemberRole      `json:"role"`
	JoinedAt            time.Time       `json:"joined_at"`
	Position            int             `json:"position"`
	HasReceivedPayout   bool            `json:"has_received_payout"`
	PayoutReceivedDate  *time.Time      `json:"payout_received_date,omitempty"`
	TotalContributed    float64         `json:"total_contributed"`
	MissedContributions int             `json:"missed_contributions"`
	LateContributions   int             `json:"late_contributions"`
	Status              MemberStatus    `json:"status"`
	RiskScore           float64         `json:"risk_score"`
	CreditScore         float64         `json:"credit_score"`
	AIProfile           MemberAIProfile `json:"ai_profile"`
}

type Contribution struct {
	ID            string             `json:"id"`
	GroupID       string             `json:"group_id"`
	MemberID      string             `json:"member_id"`
	CycleNumber   int                `json:"cycle_number"`
	Amount        float64            `json:"amount"`
	ExpectedDate  time.Time          `json:"expected_date"`
	ActualDate    *time.Time         `json:"actual_date,omitempty"`
	Status        ContributionStatus `json:"status"`
	PaymentMethod string             `json:"payment_method"`
	Reference     string             `json:"reference"`
	IsLate        bool               `json:"is_late"`
	DaysLate      int                `json:"days_late"`
	CreatedAt     time.Time          `json:"created_at"`
}

type Payout struct {
	ID           string       `json:"id"`
	GroupID      string       `json:"group_id"`
	RecipientID  string       `json:"recipient_id"`
	CycleNumber  int          `json:"cycle_number"`
	Amount       float64      `json:"amount"`
	Status       PayoutStatus `json:"status"`
	ScheduledFor time.Time    `json:"scheduled_for"`
	ProcessedAt  *time.Time   `json:"processed_at,omitempty"`
	Reference    string       `json:"reference"`
}

type GroupRules struct {
	LateFeePercentage      float64 `json:"late_fee_percentage"`
	GracePeriodDays        int     `json:"grace_period_days"`
	MaxMissedContributions int     `json:"max_missed_contributions"`
	AllowPartialPayments   bool    `json:"allow_partial_payments"`
	RequireGuarantor       bool    `json:"require_guarantor"`
	MinCreditScore         float64 `json:"min_credit_score"`
	AutoRemoveDefaulters   bool    `json:"auto_remove_defaulters"`
}

// AI/ML Metrics and Profiles
type GroupAIMetrics struct {
	HealthScore           float64            `json:"health_score"`
	DefaultRisk           float64            `json:"default_risk"`
	CompletionProbability float64            `json:"completion_probability"`
	OptimalRotationOrder  []string           `json:"optimal_rotation_order"`
	RiskFactors           []string           `json:"risk_factors"`
	Recommendations       []string           `json:"recommendations"`
	FraudAlerts           []FraudAlert       `json:"fraud_alerts"`
	PredictedDefaults     []PredictedDefault `json:"predicted_defaults"`
	LastAnalyzed          time.Time          `json:"last_analyzed"`
}

type MemberAIProfile struct {
	DefaultProbability    float64   `json:"default_probability"`
	PaymentReliability    float64   `json:"payment_reliability"`
	OptimalPayoutPosition int       `json:"optimal_payout_position"`
	RiskCategory          string    `json:"risk_category"`
	BehaviorPattern       string    `json:"behavior_pattern"`
	RecommendedActions    []string  `json:"recommended_actions"`
	LastUpdated           time.Time `json:"last_updated"`
}

type FraudAlert struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	MemberID    string    `json:"member_id,omitempty"`
	DetectedAt  time.Time `json:"detected_at"`
	IsResolved  bool      `json:"is_resolved"`
}

type PredictedDefault struct {
	MemberID    string    `json:"member_id"`
	MemberName  string    `json:"member_name"`
	Probability float64   `json:"probability"`
	CycleNumber int       `json:"cycle_number"`
	RiskFactors []string  `json:"risk_factors"`
	PredictedAt time.Time `json:"predicted_at"`
}

// Enums
type ContributionFreq string

const (
	FreqDaily    ContributionFreq = "DAILY"
	FreqWeekly   ContributionFreq = "WEEKLY"
	FreqBiWeekly ContributionFreq = "BI_WEEKLY"
	FreqMonthly  ContributionFreq = "MONTHLY"
)

type GroupStatus string

const (
	GroupPending   GroupStatus = "PENDING"
	GroupActive    GroupStatus = "ACTIVE"
	GroupCompleted GroupStatus = "COMPLETED"
	GroupCancelled GroupStatus = "CANCELLED"
	GroupSuspended GroupStatus = "SUSPENDED"
)

type MemberRole string

const (
	RoleAdmin     MemberRole = "ADMIN"
	RoleMember    MemberRole = "MEMBER"
	RoleGuarantor MemberRole = "GUARANTOR"
)

type MemberStatus string

const (
	MemberActive    MemberStatus = "ACTIVE"
	MemberSuspended MemberStatus = "SUSPENDED"
	MemberRemoved   MemberStatus = "REMOVED"
	MemberDefaulted MemberStatus = "DEFAULTED"
)

type ContributionStatus string

const (
	ContribPending ContributionStatus = "PENDING"
	ContribPaid    ContributionStatus = "PAID"
	ContribLate    ContributionStatus = "LATE"
	ContribMissed  ContributionStatus = "MISSED"
	ContribPartial ContributionStatus = "PARTIAL"
)

type PayoutStatus string

const (
	PayoutScheduled  PayoutStatus = "SCHEDULED"
	PayoutProcessing PayoutStatus = "PROCESSING"
	PayoutCompleted  PayoutStatus = "COMPLETED"
	PayoutFailed     PayoutStatus = "FAILED"
)

// ============================================
// AI/ML ENGINE
// ============================================

type EsusuAIEngine struct {
	mu sync.RWMutex
}

func NewEsusuAIEngine() *EsusuAIEngine {
	return &EsusuAIEngine{}
}

func (ai *EsusuAIEngine) CalculateMemberRiskScore(member *EsusuMember, contributions []Contribution) float64 {
	ai.mu.Lock()
	defer ai.mu.Unlock()

	baseScore := 50.0

	if member.CreditScore > 0 {
		creditFactor := (member.CreditScore - 300) / 550 * 30
		baseScore += creditFactor
	}

	if len(contributions) > 0 {
		onTimeCount := 0
		for _, c := range contributions {
			if c.Status == ContribPaid && !c.IsLate {
				onTimeCount++
			}
		}
		reliabilityFactor := float64(onTimeCount) / float64(len(contributions)) * 20
		baseScore += reliabilityFactor
	}

	missedPenalty := float64(member.MissedContributions) * 10
	latePenalty := float64(member.LateContributions) * 3
	baseScore -= (missedPenalty + latePenalty)

	return math.Max(0, math.Min(100, baseScore))
}

func (ai *EsusuAIEngine) PredictDefaultProbability(member *EsusuMember, group *EsusuGroup) float64 {
	ai.mu.Lock()
	defer ai.mu.Unlock()

	baseProbability := 0.1

	if member.MissedContributions > 0 {
		baseProbability += float64(member.MissedContributions) * 0.15
	}
	if member.LateContributions > 2 {
		baseProbability += float64(member.LateContributions-2) * 0.05
	}

	if member.CreditScore > 0 && member.CreditScore < 500 {
		baseProbability += 0.2
	}

	if member.HasReceivedPayout {
		baseProbability += 0.1
	}

	contributionRatio := group.ContributionAmount / 50000
	if contributionRatio > 1 {
		baseProbability += (contributionRatio - 1) * 0.05
	}

	return math.Min(0.95, baseProbability)
}

func (ai *EsusuAIEngine) CalculateOptimalRotationOrder(group *EsusuGroup) []string {
	ai.mu.Lock()
	defer ai.mu.Unlock()

	type memberScore struct {
		memberID string
		score    float64
	}

	scores := make([]memberScore, 0, len(group.Members))
	for _, m := range group.Members {
		score := ai.calculateRotationScore(&m, group)
		scores = append(scores, memberScore{memberID: m.ID, score: score})
	}

	sort.Slice(scores, func(i, j int) bool {
		return scores[i].score > scores[j].score
	})

	order := make([]string, len(scores))
	for i, s := range scores {
		order[i] = s.memberID
	}

	return order
}

func (ai *EsusuAIEngine) calculateRotationScore(member *EsusuMember, group *EsusuGroup) float64 {
	score := 100.0

	score -= member.AIProfile.DefaultProbability * 50

	score += member.AIProfile.PaymentReliability * 30

	if member.CreditScore > 600 {
		score += 10
	}

	if member.MissedContributions == 0 && member.LateContributions == 0 {
		score += 15
	}

	return score
}

func (ai *EsusuAIEngine) CalculateGroupHealthScore(group *EsusuGroup, contributions []Contribution) float64 {
	ai.mu.Lock()
	defer ai.mu.Unlock()

	healthScore := 100.0

	if len(contributions) > 0 {
		paidCount := 0
		lateCount := 0
		for _, c := range contributions {
			if c.Status == ContribPaid {
				paidCount++
				if c.IsLate {
					lateCount++
				}
			}
		}
		paymentRate := float64(paidCount) / float64(len(contributions))
		healthScore = healthScore * paymentRate

		if paidCount > 0 {
			lateRate := float64(lateCount) / float64(paidCount)
			healthScore -= lateRate * 20
		}
	}

	activeMembers := 0
	totalRisk := 0.0
	for _, m := range group.Members {
		if m.Status == MemberActive {
			activeMembers++
			totalRisk += m.AIProfile.DefaultProbability
		}
	}

	if activeMembers > 0 {
		avgRisk := totalRisk / float64(activeMembers)
		healthScore -= avgRisk * 30
	}

	memberRatio := float64(activeMembers) / float64(group.MaxMembers)
	if memberRatio < 0.8 {
		healthScore -= (1 - memberRatio) * 20
	}

	return math.Max(0, math.Min(100, healthScore))
}

func (ai *EsusuAIEngine) DetectFraud(group *EsusuGroup, contributions []Contribution) []FraudAlert {
	ai.mu.Lock()
	defer ai.mu.Unlock()

	alerts := []FraudAlert{}

	memberContributions := make(map[string][]Contribution)
	for _, c := range contributions {
		memberContributions[c.MemberID] = append(memberContributions[c.MemberID], c)
	}

	for memberID, contribs := range memberContributions {
		if len(contribs) >= 3 {
			allLate := true
			for _, c := range contribs[len(contribs)-3:] {
				if !c.IsLate {
					allLate = false
					break
				}
			}
			if allLate {
				alerts = append(alerts, FraudAlert{
					ID:          uuid.New().String(),
					Type:        "PAYMENT_PATTERN",
					Severity:    "MEDIUM",
					Description: "Member has 3+ consecutive late payments - potential default risk",
					MemberID:    memberID,
					DetectedAt:  time.Now(),
				})
			}
		}
	}

	for _, m := range group.Members {
		if m.HasReceivedPayout && m.MissedContributions > 0 {
			alerts = append(alerts, FraudAlert{
				ID:          uuid.New().String(),
				Type:        "POST_PAYOUT_DEFAULT",
				Severity:    "HIGH",
				Description: "Member missed contributions after receiving payout",
				MemberID:    m.ID,
				DetectedAt:  time.Now(),
			})
		}
	}

	for memberID, contribs := range memberContributions {
		amounts := make(map[float64]int)
		for _, c := range contribs {
			amounts[c.Amount]++
		}
		if len(amounts) > 3 {
			alerts = append(alerts, FraudAlert{
				ID:          uuid.New().String(),
				Type:        "IRREGULAR_AMOUNTS",
				Severity:    "LOW",
				Description: "Member has irregular contribution amounts",
				MemberID:    memberID,
				DetectedAt:  time.Now(),
			})
		}
	}

	return alerts
}

func (ai *EsusuAIEngine) GenerateRecommendations(group *EsusuGroup) []string {
	recommendations := []string{}

	highRiskCount := 0
	for _, m := range group.Members {
		if m.AIProfile.DefaultProbability > 0.3 {
			highRiskCount++
		}
	}

	if highRiskCount > len(group.Members)/3 {
		recommendations = append(recommendations,
			"Consider requiring guarantors for high-risk members")
	}

	if len(group.Members) < group.MaxMembers/2 {
		recommendations = append(recommendations,
			"Group is under capacity - consider recruiting more members for stability")
	}

	totalMissed := 0
	for _, m := range group.Members {
		totalMissed += m.MissedContributions
	}
	if totalMissed > len(group.Members) {
		recommendations = append(recommendations,
			"High missed contribution rate - consider implementing stricter penalties or reminders")
	}

	if group.Rules.GracePeriodDays > 7 {
		recommendations = append(recommendations,
			"Consider reducing grace period to improve payment discipline")
	}

	return recommendations
}

func (ai *EsusuAIEngine) AnalyzeGroup(group *EsusuGroup, contributions []Contribution) GroupAIMetrics {
	healthScore := ai.CalculateGroupHealthScore(group, contributions)
	optimalOrder := ai.CalculateOptimalRotationOrder(group)
	fraudAlerts := ai.DetectFraud(group, contributions)
	recommendations := ai.GenerateRecommendations(group)

	predictedDefaults := []PredictedDefault{}
	totalDefaultRisk := 0.0
	for _, m := range group.Members {
		prob := ai.PredictDefaultProbability(&m, group)
		totalDefaultRisk += prob

		if prob > 0.3 {
			riskFactors := []string{}
			if m.MissedContributions > 0 {
				riskFactors = append(riskFactors, "Previous missed contributions")
			}
			if m.HasReceivedPayout {
				riskFactors = append(riskFactors, "Already received payout")
			}
			if m.CreditScore < 500 {
				riskFactors = append(riskFactors, "Low credit score")
			}

			predictedDefaults = append(predictedDefaults, PredictedDefault{
				MemberID:    m.ID,
				MemberName:  m.Name,
				Probability: prob,
				CycleNumber: group.CurrentCycle + 1,
				RiskFactors: riskFactors,
				PredictedAt: time.Now(),
			})
		}
	}

	avgDefaultRisk := 0.0
	if len(group.Members) > 0 {
		avgDefaultRisk = totalDefaultRisk / float64(len(group.Members))
	}

	completionProb := 1.0 - avgDefaultRisk
	if healthScore < 50 {
		completionProb *= 0.7
	}

	riskFactors := []string{}
	if avgDefaultRisk > 0.3 {
		riskFactors = append(riskFactors, "High average default risk")
	}
	if len(group.Members) < group.MaxMembers/2 {
		riskFactors = append(riskFactors, "Low member count")
	}
	if len(fraudAlerts) > 0 {
		riskFactors = append(riskFactors, fmt.Sprintf("%d fraud alerts detected", len(fraudAlerts)))
	}

	return GroupAIMetrics{
		HealthScore:           healthScore,
		DefaultRisk:           avgDefaultRisk,
		CompletionProbability: completionProb,
		OptimalRotationOrder:  optimalOrder,
		RiskFactors:           riskFactors,
		Recommendations:       recommendations,
		FraudAlerts:           fraudAlerts,
		PredictedDefaults:     predictedDefaults,
		LastAnalyzed:          time.Now(),
	}
}

// ============================================
// SERVICE LAYER
// ============================================

type EsusuService struct {
	db       *gorm.DB
	aiEngine *EsusuAIEngine
	mu       sync.RWMutex
}

func NewEsusuService(db *gorm.DB) *EsusuService {
	return &EsusuService{
		db:       db,
		aiEngine: NewEsusuAIEngine(),
	}
}

func (s *EsusuService) CreateGroup(req CreateGroupRequest, tenantID string) (*EsusuGroup, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Use CreatorName if AdminName is not provided
	adminName := req.AdminName
	if adminName == "" {
		adminName = req.CreatorName
	}

	// Default currency to NGN if not provided
	currency := req.Currency
	if currency == "" {
		currency = "NGN"
	}

	group := &EsusuGroup{
		ID:                 uuid.New().String(),
		Name:               req.Name,
		Description:        req.Description,
		CreatedBy:          req.CreatedBy,
		AdminID:            req.CreatedBy,
		ContributionAmount: req.ContributionAmount,
		Currency:           currency,
		Frequency:          req.Frequency,
		MaxMembers:         req.MaxMembers,
		CurrentCycle:       0,
		TotalCycles:        req.MaxMembers,
		Status:             GroupActive,
		StartDate:          req.StartDate,
		Members:            []EsusuMember{},
		PayoutOrder:        []string{},
		Rules: GroupRules{
			LateFeePercentage:      req.LateFeePercentage,
			GracePeriodDays:        req.GracePeriodDays,
			MaxMissedContributions: 3,
			AllowPartialPayments:   false,
			RequireGuarantor:       req.RequireGuarantor,
			MinCreditScore:         req.MinCreditScore,
			AutoRemoveDefaulters:   true,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	admin := EsusuMember{
		ID:       uuid.New().String(),
		UserID:   req.CreatedBy,
		GroupID:  group.ID,
		Name:     adminName,
		Phone:    req.AdminPhone,
		Email:    req.AdminEmail,
		Role:     RoleAdmin,
		JoinedAt: time.Now(),
		Position: 1,
		Status:   MemberActive,
		AIProfile: MemberAIProfile{
			DefaultProbability:    0.05,
			PaymentReliability:    0.95,
			OptimalPayoutPosition: 1,
			RiskCategory:          "LOW",
			BehaviorPattern:       "RELIABLE",
			LastUpdated:           time.Now(),
		},
	}
	group.Members = append(group.Members, admin)

	// Save to database
	dbGroup, _ := ToDBGroup(group, tenantID)
	if err := s.db.Create(dbGroup).Error; err != nil {
		log.Printf("[CreateGroup] Failed to create group in DB: %v", err)
		return nil, fmt.Errorf("failed to create group: %w", err)
	}
	log.Printf("[CreateGroup] Created group in DB: %s (tenant: %s)", group.ID, tenantID)

	dbMember, _ := ToDBMember(&admin, tenantID)
	if err := s.db.Create(dbMember).Error; err != nil {
		log.Printf("[CreateGroup] Failed to create admin member in DB: %v", err)
		return nil, fmt.Errorf("failed to create admin member: %w", err)
	}
	log.Printf("[CreateGroup] Created admin member in DB: %s (name: %s, user_id: %s, group_id: %s)",
		admin.ID, admin.Name, admin.UserID, admin.GroupID)

	return group, nil
}

func (s *EsusuService) JoinGroup(groupID string, req JoinGroupRequest, tenantID string) (*EsusuMember, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Fetch group from database (allow empty tenant_id for backward compatibility)
	var dbGroup DBEsusuGroup
	var err error
	if tenantID != "" {
		err = s.db.First(&dbGroup, "id = ? AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')", groupID, tenantID).Error
	} else {
		err = s.db.First(&dbGroup, "id = ?", groupID).Error
	}
	if err != nil {
		return nil, fmt.Errorf("group not found")
	}

	// Count existing members
	var memberCount int64
	s.db.Model(&DBEsusuMember{}).Where("group_id = ?", groupID).Count(&memberCount)

	if int(memberCount) >= dbGroup.MaxMembers {
		return nil, fmt.Errorf("group is full")
	}

	if dbGroup.Status != string(GroupPending) && dbGroup.Status != string(GroupActive) {
		return nil, fmt.Errorf("group is not accepting new members")
	}

	var rules GroupRules
	json.Unmarshal([]byte(dbGroup.Rules), &rules)

	if req.CreditScore < rules.MinCreditScore {
		return nil, fmt.Errorf("credit score below minimum requirement")
	}

	member := EsusuMember{
		ID:          uuid.New().String(),
		UserID:      req.UserID,
		GroupID:     groupID,
		Name:        req.Name,
		Phone:       req.Phone,
		Email:       req.Email,
		Role:        RoleMember,
		JoinedAt:    time.Now(),
		Position:    int(memberCount) + 1,
		Status:      MemberActive,
		CreditScore: req.CreditScore,
		AIProfile: MemberAIProfile{
			DefaultProbability:    0.1,
			PaymentReliability:    0.9,
			OptimalPayoutPosition: int(memberCount) + 1,
			RiskCategory:          "MEDIUM",
			BehaviorPattern:       "NEW",
			LastUpdated:           time.Now(),
		},
	}

	member.RiskScore = s.aiEngine.CalculateMemberRiskScore(&member, nil)

	// Save member to database
	dbMember, _ := ToDBMember(&member, tenantID)
	if err := s.db.Create(dbMember).Error; err != nil {
		return nil, fmt.Errorf("failed to create member: %w", err)
	}

	// Update group if all members joined
	if int(memberCount)+1 == dbGroup.MaxMembers {
		// Load all members to calculate optimal rotation
		var dbMembers []DBEsusuMember
		s.db.Where("group_id = ?", groupID).Find(&dbMembers)

		members := []EsusuMember{}
		for _, dm := range dbMembers {
			m, _ := FromDBMember(&dm)
			members = append(members, *m)
		}

		group, _ := FromDBGroup(&dbGroup, members)
		payoutOrder := s.aiEngine.CalculateOptimalRotationOrder(group)
		payoutOrderJSON, _ := json.Marshal(payoutOrder)

		s.db.Model(&DBEsusuGroup{}).Where("id = ?", groupID).Updates(map[string]interface{}{
			"payout_order": string(payoutOrderJSON),
			"updated_at":   time.Now(),
		})
	}

	return &member, nil
}

func (s *EsusuService) RecordContribution(groupID string, req ContributionRequest) (*Contribution, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Fetch group from database
	var dbGroup DBEsusuGroup
	if err := s.db.First(&dbGroup, "id = ?", groupID).Error; err != nil {
		return nil, fmt.Errorf("group not found")
	}

	// Fetch member from database
	// Try by member ID first, then by user ID (for frontend convenience)
	var dbMember DBEsusuMember
	err := s.db.First(&dbMember, "id = ? AND group_id = ?", req.MemberID, groupID).Error
	if err != nil {
		// If not found by member ID, try by user ID
		if err := s.db.First(&dbMember, "user_id = ? AND group_id = ?", req.MemberID, groupID).Error; err != nil {
			log.Printf("[RecordContribution] Member not found: member_id/user_id=%s, group_id=%s", req.MemberID, groupID)
			return nil, fmt.Errorf("member not found")
		}
	}

	var rules GroupRules
	json.Unmarshal([]byte(dbGroup.Rules), &rules)

	now := time.Now()
	isLate := now.After(req.ExpectedDate.Add(time.Duration(rules.GracePeriodDays) * 24 * time.Hour))
	daysLate := 0
	if isLate {
		daysLate = int(now.Sub(req.ExpectedDate).Hours() / 24)
	}

	contribution := Contribution{
		ID:            uuid.New().String(),
		GroupID:       groupID,
		MemberID:      req.MemberID,
		CycleNumber:   dbGroup.CurrentCycle,
		Amount:        req.Amount,
		ExpectedDate:  req.ExpectedDate,
		ActualDate:    &now,
		Status:        ContribPaid,
		PaymentMethod: req.PaymentMethod,
		Reference:     uuid.New().String(),
		IsLate:        isLate,
		DaysLate:      daysLate,
		CreatedAt:     now,
	}

	if isLate {
		contribution.Status = ContribLate
		dbMember.LateContributions++
	}

	dbMember.TotalContributed += req.Amount

	// Save contribution to database
	dbContrib := ToDBContribution(&contribution)
	if err := s.db.Create(dbContrib).Error; err != nil {
		return nil, fmt.Errorf("failed to save contribution: %w", err)
	}

	// Get all contributions for risk calculation
	var dbContribs []DBContribution
	s.db.Where("group_id = ? AND member_id = ?", groupID, req.MemberID).Find(&dbContribs)
	contribs := []Contribution{}
	for _, dc := range dbContribs {
		contribs = append(contribs, *FromDBContribution(&dc))
	}

	member, _ := FromDBMember(&dbMember)

	// Load all members for group
	var dbMembers []DBEsusuMember
	s.db.Where("group_id = ?", groupID).Find(&dbMembers)
	members := []EsusuMember{}
	for _, dm := range dbMembers {
		m, _ := FromDBMember(&dm)
		members = append(members, *m)
	}
	group, _ := FromDBGroup(&dbGroup, members)

	member.RiskScore = s.aiEngine.CalculateMemberRiskScore(member, contribs)
	member.AIProfile.DefaultProbability = s.aiEngine.PredictDefaultProbability(member, group)

	// Update member in database
	updatedDBMember, _ := ToDBMember(member, dbMember.TenantID)
	s.db.Model(&DBEsusuMember{}).Where("id = ?", req.MemberID).Updates(updatedDBMember)

	// Update group timestamp
	s.db.Model(&DBEsusuGroup{}).Where("id = ?", groupID).Update("updated_at", time.Now())

	return &contribution, nil
}

func (s *EsusuService) ProcessPayout(groupID string) (*Payout, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Fetch group from database
	var dbGroup DBEsusuGroup
	if err := s.db.First(&dbGroup, "id = ?", groupID).Error; err != nil {
		return nil, fmt.Errorf("group not found")
	}

	var payoutOrder []string
	json.Unmarshal([]byte(dbGroup.PayoutOrder), &payoutOrder)

	if dbGroup.CurrentCycle >= len(payoutOrder) {
		return nil, fmt.Errorf("all payouts completed")
	}

	recipientID := payoutOrder[dbGroup.CurrentCycle]

	// Fetch recipient from database
	var dbRecipient DBEsusuMember
	if err := s.db.First(&dbRecipient, "id = ? AND group_id = ?", recipientID, groupID).Error; err != nil {
		return nil, fmt.Errorf("recipient not found")
	}

	// Count members for payout calculation
	var memberCount int64
	s.db.Model(&DBEsusuMember{}).Where("group_id = ?", groupID).Count(&memberCount)

	payoutAmount := dbGroup.ContributionAmount * float64(memberCount)

	now := time.Now()
	payout := Payout{
		ID:           uuid.New().String(),
		GroupID:      groupID,
		RecipientID:  recipientID,
		CycleNumber:  dbGroup.CurrentCycle,
		Amount:       payoutAmount,
		Status:       PayoutCompleted,
		ScheduledFor: dbGroup.NextPayoutDate,
		ProcessedAt:  &now,
		Reference:    uuid.New().String(),
	}

	// Save payout to database
	dbPayout := ToDBPayout(&payout)
	if err := s.db.Create(dbPayout).Error; err != nil {
		return nil, fmt.Errorf("failed to save payout: %w", err)
	}

	// Update recipient
	dbRecipient.HasReceivedPayout = true
	dbRecipient.PayoutReceivedDate = &now
	s.db.Model(&DBEsusuMember{}).Where("id = ?", recipientID).Updates(map[string]interface{}{
		"has_received_payout":  true,
		"payout_received_date": now,
	})

	// Update group
	dbGroup.CurrentCycle++
	updates := map[string]interface{}{
		"current_cycle": dbGroup.CurrentCycle,
		"updated_at":    time.Now(),
	}

	if dbGroup.CurrentCycle >= dbGroup.TotalCycles {
		updates["status"] = string(GroupCompleted)
	} else {
		// Load all members for next payout calculation
		var dbMembers []DBEsusuMember
		s.db.Where("group_id = ?", groupID).Find(&dbMembers)
		members := []EsusuMember{}
		for _, dm := range dbMembers {
			m, _ := FromDBMember(&dm)
			members = append(members, *m)
		}
		group, _ := FromDBGroup(&dbGroup, members)
		nextPayoutDate := s.calculateNextPayoutDate(group)
		updates["next_payout_date"] = nextPayoutDate
	}

	s.db.Model(&DBEsusuGroup{}).Where("id = ?", groupID).Updates(updates)

	return &payout, nil
}

func (s *EsusuService) GetGroupAnalytics(groupID string) (*GroupAIMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Fetch group from database
	var dbGroup DBEsusuGroup
	if err := s.db.First(&dbGroup, "id = ?", groupID).Error; err != nil {
		return nil, fmt.Errorf("group not found")
	}

	// Fetch all members
	var dbMembers []DBEsusuMember
	s.db.Where("group_id = ?", groupID).Find(&dbMembers)
	members := []EsusuMember{}
	for _, dm := range dbMembers {
		m, _ := FromDBMember(&dm)
		members = append(members, *m)
	}

	group, _ := FromDBGroup(&dbGroup, members)

	// Fetch all contributions
	var dbContribs []DBContribution
	s.db.Where("group_id = ?", groupID).Find(&dbContribs)
	contributions := []Contribution{}
	for _, dc := range dbContribs {
		contributions = append(contributions, *FromDBContribution(&dc))
	}

	metrics := s.aiEngine.AnalyzeGroup(group, contributions)

	// Update group AI metrics in database
	metricsJSON, _ := json.Marshal(metrics)
	s.db.Model(&DBEsusuGroup{}).Where("id = ?", groupID).Update("ai_metrics", string(metricsJSON))

	return &metrics, nil
}

func (s *EsusuService) GetGroup(groupID string, tenantID string) (*EsusuGroup, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Fetch group from database (allow empty tenant_id for backward compatibility)
	var dbGroup DBEsusuGroup
	var err error
	if tenantID != "" {
		err = s.db.First(&dbGroup, "id = ? AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')", groupID, tenantID).Error
	} else {
		err = s.db.First(&dbGroup, "id = ?", groupID).Error
	}
	if err != nil {
		return nil, fmt.Errorf("group not found")
	}

	// Fetch all members
	var dbMembers []DBEsusuMember
	s.db.Where("group_id = ?", groupID).Find(&dbMembers)
	members := []EsusuMember{}
	for _, dm := range dbMembers {
		m, _ := FromDBMember(&dm)
		members = append(members, *m)
	}

	group, _ := FromDBGroup(&dbGroup, members)
	return group, nil
}

func (s *EsusuService) ListGroups(userID string, tenantID string, status string, page int, limit int) []*EsusuGroup {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var dbGroups []DBEsusuGroup
	query := s.db.Model(&DBEsusuGroup{})

	// If userID is provided, filter by user's groups
	if userID != "" {
		log.Printf("[ListGroups] Searching for groups where user_id = %s and tenant_id = %s", userID, tenantID)

		// Find all groups where user is a member
		var dbMembers []DBEsusuMember
		var result *gorm.DB
		if tenantID != "" {
			log.Printf("[ListGroups] Executing query: user_id = '%s' AND tenant_id = '%s'", userID, tenantID)
			result = s.db.Where("user_id = ? AND tenant_id = ?", userID, tenantID).Find(&dbMembers)
		} else {
			log.Printf("[ListGroups] Executing query: user_id = '%s'", userID)
			result = s.db.Where("user_id = ?", userID).Find(&dbMembers)
		}
		log.Printf("[ListGroups] Found %d member records for user %s (query error: %v)", len(dbMembers), userID, result.Error)

		// Debug: log each member found
		for i, dm := range dbMembers {
			log.Printf("[ListGroups] Member %d: id=%s, user_id=%s, group_id=%s, tenant_id=%s, name=%s",
				i, dm.ID, dm.UserID, dm.GroupID, dm.TenantID, dm.Name)
		}

		groupIDs := []string{}
		for _, dm := range dbMembers {
			groupIDs = append(groupIDs, dm.GroupID)
		}

		if len(groupIDs) == 0 {
			log.Printf("[ListGroups] No groups found for user %s", userID)
			return []*EsusuGroup{}
		}

		// Fetch groups by IDs and tenant_id
		if tenantID != "" {
			query = query.Where("id IN ? AND tenant_id = ?", groupIDs, tenantID)
		} else {
			query = query.Where("id IN ?", groupIDs)
		}
	} else {
		// If no userID, return all groups for this tenant
		log.Printf("[ListGroups] Fetching all groups for tenant %s (no user_id filter)", tenantID)
		if tenantID != "" {
			query = query.Where("tenant_id = ?", tenantID)
		}
	}

	// Filter by status if provided
	if status != "" {
		log.Printf("[ListGroups] Filtering by status: %s", status)
		query = query.Where("LOWER(status) = LOWER(?)", status)
	}

	// Apply pagination
	if page > 0 && limit > 0 {
		offset := (page - 1) * limit
		log.Printf("[ListGroups] Applying pagination: page=%d, limit=%d, offset=%d", page, limit, offset)
		query = query.Offset(offset).Limit(limit)
	}

	// Execute query
	query.Find(&dbGroups)
	log.Printf("[ListGroups] Found %d groups", len(dbGroups))

	result := []*EsusuGroup{}
	for _, dbGroup := range dbGroups {
		// Fetch members for this group
		var groupMembers []DBEsusuMember
		s.db.Where("group_id = ?", dbGroup.ID).Find(&groupMembers)
		members := []EsusuMember{}
		for _, dm := range groupMembers {
			m, _ := FromDBMember(&dm)
			members = append(members, *m)
		}

		group, _ := FromDBGroup(&dbGroup, members)
		result = append(result, group)
	}

	return result
}

func (s *EsusuService) StartGroup(groupID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Fetch group from database
	var dbGroup DBEsusuGroup
	if err := s.db.First(&dbGroup, "id = ?", groupID).Error; err != nil {
		return fmt.Errorf("group not found")
	}

	// Count members
	var memberCount int64
	s.db.Model(&DBEsusuMember{}).Where("group_id = ?", groupID).Count(&memberCount)

	if memberCount < 2 {
		return fmt.Errorf("minimum 2 members required to start")
	}

	// Fetch all members
	var dbMembers []DBEsusuMember
	s.db.Where("group_id = ?", groupID).Find(&dbMembers)
	members := []EsusuMember{}
	for _, dm := range dbMembers {
		m, _ := FromDBMember(&dm)
		members = append(members, *m)
	}

	group, _ := FromDBGroup(&dbGroup, members)
	group.TotalCycles = len(members)
	payoutOrder := s.aiEngine.CalculateOptimalRotationOrder(group)
	nextPayoutDate := s.calculateNextPayoutDate(group)

	payoutOrderJSON, _ := json.Marshal(payoutOrder)

	// Update group in database
	s.db.Model(&DBEsusuGroup{}).Where("id = ?", groupID).Updates(map[string]interface{}{
		"status":           string(GroupActive),
		"total_cycles":     len(members),
		"payout_order":     string(payoutOrderJSON),
		"next_payout_date": nextPayoutDate,
		"updated_at":       time.Now(),
	})

	return nil
}

func (s *EsusuService) calculateNextPayoutDate(group *EsusuGroup) time.Time {
	base := group.StartDate
	if group.CurrentCycle > 0 {
		base = group.NextPayoutDate
	}

	switch group.Frequency {
	case FreqDaily:
		return base.AddDate(0, 0, 1)
	case FreqWeekly:
		return base.AddDate(0, 0, 7)
	case FreqBiWeekly:
		return base.AddDate(0, 0, 14)
	case FreqMonthly:
		return base.AddDate(0, 1, 0)
	default:
		return base.AddDate(0, 1, 0)
	}
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

type CreateGroupRequest struct {
	Name               string           `json:"name"`
	Description        string           `json:"description"`
	CreatedBy          string           `json:"created_by"`
	CreatorName        string           `json:"creator_name"` // Support both creator_name (from frontend)
	AdminName          string           `json:"admin_name"`   // and admin_name (legacy)
	AdminPhone         string           `json:"admin_phone"`
	AdminEmail         string           `json:"admin_email"`
	ContributionAmount float64          `json:"contribution_amount"`
	Currency           string           `json:"currency"`
	Frequency          ContributionFreq `json:"frequency"`
	MaxMembers         int              `json:"max_members"`
	StartDate          time.Time        `json:"start_date"`
	LateFeePercentage  float64          `json:"late_fee_percentage"`
	GracePeriodDays    int              `json:"grace_period_days"`
	RequireGuarantor   bool             `json:"require_guarantor"`
	MinCreditScore     float64          `json:"min_credit_score"`
}

type JoinGroupRequest struct {
	UserID      string  `json:"user_id"`
	Name        string  `json:"name"`
	Phone       string  `json:"phone"`
	Email       string  `json:"email"`
	CreditScore float64 `json:"credit_score"`
}

type ContributionRequest struct {
	MemberID      string    `json:"member_id"`
	Amount        float64   `json:"amount"`
	ExpectedDate  time.Time `json:"expected_date"`
	PaymentMethod string    `json:"payment_method"`
}

// ============================================
// HTTP HANDLERS
// ============================================

type EsusuHandler struct {
	service *EsusuService
}

func NewEsusuHandler(service *EsusuService) *EsusuHandler {
	return &EsusuHandler{service: service}
}

func (h *EsusuHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	// Extract headers
	keycloakID := r.Header.Get("x-keycloak-id")
	tenantID := r.Header.Get("x-tenant-id")

	if tenantID == "" {
		log.Printf("[CreateGroup] Missing x-tenant-id header")
		SendError(w, "missing_tenant", "Tenant ID is required", http.StatusBadRequest, nil)
		return
	}

	if keycloakID == "" {
		log.Printf("[CreateGroup] Missing x-keycloak-id header")
		SendError(w, "missing_user", "User authentication required", http.StatusUnauthorized, nil)
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	// ALWAYS use x-keycloak-id from header as the authenticated user ID
	req.CreatedBy = keycloakID

	log.Printf("[CreateGroup] Creating group '%s' for user: %s (keycloak: %s, tenant: %s), creator_name: %s, admin_name: %s",
		req.Name, req.CreatedBy, keycloakID, tenantID, req.CreatorName, req.AdminName)

	group, err := h.service.CreateGroup(req, tenantID)
	if err != nil {
		log.Printf("[CreateGroup] Error: %v", err)
		SendError(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

func (h *EsusuHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	// Extract tenant header (optional for backward compatibility)
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		log.Printf("[GetGroup] Warning: x-tenant-id header missing for group %s", groupID)
	}

	group, err := h.service.GetGroup(groupID, tenantID)
	if err != nil {
		SendError(w, "not_found", "Group not found", http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

func (h *EsusuHandler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	// Extract headers
	keycloakID := r.Header.Get("x-keycloak-id")
	tenantID := r.Header.Get("x-tenant-id")

	if tenantID == "" {
		SendError(w, "missing_tenant", "Tenant ID is required", http.StatusBadRequest, nil)
		return
	}

	if keycloakID == "" {
		log.Printf("[JoinGroup] Missing x-keycloak-id header")
		SendError(w, "missing_user", "User authentication required", http.StatusUnauthorized, nil)
		return
	}

	var req JoinGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	// ALWAYS use x-keycloak-id from header as the authenticated user ID
	req.UserID = keycloakID

	member, err := h.service.JoinGroup(groupID, req, tenantID)
	if err != nil {
		SendError(w, "bad_request", err.Error(), http.StatusBadRequest, nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(member)
}

func (h *EsusuHandler) RecordContribution(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	// Extract headers
	keycloakID := r.Header.Get("x-keycloak-id")
	tenantID := r.Header.Get("x-tenant-id")

	if tenantID == "" {
		log.Printf("[RecordContribution] Warning: x-tenant-id header missing for group %s", groupID)
	}

	var req ContributionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendError(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	// If member_id not provided in request, use keycloak ID
	if req.MemberID == "" && keycloakID != "" {
		req.MemberID = keycloakID
	}

	log.Printf("[RecordContribution] Recording contribution for group: %s, member_id: %s, amount: %.2f, tenant: %s",
		groupID, req.MemberID, req.Amount, tenantID)

	contribution, err := h.service.RecordContribution(groupID, req)
	if err != nil {
		log.Printf("[RecordContribution] Error: %v", err)
		SendError(w, "bad_request", err.Error(), http.StatusBadRequest, nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contribution)
}

func (h *EsusuHandler) ProcessPayout(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	payout, err := h.service.ProcessPayout(groupID)
	if err != nil {
		SendError(w, "bad_request", err.Error(), http.StatusBadRequest, nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payout)
}

func (h *EsusuHandler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	analytics, err := h.service.GetGroupAnalytics(groupID)
	if err != nil {
		SendError(w, "not_found", "Analytics not found", http.StatusNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

func (h *EsusuHandler) StartGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]

	// Extract tenant header (optional for backward compatibility)
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		log.Printf("[StartGroup] Warning: x-tenant-id header missing for group %s", groupID)
	}

	if err := h.service.StartGroup(groupID); err != nil {
		SendError(w, "bad_request", err.Error(), http.StatusBadRequest, nil)
		return
	}

	group, _ := h.service.GetGroup(groupID, tenantID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

func (h *EsusuHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	// Extract headers
	keycloakID := r.Header.Get("x-keycloak-id")
	tenantID := r.Header.Get("x-tenant-id")

	// Tenant ID is optional for backward compatibility
	if tenantID == "" {
		log.Printf("[ListGroups] Warning: x-tenant-id header missing, querying all tenants")
	}

	// Parse query parameters
	userID := r.URL.Query().Get("user_id")
	myGroups := r.URL.Query().Get("my_groups")
	status := r.URL.Query().Get("status")
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	// If my_groups=true, use the authenticated user's ID
	if myGroups == "true" {
		if keycloakID != "" {
			userID = keycloakID
			log.Printf("[ListGroups] my_groups=true, using keycloak ID: %s", keycloakID)
		} else if userID == "" {
			log.Printf("[ListGroups] my_groups=true but no keycloak ID or user_id provided")
		}
	}
	// Do NOT automatically filter by user - only when explicitly requested via my_groups or user_id param

	// Parse pagination parameters
	page := 0
	limit := 0
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil {
			page = p
		}
	}
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	log.Printf("[ListGroups] Query params - user_id: %s, my_groups: %s, status: %s, page: %d, limit: %d, tenant: %s",
		userID, myGroups, status, page, limit, tenantID)

	groups := h.service.ListGroups(userID, tenantID, status, page, limit)
	log.Printf("[ListGroups] Found %d groups", len(groups))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func (h *EsusuHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "esusu-service",
		"version": "1.0.0",
	})
}

// ============================================
// MAIN
// ============================================

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func main() {
	// Initialize database connection
	db, err := InitDatabase()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Get underlying SQL DB for health checks
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get database instance: %v", err)
	}
	defer sqlDB.Close()

	service := NewEsusuService(db)
	handler := NewEsusuHandler(service)

	r := mux.NewRouter()
	r.Use(auditMiddleware)

	r.HandleFunc("/health", handler.HealthCheck).Methods("GET")
	r.HandleFunc("/ready", handler.ReadyCheck).Methods("GET")

	api := r.PathPrefix("/api/v1/esusu").Subrouter()
	api.HandleFunc("/groups", handler.CreateGroup).Methods("POST")
	api.HandleFunc("/groups", handler.ListGroups).Methods("GET")
	api.HandleFunc("/groups/{id}", handler.GetGroup).Methods("GET")
	api.HandleFunc("/groups/{id}/join", handler.JoinGroup).Methods("POST")
	api.HandleFunc("/groups/{id}/start", handler.StartGroup).Methods("POST")
	api.HandleFunc("/groups/{id}/contributions", handler.RecordContribution).Methods("POST")
	api.HandleFunc("/groups/{id}/payout", handler.ProcessPayout).Methods("POST")
	api.HandleFunc("/groups/{id}/analytics", handler.GetAnalytics).Methods("GET")

	// Meetings (cooperative society meetings)
	api.HandleFunc("/groups/{id}/meetings", handler.ListMeetings).Methods("GET")
	api.HandleFunc("/groups/{id}/meetings", handler.CreateMeeting).Methods("POST")
	api.HandleFunc("/groups/{id}/meetings/stats", handler.GetMeetingStats).Methods("GET")

	// Financials (aggregated from contributions + payouts)
	api.HandleFunc("/groups/{id}/financials", handler.GetFinancials).Methods("GET")

	// Credit scoring (derived from member AI profiles)
	api.HandleFunc("/groups/{id}/credit-scores", handler.GetCreditScores).Methods("GET")

	// Management records (decisions, disputes, policy changes)
	api.HandleFunc("/groups/{id}/management", handler.ListManagement).Methods("GET")
	api.HandleFunc("/groups/{id}/management", handler.CreateManagementRecord).Methods("POST")

	// Penalties (late/missed payment enforcement)
	api.HandleFunc("/groups/{id}/penalties", handler.ListPenalties).Methods("GET")
	api.HandleFunc("/groups/{id}/penalties", handler.CreatePenalty).Methods("POST")
	api.HandleFunc("/groups/{id}/penalties/{penaltyId}", handler.UpdatePenaltyStatus).Methods("PUT")

	// Rotation schedule
	api.HandleFunc("/groups/{id}/rotation", handler.GetRotation).Methods("GET")
	api.HandleFunc("/groups/{id}/rotation", handler.SetRotation).Methods("POST")

	portEnv := os.Getenv("PORT")
	if portEnv == "" {
		portEnv = "9578"
	}
	port := ":" + portEnv
	log.Printf("Esusu Service starting on port %s", port)
	log.Printf(" PostgreSQL database connected and migrated")
	log.Printf("🤖 AI/ML Features: Default Prediction, Optimal Rotation, Fraud Detection, Group Health Scoring")

	if err := http.ListenAndServe(port, jwtAuthMiddleware(r)); err != nil {
		log.Fatal(err)
	}
}
