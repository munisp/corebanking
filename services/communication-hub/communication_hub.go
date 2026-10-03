// Package main - Nigmacore Communication Hub Service
// Handles SMS, WhatsApp, Email, Telegram notifications and routing for elderly Nigerians
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type MessageChannel string

type MessagePriority string

type MessageStatus string

const (
	ChannelSMS      MessageChannel = "sms"
	ChannelWhatsApp MessageChannel = "whatsapp"
	ChannelTelegram MessageChannel = "telegram"
	ChannelEmail    MessageChannel = "email"
	ChannelVoice    MessageChannel = "voice"
)

const (
	PriorityLow      MessagePriority = "low"
	PriorityNormal   MessagePriority = "normal"
	PriorityHigh     MessagePriority = "high"
	PriorityCritical MessagePriority = "critical"
)

const (
	StatusPending    MessageStatus = "pending"
	StatusProcessing MessageStatus = "processing"
	StatusSent       MessageStatus = "sent"
	StatusDelivered  MessageStatus = "delivered"
	StatusRead       MessageStatus = "read"
	StatusFailed     MessageStatus = "failed"
	StatusCancelled  MessageStatus = "cancelled"
)

type CommunicationHub struct {
	db       *sql.DB
	router   *gin.Engine
	handlers *MessageHandlers
	services *ExternalServices
}

type MessageHandlers struct {
	hub *CommunicationHub
}

type ExternalServices struct {
	SMSProvider      *SMSProvider
	WhatsAppProvider *WhatsAppProvider
	TelegramProvider *TelegramProvider
	EmailProvider    *EmailProvider
	VoiceProvider    *VoiceProvider
}

type SMSProvider struct {
	APIKey      string
	BaseURL     string
	SenderID    string
	Provider    string // "twilio", "africas_talking", "termii"
	Environment string
}

type WhatsAppProvider struct {
	APIKey      string
	PhoneNumber string
	BaseURL     string
	WebhookURL  string
}

type TelegramProvider struct {
	BotToken   string
	WebhookURL string
	BaseURL    string
}

type EmailProvider struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	FromName     string
	UseTLS       bool
	Provider     string // "smtp", "sendgrid", "ses"
}

type VoiceProvider struct {
	APIKey   string
	BaseURL  string
	CallerID string
	Language string // "en-NG", "ha-NG", "yo-NG", "ig-NG", "pcm-NG"
}

type Message struct {
	ID                uuid.UUID       `json:"id"`
	ConversationID    *uuid.UUID      `json:"conversation_id,omitempty"`
	Channel           MessageChannel  `json:"channel"`
	Priority          MessagePriority `json:"priority"`
	Status            MessageStatus   `json:"status"`
	SenderID          string          `json:"sender_id"`
	SenderType        string          `json:"sender_type"` // "system", "agent", "customer"
	RecipientID       string          `json:"recipient_id"`
	RecipientType     string          `json:"recipient_type"`
	RecipientPhone    string          `json:"recipient_phone,omitempty"`
	RecipientEmail    string          `json:"recipient_email,omitempty"`
	RecipientTelegram string          `json:"recipient_telegram,omitempty"`
	Subject           string          `json:"subject,omitempty"`
	Content           string          `json:"content"`
	ContentType       string          `json:"content_type"` // "text", "html", "template"
	TemplateID        *uuid.UUID      `json:"template_id,omitempty"`
	TemplateVariables json.RawMessage `json:"template_variables,omitempty"`
	Language          string          `json:"language"` // "en", "ha", "yo", "ig", "pcm"
	ScheduledAt       *time.Time      `json:"scheduled_at,omitempty"`
	SentAt            *time.Time      `json:"sent_at,omitempty"`
	DeliveredAt       *time.Time      `json:"delivered_at,omitempty"`
	ReadAt            *time.Time      `json:"read_at,omitempty"`
	FailedAt          *time.Time      `json:"failed_at,omitempty"`
	FailureReason     string          `json:"failure_reason,omitempty"`
	RetryCount        int             `json:"retry_count"`
	MaxRetries        int             `json:"max_retries"`
	ProviderMessageID string          `json:"provider_message_id,omitempty"`
	ProviderStatus    string          `json:"provider_status,omitempty"`
	Metadata          json.RawMessage `json:"metadata,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

type Conversation struct {
	ID                uuid.UUID      `json:"id"`
	CustomerID        uuid.UUID      `json:"customer_id"`
	CustomerName      string         `json:"customer_name"`
	CustomerPhone     string         `json:"customer_phone"`
	CustomerEmail     string         `json:"customer_email,omitempty"`
	Channel           MessageChannel `json:"channel"`
	Status            string         `json:"status"` // "active", "closed", "archived"
	AssignedAgentID   *uuid.UUID     `json:"assigned_agent_id,omitempty"`
	AssignedAgentName string         `json:"assigned_agent_name,omitempty"`
	Priority          string         `json:"priority"`
	Language          string         `json:"language"`
	Tags              []string       `json:"tags,omitempty"`
	Metadata          json.RawMessage `json:"metadata,omitempty"`
	LastMessageAt     *time.Time     `json:"last_message_at,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type MessageTemplate struct {
	ID           uuid.UUID       `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Channel      MessageChannel  `json:"channel"`
	Language     string          `json:"language"`
	Subject      string          `json:"subject,omitempty"`
	Content      string          `json:"content"`
	ContentType  string          `json:"content_type"`
	Variables    []string        `json:"variables"`
	IsActive     bool            `json:"is_active"`
	UsageCount   int             `json:"usage_count"`
	CreatedBy    uuid.UUID       `json:"created_by"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

func main() {
	hub, err := NewCommunicationHub()
	if err != nil {
		log.Fatal("Failed to initialize communication hub:", err)
	}
	defer hub.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Communication Hub starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, hub.router))
}

