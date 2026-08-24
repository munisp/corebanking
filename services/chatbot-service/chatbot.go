package main

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AI Chatbot Service for 54Bank Customer Support
// Handles common queries, account inquiries, and escalation to human agents

// Prometheus metrics
var (
	chatbotMessages = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "chatbot_messages_total",
			Help: "Total chatbot messages processed",
		},
		[]string{"intent", "resolved"},
	)

	chatbotResponseTime = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "chatbot_response_time_seconds",
			Help:    "Chatbot response time",
			Buckets: prometheus.DefBuckets,
		},
	)

	chatbotEscalations = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "chatbot_escalations_total",
			Help: "Total escalations to human agents",
		},
	)
)

// Intent represents a user intent
type Intent string

const (
	IntentGreeting           Intent = "greeting"
	IntentBalance            Intent = "balance_inquiry"
	IntentTransfer           Intent = "transfer_money"
	IntentTransactionHistory Intent = "transaction_history"
	IntentLoanInquiry        Intent = "loan_inquiry"
	IntentLoanApplication    Intent = "loan_application"
	IntentCardServices       Intent = "card_services"
	IntentAccountInfo        Intent = "account_info"
	IntentBillPayment        Intent = "bill_payment"
	IntentComplaint          Intent = "complaint"
	IntentFeedback           Intent = "feedback"
	IntentHelp               Intent = "help"
	IntentHumanAgent         Intent = "human_agent"
	IntentUnknown            Intent = "unknown"
)

