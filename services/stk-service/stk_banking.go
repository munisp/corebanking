package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// STK (SIM Toolkit) Banking Service
// Provides banking services for basic/feature phones without USSD capability
// Works by sending menu commands directly to the SIM card

// Prometheus metrics
var (
	stkSessionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "stk_sessions_total",
			Help: "Total STK sessions",
		},
		[]string{"action", "status"},
	)

	stkTransactionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "stk_transactions_total",
			Help: "Total STK transactions",
		},
		[]string{"type", "status"},
	)
)

// STKMenuID represents menu identifiers
type STKMenuID string

const (
	MenuMain      STKMenuID = "MAIN"
	MenuBalance   STKMenuID = "BAL"
	MenuTransfer  STKMenuID = "TRF"
	MenuAirtime   STKMenuID = "AIR"
	MenuBills     STKMenuID = "BILL"
	MenuAgent     STKMenuID = "AGENT"
	MenuStatement STKMenuID = "STMT"
	MenuSettings  STKMenuID = "SET"
	MenuHelp      STKMenuID = "HELP"
)

// STKCommand represents an STK command from the SIM
type STKCommand struct {
	CommandID   string            `json:"command_id"`
	IMSI        string            `json:"imsi"`   // SIM identifier
	MSISDN      string            `json:"msisdn"` // Phone number
	MenuID      STKMenuID         `json:"menu_id"`
	Selection   string            `json:"selection"`
	InputData   string            `json:"input_data"`
	SessionData map[string]string `json:"session_data"`
	Timestamp   time.Time         `json:"timestamp"`
}

// STKResponse represents response to send to SIM
type STKResponse struct {
	ResponseType string            `json:"response_type"` // MENU, INPUT, DISPLAY, END
	Title        string            `json:"title"`
	Items        []STKItem         `json:"items,omitempty"`
	InputPrompt  string            `json:"input_prompt,omitempty"`
	InputType    string            `json:"input_type,omitempty"` // TEXT, PIN, PHONE, AMOUNT
	DisplayText  string            `json:"display_text,omitempty"`
	SessionData  map[string]string `json:"session_data"`
}

// STKItem represents a menu item
type STKItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// STKSession represents an active STK session
type STKSession struct {
	SessionID   string            `json:"session_id"`
	IMSI        string            `json:"imsi"`
	MSISDN      string            `json:"msisdn"`
	CurrentMenu STKMenuID         `json:"current_menu"`
	Data        map[string]string `json:"data"`
	CreatedAt   time.Time         `json:"created_at"`
	LastAccess  time.Time         `json:"last_access"`
}

// STKBankingService handles STK-based banking for feature phones
type STKBankingService struct {
	db             *pgxpool.Pool
	sessions       map[string]*STKSession
	mutex          sync.RWMutex
	sessionTimeout time.Duration
	smsProvider    SMSProvider
	pinSecret      string
}

// SMSProvider interface for sending SMS
type SMSProvider interface {
	SendSMS(ctx context.Context, phone string, message string) error
}

// NewSTKBankingService creates a new STK banking service
func NewSTKBankingService(db *pgxpool.Pool, smsProvider SMSProvider, pinSecret string) *STKBankingService {
	service := &STKBankingService{
		db:             db,
		sessions:       make(map[string]*STKSession),
		sessionTimeout: 5 * time.Minute,
		smsProvider:    smsProvider,
		pinSecret:      pinSecret,
	}

	go service.cleanupExpiredSessions()

	return service
}