func NewCommunicationHub() (*CommunicationHub, error) {
	// Initialize database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Initialize external services
	services := &ExternalServices{
		SMSProvider: &SMSProvider{
			APIKey:      os.Getenv("SMS_API_KEY"),
			BaseURL:     getEnvOrDefault("SMS_BASE_URL", "https://api.termii.com"),
			SenderID:    getEnvOrDefault("SMS_SENDER_ID", "Nigmacore"),
			Provider:    getEnvOrDefault("SMS_PROVIDER", "termii"),
			Environment: getEnvOrDefault("SMS_ENVIRONMENT", "sandbox"),
		},
		WhatsAppProvider: &WhatsAppProvider{
			APIKey:      os.Getenv("WHATSAPP_API_KEY"),
			PhoneNumber: os.Getenv("WHATSAPP_PHONE_NUMBER"),
			BaseURL:     getEnvOrDefault("WHATSAPP_BASE_URL", "https://graph.facebook.com"),
			WebhookURL:  os.Getenv("WHATSAPP_WEBHOOK_URL"),
		},
		TelegramProvider: &TelegramProvider{
			BotToken:   os.Getenv("TELEGRAM_BOT_TOKEN"),
			WebhookURL: os.Getenv("TELEGRAM_WEBHOOK_URL"),
			BaseURL:    "https://api.telegram.org",
		},
		EmailProvider: &EmailProvider{
			SMTPHost:    getEnvOrDefault("SMTP_HOST", "localhost"),
			SMTPPort:    getEnvIntOrDefault("SMTP_PORT", 587),
			Username:    os.Getenv("SMTP_USERNAME"),
			Password:    os.Getenv("SMTP_PASSWORD"),
			FromAddress: getEnvOrDefault("EMAIL_FROM_ADDRESS", "noreply@nigmacore.com"),
			FromName:    getEnvOrDefault("EMAIL_FROM_NAME", "Nigmacore Financial"),
			UseTLS:      getEnvBoolOrDefault("SMTP_USE_TLS", true),
			Provider:    getEnvOrDefault("EMAIL_PROVIDER", "smtp"),
		},
		VoiceProvider: &VoiceProvider{
			APIKey:   os.Getenv("VOICE_API_KEY"),
			BaseURL:  os.Getenv("VOICE_BASE_URL"),
			CallerID: os.Getenv("VOICE_CALLER_ID"),
			Language: getEnvOrDefault("VOICE_LANGUAGE", "en-NG"),
		},
	}

	hub := &CommunicationHub{
		db:       db,
		services: services,
	}

	hub.handlers = &MessageHandlers{hub: hub}
	hub.setupRoutes()

	return hub, nil
}