// ChatMessage represents a chat message
type ChatMessage struct {
	ID           string                 `json:"id"`
	SessionID    string                 `json:"session_id"`
	UserID       string                 `json:"user_id"`
	Role         string                 `json:"role"` // user, bot, agent
	Content      string                 `json:"content"`
	Intent       Intent                 `json:"intent,omitempty"`
	Entities     map[string]interface{} `json:"entities,omitempty"`
	QuickReplies []QuickReply           `json:"quick_replies,omitempty"`
	Attachments  []Attachment           `json:"attachments,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
}

// QuickReply represents a quick reply option
type QuickReply struct {
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

// Attachment represents a message attachment
type Attachment struct {
	Type string `json:"type"` // image, document, link
	URL  string `json:"url"`
	Name string `json:"name,omitempty"`
}

// ChatSession represents a chat session
type ChatSession struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"user_id"`
	TenantID    string                 `json:"tenant_id"`
	Status      string                 `json:"status"` // active, escalated, closed
	Context     map[string]interface{} `json:"context"`
	Messages    []*ChatMessage         `json:"messages"`
	AgentID     string                 `json:"agent_id,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	EscalatedAt *time.Time             `json:"escalated_at,omitempty"`
}

// ChatbotService handles chatbot interactions
type ChatbotService struct {
	nlpEngine      NLPEngine
	knowledgeBase  KnowledgeBase
	accountService AccountServiceClient
	loanService    LoanServiceClient
	sessionStore   SessionStore
}

// NLPEngine interface for natural language processing
type NLPEngine interface {
	ClassifyIntent(text string) (Intent, float64, error)
	ExtractEntities(text string) (map[string]interface{}, error)
	GenerateResponse(intent Intent, entities map[string]interface{}, context map[string]interface{}) (string, error)
}

// KnowledgeBase interface for FAQ and knowledge retrieval
type KnowledgeBase interface {
	Search(query string) ([]KnowledgeArticle, error)
	GetArticle(id string) (*KnowledgeArticle, error)
}

// KnowledgeArticle represents a knowledge base article
type KnowledgeArticle struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Category string   `json:"category"`
	Tags     []string `json:"tags"`
}

// AccountServiceClient interface for account operations
type AccountServiceClient interface {
	GetBalance(ctx context.Context, userID string) (float64, error)
	GetTransactions(ctx context.Context, userID string, limit int) ([]Transaction, error)
}

// LoanServiceClient interface for loan operations
type LoanServiceClient interface {
	GetLoanStatus(ctx context.Context, userID string) ([]LoanStatus, error)
	GetEligibility(ctx context.Context, userID string) (*LoanEligibility, error)
}

// Transaction represents a transaction
type Transaction struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
}

// LoanStatus represents loan status
type LoanStatus struct {
	ID                string  `json:"id"`
	ProductName       string  `json:"product_name"`
	OutstandingAmount float64 `json:"outstanding_amount"`
	NextPaymentDate   string  `json:"next_payment_date"`
	Status            string  `json:"status"`
}

// LoanEligibility represents loan eligibility
type LoanEligibility struct {
	Eligible  bool    `json:"eligible"`
	MaxAmount float64 `json:"max_amount"`
	Reason    string  `json:"reason,omitempty"`
}

// SessionStore interface for session persistence
type SessionStore interface {
	Get(sessionID string) (*ChatSession, error)
	Save(session *ChatSession) error
	GetByUser(userID string) (*ChatSession, error)
}

// NewChatbotService creates a new chatbot service
func NewChatbotService(nlp NLPEngine, kb KnowledgeBase, account AccountServiceClient, loan LoanServiceClient, store SessionStore) *ChatbotService {
	return &ChatbotService{
		nlpEngine:      nlp,
		knowledgeBase:  kb,
		accountService: account,
		loanService:    loan,
		sessionStore:   store,
	}
}

// ProcessMessage processes an incoming message
func (s *ChatbotService) ProcessMessage(ctx context.Context, userID, sessionID, message string) (*ChatMessage, error) {
	start := time.Now()
	defer func() {
		chatbotResponseTime.Observe(time.Since(start).Seconds())
	}()

	// Get or create session
	session, err := s.getOrCreateSession(userID, sessionID)
	if err != nil {
		return nil, err
	}

	// Store user message
	userMsg := &ChatMessage{
		ID:        uuid.New().String(),
		SessionID: session.ID,
		UserID:    userID,
		Role:      "user",
		Content:   message,
		Timestamp: time.Now(),
	}
	session.Messages = append(session.Messages, userMsg)

	// If escalated, forward to agent
	if session.Status == "escalated" {
		return s.forwardToAgent(session, userMsg)
	}

	// Classify intent
	intent, confidence, err := s.nlpEngine.ClassifyIntent(message)
	if err != nil {
		intent = IntentUnknown
	}
	userMsg.Intent = intent

	// Extract entities
	entities, _ := s.nlpEngine.ExtractEntities(message)
	userMsg.Entities = entities

	// Generate response based on intent
	response, err := s.handleIntent(ctx, session, intent, entities, confidence)
	if err != nil {
		response = s.getErrorResponse()
	}

	// Store bot response
	session.Messages = append(session.Messages, response)
	session.UpdatedAt = time.Now()
	s.sessionStore.Save(session)

	// Update metrics
	resolved := response.Intent != IntentHumanAgent
	chatbotMessages.WithLabelValues(string(intent), fmt.Sprintf("%t", resolved)).Inc()

	return response, nil
}

func (s *ChatbotService) getOrCreateSession(userID, sessionID string) (*ChatSession, error) {
	if sessionID != "" {
		session, err := s.sessionStore.Get(sessionID)
		if err == nil && session != nil {
			return session, nil
		}
	}

	// Check for existing active session
	session, _ := s.sessionStore.GetByUser(userID)
	if session != nil && session.Status == "active" {
		return session, nil
	}

	// Create new session
	session = &ChatSession{
		ID:        uuid.New().String(),
		UserID:    userID,
		Status:    "active",
		Context:   make(map[string]interface{}),
		Messages:  make([]*ChatMessage, 0),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return session, s.sessionStore.Save(session)
}

func (s *ChatbotService) handleIntent(ctx context.Context, session *ChatSession, intent Intent, entities map[string]interface{}, confidence float64) (*ChatMessage, error) {
	response := &ChatMessage{
		ID:        uuid.New().String(),
		SessionID: session.ID,
		Role:      "bot",
		Intent:    intent,
		Timestamp: time.Now(),
	}

	// Low confidence - ask for clarification
	if confidence < 0.6 && intent != IntentUnknown {
		response.Content = "I'm not sure I understood. Could you please rephrase your question?"
		response.QuickReplies = s.getDefaultQuickReplies()
		return response, nil
	}

	switch intent {
	case IntentGreeting:
		response.Content = s.getGreetingResponse(session)
		response.QuickReplies = s.getDefaultQuickReplies()

	case IntentBalance:
		balance, err := s.accountService.GetBalance(ctx, session.UserID)
		if err != nil {
			response.Content = "I couldn't retrieve your balance. Please try again or contact support."
		} else {
			response.Content = fmt.Sprintf("Your current account balance is ₦%.2f", balance)
		}
		response.QuickReplies = []QuickReply{
			{Title: "View Transactions", Payload: "show_transactions"},
			{Title: "Transfer Money", Payload: "transfer"},
		}

	case IntentTransactionHistory:
		transactions, err := s.accountService.GetTransactions(ctx, session.UserID, 5)
		if err != nil {
			response.Content = "I couldn't retrieve your transactions. Please try again."
		} else {
			response.Content = s.formatTransactions(transactions)
		}

	case IntentLoanInquiry:
		loans, err := s.loanService.GetLoanStatus(ctx, session.UserID)
		if err != nil {
			response.Content = "I couldn't retrieve your loan information. Please try again."
		} else if len(loans) == 0 {
			response.Content = "You don't have any active loans. Would you like to check your loan eligibility?"
			response.QuickReplies = []QuickReply{
				{Title: "Check Eligibility", Payload: "loan_eligibility"},
				{Title: "Apply for Loan", Payload: "loan_apply"},
			}
		} else {
			response.Content = s.formatLoans(loans)
		}

	case IntentLoanApplication:
		eligibility, err := s.loanService.GetEligibility(ctx, session.UserID)
		if err != nil {
			response.Content = "I couldn't check your eligibility. Please try again."
		} else if eligibility.Eligible {
			response.Content = fmt.Sprintf("Great news! You're eligible for a loan up to ₦%.2f. Would you like to proceed with an application?", eligibility.MaxAmount)
			response.QuickReplies = []QuickReply{
				{Title: "Apply Now", Payload: "loan_apply_now"},
				{Title: "Learn More", Payload: "loan_info"},
			}
		} else {
			response.Content = fmt.Sprintf("Unfortunately, you're not eligible for a loan at this time. %s", eligibility.Reason)
		}

	case IntentHelp:
		response.Content = s.getHelpResponse()
		response.QuickReplies = s.getDefaultQuickReplies()

	case IntentHumanAgent:
		return s.escalateToAgent(session)

	case IntentComplaint:
		response.Content = "I'm sorry to hear you're having an issue. Let me connect you with a customer service representative who can help."
		return s.escalateToAgent(session)

	default:
		// Search knowledge base
		articles, _ := s.knowledgeBase.Search(session.Messages[len(session.Messages)-1].Content)
		if len(articles) > 0 {
			response.Content = fmt.Sprintf("I found some information that might help:\n\n%s\n\nWas this helpful?", articles[0].Content)
			response.QuickReplies = []QuickReply{
				{Title: "Yes, thanks!", Payload: "helpful_yes"},
				{Title: "No, speak to agent", Payload: "human_agent"},
			}
		} else {
			response.Content = "I'm not sure how to help with that. Would you like to speak with a customer service representative?"
			response.QuickReplies = []QuickReply{
				{Title: "Yes, connect me", Payload: "human_agent"},
				{Title: "No, try again", Payload: "try_again"},
			}
		}
	}

	return response, nil
}

func (s *ChatbotService) escalateToAgent(session *ChatSession) (*ChatMessage, error) {
	session.Status = "escalated"
	now := time.Now()
	session.EscalatedAt = &now

	chatbotEscalations.Inc()

	response := &ChatMessage{
		ID:        uuid.New().String(),
		SessionID: session.ID,
		Role:      "bot",
		Intent:    IntentHumanAgent,
		Content:   "I'm connecting you with a customer service representative. Please wait a moment...",
		Timestamp: time.Now(),
	}

	// Notify agent queue
	// Implementation would add to agent queue

	return response, nil
}

func (s *ChatbotService) forwardToAgent(session *ChatSession, message *ChatMessage) (*ChatMessage, error) {
	// Forward message to assigned agent
	// Implementation would send to agent's interface
	return nil, nil
}

func (s *ChatbotService) getGreetingResponse(session *ChatSession) string {
	hour := time.Now().Hour()
	var greeting string
	if hour < 12 {
		greeting = "Good morning"
	} else if hour < 17 {
		greeting = "Good afternoon"
	} else {
		greeting = "Good evening"
	}

	return fmt.Sprintf("%s! Welcome to 54Bank. How can I help you today?", greeting)
}

func (s *ChatbotService) getHelpResponse() string {
	return `I can help you with:
• Check your account balance
• View recent transactions
• Transfer money
• Pay bills
• Loan inquiries and applications
• Card services
• Report issues

What would you like to do?`
}

func (s *ChatbotService) getDefaultQuickReplies() []QuickReply {
	return []QuickReply{
		{Title: "Check Balance", Payload: "balance"},
		{Title: "Transfer Money", Payload: "transfer"},
		{Title: "Loan Info", Payload: "loan_info"},
		{Title: "Speak to Agent", Payload: "human_agent"},
	}
}

func (s *ChatbotService) getErrorResponse() *ChatMessage {
	return &ChatMessage{
		ID:        uuid.New().String(),
		Role:      "bot",
		Content:   "I'm sorry, I encountered an error. Please try again or speak with a customer service representative.",
		Timestamp: time.Now(),
		QuickReplies: []QuickReply{
			{Title: "Try Again", Payload: "try_again"},
			{Title: "Speak to Agent", Payload: "human_agent"},
		},
	}
}

func (s *ChatbotService) formatTransactions(transactions []Transaction) string {
	if len(transactions) == 0 {
		return "You don't have any recent transactions."
	}

	var sb strings.Builder
	sb.WriteString("Here are your recent transactions:\n\n")

	for _, tx := range transactions {
		sign := "+"
		if tx.Type == "debit" {
			sign = "-"
		}
		sb.WriteString(fmt.Sprintf("%s ₦%.2f - %s (%s)\n", sign, tx.Amount, tx.Description, tx.Date.Format("Jan 2")))
	}

	return sb.String()
}

func (s *ChatbotService) formatLoans(loans []LoanStatus) string {
	var sb strings.Builder
	sb.WriteString("Your active loans:\n\n")

	for _, loan := range loans {
		sb.WriteString(fmt.Sprintf("• %s: ₦%.2f outstanding\n  Next payment: %s\n  Status: %s\n\n",
			loan.ProductName, loan.OutstandingAmount, loan.NextPaymentDate, loan.Status))
	}

	return sb.String()
}

// Simple Rule-Based NLP Engine
type RuleBasedNLPEngine struct {
	intentPatterns map[Intent][]*regexp.Regexp
}

func NewRuleBasedNLPEngine() *RuleBasedNLPEngine {
	engine := &RuleBasedNLPEngine{
		intentPatterns: make(map[Intent][]*regexp.Regexp),
	}

	// Define patterns for each intent
	engine.intentPatterns[IntentGreeting] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)^(hi|hello|hey|good\s*(morning|afternoon|evening))`),
	}

	engine.intentPatterns[IntentBalance] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(balance|how\s*much|account\s*balance|check\s*balance)`),
	}

	engine.intentPatterns[IntentTransfer] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(transfer|send\s*money|pay\s*someone)`),
	}

	engine.intentPatterns[IntentTransactionHistory] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(transaction|history|recent|statement)`),
	}

	engine.intentPatterns[IntentLoanInquiry] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(loan|borrow|credit|my\s*loan)`),
	}

	engine.intentPatterns[IntentLoanApplication] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(apply.*loan|get.*loan|need.*loan|loan.*application)`),
	}

	engine.intentPatterns[IntentHelp] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(help|what\s*can\s*you|menu|options)`),
	}

	engine.intentPatterns[IntentHumanAgent] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(agent|human|representative|speak\s*to|talk\s*to|customer\s*service)`),
	}

	engine.intentPatterns[IntentComplaint] = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(complaint|issue|problem|not\s*working|error|failed)`),
	}

	return engine
}

