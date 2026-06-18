package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// INCLUSIVE ACCESS - ENHANCED USSD/IVR FLOWS
// Multi-language support, simplified farmer journeys, offline-capable flows
// ============================================================================

// USSDMenu represents a USSD menu structure
type USSDMenu struct {
	ID          string       `json:"id"`
	Code        string       `json:"code"`
	Title       map[string]string `json:"title"` // Multi-language
	Options     []USSDOption `json:"options"`
	ParentMenu  string       `json:"parent_menu,omitempty"`
	RequiresAuth bool        `json:"requires_auth"`
}

// USSDOption represents a menu option
type USSDOption struct {
	Number      int               `json:"number"`
	Label       map[string]string `json:"label"` // Multi-language
	Action      string            `json:"action"` // navigate, api_call, input
	Target      string            `json:"target"` // menu_id or api_endpoint
	InputType   string            `json:"input_type,omitempty"` // amount, phone, text, pin
}

// InclusiveUSSDSession tracks user session state
type InclusiveUSSDSession struct {
	SessionID     string                 `json:"session_id"`
	MSISDN        string                 `json:"msisdn"`
	FarmerID      string                 `json:"farmer_id,omitempty"`
	Language      string                 `json:"language"`
	CurrentMenu   string                 `json:"current_menu"`
	MenuHistory   []string               `json:"menu_history"`
	InputData     map[string]interface{} `json:"input_data"`
	Authenticated bool                   `json:"authenticated"`
	StartedAt     time.Time              `json:"started_at"`
	LastActivityAt time.Time             `json:"last_activity_at"`
}

// InclusiveIVRFlow represents an IVR call flow
type InclusiveIVRFlow struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Language    string     `json:"language"`
	Prompts     []IVRPrompt `json:"prompts"`
	EntryPoint  string     `json:"entry_point"`
}

// IVRPrompt represents a voice prompt
type IVRPrompt struct {
	ID            string            `json:"id"`
	AudioFile     map[string]string `json:"audio_file"` // Language -> file path
	TextToSpeech  map[string]string `json:"text_to_speech"` // Fallback TTS
	ExpectedInput string            `json:"expected_input"` // dtmf, speech, none
	ValidInputs   []string          `json:"valid_inputs,omitempty"`
	NextPrompt    map[string]string `json:"next_prompt"` // Input -> next prompt ID
	Timeout       int               `json:"timeout_seconds"`
	MaxRetries    int               `json:"max_retries"`
}

// FarmerUSSDProfile simplified farmer view for USSD
type FarmerUSSDProfile struct {
	FarmerID        string  `json:"farmer_id"`
	Name            string  `json:"name"`
	Phone           string  `json:"phone"`
	Language        string  `json:"language"`
	CreditLimit     float64 `json:"credit_limit"`
	CurrentBalance  float64 `json:"current_balance"`
	NextPaymentDate string  `json:"next_payment_date"`
	NextPaymentAmount float64 `json:"next_payment_amount"`
	RepaymentStreak int     `json:"repayment_streak"`
	ActiveLoans     int     `json:"active_loans"`
	ActiveVouchers  int     `json:"active_vouchers"`
}

// SeasonPlan simplified seasonal plan for farmer
type SeasonPlan struct {
	Season          string  `json:"season"`
	CropType        string  `json:"crop_type"`
	PlantingDate    string  `json:"planting_date"`
	ExpectedHarvest string  `json:"expected_harvest"`
	LoanAmount      float64 `json:"loan_amount"`
	InputsReceived  bool    `json:"inputs_received"`
	ExpectedYield   float64 `json:"expected_yield_tonnes"`
	ExpectedIncome  float64 `json:"expected_income"`
}

// SimplifiedLoanStatus for USSD display
type SimplifiedLoanStatus struct {
	LoanID          string  `json:"loan_id"`
	Status          string  `json:"status"` // active, pending, completed
	Principal       float64 `json:"principal"`
	Outstanding     float64 `json:"outstanding"`
	NextPayment     float64 `json:"next_payment"`
	NextPaymentDate string  `json:"next_payment_date"`
	DaysUntilDue    int     `json:"days_until_due"`
}

