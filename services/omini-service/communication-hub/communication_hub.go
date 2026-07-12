package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
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
	messagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "communication_hub_messages_total",
			Help: "Total messages processed by channel",
		},
		[]string{"channel", "direction", "status"},
	)

	messageLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "communication_hub_message_latency_seconds",
			Help:    "Message processing latency",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"channel"},
	)

	activeConnections = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "communication_hub_active_connections",
			Help: "Active connections by channel",
		},
		[]string{"channel"},
	)

	channelHealth = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "communication_hub_channel_health",
			Help: "Channel health status (1=healthy, 0=unhealthy)",
		},
		[]string{"channel"},
	)
)

type Channel string

const (
	ChannelWhatsApp Channel = "whatsapp"
	ChannelUSSD     Channel = "ussd"
	ChannelSMS      Channel = "sms"
	ChannelTelegram Channel = "telegram"
)

type MessageDirection string

const (
	DirectionInbound  MessageDirection = "inbound"
	DirectionOutbound MessageDirection = "outbound"
)

type MessageType string

const (
	TypeText        MessageType = "text"
	TypeImage       MessageType = "image"
	TypeDocument    MessageType = "document"
	TypeAudio       MessageType = "audio"
	TypeVideo       MessageType = "video"
	TypeLocation    MessageType = "location"
	TypeContact     MessageType = "contact"
	TypeInteractive MessageType = "interactive"
)

type Message struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Channel     Channel                `json:"channel"`
	Direction   MessageDirection       `json:"direction"`
	Type        MessageType            `json:"type"`
	From        string                 `json:"from"`
	To          string                 `json:"to"`
	Content     string                 `json:"content"`
	Metadata    map[string]interface{} `json:"metadata"`
	Timestamp   time.Time              `json:"timestamp"`
	Status      string                 `json:"status"`
	CustomerID  string                 `json:"customer_id,omitempty"`
	SessionID   string                 `json:"session_id,omitempty"`
	ReplyTo     string                 `json:"reply_to,omitempty"`
	Attachments []Attachment           `json:"attachments,omitempty"`
}

type Attachment struct {
	Type     string `json:"type"`
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	Size     int64  `json:"size"`
	Caption  string `json:"caption,omitempty"`
}