func (h *CommunicationHub) setupRoutes() {
	r := gin.Default()

	// Middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	// Health check
	r.GET("/health", h.healthCheck)
	r.GET("/ready", h.readinessCheck)

	// API routes
	api := r.Group("/api/v1")
	{
		// Messages
		messages := api.Group("/messages")
		{
			messages.POST("", h.handlers.sendMessage)
			messages.GET("", h.handlers.listMessages)
			messages.GET("/:id", h.handlers.getMessage)
			messages.POST("/:id/retry", h.handlers.retryMessage)
			messages.DELETE("/:id", h.handlers.cancelMessage)
			messages.GET("/stats", h.handlers.getMessageStats)
		}

		// Conversations
		conversations := api.Group("/conversations")
		{
			conversations.POST("", h.handlers.createConversation)
			conversations.GET("", h.handlers.listConversations)
			conversations.GET("/:id", h.handlers.getConversation)
			conversations.PUT("/:id", h.handlers.updateConversation)
			conversations.GET("/:id/messages", h.handlers.getConversationMessages)
			conversations.POST("/:id/messages", h.handlers.sendConversationMessage)
			conversations.POST("/:id/assign", h.handlers.assignAgent)
			conversations.POST("/:id/close", h.handlers.closeConversation)
		}

		// Templates
		templates := api.Group("/templates")
		{
			templates.POST("", h.handlers.createTemplate)
			templates.GET("", h.handlers.listTemplates)
			templates.GET("/:id", h.handlers.getTemplate)
			templates.PUT("/:id", h.handlers.updateTemplate)
			templates.DELETE("/:id", h.handlers.deleteTemplate)
			templates.POST("/:id/preview", h.handlers.previewTemplate)
		}

		// Bulk operations
		bulk := api.Group("/bulk")
		{
			bulk.POST("/sms", h.handlers.sendBulkSMS)
			bulk.POST("/whatsapp", h.handlers.sendBulkWhatsApp)
			bulk.POST("/email", h.handlers.sendBulkEmail)
			bulk.POST("/notifications", h.handlers.sendBulkNotifications)
		}

		// Webhooks
		webhooks := api.Group("/webhooks")
		{
			webhooks.POST("/sms", h.handlers.handleSMSWebhook)
			webhooks.POST("/whatsapp", h.handlers.handleWhatsAppWebhook)
			webhooks.POST("/telegram", h.handlers.handleTelegramWebhook)
			webhooks.POST("/email", h.handlers.handleEmailWebhook)
		}

		// Channel-specific endpoints
		channels := api.Group("/channels")
		{
			channels.POST("/sms/send", h.handlers.sendSMS)
			channels.POST("/whatsapp/send", h.handlers.sendWhatsApp)
			channels.POST("/telegram/send", h.handlers.sendTelegram)
			channels.POST("/email/send", h.handlers.sendEmail)
			channels.POST("/voice/call", h.handlers.makeVoiceCall)
		}

		// Customer preferences
		preferences := api.Group("/preferences")
		{
			preferences.GET("/:customer_id", h.handlers.getCustomerPreferences)
			preferences.PUT("/:customer_id", h.handlers.updateCustomerPreferences)
		}

		// Analytics
		analytics := api.Group("/analytics")
		{
			analytics.GET("/delivery-rates", h.handlers.getDeliveryRates)
			analytics.GET("/channel-performance", h.handlers.getChannelPerformance)
			analytics.GET("/customer-engagement", h.handlers.getCustomerEngagement)
		}
	}

	h.router = r
}

func (h *CommunicationHub) Close() {
	if h.db != nil {
		h.db.Close()
	}
}

func (h *CommunicationHub) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "communication-hub",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

func (h *CommunicationHub) readinessCheck(c *gin.Context) {
	// Check database connectivity
	if err := h.db.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "not ready",
			"error":  "database connection failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
	})
}

// Message Handlers
func (h *MessageHandlers) sendMessage(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate channel
	if !isValidChannel(req.Channel) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel"})
		return
	}

	// Create message
	message := &Message{
		ID:             uuid.New(),
		Channel:        req.Channel,
		Priority:       req.Priority,
		Status:         StatusPending,
		SenderID:       req.SenderID,
		SenderType:     req.SenderType,
		RecipientID:    req.RecipientID,
		RecipientType:  req.RecipientType,
		RecipientPhone: req.RecipientPhone,
		RecipientEmail: req.RecipientEmail,
		Subject:        req.Subject,
		Content:        req.Content,
		ContentType:    req.ContentType,
		Language:       req.Language,
		ScheduledAt:    req.ScheduledAt,
		RetryCount:     0,
		MaxRetries:     req.MaxRetries,
		Metadata:       req.Metadata,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if message.MaxRetries == 0 {
		message.MaxRetries = 3
	}

	// Save to database
	if err := h.hub.saveMessage(message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save message"})
		return
	}

	// Process message asynchronously
	go h.hub.processMessage(message)

	c.JSON(http.StatusCreated, message)
}