// ProcessSTKCommand processes incoming STK commands
func (s *STKBankingService) ProcessSTKCommand(ctx context.Context, cmd *STKCommand) (*STKResponse, error) {
	s.mutex.Lock()
	session, exists := s.sessions[cmd.IMSI]
	if !exists {
		session = &STKSession{
			SessionID:   fmt.Sprintf("STK-%d-%s", time.Now().UnixNano(), cmd.IMSI),
			IMSI:        cmd.IMSI,
			MSISDN:      cmd.MSISDN,
			CurrentMenu: MenuMain,
			Data:        make(map[string]string),
			CreatedAt:   time.Now(),
			LastAccess:  time.Now(),
		}
		s.sessions[cmd.IMSI] = session
		stkSessionsTotal.WithLabelValues("new", "created").Inc()
	}
	session.LastAccess = time.Now()

	// Merge session data from command
	if cmd.SessionData != nil {
		for k, v := range cmd.SessionData {
			session.Data[k] = v
		}
	}
	s.mutex.Unlock()

	var response *STKResponse
	var err error

	switch cmd.MenuID {
	case MenuMain:
		response = s.showMainMenu()
	case MenuBalance:
		response, err = s.handleBalance(ctx, session, cmd)
	case MenuTransfer:
		response, err = s.handleTransfer(ctx, session, cmd)
	case MenuAirtime:
		response, err = s.handleAirtime(ctx, session, cmd)
	case MenuBills:
		response, err = s.handleBills(ctx, session, cmd)
	case MenuAgent:
		response, err = s.handleAgent(ctx, session, cmd)
	case MenuStatement:
		response, err = s.handleStatement(ctx, session, cmd)
	case MenuSettings:
		response, err = s.handleSettings(ctx, session, cmd)
	case MenuHelp:
		response = s.showHelp()
	default:
		response = s.showMainMenu()
	}

	if err != nil {
		stkSessionsTotal.WithLabelValues("error", "failed").Inc()
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Error occurred. Please try again.",
			SessionData:  session.Data,
		}, nil
	}

	response.SessionData = session.Data
	return response, nil
}

// showMainMenu returns the main STK menu
func (s *STKBankingService) showMainMenu() *STKResponse {
	return &STKResponse{
		ResponseType: "MENU",
		Title:        "54Bank",
		Items: []STKItem{
			{ID: string(MenuBalance), Label: "Check Balance"},
			{ID: string(MenuTransfer), Label: "Transfer Money"},
			{ID: string(MenuAirtime), Label: "Buy Airtime"},
			{ID: string(MenuBills), Label: "Pay Bills"},
			{ID: string(MenuAgent), Label: "Agent Banking"},
			{ID: string(MenuStatement), Label: "Mini Statement"},
			{ID: string(MenuSettings), Label: "Settings"},
			{ID: string(MenuHelp), Label: "Help"},
		},
	}
}

// handleBalance processes balance inquiry
func (s *STKBankingService) handleBalance(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	// Step 1: Request PIN
	if session.Data["balance_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Check Balance",
				InputPrompt:  "Enter PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["balance_pin"] = cmd.InputData
	}

	// Verify PIN
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["balance_pin"]) {
		delete(session.Data, "balance_pin")
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	// Get balance
	var balance float64
	var accountNumber string
	err := s.db.QueryRow(ctx, `
		SELECT a.account_number, a.balance
		FROM accounts a
		JOIN customers c ON a.customer_id = c.customer_id
		WHERE c.phone = $1 AND a.is_primary = true
	`, session.MSISDN).Scan(&accountNumber, &balance)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Account not found",
		}, nil
	}

	// Clear session data
	delete(session.Data, "balance_pin")

	stkTransactionsTotal.WithLabelValues("balance", "success").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  fmt.Sprintf("Acct: %s\nBalance: N%.2f", accountNumber, balance),
	}, nil
}