type SendMessageRequest struct {
	TenantID    string                 `json:"tenant_id"`
	Channel     Channel                `json:"channel"`
	To          string                 `json:"to"`
	Content     string                 `json:"content"`
	Type        MessageType            `json:"type"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	TemplateID  string                 `json:"template_id,omitempty"`
	Attachments []Attachment           `json:"attachments,omitempty"`
}

type SendMessageResponse struct {
	MessageID string `json:"message_id"`
	Status    string `json:"status"`
	Channel   string `json:"channel"`
	Timestamp string `json:"timestamp"`
}

type ChannelConfig struct {
	Channel     Channel                `json:"channel"`
	Enabled     bool                   `json:"enabled"`
	Priority    int                    `json:"priority"`
	RateLimit   int                    `json:"rate_limit"`
	Credentials map[string]string      `json:"credentials"`
	Settings    map[string]interface{} `json:"settings"`
}

type CommunicationHub struct {
	db            *pgxpool.Pool
	redis         *redis.Client
	kafkaProducer *kafka.Producer
	kafkaConsumer *kafka.Consumer
	httpClient    *http.Client

	whatsappURL string
	ussdURL     string
	smsURL      string
	telegramURL string

	keycloakURL  string
	permifyURL   string
	lakehouseURL string
	fluvioURL    string
	temporalHost string
	daprURL      string

	channelConfigs map[Channel]*ChannelConfig
	configMutex    sync.RWMutex

	rateLimiters map[Channel]*RateLimiter
	circuits     map[Channel]*CircuitBreaker
}

type HubConfig struct {
	PostgresURL  string
	RedisURL     string
	KafkaBrokers string
	WhatsAppURL  string
	USSDURL      string
	SMSURL       string
	TelegramURL  string
	KeycloakURL  string
	PermifyURL   string
	LakehouseURL string
	FluvioURL    string
	TemporalHost string
	DaprURL      string
}

func NewCommunicationHub(cfg *HubConfig) (*CommunicationHub, error) {
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
		"client.id":         "communication-hub",
		"acks":              "all",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka producer: %w", err)
	}

	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": cfg.KafkaBrokers,
		"group.id":          "communication-hub-consumer",
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka consumer: %w", err)
	}

	hub := &CommunicationHub{
		db:             db,
		redis:          redisClient,
		kafkaProducer:  producer,
		kafkaConsumer:  consumer,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
		whatsappURL:    cfg.WhatsAppURL,
		ussdURL:        cfg.USSDURL,
		smsURL:         cfg.SMSURL,
		telegramURL:    cfg.TelegramURL,
		keycloakURL:    cfg.KeycloakURL,
		permifyURL:     cfg.PermifyURL,
		lakehouseURL:   cfg.LakehouseURL,
		fluvioURL:      cfg.FluvioURL,
		temporalHost:   cfg.TemporalHost,
		daprURL:        cfg.DaprURL,
		channelConfigs: make(map[Channel]*ChannelConfig),
		rateLimiters:   make(map[Channel]*RateLimiter),
		circuits:       make(map[Channel]*CircuitBreaker),
	}

	hub.initializeChannels()

	// Load saved configurations from database
	if err := hub.loadChannelConfigs(ctx); err != nil {
		// Log error but don't fail - will use defaults
		fmt.Printf("Warning: failed to load channel configs: %v\n", err)
	}

	return hub, nil
}

func (h *CommunicationHub) initializeChannels() {
	channels := []Channel{ChannelWhatsApp, ChannelUSSD, ChannelSMS, ChannelTelegram}

	for _, ch := range channels {
		h.channelConfigs[ch] = &ChannelConfig{
			Channel:   ch,
			Enabled:   true,
			Priority:  1,
			RateLimit: 1000,
		}

		h.rateLimiters[ch] = &RateLimiter{
			redis:  h.redis,
			prefix: fmt.Sprintf("ratelimit:%s", ch),
		}

		h.circuits[ch] = &CircuitBreaker{
			redis:       h.redis,
			name:        string(ch),
			threshold:   5,
			timeout:     30 * time.Second,
			halfOpenMax: 3,
		}

		channelHealth.WithLabelValues(string(ch)).Set(1)
	}
}

func (h *CommunicationHub) loadChannelConfigs(ctx context.Context) error {
	rows, err := h.db.Query(ctx, `
		SELECT channel, enabled, priority, rate_limit, credentials, settings
		FROM channel_configs
		WHERE tenant_id = $1
	`, "default")

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var channel string
		var enabled bool
		var priority, rateLimit int
		var credentials, settings []byte

		err := rows.Scan(&channel, &enabled, &priority, &rateLimit, &credentials, &settings)
		if err != nil {
			continue
		}

		config := &ChannelConfig{
			Channel:     Channel(channel),
			Enabled:     enabled,
			Priority:    priority,
			RateLimit:   rateLimit,
			Credentials: make(map[string]string),
			Settings:    make(map[string]interface{}),
		}

		json.Unmarshal(credentials, &config.Credentials)
		json.Unmarshal(settings, &config.Settings)

		h.channelConfigs[Channel(channel)] = config
	}

	return nil
}

func (h *CommunicationHub) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
	start := time.Now()
	defer func() {
		messageLatency.WithLabelValues(string(req.Channel)).Observe(time.Since(start).Seconds())
	}()

	config := h.getChannelConfig(req.Channel)
	if config == nil || !config.Enabled {
		return nil, fmt.Errorf("channel %s is not enabled", req.Channel)
	}

	allowed, err := h.rateLimiters[req.Channel].Allow(ctx, req.To, config.RateLimit, time.Minute)
	if err != nil || !allowed {
		messagesTotal.WithLabelValues(string(req.Channel), "outbound", "rate_limited").Inc()
		return nil, fmt.Errorf("rate limit exceeded for %s", req.To)
	}

	msg := &Message{
		ID:        generateMessageID(),
		TenantID:  req.TenantID,
		Channel:   req.Channel,
		Direction: DirectionOutbound,
		Type:      req.Type,
		To:        req.To,
		Content:   req.Content,
		Metadata:  req.Metadata,
		Timestamp: time.Now(),
		Status:    "pending",
	}

	var sendErr error
	err = h.circuits[req.Channel].Execute(ctx, func() error {
		sendErr = h.sendToChannel(ctx, msg)
		return sendErr
	})

	if err != nil {
		messagesTotal.WithLabelValues(string(req.Channel), "outbound", "failed").Inc()
		msg.Status = "failed"
		h.recordMessage(ctx, msg)
		return nil, err
	}

	msg.Status = "sent"
	messagesTotal.WithLabelValues(string(req.Channel), "outbound", "success").Inc()

	h.recordMessage(ctx, msg)
	h.publishEvent(ctx, "communication.message.sent", msg)
	h.recordToLakehouse(ctx, msg)
	h.recordBilling(ctx, msg)

	return &SendMessageResponse{
		MessageID: msg.ID,
		Status:    msg.Status,
		Channel:   string(msg.Channel),
		Timestamp: msg.Timestamp.Format(time.RFC3339),
	}, nil
}

func (h *CommunicationHub) sendToChannel(ctx context.Context, msg *Message) error {
	config := h.getChannelConfig(msg.Channel)
	if config == nil {
		return fmt.Errorf("channel config not found: %s", msg.Channel)
	}

	// Direct Africa's Talking integration
	switch msg.Channel {
	case ChannelSMS:
		return h.sendSMS(ctx, msg, config)
	case ChannelWhatsApp:
		return h.sendWhatsApp(ctx, msg, config)
	case ChannelUSSD:
		// USSD is callback-based, not direct send
		return fmt.Errorf("USSD does not support direct send - it's callback-based")
	case ChannelTelegram:
		return h.sendTelegram(ctx, msg, config)
	default:
		return fmt.Errorf("unknown channel: %s", msg.Channel)
	}
}

func (h *CommunicationHub) sendSMS(ctx context.Context, msg *Message, config *ChannelConfig) error {
	apiKey := config.Credentials["api_key"]
	username := config.Credentials["username"]
	senderId := config.Credentials["sender_id"]
	environment := config.Credentials["environment"]

	if apiKey == "" || username == "" {
		return fmt.Errorf("SMS credentials not configured")
	}

	// Africa's Talking SMS API
	apiURL := "https://api.africastalking.com/version1/messaging"
	if environment == "sandbox" {
		apiURL = "https://api.sandbox.africastalking.com/version1/messaging"
	}

	// Properly URL-encode the form data
	data := url.Values{}
	data.Set("username", username)
	data.Set("to", msg.To)
	data.Set("message", msg.Content)

	// Only set sender ID in production mode, not in sandbox
	if environment != "sandbox" && senderId != "" {
		data.Set("from", senderId)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("apiKey", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("SMS API error %d: %s", resp.StatusCode, string(body))
	}

	// Log successful response
	fmt.Printf("[SMS] API Response (%d): %s\n", resp.StatusCode, string(body))

	return nil
}

func (h *CommunicationHub) sendWhatsApp(ctx context.Context, msg *Message, config *ChannelConfig) error {
	provider := config.Credentials["provider"]
	if provider == "" {
		provider = "meta" // Default to Meta Cloud API
	}

	switch provider {
	case "meta", "facebook":
		return h.sendWhatsAppMeta(ctx, msg, config)
	case "africas_talking":
		return h.sendWhatsAppAfricasTalking(ctx, msg, config)
	default:
		return fmt.Errorf("unsupported WhatsApp provider: %s", provider)
	}
}

// sendWhatsAppMeta sends WhatsApp message via Meta Cloud API (Free & Official)
func (h *CommunicationHub) sendWhatsAppMeta(ctx context.Context, msg *Message, config *ChannelConfig) error {
	accessToken := config.Credentials["access_token"]
	phoneNumberID := config.Credentials["phone_number_id"]

	if accessToken == "" || phoneNumberID == "" {
		return fmt.Errorf("WhatsApp Meta credentials not configured (access_token, phone_number_id required)")
	}

	// Meta Cloud API endpoint
	apiURL := fmt.Sprintf("https://graph.facebook.com/v18.0/%s/messages", phoneNumberID)

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                msg.To,
		"type":              "text",
		"text": map[string]interface{}{
			"body": msg.Content,
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	fmt.Printf("[WhatsApp] Sending via Meta Cloud API to %s\n", msg.To)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		fmt.Printf("[WhatsApp] Meta API error %d: %s\n", resp.StatusCode, string(responseBody))
		return fmt.Errorf("WhatsApp Meta API error %d: %s", resp.StatusCode, string(responseBody))
	}

	fmt.Printf("[WhatsApp] Meta API response: %s\n", string(responseBody))
	return nil
}

// sendWhatsAppAfricasTalking sends WhatsApp message via Africa's Talking
func (h *CommunicationHub) sendWhatsAppAfricasTalking(ctx context.Context, msg *Message, config *ChannelConfig) error {
	apiKey := config.Credentials["api_key"]
	username := config.Credentials["username"]
	waNumber := config.Credentials["wa_number"]

	if apiKey == "" || username == "" || waNumber == "" {
		return fmt.Errorf("WhatsApp Africa's Talking credentials not configured")
	}

	// Africa's Talking WhatsApp API
	apiURL := "https://chat.africastalking.com/whatsapp/message/send"
	if config.Credentials["environment"] == "sandbox" {
		apiURL = "https://chat.sandbox.africastalking.com/whatsapp/message/send"
	}

	payload := map[string]interface{}{
		"username":    username,
		"phoneNumber": msg.To,
		"message":     msg.Content,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apiKey", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("WhatsApp API error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (h *CommunicationHub) sendTelegram(ctx context.Context, msg *Message, config *ChannelConfig) error {
	botToken := config.Credentials["bot_token"]
	if botToken == "" {
		return fmt.Errorf("Telegram bot token not configured")
	}

	// Telegram Bot API
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	payload := map[string]interface{}{
		"chat_id": msg.To,
		"text":    msg.Content,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Telegram API error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// Legacy method - fallback to downstream services
func (h *CommunicationHub) sendToChannelService(ctx context.Context, msg *Message) error {
	var url string
	switch msg.Channel {
	case ChannelWhatsApp:
		url = h.whatsappURL + "/whatsapp/send"
	case ChannelUSSD:
		url = h.ussdURL + "/ussd/send"
	case ChannelSMS:
		url = h.smsURL + "/sms/send"
	case ChannelTelegram:
		url = h.telegramURL + "/telegram/send"
	default:
		return fmt.Errorf("unknown channel: %s", msg.Channel)
	}

	body, _ := json.Marshal(msg)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", msg.TenantID)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("channel returned error: %s", string(body))
	}

	return nil
}

func (h *CommunicationHub) ReceiveMessage(ctx context.Context, msg *Message) error {
	start := time.Now()
	defer func() {
		messageLatency.WithLabelValues(string(msg.Channel)).Observe(time.Since(start).Seconds())
	}()

	msg.Direction = DirectionInbound
	msg.Timestamp = time.Now()
	msg.Status = "received"

	messagesTotal.WithLabelValues(string(msg.Channel), "inbound", "success").Inc()

	h.recordMessage(ctx, msg)
	h.publishEvent(ctx, "communication.message.received", msg)
	h.recordToLakehouse(ctx, msg)

	return nil
}

func (h *CommunicationHub) BroadcastMessage(ctx context.Context, tenantID string, channels []Channel, recipients []string, content string, msgType MessageType) ([]SendMessageResponse, error) {
	var responses []SendMessageResponse
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, recipient := range recipients {
		for _, channel := range channels {
			wg.Add(1)
			go func(ch Channel, to string) {
				defer wg.Done()

				resp, err := h.SendMessage(ctx, &SendMessageRequest{
					TenantID: tenantID,
					Channel:  ch,
					To:       to,
					Content:  content,
					Type:     msgType,
				})

				if err == nil && resp != nil {
					mu.Lock()
					responses = append(responses, *resp)
					mu.Unlock()
				}
			}(channel, recipient)
		}
	}

	wg.Wait()
	return responses, nil
}

func (h *CommunicationHub) GetConversation(ctx context.Context, tenantID, customerID string, channel Channel, limit int) ([]Message, error) {
	cacheKey := fmt.Sprintf("conversation:%s:%s:%s", tenantID, customerID, channel)

	cached, err := h.redis.Get(ctx, cacheKey).Bytes()
	if err == nil {
		var messages []Message
		if json.Unmarshal(cached, &messages) == nil {
			return messages, nil
		}
	}

	rows, err := h.db.Query(ctx, `
		SELECT id, tenant_id, channel, direction, type, "from", "to", content, metadata, timestamp, status, customer_id, session_id
		FROM messages
		WHERE tenant_id = $1 AND customer_id = $2 AND channel = $3
		ORDER BY timestamp DESC
		LIMIT $4
	`, tenantID, customerID, channel, limit)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var metadata []byte
		err := rows.Scan(&msg.ID, &msg.TenantID, &msg.Channel, &msg.Direction, &msg.Type,
			&msg.From, &msg.To, &msg.Content, &metadata, &msg.Timestamp, &msg.Status,
			&msg.CustomerID, &msg.SessionID)
		if err != nil {
			continue
		}
		json.Unmarshal(metadata, &msg.Metadata)
		messages = append(messages, msg)
	}

	data, _ := json.Marshal(messages)
	h.redis.Set(ctx, cacheKey, data, 5*time.Minute)

	return messages, nil
}

func (h *CommunicationHub) GetMessages(ctx context.Context, tenantID string, channel Channel, from, to time.Time) ([]Message, error) {
	query := `
		SELECT id, tenant_id, channel, direction, type, "from", "to", content, 
		       metadata, timestamp, status, customer_id, session_id
		FROM messages
		WHERE tenant_id = $1 AND timestamp BETWEEN $2 AND $3
	`
	args := []interface{}{tenantID, from, to}

	if channel != "" {
		query += " AND channel = $4"
		args = append(args, channel)
	}

	query += " ORDER BY timestamp DESC LIMIT 100"

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var metadata []byte
		err := rows.Scan(&msg.ID, &msg.TenantID, &msg.Channel, &msg.Direction, &msg.Type,
			&msg.From, &msg.To, &msg.Content, &metadata, &msg.Timestamp, &msg.Status,
			&msg.CustomerID, &msg.SessionID)
		if err != nil {
			continue
		}
		json.Unmarshal(metadata, &msg.Metadata)
		messages = append(messages, msg)
	}

	return messages, nil
}

func (h *CommunicationHub) GetChannelStats(ctx context.Context, tenantID string, channel Channel, from, to time.Time) (map[string]interface{}, error) {
	var totalSent, totalReceived, totalFailed int64
	var avgLatency sql.NullFloat64

	err := h.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'sent'),
			COUNT(*) FILTER (WHERE direction = 'inbound'),
			COUNT(*) FILTER (WHERE status = 'failed'),
			COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status = 'sent'), 0)
		FROM messages
		WHERE tenant_id = $1 AND channel = $2 AND timestamp BETWEEN $3 AND $4
	`, tenantID, channel, from, to).Scan(&totalSent, &totalReceived, &totalFailed, &avgLatency)

	if err != nil {
		return nil, err
	}

	latencyMs := 0.0
	if avgLatency.Valid {
		latencyMs = avgLatency.Float64 * 1000
	}

	successRate := 0.0
	if totalSent+totalFailed > 0 {
		successRate = float64(totalSent) / float64(totalSent+totalFailed) * 100
	}

	return map[string]interface{}{
		"channel":        channel,
		"total_sent":     totalSent,
		"total_received": totalReceived,
		"total_failed":   totalFailed,
		"avg_latency_ms": latencyMs,
		"success_rate":   successRate,
		"period_start":   from,
		"period_end":     to,
	}, nil
}