// PriceAdvisory market price information
type PriceAdvisory struct {
	CommodityType   string    `json:"commodity_type"`
	Region          string    `json:"region"`
	CurrentPrice    float64   `json:"current_price"`
	PriceChange     float64   `json:"price_change_percent"`
	Trend           string    `json:"trend"` // up, down, stable
	Recommendation  string    `json:"recommendation"`
	BestMarkets     []string  `json:"best_markets"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// PlantingAdvisory agricultural advice
type PlantingAdvisory struct {
	Region          string   `json:"region"`
	Season          string   `json:"season"`
	RecommendedCrops []string `json:"recommended_crops"`
	PlantingWindow  string   `json:"planting_window"`
	WeatherOutlook  string   `json:"weather_outlook"`
	InputsNeeded    []string `json:"inputs_needed"`
	Tips            []string `json:"tips"`
}

// Supported languages
var supportedLanguages = map[string]string{
	"en": "English",
	"ha": "Hausa",
	"yo": "Yoruba",
	"ig": "Igbo",
	"ff": "Fulfulde",
	"pcm": "Pidgin",
}

// USSD Menu definitions
var agricultureUSSDMenus = map[string]USSDMenu{
	"main": {
		ID:   "main",
		Code: "*347*4#",
		Title: map[string]string{
			"en": "54Bank Agriculture",
			"ha": "54Bank Noma",
			"yo": "54Bank Ogbin",
			"ig": "54Bank Oru Ugbo",
		},
		Options: []USSDOption{
			{Number: 1, Label: map[string]string{"en": "Check Balance", "ha": "Duba Kudi", "yo": "Wo Owo", "ig": "Lee Ego"}, Action: "navigate", Target: "balance"},
			{Number: 2, Label: map[string]string{"en": "Loan Status", "ha": "Yanayin Bashi", "yo": "Ipo Awin", "ig": "Onodu Ego Obinye"}, Action: "navigate", Target: "loan_status"},
			{Number: 3, Label: map[string]string{"en": "Redeem Voucher", "ha": "Amfani da Voucher", "yo": "Lo Voucher", "ig": "Jiri Voucher"}, Action: "navigate", Target: "voucher"},
			{Number: 4, Label: map[string]string{"en": "Price Advisory", "ha": "Shawarar Farashi", "yo": "Imoran Owo", "ig": "Ndumodu Onu Ahia"}, Action: "navigate", Target: "prices"},
			{Number: 5, Label: map[string]string{"en": "Planting Tips", "ha": "Shawarar Shuka", "yo": "Imoran Gbingbin", "ig": "Ndumodu Iku Ihe"}, Action: "navigate", Target: "planting"},
			{Number: 6, Label: map[string]string{"en": "Make Payment", "ha": "Yi Biya", "yo": "San Owo", "ig": "Kwuo Ego"}, Action: "navigate", Target: "payment"},
			{Number: 7, Label: map[string]string{"en": "My Season Plan", "ha": "Shirin Damina", "yo": "Eto Akoko", "ig": "Atumatu Oge"}, Action: "navigate", Target: "season_plan"},
			{Number: 8, Label: map[string]string{"en": "Help/Support", "ha": "Taimako", "yo": "Iranlowo", "ig": "Enyemaka"}, Action: "navigate", Target: "help"},
			{Number: 0, Label: map[string]string{"en": "Change Language", "ha": "Canja Harshe", "yo": "Yi Ede Pada", "ig": "Gbanwee Asusu"}, Action: "navigate", Target: "language"},
		},
		RequiresAuth: true,
	},
	"balance": {
		ID:   "balance",
		Code: "*347*4*1#",
		Title: map[string]string{
			"en": "Your Balance",
			"ha": "Kudin Ka",
			"yo": "Owo Re",
			"ig": "Ego Gi",
		},
		Options: []USSDOption{
			{Number: 1, Label: map[string]string{"en": "Credit Limit", "ha": "Iyakar Bashi"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/credit-limit"},
			{Number: 2, Label: map[string]string{"en": "Outstanding Loan", "ha": "Bashin da ake bi"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/outstanding"},
			{Number: 0, Label: map[string]string{"en": "Back", "ha": "Koma"}, Action: "navigate", Target: "main"},
		},
		ParentMenu: "main",
		RequiresAuth: true,
	},
	"voucher": {
		ID:   "voucher",
		Code: "*347*4*3#",
		Title: map[string]string{
			"en": "Redeem Input Voucher",
			"ha": "Amfani da Voucher",
		},
		Options: []USSDOption{
			{Number: 1, Label: map[string]string{"en": "Enter Voucher Code"}, Action: "input", Target: "voucher_code", InputType: "text"},
			{Number: 2, Label: map[string]string{"en": "Check Voucher Balance"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/voucher-balance"},
			{Number: 0, Label: map[string]string{"en": "Back"}, Action: "navigate", Target: "main"},
		},
		ParentMenu: "main",
		RequiresAuth: true,
	},
	"language": {
		ID:   "language",
		Code: "*347*4*0#",
		Title: map[string]string{
			"en": "Select Language",
			"ha": "Zabi Harshe",
			"yo": "Yan Ede",
			"ig": "Họrọ Asụsụ",
		},
		Options: []USSDOption{
			{Number: 1, Label: map[string]string{"en": "English"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/set-language?lang=en"},
			{Number: 2, Label: map[string]string{"en": "Hausa"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/set-language?lang=ha"},
			{Number: 3, Label: map[string]string{"en": "Yoruba"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/set-language?lang=yo"},
			{Number: 4, Label: map[string]string{"en": "Igbo"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/set-language?lang=ig"},
			{Number: 5, Label: map[string]string{"en": "Pidgin"}, Action: "api_call", Target: "/api/v1/agriculture/ussd/set-language?lang=pcm"},
		},
		RequiresAuth: false,
	},
}

// HTTP Handlers for Inclusive Access

func handleUSSDRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		SessionID string `json:"session_id"`
		MSISDN    string `json:"msisdn"`
		Input     string `json:"input"`
		MenuID    string `json:"menu_id,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Get or create session
	language := "en" // Default, would be retrieved from session
	menuID := request.MenuID
	if menuID == "" {
		menuID = "main"
	}
	
	menu, exists := agricultureUSSDMenus[menuID]
	if !exists {
		menu = agricultureUSSDMenus["main"]
	}
	
	// Build response
	response := menu.Title[language] + "\n"
	for _, opt := range menu.Options {
		label := opt.Label[language]
		if label == "" {
			label = opt.Label["en"]
		}
		response += fmt.Sprintf("%d. %s\n", opt.Number, label)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id": request.SessionID,
		"response":   response,
		"menu_id":    menuID,
		"end_session": false,
	})
}