// handleTransfer processes money transfer
func (s *STKBankingService) handleTransfer(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	// Step 1: Select transfer type
	if session.Data["transfer_type"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Transfer To",
				Items: []STKItem{
					{ID: "54bank", Label: "54Bank Account"},
					{ID: "other", Label: "Other Bank"},
					{ID: "phone", Label: "Phone Number"},
				},
			}, nil
		}
		session.Data["transfer_type"] = cmd.Selection
	}

	// Step 2: Enter recipient
	if session.Data["recipient"] == "" {
		if cmd.InputData == "" {
			prompt := "Enter Account Number"
			inputType := "TEXT"
			if session.Data["transfer_type"] == "phone" {
				prompt = "Enter Phone Number"
				inputType = "PHONE"
			}
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Transfer",
				InputPrompt:  prompt,
				InputType:    inputType,
			}, nil
		}
		session.Data["recipient"] = cmd.InputData

		// Validate recipient for 54bank
		if session.Data["transfer_type"] == "54bank" {
			var name string
			err := s.db.QueryRow(ctx, `
				SELECT CONCAT(first_name, ' ', last_name)
				FROM accounts a JOIN customers c ON a.customer_id = c.customer_id
				WHERE a.account_number = $1
			`, cmd.InputData).Scan(&name)
			if err != nil {
				delete(session.Data, "recipient")
				return &STKResponse{
					ResponseType: "DISPLAY",
					DisplayText:  "Account not found",
				}, nil
			}
			session.Data["recipient_name"] = name
		}
	}

	// Step 3: Enter amount
	if session.Data["amount"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Transfer",
				InputPrompt:  "Enter Amount (NGN)",
				InputType:    "AMOUNT",
			}, nil
		}
		amount, err := strconv.ParseFloat(cmd.InputData, 64)
		if err != nil || amount <= 0 {
			return &STKResponse{
				ResponseType: "DISPLAY",
				DisplayText:  "Invalid amount",
			}, nil
		}
		session.Data["amount"] = cmd.InputData
	}

	// Step 4: Enter PIN
	if session.Data["pin"] == "" {
		if cmd.InputData == "" {
			recipientDisplay := session.Data["recipient"]
			if session.Data["recipient_name"] != "" {
				recipientDisplay = session.Data["recipient_name"]
			}
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        fmt.Sprintf("N%s to %s", session.Data["amount"], recipientDisplay),
				InputPrompt:  "Enter PIN to confirm",
				InputType:    "PIN",
			}, nil
		}
		session.Data["pin"] = cmd.InputData
	}

	// Verify PIN and execute transfer
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["pin"]) {
		s.clearTransferData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	amount, _ := strconv.ParseFloat(session.Data["amount"], 64)
	recipient := session.Data["recipient"]

	// Execute transfer
	result, err := s.executeTransfer(ctx, session.MSISDN, recipient, amount, session.Data["transfer_type"])
	s.clearTransferData(session)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  err.Error(),
		}, nil
	}

	stkTransactionsTotal.WithLabelValues("transfer", "success").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  result,
	}, nil
}

// handleAirtime processes airtime purchase
func (s *STKBankingService) handleAirtime(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	// Step 1: Select self or others
	if session.Data["airtime_type"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Buy Airtime",
				Items: []STKItem{
					{ID: "self", Label: "For Myself"},
					{ID: "others", Label: "For Others"},
				},
			}, nil
		}
		session.Data["airtime_type"] = cmd.Selection
		if cmd.Selection == "self" {
			session.Data["airtime_phone"] = session.MSISDN
		}
	}

	// Step 2: Enter phone (if others)
	if session.Data["airtime_phone"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Buy Airtime",
				InputPrompt:  "Enter Phone Number",
				InputType:    "PHONE",
			}, nil
		}
		session.Data["airtime_phone"] = cmd.InputData
	}

	// Step 3: Select amount
	if session.Data["airtime_amount"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Select Amount",
				Items: []STKItem{
					{ID: "100", Label: "N100"},
					{ID: "200", Label: "N200"},
					{ID: "500", Label: "N500"},
					{ID: "1000", Label: "N1,000"},
					{ID: "2000", Label: "N2,000"},
					{ID: "5000", Label: "N5,000"},
					{ID: "other", Label: "Other Amount"},
				},
			}, nil
		}
		if cmd.Selection == "other" {
			session.Data["airtime_custom"] = "true"
		} else {
			session.Data["airtime_amount"] = cmd.Selection
		}
	}

	// Step 3b: Custom amount
	if session.Data["airtime_custom"] == "true" && session.Data["airtime_amount"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Buy Airtime",
				InputPrompt:  "Enter Amount (N50-N50,000)",
				InputType:    "AMOUNT",
			}, nil
		}
		session.Data["airtime_amount"] = cmd.InputData
	}

	// Step 4: Enter PIN
	if session.Data["airtime_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        fmt.Sprintf("N%s for %s", session.Data["airtime_amount"], session.Data["airtime_phone"]),
				InputPrompt:  "Enter PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["airtime_pin"] = cmd.InputData
	}

	// Verify and execute
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["airtime_pin"]) {
		s.clearAirtimeData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	amount, _ := strconv.ParseFloat(session.Data["airtime_amount"], 64)
	phone := session.Data["airtime_phone"]

	result, err := s.executeAirtime(ctx, session.MSISDN, phone, amount)
	s.clearAirtimeData(session)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  err.Error(),
		}, nil
	}

	stkTransactionsTotal.WithLabelValues("airtime", "success").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  result,
	}, nil
}

