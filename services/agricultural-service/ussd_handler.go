package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// ==================== USSD AGRICULTURAL FLOWS ====================
// Designed for Nigerian smallholder farmers using feature phones

type USSDSession struct {
	SessionID    string                 `json:"session_id"`
	PhoneNumber  string                 `json:"phone_number"`
	TenantID     string                 `json:"tenant_id"`
	FarmerID     string                 `json:"farmer_id"`
	CurrentMenu  string                 `json:"current_menu"`
	MenuHistory  []string               `json:"menu_history"`
	Data         map[string]interface{} `json:"data"`
	Language     string                 `json:"language"` // en, ha, yo, ig
	CreatedAt    time.Time              `json:"created_at"`
	LastActivity time.Time              `json:"last_activity"`
}

type USSDRequest struct {
	SessionID   string `json:"session_id"`
	PhoneNumber string `json:"phone_number"`
	Input       string `json:"input"`
	ServiceCode string `json:"service_code"`
}

type USSDResponse struct {
	SessionID string `json:"session_id"`
	Message   string `json:"message"`
	EndSession bool   `json:"end_session"`
}

type USSDHandler struct {
	db       *sql.DB
	sessions map[string]*USSDSession
}

func NewUSSDHandler(db *sql.DB) *USSDHandler {
	return &USSDHandler{
		db:       db,
		sessions: make(map[string]*USSDSession),
	}
}

// RegisterUSSDRoutes registers USSD endpoints
func (h *USSDHandler) RegisterUSSDRoutes(r interface{}) {
	// This would be registered with the main router
	// For now, we'll use http.HandleFunc pattern
}

// RegisterRoutes registers USSD endpoints on the main router.
func (h *USSDHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/ussd", h.HandleUSSD).Methods("POST")
}

// HandleUSSD processes USSD requests
func (h *USSDHandler) HandleUSSD(w http.ResponseWriter, r *http.Request) {
	var req USSDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get or create session
	session := h.getOrCreateSession(req.SessionID, req.PhoneNumber)
	
	// Process input and get response
	response := h.processInput(r.Context(), session, req.Input)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *USSDHandler) getOrCreateSession(sessionID, phoneNumber string) *USSDSession {
	if session, exists := h.sessions[sessionID]; exists {
		session.LastActivity = time.Now()
		return session
	}

	session := &USSDSession{
		SessionID:    sessionID,
		PhoneNumber:  phoneNumber,
		CurrentMenu:  "main",
		MenuHistory:  []string{},
		Data:         make(map[string]interface{}),
		Language:     "en",
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
	}

	// Try to find farmer by phone number
	var farmerID, tenantID string
	err := h.db.QueryRow(
		`SELECT id, tenant_id FROM farmers WHERE phone_number = $1 LIMIT 1`,
		phoneNumber).Scan(&farmerID, &tenantID)
	
	if err == nil {
		session.FarmerID = farmerID
		session.TenantID = tenantID
	}

	h.sessions[sessionID] = session
	return session
}

func (h *USSDHandler) processInput(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	input = strings.TrimSpace(input)

	// Handle back navigation
	if input == "0" && len(session.MenuHistory) > 0 {
		session.CurrentMenu = session.MenuHistory[len(session.MenuHistory)-1]
		session.MenuHistory = session.MenuHistory[:len(session.MenuHistory)-1]
		return h.getMenuResponse(ctx, session)
	}

	// Handle language selection
	if input == "99" {
		session.CurrentMenu = "language"
		return h.getMenuResponse(ctx, session)
	}

	// Process based on current menu
	switch session.CurrentMenu {
	case "main":
		return h.handleMainMenu(ctx, session, input)
	case "language":
		return h.handleLanguageMenu(ctx, session, input)
	case "register":
		return h.handleRegistration(ctx, session, input)
	case "loan_menu":
		return h.handleLoanMenu(ctx, session, input)
	case "loan_apply":
		return h.handleLoanApplication(ctx, session, input)
	case "loan_status":
		return h.handleLoanStatus(ctx, session, input)
	case "loan_repay":
		return h.handleLoanRepayment(ctx, session, input)
	case "insurance_menu":
		return h.handleInsuranceMenu(ctx, session, input)
	case "prices":
		return h.handlePrices(ctx, session, input)
	case "weather":
		return h.handleWeather(ctx, session, input)
	case "cooperative":
		return h.handleCooperative(ctx, session, input)
	case "balance":
		return h.handleBalance(ctx, session, input)
	default:
		session.CurrentMenu = "main"
		return h.getMenuResponse(ctx, session)
	}
}