func (h *MessageHandlers) listMessages(c *gin.Context) {
	// Parse query parameters
	status := c.Query("status")
	channel := c.Query("channel")
	recipientID := c.Query("recipient_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if limit > 100 {
		limit = 100
	}

	messages, total, err := h.hub.listMessages(status, channel, recipientID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

func (h *MessageHandlers) getMessage(c *gin.Context) {
	id := c.Param("id")
	messageID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message ID"})
		return
	}

	message, err := h.hub.getMessage(messageID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	c.JSON(http.StatusOK, message)
}

func (h *MessageHandlers) retryMessage(c *gin.Context) {
	id := c.Param("id")
	messageID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message ID"})
		return
	}

	if err := h.hub.retryMessage(messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "retry initiated"})
}

func (h *MessageHandlers) cancelMessage(c *gin.Context) {
	id := c.Param("id")
	messageID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message ID"})
		return
	}

	if err := h.hub.cancelMessage(messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "message cancelled"})
}

func (h *MessageHandlers) getMessageStats(c *gin.Context) {
	stats, err := h.hub.getMessageStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// Conversation Handlers
func (h *MessageHandlers) createConversation(c *gin.Context) {
	var req CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conversation := &Conversation{
		ID:            uuid.New(),
		CustomerID:    req.CustomerID,
		CustomerName:  req.CustomerName,
		CustomerPhone: req.CustomerPhone,
		CustomerEmail: req.CustomerEmail,
		Channel:       req.Channel,
		Status:        "active",
		Priority:      req.Priority,
		Language:      req.Language,
		Tags:          req.Tags,
		Metadata:      req.Metadata,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := h.hub.saveConversation(conversation); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create conversation"})
		return
	}

	c.JSON(http.StatusCreated, conversation)
}

func (h *MessageHandlers) listConversations(c *gin.Context) {
	status := c.Query("status")
	channel := c.Query("channel")
	assignedAgent := c.Query("assigned_agent")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	conversations, total, err := h.hub.listConversations(status, channel, assignedAgent, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch conversations"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"conversations": conversations,
		"total":         total,
		"page":          page,
		"limit":         limit,
	})
}

func (h *MessageHandlers) getConversation(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	conversation, err := h.hub.getConversation(conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}

	c.JSON(http.StatusOK, conversation)
}

func (h *MessageHandlers) updateConversation(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	var req UpdateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.updateConversation(conversationID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update conversation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *MessageHandlers) getConversationMessages(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	messages, total, err := h.hub.getConversationMessages(conversationID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

func (h *MessageHandlers) sendConversationMessage(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	var req SendConversationMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	message, err := h.hub.sendConversationMessage(conversationID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, message)
}

func (h *MessageHandlers) assignAgent(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	var req AssignAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.assignAgent(conversationID, req.AgentID, req.AgentName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign agent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "agent assigned"})
}

func (h *MessageHandlers) closeConversation(c *gin.Context) {
	id := c.Param("id")
	conversationID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid conversation ID"})
		return
	}

	if err := h.hub.closeConversation(conversationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to close conversation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "conversation closed"})
}

// Template Handlers
func (h *MessageHandlers) createTemplate(c *gin.Context) {
	var req CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template := &MessageTemplate{
		ID:          uuid.New(),
		Name:        req.Name,
		Description: req.Description,
		Channel:     req.Channel,
		Language:    req.Language,
		Subject:     req.Subject,
		Content:     req.Content,
		ContentType: req.ContentType,
		Variables:   req.Variables,
		IsActive:    true,
		UsageCount:  0,
		CreatedBy:   req.CreatedBy,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := h.hub.saveTemplate(template); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create template"})
		return
	}

	c.JSON(http.StatusCreated, template)
}

func (h *MessageHandlers) listTemplates(c *gin.Context) {
	channel := c.Query("channel")
	language := c.Query("language")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	templates, total, err := h.hub.listTemplates(channel, language, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch templates"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"templates": templates,
		"total":     total,
		"page":      page,
		"limit":     limit,
	})
}

func (h *MessageHandlers) getTemplate(c *gin.Context) {
	id := c.Param("id")
	templateID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template ID"})
		return
	}

	template, err := h.hub.getTemplate(templateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
		return
	}

	c.JSON(http.StatusOK, template)
}