// handleBills processes bill payments
func (s *STKBankingService) handleBills(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	// Step 1: Select biller category
	if session.Data["bill_category"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Pay Bills",
				Items: []STKItem{
					{ID: "electricity", Label: "Electricity"},
					{ID: "cable", Label: "Cable TV"},
					{ID: "internet", Label: "Internet"},
					{ID: "water", Label: "Water"},
				},
			}, nil
		}
		session.Data["bill_category"] = cmd.Selection
	}

	// Step 2: Select provider
	if session.Data["bill_provider"] == "" {
		if cmd.Selection == "" {
			var items []STKItem
			switch session.Data["bill_category"] {
			case "electricity":
				items = []STKItem{
					{ID: "IKEDC", Label: "IKEDC"},
					{ID: "EKEDC", Label: "EKEDC"},
					{ID: "AEDC", Label: "AEDC"},
				}
			case "cable":
				items = []STKItem{
					{ID: "DSTV", Label: "DSTV"},
					{ID: "GOTV", Label: "GOtv"},
					{ID: "STARTIMES", Label: "StarTimes"},
				}
			default:
				items = []STKItem{{ID: "default", Label: "Provider"}}
			}
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Select Provider",
				Items:        items,
			}, nil
		}
		session.Data["bill_provider"] = cmd.Selection
	}

	// Step 3: Enter meter/account number
	if session.Data["bill_account"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        session.Data["bill_provider"],
				InputPrompt:  "Enter Meter/Account No",
				InputType:    "TEXT",
			}, nil
		}
		session.Data["bill_account"] = cmd.InputData
	}

	// Step 4: Enter amount
	if session.Data["bill_amount"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Pay Bills",
				InputPrompt:  "Enter Amount (NGN)",
				InputType:    "AMOUNT",
			}, nil
		}
		session.Data["bill_amount"] = cmd.InputData
	}

	// Step 5: Enter PIN
	if session.Data["bill_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        fmt.Sprintf("N%s to %s", session.Data["bill_amount"], session.Data["bill_provider"]),
				InputPrompt:  "Enter PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["bill_pin"] = cmd.InputData
	}

	// Verify and execute
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["bill_pin"]) {
		s.clearBillData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	amount, _ := strconv.ParseFloat(session.Data["bill_amount"], 64)

	result, err := s.executeBillPayment(ctx, session.MSISDN, session.Data["bill_provider"], session.Data["bill_account"], amount)
	s.clearBillData(session)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  err.Error(),
		}, nil
	}

	stkTransactionsTotal.WithLabelValues("bill", "success").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  result,
	}, nil
}

// handleAgent processes agent banking
func (s *STKBankingService) handleAgent(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	// Step 1: Select action
	if session.Data["agent_action"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Agent Banking",
				Items: []STKItem{
					{ID: "cashin", Label: "Cash In (Deposit)"},
					{ID: "cashout", Label: "Cash Out (Withdraw)"},
					{ID: "find", Label: "Find Agent"},
				},
			}, nil
		}
		session.Data["agent_action"] = cmd.Selection
	}

	if session.Data["agent_action"] == "find" {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Dial *54# or visit 54bank.com/agents to find nearby agents",
		}, nil
	}

	// Step 2: Enter agent ID
	if session.Data["agent_id"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Agent Banking",
				InputPrompt:  "Enter Agent ID",
				InputType:    "TEXT",
			}, nil
		}

		// Verify agent
		var agentName string
		err := s.db.QueryRow(ctx, `SELECT business_name FROM agents WHERE agent_id = $1 AND is_active = true`, cmd.InputData).Scan(&agentName)
		if err != nil {
			return &STKResponse{
				ResponseType: "DISPLAY",
				DisplayText:  "Agent not found",
			}, nil
		}
		session.Data["agent_id"] = cmd.InputData
		session.Data["agent_name"] = agentName
	}

	// Step 3: Enter amount
	if session.Data["agent_amount"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        session.Data["agent_name"],
				InputPrompt:  "Enter Amount (NGN)",
				InputType:    "AMOUNT",
			}, nil
		}
		session.Data["agent_amount"] = cmd.InputData
	}

	// Step 4: Enter PIN
	if session.Data["agent_pin"] == "" {
		if cmd.InputData == "" {
			action := "Deposit"
			if session.Data["agent_action"] == "cashout" {
				action = "Withdraw"
			}
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        fmt.Sprintf("%s N%s", action, session.Data["agent_amount"]),
				InputPrompt:  "Enter PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["agent_pin"] = cmd.InputData
	}

	// Verify and generate OTP
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["agent_pin"]) {
		s.clearAgentData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	amount, _ := strconv.ParseFloat(session.Data["agent_amount"], 64)
	// Generate a cryptographically secure 6-digit OTP (CSPRNG, never derived
	// from time). Only the SHA-256 hash is persisted, with a 5-minute expiry
	// and an attempt counter (verifiers must cap attempts at 3).
	otp, otpErr := generateAgentOTP()
	if otpErr != nil {
		s.clearAgentData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Failed to generate OTP",
		}, nil
	}
	otpHash := sha256.Sum256([]byte(otp))
	otpHashHex := hex.EncodeToString(otpHash[:])

	_, err := s.db.Exec(ctx, `
		INSERT INTO agent_otps (phone, agent_id, otp, amount, action, expires_at, attempts)
		VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '5 minutes', 0)
	`, session.MSISDN, session.Data["agent_id"], otpHashHex, amount, session.Data["agent_action"])

	agentName := session.Data["agent_name"]
	s.clearAgentData(session)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Failed to generate OTP",
		}, nil
	}

	// Send OTP via SMS
	// The OTP is only ever delivered over the SMS channel; it is never
	// echoed in STK/API responses or logs.
	s.smsProvider.SendSMS(ctx, session.MSISDN, fmt.Sprintf("54Bank OTP: %s for N%.2f at %s. Valid 5 mins.", otp, amount, agentName))

	stkTransactionsTotal.WithLabelValues("agent", "otp_generated").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  "OTP sent via SMS\nValid 5 mins",
	}, nil
}

