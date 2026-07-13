package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
)

// Real-Time Notifications Service for 54Bank
// WebSocket and Server-Sent Events (SSE) implementation

// Prometheus metrics
var (
	wsConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "websocket_connections_active",
			Help: "Number of active WebSocket connections",
		},
	)

	wsMessages = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "websocket_messages_total",
			Help: "Total WebSocket messages sent",
		},
		[]string{"type", "status"},
	)

	notificationsSent = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "notifications_sent_total",
			Help: "Total notifications sent",
		},
		[]string{"channel", "type"},
	)
)

// NotificationType represents types of notifications
type NotificationType string

const (
	NotificationTypeTransaction    NotificationType = "transaction"
	NotificationTypeTransfer       NotificationType = "transfer"
	NotificationTypePayment        NotificationType = "payment"
	NotificationTypeLoan           NotificationType = "loan"
	NotificationTypeAlert          NotificationType = "alert"
	NotificationTypePromotion      NotificationType = "promotion"
	NotificationTypeSystem         NotificationType = "system"
	NotificationTypeKYC            NotificationType = "kyc"
	NotificationTypeSecurity       NotificationType = "security"
	NotificationTypeAccountUpdate  NotificationType = "account_update"
)

// NotificationPriority represents notification priority
type NotificationPriority string

const (
	PriorityLow      NotificationPriority = "low"
	PriorityNormal   NotificationPriority = "normal"
	PriorityHigh     NotificationPriority = "high"
	PriorityCritical NotificationPriority = "critical"
)

// Notification represents a notification message
type Notification struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"user_id"`
	TenantID    string                 `json:"tenant_id,omitempty"`
	Type        NotificationType       `json:"type"`
	Priority    NotificationPriority   `json:"priority"`
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	Data        map[string]interface{} `json:"data,omitempty"`
	ActionURL   string                 `json:"action_url,omitempty"`
	ImageURL    string                 `json:"image_url,omitempty"`
	Read        bool                   `json:"read"`
	CreatedAt   time.Time              `json:"created_at"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
}

// WebSocketClient represents a connected WebSocket client
type WebSocketClient struct {
	ID         string
	UserID     string
	TenantID   string
	Conn       *websocket.Conn
	Send       chan []byte
	Hub        *WebSocketHub
	LastPing   time.Time
	DeviceInfo DeviceInfo
}

// DeviceInfo contains client device information
type DeviceInfo struct {
	Platform   string `json:"platform"`
	AppVersion string `json:"app_version"`
	DeviceID   string `json:"device_id"`
}

// WebSocketHub manages all WebSocket connections
type WebSocketHub struct {
	clients    map[string]*WebSocketClient
	userIndex  map[string]map[string]*WebSocketClient // userID -> clientID -> client
	broadcast  chan *Notification
	register   chan *WebSocketClient
	unregister chan *WebSocketClient
	mutex      sync.RWMutex
	redis      *redis.Client
}

// NewWebSocketHub creates a new WebSocket hub
func NewWebSocketHub(redisClient *redis.Client) *WebSocketHub {
	hub := &WebSocketHub{
		clients:    make(map[string]*WebSocketClient),
		userIndex:  make(map[string]map[string]*WebSocketClient),
		broadcast:  make(chan *Notification, 1000),
		register:   make(chan *WebSocketClient),
		unregister: make(chan *WebSocketClient),
		redis:      redisClient,
	}

	go hub.run()
	go hub.subscribeToRedis()

	return hub
}

func (h *WebSocketHub) run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case notification := <-h.broadcast:
			h.broadcastNotification(notification)
		}
	}
}

func (h *WebSocketHub) registerClient(client *WebSocketClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	h.clients[client.ID] = client

	if h.userIndex[client.UserID] == nil {
		h.userIndex[client.UserID] = make(map[string]*WebSocketClient)
	}
	h.userIndex[client.UserID][client.ID] = client

	wsConnections.Inc()
}

func (h *WebSocketHub) unregisterClient(client *WebSocketClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	if _, ok := h.clients[client.ID]; ok {
		delete(h.clients, client.ID)
		close(client.Send)

		if h.userIndex[client.UserID] != nil {
			delete(h.userIndex[client.UserID], client.ID)
			if len(h.userIndex[client.UserID]) == 0 {
				delete(h.userIndex, client.UserID)
			}
		}

		wsConnections.Dec()
	}
}

