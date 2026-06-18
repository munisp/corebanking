package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ==================== DISTRIBUTION CHANNELS ====================
// APISIX Gateway, IVR/Voice Flows, Agent App Integration

// APISIX Gateway Configuration
type APIGatewayConfig struct {
	ServiceName     string            `json:"service_name"`
	UpstreamURL     string            `json:"upstream_url"`
	Routes          []GatewayRoute    `json:"routes"`
	Plugins         []GatewayPlugin   `json:"plugins"`
	RateLimiting    RateLimitConfig   `json:"rate_limiting"`
	Authentication  AuthConfig        `json:"authentication"`
}

type GatewayRoute struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	URI         string   `json:"uri"`
	Methods     []string `json:"methods"`
	Upstream    string   `json:"upstream"`
	Plugins     []string `json:"plugins"`
	Priority    int      `json:"priority"`
	Status      string   `json:"status"`
}

type GatewayPlugin struct {
	Name    string                 `json:"name"`
	Config  map[string]interface{} `json:"config"`
	Enabled bool                   `json:"enabled"`
}

type RateLimitConfig struct {
	RequestsPerSecond int    `json:"requests_per_second"`
	BurstSize         int    `json:"burst_size"`
	KeyType           string `json:"key_type"` // IP, CONSUMER, TENANT
}

type AuthConfig struct {
	Type           string   `json:"type"` // JWT, API_KEY, OAUTH2
	JWTSecret      string   `json:"jwt_secret,omitempty"`
	AllowedIssuers []string `json:"allowed_issuers,omitempty"`
}