// generateAgentOTP returns a cryptographically secure 6-digit OTP using
// crypto/rand. Fails closed: returns an error if the CSPRNG is unavailable.
func generateAgentOTP() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	n := binary.BigEndian.Uint32(b[:]) % 1000000
	return fmt.Sprintf("%06d", n), nil
}

// handleStatement processes mini statement
func (s *STKBankingService) handleStatement(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	if session.Data["stmt_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Mini Statement",
				InputPrompt:  "Enter PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["stmt_pin"] = cmd.InputData
	}

	if !s.verifyPIN(ctx, session.MSISDN, session.Data["stmt_pin"]) {
		delete(session.Data, "stmt_pin")
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	rows, err := s.db.Query(ctx, `
		SELECT t.transaction_type, t.amount, t.created_at
		FROM transactions t
		JOIN accounts a ON t.account_id = a.account_id
		JOIN customers c ON a.customer_id = c.customer_id
		WHERE c.phone = $1
		ORDER BY t.created_at DESC
		LIMIT 5
	`, session.MSISDN)

	delete(session.Data, "stmt_pin")

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Unable to retrieve statement",
		}, nil
	}
	defer rows.Close()

	var stmt strings.Builder
	stmt.WriteString("Last 5 Txns:\n")

	for rows.Next() {
		var txnType string
		var amount float64
		var createdAt time.Time
		rows.Scan(&txnType, &amount, &createdAt)

		sign := "+"
		if strings.Contains(txnType, "out") || txnType == "debit" {
			sign = "-"
		}
		stmt.WriteString(fmt.Sprintf("%s%.0f %s\n", sign, amount, createdAt.Format("02/01")))
	}

	stkTransactionsTotal.WithLabelValues("statement", "success").Inc()

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  stmt.String(),
	}, nil
}

// handleSettings processes settings menu
func (s *STKBankingService) handleSettings(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	if session.Data["settings_action"] == "" {
		if cmd.Selection == "" {
			return &STKResponse{
				ResponseType: "MENU",
				Title:        "Settings",
				Items: []STKItem{
					{ID: "pin", Label: "Change PIN"},
					{ID: "block", Label: "Block Card"},
					{ID: "lang", Label: "Language"},
				},
			}, nil
		}
		session.Data["settings_action"] = cmd.Selection
	}

	switch session.Data["settings_action"] {
	case "pin":
		return s.handleChangePIN(ctx, session, cmd)
	case "block":
		return s.handleBlockCard(ctx, session, cmd)
	case "lang":
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Language: English\n(More languages coming soon)",
		}, nil
	}

	return s.showMainMenu(), nil
}

