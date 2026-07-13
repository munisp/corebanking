package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/go-redis/redis/v8"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	telegramMessagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "telegram_messages_total",
			Help: "Total Telegram messages processed",
		},
		[]string{"direction", "type", "status"},
	)

	telegramResponseTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "telegram_response_time_seconds",
			Help:    "Telegram response time",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"command"},
	)

	telegramActiveUsers = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "telegram_active_users",
			Help: "Number of active Telegram users",
		},
	)
)

type TelegramUpdate struct {
	UpdateID int64            `json:"update_id"`
	Message  *TelegramMessage `json:"message,omitempty"`
	Callback *CallbackQuery   `json:"callback_query,omitempty"`
}

type TelegramMessage struct {
	MessageID int64         `json:"message_id"`
	From      *TelegramUser `json:"from"`
	Chat      *TelegramChat `json:"chat"`
	Date      int64         `json:"date"`
	Text      string        `json:"text"`
	Contact   *Contact      `json:"contact,omitempty"`
	Location  *Location     `json:"location,omitempty"`
}

type TelegramUser struct {
	ID           int64  `json:"id"`
	IsBot        bool   `json:"is_bot"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Username     string `json:"username"`
	LanguageCode string `json:"language_code"`
}

type TelegramChat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type CallbackQuery struct {
	ID      string           `json:"id"`
	From    *TelegramUser    `json:"from"`
	Message *TelegramMessage `json:"message"`
	Data    string           `json:"data"`
}

type Contact struct {
	PhoneNumber string `json:"phone_number"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	UserID      int64  `json:"user_id"`
}

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	CallbackData string `json:"callback_data,omitempty"`
	URL          string `json:"url,omitempty"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

type ReplyKeyboardMarkup struct {
	Keyboard        [][]KeyboardButton `json:"keyboard"`
	ResizeKeyboard  bool               `json:"resize_keyboard"`
	OneTimeKeyboard bool               `json:"one_time_keyboard"`
}

type KeyboardButton struct {
	Text           string `json:"text"`
	RequestContact bool   `json:"request_contact,omitempty"`
}

type SendMessageRequest struct {
	ChatID      int64       `json:"chat_id"`
	Text        string      `json:"text"`
	ParseMode   string      `json:"parse_mode,omitempty"`
	ReplyMarkup interface{} `json:"reply_markup,omitempty"`
}

type TelegramSession struct {
	ChatID       int64             `json:"chat_id"`
	UserID       int64             `json:"user_id"`
	PhoneNumber  string            `json:"phone_number"`
	CustomerID   string            `json:"customer_id"`
	State        string            `json:"state"`
	Data         map[string]string `json:"data"`
	LastActivity time.Time         `json:"last_activity"`
	IsVerified   bool              `json:"is_verified"`
}

type TelegramBankingService struct {
	db            *pgxpool.Pool
	redis         *redis.Client
	kafkaProducer *kafka.Producer
	botToken      string
	webhookSecret string
	apiBaseURL    string
	sessions      map[int64]*TelegramSession
	mutex         sync.RWMutex
	httpClient    *http.Client
	tenantID      string
	keycloakURL   string
	permifyURL    string
	daprURL       string
}

type TelegramConfig struct {
	BotToken      string
	WebhookSecret string
	RedisURL      string
	KafkaBrokers  string
	PostgresURL   string
	TenantID      string
	KeycloakURL   string
	PermifyURL    string
	DaprURL       string
}

func NewTelegramBankingService(cfg *TelegramConfig) (*TelegramBankingService, error) {
	ctx := context.Background()

	db, err := pgxpool.New(ctx, cfg.PostgresURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.RedisURL,
	})

	producer, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.KafkaBrokers,
		"client.id":         "telegram-banking-service",
		"acks":              "all",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka producer: %w", err)
	}

	return &TelegramBankingService{
		db:            db,
		redis:         redisClient,
		kafkaProducer: producer,
		botToken:      cfg.BotToken,
		webhookSecret: cfg.WebhookSecret,
		apiBaseURL:    "https://api.telegram.org/bot" + cfg.BotToken,
		sessions:      make(map[int64]*TelegramSession),
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		tenantID:      cfg.TenantID,
		keycloakURL:   cfg.KeycloakURL,
		permifyURL:    cfg.PermifyURL,
		daprURL:       cfg.DaprURL,
	}, nil
}

func (s *TelegramBankingService) HandleWebhook(ctx context.Context, update *TelegramUpdate) error {
	start := time.Now()

	if update.Message != nil {
		return s.handleMessage(ctx, update.Message, start)
	}

	if update.Callback != nil {
		return s.handleCallback(ctx, update.Callback, start)
	}

	return nil
}

func (s *TelegramBankingService) handleMessage(ctx context.Context, msg *TelegramMessage, start time.Time) error {
	chatID := msg.Chat.ID
	userID := msg.From.ID
	text := strings.TrimSpace(msg.Text)

	defer func() {
		telegramResponseTime.WithLabelValues("message").Observe(time.Since(start).Seconds())
	}()

	telegramMessagesTotal.WithLabelValues("inbound", "text", "received").Inc()

	session := s.getOrCreateSession(chatID, userID)

	if msg.Contact != nil {
		return s.handleContactShared(ctx, session, msg.Contact)
	}

	if strings.HasPrefix(text, "/") {
		return s.handleCommand(ctx, session, text)
	}

	return s.handleConversation(ctx, session, text)
}

func (s *TelegramBankingService) handleCommand(ctx context.Context, session *TelegramSession, text string) error {
	parts := strings.Fields(text)
	command := strings.ToLower(parts[0])

	switch command {
	case "/start":
		return s.handleStart(ctx, session)
	case "/help":
		return s.handleHelp(ctx, session)
	case "/balance":
		return s.handleBalance(ctx, session)
	case "/transfer":
		return s.handleTransferStart(ctx, session)
	case "/airtime":
		return s.handleAirtimeStart(ctx, session)
	case "/bills":
		return s.handleBillsStart(ctx, session)
	case "/statement":
		return s.handleStatement(ctx, session)
	case "/cards":
		return s.handleCards(ctx, session)
	case "/loans":
		return s.handleLoans(ctx, session)
	case "/support":
		return s.handleSupport(ctx, session)
	case "/settings":
		return s.handleSettings(ctx, session)
	case "/logout":
		return s.handleLogout(ctx, session)
	default:
		return s.sendMessage(ctx, session.ChatID, "Unknown command. Type /help for available commands.", nil)
	}
}

func (s *TelegramBankingService) handleStart(ctx context.Context, session *TelegramSession) error {
	if session.IsVerified {
		return s.showMainMenu(ctx, session)
	}

	welcomeMsg := `🏦 *Welcome to 54Bank Telegram Banking!*