func (h *USSDHandler) getMenuResponse(ctx context.Context, session *USSDSession) *USSDResponse {
	var message string

	switch session.CurrentMenu {
	case "main":
		if session.FarmerID == "" {
			message = h.getText(session.Language, "welcome_new")
		} else {
			message = h.getText(session.Language, "welcome_back")
		}
	case "language":
		message = "Select Language:\n1. English\n2. Hausa\n3. Yoruba\n4. Igbo\n\n0. Back"
	case "loan_menu":
		message = h.getText(session.Language, "loan_menu")
	case "insurance_menu":
		message = h.getText(session.Language, "insurance_menu")
	default:
		message = h.getText(session.Language, "welcome_back")
	}

	return &USSDResponse{
		SessionID:  session.SessionID,
		Message:    message,
		EndSession: false,
	}
}

func (h *USSDHandler) handleMainMenu(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	session.MenuHistory = append(session.MenuHistory, session.CurrentMenu)

	switch input {
	case "":
		// Initial request - show main menu
		return h.getMenuResponse(ctx, session)
	case "1":
		if session.FarmerID == "" {
			session.CurrentMenu = "register"
			session.Data["register_step"] = 1
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "register_name"),
				EndSession: false,
			}
		}
		session.CurrentMenu = "loan_menu"
		return h.getMenuResponse(ctx, session)
	case "2":
		session.CurrentMenu = "loan_status"
		return h.handleLoanStatus(ctx, session, "")
	case "3":
		session.CurrentMenu = "prices"
		return h.handlePrices(ctx, session, "")
	case "4":
		session.CurrentMenu = "weather"
		return h.handleWeather(ctx, session, "")
	case "5":
		session.CurrentMenu = "insurance_menu"
		return h.getMenuResponse(ctx, session)
	case "6":
		session.CurrentMenu = "cooperative"
		return h.handleCooperative(ctx, session, "")
	case "7":
		session.CurrentMenu = "balance"
		return h.handleBalance(ctx, session, "")
	default:
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "invalid_option"),
			EndSession: false,
		}
	}
}

func (h *USSDHandler) handleLanguageMenu(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	switch input {
	case "1":
		session.Language = "en"
	case "2":
		session.Language = "ha"
	case "3":
		session.Language = "yo"
	case "4":
		session.Language = "ig"
	default:
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "Invalid option. Select 1-4",
			EndSession: false,
		}
	}

	session.CurrentMenu = "main"
	return &USSDResponse{
		SessionID:  session.SessionID,
		Message:    h.getText(session.Language, "language_set"),
		EndSession: false,
	}
}

func (h *USSDHandler) handleRegistration(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	step, _ := session.Data["register_step"].(int)

	switch step {
	case 1:
		// Name entered
		session.Data["name"] = input
		session.Data["register_step"] = 2
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "register_bvn"),
			EndSession: false,
		}
	case 2:
		// BVN entered
		if len(input) != 11 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_bvn"),
				EndSession: false,
			}
		}
		session.Data["bvn"] = input
		session.Data["register_step"] = 3
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "register_state"),
			EndSession: false,
		}
	case 3:
		// State entered
		session.Data["state"] = input
		session.Data["register_step"] = 4
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "register_farm_size"),
			EndSession: false,
		}
	case 4:
		// Farm size entered
		farmSize, err := strconv.ParseFloat(input, 64)
		if err != nil {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_number"),
				EndSession: false,
			}
		}
		session.Data["farm_size"] = farmSize
		session.Data["register_step"] = 5
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "register_crop"),
			EndSession: false,
		}
	case 5:
		// Crop type entered
		session.Data["crop_type"] = input
		
		// Create farmer record
		farmerID := fmt.Sprintf("FRM%d", time.Now().UnixNano())
		_, err := h.db.ExecContext(ctx, `
			INSERT INTO farmers (id, tenant_id, full_name, phone_number, bvn, state, farm_size, crops_grown, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_verification', $9, $9)
		`, farmerID, "default", session.Data["name"], session.PhoneNumber, session.Data["bvn"],
			session.Data["state"], session.Data["farm_size"], 
			fmt.Sprintf(`["%s"]`, input), time.Now())

		if err != nil {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "registration_failed"),
				EndSession: true,
			}
		}

		session.FarmerID = farmerID
		session.TenantID = "default"
		session.CurrentMenu = "main"
		
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf(h.getText(session.Language, "registration_success"), farmerID),
			EndSession: true,
		}
	}

	return h.getMenuResponse(ctx, session)
}

