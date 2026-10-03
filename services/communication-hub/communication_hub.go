package main

import (
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
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

var (
	messagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "communication_hub_messages_total",
			Help: "Total messages sent by channel and status",
		},
		[]string{"channel", "status"},
	)
	kafkaPublishErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "communication_hub_kafka_publish_errors_total",
			Help: "Total Kafka publish errors by topic",
		},
		[]string{"topic"},
	)
)

type Hub struct {
	db     *pgxpool.Pool
	sqldb  *sql.DB
	redis  *redis.Client
	kafka  *kafka.Producer
	kafkaTopic string
}

type Message struct {
	ID          string    `json:"id"`
	To          string    `json:"to"`
	Channel     string    `json:"channel"`
	Subject     string    `json:"subject"`
	Body        string    `json:"body"`
	TemplateID  string    `json:"template_id"`
	TemplateVars map[string]string `json:"template_vars"`
	Status      string    `json:"status"`
	Error       string    `json:"error,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	SentAt      *time.Time `json:"sent_at,omitempty"`
	DeliveredAt *time.Time `json:"delivered_at,omitempty"`
	Metadata    map[string]string `json:"metadata"`
	TenantID    string    `json:"tenant_id"`
}

type WebhookEvent struct {
	Type      string          `json:"type"`
	Timestamp time.Time       `json:"timestamp"`
	Data      json.RawMessage `json:"data"`
}

type ConversationEvent struct {
	ConversationID string    `json:"conversation_id"`
	CustomerID     string    `json:"customer_id"`
	Channel        string    `json:"channel"`
	Direction      string    `json:"direction"` // inbound or outbound
	Content        string    `json:"content"`
	Timestamp      time.Time `json:"timestamp"`
	Metadata       map[string]string `json:"metadata"`
}

func main() {
	hub, err := NewHub()
	if err != nil {
		panic(fmt.Sprintf("Failed to create hub: %v", err))
	}
	defer hub.Close()

	// Start HTTP server
	http.HandleFunc("/health", hub.healthHandler)
	http.HandleFunc("/ready", hub.readyHandler)
	http.HandleFunc("/messages", hub.messagesHandler)
	http.HandleFunc("/messages/", hub.messageHandler)
	http.HandleFunc("/webhooks/", hub.webhookHandler)
	http.Handle("/metrics", promhttp.Handler())

	// Start webhook consumers
	go hub.startWebhookConsumers()

	// Start message processors
	go hub.startMessageProcessors()

	fmt.Println("Communication Hub started on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(fmt.Sprintf("HTTP server failed: %v", err))
	}
}

func NewHub() (*Hub, error) {
	// PostgreSQL
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	if err := db.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	// SQL DB for compatibility
	sqldb, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open SQL DB: %w", err)
	}

	// Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       0,
	})

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// Kafka
	kafkaConfig := &kafka.ConfigMap{
		"bootstrap.servers": getEnv("KAFKA_BROKERS", "localhost:9092"),
		"acks":              "all",
		"retries":           5,
	}

	kafkaProducer, err := kafka.NewProducer(kafkaConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	kafkaTopic := getEnv("KAFKA_TOPIC", "communication-hub")

	return &Hub{
		db:         db,
		sqldb:      sqldb,
		redis:      redisClient,
		kafka:      kafkaProducer,
		kafkaTopic: kafkaTopic,
	}, nil
}

func (h *Hub) Close() {
	if h.db != nil {
		h.db.Close()
	}
	if h.sqldb != nil {
		h.sqldb.Close()
	}
	if h.redis != nil {
		h.redis.Close()
	}
	if h.kafka != nil {
		h.kafka.Close()
	}
}

func (h *Hub) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func (h *Hub) readyHandler(w http.ResponseWriter, r *http.Request) {
	// Check dependencies
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := h.db.Ping(ctx); err != nil {
		http.Error(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}

	if err := h.redis.Ping(ctx).Err(); err != nil {
		http.Error(w, "Redis not ready", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Ready"))
}

func (h *Hub) messagesHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		h.sendMessageHandler(w, r)
	case "GET":
		h.listMessagesHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Hub) messageHandler(w http.ResponseWriter, r *http.Request) {
	messageID := strings.TrimPrefix(r.URL.Path, "/messages/")
	if messageID == "" {
		http.Error(w, "Message ID required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		h.getMessageHandler(w, r, messageID)
	case "PUT":
		h.updateMessageHandler(w, r, messageID)
	case "DELETE":
		h.deleteMessageHandler(w, r, messageID)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Hub) webhookHandler(w http.ResponseWriter, r *http.Request) {
	webhookType := strings.TrimPrefix(r.URL.Path, "/webhooks/")
	if webhookType == "" {
		http.Error(w, "Webhook type required", http.StatusBadRequest)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}

	// Parse webhook event
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "Invalid webhook payload", http.StatusBadRequest)
		return
	}

	// Store webhook event
	if err := h.storeWebhookEvent(webhookType, &event); err != nil {
		http.Error(w, "Failed to store webhook", http.StatusInternalServerError)
		return
	}

	// Process webhook based on type
	go h.processWebhook(webhookType, &event)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func (h *Hub) sendMessageHandler(w http.ResponseWriter, r *http.Request) {
	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid message payload", http.StatusBadRequest)
		return
	}

	// Validate message
	if err := h.validateMessage(&msg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if msg.ID == "" {
		msg.ID = generateID()
	}

	// Set timestamps
	now := time.Now()
	msg.CreatedAt = now
	msg.Status = "pending"

	// Store message
	if err := h.storeMessage(&msg); err != nil {
		http.Error(w, "Failed to store message", http.StatusInternalServerError)
		return
	}

	// Publish to Kafka for processing
	if err := h.publishMessage(&msg); err != nil {
		http.Error(w, "Failed to queue message", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(msg)
}

func (h *Hub) listMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	query := r.URL.Query()
	channel := query.Get("channel")
	status := query.Get("status")
	tenantID := query.Get("tenant_id")
	limit := 50
	offset := 0

	if l := query.Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	if o := query.Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Build query
	baseQuery := "SELECT id, to_address, channel, subject, body, template_id, template_vars, status, error, created_at, sent_at, delivered_at, metadata, tenant_id FROM messages WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if channel != "" {
		baseQuery += fmt.Sprintf(" AND channel = $%d", argIndex)
		args = append(args, channel)
		argIndex++
	}

	if status != "" {
		baseQuery += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	if tenantID != "" {
		baseQuery += fmt.Sprintf(" AND tenant_id = $%d", argIndex)
		args = append(args, tenantID)
		argIndex++
	}

	baseQuery += " ORDER BY created_at DESC"
	baseQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	// Execute query
	rows, err := h.db.Query(context.Background(), baseQuery, args...)
	if err != nil {
		http.Error(w, "Failed to query messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var templateVars, metadata []byte
		err := rows.Scan(
			&msg.ID, &msg.To, &msg.Channel, &msg.Subject, &msg.Body,
			&msg.TemplateID, &templateVars, &msg.Status, &msg.Error,
			&msg.CreatedAt, &msg.SentAt, &msg.DeliveredAt, &metadata, &msg.TenantID,
		)
		if err != nil {
			continue
		}

		if len(templateVars) > 0 {
			json.Unmarshal(templateVars, &msg.TemplateVars)
		}
		if len(metadata) > 0 {
			json.Unmarshal(metadata, &msg.Metadata)
		}

		messages = append(messages, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": messages,
		"count":    len(messages),
		"limit":    limit,
		"offset":   offset,
	})
}

func (h *Hub) getMessageHandler(w http.ResponseWriter, r *http.Request, messageID string) {
	query := `SELECT id, to_address, channel, subject, body, template_id, template_vars, status, error, created_at, sent_at, delivered_at, metadata, tenant_id FROM messages WHERE id = $1`

	var msg Message
	var templateVars, metadata []byte
	err := h.db.QueryRow(context.Background(), query, messageID).Scan(
		&msg.ID, &msg.To, &msg.Channel, &msg.Subject, &msg.Body,
		&msg.TemplateID, &templateVars, &msg.Status, &msg.Error,
		&msg.CreatedAt, &msg.SentAt, &msg.DeliveredAt, &metadata, &msg.TenantID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Message not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to get message", http.StatusInternalServerError)
		}
		return
	}

	if len(templateVars) > 0 {
		json.Unmarshal(templateVars, &msg.TemplateVars)
	}
	if len(metadata) > 0 {
		json.Unmarshal(metadata, &msg.Metadata)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msg)
}

func (h *Hub) updateMessageHandler(w http.ResponseWriter, r *http.Request, messageID string) {
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid update payload", http.StatusBadRequest)
		return
	}

	// Build update query
	query := "UPDATE messages SET "	args := []interface{}{}
	argIndex := 1
	setParts := []string{}

	allowedFields := map[string]bool{
		"status":       true,
		"error":        true,
		"sent_at":      true,
		"delivered_at": true,
	}

	for field, value := range updates {
		if !allowedFields[field] {
			continue
		}
		setParts = append(setParts, fmt.Sprintf("%s = $%d", field, argIndex))
		args = append(args, value)
		argIndex++
	}

	if len(setParts) == 0 {
		http.Error(w, "No valid fields to update", http.StatusBadRequest)
		return
	}

	query += strings.Join(setParts, ", ")
	query += fmt.Sprintf(" WHERE id = $%d", argIndex)
	args = append(args, messageID)

	_, err := h.db.Exec(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to update message", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Updated"))
}

func (h *Hub) deleteMessageHandler(w http.ResponseWriter, r *http.Request, messageID string) {
	query := "DELETE FROM messages WHERE id = $1"
	result, err := h.db.Exec(context.Background(), query, messageID)
	if err != nil {
		http.Error(w, "Failed to delete message", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "Message not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Hub) validateMessage(msg *Message) error {
	if msg.To == "" {
		return fmt.Errorf("recipient (to) is required")
	}
	if msg.Channel == "" {
		return fmt.Errorf("channel is required")
	}
	if msg.Body == "" && msg.TemplateID == "" {
		return fmt.Errorf("body or template_id is required")
	}
	if msg.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}

	// Validate channel
	validChannels := map[string]bool{
		"email":    true,
		"sms":      true,
		"whatsapp": true,
		"telegram": true,
		"push":     true,
	}
	if !validChannels[msg.Channel] {
		return fmt.Errorf("invalid channel: %s", msg.Channel)
	}

	return nil
}

func (h *Hub) storeMessage(msg *Message) error {
	query := `
		INSERT INTO messages (id, to_address, channel, subject, body, template_id, template_vars, status, error, created_at, metadata, tenant_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	templateVars, _ := json.Marshal(msg.TemplateVars)
	metadata, _ := json.Marshal(msg.Metadata)

	_, err := h.db.Exec(context.Background(), query,
		msg.ID, msg.To, msg.Channel, msg.Subject, msg.Body,
		msg.TemplateID, templateVars, msg.Status, msg.Error,
		msg.CreatedAt, metadata, msg.TenantID,
	)

	return err
}

func (h *Hub) publishMessage(msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	topic := h.kafkaTopic
	return h.kafka.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          data,
	}, nil)
}

