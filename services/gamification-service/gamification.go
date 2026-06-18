package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Gamification Service for 54Bank
// Implements savings goals, achievements, streaks, and rewards

// Prometheus metrics
var (
	goalsCreated = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "gamification_goals_created_total",
			Help: "Total savings goals created",
		},
	)

	goalsCompleted = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "gamification_goals_completed_total",
			Help: "Total savings goals completed",
		},
	)

	achievementsUnlocked = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gamification_achievements_unlocked_total",
			Help: "Total achievements unlocked",
		},
		[]string{"achievement"},
	)

	pointsEarned = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "gamification_points_earned_total",
			Help: "Total points earned",
		},
	)

	streakDays = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "gamification_streak_days",
			Help:    "Savings streak duration in days",
			Buckets: []float64{7, 14, 30, 60, 90, 180, 365},
		},
	)
)

// SavingsGoal represents a savings goal
type SavingsGoal struct {
	ID              string          `json:"id"`
	UserID          string          `json:"user_id"`
	Name            string          `json:"name"`
	Description     string          `json:"description,omitempty"`
	TargetAmount    float64         `json:"target_amount"`
	CurrentAmount   float64         `json:"current_amount"`
	Currency        string          `json:"currency"`
	Category        GoalCategory    `json:"category"`
	TargetDate      time.Time       `json:"target_date"`
	ImageURL        string          `json:"image_url,omitempty"`
	Status          GoalStatus      `json:"status"`
	AutoSave        *AutoSaveConfig `json:"auto_save,omitempty"`
	Contributions   []Contribution  `json:"contributions,omitempty"`
	Milestones      []Milestone     `json:"milestones,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
}

// GoalCategory represents goal categories
type GoalCategory string

const (
	CategoryEmergency   GoalCategory = "emergency"
	CategoryVacation    GoalCategory = "vacation"
	CategoryEducation   GoalCategory = "education"
	CategoryHome        GoalCategory = "home"
	CategoryCar         GoalCategory = "car"
	CategoryWedding     GoalCategory = "wedding"
	CategoryBusiness    GoalCategory = "business"
	CategoryRetirement  GoalCategory = "retirement"
	CategoryGadget      GoalCategory = "gadget"
	CategoryOther       GoalCategory = "other"
)

// GoalStatus represents goal status
type GoalStatus string

const (
	GoalStatusActive    GoalStatus = "active"
	GoalStatusPaused    GoalStatus = "paused"
	GoalStatusCompleted GoalStatus = "completed"
	GoalStatusCancelled GoalStatus = "cancelled"
)

// AutoSaveConfig represents automatic savings configuration
type AutoSaveConfig struct {
	Enabled     bool      `json:"enabled"`
	Amount      float64   `json:"amount"`
	Frequency   string    `json:"frequency"` // daily, weekly, monthly
	SourceAccount string  `json:"source_account"`
	NextRunDate time.Time `json:"next_run_date"`
}

// Contribution represents a contribution to a goal
type Contribution struct {
	ID        string    `json:"id"`
	Amount    float64   `json:"amount"`
	Source    string    `json:"source"` // manual, auto_save, round_up, bonus
	CreatedAt time.Time `json:"created_at"`
}

// Milestone represents a goal milestone
type Milestone struct {
	Percentage int       `json:"percentage"`
	Reached    bool      `json:"reached"`
	ReachedAt  *time.Time `json:"reached_at,omitempty"`
	Reward     *Reward   `json:"reward,omitempty"`
}

// Achievement represents a user achievement
type Achievement struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Category    AchievementCategory `json:"category"`
	Icon        string           `json:"icon"`
	Points      int              `json:"points"`
	Rarity      AchievementRarity `json:"rarity"`
	Criteria    AchievementCriteria `json:"criteria"`
	UnlockedAt  *time.Time       `json:"unlocked_at,omitempty"`
}

// AchievementCategory represents achievement categories
type AchievementCategory string

const (
	AchievementCategorySavings     AchievementCategory = "savings"
	AchievementCategoryTransactions AchievementCategory = "transactions"
	AchievementCategoryStreak      AchievementCategory = "streak"
	AchievementCategoryGoals       AchievementCategory = "goals"
	AchievementCategoryReferral    AchievementCategory = "referral"
	AchievementCategoryLoyalty     AchievementCategory = "loyalty"
)

// AchievementRarity represents achievement rarity
type AchievementRarity string

const (
	RarityCommon    AchievementRarity = "common"
	RarityUncommon  AchievementRarity = "uncommon"
	RarityRare      AchievementRarity = "rare"
	RarityEpic      AchievementRarity = "epic"
	RarityLegendary AchievementRarity = "legendary"
)

// AchievementCriteria defines criteria for unlocking achievements
type AchievementCriteria struct {
	Type      string  `json:"type"`
	Threshold float64 `json:"threshold"`
	TimeFrame string  `json:"time_frame,omitempty"`
}

// UserProgress represents a user's gamification progress
type UserProgress struct {
	UserID           string        `json:"user_id"`
	TotalPoints      int           `json:"total_points"`
	Level            int           `json:"level"`
	LevelName        string        `json:"level_name"`
	PointsToNextLevel int          `json:"points_to_next_level"`
	CurrentStreak    int           `json:"current_streak"`
	LongestStreak    int           `json:"longest_streak"`
	LastSaveDate     *time.Time    `json:"last_save_date,omitempty"`
	Achievements     []Achievement `json:"achievements"`
	Badges           []Badge       `json:"badges"`
	Rewards          []Reward      `json:"rewards"`
	Stats            UserStats     `json:"stats"`
}

// UserStats represents user statistics
type UserStats struct {
	TotalSaved          float64 `json:"total_saved"`
	GoalsCreated        int     `json:"goals_created"`
	GoalsCompleted      int     `json:"goals_completed"`
	TransactionsCount   int     `json:"transactions_count"`
	ReferralsCount      int     `json:"referrals_count"`
	DaysActive          int     `json:"days_active"`
	AverageMonthlySpend float64 `json:"average_monthly_spend"`
}

// Badge represents a user badge
type Badge struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	EarnedAt    time.Time `json:"earned_at"`
}

// Reward represents a reward
type Reward struct {
	ID          string       `json:"id"`
	Type        RewardType   `json:"type"`
	Value       float64      `json:"value"`
	Description string       `json:"description"`
	Status      RewardStatus `json:"status"`
	ExpiresAt   *time.Time   `json:"expires_at,omitempty"`
	ClaimedAt   *time.Time   `json:"claimed_at,omitempty"`
}

// RewardType represents reward types
type RewardType string

const (
	RewardTypeCashback    RewardType = "cashback"
	RewardTypePoints      RewardType = "points"
	RewardTypeInterestBoost RewardType = "interest_boost"
	RewardTypeFeeWaiver   RewardType = "fee_waiver"
	RewardTypeVoucher     RewardType = "voucher"
)

// RewardStatus represents reward status
type RewardStatus string

const (
	RewardStatusPending  RewardStatus = "pending"
	RewardStatusAvailable RewardStatus = "available"
	RewardStatusClaimed  RewardStatus = "claimed"
	RewardStatusExpired  RewardStatus = "expired"
)

// Leaderboard represents a leaderboard
type Leaderboard struct {
	Type    string            `json:"type"`
	Period  string            `json:"period"`
	Entries []LeaderboardEntry `json:"entries"`
}

// LeaderboardEntry represents a leaderboard entry
type LeaderboardEntry struct {
	Rank     int     `json:"rank"`
	UserID   string  `json:"user_id"`
	Username string  `json:"username"`
	Avatar   string  `json:"avatar,omitempty"`
	Score    float64 `json:"score"`
	Change   int     `json:"change"` // Position change from previous period
}

// Challenge represents a savings challenge
type Challenge struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        ChallengeType   `json:"type"`
	Target      float64         `json:"target"`
	Reward      Reward          `json:"reward"`
	StartDate   time.Time       `json:"start_date"`
	EndDate     time.Time       `json:"end_date"`
	Participants int            `json:"participants"`
	Status      ChallengeStatus `json:"status"`
}

// ChallengeType represents challenge types
type ChallengeType string

const (
	ChallengeTypeSaveAmount   ChallengeType = "save_amount"
	ChallengeTypeSaveStreak   ChallengeType = "save_streak"
	ChallengeTypeNoSpend      ChallengeType = "no_spend"
	ChallengeTypeRoundUp      ChallengeType = "round_up"
	ChallengeTypeCommunity    ChallengeType = "community"
)

// ChallengeStatus represents challenge status
type ChallengeStatus string

const (
	ChallengeStatusUpcoming ChallengeStatus = "upcoming"
	ChallengeStatusActive   ChallengeStatus = "active"
	ChallengeStatusEnded    ChallengeStatus = "ended"
)

// GamificationService handles gamification logic
type GamificationService struct {
	goalStore        GoalStore
	progressStore    ProgressStore
	achievementStore AchievementStore
	notificationSvc  NotificationService
	accountSvc       AccountService
	mutex            sync.RWMutex
}

// GoalStore interface for goal persistence
type GoalStore interface {
	Create(ctx context.Context, goal *SavingsGoal) error
	Get(ctx context.Context, id string) (*SavingsGoal, error)
	GetByUser(ctx context.Context, userID string) ([]*SavingsGoal, error)
	Update(ctx context.Context, goal *SavingsGoal) error
	Delete(ctx context.Context, id string) error
}

// ProgressStore interface for progress persistence
type ProgressStore interface {
	Get(ctx context.Context, userID string) (*UserProgress, error)
	Update(ctx context.Context, progress *UserProgress) error
}

// AchievementStore interface for achievement persistence
type AchievementStore interface {
	GetAll(ctx context.Context) ([]*Achievement, error)
	GetUserAchievements(ctx context.Context, userID string) ([]*Achievement, error)
	UnlockAchievement(ctx context.Context, userID, achievementID string) error
}

// NotificationService interface for notifications
type NotificationService interface {
	SendNotification(ctx context.Context, userID string, notification interface{}) error
}

// AccountService interface for account operations
type AccountService interface {
	Transfer(ctx context.Context, from, to string, amount float64) error
	GetBalance(ctx context.Context, accountID string) (float64, error)
}

// NewGamificationService creates a new gamification service
func NewGamificationService(
	goalStore GoalStore,
	progressStore ProgressStore,
	achievementStore AchievementStore,
	notificationSvc NotificationService,
	accountSvc AccountService,
) *GamificationService {
	return &GamificationService{
		goalStore:        goalStore,
		progressStore:    progressStore,
		achievementStore: achievementStore,
		notificationSvc:  notificationSvc,
		accountSvc:       accountSvc,
	}
}

// CreateGoal creates a new savings goal
func (s *GamificationService) CreateGoal(ctx context.Context, userID string, req CreateGoalRequest) (*SavingsGoal, error) {
	goal := &SavingsGoal{
		ID:           uuid.New().String(),
		UserID:       userID,
		Name:         req.Name,
		Description:  req.Description,
		TargetAmount: req.TargetAmount,
		Currency:     req.Currency,
		Category:     req.Category,
		TargetDate:   req.TargetDate,
		ImageURL:     req.ImageURL,
		Status:       GoalStatusActive,
		Milestones:   s.createMilestones(),
		CreatedAt:    time.Now(),
	}

	if req.AutoSave != nil {
		goal.AutoSave = req.AutoSave
	}

	if err := s.goalStore.Create(ctx, goal); err != nil {
		return nil, err
	}

	// Update user progress
	s.updateProgress(ctx, userID, func(p *UserProgress) {
		p.Stats.GoalsCreated++
	})

	// Check for achievements
	s.checkAchievements(ctx, userID)

	goalsCreated.Inc()

	return goal, nil
}

// CreateGoalRequest represents a create goal request
type CreateGoalRequest struct {
	Name         string          `json:"name"`
	Description  string          `json:"description,omitempty"`
	TargetAmount float64         `json:"target_amount"`
	Currency     string          `json:"currency"`
	Category     GoalCategory    `json:"category"`
	TargetDate   time.Time       `json:"target_date"`
	ImageURL     string          `json:"image_url,omitempty"`
	AutoSave     *AutoSaveConfig `json:"auto_save,omitempty"`
}

// ContributeToGoal adds a contribution to a goal
func (s *GamificationService) ContributeToGoal(ctx context.Context, goalID string, amount float64, source string) error {
	goal, err := s.goalStore.Get(ctx, goalID)
	if err != nil {
		return err
	}

	if goal.Status != GoalStatusActive {
		return fmt.Errorf("goal is not active")
	}

	// Create contribution
	contribution := Contribution{
		ID:        uuid.New().String(),
		Amount:    amount,
		Source:    source,
		CreatedAt: time.Now(),
	}

	goal.CurrentAmount += amount
	goal.Contributions = append(goal.Contributions, contribution)

	// Check milestones
	s.checkMilestones(ctx, goal)

	// Check if goal is completed
	if goal.CurrentAmount >= goal.TargetAmount {
		goal.Status = GoalStatusCompleted
		now := time.Now()
		goal.CompletedAt = &now

		// Update user progress
		s.updateProgress(ctx, goal.UserID, func(p *UserProgress) {
			p.Stats.GoalsCompleted++
			p.TotalPoints += 500 // Bonus points for completing goal
		})

		// Send notification
		s.notificationSvc.SendNotification(ctx, goal.UserID, map[string]interface{}{
			"type":    "goal_completed",
			"goal_id": goal.ID,
			"name":    goal.Name,
		})

		goalsCompleted.Inc()
	}

	// Update streak
	s.updateStreak(ctx, goal.UserID)

	// Award points
	points := int(amount / 100) // 1 point per 100 NGN saved
	s.awardPoints(ctx, goal.UserID, points)

	return s.goalStore.Update(ctx, goal)
}

func (s *GamificationService) createMilestones() []Milestone {
	return []Milestone{
		{Percentage: 25, Reached: false, Reward: &Reward{Type: RewardTypePoints, Value: 50}},
		{Percentage: 50, Reached: false, Reward: &Reward{Type: RewardTypePoints, Value: 100}},
		{Percentage: 75, Reached: false, Reward: &Reward{Type: RewardTypePoints, Value: 150}},
		{Percentage: 100, Reached: false, Reward: &Reward{Type: RewardTypeCashback, Value: 1}}, // 1% cashback
	}
}

func (s *GamificationService) checkMilestones(ctx context.Context, goal *SavingsGoal) {
	progress := (goal.CurrentAmount / goal.TargetAmount) * 100

	for i := range goal.Milestones {
		if !goal.Milestones[i].Reached && progress >= float64(goal.Milestones[i].Percentage) {
			goal.Milestones[i].Reached = true
			now := time.Now()
			goal.Milestones[i].ReachedAt = &now

			// Award milestone reward
			if goal.Milestones[i].Reward != nil {
				s.awardReward(ctx, goal.UserID, goal.Milestones[i].Reward)
			}

			// Send notification
			s.notificationSvc.SendNotification(ctx, goal.UserID, map[string]interface{}{
				"type":       "milestone_reached",
				"goal_id":    goal.ID,
				"percentage": goal.Milestones[i].Percentage,
			})
		}
	}
}

func (s *GamificationService) updateStreak(ctx context.Context, userID string) {
	s.updateProgress(ctx, userID, func(p *UserProgress) {
		now := time.Now()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

		if p.LastSaveDate != nil {
			lastSave := time.Date(p.LastSaveDate.Year(), p.LastSaveDate.Month(), p.LastSaveDate.Day(), 0, 0, 0, 0, p.LastSaveDate.Location())
			daysSinceLastSave := int(today.Sub(lastSave).Hours() / 24)

			if daysSinceLastSave == 1 {
				// Consecutive day - extend streak
				p.CurrentStreak++
			} else if daysSinceLastSave > 1 {
				// Streak broken
				p.CurrentStreak = 1
			}
			// Same day - no change to streak
		} else {
			p.CurrentStreak = 1
		}

		if p.CurrentStreak > p.LongestStreak {
			p.LongestStreak = p.CurrentStreak
		}

		p.LastSaveDate = &now

		streakDays.Observe(float64(p.CurrentStreak))
	})
}

func (s *GamificationService) awardPoints(ctx context.Context, userID string, points int) {
	s.updateProgress(ctx, userID, func(p *UserProgress) {
		p.TotalPoints += points
		p.Level = s.calculateLevel(p.TotalPoints)
		p.LevelName = s.getLevelName(p.Level)
		p.PointsToNextLevel = s.getPointsToNextLevel(p.TotalPoints, p.Level)
	})

	pointsEarned.Add(float64(points))
}

func (s *GamificationService) awardReward(ctx context.Context, userID string, reward *Reward) {
	reward.ID = uuid.New().String()
	reward.Status = RewardStatusAvailable

	s.updateProgress(ctx, userID, func(p *UserProgress) {
		p.Rewards = append(p.Rewards, *reward)
	})
}

func (s *GamificationService) calculateLevel(points int) int {
	// Level formula: level = floor(sqrt(points / 100))
	return int(math.Floor(math.Sqrt(float64(points) / 100)))
}

func (s *GamificationService) getLevelName(level int) string {
	names := []string{
		"Beginner Saver",
		"Bronze Saver",
		"Silver Saver",
		"Gold Saver",
		"Platinum Saver",
		"Diamond Saver",
		"Master Saver",
		"Legendary Saver",
	}

	if level >= len(names) {
		return names[len(names)-1]
	}
	return names[level]
}

func (s *GamificationService) getPointsToNextLevel(currentPoints, currentLevel int) int {
	nextLevelPoints := int(math.Pow(float64(currentLevel+1), 2) * 100)
	return nextLevelPoints - currentPoints
}

func (s *GamificationService) updateProgress(ctx context.Context, userID string, updateFn func(*UserProgress)) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	progress, err := s.progressStore.Get(ctx, userID)
	if err != nil {
		progress = &UserProgress{
			UserID: userID,
			Level:  0,
		}
	}

	updateFn(progress)

	s.progressStore.Update(ctx, progress)
}

func (s *GamificationService) checkAchievements(ctx context.Context, userID string) {
	progress, err := s.progressStore.Get(ctx, userID)
	if err != nil {
		return
	}

	achievements, _ := s.achievementStore.GetAll(ctx)
	userAchievements, _ := s.achievementStore.GetUserAchievements(ctx, userID)

	// Create map of unlocked achievements
	unlocked := make(map[string]bool)
	for _, a := range userAchievements {
		unlocked[a.ID] = true
	}

	// Check each achievement
	for _, achievement := range achievements {
		if unlocked[achievement.ID] {
			continue
		}

		if s.checkAchievementCriteria(achievement, progress) {
			s.achievementStore.UnlockAchievement(ctx, userID, achievement.ID)
			s.awardPoints(ctx, userID, achievement.Points)

			s.notificationSvc.SendNotification(ctx, userID, map[string]interface{}{
				"type":        "achievement_unlocked",
				"achievement": achievement.Name,
				"points":      achievement.Points,
			})

			achievementsUnlocked.WithLabelValues(achievement.Name).Inc()
		}
	}
}

func (s *GamificationService) checkAchievementCriteria(achievement *Achievement, progress *UserProgress) bool {
	switch achievement.Criteria.Type {
	case "total_saved":
		return progress.Stats.TotalSaved >= achievement.Criteria.Threshold
	case "goals_completed":
		return float64(progress.Stats.GoalsCompleted) >= achievement.Criteria.Threshold
	case "streak_days":
		return float64(progress.CurrentStreak) >= achievement.Criteria.Threshold
	case "level":
		return float64(progress.Level) >= achievement.Criteria.Threshold
	case "referrals":
		return float64(progress.Stats.ReferralsCount) >= achievement.Criteria.Threshold
	default:
		return false
	}
}

// GetUserProgress returns user's gamification progress
func (s *GamificationService) GetUserProgress(ctx context.Context, userID string) (*UserProgress, error) {
	return s.progressStore.Get(ctx, userID)
}

// GetUserGoals returns user's savings goals
func (s *GamificationService) GetUserGoals(ctx context.Context, userID string) ([]*SavingsGoal, error) {
	return s.goalStore.GetByUser(ctx, userID)
}

// GetLeaderboard returns the leaderboard
func (s *GamificationService) GetLeaderboard(ctx context.Context, leaderboardType, period string, limit int) (*Leaderboard, error) {
	// Implementation would query and rank users
	return &Leaderboard{
		Type:   leaderboardType,
		Period: period,
		Entries: []LeaderboardEntry{
			{Rank: 1, UserID: "user1", Username: "TopSaver", Score: 50000, Change: 0},
			{Rank: 2, UserID: "user2", Username: "SaverPro", Score: 45000, Change: 1},
			{Rank: 3, UserID: "user3", Username: "MoneyMaster", Score: 40000, Change: -1},
		},
	}, nil
}

// GetActiveChallenges returns active challenges
func (s *GamificationService) GetActiveChallenges(ctx context.Context) ([]*Challenge, error) {
	// Implementation would return active challenges
	return []*Challenge{
		{
			ID:          "challenge1",
			Name:        "30-Day Savings Sprint",
			Description: "Save at least ₦1,000 every day for 30 days",
			Type:        ChallengeTypeSaveStreak,
			Target:      30,
			Reward:      Reward{Type: RewardTypeCashback, Value: 5},
			StartDate:   time.Now(),
			EndDate:     time.Now().AddDate(0, 1, 0),
			Participants: 1250,
			Status:      ChallengeStatusActive,
		},
		{
			ID:          "challenge2",
			Name:        "Round-Up Champion",
			Description: "Enable round-up savings and save ₦10,000 from round-ups",
			Type:        ChallengeTypeRoundUp,
			Target:      10000,
			Reward:      Reward{Type: RewardTypePoints, Value: 500},
			StartDate:   time.Now(),
			EndDate:     time.Now().AddDate(0, 0, 14),
			Participants: 890,
			Status:      ChallengeStatusActive,
		},
	}, nil
}

// ClaimReward claims a reward
func (s *GamificationService) ClaimReward(ctx context.Context, userID, rewardID string) error {
	s.updateProgress(ctx, userID, func(p *UserProgress) {
		for i := range p.Rewards {
			if p.Rewards[i].ID == rewardID && p.Rewards[i].Status == RewardStatusAvailable {
				p.Rewards[i].Status = RewardStatusClaimed
				now := time.Now()
				p.Rewards[i].ClaimedAt = &now
				break
			}
		}
	})

	return nil
}

// Default achievements
var DefaultAchievements = []*Achievement{
	{
		ID:          "first_save",
		Name:        "First Steps",
		Description: "Make your first savings contribution",
		Category:    AchievementCategorySavings,
		Icon:        "🌱",
		Points:      50,
		Rarity:      RarityCommon,
		Criteria:    AchievementCriteria{Type: "total_saved", Threshold: 1},
	},
	{
		ID:          "save_10k",
		Name:        "Getting Started",
		Description: "Save a total of ₦10,000",
		Category:    AchievementCategorySavings,
		Icon:        "💰",
		Points:      100,
		Rarity:      RarityCommon,
		Criteria:    AchievementCriteria{Type: "total_saved", Threshold: 10000},
	},
	{
		ID:          "save_100k",
		Name:        "Serious Saver",
		Description: "Save a total of ₦100,000",
		Category:    AchievementCategorySavings,
		Icon:        "💎",
		Points:      500,
		Rarity:      RarityUncommon,
		Criteria:    AchievementCriteria{Type: "total_saved", Threshold: 100000},
	},
	{
		ID:          "save_1m",
		Name:        "Millionaire Mindset",
		Description: "Save a total of ₦1,000,000",
		Category:    AchievementCategorySavings,
		Icon:        "🏆",
		Points:      2000,
		Rarity:      RarityRare,
		Criteria:    AchievementCriteria{Type: "total_saved", Threshold: 1000000},
	},
	{
		ID:          "first_goal",
		Name:        "Goal Setter",
		Description: "Complete your first savings goal",
		Category:    AchievementCategoryGoals,
		Icon:        "🎯",
		Points:      200,
		Rarity:      RarityCommon,
		Criteria:    AchievementCriteria{Type: "goals_completed", Threshold: 1},
	},
	{
		ID:          "five_goals",
		Name:        "Goal Crusher",
		Description: "Complete 5 savings goals",
		Category:    AchievementCategoryGoals,
		Icon:        "🔥",
		Points:      1000,
		Rarity:      RarityUncommon,
		Criteria:    AchievementCriteria{Type: "goals_completed", Threshold: 5},
	},
	{
		ID:          "streak_7",
		Name:        "Week Warrior",
		Description: "Maintain a 7-day savings streak",
		Category:    AchievementCategoryStreak,
		Icon:        "📅",
		Points:      150,
		Rarity:      RarityCommon,
		Criteria:    AchievementCriteria{Type: "streak_days", Threshold: 7},
	},
	{
		ID:          "streak_30",
		Name:        "Monthly Master",
		Description: "Maintain a 30-day savings streak",
		Category:    AchievementCategoryStreak,
		Icon:        "🌟",
		Points:      500,
		Rarity:      RarityUncommon,
		Criteria:    AchievementCriteria{Type: "streak_days", Threshold: 30},
	},
	{
		ID:          "streak_100",
		Name:        "Centurion",
		Description: "Maintain a 100-day savings streak",
		Category:    AchievementCategoryStreak,
		Icon:        "👑",
		Points:      2000,
		Rarity:      RarityRare,
		Criteria:    AchievementCriteria{Type: "streak_days", Threshold: 100},
	},
	{
		ID:          "streak_365",
		Name:        "Year of Discipline",
		Description: "Maintain a 365-day savings streak",
		Category:    AchievementCategoryStreak,
		Icon:        "🏅",
		Points:      10000,
		Rarity:      RarityLegendary,
		Criteria:    AchievementCriteria{Type: "streak_days", Threshold: 365},
	},
	{
		ID:          "referral_1",
		Name:        "Friend Finder",
		Description: "Refer your first friend",
		Category:    AchievementCategoryReferral,
		Icon:        "🤝",
		Points:      100,
		Rarity:      RarityCommon,
		Criteria:    AchievementCriteria{Type: "referrals", Threshold: 1},
	},
	{
		ID:          "referral_10",
		Name:        "Community Builder",
		Description: "Refer 10 friends",
		Category:    AchievementCategoryReferral,
		Icon:        "🌐",
		Points:      1000,
		Rarity:      RarityRare,
		Criteria:    AchievementCriteria{Type: "referrals", Threshold: 10},
	},
}