func handleUSSDFarmerProfile(w http.ResponseWriter, r *http.Request) {
	msisdn := r.URL.Query().Get("msisdn")
	language := r.URL.Query().Get("lang")
	if language == "" {
		language = "en"
	}
	
	// Mock farmer profile - in production, this would query the database
	profile := FarmerUSSDProfile{
		FarmerID:        "FRM-12345",
		Name:            "Adamu Ibrahim",
		Phone:           msisdn,
		Language:        language,
		CreditLimit:     500000,
		CurrentBalance:  150000,
		NextPaymentDate: "2025-02-15",
		NextPaymentAmount: 25000,
		RepaymentStreak: 5,
		ActiveLoans:     1,
		ActiveVouchers:  2,
	}
	
	// Format for USSD display
	var ussdText string
	switch language {
	case "ha":
		ussdText = fmt.Sprintf("Sannu %s!\nIyakar Bashi: N%.0f\nBashin da ake bi: N%.0f\nBiya na gaba: N%.0f (%s)\nJerin Biya: %d",
			profile.Name, profile.CreditLimit, profile.CurrentBalance, profile.NextPaymentAmount, profile.NextPaymentDate, profile.RepaymentStreak)
	case "yo":
		ussdText = fmt.Sprintf("Kaabo %s!\nOpin Awin: N%.0f\nAwin to ku: N%.0f\nIsanwo to n bo: N%.0f (%s)\nAtele Isanwo: %d",
			profile.Name, profile.CreditLimit, profile.CurrentBalance, profile.NextPaymentAmount, profile.NextPaymentDate, profile.RepaymentStreak)
	default:
		ussdText = fmt.Sprintf("Welcome %s!\nCredit Limit: N%.0f\nOutstanding: N%.0f\nNext Payment: N%.0f (%s)\nRepayment Streak: %d seasons",
			profile.Name, profile.CreditLimit, profile.CurrentBalance, profile.NextPaymentAmount, profile.NextPaymentDate, profile.RepaymentStreak)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"profile":   profile,
		"ussd_text": ussdText,
	})
}