func (h *USSDHandler) handleLoanMenu(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	session.MenuHistory = append(session.MenuHistory, session.CurrentMenu)

	switch input {
	case "":
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "loan_menu"),
			EndSession: false,
		}
	case "1":
		session.CurrentMenu = "loan_apply"
		session.Data["loan_step"] = 1
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "loan_select_crop"),
			EndSession: false,
		}
	case "2":
		session.CurrentMenu = "loan_status"
		return h.handleLoanStatus(ctx, session, "")
	case "3":
		session.CurrentMenu = "loan_repay"
		return h.handleLoanRepayment(ctx, session, "")
	default:
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "invalid_option"),
			EndSession: false,
		}
	}
}

func (h *USSDHandler) handleLoanApplication(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	step, _ := session.Data["loan_step"].(int)

	switch step {
	case 1:
		// Crop type selected
		crops := map[string]string{
			"1": "rice", "2": "maize", "3": "cassava", "4": "yam",
			"5": "sorghum", "6": "groundnut", "7": "cowpea", "8": "tomato",
		}
		crop, exists := crops[input]
		if !exists {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_crop"),
				EndSession: false,
			}
		}
		session.Data["crop_type"] = crop
		session.Data["loan_step"] = 2
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "loan_enter_amount"),
			EndSession: false,
		}
	case 2:
		// Amount entered
		amount, err := strconv.ParseFloat(input, 64)
		if err != nil || amount < 50000 || amount > 5000000 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_amount"),
				EndSession: false,
			}
		}
		session.Data["loan_amount"] = amount
		session.Data["loan_step"] = 3
		
		// Calculate and show loan terms
		cropType := session.Data["crop_type"].(string)
		interestRate := 15.0 // Base rate
		tenorDays := 120
		
		if cropData, exists := CropDatabase[cropType]; exists {
			tenorDays = cropData.GrowingPeriod + 30
			if cropData.RiskLevel == "high" {
				interestRate += 3.0
			}
		}
		
		totalInterest := amount * (interestRate / 100) * (float64(tenorDays) / 365)
		totalRepayment := amount + totalInterest
		
		session.Data["interest_rate"] = interestRate
		session.Data["tenor_days"] = tenorDays
		session.Data["total_repayment"] = totalRepayment
		
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: fmt.Sprintf(h.getText(session.Language, "loan_confirm"),
				amount, cropType, interestRate, tenorDays, totalRepayment),
			EndSession: false,
		}
	case 3:
		// Confirmation
		if input != "1" {
			session.CurrentMenu = "main"
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "loan_cancelled"),
				EndSession: true,
			}
		}
		
		// Create loan application
		loanID := fmt.Sprintf("AGRI%d", time.Now().UnixNano())
		amount := session.Data["loan_amount"].(float64)
		cropType := session.Data["crop_type"].(string)
		interestRate := session.Data["interest_rate"].(float64)
		tenorDays := session.Data["tenor_days"].(int)
		
		_, err := h.db.ExecContext(ctx, `
			INSERT INTO agricultural_loans (id, tenant_id, farmer_id, loan_type, loan_amount, 
				crop_type, interest_rate, tenor_days, status, created_at)
			VALUES ($1, $2, $3, 'crop', $4, $5, $6, $7, 'pending_approval', $8)
		`, loanID, session.TenantID, session.FarmerID, amount, cropType, interestRate, tenorDays, time.Now())
		
		if err != nil {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "loan_failed"),
				EndSession: true,
			}
		}
		
		session.CurrentMenu = "main"
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf(h.getText(session.Language, "loan_submitted"), loanID),
			EndSession: true,
		}
	}

	return h.getMenuResponse(ctx, session)
}