// IVR/Voice Flow for low-literacy farmers
type IVRFlow struct {
	ID              string     `json:"id"`
	FlowName        string     `json:"flow_name"`
	Language        string     `json:"language"` // en, ha, yo, ig
	Description     string     `json:"description"`
	EntryPoint      string     `json:"entry_point"`
	Nodes           []IVRNode  `json:"nodes"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
}

type IVRNode struct {
	ID              string      `json:"id"`
	NodeType        string      `json:"node_type"` // MENU, INPUT, PLAY, TRANSFER, API_CALL
	Prompt          string      `json:"prompt"`
	PromptAudioURL  string      `json:"prompt_audio_url"`
	Options         []IVROption `json:"options"`
	NextNode        string      `json:"next_node"`
	TimeoutSeconds  int         `json:"timeout_seconds"`
	MaxRetries      int         `json:"max_retries"`
	APIEndpoint     string      `json:"api_endpoint,omitempty"`
}

type IVROption struct {
	DTMFKey     string `json:"dtmf_key"` // 1, 2, 3, etc.
	Description string `json:"description"`
	NextNode    string `json:"next_node"`
	Action      string `json:"action,omitempty"`
}

// IVR Session tracking
type IVRSession struct {
	ID              string    `json:"id"`
	CallerID        string    `json:"caller_id"`
	FarmerID        string    `json:"farmer_id"`
	FlowID          string    `json:"flow_id"`
	CurrentNode     string    `json:"current_node"`
	Language        string    `json:"language"`
	SessionData     map[string]interface{} `json:"session_data"`
	StartTime       time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	Status          string    `json:"status"` // ACTIVE, COMPLETED, ABANDONED
	TransactionType string    `json:"transaction_type"`
}

// Agent App Integration
type AgentProfile struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	AgentCode       string    `json:"agent_code"`
	AgentName       string    `json:"agent_name"`
	Phone           string    `json:"phone"`
	Email           string    `json:"email"`
	State           string    `json:"state"`
	LGA             string    `json:"lga"`
	GPSCoordinates  string    `json:"gps_coordinates"`
	AgentType       string    `json:"agent_type"` // FIELD_AGENT, COOPERATIVE_LEADER, EXTENSION_WORKER
	AssignedArea    string    `json:"assigned_area"`
	AssignedFarmers []string  `json:"assigned_farmers"`
	DeviceID        string    `json:"device_id"`
	LastSync        time.Time `json:"last_sync"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

// Offline Farmer Registration
type OfflineFarmerRegistration struct {
	ID              string    `json:"id"`
	AgentID         string    `json:"agent_id"`
	RegistrationData map[string]interface{} `json:"registration_data"`
	GPSCoordinates  string    `json:"gps_coordinates"`
	Photos          []string  `json:"photos"`
	Signature       string    `json:"signature"`
	CapturedAt      time.Time `json:"captured_at"`
	SyncedAt        *time.Time `json:"synced_at"`
	SyncStatus      string    `json:"sync_status"` // PENDING, SYNCED, FAILED
	ValidationErrors []string `json:"validation_errors"`
}

// Farm Visit Record
type FarmVisit struct {
	ID              string    `json:"id"`
	AgentID         string    `json:"agent_id"`
	FarmerID        string    `json:"farmer_id"`
	FarmID          string    `json:"farm_id"`
	LoanID          string    `json:"loan_id"`
	VisitType       string    `json:"visit_type"` // PRE_DISBURSEMENT, MONITORING, COLLECTION, VERIFICATION
	VisitDate       time.Time `json:"visit_date"`
	GPSCoordinates  string    `json:"gps_coordinates"`
	Photos          []string  `json:"photos"`
	CropCondition   string    `json:"crop_condition"` // EXCELLENT, GOOD, FAIR, POOR
	GrowthStage     string    `json:"growth_stage"`
	EstimatedYield  float64   `json:"estimated_yield"`
	Issues          []string  `json:"issues"`
	Recommendations []string  `json:"recommendations"`
	FarmerPresent   bool      `json:"farmer_present"`
	Notes           string    `json:"notes"`
	SyncStatus      string    `json:"sync_status"`
	CreatedAt       time.Time `json:"created_at"`
}

// Channel Performance Tracking
type ChannelPerformance struct {
	ChannelType     string    `json:"channel_type"` // USSD, IVR, AGENT, MOBILE, WEB
	TenantID        string    `json:"tenant_id"`
	Period          string    `json:"period"`
	TotalTransactions int     `json:"total_transactions"`
	SuccessfulTransactions int `json:"successful_transactions"`
	FailedTransactions int    `json:"failed_transactions"`
	AverageResponseTime float64 `json:"average_response_time"` // seconds
	UniqueUsers     int       `json:"unique_users"`
	NewRegistrations int      `json:"new_registrations"`
	LoanApplications int      `json:"loan_applications"`
	Repayments      int       `json:"repayments"`
	BalanceInquiries int      `json:"balance_inquiries"`
}

// Partner/Channel Tagging
type ChannelPartner struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	PartnerCode     string    `json:"partner_code"`
	PartnerName     string    `json:"partner_name"`
	PartnerType     string    `json:"partner_type"` // COOPERATIVE, NGO, GOVERNMENT, AGGREGATOR
	ContactPerson   string    `json:"contact_person"`
	Phone           string    `json:"phone"`
	Email           string    `json:"email"`
	CommissionRate  float64   `json:"commission_rate"`
	TotalReferrals  int       `json:"total_referrals"`
	ActiveLoans     int       `json:"active_loans"`
	TotalDisbursed  float64   `json:"total_disbursed"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

// Distribution Channels Service
type DistributionChannelsService struct {
	db *sql.DB
}

func NewDistributionChannelsService(db *sql.DB) *DistributionChannelsService {
	return &DistributionChannelsService{db: db}
}

// Register distribution channel routes
func (s *DistributionChannelsService) RegisterRoutes(r *mux.Router) {
	// APISIX Gateway Configuration
	r.HandleFunc("/api/v1/channels/gateway/config", s.GetGatewayConfig).Methods("GET")
	r.HandleFunc("/api/v1/channels/gateway/routes", s.ListGatewayRoutes).Methods("GET")
	r.HandleFunc("/api/v1/channels/gateway/routes", s.CreateGatewayRoute).Methods("POST")
	r.HandleFunc("/api/v1/channels/gateway/routes/{route_id}", s.UpdateGatewayRoute).Methods("PUT")
	r.HandleFunc("/api/v1/channels/gateway/routes/{route_id}", s.DeleteGatewayRoute).Methods("DELETE")
	r.HandleFunc("/api/v1/channels/gateway/health", s.CheckGatewayHealth).Methods("GET")
	
	// IVR/Voice Flows
	r.HandleFunc("/api/v1/channels/ivr/flows", s.ListIVRFlows).Methods("GET")
	r.HandleFunc("/api/v1/channels/ivr/flows", s.CreateIVRFlow).Methods("POST")
	r.HandleFunc("/api/v1/channels/ivr/flows/{flow_id}", s.GetIVRFlow).Methods("GET")
	r.HandleFunc("/api/v1/channels/ivr/flows/{flow_id}", s.UpdateIVRFlow).Methods("PUT")
	r.HandleFunc("/api/v1/channels/ivr/sessions", s.ListIVRSessions).Methods("GET")
	r.HandleFunc("/api/v1/channels/ivr/sessions", s.StartIVRSession).Methods("POST")
	r.HandleFunc("/api/v1/channels/ivr/sessions/{session_id}", s.GetIVRSession).Methods("GET")
	r.HandleFunc("/api/v1/channels/ivr/sessions/{session_id}/input", s.ProcessIVRInput).Methods("POST")
	r.HandleFunc("/api/v1/channels/ivr/sessions/{session_id}/end", s.EndIVRSession).Methods("POST")
	
	// Agent App
	r.HandleFunc("/api/v1/channels/agents", s.ListAgents).Methods("GET")
	r.HandleFunc("/api/v1/channels/agents", s.RegisterAgent).Methods("POST")
	r.HandleFunc("/api/v1/channels/agents/{agent_id}", s.GetAgent).Methods("GET")
	r.HandleFunc("/api/v1/channels/agents/{agent_id}", s.UpdateAgent).Methods("PUT")
	r.HandleFunc("/api/v1/channels/agents/{agent_id}/sync", s.SyncAgentData).Methods("POST")
	r.HandleFunc("/api/v1/channels/agents/{agent_id}/offline-data", s.GetOfflineData).Methods("GET")
	
	// Offline Registrations
	r.HandleFunc("/api/v1/channels/offline/registrations", s.ListOfflineRegistrations).Methods("GET")
	r.HandleFunc("/api/v1/channels/offline/registrations", s.SubmitOfflineRegistration).Methods("POST")
	r.HandleFunc("/api/v1/channels/offline/registrations/{reg_id}", s.GetOfflineRegistration).Methods("GET")
	r.HandleFunc("/api/v1/channels/offline/registrations/{reg_id}/sync", s.SyncOfflineRegistration).Methods("POST")
	r.HandleFunc("/api/v1/channels/offline/registrations/bulk-sync", s.BulkSyncRegistrations).Methods("POST")
	
	// Farm Visits
	r.HandleFunc("/api/v1/channels/visits", s.ListFarmVisits).Methods("GET")
	r.HandleFunc("/api/v1/channels/visits", s.RecordFarmVisit).Methods("POST")
	r.HandleFunc("/api/v1/channels/visits/{visit_id}", s.GetFarmVisit).Methods("GET")
	r.HandleFunc("/api/v1/channels/visits/{visit_id}/photos", s.UploadVisitPhotos).Methods("POST")
	r.HandleFunc("/api/v1/channels/visits/bulk-sync", s.BulkSyncVisits).Methods("POST")
	
	// Channel Performance
	r.HandleFunc("/api/v1/channels/performance", s.GetChannelPerformance).Methods("GET")
	r.HandleFunc("/api/v1/channels/performance/by-channel", s.GetPerformanceByChannel).Methods("GET")
	r.HandleFunc("/api/v1/channels/performance/trends", s.GetPerformanceTrends).Methods("GET")
	
	// Partners
	r.HandleFunc("/api/v1/channels/partners", s.ListPartners).Methods("GET")
	r.HandleFunc("/api/v1/channels/partners", s.RegisterPartner).Methods("POST")
	r.HandleFunc("/api/v1/channels/partners/{partner_id}", s.GetPartner).Methods("GET")
	r.HandleFunc("/api/v1/channels/partners/{partner_id}/performance", s.GetPartnerPerformance).Methods("GET")
}

// APISIX Gateway Handlers
func (s *DistributionChannelsService) GetGatewayConfig(w http.ResponseWriter, r *http.Request) {
	config := APIGatewayConfig{
		ServiceName: "agricultural-service",
		UpstreamURL: "http://agricultural-service:8015",
		Routes: []GatewayRoute{
			{ID: "agri-loans", Name: "Agricultural Loans", URI: "/api/v1/agricultural/*", Methods: []string{"GET", "POST", "PUT", "DELETE"}, Status: "ACTIVE"},
			{ID: "agri-farmers", Name: "Farmer Management", URI: "/api/v1/farmers/*", Methods: []string{"GET", "POST", "PUT"}, Status: "ACTIVE"},
			{ID: "agri-ussd", Name: "USSD Gateway", URI: "/api/v1/ussd/*", Methods: []string{"POST"}, Status: "ACTIVE"},
			{ID: "agri-ivr", Name: "IVR Gateway", URI: "/api/v1/channels/ivr/*", Methods: []string{"GET", "POST"}, Status: "ACTIVE"},
		},
		Plugins: []GatewayPlugin{
			{Name: "jwt-auth", Config: map[string]interface{}{"secret": "***"}, Enabled: true},
			{Name: "rate-limiting", Config: map[string]interface{}{"rate": 100, "burst": 200}, Enabled: true},
			{Name: "cors", Config: map[string]interface{}{"origins": []string{"*"}}, Enabled: true},
			{Name: "request-id", Config: map[string]interface{}{}, Enabled: true},
			{Name: "prometheus", Config: map[string]interface{}{"prefer_name": true}, Enabled: true},
		},
		RateLimiting: RateLimitConfig{
			RequestsPerSecond: 100,
			BurstSize:         200,
			KeyType:           "TENANT",
		},
		Authentication: AuthConfig{
			Type:           "JWT",
			AllowedIssuers: []string{"54bank-auth", "keycloak"},
		},
	}
	json.NewEncoder(w).Encode(config)
}

func (s *DistributionChannelsService) ListGatewayRoutes(w http.ResponseWriter, r *http.Request) {
	routes := []GatewayRoute{
		{ID: "agri-loans", Name: "Agricultural Loans", URI: "/api/v1/agricultural/*", Methods: []string{"GET", "POST", "PUT", "DELETE"}, Priority: 1, Status: "ACTIVE"},
		{ID: "agri-farmers", Name: "Farmer Management", URI: "/api/v1/farmers/*", Methods: []string{"GET", "POST", "PUT"}, Priority: 2, Status: "ACTIVE"},
		{ID: "agri-ussd", Name: "USSD Gateway", URI: "/api/v1/ussd/*", Methods: []string{"POST"}, Priority: 3, Status: "ACTIVE"},
		{ID: "agri-ivr", Name: "IVR Gateway", URI: "/api/v1/channels/ivr/*", Methods: []string{"GET", "POST"}, Priority: 4, Status: "ACTIVE"},
		{ID: "agri-agents", Name: "Agent App", URI: "/api/v1/channels/agents/*", Methods: []string{"GET", "POST", "PUT"}, Priority: 5, Status: "ACTIVE"},
	}
	json.NewEncoder(w).Encode(routes)
}

func (s *DistributionChannelsService) CreateGatewayRoute(w http.ResponseWriter, r *http.Request) {
	var req GatewayRoute
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("route-%d", time.Now().Unix())
	req.Status = "ACTIVE"
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) UpdateGatewayRoute(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	routeID := vars["route_id"]
	
	json.NewEncoder(w).Encode(map[string]string{
		"route_id": routeID,
		"status":   "updated",
	})
}

func (s *DistributionChannelsService) DeleteGatewayRoute(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	routeID := vars["route_id"]
	
	json.NewEncoder(w).Encode(map[string]string{
		"route_id": routeID,
		"status":   "deleted",
	})
}

func (s *DistributionChannelsService) CheckGatewayHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status":      "healthy",
		"uptime":      "99.99%",
		"latency_ms":  5,
		"active_connections": 150,
		"routes_active": 5,
		"last_check":  time.Now(),
	}
	json.NewEncoder(w).Encode(health)
}

// IVR Flow Handlers
func (s *DistributionChannelsService) ListIVRFlows(w http.ResponseWriter, r *http.Request) {
	language := r.URL.Query().Get("language")
	
	flows := []IVRFlow{
		{
			ID:          "IVR-MAIN-EN",
			FlowName:    "Main Menu - English",
			Language:    "en",
			Description: "Main IVR menu for English speakers",
			EntryPoint:  "WELCOME",
			Status:      "ACTIVE",
		},
		{
			ID:          "IVR-MAIN-HA",
			FlowName:    "Main Menu - Hausa",
			Language:    "ha",
			Description: "Main IVR menu for Hausa speakers",
			EntryPoint:  "WELCOME",
			Status:      "ACTIVE",
		},
		{
			ID:          "IVR-MAIN-YO",
			FlowName:    "Main Menu - Yoruba",
			Language:    "yo",
			Description: "Main IVR menu for Yoruba speakers",
			EntryPoint:  "WELCOME",
			Status:      "ACTIVE",
		},
		{
			ID:          "IVR-MAIN-IG",
			FlowName:    "Main Menu - Igbo",
			Language:    "ig",
			Description: "Main IVR menu for Igbo speakers",
			EntryPoint:  "WELCOME",
			Status:      "ACTIVE",
		},
	}
	
	if language != "" {
		filtered := []IVRFlow{}
		for _, f := range flows {
			if f.Language == language {
				filtered = append(filtered, f)
			}
		}
		flows = filtered
	}
	
	json.NewEncoder(w).Encode(flows)
}

func (s *DistributionChannelsService) CreateIVRFlow(w http.ResponseWriter, r *http.Request) {
	var req IVRFlow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("IVR-%d", time.Now().Unix())
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) GetIVRFlow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	flowID := vars["flow_id"]
	
	flow := IVRFlow{
		ID:          flowID,
		FlowName:    "Main Menu - English",
		Language:    "en",
		Description: "Main IVR menu for English speakers",
		EntryPoint:  "WELCOME",
		Nodes: []IVRNode{
			{
				ID:             "WELCOME",
				NodeType:       "PLAY",
				Prompt:         "Welcome to 54Bank Agricultural Banking. Press 1 for loan balance, 2 for repayment, 3 for new loan application, 4 for weather information.",
				PromptAudioURL: "/audio/en/welcome.mp3",
				Options: []IVROption{
					{DTMFKey: "1", Description: "Loan Balance", NextNode: "BALANCE"},
					{DTMFKey: "2", Description: "Repayment", NextNode: "REPAYMENT"},
					{DTMFKey: "3", Description: "New Loan", NextNode: "NEW_LOAN"},
					{DTMFKey: "4", Description: "Weather", NextNode: "WEATHER"},
				},
				TimeoutSeconds: 10,
				MaxRetries:     3,
			},
			{
				ID:             "BALANCE",
				NodeType:       "API_CALL",
				Prompt:         "Your current loan balance is {balance} Naira. Your next payment of {amount} is due on {date}.",
				APIEndpoint:    "/api/v1/agricultural/loans/balance",
				NextNode:       "MAIN_MENU",
				TimeoutSeconds: 5,
			},
			{
				ID:             "REPAYMENT",
				NodeType:       "MENU",
				Prompt:         "Press 1 to make a repayment via bank transfer, 2 for USSD payment, 3 to speak to an agent.",
				Options: []IVROption{
					{DTMFKey: "1", Description: "Bank Transfer", NextNode: "BANK_TRANSFER"},
					{DTMFKey: "2", Description: "USSD Payment", NextNode: "USSD_PAYMENT"},
					{DTMFKey: "3", Description: "Agent", NextNode: "TRANSFER_AGENT"},
				},
				TimeoutSeconds: 10,
			},
		},
		Status: "ACTIVE",
	}
	json.NewEncoder(w).Encode(flow)
}

func (s *DistributionChannelsService) UpdateIVRFlow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	flowID := vars["flow_id"]
	
	json.NewEncoder(w).Encode(map[string]string{
		"flow_id": flowID,
		"status":  "updated",
	})
}

func (s *DistributionChannelsService) ListIVRSessions(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	sessions := []IVRSession{
		{
			ID:              "SESSION-001",
			CallerID:        "+2348012345678",
			FarmerID:        "FARMER-001",
			FlowID:          "IVR-MAIN-HA",
			CurrentNode:     "BALANCE",
			Language:        "ha",
			StartTime:       time.Now().Add(-5 * time.Minute),
			Status:          "ACTIVE",
			TransactionType: "BALANCE_INQUIRY",
		},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"sessions":  sessions,
	})
}

func (s *DistributionChannelsService) StartIVRSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CallerID string `json:"caller_id"`
		Language string `json:"language"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	session := IVRSession{
		ID:          fmt.Sprintf("SESSION-%d", time.Now().Unix()),
		CallerID:    req.CallerID,
		FlowID:      fmt.Sprintf("IVR-MAIN-%s", req.Language),
		CurrentNode: "WELCOME",
		Language:    req.Language,
		SessionData: make(map[string]interface{}),
		StartTime:   time.Now(),
		Status:      "ACTIVE",
	}
	
	json.NewEncoder(w).Encode(session)
}