func handleUSSDLoanStatus(w http.ResponseWriter, r *http.Request) {
	msisdn := r.URL.Query().Get("msisdn")
	language := r.URL.Query().Get("lang")
	if language == "" {
		language = "en"
	}
	
	// Mock loan status
	loan := SimplifiedLoanStatus{
		LoanID:          "LN-2024-001",
		Status:          "active",
		Principal:       200000,
		Outstanding:     150000,
		NextPayment:     25000,
		NextPaymentDate: "2025-02-15",
		DaysUntilDue:    45,
	}
	
	var ussdText string
	switch language {
	case "ha":
		ussdText = fmt.Sprintf("Yanayin Bashi\nAdadin: N%.0f\nSauran: N%.0f\nBiya na gaba: N%.0f\nRanar: %s\nKwanaki %d",
			loan.Principal, loan.Outstanding, loan.NextPayment, loan.NextPaymentDate, loan.DaysUntilDue)
	default:
		ussdText = fmt.Sprintf("Loan Status\nPrincipal: N%.0f\nOutstanding: N%.0f\nNext Payment: N%.0f\nDue: %s\n%d days left",
			loan.Principal, loan.Outstanding, loan.NextPayment, loan.NextPaymentDate, loan.DaysUntilDue)
	}
	
	_ = msisdn // Would be used to look up farmer
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan":      loan,
		"ussd_text": ussdText,
	})
}

func handleUSSDPriceAdvisory(w http.ResponseWriter, r *http.Request) {
	commodity := r.URL.Query().Get("commodity")
	region := r.URL.Query().Get("region")
	language := r.URL.Query().Get("lang")
	
	if commodity == "" {
		commodity = "maize"
	}
	if region == "" {
		region = "north"
	}
	if language == "" {
		language = "en"
	}
	
	// Mock price advisory
	advisory := PriceAdvisory{
		CommodityType:  commodity,
		Region:         region,
		CurrentPrice:   185000, // per tonne
		PriceChange:    5.2,
		Trend:          "up",
		Recommendation: "Good time to sell. Prices are above average.",
		BestMarkets:    []string{"Dawanau Market, Kano", "Bodija Market, Ibadan"},
		UpdatedAt:      time.Now(),
	}
	
	var ussdText string
	switch language {
	case "ha":
		ussdText = fmt.Sprintf("Farashin %s\nFarashi: N%.0f/ton\nCanji: +%.1f%%\nShawara: Lokaci mai kyau don sayarwa",
			commodity, advisory.CurrentPrice, advisory.PriceChange)
	default:
		ussdText = fmt.Sprintf("%s Price\nCurrent: N%.0f/tonne\nChange: +%.1f%%\nAdvice: %s",
			commodity, advisory.CurrentPrice, advisory.PriceChange, advisory.Recommendation)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"advisory":  advisory,
		"ussd_text": ussdText,
	})
}

func handleUSSDPlantingAdvisory(w http.ResponseWriter, r *http.Request) {
	region := r.URL.Query().Get("region")
	language := r.URL.Query().Get("lang")
	
	if region == "" {
		region = "north"
	}
	if language == "" {
		language = "en"
	}
	
	// Mock planting advisory
	advisory := PlantingAdvisory{
		Region:          region,
		Season:          "2025-wet",
		RecommendedCrops: []string{"Maize", "Rice", "Sorghum"},
		PlantingWindow:  "May 15 - June 30",
		WeatherOutlook:  "Normal to above-normal rainfall expected",
		InputsNeeded:    []string{"NPK fertilizer", "Improved seeds", "Herbicides"},
		Tips: []string{
			"Plant early to maximize rainfall",
			"Use certified seeds for better yields",
			"Apply fertilizer 3 weeks after planting",
		},
	}
	
	var ussdText string
	switch language {
	case "ha":
		ussdText = fmt.Sprintf("Shawarar Shuka\nDamina: %s\nAmfanin gona: %s\nLokacin shuka: %s\nYanayi: %s",
			advisory.Season, "Masara, Shinkafa, Dawa", advisory.PlantingWindow, "Ruwan sama mai kyau")
	default:
		ussdText = fmt.Sprintf("Planting Advisory\nSeason: %s\nCrops: %s\nPlanting: %s\nOutlook: %s",
			advisory.Season, "Maize, Rice, Sorghum", advisory.PlantingWindow, advisory.WeatherOutlook)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"advisory":  advisory,
		"ussd_text": ussdText,
	})
}