Your secure banking assistant is here to help you:
• Check account balance
• Transfer money
• Buy airtime & data
• Pay bills
• View statements
• And much more!

To get started, please share your phone number to verify your account.`

	keyboard := ReplyKeyboardMarkup{
		Keyboard: [][]KeyboardButton{
			{{Text: "📱 Share Phone Number", RequestContact: true}},
		},
		ResizeKeyboard:  true,
		OneTimeKeyboard: true,
	}

	s.publishEvent(ctx, "telegram.session.started", map[string]interface{}{
		"chat_id": session.ChatID,
		"user_id": session.UserID,
	})

	return s.sendMessage(ctx, session.ChatID, welcomeMsg, keyboard)
}

func (s *TelegramBankingService) handleContactShared(ctx context.Context, session *TelegramSession, contact *Contact) error {
	phone := contact.PhoneNumber
	if !strings.HasPrefix(phone, "+") {
		phone = "+" + phone
	}

	var customerID string
	err := s.db.QueryRow(ctx, `
		SELECT customer_id FROM customers 
		WHERE phone = $1 AND tenant_id = $2
	`, phone, s.tenantID).Scan(&customerID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID,
			"❌ Phone number not registered with 54Bank.\n\nPlease visit our website or branch to open an account.", nil)
	}

	session.PhoneNumber = phone
	session.CustomerID = customerID
	session.IsVerified = true
	session.State = "main_menu"

	s.saveSession(ctx, session)

	s.publishEvent(ctx, "telegram.user.verified", map[string]interface{}{
		"chat_id":     session.ChatID,
		"customer_id": customerID,
		"phone":       phone,
	})

	return s.showMainMenu(ctx, session)
}

func (s *TelegramBankingService) showMainMenu(ctx context.Context, session *TelegramSession) error {
	var firstName string
	s.db.QueryRow(ctx, `
		SELECT first_name FROM customers WHERE customer_id = $1
	`, session.CustomerID).Scan(&firstName)

	menuMsg := fmt.Sprintf(`👋 *Hello, %s!*