// handleChangePIN processes PIN change
func (s *STKBankingService) handleChangePIN(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	if session.Data["old_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Change PIN",
				InputPrompt:  "Enter Current PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["old_pin"] = cmd.InputData
	}

	if session.Data["new_pin"] == "" {
		if cmd.InputData == "" || cmd.InputData == session.Data["old_pin"] {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Change PIN",
				InputPrompt:  "Enter New PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["new_pin"] = cmd.InputData
	}

	if session.Data["confirm_pin"] == "" {
		if cmd.InputData == "" || cmd.InputData == session.Data["new_pin"] {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Change PIN",
				InputPrompt:  "Confirm New PIN",
				InputType:    "PIN",
			}, nil
		}
		session.Data["confirm_pin"] = cmd.InputData
	}

	// Verify old PIN
	if !s.verifyPIN(ctx, session.MSISDN, session.Data["old_pin"]) {
		s.clearPINData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid current PIN",
		}, nil
	}

	// Check new PIN matches confirmation
	if session.Data["new_pin"] != session.Data["confirm_pin"] {
		s.clearPINData(session)
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "PINs do not match",
		}, nil
	}

	// Update PIN
	h := hmac.New(sha256.New, []byte(s.pinSecret))
	h.Write([]byte(session.Data["new_pin"]))
	newPINHash := hex.EncodeToString(h.Sum(nil))

	_, err := s.db.Exec(ctx, `UPDATE customers SET pin_hash = $1, updated_at = NOW() WHERE phone = $2`, newPINHash, session.MSISDN)
	s.clearPINData(session)

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Failed to change PIN",
		}, nil
	}

	s.smsProvider.SendSMS(ctx, session.MSISDN, "Your 54Bank PIN has been changed successfully.")

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  "PIN changed successfully",
	}, nil
}

// handleBlockCard processes card blocking
func (s *STKBankingService) handleBlockCard(ctx context.Context, session *STKSession, cmd *STKCommand) (*STKResponse, error) {
	if session.Data["block_pin"] == "" {
		if cmd.InputData == "" {
			return &STKResponse{
				ResponseType: "INPUT",
				Title:        "Block Card",
				InputPrompt:  "Enter PIN to confirm",
				InputType:    "PIN",
			}, nil
		}
		session.Data["block_pin"] = cmd.InputData
	}

	if !s.verifyPIN(ctx, session.MSISDN, session.Data["block_pin"]) {
		delete(session.Data, "block_pin")
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Invalid PIN",
		}, nil
	}

	_, err := s.db.Exec(ctx, `
		UPDATE cards SET status = 'blocked', blocked_at = NOW(), blocked_reason = 'STK request'
		WHERE customer_id = (SELECT customer_id FROM customers WHERE phone = $1)
	`, session.MSISDN)

	delete(session.Data, "block_pin")

	if err != nil {
		return &STKResponse{
			ResponseType: "DISPLAY",
			DisplayText:  "Failed to block card",
		}, nil
	}

	s.smsProvider.SendSMS(ctx, session.MSISDN, "Your 54Bank card has been blocked. Visit any branch to unblock.")

	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  "Card blocked. Visit branch to unblock.",
	}, nil
}

// showHelp returns help information
func (s *STKBankingService) showHelp() *STKResponse {
	return &STKResponse{
		ResponseType: "DISPLAY",
		DisplayText:  "54Bank Help\nCall: 0800-54BANK\nEmail: help@54bank.com\nWeb: 54bank.com",
	}
}

// Helper methods

func (s *STKBankingService) verifyPIN(ctx context.Context, phone, pin string) bool {
	var storedPINHash string
	err := s.db.QueryRow(ctx, `SELECT pin_hash FROM customers WHERE phone = $1`, phone).Scan(&storedPINHash)
	if err != nil {
		return false
	}

	h := hmac.New(sha256.New, []byte(s.pinSecret))
	h.Write([]byte(pin))
	computedHash := hex.EncodeToString(h.Sum(nil))

	return computedHash == storedPINHash
}

func (s *STKBankingService) executeTransfer(ctx context.Context, senderPhone, recipient string, amount float64, transferType string) (string, error) {
	var senderAccountID string
	var senderBalance float64
	err := s.db.QueryRow(ctx, `
		SELECT a.account_id, a.balance
		FROM accounts a JOIN customers c ON a.customer_id = c.customer_id
		WHERE c.phone = $1 AND a.is_primary = true
	`, senderPhone).Scan(&senderAccountID, &senderBalance)

	if err != nil {
		return "", fmt.Errorf("Account not found")
	}

	if senderBalance < amount {
		return "", fmt.Errorf("Insufficient balance")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`, amount, senderAccountID)
	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}

	if transferType == "54bank" {
		_, err = tx.Exec(ctx, `UPDATE accounts SET balance = balance + $1 WHERE account_number = $2`, amount, recipient)
		if err != nil {
			return "", fmt.Errorf("Recipient error")
		}
	}

	txnRef := fmt.Sprintf("STK%d", time.Now().UnixNano())
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (account_id, transaction_type, amount, reference, description, created_at)
		VALUES ($1, 'transfer_out', $2, $3, $4, NOW())
	`, senderAccountID, amount, txnRef, "STK Transfer")

	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}

	err = tx.Commit(ctx)
	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}

	return fmt.Sprintf("Sent N%.2f\nRef: %s\nBal: N%.2f", amount, txnRef, senderBalance-amount), nil
}