func (h *Hub) storeWebhookEvent(webhookType string, event *WebhookEvent) error {
	query := `
		INSERT INTO webhook_events (id, type, payload, created_at)
		VALUES ($1, $2, $3, $4)
	`

	_, err := h.db.Exec(context.Background(), query,
		generateID(), webhookType, event.Data, time.Now(),
	)

	return err
}

func (h *Hub) processWebhook(webhookType string, event *WebhookEvent) {
	// Process webhook based on type
	switch webhookType {
	case "delivery":
		h.processDeliveryWebhook(event)
	case "bounce":
		h.processBounceWebhook(event)
	case "open":
		h.processOpenWebhook(event)
	case "click":
		h.processClickWebhook(event)
	case "unsubscribe":
		h.processUnsubscribeWebhook(event)
	}
}

func (h *Hub) processDeliveryWebhook(event *WebhookEvent) {
	// Update message status to delivered
	var data struct {
		MessageID string `json:"message_id"`
		Timestamp int64  `json:"timestamp"`
	}

	if err := json.Unmarshal(event.Data, &data); err != nil {
		return
	}

	deliveredAt := time.Unix(data.Timestamp, 0)
	query := `UPDATE messages SET status = 'delivered', delivered_at = $1 WHERE id = $2`
	h.db.Exec(context.Background(), query, deliveredAt, data.MessageID)

	messagesTotal.WithLabelValues("unknown", "delivered").Inc()
}