What would you like to do today?`, firstName)

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "💰 Balance", CallbackData: "balance"},
				{Text: "💸 Transfer", CallbackData: "transfer"},
			},
			{
				{Text: "📱 Airtime", CallbackData: "airtime"},
				{Text: "💡 Pay Bills", CallbackData: "bills"},
			},
			{
				{Text: "📊 Statement", CallbackData: "statement"},
				{Text: "💳 Cards", CallbackData: "cards"},
			},
			{
				{Text: "🏦 Loans", CallbackData: "loans"},
				{Text: "⚙️ Settings", CallbackData: "settings"},
			},
			{
				{Text: "📞 Support", CallbackData: "support"},
			},
		},
	}

	return s.sendMessage(ctx, session.ChatID, menuMsg, keyboard)
}

func (s *TelegramBankingService) handleCallback(ctx context.Context, callback *CallbackQuery, start time.Time) error {
	chatID := callback.Message.Chat.ID
	userID := callback.From.ID
	data := callback.Data

	defer func() {
		telegramResponseTime.WithLabelValues("callback").Observe(time.Since(start).Seconds())
	}()

	session := s.getOrCreateSession(chatID, userID)

	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	s.answerCallback(ctx, callback.ID)

	switch data {
	case "balance":
		return s.handleBalance(ctx, session)
	case "transfer":
		return s.handleTransferStart(ctx, session)
	case "airtime":
		return s.handleAirtimeStart(ctx, session)
	case "bills":
		return s.handleBillsStart(ctx, session)
	case "statement":
		return s.handleStatement(ctx, session)
	case "cards":
		return s.handleCards(ctx, session)
	case "loans":
		return s.handleLoans(ctx, session)
	case "settings":
		return s.handleSettings(ctx, session)
	case "support":
		return s.handleSupport(ctx, session)
	case "main_menu":
		return s.showMainMenu(ctx, session)
	default:
		return s.handleCallbackData(ctx, session, data)
	}
}

func (s *TelegramBankingService) handleBalance(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	rows, err := s.db.Query(ctx, `
		SELECT account_number, account_type, currency, balance, available_balance
		FROM accounts 
		WHERE customer_id = $1 AND status = 'active'
		ORDER BY is_primary DESC
	`, session.CustomerID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Unable to fetch balance. Please try again.", nil)
	}
	defer rows.Close()

	var balanceMsg strings.Builder
	balanceMsg.WriteString("💰 *Your Account Balances*\n\n")

	for rows.Next() {
		var accountNumber, accountType, currency string
		var balance, availableBalance float64
		rows.Scan(&accountNumber, &accountType, &currency, &balance, &availableBalance)

		balanceMsg.WriteString(fmt.Sprintf("*%s Account*\n", strings.Title(accountType)))
		balanceMsg.WriteString(fmt.Sprintf("Account: `%s`\n", accountNumber))
		balanceMsg.WriteString(fmt.Sprintf("Balance: %s %.2f\n", currency, balance))
		balanceMsg.WriteString(fmt.Sprintf("Available: %s %.2f\n\n", currency, availableBalance))
	}

	balanceMsg.WriteString(fmt.Sprintf("_As at %s_", time.Now().Format("02 Jan 2006, 15:04")))

	s.publishEvent(ctx, "telegram.balance.checked", map[string]interface{}{
		"customer_id": session.CustomerID,
		"chat_id":     session.ChatID,
	})

	s.recordToLakehouse(ctx, "balance_inquiry", map[string]interface{}{
		"customer_id": session.CustomerID,
		"channel":     "telegram",
		"timestamp":   time.Now(),
	})

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "🔄 Refresh", CallbackData: "balance"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, balanceMsg.String(), keyboard)
}

func (s *TelegramBankingService) handleTransferStart(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	session.State = "transfer_type"
	session.Data = make(map[string]string)
	s.saveSession(ctx, session)

	msg := `💸 *Transfer Money*

Select transfer type:`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "🏦 54Bank Account", CallbackData: "transfer_54bank"}},
			{{Text: "🏛️ Other Bank", CallbackData: "transfer_other"}},
			{{Text: "📱 Phone Number", CallbackData: "transfer_phone"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleCallbackData(ctx context.Context, session *TelegramSession, data string) error {
	switch {
	case strings.HasPrefix(data, "transfer_"):
		return s.handleTransferType(ctx, session, data)
	case strings.HasPrefix(data, "airtime_"):
		return s.handleAirtimeType(ctx, session, data)
	case strings.HasPrefix(data, "bill_"):
		return s.handleBillType(ctx, session, data)
	case strings.HasPrefix(data, "confirm_"):
		return s.handleConfirmation(ctx, session, data)
	case strings.HasPrefix(data, "cancel"):
		session.State = "main_menu"
		session.Data = nil
		s.saveSession(ctx, session)
		return s.showMainMenu(ctx, session)
	default:
		return s.showMainMenu(ctx, session)
	}
}

func (s *TelegramBankingService) handleTransferType(ctx context.Context, session *TelegramSession, data string) error {
	transferType := strings.TrimPrefix(data, "transfer_")
	session.Data["transfer_type"] = transferType
	session.State = "transfer_recipient"
	s.saveSession(ctx, session)

	var msg string
	switch transferType {
	case "54bank":
		msg = "Enter the recipient's 54Bank account number:"
	case "other":
		msg = "Enter the recipient's account number and bank code (e.g., 0123456789 044):"
	case "phone":
		msg = "Enter the recipient's phone number:"
	}

	return s.sendMessage(ctx, session.ChatID, msg, nil)
}

func (s *TelegramBankingService) handleConversation(ctx context.Context, session *TelegramSession, text string) error {
	switch session.State {
	case "transfer_recipient":
		return s.handleTransferRecipient(ctx, session, text)
	case "transfer_amount":
		return s.handleTransferAmount(ctx, session, text)
	case "transfer_pin":
		return s.handleTransferPIN(ctx, session, text)
	case "airtime_phone":
		return s.handleAirtimePhone(ctx, session, text)
	case "airtime_amount":
		return s.handleAirtimeAmount(ctx, session, text)
	case "bill_account":
		return s.handleBillAccount(ctx, session, text)
	case "bill_amount":
		return s.handleBillAmount(ctx, session, text)
	default:
		return s.showMainMenu(ctx, session)
	}
}

func (s *TelegramBankingService) handleTransferRecipient(ctx context.Context, session *TelegramSession, text string) error {
	transferType := session.Data["transfer_type"]

	if transferType == "54bank" {
		var recipientName string
		err := s.db.QueryRow(ctx, `
			SELECT CONCAT(c.first_name, ' ', c.last_name)
			FROM accounts a
			JOIN customers c ON a.customer_id = c.customer_id
			WHERE a.account_number = $1
		`, text).Scan(&recipientName)

		if err != nil {
			return s.sendMessage(ctx, session.ChatID, "❌ Account not found. Please check and try again.", nil)
		}

		session.Data["recipient"] = text
		session.Data["recipient_name"] = recipientName
	} else {
		session.Data["recipient"] = text
		session.Data["recipient_name"] = text
	}

	session.State = "transfer_amount"
	s.saveSession(ctx, session)

	msg := fmt.Sprintf("Recipient: *%s*\n\nEnter the amount to transfer (NGN):", session.Data["recipient_name"])
	return s.sendMessage(ctx, session.ChatID, msg, nil)
}

func (s *TelegramBankingService) handleTransferAmount(ctx context.Context, session *TelegramSession, text string) error {
	amount, err := strconv.ParseFloat(text, 64)
	if err != nil || amount <= 0 {
		return s.sendMessage(ctx, session.ChatID, "❌ Invalid amount. Please enter a valid number.", nil)
	}

	var balance float64
	err = s.db.QueryRow(ctx, `
		SELECT available_balance FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
	`, session.CustomerID).Scan(&balance)

	if err != nil || balance < amount {
		return s.sendMessage(ctx, session.ChatID, "❌ Insufficient balance.", nil)
	}

	session.Data["amount"] = fmt.Sprintf("%.2f", amount)
	session.State = "transfer_pin"
	s.saveSession(ctx, session)

	msg := fmt.Sprintf(`📋 *Transfer Summary*