func (h *USSDHandler) handleLoanStatus(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	if session.FarmerID == "" {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "not_registered"),
			EndSession: true,
		}
	}

	rows, err := h.db.QueryContext(ctx, `
		SELECT id, loan_amount, outstanding_amount, crop_type, status 
		FROM agricultural_loans 
		WHERE farmer_id = $1 
		ORDER BY created_at DESC LIMIT 3
	`, session.FarmerID)
	
	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "error_occurred"),
			EndSession: true,
		}
	}
	defer rows.Close()

	var message strings.Builder
	message.WriteString(h.getText(session.Language, "loan_status_header"))
	
	hasLoans := false
	for rows.Next() {
		hasLoans = true
		var id, cropType, status string
		var amount, outstanding float64
		rows.Scan(&id, &amount, &outstanding, &cropType, &status)
		
		statusText := h.getStatusText(session.Language, status)
		message.WriteString(fmt.Sprintf("\n%s\n%s: N%.0f\nOwing: N%.0f\nStatus: %s\n",
			id[:15], cropType, amount, outstanding, statusText))
	}

	if !hasLoans {
		message.WriteString(h.getText(session.Language, "no_loans"))
	}

	message.WriteString("\n0. Back")

	session.CurrentMenu = "main"
	return &USSDResponse{
		SessionID:  session.SessionID,
		Message:    message.String(),
		EndSession: false,
	}
}

func (h *USSDHandler) handleLoanRepayment(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	step, _ := session.Data["repay_step"].(int)

	switch step {
	case 0, 1:
		// Show active loans
		rows, err := h.db.QueryContext(ctx, `
			SELECT id, outstanding_amount, crop_type 
			FROM agricultural_loans 
			WHERE farmer_id = $1 AND status = 'active' AND outstanding_amount > 0
			ORDER BY created_at DESC LIMIT 5
		`, session.FarmerID)
		
		if err != nil {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "error_occurred"),
				EndSession: true,
			}
		}
		defer rows.Close()

		var message strings.Builder
		message.WriteString(h.getText(session.Language, "select_loan_repay"))
		
		loans := make([]string, 0)
		i := 1
		for rows.Next() {
			var id, cropType string
			var outstanding float64
			rows.Scan(&id, &outstanding, &cropType)
			loans = append(loans, id)
			message.WriteString(fmt.Sprintf("\n%d. %s (N%.0f)", i, cropType, outstanding))
			i++
		}

		if len(loans) == 0 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "no_active_loans"),
				EndSession: true,
			}
		}

		session.Data["loans"] = loans
		session.Data["repay_step"] = 2
		message.WriteString("\n\n0. Back")
		
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    message.String(),
			EndSession: false,
		}
	case 2:
		// Loan selected
		idx, err := strconv.Atoi(input)
		loans := session.Data["loans"].([]string)
		if err != nil || idx < 1 || idx > len(loans) {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_option"),
				EndSession: false,
			}
		}
		
		session.Data["selected_loan"] = loans[idx-1]
		session.Data["repay_step"] = 3
		
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "enter_repay_amount"),
			EndSession: false,
		}
	case 3:
		// Amount entered
		amount, err := strconv.ParseFloat(input, 64)
		if err != nil || amount < 100 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "invalid_amount"),
				EndSession: false,
			}
		}
		
		loanID := session.Data["selected_loan"].(string)
		
		// Get current outstanding
		var outstanding float64
		h.db.QueryRowContext(ctx, 
			`SELECT outstanding_amount FROM agricultural_loans WHERE id = $1`,
			loanID).Scan(&outstanding)
		
		if amount > outstanding {
			amount = outstanding
		}
		
		newOutstanding := outstanding - amount
		status := "active"
		if newOutstanding <= 0 {
			status = "completed"
			newOutstanding = 0
		}
		
		// Update loan
		h.db.ExecContext(ctx, 
			`UPDATE agricultural_loans SET outstanding_amount = $1, status = $2 WHERE id = $3`,
			newOutstanding, status, loanID)
		
		// Record repayment
		h.db.ExecContext(ctx, `
			INSERT INTO agricultural_loan_repayments (id, tenant_id, loan_id, loan_type, amount, payment_method, paid_at)
			VALUES ($1, $2, $3, 'agricultural', $4, 'ussd', $5)
		`, fmt.Sprintf("REP%d", time.Now().UnixNano()), session.TenantID, loanID, amount, time.Now())
		
		session.CurrentMenu = "main"
		session.Data["repay_step"] = 0
		
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf(h.getText(session.Language, "repayment_success"), amount, newOutstanding),
			EndSession: true,
		}
	}

	return h.getMenuResponse(ctx, session)
}