func (h *WebSocketHub) broadcastNotification(notification *Notification) {
	h.mutex.RLock()
	clients := h.userIndex[notification.UserID]
	h.mutex.RUnlock()

	if clients == nil {
		return
	}

	data, err := json.Marshal(notification)
	if err != nil {
		return
	}

	for _, client := range clients {
		select {
		case client.Send <- data:
			wsMessages.WithLabelValues(string(notification.Type), "sent").Inc()
		default:
			// Client buffer full, close connection
			h.unregister <- client
			wsMessages.WithLabelValues(string(notification.Type), "dropped").Inc()
		}
	}
}

func (h *WebSocketHub) subscribeToRedis() {
	ctx := context.Background()
	pubsub := h.redis.Subscribe(ctx, "notifications")
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		var notification Notification
		if err := json.Unmarshal([]byte(msg.Payload), &notification); err != nil {
			continue
		}

		h.broadcast <- &notification
	}
}

// SendToUser sends a notification to a specific user
func (h *WebSocketHub) SendToUser(userID string, notification *Notification) {
	notification.UserID = userID
	h.broadcast <- notification
}

// SendToTenant sends a notification to all users in a tenant
func (h *WebSocketHub) SendToTenant(tenantID string, notification *Notification) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for _, client := range h.clients {
		if client.TenantID == tenantID {
			notification.UserID = client.UserID
			h.broadcast <- notification
		}
	}
}

// Broadcast sends a notification to all connected users
func (h *WebSocketHub) Broadcast(notification *Notification) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	for userID := range h.userIndex {
		notificationCopy := *notification
		notificationCopy.UserID = userID
		h.broadcast <- &notificationCopy
	}
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, validate origin
		return true
	},
}

// WebSocketHandler handles WebSocket connections
func WebSocketHandler(hub *WebSocketHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Authenticate user from token
		userID := r.URL.Query().Get("user_id")
		tenantID := r.URL.Query().Get("tenant_id")
		token := r.URL.Query().Get("token")

		if userID == "" || token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Validate token (implementation would verify JWT)
		if !validateToken(token, userID) {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Upgrade connection
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		client := &WebSocketClient{
			ID:       uuid.New().String(),
			UserID:   userID,
			TenantID: tenantID,
			Conn:     conn,
			Send:     make(chan []byte, 256),
			Hub:      hub,
			LastPing: time.Now(),
			DeviceInfo: DeviceInfo{
				Platform:   r.Header.Get("X-Platform"),
				AppVersion: r.Header.Get("X-App-Version"),
				DeviceID:   r.Header.Get("X-Device-ID"),
			},
		}

		hub.register <- client

		go client.writePump()
		go client.readPump()
	}
}

func (c *WebSocketClient) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.LastPing = time.Now()
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		// Handle incoming messages (e.g., mark as read)
		c.handleMessage(message)
	}
}

func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Batch pending messages
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *WebSocketClient) handleMessage(message []byte) {
	var msg struct {
		Action string `json:"action"`
		ID     string `json:"id"`
	}

	if err := json.Unmarshal(message, &msg); err != nil {
		return
	}

	switch msg.Action {
	case "mark_read":
		// Mark notification as read
	case "mark_all_read":
		// Mark all notifications as read
	}
}

func validateToken(token, userID string) bool {
	// Implementation would validate JWT token
	return true
}

// Server-Sent Events (SSE) Handler
func SSEHandler(hub *WebSocketHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		token := r.URL.Query().Get("token")

		if userID == "" || token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !validateToken(token, userID) {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Set SSE headers
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		// Create notification channel
		notifications := make(chan *Notification, 100)

		// Subscribe to user notifications
		ctx := r.Context()
		go func() {
			pubsub := hub.redis.Subscribe(ctx, fmt.Sprintf("user:%s:notifications", userID))
			defer pubsub.Close()

			for msg := range pubsub.Channel() {
				var notification Notification
				if err := json.Unmarshal([]byte(msg.Payload), &notification); err != nil {
					continue
				}
				notifications <- &notification
			}
		}()

		// Send events
		for {
			select {
			case <-ctx.Done():
				return
			case notification := <-notifications:
				data, _ := json.Marshal(notification)
				fmt.Fprintf(w, "event: notification\n")
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
				notificationsSent.WithLabelValues("sse", string(notification.Type)).Inc()
			case <-time.After(30 * time.Second):
				// Send keepalive
				fmt.Fprintf(w, ": keepalive\n\n")
				flusher.Flush()
			}
		}
	}
}