Recipient: %s
Amount: NGN %.2f

Enter your 4-digit PIN to confirm:`, session.Data["recipient_name"], amount)

	return s.sendMessage(ctx, session.ChatID, msg, nil)
}

func (s *TelegramBankingService) handleTransferPIN(ctx context.Context, session *TelegramSession, text string) error {
	if len(text) != 4 {
		return s.sendMessage(ctx, session.ChatID, "❌ Invalid PIN. Please enter your 4-digit PIN.", nil)
	}

	if !s.verifyPIN(ctx, session.CustomerID, text) {
		return s.sendMessage(ctx, session.ChatID, "❌ Incorrect PIN. Please try again.", nil)
	}

	amount, _ := strconv.ParseFloat(session.Data["amount"], 64)
	recipient := session.Data["recipient"]
	recipientName := session.Data["recipient_name"]

	txnRef := fmt.Sprintf("TG%d", time.Now().UnixNano())

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}
	defer tx.Rollback(ctx)

	var senderAccountID string
	err = tx.QueryRow(ctx, `
		SELECT account_id FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
		FOR UPDATE
	`, session.CustomerID).Scan(&senderAccountID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	_, err = tx.Exec(ctx, `
		UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1
		WHERE account_id = $2
	`, amount, senderAccountID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	if session.Data["transfer_type"] == "54bank" {
		_, err = tx.Exec(ctx, `
			UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1
			WHERE account_number = $2
		`, amount, recipient)

		if err != nil {
			return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (account_id, transaction_type, amount, reference, description, channel, created_at)
		VALUES ($1, 'transfer_out', $2, $3, $4, 'telegram', NOW())
	`, senderAccountID, amount, txnRef, "Telegram Transfer to "+recipientName)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	err = tx.Commit(ctx)
	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	s.recordTransferInTigerBeetle(ctx, senderAccountID, recipient, amount, txnRef)

	s.publishEvent(ctx, "telegram.transfer.completed", map[string]interface{}{
		"customer_id": session.CustomerID,
		"recipient":   recipient,
		"amount":      amount,
		"reference":   txnRef,
		"channel":     "telegram",
	})

	s.recordToLakehouse(ctx, "transfer", map[string]interface{}{
		"customer_id": session.CustomerID,
		"recipient":   recipient,
		"amount":      amount,
		"reference":   txnRef,
		"channel":     "telegram",
		"timestamp":   time.Now(),
	})

	session.State = "main_menu"
	session.Data = nil
	s.saveSession(ctx, session)

	msg := fmt.Sprintf(`✅ *Transfer Successful!*

Amount: NGN %.2f
To: %s
Reference: %s
Date: %s

Thank you for banking with 54Bank!`, amount, recipientName, txnRef, time.Now().Format("02 Jan 2006, 15:04"))

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "💸 Another Transfer", CallbackData: "transfer"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleAirtimeStart(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	session.State = "airtime_type"
	session.Data = make(map[string]string)
	s.saveSession(ctx, session)

	msg := `📱 *Buy Airtime*

Select option:`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "📱 Self", CallbackData: "airtime_self"}},
			{{Text: "👥 Others", CallbackData: "airtime_others"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleAirtimeType(ctx context.Context, session *TelegramSession, data string) error {
	airtimeType := strings.TrimPrefix(data, "airtime_")
	session.Data["airtime_type"] = airtimeType

	if airtimeType == "self" {
		session.Data["airtime_phone"] = session.PhoneNumber
		session.State = "airtime_amount"
		s.saveSession(ctx, session)
		return s.sendMessage(ctx, session.ChatID, "Enter the airtime amount (NGN 50 - 50,000):", nil)
	}

	session.State = "airtime_phone"
	s.saveSession(ctx, session)
	return s.sendMessage(ctx, session.ChatID, "Enter the recipient's phone number:", nil)
}

func (s *TelegramBankingService) handleAirtimePhone(ctx context.Context, session *TelegramSession, text string) error {
	session.Data["airtime_phone"] = text
	session.State = "airtime_amount"
	s.saveSession(ctx, session)
	return s.sendMessage(ctx, session.ChatID, "Enter the airtime amount (NGN 50 - 50,000):", nil)
}

func (s *TelegramBankingService) handleAirtimeAmount(ctx context.Context, session *TelegramSession, text string) error {
	amount, err := strconv.ParseFloat(text, 64)
	if err != nil || amount < 50 || amount > 50000 {
		return s.sendMessage(ctx, session.ChatID, "❌ Invalid amount. Min: NGN 50, Max: NGN 50,000", nil)
	}

	var balance float64
	err = s.db.QueryRow(ctx, `
		SELECT available_balance FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
	`, session.CustomerID).Scan(&balance)

	if err != nil || balance < amount {
		return s.sendMessage(ctx, session.ChatID, "❌ Insufficient balance.", nil)
	}

	session.Data["amount"] = fmt.Sprintf("%.2f", amount)

	phone := session.Data["airtime_phone"]
	txnRef := fmt.Sprintf("AIR%d", time.Now().UnixNano())

	var accountID string
	s.db.QueryRow(ctx, `
		SELECT account_id FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
	`, session.CustomerID).Scan(&accountID)

	_, err = s.db.Exec(ctx, `
		UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1
		WHERE account_id = $2
	`, amount, accountID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	s.publishEvent(ctx, "telegram.airtime.purchased", map[string]interface{}{
		"customer_id": session.CustomerID,
		"phone":       phone,
		"amount":      amount,
		"reference":   txnRef,
		"channel":     "telegram",
	})

	s.recordToLakehouse(ctx, "airtime_purchase", map[string]interface{}{
		"customer_id": session.CustomerID,
		"phone":       phone,
		"amount":      amount,
		"reference":   txnRef,
		"channel":     "telegram",
		"timestamp":   time.Now(),
	})

	session.State = "main_menu"
	session.Data = nil
	s.saveSession(ctx, session)

	msg := fmt.Sprintf(`✅ *Airtime Purchase Successful!*

Amount: NGN %.2f
Phone: %s
Reference: %s
Date: %s

Thank you for banking with 54Bank!`, amount, phone, txnRef, time.Now().Format("02 Jan 2006, 15:04"))

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "📱 Buy More Airtime", CallbackData: "airtime"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleBillsStart(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	session.State = "bill_type"
	session.Data = make(map[string]string)
	s.saveSession(ctx, session)

	msg := `💡 *Pay Bills*

Select bill type:`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "⚡ Electricity", CallbackData: "bill_electricity"},
				{Text: "📺 Cable TV", CallbackData: "bill_cable"},
			},
			{
				{Text: "🌐 Internet", CallbackData: "bill_internet"},
				{Text: "💧 Water", CallbackData: "bill_water"},
			},
			{
				{Text: "🎓 School Fees", CallbackData: "bill_school"},
				{Text: "🏥 Insurance", CallbackData: "bill_insurance"},
			},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleBillType(ctx context.Context, session *TelegramSession, data string) error {
	billType := strings.TrimPrefix(data, "bill_")
	session.Data["bill_type"] = billType
	session.State = "bill_account"
	s.saveSession(ctx, session)

	var msg string
	switch billType {
	case "electricity":
		msg = "Enter your meter number:"
	case "cable":
		msg = "Enter your decoder/smartcard number:"
	case "internet":
		msg = "Enter your account ID:"
	case "water":
		msg = "Enter your water account number:"
	case "school":
		msg = "Enter the student ID:"
	case "insurance":
		msg = "Enter your policy number:"
	default:
		msg = "Enter your account/reference number:"
	}

	return s.sendMessage(ctx, session.ChatID, msg, nil)
}

func (s *TelegramBankingService) handleBillAccount(ctx context.Context, session *TelegramSession, text string) error {
	session.Data["bill_account"] = text
	session.State = "bill_amount"
	s.saveSession(ctx, session)
	return s.sendMessage(ctx, session.ChatID, "Enter the amount to pay:", nil)
}

func (s *TelegramBankingService) handleBillAmount(ctx context.Context, session *TelegramSession, text string) error {
	amount, err := strconv.ParseFloat(text, 64)
	if err != nil || amount <= 0 {
		return s.sendMessage(ctx, session.ChatID, "❌ Invalid amount. Please enter a valid number.", nil)
	}

	var balance float64
	err = s.db.QueryRow(ctx, `
		SELECT available_balance FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
	`, session.CustomerID).Scan(&balance)

	if err != nil || balance < amount {
		return s.sendMessage(ctx, session.ChatID, "❌ Insufficient balance.", nil)
	}

	billType := session.Data["bill_type"]
	billAccount := session.Data["bill_account"]
	txnRef := fmt.Sprintf("BILL%d", time.Now().UnixNano())

	var accountID string
	s.db.QueryRow(ctx, `
		SELECT account_id FROM accounts 
		WHERE customer_id = $1 AND is_primary = true
	`, session.CustomerID).Scan(&accountID)

	_, err = s.db.Exec(ctx, `
		UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1
		WHERE account_id = $2
	`, amount, accountID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Transaction failed. Please try again.", nil)
	}

	s.publishEvent(ctx, "telegram.bill.paid", map[string]interface{}{
		"customer_id":  session.CustomerID,
		"bill_type":    billType,
		"bill_account": billAccount,
		"amount":       amount,
		"reference":    txnRef,
		"channel":      "telegram",
	})

	s.recordToLakehouse(ctx, "bill_payment", map[string]interface{}{
		"customer_id":  session.CustomerID,
		"bill_type":    billType,
		"bill_account": billAccount,
		"amount":       amount,
		"reference":    txnRef,
		"channel":      "telegram",
		"timestamp":    time.Now(),
	})

	session.State = "main_menu"
	session.Data = nil
	s.saveSession(ctx, session)

	msg := fmt.Sprintf(`✅ *Bill Payment Successful!*

Bill Type: %s
Account: %s
Amount: NGN %.2f
Reference: %s
Date: %s

Thank you for banking with 54Bank!`, strings.Title(billType), billAccount, amount, txnRef, time.Now().Format("02 Jan 2006, 15:04"))

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "💡 Pay Another Bill", CallbackData: "bills"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleStatement(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	rows, err := s.db.Query(ctx, `
		SELECT t.transaction_type, t.amount, t.description, t.created_at
		FROM transactions t
		JOIN accounts a ON t.account_id = a.account_id
		WHERE a.customer_id = $1
		ORDER BY t.created_at DESC
		LIMIT 10
	`, session.CustomerID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Unable to fetch statement. Please try again.", nil)
	}
	defer rows.Close()

	var stmtMsg strings.Builder
	stmtMsg.WriteString("📊 *Mini Statement (Last 10 Transactions)*\n\n")

	for rows.Next() {
		var txnType, description string
		var amount float64
		var createdAt time.Time
		rows.Scan(&txnType, &amount, &description, &createdAt)

		sign := "+"
		if strings.Contains(txnType, "out") || txnType == "debit" {
			sign = "-"
		}

		stmtMsg.WriteString(fmt.Sprintf("`%s` %sNGN %.2f\n_%s_\n\n",
			createdAt.Format("02/01 15:04"), sign, amount, description))
	}

	s.publishEvent(ctx, "telegram.statement.viewed", map[string]interface{}{
		"customer_id": session.CustomerID,
		"chat_id":     session.ChatID,
	})

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "📥 Full Statement (PDF)", CallbackData: "statement_pdf"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, stmtMsg.String(), keyboard)
}

func (s *TelegramBankingService) handleCards(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	rows, err := s.db.Query(ctx, `
		SELECT card_number, card_type, status, expiry_date
		FROM cards 
		WHERE customer_id = $1
	`, session.CustomerID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Unable to fetch cards. Please try again.", nil)
	}
	defer rows.Close()

	var cardsMsg strings.Builder
	cardsMsg.WriteString("💳 *Your Cards*\n\n")

	for rows.Next() {
		var cardNumber, cardType, status string
		var expiryDate time.Time
		rows.Scan(&cardNumber, &cardType, &status, &expiryDate)

		maskedNumber := "****" + cardNumber[len(cardNumber)-4:]
		statusEmoji := "✅"
		if status == "blocked" {
			statusEmoji = "🔒"
		}

		cardsMsg.WriteString(fmt.Sprintf("*%s Card*\n", strings.Title(cardType)))
		cardsMsg.WriteString(fmt.Sprintf("Number: `%s`\n", maskedNumber))
		cardsMsg.WriteString(fmt.Sprintf("Status: %s %s\n", statusEmoji, strings.Title(status)))
		cardsMsg.WriteString(fmt.Sprintf("Expires: %s\n\n", expiryDate.Format("01/06")))
	}

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "🔒 Block Card", CallbackData: "card_block"},
				{Text: "🔓 Unblock Card", CallbackData: "card_unblock"},
			},
			{
				{Text: "📊 Card Limits", CallbackData: "card_limits"},
				{Text: "🔔 Card Alerts", CallbackData: "card_alerts"},
			},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, cardsMsg.String(), keyboard)
}