func (h *USSDHandler) handleInsuranceMenu(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	switch input {
	case "":
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "insurance_menu"),
			EndSession: false,
		}
	case "1":
		// Get insurance quote
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "insurance_quote_info"),
			EndSession: false,
		}
	case "2":
		// Check insurance status
		var policyID, status string
		var coverage float64
		err := h.db.QueryRowContext(ctx, `
			SELECT id, coverage_amount, status FROM crop_insurance_policies 
			WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 1
		`, session.FarmerID).Scan(&policyID, &coverage, &status)
		
		if err != nil {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    h.getText(session.Language, "no_insurance"),
				EndSession: false,
			}
		}
		
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: fmt.Sprintf(h.getText(session.Language, "insurance_status"), policyID, coverage, status),
			EndSession: false,
		}
	case "3":
		// Report claim
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "claim_instructions"),
			EndSession: false,
		}
	default:
		session.CurrentMenu = "main"
		return h.getMenuResponse(ctx, session)
	}
}

func (h *USSDHandler) handlePrices(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	if input == "" {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "select_commodity"),
			EndSession: false,
		}
	}

	crops := map[string]string{
		"1": "rice", "2": "maize", "3": "cassava", "4": "yam",
		"5": "sorghum", "6": "groundnut", "7": "cowpea", "8": "tomato",
	}
	
	crop, exists := crops[input]
	if !exists {
		session.CurrentMenu = "main"
		return h.getMenuResponse(ctx, session)
	}

	if cropData, exists := CropDatabase[crop]; exists {
		session.CurrentMenu = "main"
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: fmt.Sprintf(h.getText(session.Language, "price_info"),
				cropData.LocalName, crop, cropData.MarketPrice),
			EndSession: false,
		}
	}

	return h.getMenuResponse(ctx, session)
}

func (h *USSDHandler) handleWeather(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	// Get farmer's state
	var state string
	h.db.QueryRowContext(ctx, `SELECT state FROM farmers WHERE id = $1`, session.FarmerID).Scan(&state)
	
	if state == "" {
		state = "Lagos"
	}

	// Get weather data (simulated - would integrate with NIMET in production)
	month := time.Now().Month()
	var rainfall, temperature float64
	var season, risk string
	
	if month >= 4 && month <= 10 {
		season = "Wet Season"
		rainfall = 150.0
		temperature = 27.0
		risk = "Low"
	} else {
		season = "Dry Season"
		rainfall = 20.0
		temperature = 33.0
		risk = "Medium"
	}

	session.CurrentMenu = "main"
	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(h.getText(session.Language, "weather_info"),
			state, season, rainfall, temperature, risk),
		EndSession: false,
	}
}

func (h *USSDHandler) handleCooperative(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	// Get farmer's cooperative
	var coopID string
	h.db.QueryRowContext(ctx, `SELECT cooperative_id FROM farmers WHERE id = $1`, session.FarmerID).Scan(&coopID)
	
	if coopID == "" {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message: h.getText(session.Language, "no_cooperative"),
			EndSession: false,
		}
	}

	var name string
	var memberCount int
	var creditLimit, outstanding float64
	h.db.QueryRowContext(ctx, `
		SELECT name, member_count, credit_limit, outstanding_loan 
		FROM cooperatives WHERE id = $1
	`, coopID).Scan(&name, &memberCount, &creditLimit, &outstanding)

	session.CurrentMenu = "main"
	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(h.getText(session.Language, "cooperative_info"),
			name, memberCount, creditLimit, outstanding),
		EndSession: false,
	}
}