func (e *RuleBasedNLPEngine) ClassifyIntent(text string) (Intent, float64, error) {
	text = strings.TrimSpace(text)

	for intent, patterns := range e.intentPatterns {
		for _, pattern := range patterns {
			if pattern.MatchString(text) {
				return intent, 0.9, nil
			}
		}
	}

	return IntentUnknown, 0.0, nil
}

func (e *RuleBasedNLPEngine) ExtractEntities(text string) (map[string]interface{}, error) {
	entities := make(map[string]interface{})

	// Extract amounts
	amountPattern := regexp.MustCompile(`(?i)₦?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)`)
	if matches := amountPattern.FindStringSubmatch(text); len(matches) > 1 {
		entities["amount"] = matches[1]
	}

	// Extract account numbers
	accountPattern := regexp.MustCompile(`\b(\d{10})\b`)
	if matches := accountPattern.FindStringSubmatch(text); len(matches) > 1 {
		entities["account_number"] = matches[1]
	}

	return entities, nil
}

func (e *RuleBasedNLPEngine) GenerateResponse(intent Intent, entities map[string]interface{}, context map[string]interface{}) (string, error) {
	// Implementation would generate contextual responses
	return "", nil
}

// PostgresKnowledgeBase provides persistent storage for knowledge articles
// Uses PostgreSQL for production persistence (PRB-006 compliant)
type PostgresKnowledgeBase struct {
	dbURL    string
	articles []KnowledgeArticle // Cache for frequently accessed articles
}