func (s *TelegramBankingService) handleLoans(ctx context.Context, session *TelegramSession) error {
	if !session.IsVerified {
		return s.handleStart(ctx, session)
	}

	rows, err := s.db.Query(ctx, `
		SELECT loan_type, principal_amount, outstanding_balance, monthly_payment, next_payment_date, status
		FROM loans 
		WHERE customer_id = $1
	`, session.CustomerID)

	if err != nil {
		return s.sendMessage(ctx, session.ChatID, "❌ Unable to fetch loans. Please try again.", nil)
	}
	defer rows.Close()

	var loansMsg strings.Builder
	loansMsg.WriteString("🏦 *Your Loans*\n\n")

	hasLoans := false
	for rows.Next() {
		hasLoans = true
		var loanType, status string
		var principal, outstanding, monthlyPayment float64
		var nextPaymentDate time.Time
		rows.Scan(&loanType, &principal, &outstanding, &monthlyPayment, &nextPaymentDate, &status)

		loansMsg.WriteString(fmt.Sprintf("*%s Loan*\n", strings.Title(loanType)))
		loansMsg.WriteString(fmt.Sprintf("Principal: NGN %.2f\n", principal))
		loansMsg.WriteString(fmt.Sprintf("Outstanding: NGN %.2f\n", outstanding))
		loansMsg.WriteString(fmt.Sprintf("Monthly Payment: NGN %.2f\n", monthlyPayment))
		loansMsg.WriteString(fmt.Sprintf("Next Payment: %s\n", nextPaymentDate.Format("02 Jan 2006")))
		loansMsg.WriteString(fmt.Sprintf("Status: %s\n\n", strings.Title(status)))
	}

	if !hasLoans {
		loansMsg.WriteString("You have no active loans.\n\n")
	}

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "📝 Apply for Loan", CallbackData: "loan_apply"}},
			{{Text: "💰 Make Payment", CallbackData: "loan_payment"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, loansMsg.String(), keyboard)
}