func (h *MessageHandlers) updateTemplate(c *gin.Context) {
	id := c.Param("id")
	templateID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template ID"})
		return
	}

	var req UpdateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.updateTemplate(templateID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

func (h *MessageHandlers) deleteTemplate(c *gin.Context) {
	id := c.Param("id")
	templateID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template ID"})
		return
	}

	if err := h.hub.deleteTemplate(templateID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete template"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *MessageHandlers) previewTemplate(c *gin.Context) {
	id := c.Param("id")
	templateID, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template ID"})
		return
	}

	var req PreviewTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	preview, err := h.hub.previewTemplate(templateID, req.Variables)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

// Bulk Operations
func (h *MessageHandlers) sendBulkSMS(c *gin.Context) {
	var req BulkSMSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendBulkSMS(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendBulkWhatsApp(c *gin.Context) {
	var req BulkWhatsAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendBulkWhatsApp(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendBulkEmail(c *gin.Context) {
	var req BulkEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendBulkEmail(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendBulkNotifications(c *gin.Context) {
	var req BulkNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendBulkNotifications(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Webhook Handlers
func (h *MessageHandlers) handleSMSWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.processSMSWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *MessageHandlers) handleWhatsAppWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.processWhatsAppWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *MessageHandlers) handleTelegramWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.processTelegramWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *MessageHandlers) handleEmailWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.processEmailWebhook(payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

// Channel-specific handlers
func (h *MessageHandlers) sendSMS(c *gin.Context) {
	var req SendSMSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendSMS(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendWhatsApp(c *gin.Context) {
	var req SendWhatsAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendWhatsApp(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendTelegram(c *gin.Context) {
	var req SendTelegramRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendTelegram(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) sendEmail(c *gin.Context) {
	var req SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.sendEmail(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *MessageHandlers) makeVoiceCall(c *gin.Context) {
	var req MakeVoiceCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.hub.makeVoiceCall(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Customer Preferences
func (h *MessageHandlers) getCustomerPreferences(c *gin.Context) {
	customerID := c.Param("customer_id")

	preferences, err := h.hub.getCustomerPreferences(customerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch preferences"})
		return
	}

	c.JSON(http.StatusOK, preferences)
}

func (h *MessageHandlers) updateCustomerPreferences(c *gin.Context) {
	customerID := c.Param("customer_id")

	var req CustomerPreferences
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.hub.updateCustomerPreferences(customerID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// Analytics
func (h *MessageHandlers) getDeliveryRates(c *gin.Context) {
	rates, err := h.hub.getDeliveryRates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch delivery rates"})
		return
	}

	c.JSON(http.StatusOK, rates)
}

func (h *MessageHandlers) getChannelPerformance(c *gin.Context) {
	performance, err := h.hub.getChannelPerformance()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch channel performance"})
		return
	}

	c.JSON(http.StatusOK, performance)
}

func (h *MessageHandlers) getCustomerEngagement(c *gin.Context) {
	engagement, err := h.hub.getCustomerEngagement()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch customer engagement"})
		return
	}

	c.JSON(http.StatusOK, engagement)
}

// Database methods
func (h *CommunicationHub) saveMessage(msg *Message) error {
	query := `
		INSERT INTO messages (
			id, conversation_id, channel, priority, status, sender_id, sender_type,
			recipient_id, recipient_type, recipient_phone, recipient_email,
			subject, content, content_type, template_id, template_variables,
			language, scheduled_at, retry_count, max_retries, metadata,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
	`

	_, err := h.db.Exec(query,
		msg.ID, msg.ConversationID, msg.Channel, msg.Priority, msg.Status,
		msg.SenderID, msg.SenderType, msg.RecipientID, msg.RecipientType,
		msg.RecipientPhone, msg.RecipientEmail, msg.Subject, msg.Content,
		msg.ContentType, msg.TemplateID, msg.TemplateVariables, msg.Language,
		msg.ScheduledAt, msg.RetryCount, msg.MaxRetries, msg.Metadata,
		msg.CreatedAt, msg.UpdatedAt,
	)

	return err
}

func (h *CommunicationHub) processMessage(msg *Message) {
	// Update status to processing
	h.updateMessageStatus(msg.ID, StatusProcessing)

	var err error
	switch msg.Channel {
	case ChannelSMS:
		err = h.sendSMSMessage(msg)
	case ChannelWhatsApp:
		err = h.sendWhatsAppMessage(msg)
	case ChannelTelegram:
		err = h.sendTelegramMessage(msg)
	case ChannelEmail:
		err = h.sendEmailMessage(msg)
	case ChannelVoice:
		err = h.makeVoiceCallMessage(msg)
	default:
		err = fmt.Errorf("unsupported channel: %s", msg.Channel)
	}

	if err != nil {
		log.Printf("Failed to send message %s: %v", msg.ID, err)
		h.handleMessageFailure(msg, err)
	} else {
		h.updateMessageStatus(msg.ID, StatusSent)
		now := time.Now().UTC()
		h.updateMessageSentAt(msg.ID, &now)
	}
}

func (h *CommunicationHub) sendSMSMessage(msg *Message) error {
	// Implementation for SMS sending via Termii or other provider
	// This is a simplified version
	payload := map[string]interface{}{
		"to":      msg.RecipientPhone,
		"from":    h.services.SMSProvider.SenderID,
		"sms":     msg.Content,
		"type":    "plain",
		"channel": "generic",
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", h.services.SMSProvider.BaseURL+"/api/sms/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.services.SMSProvider.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("SMS provider returned status: %d", resp.StatusCode)
	}

	return nil
}

func (h *CommunicationHub) sendWhatsAppMessage(msg *Message) error {
	// Implementation for WhatsApp sending
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                msg.RecipientPhone,
		"type":              "text",
		"text": map[string]string{
			"body": msg.Content,
		},
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", h.services.WhatsAppProvider.BaseURL+"/v17.0/"+h.services.WhatsAppProvider.PhoneNumber+"/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.services.WhatsAppProvider.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("WhatsApp provider returned status: %d", resp.StatusCode)
	}

	return nil
}

func (h *CommunicationHub) sendTelegramMessage(msg *Message) error {
	// Implementation for Telegram sending
	payload := map[string]interface{}{
		"chat_id":    msg.RecipientTelegram,
		"text":       msg.Content,
		"parse_mode": "Markdown",
	}

	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", h.services.TelegramProvider.BaseURL+"/bot"+h.services.TelegramProvider.BotToken+"/sendMessage", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Telegram provider returned status: %d", resp.StatusCode)
	}

	return nil
}

func (h *CommunicationHub) sendEmailMessage(msg *Message) error {
	// Implementation for Email sending
	// This is a simplified version - in production, use a proper email library
	return fmt.Errorf("email sending not implemented")
}

func (h *CommunicationHub) makeVoiceCallMessage(msg *Message) error {
	// Implementation for Voice calls
	return fmt.Errorf("voice calls not implemented")
}

func (h *CommunicationHub) handleMessageFailure(msg *Message, err error) {
	msg.RetryCount++
	if msg.RetryCount <= msg.MaxRetries {
		// Schedule retry
		go func() {
			time.Sleep(time.Duration(msg.RetryCount) * time.Minute)
			h.processMessage(msg)
		}()
	} else {
		h.updateMessageStatus(msg.ID, StatusFailed)
		h.updateMessageFailure(msg.ID, err.Error())
	}
}

func (h *CommunicationHub) updateMessageStatus(id uuid.UUID, status MessageStatus) error {
	query := `UPDATE messages SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := h.db.Exec(query, status, time.Now().UTC(), id)
	return err
}

func (h *CommunicationHub) updateMessageSentAt(id uuid.UUID, sentAt *time.Time) error {
	query := `UPDATE messages SET sent_at = $1, updated_at = $2 WHERE id = $3`
	_, err := h.db.Exec(query, sentAt, time.Now().UTC(), id)
	return err
}

func (h *CommunicationHub) updateMessageFailure(id uuid.UUID, reason string) error {
	query := `UPDATE messages SET failed_at = $1, failure_reason = $2, updated_at = $3 WHERE id = $4`
	now := time.Now().UTC()
	_, err := h.db.Exec(query, &now, reason, now, id)
	return err
}

func (h *CommunicationHub) listMessages(status, channel, recipientID string, page, limit int) ([]*Message, int, error) {
	// Implementation for listing messages with filters
	return nil, 0, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getMessage(id uuid.UUID) (*Message, error) {
	// Implementation for getting a single message
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) retryMessage(id uuid.UUID) error {
	// Implementation for retrying a message
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) cancelMessage(id uuid.UUID) error {
	// Implementation for cancelling a message
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getMessageStats() (map[string]interface{}, error) {
	// Implementation for message statistics
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) saveConversation(conv *Conversation) error {
	// Implementation for saving conversation
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) listConversations(status, channel, assignedAgent string, page, limit int) ([]*Conversation, int, error) {
	// Implementation for listing conversations
	return nil, 0, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getConversation(id uuid.UUID) (*Conversation, error) {
	// Implementation for getting conversation
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) updateConversation(id uuid.UUID, req *UpdateConversationRequest) error {
	// Implementation for updating conversation
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getConversationMessages(id uuid.UUID, page, limit int) ([]*Message, int, error) {
	// Implementation for getting conversation messages
	return nil, 0, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendConversationMessage(id uuid.UUID, req *SendConversationMessageRequest) (*Message, error) {
	// Implementation for sending conversation message
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) assignAgent(id uuid.UUID, agentID uuid.UUID, agentName string) error {
	// Implementation for assigning agent
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) closeConversation(id uuid.UUID) error {
	// Implementation for closing conversation
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) saveTemplate(template *MessageTemplate) error {
	// Implementation for saving template
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) listTemplates(channel, language string, page, limit int) ([]*MessageTemplate, int, error) {
	// Implementation for listing templates
	return nil, 0, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getTemplate(id uuid.UUID) (*MessageTemplate, error) {
	// Implementation for getting template
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) updateTemplate(id uuid.UUID, req *UpdateTemplateRequest) error {
	// Implementation for updating template
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) deleteTemplate(id uuid.UUID) error {
	// Implementation for deleting template
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) previewTemplate(id uuid.UUID, variables map[string]string) (map[string]interface{}, error) {
	// Implementation for template preview
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendBulkSMS(req *BulkSMSRequest) (map[string]interface{}, error) {
	// Implementation for bulk SMS
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendBulkWhatsApp(req *BulkWhatsAppRequest) (map[string]interface{}, error) {
	// Implementation for bulk WhatsApp
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendBulkEmail(req *BulkEmailRequest) (map[string]interface{}, error) {
	// Implementation for bulk email
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendBulkNotifications(req *BulkNotificationRequest) (map[string]interface{}, error) {
	// Implementation for bulk notifications
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) processSMSWebhook(payload map[string]interface{}) error {
	// Implementation for SMS webhook processing
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) processWhatsAppWebhook(payload map[string]interface{}) error {
	// Implementation for WhatsApp webhook processing
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) processTelegramWebhook(payload map[string]interface{}) error {
	// Implementation for Telegram webhook processing
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) processEmailWebhook(payload map[string]interface{}) error {
	// Implementation for Email webhook processing
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendSMS(req *SendSMSRequest) (map[string]interface{}, error) {
	// Implementation for sending SMS
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendWhatsApp(req *SendWhatsAppRequest) (map[string]interface{}, error) {
	// Implementation for sending WhatsApp
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendTelegram(req *SendTelegramRequest) (map[string]interface{}, error) {
	// Implementation for sending Telegram
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) sendEmail(req *SendEmailRequest) (map[string]interface{}, error) {
	// Implementation for sending Email
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) makeVoiceCall(req *MakeVoiceCallRequest) (map[string]interface{}, error) {
	// Implementation for making voice calls
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getCustomerPreferences(customerID string) (map[string]interface{}, error) {
	// Implementation for getting customer preferences
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) updateCustomerPreferences(customerID string, req *CustomerPreferences) error {
	// Implementation for updating customer preferences
	return fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getDeliveryRates() (map[string]interface{}, error) {
	// Implementation for delivery rates analytics
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getChannelPerformance() (map[string]interface{}, error) {
	// Implementation for channel performance analytics
	return nil, fmt.Errorf("not implemented")
}

func (h *CommunicationHub) getCustomerEngagement() (map[string]interface{}, error) {
	// Implementation for customer engagement analytics
	return nil, fmt.Errorf("not implemented")
}

// Utility functions
func isValidChannel(channel MessageChannel) bool {
	validChannels := []MessageChannel{
		ChannelSMS, ChannelWhatsApp, ChannelTelegram, ChannelEmail, ChannelVoice,
	}
	for _, valid := range validChannels {
		if channel == valid {
			return true
		}
	}
	return false
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// Request/Response types
type SendMessageRequest struct {
	Channel        MessageChannel  `json:"channel" binding:"required"`
	Priority       MessagePriority `json:"priority"`
	SenderID       string          `json:"sender_id" binding:"required"`
	SenderType     string          `json:"sender_type" binding:"required"`
	RecipientID    string          `json:"recipient_id" binding:"required"`
	RecipientType  string          `json:"recipient_type" binding:"required"`
	RecipientPhone string          `json:"recipient_phone"`
	RecipientEmail string          `json:"recipient_email"`
	Subject        string          `json:"subject"`
	Content        string          `json:"content" binding:"required"`
	ContentType    string          `json:"content_type"`
	TemplateID     *uuid.UUID      `json:"template_id"`
	TemplateVariables json.RawMessage `json:"template_variables"`
	Language       string          `json:"language"`
	ScheduledAt    *time.Time      `json:"scheduled_at"`
	MaxRetries     int             `json:"max_retries"`
	Metadata       json.RawMessage `json:"metadata"`
}

type CreateConversationRequest struct {
	CustomerID    uuid.UUID      `json:"customer_id" binding:"required"`
	CustomerName  string         `json:"customer_name" binding:"required"`
	CustomerPhone string         `json:"customer_phone" binding:"required"`
	CustomerEmail string         `json:"customer_email"`
	Channel       MessageChannel `json:"channel" binding:"required"`
	Priority      string         `json:"priority"`
	Language      string         `json:"language"`
	Tags          []string       `json:"tags"`
	Metadata      json.RawMessage `json:"metadata"`
}

type UpdateConversationRequest struct {
	Status   string   `json:"status"`
	Priority string   `json:"priority"`
	Tags     []string `json:"tags"`
	Metadata json.RawMessage `json:"metadata"`
}

type SendConversationMessageRequest struct {
	SenderID    string `json:"sender_id" binding:"required"`
	SenderType  string `json:"sender_type" binding:"required"`
	Content     string `json:"content" binding:"required"`
	ContentType string `json:"content_type"`
}

type AssignAgentRequest struct {
	AgentID   uuid.UUID `json:"agent_id" binding:"required"`
	AgentName string    `json:"agent_name" binding:"required"`
}

type CreateTemplateRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description string         `json:"description"`
	Channel     MessageChannel `json:"channel" binding:"required"`
	Language    string         `json:"language" binding:"required"`
	Subject     string         `json:"subject"`
	Content     string         `json:"content" binding:"required"`
	ContentType string         `json:"content_type"`
	Variables   []string       `json:"variables"`
	CreatedBy   uuid.UUID      `json:"created_by" binding:"required"`
}

type UpdateTemplateRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Subject     string   `json:"subject"`
	Content     string   `json:"content"`
	ContentType string   `json:"content_type"`
	Variables   []string `json:"variables"`
	IsActive    *bool    `json:"is_active"`
}

type PreviewTemplateRequest struct {
	Variables map[string]string `json:"variables"`
}

type BulkSMSRequest struct {
	Recipients []string `json:"recipients" binding:"required"`
	Content    string   `json:"content" binding:"required"`
	SenderID   string   `json:"sender_id"`
	TemplateID *uuid.UUID `json:"template_id"`
}

type BulkWhatsAppRequest struct {
	Recipients []string `json:"recipients" binding:"required"`
	Content    string   `json:"content" binding:"required"`
	TemplateID *uuid.UUID `json:"template_id"`
}

type BulkEmailRequest struct {
	Recipients []string `json:"recipients" binding:"required"`
	Subject    string   `json:"subject" binding:"required"`
	Content    string   `json:"content" binding:"required"`
	TemplateID *uuid.UUID `json:"template_id"`
}

type BulkNotificationRequest struct {
	CustomerIDs []string       `json:"customer_ids" binding:"required"`
	Channels    []MessageChannel `json:"channels" binding:"required"`
	Content     string         `json:"content" binding:"required"`
	TemplateID  *uuid.UUID     `json:"template_id"`
	Priority    MessagePriority `json:"priority"`
}

type SendSMSRequest struct {
	To         []string `json:"to" binding:"required"`
	Message    string   `json:"message" binding:"required"`
	SenderID   string   `json:"sender_id"`
	TemplateID *uuid.UUID `json:"template_id"`
}

type SendWhatsAppRequest struct {
	To         []string `json:"to" binding:"required"`
	Message    string   `json:"message" binding:"required"`
	TemplateID *uuid.UUID `json:"template_id"`
}

type SendTelegramRequest struct {
	ChatIDs   []string `json:"chat_ids" binding:"required"`
	Message   string   `json:"message" binding:"required"`
	ParseMode string   `json:"parse_mode"`
}

type SendEmailRequest struct {
	To          []string `json:"to" binding:"required"`
	Subject     string   `json:"subject" binding:"required"`
	Content     string   `json:"content" binding:"required"`
	ContentType string   `json:"content_type"`
	TemplateID  *uuid.UUID `json:"template_id"`
}

type MakeVoiceCallRequest struct {
	To       string `json:"to" binding:"required"`
	Message  string `json:"message" binding:"required"`
	Language string `json:"language"`
}

type CustomerPreferences struct {
	PreferredChannel   MessageChannel `json:"preferred_channel"`
	PreferredLanguage  string         `json:"preferred_language"`
	SMSOptIn           bool           `json:"sms_opt_in"`
	WhatsAppOptIn      bool           `json:"whatsapp_opt_in"`
	TelegramOptIn      bool           `json:"telegram_opt_in"`
	EmailOptIn         bool           `json:"email_opt_in"`
	VoiceOptIn         bool           `json:"voice_opt_in"`
	MarketingOptIn     bool           `json:"marketing_opt_in"`
	NotificationOptIn  bool           `json:"notification_opt_in"`
	QuietHoursStart    string         `json:"quiet_hours_start"`
	QuietHoursEnd      string         `json:"quiet_hours_end"`
	Timezone           string         `json:"timezone"`
}