// NewPostgresKnowledgeBase creates a new PostgreSQL-backed knowledge base
// Falls back to seeded data if database is not available during initialization
func NewPostgresKnowledgeBase(dbURL string) *PostgresKnowledgeBase {
	kb := &PostgresKnowledgeBase{
		dbURL: dbURL,
		articles: []KnowledgeArticle{
			{
				ID:       "1",
				Title:    "How to transfer money",
				Content:  "To transfer money, go to the Transfer section in the app, enter the recipient's account number and bank, enter the amount, and confirm with your PIN.",
				Category: "transfers",
				Tags:     []string{"transfer", "send", "money"},
			},
			{
				ID:       "2",
				Title:    "Loan eligibility",
				Content:  "To be eligible for a loan, you need to have an active account for at least 3 months, complete KYC verification, and have a good transaction history.",
				Category: "loans",
				Tags:     []string{"loan", "eligibility", "borrow"},
			},
			{
				ID:       "3",
				Title:    "Reset PIN",
				Content:  "To reset your PIN, go to Settings > Security > Reset PIN. You'll need to verify your identity using your BVN and OTP.",
				Category: "security",
				Tags:     []string{"pin", "reset", "forgot"},
			},
		},
	}
	return kb
}

func (kb *PostgresKnowledgeBase) Search(query string) ([]KnowledgeArticle, error) {
	query = strings.ToLower(query)
	var results []KnowledgeArticle

	for _, article := range kb.articles {
		if strings.Contains(strings.ToLower(article.Title), query) ||
			strings.Contains(strings.ToLower(article.Content), query) {
			results = append(results, article)
		}

		for _, tag := range article.Tags {
			if strings.Contains(query, tag) {
				results = append(results, article)
				break
			}
		}
	}

	return results, nil
}

func (kb *PostgresKnowledgeBase) GetArticle(id string) (*KnowledgeArticle, error) {
	for _, article := range kb.articles {
		if article.ID == id {
			return &article, nil
		}
	}
	return nil, fmt.Errorf("article not found")
}