func (s *TelegramBankingService) handleSupport(ctx context.Context, session *TelegramSession) error {
	msg := `📞 *Customer Support*

We're here to help! Choose an option:

📧 Email: support@54bank.com
📞 Phone: 0700-54-BANK (0700-54-2265)
🌐 Website: www.54bank.com

Operating Hours:
Mon-Fri: 8:00 AM - 8:00 PM
Sat: 9:00 AM - 5:00 PM
Sun: Closed`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "💬 Live Chat", CallbackData: "support_chat"}},
			{{Text: "📝 Submit Ticket", CallbackData: "support_ticket"}},
			{{Text: "❓ FAQs", CallbackData: "support_faq"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleSettings(ctx context.Context, session *TelegramSession) error {
	msg := `⚙️ *Settings*

Manage your account preferences:`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "🔔 Notifications", CallbackData: "settings_notifications"}},
			{{Text: "🔐 Security", CallbackData: "settings_security"}},
			{{Text: "🌍 Language", CallbackData: "settings_language"}},
			{{Text: "📱 Linked Devices", CallbackData: "settings_devices"}},
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleHelp(ctx context.Context, session *TelegramSession) error {
	msg := `📚 *54Bank Telegram Banking Help*

*Available Commands:*
/start - Start banking session
/balance - Check account balance
/transfer - Transfer money
/airtime - Buy airtime
/bills - Pay bills
/statement - View mini statement
/cards - Manage cards
/loans - View loans
/support - Contact support
/settings - Account settings
/logout - End session
/help - Show this help

*Quick Tips:*
• Use the menu buttons for easy navigation
• Your session is secure and encrypted
• PIN is required for transactions
• Contact support for any issues`

	keyboard := InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{{Text: "🏠 Main Menu", CallbackData: "main_menu"}},
		},
	}

	return s.sendMessage(ctx, session.ChatID, msg, keyboard)
}