func (h *CommunicationHub) UpdateChannelConfig(ctx context.Context, tenantID string, config *ChannelConfig) error {
	h.configMutex.Lock()
	defer h.configMutex.Unlock()

	// Update in-memory config
	h.channelConfigs[config.Channel] = config

	// Persist to database
	credentials, _ := json.Marshal(config.Credentials)
	settings, _ := json.Marshal(config.Settings)

	_, err := h.db.Exec(ctx, `
		INSERT INTO channel_configs (tenant_id, channel, enabled, priority, rate_limit, credentials, settings)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, channel) 
		DO UPDATE SET 
			enabled = EXCLUDED.enabled,
			priority = EXCLUDED.priority,
			rate_limit = EXCLUDED.rate_limit,
			credentials = EXCLUDED.credentials,
			settings = EXCLUDED.settings,
			updated_at = CURRENT_TIMESTAMP
	`, tenantID, config.Channel, config.Enabled, config.Priority, config.RateLimit, credentials, settings)

	if err != nil {
		return fmt.Errorf("failed to save channel config: %w", err)
	}

	if config.Enabled {
		channelHealth.WithLabelValues(string(config.Channel)).Set(1)
	} else {
		channelHealth.WithLabelValues(string(config.Channel)).Set(0)
	}

	h.publishEvent(ctx, "communication.channel.config_updated", map[string]interface{}{
		"tenant_id": tenantID,
		"channel":   config.Channel,
		"enabled":   config.Enabled,
	})

	return nil
}

func (h *CommunicationHub) getChannelConfig(channel Channel) *ChannelConfig {
	h.configMutex.RLock()
	defer h.configMutex.RUnlock()
	return h.channelConfigs[channel]
}

