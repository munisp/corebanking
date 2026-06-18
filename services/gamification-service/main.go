package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type GamificationServer struct {
	router *mux.Router
	engine *GamificationEngine
}

type AwardPointsRequest struct {
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id"`
	Action     string                 `json:"action"`
	Points     int                    `json:"points"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type AwardPointsResponse struct {
	TransactionID string `json:"transaction_id"`
	CustomerID    string `json:"customer_id"`
	PointsAwarded int    `json:"points_awarded"`
	TotalPoints   int    `json:"total_points"`
	NewLevel      string `json:"new_level,omitempty"`
}

type RedeemPointsRequest struct {
	TenantID   string `json:"tenant_id"`
	CustomerID string `json:"customer_id"`
	Points     int    `json:"points"`
	RewardID   string `json:"reward_id"`
}

type RedeemPointsResponse struct {
	TransactionID   string                 `json:"transaction_id"`
	PointsRedeemed  int                    `json:"points_redeemed"`
	RemainingPoints int                    `json:"remaining_points"`
	RewardDetails   map[string]interface{} `json:"reward_details"`
}

type LeaderboardEntry struct {
	Rank       int      `json:"rank"`
	CustomerID string   `json:"customer_id"`
	Name       string   `json:"name"`
	Points     int      `json:"points"`
	Level      string   `json:"level"`
	Badges     []string `json:"badges"`
}

type Achievement struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Points      int    `json:"points"`
	Icon        string `json:"icon"`
	UnlockedAt  string `json:"unlocked_at,omitempty"`
}

type Challenge struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Target      int    `json:"target"`
	Progress    int    `json:"progress"`
	Reward      int    `json:"reward"`
	ExpiresAt   string `json:"expires_at"`
	Status      string `json:"status"`
}

func NewGamificationServer() *GamificationServer {
	server := &GamificationServer{
		router: mux.NewRouter(),
		engine: NewGamificationEngine(),
	}
	server.setupRoutes()
	return server
}

func (s *GamificationServer) setupRoutes() {
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
	s.router.HandleFunc("/ready", s.readyHandler).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Points management
	api.HandleFunc("/gamification/points/award", s.awardPointsHandler).Methods("POST")
	api.HandleFunc("/gamification/points/redeem", s.redeemPointsHandler).Methods("POST")
	api.HandleFunc("/gamification/points/{customerId}", s.getPointsHandler).Methods("GET")
	api.HandleFunc("/gamification/points/{customerId}/history", s.getPointsHistoryHandler).Methods("GET")

	// Leaderboards
	api.HandleFunc("/gamification/leaderboard", s.getLeaderboardHandler).Methods("GET")
	api.HandleFunc("/gamification/leaderboard/{customerId}/rank", s.getCustomerRankHandler).Methods("GET")

	// Achievements and badges
	api.HandleFunc("/gamification/achievements", s.getAchievementsHandler).Methods("GET")
	api.HandleFunc("/gamification/achievements/{customerId}", s.getCustomerAchievementsHandler).Methods("GET")
	api.HandleFunc("/gamification/badges/{customerId}", s.getCustomerBadgesHandler).Methods("GET")

	// Challenges
	api.HandleFunc("/gamification/challenges", s.getChallengesHandler).Methods("GET")
	api.HandleFunc("/gamification/challenges/{customerId}", s.getCustomerChallengesHandler).Methods("GET")
	api.HandleFunc("/gamification/challenges/{challengeId}/join", s.joinChallengeHandler).Methods("POST")
	api.HandleFunc("/gamification/challenges/{challengeId}/progress", s.updateChallengeProgressHandler).Methods("POST")

	// Rewards catalog
	api.HandleFunc("/gamification/rewards", s.getRewardsCatalogHandler).Methods("GET")
	api.HandleFunc("/gamification/rewards/{rewardId}", s.getRewardDetailsHandler).Methods("GET")

	// Levels and tiers
	api.HandleFunc("/gamification/levels", s.getLevelsHandler).Methods("GET")
	api.HandleFunc("/gamification/levels/{customerId}", s.getCustomerLevelHandler).Methods("GET")
}

func (s *GamificationServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *GamificationServer) readyHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]bool{"ready": true})
}

func (s *GamificationServer) awardPointsHandler(w http.ResponseWriter, r *http.Request) {
	var req AwardPointsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.AwardPoints(req.TenantID, req.CustomerID, req.Action, req.Points)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) redeemPointsHandler(w http.ResponseWriter, r *http.Request) {
	var req RedeemPointsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.RedeemPoints(req.TenantID, req.CustomerID, req.Points, req.RewardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) getPointsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	points, err := s.engine.GetPoints(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(points)
}

func (s *GamificationServer) getPointsHistoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	history, err := s.engine.GetPointsHistory(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(history)
}

func (s *GamificationServer) getLeaderboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "weekly"
	}

	leaderboard, err := s.engine.GetLeaderboard(tenantID, period)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(leaderboard)
}

func (s *GamificationServer) getCustomerRankHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	rank, err := s.engine.GetCustomerRank(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(rank)
}

func (s *GamificationServer) getAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	achievements, err := s.engine.GetAllAchievements(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(achievements)
}

func (s *GamificationServer) getCustomerAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	achievements, err := s.engine.GetCustomerAchievements(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(achievements)
}

func (s *GamificationServer) getCustomerBadgesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	badges, err := s.engine.GetCustomerBadges(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(badges)
}

func (s *GamificationServer) getChallengesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	challenges, err := s.engine.GetActiveChallenges(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(challenges)
}

func (s *GamificationServer) getCustomerChallengesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	challenges, err := s.engine.GetCustomerChallenges(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(challenges)
}

func (s *GamificationServer) joinChallengeHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID := vars["challengeId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		CustomerID string `json:"customer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.JoinChallenge(tenantID, req.CustomerID, challengeID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) updateChallengeProgressHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID := vars["challengeId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		CustomerID string `json:"customer_id"`
		Progress   int    `json:"progress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.UpdateChallengeProgress(tenantID, req.CustomerID, challengeID, req.Progress)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) getRewardsCatalogHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	rewards, err := s.engine.GetRewardsCatalog(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(rewards)
}

func (s *GamificationServer) getRewardDetailsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rewardID := vars["rewardId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	reward, err := s.engine.GetRewardDetails(tenantID, rewardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(reward)
}

func (s *GamificationServer) getLevelsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	levels, err := s.engine.GetLevels(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(levels)
}

func (s *GamificationServer) getCustomerLevelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	level, err := s.engine.GetCustomerLevel(tenantID, customerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(level)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := NewGamificationServer()

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      server.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Gamification service starting on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down gamification service...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Gamification service stopped")
}

type pointsEvent struct {
	Action    string    `json:"action"`
	Points    int       `json:"points"`
	Timestamp time.Time `json:"timestamp"`
}

type rewardCatalogEntry struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	PointsRequired int    `json:"points_required"`
	Type           string `json:"type"`
}

type customerChallengeState struct {
	Challenge Challenge
	Joined    bool
}

type GamificationEngine struct {
	mu                 sync.RWMutex
	points             map[string]int
	history            map[string][]pointsEvent
	achievements       []Achievement
	rewardCatalog      []rewardCatalogEntry
	challenges         []Challenge
	customerChallenges map[string]map[string]*customerChallengeState
}

func NewGamificationEngine() *GamificationEngine {
	return &GamificationEngine{
		points:  map[string]int{},
		history: map[string][]pointsEvent{},
		achievements: []Achievement{
			{ID: "first_transfer", Name: "First Transfer", Description: "Complete your first transfer", Points: 50, Icon: "transfer"},
			{ID: "saver_1000", Name: "Saver 1000", Description: "Reach 1,000 points", Points: 100, Icon: "trophy"},
		},
		rewardCatalog: []rewardCatalogEntry{
			{ID: "airtime_100", Name: "Airtime 100", PointsRequired: 500, Type: "airtime"},
			{ID: "cashback_500", Name: "Cashback 500", PointsRequired: 2000, Type: "cashback"},
		},
		challenges: []Challenge{
			{ID: "weekly_saver", Name: "Weekly Saver", Description: "Complete five qualifying savings actions this week", Target: 5, Reward: 100, ExpiresAt: time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339), Status: "active"},
			{ID: "roundup_champion", Name: "Round-Up Champion", Description: "Complete ten round-up savings events", Target: 10, Reward: 250, ExpiresAt: time.Now().Add(14 * 24 * time.Hour).Format(time.RFC3339), Status: "active"},
		},
		customerChallenges: map[string]map[string]*customerChallengeState{},
	}
}

func (e *GamificationEngine) AwardPoints(tenantID, customerID, action string, points int) (*AwardPointsResponse, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if points <= 0 {
		return nil, fmt.Errorf("points must be positive")
	}
	e.points[customerID] += points
	e.history[customerID] = append(e.history[customerID], pointsEvent{Action: action, Points: points, Timestamp: time.Now()})
	level := levelForPoints(e.points[customerID])
	return &AwardPointsResponse{
		TransactionID: fmt.Sprintf("txn_%s_%d", customerID, time.Now().UnixNano()),
		CustomerID:    customerID,
		PointsAwarded: points,
		TotalPoints:   e.points[customerID],
		NewLevel:      level,
	}, nil
}

func (e *GamificationEngine) RedeemPoints(tenantID, customerID string, points int, rewardID string) (*RedeemPointsResponse, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if points <= 0 {
		return nil, fmt.Errorf("points must be positive")
	}
	if e.points[customerID] < points {
		return nil, fmt.Errorf("insufficient points")
	}
	reward, ok := e.findReward(rewardID)
	if !ok {
		return nil, fmt.Errorf("reward not found")
	}
	e.points[customerID] -= points
	e.history[customerID] = append(e.history[customerID], pointsEvent{Action: "redeem:" + rewardID, Points: -points, Timestamp: time.Now()})
	return &RedeemPointsResponse{
		TransactionID:   fmt.Sprintf("txn_%s_%d", customerID, time.Now().UnixNano()),
		PointsRedeemed:  points,
		RemainingPoints: e.points[customerID],
		RewardDetails:   map[string]interface{}{"reward_id": reward.ID, "name": reward.Name, "type": reward.Type},
	}, nil
}

func (e *GamificationEngine) GetPoints(tenantID, customerID string) (map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	points := e.points[customerID]
	return map[string]interface{}{"customer_id": customerID, "total_points": points, "level": levelForPoints(points)}, nil
}

func (e *GamificationEngine) GetPointsHistory(tenantID, customerID string) ([]map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	events := e.history[customerID]
	result := make([]map[string]interface{}, 0, len(events))
	for _, event := range events {
		result = append(result, map[string]interface{}{"action": event.Action, "points": event.Points, "timestamp": event.Timestamp.Format(time.RFC3339)})
	}
	return result, nil
}

func (e *GamificationEngine) GetLeaderboard(tenantID, period string) ([]LeaderboardEntry, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	entries := make([]LeaderboardEntry, 0, len(e.points))
	for customerID, points := range e.points {
		entries = append(entries, LeaderboardEntry{CustomerID: customerID, Name: customerID, Points: points, Level: levelForPoints(points), Badges: badgesForPoints(points)})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Points > entries[j].Points })
	for i := range entries {
		entries[i].Rank = i + 1
	}
	return entries, nil
}

func (e *GamificationEngine) GetCustomerRank(tenantID, customerID string) (map[string]interface{}, error) {
	entries, err := e.GetLeaderboard(tenantID, "current")
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if entry.CustomerID == customerID {
			return map[string]interface{}{"rank": entry.Rank, "total_participants": len(entries)}, nil
		}
	}
	return map[string]interface{}{"rank": 0, "total_participants": len(entries)}, nil
}

func (e *GamificationEngine) GetAllAchievements(tenantID string) ([]Achievement, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return append([]Achievement(nil), e.achievements...), nil
}

func (e *GamificationEngine) GetCustomerAchievements(tenantID, customerID string) ([]Achievement, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	points := e.points[customerID]
	unlocked := []Achievement{}
	for _, achievement := range e.achievements {
		if achievement.ID == "first_transfer" && len(e.history[customerID]) > 0 {
			achievement.UnlockedAt = time.Now().Format(time.RFC3339)
			unlocked = append(unlocked, achievement)
		}
		if achievement.ID == "saver_1000" && points >= 1000 {
			achievement.UnlockedAt = time.Now().Format(time.RFC3339)
			unlocked = append(unlocked, achievement)
		}
	}
	return unlocked, nil
}

func (e *GamificationEngine) GetCustomerBadges(tenantID, customerID string) ([]string, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return badgesForPoints(e.points[customerID]), nil
}

func (e *GamificationEngine) GetActiveChallenges(tenantID string) ([]Challenge, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return append([]Challenge(nil), e.challenges...), nil
}

func (e *GamificationEngine) GetCustomerChallenges(tenantID, customerID string) ([]Challenge, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	states := e.customerChallenges[customerID]
	result := make([]Challenge, 0, len(e.challenges))
	for _, challenge := range e.challenges {
		if state, ok := states[challenge.ID]; ok {
			result = append(result, state.Challenge)
		} else {
			result = append(result, challenge)
		}
	}
	return result, nil
}

func (e *GamificationEngine) JoinChallenge(tenantID, customerID, challengeID string) (map[string]interface{}, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	challenge, ok := e.findChallenge(challengeID)
	if !ok {
		return nil, fmt.Errorf("challenge not found")
	}
	if e.customerChallenges[customerID] == nil {
		e.customerChallenges[customerID] = map[string]*customerChallengeState{}
	}
	copied := challenge
	copied.Progress = 0
	e.customerChallenges[customerID][challengeID] = &customerChallengeState{Challenge: copied, Joined: true}
	return map[string]interface{}{"joined": true, "challenge_id": challengeID}, nil
}

func (e *GamificationEngine) UpdateChallengeProgress(tenantID, customerID, challengeID string, progress int) (map[string]interface{}, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.customerChallenges[customerID] == nil || e.customerChallenges[customerID][challengeID] == nil {
		return nil, fmt.Errorf("challenge not joined")
	}
	state := e.customerChallenges[customerID][challengeID]
	state.Challenge.Progress = progress
	completed := progress >= state.Challenge.Target
	if completed {
		state.Challenge.Status = "completed"
		e.points[customerID] += state.Challenge.Reward
	}
	return map[string]interface{}{"progress": progress, "completed": completed}, nil
}

func (e *GamificationEngine) GetRewardsCatalog(tenantID string) ([]map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]map[string]interface{}, 0, len(e.rewardCatalog))
	for _, reward := range e.rewardCatalog {
		result = append(result, map[string]interface{}{"id": reward.ID, "name": reward.Name, "points_required": reward.PointsRequired, "type": reward.Type})
	}
	return result, nil
}

func (e *GamificationEngine) GetRewardDetails(tenantID, rewardID string) (map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	reward, ok := e.findReward(rewardID)
	if !ok {
		return nil, fmt.Errorf("reward not found")
	}
	return map[string]interface{}{"id": reward.ID, "name": reward.Name, "points_required": reward.PointsRequired, "type": reward.Type}, nil
}

func (e *GamificationEngine) GetLevels(tenantID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{{"level": "Bronze", "min_points": 0}, {"level": "Silver", "min_points": 1000}, {"level": "Gold", "min_points": 5000}, {"level": "Platinum", "min_points": 10000}}, nil
}

func (e *GamificationEngine) GetCustomerLevel(tenantID, customerID string) (map[string]interface{}, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	points := e.points[customerID]
	nextLevel, pointsToNext := nextLevelForPoints(points)
	return map[string]interface{}{"level": levelForPoints(points), "points": points, "next_level": nextLevel, "points_to_next": pointsToNext}, nil
}

func (e *GamificationEngine) findReward(rewardID string) (rewardCatalogEntry, bool) {
	for _, reward := range e.rewardCatalog {
		if reward.ID == rewardID {
			return reward, true
		}
	}
	return rewardCatalogEntry{}, false
}

func (e *GamificationEngine) findChallenge(challengeID string) (Challenge, bool) {
	for _, challenge := range e.challenges {
		if challenge.ID == challengeID {
			return challenge, true
		}
	}
	return Challenge{}, false
}

func levelForPoints(points int) string {
	switch {
	case points >= 10000:
		return "Platinum"
	case points >= 5000:
		return "Gold"
	case points >= 1000:
		return "Silver"
	default:
		return "Bronze"
	}
}

func nextLevelForPoints(points int) (string, int) {
	switch {
	case points < 1000:
		return "Silver", 1000 - points
	case points < 5000:
		return "Gold", 5000 - points
	case points < 10000:
		return "Platinum", 10000 - points
	default:
		return "Top tier", 0
	}
}

func badgesForPoints(points int) []string {
	badges := []string{"member"}
	if points >= 1000 {
		badges = append(badges, "consistent_saver")
	}
	if points >= 5000 {
		badges = append(badges, "gold_circle")
	}
	if points >= 10000 {
		badges = append(badges, "platinum_elite")
	}
	return badges
}