// NotificationService handles notification creation and delivery
type NotificationService struct {
	hub         *WebSocketHub
	redis       *redis.Client
	pushService PushNotificationService
}

// PushNotificationService interface for push notifications
type PushNotificationService interface {
	SendPush(ctx context.Context, userID string, notification *Notification) error
}

// NewNotificationService creates a new notification service
func NewNotificationService(hub *WebSocketHub, redis *redis.Client, push PushNotificationService) *NotificationService {
	return &NotificationService{
		hub:         hub,
		redis:       redis,
		pushService: push,
	}
}

// Send sends a notification through all channels
func (s *NotificationService) Send(ctx context.Context, notification *Notification) error {
	notification.ID = uuid.New().String()
	notification.CreatedAt = time.Now()

	// Store notification
	if err := s.storeNotification(ctx, notification); err != nil {
		return err
	}

	// Send via WebSocket
	s.hub.SendToUser(notification.UserID, notification)

	// Publish to Redis for other instances
	data, _ := json.Marshal(notification)
	s.redis.Publish(ctx, fmt.Sprintf("user:%s:notifications", notification.UserID), data)

	// Send push notification for high priority
	if notification.Priority == PriorityHigh || notification.Priority == PriorityCritical {
		if s.pushService != nil {
			s.pushService.SendPush(ctx, notification.UserID, notification)
		}
	}

	notificationsSent.WithLabelValues("all", string(notification.Type)).Inc()
	return nil
}

func (s *NotificationService) storeNotification(ctx context.Context, notification *Notification) error {
	data, err := json.Marshal(notification)
	if err != nil {
		return err
	}

	// Store in Redis list
	key := fmt.Sprintf("user:%s:notifications:list", notification.UserID)
	s.redis.LPush(ctx, key, data)
	s.redis.LTrim(ctx, key, 0, 99) // Keep last 100 notifications

	return nil
}

// GetNotifications retrieves notifications for a user
func (s *NotificationService) GetNotifications(ctx context.Context, userID string, limit int) ([]*Notification, error) {
	key := fmt.Sprintf("user:%s:notifications:list", userID)
	data, err := s.redis.LRange(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}

	notifications := make([]*Notification, 0, len(data))
	for _, d := range data {
		var n Notification
		if err := json.Unmarshal([]byte(d), &n); err != nil {
			continue
		}
		notifications = append(notifications, &n)
	}

	return notifications, nil
}

// MarkAsRead marks a notification as read
func (s *NotificationService) MarkAsRead(ctx context.Context, userID, notificationID string) error {
	// Implementation would update notification status
	return nil
}

// Firebase Push Notification Implementation
type FirebasePushService struct {
	// client *messaging.Client
}

func (f *FirebasePushService) SendPush(ctx context.Context, userID string, notification *Notification) error {
	// Get user's FCM tokens
	// Send push notification via Firebase
	notificationsSent.WithLabelValues("push", string(notification.Type)).Inc()
	return nil
}

// APNs Push Notification Implementation
type APNsPushService struct {
	// client *apns2.Client
}

func (a *APNsPushService) SendPush(ctx context.Context, userID string, notification *Notification) error {
	// Get user's device tokens
	// Send push notification via APNs
	notificationsSent.WithLabelValues("apns", string(notification.Type)).Inc()
	return nil
}

// Notification Templates
var NotificationTemplates = map[string]struct {
	Title string
	Body  string
}{
	"transfer_sent": {
		Title: "Transfer Successful",
		Body:  "You sent ₦{{.Amount}} to {{.RecipientName}}",
	},
	"transfer_received": {
		Title: "Money Received",
		Body:  "You received ₦{{.Amount}} from {{.SenderName}}",
	},
	"loan_approved": {
		Title: "Loan Approved",
		Body:  "Your loan of ₦{{.Amount}} has been approved",
	},
	"loan_due": {
		Title: "Loan Payment Due",
		Body:  "Your loan payment of ₦{{.Amount}} is due on {{.DueDate}}",
	},
	"low_balance": {
		Title: "Low Balance Alert",
		Body:  "Your account balance is below ₦{{.Threshold}}",
	},
	"security_alert": {
		Title: "Security Alert",
		Body:  "{{.Message}}",
	},
}

// Global notification service
var GlobalNotificationService *NotificationService

// InitNotificationService initializes the global notification service
func InitNotificationService(redisClient *redis.Client) {
	hub := NewWebSocketHub(redisClient)
	push := &FirebasePushService{}
	GlobalNotificationService = NewNotificationService(hub, redisClient, push)
}