func (h *USSDHandler) handleBalance(ctx context.Context, session *USSDSession, input string) *USSDResponse {
	if session.FarmerID == "" {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    h.getText(session.Language, "not_registered"),
			EndSession: true,
		}
	}

	// Get total loans and outstanding
	var totalLoans int
	var totalAmount, totalOutstanding float64
	h.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(loan_amount), 0), COALESCE(SUM(outstanding_amount), 0)
		FROM agricultural_loans WHERE farmer_id = $1
	`, session.FarmerID).Scan(&totalLoans, &totalAmount, &totalOutstanding)

	session.CurrentMenu = "main"
	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(h.getText(session.Language, "balance_info"),
			totalLoans, totalAmount, totalOutstanding),
		EndSession: false,
	}
}

// ==================== LOCALIZATION ====================

func (h *USSDHandler) getText(lang, key string) string {
	texts := map[string]map[string]string{
		"en": {
			"welcome_new": "Welcome to 54Bank Agri\n1. Register\n2. Check Loan Status\n3. Market Prices\n4. Weather\n5. Insurance\n6. Cooperative\n7. Balance\n\n99. Language",
			"welcome_back": "Welcome to 54Bank Agri\n1. Apply for Loan\n2. Loan Status\n3. Market Prices\n4. Weather\n5. Insurance\n6. Cooperative\n7. Balance\n\n99. Language",
			"language_set": "Language updated. Press any key to continue.",
			"register_name": "Enter your full name:",
			"register_bvn": "Enter your BVN (11 digits):",
			"register_state": "Enter your state:",
			"register_farm_size": "Enter farm size (hectares):",
			"register_crop": "Enter main crop:\n1.Rice 2.Maize 3.Cassava\n4.Yam 5.Sorghum 6.Groundnut",
			"invalid_bvn": "Invalid BVN. Enter 11 digits:",
			"invalid_number": "Invalid number. Try again:",
			"registration_success": "Registration successful!\nYour ID: %s\nVisit nearest agent for verification.",
			"registration_failed": "Registration failed. Try again later.",
			"loan_menu": "Loan Services\n1. Apply for Loan\n2. Check Status\n3. Make Repayment\n\n0. Back",
			"loan_select_crop": "Select crop:\n1.Rice 2.Maize 3.Cassava\n4.Yam 5.Sorghum 6.Groundnut\n7.Cowpea 8.Tomato\n\n0. Back",
			"loan_enter_amount": "Enter loan amount (N50,000 - N5,000,000):",
			"loan_confirm": "Loan Details:\nAmount: N%.0f\nCrop: %s\nRate: %.1f%%\nTenor: %d days\nTotal Repay: N%.0f\n\n1. Confirm\n2. Cancel",
			"loan_submitted": "Loan application submitted!\nRef: %s\nYou will receive SMS confirmation.",
			"loan_failed": "Loan application failed. Try again.",
			"loan_cancelled": "Loan application cancelled.",
			"loan_status_header": "Your Loans:",
			"no_loans": "\nNo loans found.",
			"select_loan_repay": "Select loan to repay:",
			"enter_repay_amount": "Enter amount to repay:",
			"repayment_success": "Payment of N%.0f received!\nNew balance: N%.0f",
			"no_active_loans": "No active loans to repay.",
			"insurance_menu": "Insurance\n1. Get Quote\n2. Check Status\n3. Report Claim\n\n0. Back",
			"insurance_quote_info": "Crop insurance protects against:\n- Drought\n- Flood\n- Pest damage\n\nPremium: 5-8% of loan\nCall 0800-54BANK for quote",
			"insurance_status": "Policy: %s\nCoverage: N%.0f\nStatus: %s",
			"no_insurance": "No active insurance policy.\nApply when taking a loan.",
			"claim_instructions": "To report a claim:\n1. Take photos of damage\n2. Call 0800-54BANK\n3. Agent will visit within 48hrs",
			"select_commodity": "Select commodity:\n1.Rice 2.Maize 3.Cassava\n4.Yam 5.Sorghum 6.Groundnut\n7.Cowpea 8.Tomato\n\n0. Back",
			"price_info": "%s (%s)\nPrice: N%.0f/tonne\n\nPrices updated daily.\n\n0. Back",
			"weather_info": "Weather for %s\nSeason: %s\nRainfall: %.0fmm\nTemp: %.0f°C\nFarming Risk: %s\n\n0. Back",
			"cooperative_info": "Cooperative: %s\nMembers: %d\nCredit Limit: N%.0f\nOutstanding: N%.0f\n\n0. Back",
			"no_cooperative": "You are not in a cooperative.\nJoin one for group loans.",
			"balance_info": "Account Summary\nTotal Loans: %d\nTotal Borrowed: N%.0f\nOutstanding: N%.0f\n\n0. Back",
			"not_registered": "Please register first.\nDial *347*54# to register.",
			"invalid_option": "Invalid option. Try again.",
			"invalid_crop": "Invalid crop. Select 1-8:",
			"invalid_amount": "Invalid amount. Enter N50,000 - N5,000,000:",
			"error_occurred": "An error occurred. Try again.",
		},
		"ha": {
			"welcome_new": "Barka da zuwa 54Bank Noma\n1. Yi Rajista\n2. Duba Lamuni\n3. Farashin Kasuwa\n4. Yanayi\n5. Inshora\n6. Kungiya\n7. Balance\n\n99. Harshe",
			"welcome_back": "Barka da zuwa 54Bank Noma\n1. Nemi Lamuni\n2. Duba Lamuni\n3. Farashin Kasuwa\n4. Yanayi\n5. Inshora\n6. Kungiya\n7. Balance\n\n99. Harshe",
			"loan_menu": "Lamuni\n1. Nemi Lamuni\n2. Duba Matsayi\n3. Biya Lamuni\n\n0. Koma",
			"registration_success": "An yi nasarar rajista!\nID: %s\nJe wakilin da ke kusa don tabbatarwa.",
		},
		"yo": {
			"welcome_new": "Kaabo si 54Bank Oko\n1. Forukosile\n2. Wo Awin\n3. Owo Oja\n4. Oju Ojo\n5. Iṣeduro\n6. Egbe\n7. Iye Owo\n\n99. Ede",
			"welcome_back": "Kaabo si 54Bank Oko\n1. Beere Awin\n2. Wo Awin\n3. Owo Oja\n4. Oju Ojo\n5. Iṣeduro\n6. Egbe\n7. Iye Owo\n\n99. Ede",
			"loan_menu": "Awin\n1. Beere Awin\n2. Wo Ipo\n3. San Awin\n\n0. Pada",
			"registration_success": "O ti forukosile!\nID: %s\nLo si aṣoju to sunmo fun ijẹrisi.",
		},
		"ig": {
			"welcome_new": "Nnọọ na 54Bank Ọrụ Ugbo\n1. Debanye Aha\n2. Lelee Ego\n3. Ọnụahịa\n4. Ihu Igwe\n5. Nchekwa\n6. Otu\n7. Ego\n\n99. Asụsụ",
			"welcome_back": "Nnọọ na 54Bank Ọrụ Ugbo\n1. Rịọ Ego\n2. Lelee Ego\n3. Ọnụahịa\n4. Ihu Igwe\n5. Nchekwa\n6. Otu\n7. Ego\n\n99. Asụsụ",
			"loan_menu": "Ego Ọgbọ\n1. Rịọ Ego\n2. Lelee Ọnọdụ\n3. Kwụọ Ego\n\n0. Laghachi",
			"registration_success": "Ị debanye aha!\nID: %s\nGaa onye nnọchi nso iji nyochaa.",
		},
	}

	if langTexts, exists := texts[lang]; exists {
		if text, exists := langTexts[key]; exists {
			return text
		}
	}

	// Fallback to English
	if text, exists := texts["en"][key]; exists {
		return text
	}

	return key
}

func (h *USSDHandler) getStatusText(lang, status string) string {
	statusTexts := map[string]map[string]string{
		"en": {
			"pending_approval": "Pending",
			"approved": "Approved",
			"disbursed": "Disbursed",
			"active": "Active",
			"completed": "Completed",
			"defaulted": "Defaulted",
		},
		"ha": {
			"pending_approval": "Ana jira",
			"approved": "An amince",
			"disbursed": "An biya",
			"active": "Yana aiki",
			"completed": "An gama",
			"defaulted": "Ya gaza",
		},
	}

	if langStatuses, exists := statusTexts[lang]; exists {
		if text, exists := langStatuses[status]; exists {
			return text
		}
	}

	if text, exists := statusTexts["en"][status]; exists {
		return text
	}

	return status
}