func (h *CommunicationHub) recordMessage(ctx context.Context, msg *Message) {
	metadata, _ := json.Marshal(msg.Metadata)

	h.db.Exec(ctx, `
		INSERT INTO messages (id, tenant_id, channel, direction, type, "from", "to", content, metadata, timestamp, status, customer_id, session_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, msg.ID, msg.TenantID, msg.Channel, msg.Direction, msg.Type, msg.From, msg.To, msg.Content, metadata, msg.Timestamp, msg.Status, msg.CustomerID, msg.SessionID)
}

func (h *CommunicationHub) publishEvent(ctx context.Context, topic string, data interface{}) {
	payload, _ := json.Marshal(data)

	h.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          payload,
	}, nil)

	if h.daprURL != "" {
		daprURL := fmt.Sprintf("%s/v1.0/publish/communication-pubsub/%s", h.daprURL, topic)
		req, _ := http.NewRequestWithContext(ctx, "POST", daprURL, bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		h.httpClient.Do(req)
	}
}

func (h *CommunicationHub) recordToLakehouse(ctx context.Context, msg *Message) {
	event := map[string]interface{}{
		"event_type":  "message",
		"message_id":  msg.ID,
		"tenant_id":   msg.TenantID,
		"channel":     msg.Channel,
		"direction":   msg.Direction,
		"type":        msg.Type,
		"from":        msg.From,
		"to":          msg.To,
		"status":      msg.Status,
		"customer_id": msg.CustomerID,
		"timestamp":   msg.Timestamp,
	}

	topic := "lakehouse.communication.events"
	payload, _ := json.Marshal(event)

	h.kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          payload,
	}, nil)
}

func (h *CommunicationHub) recordBilling(ctx context.Context, msg *Message) {
	var cost float64
	switch msg.Channel {
	case ChannelWhatsApp:
		cost = 0.05
	case ChannelSMS:
		cost = 0.02
	case ChannelUSSD:
		cost = 0.01
	case ChannelTelegram:
		cost = 0.00
	}

	if cost > 0 {
		billingEvent := map[string]interface{}{
			"tenant_id":  msg.TenantID,
			"channel":    msg.Channel,
			"message_id": msg.ID,
			"cost":       cost,
			"currency":   "NGN",
			"timestamp":  time.Now(),
		}

		topic := "billing.communication.charges"
		payload, _ := json.Marshal(billingEvent)

		h.kafkaProducer.Produce(&kafka.Message{
			TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
			Value:          payload,
		}, nil)
	}
}

func (h *CommunicationHub) HealthCheck(ctx context.Context) map[string]interface{} {
	health := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now(),
		"channels":  make(map[string]interface{}),
	}

	channels := []struct {
		name Channel
		url  string
	}{
		{ChannelWhatsApp, h.whatsappURL},
		{ChannelUSSD, h.ussdURL},
		{ChannelSMS, h.smsURL},
		{ChannelTelegram, h.telegramURL},
	}

	for _, ch := range channels {
		status := "healthy"
		if ch.url != "" {
			resp, err := h.httpClient.Get(ch.url + "/health")
			if err != nil || resp.StatusCode >= 400 {
				status = "unhealthy"
				channelHealth.WithLabelValues(string(ch.name)).Set(0)
			} else {
				channelHealth.WithLabelValues(string(ch.name)).Set(1)
			}
			if resp != nil {
				resp.Body.Close()
			}
		}

		health["channels"].(map[string]interface{})[string(ch.name)] = map[string]interface{}{
			"status":  status,
			"enabled": h.channelConfigs[ch.name].Enabled,
		}
	}

	if err := h.redis.Ping(ctx).Err(); err != nil {
		health["redis"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		health["redis"] = "healthy"
	}

	if err := h.db.Ping(ctx); err != nil {
		health["postgres"] = "unhealthy"
		health["status"] = "degraded"
	} else {
		health["postgres"] = "healthy"
	}

	return health
}

func (h *CommunicationHub) Close() {
	h.db.Close()
	h.redis.Close()
	h.kafkaProducer.Close()
	h.kafkaConsumer.Close()
}

func generateMessageID() string {
	return fmt.Sprintf("msg_%d", time.Now().UnixNano())
}

type RateLimiter struct {
	redis  *redis.Client
	prefix string
}

func (r *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	fullKey := fmt.Sprintf("%s:%s", r.prefix, key)

	pipe := r.redis.Pipeline()
	incr := pipe.Incr(ctx, fullKey)
	pipe.Expire(ctx, fullKey, window)
	_, err := pipe.Exec(ctx)

	if err != nil {
		return false, err
	}

	return incr.Val() <= int64(limit), nil
}

type CircuitBreaker struct {
	redis       *redis.Client
	name        string
	threshold   int
	timeout     time.Duration
	halfOpenMax int
}

func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	state, _ := cb.getState(ctx)

	if state == "open" {
		openTime, _ := cb.getOpenTime(ctx)
		if time.Since(openTime) > cb.timeout {
			cb.setState(ctx, "half-open")
		} else {
			return fmt.Errorf("circuit breaker is open")
		}
	}

	err := fn()

	if err != nil {
		cb.recordFailure(ctx)
		failures, _ := cb.getFailures(ctx)
		if failures >= cb.threshold {
			cb.setState(ctx, "open")
			cb.setOpenTime(ctx, time.Now())
		}
		return err
	}

	if state == "half-open" {
		cb.setState(ctx, "closed")
		cb.resetFailures(ctx)
	}

	return nil
}

func (cb *CircuitBreaker) getState(ctx context.Context) (string, error) {
	state, err := cb.redis.Get(ctx, fmt.Sprintf("cb:%s:state", cb.name)).Result()
	if err == redis.Nil {
		return "closed", nil
	}
	return state, err
}

func (cb *CircuitBreaker) setState(ctx context.Context, state string) error {
	return cb.redis.Set(ctx, fmt.Sprintf("cb:%s:state", cb.name), state, 0).Err()
}

func (cb *CircuitBreaker) getOpenTime(ctx context.Context) (time.Time, error) {
	ts, err := cb.redis.Get(ctx, fmt.Sprintf("cb:%s:open_time", cb.name)).Int64()
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(ts, 0), nil
}

func (cb *CircuitBreaker) setOpenTime(ctx context.Context, t time.Time) error {
	return cb.redis.Set(ctx, fmt.Sprintf("cb:%s:open_time", cb.name), t.Unix(), 0).Err()
}

func (cb *CircuitBreaker) getFailures(ctx context.Context) (int, error) {
	return cb.redis.Get(ctx, fmt.Sprintf("cb:%s:failures", cb.name)).Int()
}

func (cb *CircuitBreaker) recordFailure(ctx context.Context) error {
	return cb.redis.Incr(ctx, fmt.Sprintf("cb:%s:failures", cb.name)).Err()
}

func (cb *CircuitBreaker) resetFailures(ctx context.Context) error {
	return cb.redis.Del(ctx, fmt.Sprintf("cb:%s:failures", cb.name)).Err()
}

// parseUSSDInput parses USSD input text into steps
// Africa's Talking sends input as "1*2*3" for menu selections
func parseUSSDInput(text string) []string {
	if text == "" {
		return []string{}
	}
	// Split by '*' which is the USSD separator
	inputs := []string{}
	current := ""
	for _, char := range text {
		if char == '*' {
			if current != "" {
				inputs = append(inputs, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		inputs = append(inputs, current)
	}
	return inputs
}

// identifyUserFromUSSD identifies the tenant and customer from USSD callback data
// Returns tenantID and customerID
func (h *CommunicationHub) identifyUserFromUSSD(ctx context.Context, serviceCode, phoneNumber string) (string, string) {
	var tenantID, customerID string

	// Option 1: Look up tenant by service code in channel_configs
	// Each tenant configures their own USSD service code in settings
	err := h.db.QueryRow(ctx, `
		SELECT tenant_id 
		FROM channel_configs 
		WHERE channel = 'ussd' 
		  AND enabled = true
		  AND (settings->>'service_code' = $1 OR settings->>'service_code' IS NULL)
		LIMIT 1
	`, serviceCode).Scan(&tenantID)

	if err != nil {
		// Fallback: use default tenant or extract from service code
		// You could map service codes like: *123*1# -> tenant1, *123*2# -> tenant2
		tenantID = "default"
	}

	// Option 2: Look up customer by phone number from your accounts database
	// This queries the conversations table first for existing mappings
	err = h.db.QueryRow(ctx, `
		SELECT customer_id 
		FROM conversations 
		WHERE tenant_id = $1 
		  AND phone_number = $2 
		  AND channel = 'ussd'
		  AND is_active = true
		ORDER BY last_activity DESC
		LIMIT 1
	`, tenantID, phoneNumber).Scan(&customerID)

	if err != nil {
		// Customer not found in conversations
		// You should integrate with your customer/account service here
		// For now, use phone number as customer_id
		customerID = phoneNumber
	}

	return tenantID, customerID
}

// identifyUserFromSMS identifies the tenant and customer from SMS callback data
// Returns tenantID and customerID
func (h *CommunicationHub) identifyUserFromSMS(ctx context.Context, shortcode, phoneNumber string) (string, string) {
	var tenantID, customerID string

	// Option 1: Look up tenant by shortcode/sender number
	// Each tenant may have their own SMS shortcode or sender ID
	err := h.db.QueryRow(ctx, `
		SELECT tenant_id 
		FROM channel_configs 
		WHERE channel = 'sms' 
		  AND enabled = true
		  AND (credentials->>'shortcode' = $1 
		       OR credentials->>'phone_number' = $1 
		       OR credentials->>'sender_id' = $1)
		LIMIT 1
	`, shortcode).Scan(&tenantID)

	if err != nil {
		// Fallback: use default tenant
		tenantID = "default"
	}

	// Option 2: Look up customer by phone number
	err = h.db.QueryRow(ctx, `
		SELECT customer_id 
		FROM conversations 
		WHERE tenant_id = $1 
		  AND phone_number = $2 
		  AND channel = 'sms'
		  AND is_active = true
		ORDER BY last_activity DESC
		LIMIT 1
	`, tenantID, phoneNumber).Scan(&customerID)

	if err != nil {
		// Customer not found - use phone number as customer_id
		customerID = phoneNumber
	}

	return tenantID, customerID
}

// identifyUserFromWhatsApp identifies tenant and customer from WhatsApp number and sender phone
func (h *CommunicationHub) identifyUserFromWhatsApp(ctx context.Context, waNumber, phoneNumber string) (string, string) {
	var tenantID, customerID string

	// Option 1: Look up tenant by WhatsApp number
	// Each tenant may have their own WhatsApp Business number
	err := h.db.QueryRow(ctx, `
		SELECT tenant_id 
		FROM channel_configs 
		WHERE channel = 'whatsapp' 
		  AND enabled = true
		  AND (credentials->>'wa_number' = $1 
		       OR credentials->>'phone_number' = $1)
		LIMIT 1
	`, waNumber).Scan(&tenantID)

	if err != nil {
		// Fallback: use default tenant
		tenantID = "default"
	}

	// Option 2: Look up customer by phone number
	err = h.db.QueryRow(ctx, `
		SELECT customer_id 
		FROM conversations 
		WHERE tenant_id = $1 
		  AND phone_number = $2 
		  AND channel = 'whatsapp'
		  AND is_active = true
		ORDER BY last_activity DESC
		LIMIT 1
	`, tenantID, phoneNumber).Scan(&customerID)

	if err != nil {
		// Customer not found - use phone number as customer_id
		customerID = phoneNumber
	}

	return tenantID, customerID
}

// identifyUserFromTelegram identifies tenant and customer from Telegram user ID
func (h *CommunicationHub) identifyUserFromTelegram(ctx context.Context, userID string) (string, string) {
	var tenantID, customerID string

	// Look up customer by Telegram user ID
	err := h.db.QueryRow(ctx, `
		SELECT tenant_id, customer_id 
		FROM conversations 
		WHERE channel = 'telegram'
		  AND phone_number = $1
		  AND is_active = true
		ORDER BY last_activity DESC
		LIMIT 1
	`, userID).Scan(&tenantID, &customerID)

	if err != nil {
		// Customer not found - use default tenant and user ID as customer ID
		tenantID = "default"
		customerID = userID
	}

	return tenantID, customerID
}

// generateWhatsAppReply generates auto-reply text based on keyword
func (h *CommunicationHub) generateWhatsAppReply(text string) string {
	textUpper := strings.ToUpper(strings.TrimSpace(text))
	fmt.Printf("[WhatsApp] Keyword detected: %s\n", textUpper)

	switch textUpper {
	case "BAL", "BALANCE":
		return "💰 Your account balance is NGN 10,000.00"
	case "HELP":
		return "📞 *54Link Banking Services:*\n\n" +
			"*BAL* - Check balance\n" +
			"*TRANSFER* - Transfer money\n" +
			"*LOAN* - Loan services\n" +
			"*SAVINGS* - Savings account\n\n" +
			"Or call us at +234-800-54LINK"
	case "TRANS", "TRANSFER":
		return "💸 To transfer money, please use our mobile app or USSD code *384*29930#"
	case "LOAN":
		return "🏦 *Loan Services:*\nVisit our app to apply for loans or check loan status"
	case "SAVINGS":
		return "💎 *Savings Account:*\nCreate a savings plan in our mobile app!"
	case "HI", "HELLO", "HEY":
		return "Hello! 👋 Welcome to 54Link Banking.\n\n" +
			"How can we help you today?\n\n" +
			"*BAL* - Check balance\n" +
			"*HELP* - Get assistance"
	default:
		return "Thank you for contacting 54Link Banking via WhatsApp! 👋\n\n" +
			"Reply with:\n" +
			"*BAL* - Check balance\n" +
			"*HELP* - Get assistance\n" +
			"*TRANSFER* - Transfer money\n" +
			"*LOAN* - Loan services"
	}
}

func main() {
	cfg := &HubConfig{
		PostgresURL:  getEnv("DATABASE_URL", "postgres://localhost:5432/54bank"),
		RedisURL:     getEnv("REDIS_URL", "localhost:6379"),
		KafkaBrokers: getEnv("KAFKA_BROKERS", "localhost:9092"),
		WhatsAppURL:  getEnv("WHATSAPP_SERVICE_URL", "http://localhost:8102"),
		USSDURL:      getEnv("USSD_SERVICE_URL", "http://localhost:8103"),
		SMSURL:       getEnv("SMS_SERVICE_URL", "http://localhost:8104"),
		TelegramURL:  getEnv("TELEGRAM_SERVICE_URL", "http://localhost:8123"),
		KeycloakURL:  getEnv("KEYCLOAK_URL", "http://localhost:8080"),
		PermifyURL:   getEnv("PERMIFY_URL", "http://localhost:3476"),
		LakehouseURL: getEnv("LAKEHOUSE_URL", "http://localhost:8181"),
		FluvioURL:    getEnv("FLUVIO_URL", "localhost:9003"),
		TemporalHost: getEnv("TEMPORAL_HOST", "localhost:7233"),
		DaprURL:      getEnv("DAPR_HTTP_PORT", "http://localhost:3500"),
	}

	hub, err := NewCommunicationHub(cfg)
	if err != nil {
		panic(err)
	}
	defer hub.Close()

	http.HandleFunc("/api/v1/send", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[API] Incoming send message request from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[API] Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			fmt.Printf("[API] Error: Bad request body: %v\n", err)
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		req.TenantID = r.Header.Get("X-Tenant-ID")
		if req.TenantID == "" {
			req.TenantID = "default"
		}

		fmt.Printf("[API] Send message - Tenant: %s, Channel: %s, To: %s, Type: %s\n",
			req.TenantID, req.Channel, req.To, req.Type)

		resp, err := hub.SendMessage(r.Context(), &req)
		if err != nil {
			fmt.Printf("[API] Error sending message: %v\n", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		fmt.Printf("[API] Message sent successfully - MsgID: %s, Status: %s\n", resp.MessageID, resp.Status)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	http.HandleFunc("/api/v1/broadcast", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[API] Incoming broadcast request from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[API] Broadcast Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Channels   []Channel   `json:"channels"`
			Recipients []string    `json:"recipients"`
			Content    string      `json:"content"`
			Type       MessageType `json:"type"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			fmt.Printf("[API] Broadcast Error: Bad request body: %v\n", err)
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}

		fmt.Printf("[API] Broadcast - Tenant: %s, Channels: %v, Recipients: %d, ContentLen: %d\n",
			tenantID, req.Channels, len(req.Recipients), len(req.Content))

		responses, err := hub.BroadcastMessage(r.Context(), tenantID, req.Channels, req.Recipients, req.Content, req.Type)
		if err != nil {
			fmt.Printf("[API] Broadcast Error: %v\n", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		fmt.Printf("[API] Broadcast completed - Sent: %d messages\n", len(responses))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(responses)
	})

	http.HandleFunc("/api/v1/conversation", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		tenantID := r.Header.Get("X-Tenant-ID")
		customerID := r.URL.Query().Get("customer_id")
		channel := Channel(r.URL.Query().Get("channel"))

		messages, err := hub.GetConversation(r.Context(), tenantID, customerID, channel, 50)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	})

	http.HandleFunc("/api/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		tenantID := r.Header.Get("X-Tenant-ID")
		channel := Channel(r.URL.Query().Get("channel"))

		stats, err := hub.GetChannelStats(r.Context(), tenantID, channel, time.Now().AddDate(0, 0, -7), time.Now())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	})

	http.HandleFunc("/api/v1/channel/config", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")

		if r.Method == http.MethodPut {
			var config ChannelConfig
			if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
				http.Error(w, "Bad request", http.StatusBadRequest)
				return
			}

			if err := hub.UpdateChannelConfig(r.Context(), tenantID, &config); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			return
		}

		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	http.HandleFunc("/api/v1/messages/recent", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}

		limit := 20
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			fmt.Sscanf(limitStr, "%d", &limit)
		}

		to := time.Now()
		from := to.Add(-24 * time.Hour)

		messages, err := hub.GetMessages(r.Context(), tenantID, "", from, to)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(messages) > limit {
			messages = messages[:limit]
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"messages": messages,
		})
	})

	http.HandleFunc("/api/v1/channels/config", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}

		// Return all channel configurations
		configs := []map[string]interface{}{}
		channels := []string{"whatsapp", "ussd", "sms", "telegram"}

		for _, ch := range channels {
			config := hub.getChannelConfig(Channel(ch))
			if config != nil {
				configs = append(configs, map[string]interface{}{
					"channel":     ch,
					"enabled":     config.Enabled,
					"priority":    config.Priority,
					"rate_limit":  config.RateLimit,
					"credentials": config.Credentials,
					"settings":    config.Settings,
				})
			} else {
				configs = append(configs, map[string]interface{}{
					"channel":     ch,
					"enabled":     true,
					"priority":    1,
					"rate_limit":  1000,
					"credentials": map[string]string{},
					"settings":    map[string]interface{}{},
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"configs": configs,
		})
	})

	http.HandleFunc("/api/v1/conversations", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}

		// For now, return empty conversations array
		// This would need to be implemented with proper conversation tracking
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"conversations": []interface{}{},
		})
	})

	// USSD Callback endpoint for Africa's Talking
	http.HandleFunc("/api/v1/ussd/callback", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[USSD] Incoming callback request from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[USSD] Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse Africa's Talking USSD callback parameters
		if err := r.ParseForm(); err != nil {
			fmt.Printf("[USSD] Error: Failed to parse form: %v\n", err)
			http.Error(w, "Failed to parse form", http.StatusBadRequest)
			return
		}

		sessionID := r.FormValue("sessionId")
		serviceCode := r.FormValue("serviceCode")
		phoneNumber := r.FormValue("phoneNumber")
		text := r.FormValue("text")

		fmt.Printf("[USSD] Request - SessionID: %s, ServiceCode: %s, Phone: %s, Text: %s\n",
			sessionID, serviceCode, phoneNumber, text)

		// Identify tenant from service code
		// Each tenant should have their own USSD service code configured
		tenantID, customerID := hub.identifyUserFromUSSD(r.Context(), serviceCode, phoneNumber)
		if tenantID == "" {
			tenantID = "default" // Fallback
		}
		fmt.Printf("[USSD] Identified - TenantID: %s, CustomerID: %s\n", tenantID, customerID)

		// Store the USSD message in the database
		message := Message{
			ID:         fmt.Sprintf("ussd-%d", time.Now().UnixNano()),
			TenantID:   tenantID,
			CustomerID: customerID,
			Channel:    ChannelUSSD,
			Direction:  DirectionInbound,
			Type:       TypeText,
			From:       phoneNumber,
			To:         serviceCode,
			Content:    text,
			SessionID:  sessionID,
			Timestamp:  time.Now(),
			Status:     "received",
			Metadata: map[string]interface{}{
				"service_code": serviceCode,
				"session_id":   sessionID,
			},
		}

		// Record the USSD message to database
		hub.recordMessage(r.Context(), &message)

		// Update metrics
		messagesTotal.WithLabelValues("ussd", "inbound", "received").Inc()

		// USSD response handling
		// For now, return a simple response. You can integrate with your business logic here
		response := "CON Welcome to 54Link Banking\n"
		response += "1. Check Balance\n"
		response += "2. Transfer Money\n"
		response += "3. Buy Airtime\n"
		response += "4. Loans\n"
		response += "5. Savings"

		// If user entered something, handle their input
		if text != "" {
			inputs := parseUSSDInput(text)
			if len(inputs) > 0 {
				switch inputs[0] {
				case "1":
					response = "END Your balance is NGN 10,000.00"
				case "2":
					if len(inputs) == 1 {
						response = "CON Enter recipient phone number:"
					} else if len(inputs) == 2 {
						response = "CON Enter amount:"
					} else {
						response = "END Transfer of NGN " + inputs[2] + " to " + inputs[1] + " initiated"
					}
				case "3":
					response = "CON Enter phone number:"
				case "4":
					response = "CON Loan Services\n1. Apply for loan\n2. Check loan status"
				case "5":
					response = "CON Savings\n1. View savings\n2. Create savings plan"
				default:
					response = "END Invalid option"
				}
			}
		}

		fmt.Printf("[USSD] Sending response (length: %d): %s\n", len(response), response)
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(response))
	})

	// SMS Incoming Message Callback endpoint for Africa's Talking
	http.HandleFunc("/api/v1/sms/callback", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[SMS] Incoming message callback from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[SMS] Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse Africa's Talking SMS callback parameters
		if err := r.ParseForm(); err != nil {
			fmt.Printf("[SMS] Error: Failed to parse form: %v\n", err)
			http.Error(w, "Failed to parse form", http.StatusBadRequest)
			return
		}

		// Africa's Talking sends: from, to, text, date, id, linkId
		from := r.FormValue("from")
		to := r.FormValue("to")
		text := r.FormValue("text")
		messageID := r.FormValue("id")
		linkID := r.FormValue("linkId")
		dateStr := r.FormValue("date")

		fmt.Printf("[SMS] Request - From: %s, To: %s, Text: %s, MsgID: %s, LinkID: %s\n",
			from, to, text, messageID, linkID)

		// Identify tenant from shortcode/number
		tenantID, customerID := hub.identifyUserFromSMS(r.Context(), to, from)
		if tenantID == "" {
			tenantID = "default"
		}
		fmt.Printf("[SMS] Identified - TenantID: %s, CustomerID: %s\n", tenantID, customerID)

		// Store the incoming SMS in database
		message := Message{
			ID:         messageID,
			TenantID:   tenantID,
			CustomerID: customerID,
			Channel:    ChannelSMS,
			Direction:  DirectionInbound,
			Type:       TypeText,
			From:       from,
			To:         to,
			Content:    text,
			Timestamp:  time.Now(),
			Status:     "received",
			Metadata: map[string]interface{}{
				"link_id": linkID,
				"date":    dateStr,
			},
		}

		hub.recordMessage(r.Context(), &message)

		// Update metrics
		messagesTotal.WithLabelValues("sms", "inbound", "received").Inc()

		// Auto-reply: Send SMS response back to the sender
		config := hub.getChannelConfig(ChannelSMS)
		if config != nil && config.Enabled {
			fmt.Printf("[SMS] Auto-reply enabled, processing keyword...\n")

			// Create auto-reply message
			replyText := "Thank you for contacting 54Link Banking. Your message has been received. Reply with:\n" +
				"BAL - Check balance\n" +
				"HELP - Get assistance"

			// Handle specific keywords
			textUpper := strings.ToUpper(strings.TrimSpace(text))
			fmt.Printf("[SMS] Keyword detected: %s\n", textUpper)

			switch textUpper {
			case "BAL", "BALANCE":
				replyText = "Your account balance is NGN 10,000.00"
			case "HELP":
				replyText = "54Link Banking Services:\nBAL - Check balance\nTRANS - Transfer money\nLOAN - Loan services\nOr call us at +234-800-54LINK"
			case "TRANS", "TRANSFER":
				replyText = "To transfer money, please use our mobile app or USSD code *384*29930#"
			case "LOAN":
				replyText = "Loan Services: Visit our app to apply for loans or check loan status"
			}

			// Send SMS reply
			senderID := config.Credentials["sender_id"]
			if senderID == "" {
				senderID = "54LINK" // Default sender ID
			}

			replyMsg := &Message{
				ID:         fmt.Sprintf("sms-reply-%d", time.Now().UnixNano()),
				TenantID:   tenantID,
				CustomerID: customerID,
				Channel:    ChannelSMS,
				Direction:  DirectionOutbound,
				Type:       TypeText,
				From:       senderID, // Use sender ID, not shortcode
				To:         from,     // Reply to sender
				Content:    replyText,
				Timestamp:  time.Now(),
				Status:     "pending",
			}

			// Send the SMS
			fmt.Printf("[SMS] Sending auto-reply to %s: %s\n", from, replyText)
			if err := hub.sendSMS(r.Context(), replyMsg, config); err != nil {
				fmt.Printf("[SMS] Error sending SMS reply: %v\n", err)
			} else {
				fmt.Printf("[SMS] Auto-reply sent successfully\n")
			}
		} else {
			fmt.Printf("[SMS] Auto-reply disabled or config not found\n")
		}

		// Send 200 OK response (Africa's Talking expects this)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Message received"))
	})

	// SMS Delivery Report Callback endpoint for Africa's Talking
	http.HandleFunc("/api/v1/sms/delivery", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[SMS] Delivery report callback from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[SMS] Delivery Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse Africa's Talking delivery report parameters
		if err := r.ParseForm(); err != nil {
			fmt.Printf("[SMS] Delivery Error: Failed to parse form: %v\n", err)
			http.Error(w, "Failed to parse form", http.StatusBadRequest)
			return
		}

		// Africa's Talking sends: id, status, phoneNumber, retryCount, networkCode, failureReason
		messageID := r.FormValue("id")
		status := r.FormValue("status")
		// phoneNumber := r.FormValue("phoneNumber") // Not needed for update
		retryCount := r.FormValue("retryCount")
		networkCode := r.FormValue("networkCode")
		failureReason := r.FormValue("failureReason")

		fmt.Printf("[SMS] Delivery Report - MsgID: %s, Status: %s, Network: %s, Retries: %s, Reason: %s\n",
			messageID, status, networkCode, retryCount, failureReason)

		// Update message status in database
		_, err := hub.db.Exec(r.Context(), `
			UPDATE messages 
			SET status = $1, 
			    metadata = metadata || jsonb_build_object(
					'retry_count', $2,
					'network_code', $3,
					'failure_reason', $4
				),
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $5 AND channel = 'sms'
		`, status, retryCount, networkCode, failureReason, messageID)

		if err != nil {
			fmt.Printf("Error updating SMS delivery status: %v\n", err)
		}

		// Update metrics
		if status == "Success" {
			messagesTotal.WithLabelValues("sms", "outbound", "delivered").Inc()
		} else {
			messagesTotal.WithLabelValues("sms", "outbound", "failed").Inc()
		}

		// Send 200 OK response
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Delivery report received"))
	})

	// WhatsApp Incoming Message Callback endpoint for Africa's Talking
	// WhatsApp Incoming Message Callback endpoint for Africa's Talking & Meta Cloud API
	http.HandleFunc("/api/v1/whatsapp/callback", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[WhatsApp] Incoming request from %s - Method: %s\n", r.RemoteAddr, r.Method)

		// Handle Meta webhook verification (GET request)
		if r.Method == http.MethodGet {
			mode := r.URL.Query().Get("hub.mode")
			token := r.URL.Query().Get("hub.verify_token")
			challenge := r.URL.Query().Get("hub.challenge")

			fmt.Printf("[WhatsApp] Webhook verification - Mode: %s, Token: %s, Challenge: %s\n", mode, token, challenge)

			// Get verify token from WhatsApp channel config
			config := hub.getChannelConfig(ChannelWhatsApp)
			expectedToken := ""
			if config != nil {
				expectedToken = config.Credentials["verify_token"]
			}

			if mode == "subscribe" && token == expectedToken && expectedToken != "" {
				fmt.Printf("[WhatsApp] Webhook verification successful\n")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(challenge))
				return
			}

			fmt.Printf("[WhatsApp] Webhook verification failed - Expected token: %s\n", expectedToken)
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		// Handle POST requests (incoming messages)
		if r.Method != http.MethodPost {
			fmt.Printf("[WhatsApp] Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Try to parse as Meta Cloud API webhook first
		var metaPayload struct {
			Object string `json:"object"`
			Entry  []struct {
				ID      string `json:"id"`
				Changes []struct {
					Value struct {
						MessagingProduct string `json:"messaging_product"`
						Metadata         struct {
							DisplayPhoneNumber string `json:"display_phone_number"`
							PhoneNumberID      string `json:"phone_number_id"`
						} `json:"metadata"`
						Contacts []struct {
							Profile struct {
								Name string `json:"name"`
							} `json:"profile"`
							WaID string `json:"wa_id"`
						} `json:"contacts"`
						Messages []struct {
							From      string `json:"from"`
							ID        string `json:"id"`
							Timestamp string `json:"timestamp"`
							Text      struct {
								Body string `json:"body"`
							} `json:"text"`
							Type string `json:"type"`
						} `json:"messages"`
					} `json:"value"`
					Field string `json:"field"`
				} `json:"changes"`
			} `json:"entry"`
		}

		bodyBytes, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// Try Meta format first
		if err := json.Unmarshal(bodyBytes, &metaPayload); err == nil && metaPayload.Object == "whatsapp_business_account" {
			fmt.Printf("[WhatsApp] Meta Cloud API webhook received\n")

			for _, entry := range metaPayload.Entry {
				for _, change := range entry.Changes {
					for _, msg := range change.Value.Messages {
						if msg.Type != "text" {
							continue
						}

						from := msg.From
						to := change.Value.Metadata.DisplayPhoneNumber
						text := msg.Text.Body

						fmt.Printf("[WhatsApp] Meta Message - From: %s, To: %s, Text: %s\n", from, to, text)

						// Identify tenant and customer
						tenantID, customerID := hub.identifyUserFromWhatsApp(r.Context(), to, from)
						if tenantID == "" {
							tenantID = "default"
						}
						fmt.Printf("[WhatsApp] Identified - TenantID: %s, CustomerID: %s\n", tenantID, customerID)

						// Store message
						message := Message{
							ID:         msg.ID,
							TenantID:   tenantID,
							CustomerID: customerID,
							Channel:    ChannelWhatsApp,
							Direction:  DirectionInbound,
							Type:       TypeText,
							From:       from,
							To:         to,
							Content:    text,
							Timestamp:  time.Now(),
							Status:     "received",
							Metadata: map[string]interface{}{
								"timestamp": msg.Timestamp,
								"type":      msg.Type,
								"provider":  "meta",
							},
						}

						hub.recordMessage(r.Context(), &message)
						messagesTotal.WithLabelValues("whatsapp", "inbound", "received").Inc()

						// Auto-reply
						config := hub.getChannelConfig(ChannelWhatsApp)
						if config != nil && config.Enabled {
							fmt.Printf("[WhatsApp] Auto-reply enabled, processing message...\n")

							replyText := hub.generateWhatsAppReply(text)

							replyMsg := &Message{
								ID:         fmt.Sprintf("wa-reply-%d", time.Now().UnixNano()),
								TenantID:   tenantID,
								CustomerID: customerID,
								Channel:    ChannelWhatsApp,
								Direction:  DirectionOutbound,
								Type:       TypeText,
								From:       to,
								To:         from,
								Content:    replyText,
								Timestamp:  time.Now(),
								Status:     "pending",
							}

							fmt.Printf("[WhatsApp] Sending auto-reply to %s: %s\n", from, replyText)
							if err := hub.sendWhatsApp(r.Context(), replyMsg, config); err != nil {
								fmt.Printf("[WhatsApp] Error sending reply: %v\n", err)
							} else {
								fmt.Printf("[WhatsApp] Auto-reply sent successfully\n")
							}
						}
					}
				}
			}

			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "received"})
			return
		}

		// Fallback: Parse as Africa's Talking WhatsApp callback (JSON format)
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		var payload struct {
			From      string `json:"from"`
			To        string `json:"to"`
			Text      string `json:"text"`
			ID        string `json:"id"`
			Timestamp string `json:"timestamp"`
			Type      string `json:"type"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			fmt.Printf("[WhatsApp] Error: Failed to parse JSON: %v\n", err)
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		fmt.Printf("[WhatsApp] Request - From: %s, To: %s, Text: %s, Type: %s\n",
			payload.From, payload.To, payload.Text, payload.Type)

		// Identify tenant from WhatsApp number
		tenantID, customerID := hub.identifyUserFromWhatsApp(r.Context(), payload.To, payload.From)
		if tenantID == "" {
			tenantID = "default"
		}
		fmt.Printf("[WhatsApp] Identified - TenantID: %s, CustomerID: %s\n", tenantID, customerID)

		// Store the incoming WhatsApp message
		message := Message{
			ID:         payload.ID,
			TenantID:   tenantID,
			CustomerID: customerID,
			Channel:    ChannelWhatsApp,
			Direction:  DirectionInbound,
			Type:       TypeText,
			From:       payload.From,
			To:         payload.To,
			Content:    payload.Text,
			Timestamp:  time.Now(),
			Status:     "received",
			Metadata: map[string]interface{}{
				"timestamp": payload.Timestamp,
				"type":      payload.Type,
			},
		}

		hub.recordMessage(r.Context(), &message)

		// Update metrics
		messagesTotal.WithLabelValues("whatsapp", "inbound", "received").Inc()

		// Auto-reply: Send WhatsApp response
		config := hub.getChannelConfig(ChannelWhatsApp)
		if config != nil && config.Enabled {
			fmt.Printf("[WhatsApp] Auto-reply enabled, processing message...\n")

			// Generate auto-reply using helper function
			replyText := hub.generateWhatsAppReply(payload.Text)

			// Send WhatsApp reply
			waNumber := config.Credentials["wa_number"]
			if waNumber == "" {
				waNumber = payload.To // Use the number message was sent to
			}

			replyMsg := &Message{
				ID:         fmt.Sprintf("wa-reply-%d", time.Now().UnixNano()),
				TenantID:   tenantID,
				CustomerID: customerID,
				Channel:    ChannelWhatsApp,
				Direction:  DirectionOutbound,
				Type:       TypeText,
				From:       waNumber,
				To:         payload.From,
				Content:    replyText,
				Timestamp:  time.Now(),
				Status:     "pending",
			}

			// Send the WhatsApp message
			fmt.Printf("[WhatsApp] Sending auto-reply to %s: %s\n", payload.From, replyText)
			if err := hub.sendWhatsApp(r.Context(), replyMsg, config); err != nil {
				fmt.Printf("[WhatsApp] Error sending reply: %v\n", err)
			} else {
				fmt.Printf("[WhatsApp] Auto-reply sent successfully\n")
			}
		} else {
			fmt.Printf("[WhatsApp] Auto-reply disabled or config not found\n")
		}

		// Send 200 OK response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "received"})
	})

	// Telegram Bot Webhook endpoint
	http.HandleFunc("/api/v1/telegram/webhook", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("[Telegram] Incoming webhook from %s\n", r.RemoteAddr)

		if r.Method != http.MethodPost {
			fmt.Printf("[Telegram] Error: Invalid method %s\n", r.Method)
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Parse Telegram webhook update
		var update struct {
			UpdateID int `json:"update_id"`
			Message  *struct {
				MessageID int `json:"message_id"`
				From      struct {
					ID        int64  `json:"id"`
					FirstName string `json:"first_name"`
					LastName  string `json:"last_name"`
					Username  string `json:"username"`
				} `json:"from"`
				Chat struct {
					ID        int64  `json:"id"`
					Type      string `json:"type"`
					FirstName string `json:"first_name"`
					Username  string `json:"username"`
				} `json:"chat"`
				Date int64  `json:"date"`
				Text string `json:"text"`
			} `json:"message"`
		}

		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			fmt.Printf("[Telegram] Error: Failed to parse JSON: %v\n", err)
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		// Handle only text messages for now
		if update.Message == nil || update.Message.Text == "" {
			fmt.Printf("[Telegram] Skipping non-text message\n")
			w.WriteHeader(http.StatusOK)
			return
		}

		chatID := fmt.Sprintf("%d", update.Message.Chat.ID)
		userID := fmt.Sprintf("%d", update.Message.From.ID)

		fmt.Printf("[Telegram] Request - ChatID: %s, UserID: %s, Text: %s\n",
			chatID, userID, update.Message.Text)

		// Identify tenant and customer
		tenantID, customerID := hub.identifyUserFromTelegram(r.Context(), userID)
		if tenantID == "" {
			tenantID = "default"
		}
		fmt.Printf("[Telegram] Identified - TenantID: %s, CustomerID: %s\n", tenantID, customerID)

		// Store the incoming Telegram message
		message := Message{
			ID:         fmt.Sprintf("tg-%d", update.Message.MessageID),
			TenantID:   tenantID,
			CustomerID: customerID,
			Channel:    ChannelTelegram,
			Direction:  DirectionInbound,
			Type:       TypeText,
			From:       userID,
			To:         chatID,
			Content:    update.Message.Text,
			Timestamp:  time.Unix(update.Message.Date, 0),
			Status:     "received",
			Metadata: map[string]interface{}{
				"update_id":  update.UpdateID,
				"username":   update.Message.From.Username,
				"first_name": update.Message.From.FirstName,
			},
		}

		hub.recordMessage(r.Context(), &message)

		// Update metrics
		messagesTotal.WithLabelValues("telegram", "inbound", "received").Inc()

		// Auto-reply: Send Telegram response
		config := hub.getChannelConfig(ChannelTelegram)
		if config != nil && config.Enabled {
			fmt.Printf("[Telegram] Auto-reply enabled, processing message...\n")

			// Create auto-reply message
			replyText := "Welcome to 54Link Banking! 🏦\n\n" +
				"Send:\n" +
				"/balance - Check your balance\n" +
				"/help - Get assistance\n" +
				"/transfer - Transfer money\n" +
				"/loan - Loan services"

			// Handle specific commands
			textLower := strings.ToLower(strings.TrimSpace(update.Message.Text))
			fmt.Printf("[Telegram] Command detected: %s\n", textLower)

			switch {
			case textLower == "/start":
				replyText = "👋 Hello " + update.Message.From.FirstName + "!\n\n" +
					"Welcome to 54Link Banking on Telegram.\n\n" +
					"Available commands:\n" +
					"/balance - Check account balance\n" +
					"/help - Get help\n" +
					"/transfer - Make a transfer\n" +
					"/loan - Apply for a loan"
			case textLower == "/balance" || textLower == "bal":
				replyText = "💰 *Your Account Balance*\n\n" +
					"Account: NGN 10,000.00\n" +
					"Available: NGN 9,500.00\n\n" +
					"Last updated: " + time.Now().Format("Jan 2, 2006 15:04")
			case textLower == "/help":
				replyText = "📞 *54Link Banking Help*\n\n" +
					"Commands:\n" +
					"/balance - Check balance\n" +
					"/transfer - Transfer funds\n" +
					"/loan - Loan services\n" +
					"/savings - Savings account\n" +
					"/transactions - Recent transactions\n\n" +
					"Need more help? Call +234-800-54LINK"
			case textLower == "/transfer":
				replyText = "💸 *Transfer Money*\n\n" +
					"To transfer, please use our mobile app or web portal.\n\n" +
					"Quick transfer: https://54link-dev.upi.dev/transfer"
			case textLower == "/loan":
				replyText = "🏦 *Loan Services*\n\n" +
					"Available loans:\n" +
					"• Personal Loan - Up to NGN 500,000\n" +
					"• Business Loan - Up to NGN 2,000,000\n\n" +
					"Apply: https://54link-dev.upi.dev/loans"
			case textLower == "/savings":
				replyText = "💎 *Savings Account*\n\n" +
					"Current Savings: NGN 25,000.00\n" +
					"Interest Rate: 5% p.a.\n\n" +
					"Open a new savings plan: /newsavings"
			case textLower == "/transactions":
				replyText = "📊 *Recent Transactions*\n\n" +
					"1. Transfer to John - NGN 500\n" +
					"2. ATM Withdrawal - NGN 2,000\n" +
					"3. POS Payment - NGN 1,500\n\n" +
					"View all: https://54link-dev.upi.dev/transactions"
			default:
				// Unknown command
				if strings.HasPrefix(textLower, "/") {
					replyText = "Unknown command. Type /help for available commands."
				}
			}

			// Send Telegram reply
			replyMsg := &Message{
				ID:         fmt.Sprintf("tg-reply-%d", time.Now().UnixNano()),
				TenantID:   tenantID,
				CustomerID: customerID,
				Channel:    ChannelTelegram,
				Direction:  DirectionOutbound,
				Type:       TypeText,
				From:       chatID,
				To:         chatID,
				Content:    replyText,
				Timestamp:  time.Now(),
				Status:     "pending",
			}

			// Send the Telegram message
			fmt.Printf("[Telegram] Sending auto-reply to chat %s: %s\n", chatID, replyText)
			if err := hub.sendTelegram(r.Context(), replyMsg, config); err != nil {
				fmt.Printf("[Telegram] Error sending reply: %v\n", err)
			} else {
				fmt.Printf("[Telegram] Auto-reply sent successfully\n")
			}
		} else {
			fmt.Printf("[Telegram] Auto-reply disabled or config not found\n")
		}

		// Send 200 OK response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"ok": "true"})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		health := hub.HealthCheck(r.Context())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(health)
	})

	http.Handle("/metrics", promhttp.Handler())

	port := getEnv("PORT", "8124")
	fmt.Printf("Communication Hub starting on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