func handleUSSDSeasonPlan(w http.ResponseWriter, r *http.Request) {
	msisdn := r.URL.Query().Get("msisdn")
	language := r.URL.Query().Get("lang")
	
	if language == "" {
		language = "en"
	}
	
	// Mock season plan
	plan := SeasonPlan{
		Season:          "2025-wet",
		CropType:        "Maize",
		PlantingDate:    "2025-05-20",
		ExpectedHarvest: "2025-09-15",
		LoanAmount:      200000,
		InputsReceived:  true,
		ExpectedYield:   4.5,
		ExpectedIncome:  450000,
	}
	
	var ussdText string
	switch language {
	case "ha":
		ussdText = fmt.Sprintf("Shirin Damina\nAmfanin gona: %s\nRanar shuka: %s\nGirbi: %s\nBashi: N%.0f\nTsammanin kudin shiga: N%.0f",
			plan.CropType, plan.PlantingDate, plan.ExpectedHarvest, plan.LoanAmount, plan.ExpectedIncome)
	default:
		ussdText = fmt.Sprintf("Season Plan\nCrop: %s\nPlanting: %s\nHarvest: %s\nLoan: N%.0f\nExpected Income: N%.0f",
			plan.CropType, plan.PlantingDate, plan.ExpectedHarvest, plan.LoanAmount, plan.ExpectedIncome)
	}
	
	_ = msisdn // Would be used to look up farmer
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"plan":      plan,
		"ussd_text": ussdText,
	})
}

func handleUSSDVoucherRedeem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		MSISDN      string  `json:"msisdn"`
		VoucherCode string  `json:"voucher_code"`
		MerchantID  string  `json:"merchant_id"`
		Amount      float64 `json:"amount"`
		Language    string  `json:"language"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	if request.Language == "" {
		request.Language = "en"
	}
	
	// Mock redemption
	remainingBalance := 50000.0 // Would be calculated
	
	var ussdText string
	switch request.Language {
	case "ha":
		ussdText = fmt.Sprintf("An karbi Voucher!\nAdadi: N%.0f\nSauran: N%.0f\nGodiya da amfani da 54Bank",
			request.Amount, remainingBalance)
	default:
		ussdText = fmt.Sprintf("Voucher Redeemed!\nAmount: N%.0f\nRemaining: N%.0f\nThank you for using 54Bank",
			request.Amount, remainingBalance)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":           true,
		"amount_redeemed":   request.Amount,
		"remaining_balance": remainingBalance,
		"ussd_text":         ussdText,
		"reference":         fmt.Sprintf("VCH%d", time.Now().UnixNano()%1000000),
	})
}

func handleUSSDMakePayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		MSISDN   string  `json:"msisdn"`
		LoanID   string  `json:"loan_id"`
		Amount   float64 `json:"amount"`
		PIN      string  `json:"pin"`
		Language string  `json:"language"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	if request.Language == "" {
		request.Language = "en"
	}
	
	// Mock payment processing
	newOutstanding := 125000.0 // Would be calculated
	
	var ussdText string
	switch request.Language {
	case "ha":
		ussdText = fmt.Sprintf("An karbi biya!\nAdadi: N%.0f\nSauran bashi: N%.0f\nGodiya!",
			request.Amount, newOutstanding)
	default:
		ussdText = fmt.Sprintf("Payment Received!\nAmount: N%.0f\nNew Outstanding: N%.0f\nThank you!",
			request.Amount, newOutstanding)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"amount_paid":     request.Amount,
		"new_outstanding": newOutstanding,
		"ussd_text":       ussdText,
		"reference":       fmt.Sprintf("PAY%d", time.Now().UnixNano()%1000000),
	})
}