func (s *TelegramBankingService) handleLogout(ctx context.Context, session *TelegramSession) error {
	s.mutex.Lock()
	delete(s.sessions, session.ChatID)
	s.mutex.Unlock()

	s.redis.Del(ctx, fmt.Sprintf("telegram:session:%d", session.ChatID))

	s.publishEvent(ctx, "telegram.session.ended", map[string]interface{}{
		"chat_id":     session.ChatID,
		"customer_id": session.CustomerID,
	})

	msg := `👋 *Goodbye!*

You have been logged out successfully.

Thank you for banking with 54Bank!

Type /start to begin a new session.`

	return s.sendMessage(ctx, session.ChatID, msg, nil)
}

func (s *TelegramBankingService) handleConfirmation(ctx context.Context, session *TelegramSession, data string) error {
	action := strings.TrimPrefix(data, "confirm_")

	switch action {
	case "transfer":
		return s.sendMessage(ctx, session.ChatID, "Enter your 4-digit PIN to confirm:", nil)
	case "cancel":
		session.State = "main_menu"
		session.Data = nil
		s.saveSession(ctx, session)
		return s.showMainMenu(ctx, session)
	default:
		return s.showMainMenu(ctx, session)
	}
}

func (s *TelegramBankingService) getOrCreateSession(chatID, userID int64) *TelegramSession {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if session, exists := s.sessions[chatID]; exists {
		session.LastActivity = time.Now()
		return session
	}

	ctx := context.Background()
	sessionKey := fmt.Sprintf("telegram:session:%d", chatID)
	data, err := s.redis.Get(ctx, sessionKey).Bytes()
	if err == nil {
		var session TelegramSession
		if json.Unmarshal(data, &session) == nil {
			session.LastActivity = time.Now()
			s.sessions[chatID] = &session
			return &session
		}
	}

	session := &TelegramSession{
		ChatID:       chatID,
		UserID:       userID,
		State:        "start",
		Data:         make(map[string]string),
		LastActivity: time.Now(),
		IsVerified:   false,
	}
	s.sessions[chatID] = session
	telegramActiveUsers.Inc()

	return session
}