func (s *STKBankingService) executeAirtime(ctx context.Context, senderPhone, targetPhone string, amount float64) (string, error) {
	var accountID string
	var balance float64
	err := s.db.QueryRow(ctx, `
		SELECT a.account_id, a.balance
		FROM accounts a JOIN customers c ON a.customer_id = c.customer_id
		WHERE c.phone = $1 AND a.is_primary = true
	`, senderPhone).Scan(&accountID, &balance)

	if err != nil || balance < amount {
		return "", fmt.Errorf("Insufficient balance")
	}

	_, err = s.db.Exec(ctx, `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`, amount, accountID)
	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}

	txnRef := fmt.Sprintf("AIR%d", time.Now().UnixNano())
	return fmt.Sprintf("N%.2f airtime\nTo: %s\nRef: %s", amount, targetPhone, txnRef), nil
}

func (s *STKBankingService) executeBillPayment(ctx context.Context, senderPhone, provider, account string, amount float64) (string, error) {
	var accountID string
	var balance float64
	err := s.db.QueryRow(ctx, `
		SELECT a.account_id, a.balance
		FROM accounts a JOIN customers c ON a.customer_id = c.customer_id
		WHERE c.phone = $1 AND a.is_primary = true
	`, senderPhone).Scan(&accountID, &balance)

	if err != nil || balance < amount {
		return "", fmt.Errorf("Insufficient balance")
	}

	_, err = s.db.Exec(ctx, `UPDATE accounts SET balance = balance - $1 WHERE account_id = $2`, amount, accountID)
	if err != nil {
		return "", fmt.Errorf("Transaction failed")
	}

	txnRef := fmt.Sprintf("BILL%d", time.Now().UnixNano())
	token := fmt.Sprintf("%012d", time.Now().UnixNano()%1000000000000)

	return fmt.Sprintf("%s Payment\nN%.2f\nToken: %s\nRef: %s", provider, amount, token, txnRef), nil
}

// Clear session data helpers
func (s *STKBankingService) clearTransferData(session *STKSession) {
	delete(session.Data, "transfer_type")
	delete(session.Data, "recipient")
	delete(session.Data, "recipient_name")
	delete(session.Data, "amount")
	delete(session.Data, "pin")
}

func (s *STKBankingService) clearAirtimeData(session *STKSession) {
	delete(session.Data, "airtime_type")
	delete(session.Data, "airtime_phone")
	delete(session.Data, "airtime_amount")
	delete(session.Data, "airtime_custom")
	delete(session.Data, "airtime_pin")
}

func (s *STKBankingService) clearBillData(session *STKSession) {
	delete(session.Data, "bill_category")
	delete(session.Data, "bill_provider")
	delete(session.Data, "bill_account")
	delete(session.Data, "bill_amount")
	delete(session.Data, "bill_pin")
}

func (s *STKBankingService) clearAgentData(session *STKSession) {
	delete(session.Data, "agent_action")
	delete(session.Data, "agent_id")
	delete(session.Data, "agent_name")
	delete(session.Data, "agent_amount")
	delete(session.Data, "agent_pin")
}

func (s *STKBankingService) clearPINData(session *STKSession) {
	delete(session.Data, "settings_action")
	delete(session.Data, "old_pin")
	delete(session.Data, "new_pin")
	delete(session.Data, "confirm_pin")
}

func (s *STKBankingService) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		s.mutex.Lock()
		now := time.Now()
		for imsi, session := range s.sessions {
			if now.Sub(session.LastAccess) > s.sessionTimeout {
				delete(s.sessions, imsi)
			}
		}
		s.mutex.Unlock()
	}
}

// JSON marshaling for STK responses
func (r *STKResponse) ToJSON() ([]byte, error) {
	return json.Marshal(r)
}