func handleIVRFlow(w http.ResponseWriter, r *http.Request) {
	language := r.URL.Query().Get("lang")
	if language == "" {
		language = "en"
	}
	
	// Return IVR flow definition
	flow := InclusiveIVRFlow{
		ID:       "agri-main",
		Name:     "Agriculture Banking IVR",
		Language: language,
		Prompts: []IVRPrompt{
			{
				ID: "welcome",
				TextToSpeech: map[string]string{
					"en": "Welcome to 54Bank Agriculture Banking. Press 1 for loan status, 2 for price advisory, 3 for planting tips, 4 to speak to an agent.",
					"ha": "Barka da zuwa 54Bank Noma. Danna 1 don yanayin bashi, 2 don farashin kaya, 3 don shawarar shuka, 4 don magana da wakili.",
					"yo": "Kaabo si 54Bank Ogbin. Te 1 fun ipo awin, 2 fun owo oja, 3 fun imoran gbingbin, 4 lati ba alagbawi soro.",
					"ig": "Nnoo na 54Bank Oru Ugbo. Pịa 1 maka ọnọdụ ego obinye, 2 maka ọnụ ahịa, 3 maka ndụmọdụ ịkụ ihe, 4 ịkparịta ụka na onye nnọchiteanya.",
				},
				ExpectedInput: "dtmf",
				ValidInputs:   []string{"1", "2", "3", "4"},
				NextPrompt: map[string]string{
					"1": "loan_status",
					"2": "price_advisory",
					"3": "planting_tips",
					"4": "agent_transfer",
				},
				Timeout:    10,
				MaxRetries: 3,
			},
			{
				ID: "loan_status",
				TextToSpeech: map[string]string{
					"en": "Your current loan balance is {outstanding} naira. Your next payment of {next_payment} naira is due on {due_date}. Press 1 to make a payment, 0 to go back.",
					"ha": "Bashin ku yanzu shine {outstanding} naira. Biyan ku na gaba na {next_payment} naira zai kasance a {due_date}. Danna 1 don yin biya, 0 don komawa.",
				},
				ExpectedInput: "dtmf",
				ValidInputs:   []string{"1", "0"},
				NextPrompt: map[string]string{
					"1": "make_payment",
					"0": "welcome",
				},
				Timeout:    10,
				MaxRetries: 3,
			},
		},
		EntryPoint: "welcome",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"flow":                flow,
		"supported_languages": supportedLanguages,
	})
}

func handleSetLanguage(w http.ResponseWriter, r *http.Request) {
	msisdn := r.URL.Query().Get("msisdn")
	language := r.URL.Query().Get("lang")
	
	if language == "" {
		http.Error(w, "lang parameter is required", http.StatusBadRequest)
		return
	}
	
	langName, exists := supportedLanguages[language]
	if !exists {
		http.Error(w, "Unsupported language", http.StatusBadRequest)
		return
	}
	
	// In production, this would update the farmer's language preference
	_ = msisdn
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"language": language,
		"message":  fmt.Sprintf("Language set to %s", langName),
	})
}

func handleGetSupportedLanguages(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"languages": supportedLanguages,
		"default":   "en",
	})
}

// RegisterInclusiveAccessRoutes registers all inclusive access routes
func RegisterInclusiveAccessRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/ussd/request", handleUSSDRequest).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/ussd/profile", handleUSSDFarmerProfile).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/ussd/loan-status", handleUSSDLoanStatus).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/ussd/prices", handleUSSDPriceAdvisory).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/ussd/planting", handleUSSDPlantingAdvisory).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/ussd/season-plan", handleUSSDSeasonPlan).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/ussd/voucher-redeem", handleUSSDVoucherRedeem).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/ussd/payment", handleUSSDMakePayment).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/ivr/flow", handleIVRFlow).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/ussd/set-language", handleSetLanguage).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/languages", handleGetSupportedLanguages).Methods("GET")
}