func (s *TelegramBankingService) saveSession(ctx context.Context, session *TelegramSession) {
	s.mutex.Lock()
	s.sessions[session.ChatID] = session
	s.mutex.Unlock()

	sessionKey := fmt.Sprintf("telegram:session:%d", session.ChatID)
	data, _ := json.Marshal(session)
	s.redis.Set(ctx, sessionKey, data, 24*time.Hour)
}

func (s *TelegramBankingService) verifyPIN(ctx context.Context, customerID, pin string) bool {
	var pinHash string
	err := s.db.QueryRow(ctx, `
		SELECT pin_hash FROM customers WHERE customer_id = $1
	`, customerID).Scan(&pinHash)

	if err != nil {
		return false
	}

	h := hmac.New(sha256.New, []byte("54bank-pin-secret"))
	h.Write([]byte(pin))
	expectedHash := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal([]byte(pinHash), []byte(expectedHash))
}

func (s *TelegramBankingService) sendMessage(ctx context.Context, chatID int64, text string, replyMarkup interface{}) error {
	req := SendMessageRequest{
		ChatID:      chatID,
		Text:        text,
		ParseMode:   "Markdown",
		ReplyMarkup: replyMarkup,
	}

	body, _ := json.Marshal(req)
	resp, err := s.httpClient.Post(
		s.apiBaseURL+"/sendMessage",
		"application/json",
		strings.NewReader(string(body)),
	)

	if err != nil {
		return err
	}
	defer resp.Body.Close()

	telegramMessagesTotal.WithLabelValues("outbound", "text", "sent").Inc()
	return nil
}

func (s *TelegramBankingService) answerCallback(ctx context.Context, callbackID string) {
	s.httpClient.Post(
		s.apiBaseURL+"/answerCallbackQuery",
		"application/json",
		strings.NewReader(fmt.Sprintf(`{"callback_query_id":"%s"}`, callbackID)),
	)
}

func (s *TelegramBankingService) publishEvent(ctx context.Context, topic string, data map[string]interface{}) {
	data["tenant_id"] = s.tenantID
	data["timestamp"] = time.Now().UTC().Format(time.RFC3339)

	payload, _ := json.Marshal(data)

	s.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          payload,
	}, nil)
}

func (s *TelegramBankingService) recordToLakehouse(ctx context.Context, eventType string, data map[string]interface{}) {
	data["event_type"] = eventType
	data["tenant_id"] = s.tenantID

	payload, _ := json.Marshal(data)

	topic := "lakehouse.telegram.events"
	s.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          payload,
	}, nil)
}

func (s *TelegramBankingService) recordTransferInTigerBeetle(ctx context.Context, senderAccountID, recipientAccountID string, amount float64, reference string) {
	// Call transaction-service via Dapr to record the transfer
	payload := map[string]interface{}{
		"from_account_id": senderAccountID,
		"to_account_id":   recipientAccountID,
		"amount":          fmt.Sprintf("%.2f", amount),
		"currency":        "NGN",
		"reference":       reference,
		"description":     "Telegram transfer",
		"channel":         "telegram",
		"tenant_id":       s.tenantID,
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/v1.0/invoke/transaction-service/method/api/v1/transactions", s.daprURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(body)))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	s.httpClient.Do(req)
}

func (s *TelegramBankingService) Close() {
	s.db.Close()
	s.redis.Close()
	s.kafkaProducer.Close()
}

func main() {
	cfg := &TelegramConfig{
		BotToken:      getEnv("TELEGRAM_BOT_TOKEN", ""),
		WebhookSecret: getEnv("TELEGRAM_WEBHOOK_SECRET", ""),
		RedisURL:      getEnv("REDIS_URL", "localhost:6379"),
		KafkaBrokers:  getEnv("KAFKA_BROKERS", "localhost:9092"),
		PostgresURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/54bank"),
		TenantID:      getEnv("TENANT_ID", "default"),
		KeycloakURL:   getEnv("KEYCLOAK_URL", "http://localhost:8080"),
		PermifyURL:    getEnv("PERMIFY_URL", "http://localhost:3476"),
		DaprURL:       getEnv("DAPR_URL", "http://localhost:3500"),
	}

	service, err := NewTelegramBankingService(cfg)
	if err != nil {
		panic(err)
	}
	defer service.Close()

	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var update TelegramUpdate
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		go service.HandleWebhook(r.Context(), &update)

		w.WriteHeader(http.StatusOK)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "healthy",
			"service": "telegram-banking",
		})
	})

	http.Handle("/metrics", promhttp.Handler())

	port := getEnv("PORT", "8123")
	fmt.Printf("Telegram Banking Service starting on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