func (h *Hub) processBounceWebhook(event *WebhookEvent) {
	// Update message status to bounced
	var data struct {
		MessageID string `json:"message_id"`
		Reason    string `json:"reason"`
	}

	if err := json.Unmarshal(event.Data, &data); err != nil {
		return
	}

	query := `UPDATE messages SET status = 'bounced', error = $1 WHERE id = $2`
	h.db.Exec(context.Background(), query, data.Reason, data.MessageID)

	messagesTotal.WithLabelValues("unknown", "bounced").Inc()
}

func (h *Hub) processOpenWebhook(event *WebhookEvent) {
	// Track message open
	var data struct {
		MessageID string `json:"message_id"`
		Timestamp int64  `json:"timestamp"`
	}

	if err := json.Unmarshal(event.Data, &data); err != nil {
		return
	}

	// Store in Redis for analytics
	key := fmt.Sprintf("open:%s", data.MessageID)
	h.redis.Set(context.Background(), key, data.Timestamp, 24*time.Hour)
}

func (h *Hub) processClickWebhook(event *WebhookEvent) {
	// Track link click
	var data struct {
		MessageID string `json:"message_id"`
		URL       string `json:"url"`
		Timestamp int64  `json:"timestamp"`
	}

	if err := json.Unmarshal(event.Data, &data); err != nil {
		return
	}

	// Store in Redis for analytics
	key := fmt.Sprintf("click:%s:%s", data.MessageID, data.URL)
	h.redis.Set(context.Background(), key, data.Timestamp, 24*time.Hour)
}