func (s *DistributionChannelsService) GetIVRSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]
	
	session := IVRSession{
		ID:          sessionID,
		CallerID:    "+2348012345678",
		CurrentNode: "BALANCE",
		Language:    "ha",
		Status:      "ACTIVE",
	}
	json.NewEncoder(w).Encode(session)
}

func (s *DistributionChannelsService) ProcessIVRInput(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]
	
	var req struct {
		DTMFInput string `json:"dtmf_input"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	
	result := map[string]interface{}{
		"session_id":   sessionID,
		"input":        req.DTMFInput,
		"next_node":    "BALANCE",
		"prompt":       "Your current loan balance is 500,000 Naira.",
		"prompt_audio": "/audio/ha/balance_500000.mp3",
	}
	json.NewEncoder(w).Encode(result)
}

func (s *DistributionChannelsService) EndIVRSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]
	
	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id": sessionID,
		"status":     "COMPLETED",
		"end_time":   now,
		"duration":   "5m30s",
	})
}

// Agent App Handlers
func (s *DistributionChannelsService) ListAgents(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	agents := []AgentProfile{
		{
			ID:             "AGENT-001",
			TenantID:       tenantID,
			AgentCode:      "AGT-KN-001",
			AgentName:      "Musa Ibrahim",
			Phone:          "+2348023456789",
			State:          "Kano",
			LGA:            "Kano Municipal",
			AgentType:      "FIELD_AGENT",
			AssignedArea:   "Kano Central",
			AssignedFarmers: []string{"FARMER-001", "FARMER-002", "FARMER-003"},
			LastSync:       time.Now().Add(-2 * time.Hour),
			Status:         "ACTIVE",
		},
		{
			ID:             "AGENT-002",
			TenantID:       tenantID,
			AgentCode:      "AGT-KD-001",
			AgentName:      "Amina Yusuf",
			Phone:          "+2348034567890",
			State:          "Kaduna",
			LGA:            "Zaria",
			AgentType:      "COOPERATIVE_LEADER",
			AssignedArea:   "Zaria North",
			AssignedFarmers: []string{"FARMER-004", "FARMER-005"},
			LastSync:       time.Now().Add(-30 * time.Minute),
			Status:         "ACTIVE",
		},
	}
	
	json.NewEncoder(w).Encode(agents)
}

func (s *DistributionChannelsService) RegisterAgent(w http.ResponseWriter, r *http.Request) {
	var req AgentProfile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("AGENT-%d", time.Now().Unix())
	req.AgentCode = fmt.Sprintf("AGT-%s-%03d", req.State[:2], time.Now().Unix()%1000)
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) GetAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["agent_id"]
	
	agent := AgentProfile{
		ID:        agentID,
		AgentCode: "AGT-KN-001",
		AgentName: "Musa Ibrahim",
		State:     "Kano",
		Status:    "ACTIVE",
	}
	json.NewEncoder(w).Encode(agent)
}

func (s *DistributionChannelsService) UpdateAgent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["agent_id"]
	
	json.NewEncoder(w).Encode(map[string]string{
		"agent_id": agentID,
		"status":   "updated",
	})
}

func (s *DistributionChannelsService) SyncAgentData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["agent_id"]
	
	var req struct {
		Registrations []OfflineFarmerRegistration `json:"registrations"`
		Visits        []FarmVisit                 `json:"visits"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	
	result := map[string]interface{}{
		"agent_id":              agentID,
		"registrations_synced":  len(req.Registrations),
		"visits_synced":         len(req.Visits),
		"sync_time":             time.Now(),
		"next_sync_recommended": time.Now().Add(4 * time.Hour),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *DistributionChannelsService) GetOfflineData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	agentID := vars["agent_id"]
	
	offlineData := map[string]interface{}{
		"agent_id": agentID,
		"farmers": []map[string]interface{}{
			{"farmer_id": "FARMER-001", "name": "John Farmer", "phone": "+2348012345678", "loan_balance": 500000},
			{"farmer_id": "FARMER-002", "name": "Jane Farmer", "phone": "+2348023456789", "loan_balance": 300000},
		},
		"pending_visits": []map[string]interface{}{
			{"farm_id": "FARM-001", "farmer_id": "FARMER-001", "visit_type": "MONITORING", "due_date": time.Now().AddDate(0, 0, 3)},
		},
		"crop_data":    CropDatabase,
		"weather_data": map[string]interface{}{"Kano": map[string]interface{}{"temp": 32, "humidity": 65, "forecast": "sunny"}},
		"last_updated": time.Now(),
	}
	json.NewEncoder(w).Encode(offlineData)
}