func (h *Hub) processUnsubscribeWebhook(event *WebhookEvent) {
	// Process unsubscribe
	var data struct {
		Email string `json:"email"`
	}

	if err := json.Unmarshal(event.Data, &data); err != nil {
		return
	}

	// Add to suppression list
	key := fmt.Sprintf("suppression:email:%s", data.Email)
	h.redis.Set(context.Background(), key, time.Now().Unix(), 0)
}

func (h *Hub) startWebhookConsumers() {
	// This would consume from Kafka topics for webhook processing
	// For now, it's a placeholder
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Process any pending webhooks
	}
}

func (h *Hub) startMessageProcessors() {
	// This would consume from Kafka topics for message processing
	// For now, it's a placeholder
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Process any pending messages
		h.processPendingMessages()
	}
}

func (h *Hub) processPendingMessages() {
	query := `SELECT id, to_address, channel, subject, body, template_id, template_vars, metadata, tenant_id FROM messages WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`

	rows, err := h.db.Query(context.Background(), query)
	if err != nil {
		return
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var templateVars, metadata []byte
		err := rows.Scan(
			&msg.ID, &msg.To, &msg.Channel, &msg.Subject, &msg.Body,
			&msg.TemplateID, &templateVars, &metadata, &msg.TenantID,
		)
		if err != nil {
			continue
		}

		if len(templateVars) > 0 {
			json.Unmarshal(templateVars, &msg.TemplateVars)
		}
		if len(metadata) > 0 {
			json.Unmarshal(metadata, &msg.Metadata)
		}

		messages = append(messages, msg)
	}

	// Process each message
	for _, msg := range messages {
		go h.processMessage(&msg)
	}
}

func (h *Hub) processMessage(msg *Message) {
	// Update status to processing
	h.updateMessageStatus(msg.ID, "processing")

	var err error
	switch msg.Channel {
	case "email":
		err = h.sendEmail(msg)
	case "sms":
		err = h.sendSMS(msg)
	case "whatsapp":
		err = h.sendWhatsApp(msg)
	case "telegram":
		err = h.sendTelegram(msg)
	case "push":
		err = h.sendPush(msg)
	default:
		err = fmt.Errorf("unsupported channel: %s", msg.Channel)
	}

	if err != nil {
		h.updateMessageStatusWithError(msg.ID, "failed", err.Error())
		messagesTotal.WithLabelValues(msg.Channel, "failed").Inc()
	} else {
		h.updateMessageStatus(msg.ID, "sent")
		messagesTotal.WithLabelValues(msg.Channel, "sent").Inc()
	}
}

func (h *Hub) sendEmail(msg *Message) error {
	// Email sending implementation
	// This would integrate with an email service provider
	fmt.Printf("Sending email to %s: %s\n", msg.To, msg.Subject)
	return nil
}

func (h *Hub) sendSMS(msg *Message) error {
	// SMS sending implementation
	// This would integrate with an SMS service provider
	fmt.Printf("Sending SMS to %s: %s\n", msg.To, msg.Body)
	return nil
}

func (h *Hub) sendWhatsApp(msg *Message) error {
	// WhatsApp sending implementation
	// This would integrate with WhatsApp Business API
	fmt.Printf("Sending WhatsApp to %s: %s\n", msg.To, msg.Body)
	return nil
}

func (h *Hub) sendTelegram(msg *Message) error {
	// Telegram sending implementation
	// This would integrate with Telegram Bot API
	fmt.Printf("Sending Telegram to %s: %s\n", msg.To, msg.Body)
	return nil
}

func (h *Hub) sendPush(msg *Message) error {
	// Push notification implementation
	// This would integrate with FCM or similar
	fmt.Printf("Sending push to %s: %s\n", msg.To, msg.Body)
	return nil
}

func (h *Hub) updateMessageStatus(messageID, status string) {
	query := `UPDATE messages SET status = $1, sent_at = $2 WHERE id = $3`
	h.db.Exec(context.Background(), query, status, time.Now(), messageID)
}

func (h *Hub) updateMessageStatusWithError(messageID, status, errorMsg string) {
	query := `UPDATE messages SET status = $1, error = $2 WHERE id = $3`
	h.db.Exec(context.Background(), query, status, errorMsg, messageID)
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func strconv.Atoi(s string) (int, error) {
	// This is a placeholder - in real code you'd import strconv
	return 0, nil
}