// Offline Registration Handlers
func (s *DistributionChannelsService) ListOfflineRegistrations(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agent_id")
	status := r.URL.Query().Get("status")
	
	registrations := []OfflineFarmerRegistration{
		{
			ID:         "REG-001",
			AgentID:    agentID,
			RegistrationData: map[string]interface{}{
				"name":  "New Farmer",
				"phone": "+2348045678901",
				"bvn":   "12345678901",
			},
			GPSCoordinates: "12.0025,8.5922",
			CapturedAt:     time.Now().Add(-2 * time.Hour),
			SyncStatus:     "PENDING",
		},
	}
	
	if status != "" {
		filtered := []OfflineFarmerRegistration{}
		for _, reg := range registrations {
			if reg.SyncStatus == status {
				filtered = append(filtered, reg)
			}
		}
		registrations = filtered
	}
	
	json.NewEncoder(w).Encode(registrations)
}

func (s *DistributionChannelsService) SubmitOfflineRegistration(w http.ResponseWriter, r *http.Request) {
	var req OfflineFarmerRegistration
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("REG-%d", time.Now().Unix())
	req.SyncStatus = "PENDING"
	req.CapturedAt = time.Now()
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) GetOfflineRegistration(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	regID := vars["reg_id"]
	
	reg := OfflineFarmerRegistration{
		ID:         regID,
		SyncStatus: "PENDING",
	}
	json.NewEncoder(w).Encode(reg)
}

func (s *DistributionChannelsService) SyncOfflineRegistration(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	regID := vars["reg_id"]
	
	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"registration_id": regID,
		"sync_status":     "SYNCED",
		"synced_at":       now,
		"farmer_id":       fmt.Sprintf("FARMER-%d", now.Unix()),
	})
}

func (s *DistributionChannelsService) BulkSyncRegistrations(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RegistrationIDs []string `json:"registration_ids"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	
	result := map[string]interface{}{
		"total":     len(req.RegistrationIDs),
		"synced":    len(req.RegistrationIDs),
		"failed":    0,
		"synced_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

// Farm Visit Handlers
func (s *DistributionChannelsService) ListFarmVisits(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agent_id")
	farmerID := r.URL.Query().Get("farmer_id")
	
	visits := []FarmVisit{
		{
			ID:             "VISIT-001",
			AgentID:        agentID,
			FarmerID:       farmerID,
			FarmID:         "FARM-001",
			LoanID:         "LOAN-001",
			VisitType:      "MONITORING",
			VisitDate:      time.Now().AddDate(0, 0, -7),
			GPSCoordinates: "12.0025,8.5922",
			CropCondition:  "GOOD",
			GrowthStage:    "VEGETATIVE",
			EstimatedYield: 4.2,
			FarmerPresent:  true,
			Notes:          "Crop looking healthy, good rainfall this season",
			SyncStatus:     "SYNCED",
		},
	}
	
	json.NewEncoder(w).Encode(visits)
}

func (s *DistributionChannelsService) RecordFarmVisit(w http.ResponseWriter, r *http.Request) {
	var req FarmVisit
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("VISIT-%d", time.Now().Unix())
	req.SyncStatus = "PENDING"
	req.CreatedAt = time.Now()
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) GetFarmVisit(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	visitID := vars["visit_id"]
	
	visit := FarmVisit{
		ID:            visitID,
		VisitType:     "MONITORING",
		CropCondition: "GOOD",
		SyncStatus:    "SYNCED",
	}
	json.NewEncoder(w).Encode(visit)
}

func (s *DistributionChannelsService) UploadVisitPhotos(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	visitID := vars["visit_id"]
	
	// In production, this would handle multipart file upload
	result := map[string]interface{}{
		"visit_id":      visitID,
		"photos_uploaded": 3,
		"photo_urls": []string{
			"/photos/visits/VISIT-001/photo1.jpg",
			"/photos/visits/VISIT-001/photo2.jpg",
			"/photos/visits/VISIT-001/photo3.jpg",
		},
	}
	json.NewEncoder(w).Encode(result)
}

func (s *DistributionChannelsService) BulkSyncVisits(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Visits []FarmVisit `json:"visits"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	
	result := map[string]interface{}{
		"total":     len(req.Visits),
		"synced":    len(req.Visits),
		"failed":    0,
		"synced_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

// Channel Performance Handlers
func (s *DistributionChannelsService) GetChannelPerformance(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	performance := map[string]interface{}{
		"tenant_id":   tenantID,
		"report_date": time.Now(),
		"summary": map[string]interface{}{
			"total_transactions":      15000,
			"successful_transactions": 14500,
			"success_rate":            96.7,
			"unique_users":            2500,
		},
		"by_channel": []ChannelPerformance{
			{ChannelType: "USSD", TotalTransactions: 8000, SuccessfulTransactions: 7800, UniqueUsers: 1500, LoanApplications: 200, Repayments: 500, BalanceInquiries: 3000},
			{ChannelType: "IVR", TotalTransactions: 3000, SuccessfulTransactions: 2850, UniqueUsers: 800, LoanApplications: 50, Repayments: 100, BalanceInquiries: 1500},
			{ChannelType: "AGENT", TotalTransactions: 2500, SuccessfulTransactions: 2450, UniqueUsers: 600, NewRegistrations: 150, LoanApplications: 100, Repayments: 200},
			{ChannelType: "MOBILE", TotalTransactions: 1000, SuccessfulTransactions: 980, UniqueUsers: 400, LoanApplications: 80, Repayments: 150, BalanceInquiries: 300},
			{ChannelType: "WEB", TotalTransactions: 500, SuccessfulTransactions: 420, UniqueUsers: 200, LoanApplications: 30, Repayments: 50, BalanceInquiries: 100},
		},
	}
	json.NewEncoder(w).Encode(performance)
}

func (s *DistributionChannelsService) GetPerformanceByChannel(w http.ResponseWriter, r *http.Request) {
	channel := r.URL.Query().Get("channel")
	
	performance := ChannelPerformance{
		ChannelType:           channel,
		TotalTransactions:     8000,
		SuccessfulTransactions: 7800,
		FailedTransactions:    200,
		AverageResponseTime:   2.5,
		UniqueUsers:           1500,
		NewRegistrations:      100,
		LoanApplications:      200,
		Repayments:            500,
		BalanceInquiries:      3000,
	}
	json.NewEncoder(w).Encode(performance)
}

func (s *DistributionChannelsService) GetPerformanceTrends(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	trends := []map[string]interface{}{}
	baseDate := time.Now()
	
	for i := 11; i >= 0; i-- {
		month := baseDate.AddDate(0, -i, 0)
		trends = append(trends, map[string]interface{}{
			"period":       month.Format("2006-01"),
			"ussd":         7000 + i*100,
			"ivr":          2500 + i*50,
			"agent":        2000 + i*50,
			"mobile":       800 + i*20,
			"web":          400 + i*10,
			"success_rate": 95.0 + float64(i)*0.2,
		})
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"trends":    trends,
	})
}

// Partner Handlers
func (s *DistributionChannelsService) ListPartners(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	partners := []ChannelPartner{
		{
			ID:             "PARTNER-001",
			TenantID:       tenantID,
			PartnerCode:    "COOP-KN-001",
			PartnerName:    "Kano Rice Farmers Cooperative",
			PartnerType:    "COOPERATIVE",
			ContactPerson:  "Alhaji Musa",
			Phone:          "+2348023456789",
			CommissionRate: 1.5,
			TotalReferrals: 150,
			ActiveLoans:    120,
			TotalDisbursed: 600000000,
			Status:         "ACTIVE",
		},
		{
			ID:             "PARTNER-002",
			TenantID:       tenantID,
			PartnerCode:    "NGO-NG-001",
			PartnerName:    "Agricultural Development Foundation",
			PartnerType:    "NGO",
			ContactPerson:  "Dr. Okonkwo",
			Phone:          "+2348034567890",
			CommissionRate: 0.5,
			TotalReferrals: 80,
			ActiveLoans:    65,
			TotalDisbursed: 325000000,
			Status:         "ACTIVE",
		},
	}
	
	json.NewEncoder(w).Encode(partners)
}

func (s *DistributionChannelsService) RegisterPartner(w http.ResponseWriter, r *http.Request) {
	var req ChannelPartner
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	req.ID = fmt.Sprintf("PARTNER-%d", time.Now().Unix())
	req.PartnerCode = fmt.Sprintf("%s-%d", req.PartnerType[:4], time.Now().Unix()%10000)
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()
	
	json.NewEncoder(w).Encode(req)
}

func (s *DistributionChannelsService) GetPartner(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	partnerID := vars["partner_id"]
	
	partner := ChannelPartner{
		ID:          partnerID,
		PartnerName: "Kano Rice Farmers Cooperative",
		PartnerType: "COOPERATIVE",
		Status:      "ACTIVE",
	}
	json.NewEncoder(w).Encode(partner)
}

func (s *DistributionChannelsService) GetPartnerPerformance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	partnerID := vars["partner_id"]
	
	performance := map[string]interface{}{
		"partner_id":       partnerID,
		"report_date":      time.Now(),
		"total_referrals":  150,
		"active_loans":     120,
		"total_disbursed":  600000000,
		"total_outstanding": 450000000,
		"npl_ratio":        3.0,
		"repayment_rate":   97.0,
		"commission_earned": 9000000,
		"monthly_trend": []map[string]interface{}{
			{"month": "2024-10", "referrals": 15, "disbursed": 75000000},
			{"month": "2024-11", "referrals": 18, "disbursed": 90000000},
			{"month": "2024-12", "referrals": 20, "disbursed": 100000000},
		},
	}
	json.NewEncoder(w).Encode(performance)
}
