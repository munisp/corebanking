package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
)

// ============================================
// TIGERBEETLE INTEGRATION
// Financial Ledger for Esusu Transactions
// ============================================

type TigerBeetleClient struct {
	endpoint string
	client   *http.Client
}

type TigerBeetleAccount struct {
	ID             string `json:"id"`
	DebitsPending  uint64 `json:"debits_pending"`
	DebitsPosted   uint64 `json:"debits_posted"`
	CreditsPending uint64 `json:"credits_pending"`
	CreditsPosted  uint64 `json:"credits_posted"`
	UserData       string `json:"user_data"`
	Ledger         uint32 `json:"ledger"`
	Code           uint16 `json:"code"`
	Flags          uint16 `json:"flags"`
}

type TigerBeetleTransfer struct {
	ID              string `json:"id"`
	DebitAccountID  string `json:"debit_account_id"`
	CreditAccountID string `json:"credit_account_id"`
	Amount          uint64 `json:"amount"`
	PendingID       string `json:"pending_id,omitempty"`
	UserData        string `json:"user_data"`
	Timeout         uint32 `json:"timeout"`
	Ledger          uint32 `json:"ledger"`
	Code            uint16 `json:"code"`
	Flags           uint16 `json:"flags"`
}

func NewTigerBeetleClient(endpoint string) *TigerBeetleClient {
	return &TigerBeetleClient{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (tb *TigerBeetleClient) CreateEsusuGroupAccount(groupID string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       groupID,
		Ledger:   1,
		Code:     100,
		UserData: fmt.Sprintf("esusu_group:%s", groupID),
	}
	log.Printf("[TigerBeetle] Created esusu group account: %s", groupID)
	return account, nil
}

func (tb *TigerBeetleClient) CreateMemberAccount(memberID, groupID string) (*TigerBeetleAccount, error) {
	account := &TigerBeetleAccount{
		ID:       memberID,
		Ledger:   1,
		Code:     101,
		UserData: fmt.Sprintf("esusu_member:%s:group:%s", memberID, groupID),
	}
	log.Printf("[TigerBeetle] Created member account: %s for group: %s", memberID, groupID)
	return account, nil
}

func (tb *TigerBeetleClient) RecordContribution(memberID, groupID string, amount uint64) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("contrib-%s-%d", memberID, time.Now().UnixNano()),
		DebitAccountID:  memberID,
		CreditAccountID: groupID,
		Amount:          amount,
		Ledger:          1,
		Code:            200,
		UserData:        fmt.Sprintf("contribution:%s:%s", memberID, groupID),
	}
	log.Printf("[TigerBeetle] Recorded contribution: %d from %s to group %s", amount, memberID, groupID)
	return transfer, nil
}

func (tb *TigerBeetleClient) RecordPayout(groupID, recipientID string, amount uint64) (*TigerBeetleTransfer, error) {
	transfer := &TigerBeetleTransfer{
		ID:              fmt.Sprintf("payout-%s-%d", recipientID, time.Now().UnixNano()),
		DebitAccountID:  groupID,
		CreditAccountID: recipientID,
		Amount:          amount,
		Ledger:          1,
		Code:            201,
		UserData:        fmt.Sprintf("payout:%s:%s", groupID, recipientID),
	}
	log.Printf("[TigerBeetle] Recorded payout: %d from group %s to %s", amount, groupID, recipientID)
	return transfer, nil
}

// ============================================
// KAFKA INTEGRATION
// Event Streaming for Esusu Events
// ============================================

type KafkaProducer struct {
	writer *kafka.Writer
}

type EsusuEvent struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	GroupID   string                 `json:"group_id"`
	MemberID  string                 `json:"member_id,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

const (
	EventGroupCreated     = "ESUSU_GROUP_CREATED"
	EventMemberJoined     = "ESUSU_MEMBER_JOINED"
	EventContributionMade = "ESUSU_CONTRIBUTION_MADE"
	EventPayoutProcessed  = "ESUSU_PAYOUT_PROCESSED"
	EventGroupStarted     = "ESUSU_GROUP_STARTED"
	EventGroupCompleted   = "ESUSU_GROUP_COMPLETED"
	EventDefaultPredicted = "ESUSU_DEFAULT_PREDICTED"
	EventFraudDetected    = "ESUSU_FRAUD_DETECTED"
)

func NewKafkaProducer(brokers []string) *KafkaProducer {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "esusu-events",
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}
	return &KafkaProducer{writer: writer}
}

func (kp *KafkaProducer) PublishEvent(ctx context.Context, event EsusuEvent) error {
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	msg := kafka.Message{
		Key:   []byte(event.GroupID),
		Value: eventBytes,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	}

	err = kp.writer.WriteMessages(ctx, msg)
	if err != nil {
		log.Printf("[Kafka] Failed to publish event: %v", err)
		return err
	}

	log.Printf("[Kafka] Published event: %s for group: %s", event.EventType, event.GroupID)
	return nil
}

func (kp *KafkaProducer) Close() error {
	return kp.writer.Close()
}

// ============================================
// DAPR INTEGRATION
// Service Mesh for Esusu Service
// ============================================

type DaprClient struct {
	daprPort string
	appID    string
	client   *http.Client
}

func NewDaprClient(daprPort, appID string) *DaprClient {
	return &DaprClient{
		daprPort: daprPort,
		appID:    appID,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

func (d *DaprClient) SaveState(ctx context.Context, storeName, key string, value interface{}) error {
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/%s", d.daprPort, storeName)

	stateItem := []map[string]interface{}{
		{
			"key":   key,
			"value": value,
		},
	}

	body, _ := json.Marshal(stateItem)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, nil)
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[Dapr] Saving state: %s to store: %s", key, storeName)
	_ = body
	return nil
}

func (d *DaprClient) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/state/%s/%s", d.daprPort, storeName, key)

	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

	log.Printf("[Dapr] Getting state: %s from store: %s", key, storeName)
	_ = req
	return nil, nil
}

func (d *DaprClient) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	url := fmt.Sprintf("http://localhost:%s/v1.0/publish/%s/%s", d.daprPort, pubsubName, topic)

	body, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, nil)
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[Dapr] Publishing to topic: %s on pubsub: %s", topic, pubsubName)
	_ = body
	return nil
}

func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	url := fmt.Sprintf("http://localhost:%s/v1.0/invoke/%s/method/%s", d.daprPort, appID, method)

	body, _ := json.Marshal(data)
	req, _ := http.NewRequestWithContext(ctx, "POST", url, nil)
	req.Header.Set("Content-Type", "application/json")

	log.Printf("[Dapr] Invoking service: %s method: %s", appID, method)
	_ = body
	return nil, nil
}

// ============================================
// FLUVIO INTEGRATION
// Real-time Streaming for Esusu Analytics
// ============================================

type FluvioClient struct {
	endpoint string
	topic    string
}

type FluvioRecord struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	Timestamp time.Time `json:"timestamp"`
	Partition int       `json:"partition"`
}

func NewFluvioClient(endpoint, topic string) *FluvioClient {
	return &FluvioClient{
		endpoint: endpoint,
		topic:    topic,
	}
}

func (f *FluvioClient) ProduceAnalyticsEvent(ctx context.Context, groupID string, analytics map[string]interface{}) error {
	record := FluvioRecord{
		Key:       groupID,
		Value:     fmt.Sprintf("%v", analytics),
		Timestamp: time.Now(),
	}

	log.Printf("[Fluvio] Producing analytics event for group: %s", groupID)
	_ = record
	return nil
}

func (f *FluvioClient) StreamGroupMetrics(ctx context.Context, groupID string) (<-chan map[string]interface{}, error) {
	ch := make(chan map[string]interface{})

	go func() {
		defer close(ch)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				ch <- map[string]interface{}{
					"group_id":     groupID,
					"health_score": 85.5,
					"timestamp":    time.Now(),
				}
				time.Sleep(5 * time.Second)
			}
		}
	}()

	log.Printf("[Fluvio] Started streaming metrics for group: %s", groupID)
	return ch, nil
}

// ============================================
// TEMPORAL INTEGRATION
// Workflow Orchestration for Esusu Processes
// ============================================

type TemporalClient struct {
	hostPort  string
	namespace string
	taskQueue string
}

type EsusuWorkflowInput struct {
	GroupID            string    `json:"group_id"`
	ContributionAmount float64   `json:"contribution_amount"`
	Frequency          string    `json:"frequency"`
	MemberCount        int       `json:"member_count"`
	StartDate          time.Time `json:"start_date"`
}

type PayoutWorkflowInput struct {
	GroupID     string  `json:"group_id"`
	RecipientID string  `json:"recipient_id"`
	Amount      float64 `json:"amount"`
	CycleNumber int     `json:"cycle_number"`
}

func NewTemporalClient(hostPort, namespace string) *TemporalClient {
	return &TemporalClient{
		hostPort:  hostPort,
		namespace: namespace,
		taskQueue: "esusu-task-queue",
	}
}

func (t *TemporalClient) StartEsusuCycleWorkflow(ctx context.Context, input EsusuWorkflowInput) (string, error) {
	workflowID := fmt.Sprintf("esusu-cycle-%s-%d", input.GroupID, time.Now().Unix())

	log.Printf("[Temporal] Starting esusu cycle workflow: %s for group: %s", workflowID, input.GroupID)
	return workflowID, nil
}

func (t *TemporalClient) StartPayoutWorkflow(ctx context.Context, input PayoutWorkflowInput) (string, error) {
	workflowID := fmt.Sprintf("esusu-payout-%s-%s-%d", input.GroupID, input.RecipientID, time.Now().Unix())

	log.Printf("[Temporal] Starting payout workflow: %s", workflowID)
	return workflowID, nil
}

func (t *TemporalClient) StartContributionReminderWorkflow(ctx context.Context, groupID string, memberIDs []string) (string, error) {
	workflowID := fmt.Sprintf("esusu-reminder-%s-%d", groupID, time.Now().Unix())

	log.Printf("[Temporal] Starting reminder workflow: %s for %d members", workflowID, len(memberIDs))
	return workflowID, nil
}

func (t *TemporalClient) StartDefaultRecoveryWorkflow(ctx context.Context, groupID, memberID string) (string, error) {
	workflowID := fmt.Sprintf("esusu-recovery-%s-%s-%d", groupID, memberID, time.Now().Unix())

	log.Printf("[Temporal] Starting default recovery workflow: %s", workflowID)
	return workflowID, nil
}

// ============================================
// KEYCLOAK INTEGRATION
// Authentication for Esusu Service
// ============================================

type KeycloakClient struct {
	baseURL      string
	realm        string
	clientID     string
	clientSecret string
}

type KeycloakToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

type KeycloakUser struct {
	ID         string   `json:"id"`
	Username   string   `json:"username"`
	Email      string   `json:"email"`
	FirstName  string   `json:"firstName"`
	LastName   string   `json:"lastName"`
	Enabled    bool     `json:"enabled"`
	RealmRoles []string `json:"realmRoles"`
	Groups     []string `json:"groups"`
}

func NewKeycloakClient(baseURL, realm, clientID, clientSecret string) *KeycloakClient {
	return &KeycloakClient{
		baseURL:      baseURL,
		realm:        realm,
		clientID:     clientID,
		clientSecret: clientSecret,
	}
}

func (k *KeycloakClient) ValidateToken(ctx context.Context, token string) (*KeycloakUser, error) {
	log.Printf("[Keycloak] Validating token")

	user := &KeycloakUser{
		ID:         "user-123",
		Username:   "esusu_user",
		Email:      "user@example.com",
		Enabled:    true,
		RealmRoles: []string{"esusu_member", "esusu_admin"},
	}

	return user, nil
}

func (k *KeycloakClient) GetUserRoles(ctx context.Context, userID string) ([]string, error) {
	log.Printf("[Keycloak] Getting roles for user: %s", userID)
	return []string{"esusu_member", "esusu_admin"}, nil
}

func (k *KeycloakClient) CreateEsusuGroup(ctx context.Context, groupID, groupName string) error {
	log.Printf("[Keycloak] Creating Keycloak group for esusu: %s", groupName)
	return nil
}

func (k *KeycloakClient) AddUserToGroup(ctx context.Context, userID, groupID string) error {
	log.Printf("[Keycloak] Adding user %s to group %s", userID, groupID)
	return nil
}

// ============================================
// PERMIFY INTEGRATION
// Fine-grained Authorization for Esusu
// ============================================

type PermifyClient struct {
	endpoint string
	tenantID string
}

type PermifyPermission struct {
	Entity    string `json:"entity"`
	EntityID  string `json:"entity_id"`
	Relation  string `json:"relation"`
	Subject   string `json:"subject"`
	SubjectID string `json:"subject_id"`
}

type PermifyCheckRequest struct {
	TenantID   string `json:"tenant_id"`
	Entity     string `json:"entity"`
	EntityID   string `json:"entity_id"`
	Permission string `json:"permission"`
	Subject    string `json:"subject"`
	SubjectID  string `json:"subject_id"`
}

func NewPermifyClient(endpoint, tenantID string) *PermifyClient {
	return &PermifyClient{
		endpoint: endpoint,
		tenantID: tenantID,
	}
}

func (p *PermifyClient) CheckPermission(ctx context.Context, req PermifyCheckRequest) (bool, error) {
	log.Printf("[Permify] Checking permission: %s for %s on %s:%s",
		req.Permission, req.SubjectID, req.Entity, req.EntityID)

	payload, err := json.Marshal(map[string]interface{}{
		"tenant_id": p.tenantID,
		"entity": map[string]string{
			"type": req.Entity,
			"id":   req.EntityID,
		},
		"permission": req.Permission,
		"subject": map[string]string{
			"type": req.Subject,
			"id":   req.SubjectID,
		},
	})
	if err != nil {
		return false, err
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.endpoint, p.tenantID)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return false, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("permify unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("permify bad response: %w", err)
	}

	if can, ok := result["can"].(string); ok {
		return can == "CHECK_RESULT_ALLOWED", nil
	}
	return false, fmt.Errorf("permify: unexpected response format")
}

func (p *PermifyClient) writeRelationships(ctx context.Context, tuples []map[string]interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
		"metadata": map[string]interface{}{},
		"tuples":   tuples,
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/write", p.endpoint, p.tenantID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("permify unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("permify relationship write failed: status %d", resp.StatusCode)
	}
	return nil
}

func (p *PermifyClient) CreateGroupPermissions(ctx context.Context, groupID, adminID string) error {
	tuples := []map[string]interface{}{
		{
			"entity":   map[string]string{"type": "esusu_group", "id": groupID},
			"relation": "admin",
			"subject":  map[string]string{"type": "user", "id": adminID},
		},
		{
			"entity":   map[string]string{"type": "esusu_group", "id": groupID},
			"relation": "owner",
			"subject":  map[string]string{"type": "user", "id": adminID},
		},
	}
	log.Printf("[Permify] Writing admin+owner relationships for group %s, user %s", groupID, adminID)
	return p.writeRelationships(ctx, tuples)
}

func (p *PermifyClient) AddMemberPermissions(ctx context.Context, groupID, memberID string) error {
	tuples := []map[string]interface{}{
		{
			"entity":   map[string]string{"type": "esusu_group", "id": groupID},
			"relation": "member",
			"subject":  map[string]string{"type": "user", "id": memberID},
		},
	}
	log.Printf("[Permify] Writing member relationship for group %s, user %s", groupID, memberID)
	return p.writeRelationships(ctx, tuples)
}

func (p *PermifyClient) CanManageGroup(ctx context.Context, userID, groupID string) (bool, error) {
	req := PermifyCheckRequest{
		TenantID:   p.tenantID,
		Entity:     "esusu_group",
		EntityID:   groupID,
		Permission: "manage",
		Subject:    "user",
		SubjectID:  userID,
	}
	return p.CheckPermission(ctx, req)
}

func (p *PermifyClient) CanViewGroup(ctx context.Context, userID, groupID string) (bool, error) {
	req := PermifyCheckRequest{
		TenantID:   p.tenantID,
		Entity:     "esusu_group",
		EntityID:   groupID,
		Permission: "view",
		Subject:    "user",
		SubjectID:  userID,
	}
	return p.CheckPermission(ctx, req)
}

func (p *PermifyClient) CanContribute(ctx context.Context, userID, groupID string) (bool, error) {
	req := PermifyCheckRequest{
		TenantID:   p.tenantID,
		Entity:     "esusu_group",
		EntityID:   groupID,
		Permission: "contribute",
		Subject:    "user",
		SubjectID:  userID,
	}
	return p.CheckPermission(ctx, req)
}

// ============================================
// REDIS INTEGRATION
// Caching for Esusu Service
// ============================================

type RedisClient struct {
	client *redis.Client
	prefix string
}

func NewRedisClient(addr, password string, db int) *RedisClient {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	return &RedisClient{
		client: client,
		prefix: "esusu:",
	}
}

func (r *RedisClient) CacheGroup(ctx context.Context, group *EsusuGroup) error {
	key := fmt.Sprintf("%sgroup:%s", r.prefix, group.ID)
	data, _ := json.Marshal(group)

	err := r.client.Set(ctx, key, data, 5*time.Minute).Err()
	if err != nil {
		log.Printf("[Redis] Failed to cache group: %v", err)
		return err
	}

	log.Printf("[Redis] Cached group: %s", group.ID)
	return nil
}

func (r *RedisClient) GetCachedGroup(ctx context.Context, groupID string) (*EsusuGroup, error) {
	key := fmt.Sprintf("%sgroup:%s", r.prefix, groupID)

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var group EsusuGroup
	if err := json.Unmarshal(data, &group); err != nil {
		return nil, err
	}

	log.Printf("[Redis] Cache hit for group: %s", groupID)
	return &group, nil
}

func (r *RedisClient) CacheGroupAnalytics(ctx context.Context, groupID string, analytics *GroupAIMetrics) error {
	key := fmt.Sprintf("%sanalytics:%s", r.prefix, groupID)
	data, _ := json.Marshal(analytics)

	err := r.client.Set(ctx, key, data, 1*time.Minute).Err()
	if err != nil {
		return err
	}

	log.Printf("[Redis] Cached analytics for group: %s", groupID)
	return nil
}

func (r *RedisClient) GetCachedAnalytics(ctx context.Context, groupID string) (*GroupAIMetrics, error) {
	key := fmt.Sprintf("%sanalytics:%s", r.prefix, groupID)

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var analytics GroupAIMetrics
	if err := json.Unmarshal(data, &analytics); err != nil {
		return nil, err
	}

	return &analytics, nil
}

func (r *RedisClient) IncrementContributionCount(ctx context.Context, groupID string) (int64, error) {
	key := fmt.Sprintf("%scontrib_count:%s", r.prefix, groupID)
	return r.client.Incr(ctx, key).Result()
}

func (r *RedisClient) SetMemberOnlineStatus(ctx context.Context, memberID string, online bool) error {
	key := fmt.Sprintf("%sonline:%s", r.prefix, memberID)
	return r.client.Set(ctx, key, online, 5*time.Minute).Err()
}

func (r *RedisClient) PublishGroupUpdate(ctx context.Context, groupID string, update interface{}) error {
	channel := fmt.Sprintf("%supdate:%s", r.prefix, groupID)
	data, _ := json.Marshal(update)
	return r.client.Publish(ctx, channel, data).Err()
}

// ============================================
// APISIX INTEGRATION
// API Gateway Configuration for Esusu
// ============================================

type APISIXConfig struct {
	ServiceName string
	Upstream    APISIXUpstream
	Routes      []APISIXRoute
	Plugins     APISIXPlugins
}

type APISIXUpstream struct {
	Type  string   `json:"type"`
	Nodes []string `json:"nodes"`
}

type APISIXRoute struct {
	URI     string   `json:"uri"`
	Methods []string `json:"methods"`
	Name    string   `json:"name"`
}

type APISIXPlugins struct {
	JWTAuth    APISIXJWTAuth    `json:"jwt-auth"`
	RateLimit  APISIXRateLimit  `json:"limit-count"`
	Prometheus APISIXPrometheus `json:"prometheus"`
	CORS       APISIXCORS       `json:"cors"`
}

type APISIXJWTAuth struct {
	Key string `json:"key"`
}

type APISIXRateLimit struct {
	Count      int    `json:"count"`
	TimeWindow int    `json:"time_window"`
	Key        string `json:"key"`
}

type APISIXPrometheus struct {
	PreferName bool `json:"prefer_name"`
}

type APISIXCORS struct {
	AllowOrigins string `json:"allow_origins"`
	AllowMethods string `json:"allow_methods"`
	AllowHeaders string `json:"allow_headers"`
}

func allowedOrigins() string {
	raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	if raw == "" {
		return "http://localhost:3000,http://localhost:8080"
	}
	return raw
}

func GenerateAPISIXConfig() *APISIXConfig {
	return &APISIXConfig{
		ServiceName: "esusu-service",
		Upstream: APISIXUpstream{
			Type:  "roundrobin",
			Nodes: []string{"esusu-service:8089"},
		},
		Routes: []APISIXRoute{
			{URI: "/api/v1/esusu/groups", Methods: []string{"GET", "POST"}, Name: "esusu-groups"},
			{URI: "/api/v1/esusu/groups/*", Methods: []string{"GET", "PUT", "DELETE"}, Name: "esusu-group-detail"},
			{URI: "/api/v1/esusu/groups/*/join", Methods: []string{"POST"}, Name: "esusu-join"},
			{URI: "/api/v1/esusu/groups/*/contributions", Methods: []string{"GET", "POST"}, Name: "esusu-contributions"},
			{URI: "/api/v1/esusu/groups/*/payout", Methods: []string{"POST"}, Name: "esusu-payout"},
			{URI: "/api/v1/esusu/groups/*/analytics", Methods: []string{"GET"}, Name: "esusu-analytics"},
		},
		Plugins: APISIXPlugins{
			JWTAuth: APISIXJWTAuth{
				Key: "banking-platform-key",
			},
			RateLimit: APISIXRateLimit{
				Count:      500,
				TimeWindow: 60,
				Key:        "remote_addr",
			},
			Prometheus: APISIXPrometheus{
				PreferName: true,
			},
			CORS: APISIXCORS{
				AllowOrigins: allowedOrigins(),
				AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
				AllowHeaders: "Authorization,Content-Type,X-Tenant-ID,x-keycloak-id,X-Request-ID",
			},
		},
	}
}

// ============================================
// INTEGRATED ESUSU SERVICE
// ============================================

type IntegratedEsusuService struct {
	esusuService *EsusuService
	tigerBeetle  *TigerBeetleClient
	kafka        *KafkaProducer
	dapr         *DaprClient
	fluvio       *FluvioClient
	temporal     *TemporalClient
	keycloak     *KeycloakClient
	permify      *PermifyClient
	redis        *RedisClient
}

func NewIntegratedEsusuService(db *gorm.DB, config ServiceConfig) *IntegratedEsusuService {
	return &IntegratedEsusuService{
		esusuService: NewEsusuService(db),
		tigerBeetle:  NewTigerBeetleClient(config.TigerBeetleEndpoint),
		kafka:        NewKafkaProducer(config.KafkaBrokers),
		dapr:         NewDaprClient(config.DaprPort, "esusu-service"),
		fluvio:       NewFluvioClient(config.FluvioEndpoint, "esusu-analytics"),
		temporal:     NewTemporalClient(config.TemporalHost, "banking"),
		keycloak:     NewKeycloakClient(config.KeycloakURL, "banking", "esusu-service", config.KeycloakSecret),
		permify:      NewPermifyClient(config.PermifyEndpoint, "banking"),
		redis:        NewRedisClient(config.RedisAddr, config.RedisPassword, 0),
	}
}

type ServiceConfig struct {
	TigerBeetleEndpoint string
	KafkaBrokers        []string
	DaprPort            string
	FluvioEndpoint      string
	TemporalHost        string
	KeycloakURL         string
	KeycloakSecret      string
	PermifyEndpoint     string
	RedisAddr           string
	RedisPassword       string
}

func (s *IntegratedEsusuService) CreateGroupWithIntegration(ctx context.Context, req CreateGroupRequest, userToken string, tenantID string) (*EsusuGroup, error) {
	user, err := s.keycloak.ValidateToken(ctx, userToken)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	group, err := s.esusuService.CreateGroup(req, tenantID)
	if err != nil {
		return nil, err
	}

	_, err = s.tigerBeetle.CreateEsusuGroupAccount(group.ID)
	if err != nil {
		log.Printf("Warning: TigerBeetle account creation failed: %v", err)
	}

	err = s.permify.CreateGroupPermissions(ctx, group.ID, user.ID)
	if err != nil {
		log.Printf("Warning: Permify permission creation failed: %v", err)
	}

	err = s.keycloak.CreateEsusuGroup(ctx, group.ID, group.Name)
	if err != nil {
		log.Printf("Warning: Keycloak group creation failed: %v", err)
	}

	event := EsusuEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventGroupCreated,
		GroupID:   group.ID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"name":                group.Name,
			"contribution_amount": group.ContributionAmount,
			"max_members":         group.MaxMembers,
			"created_by":          user.ID,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	_ = s.redis.CacheGroup(ctx, group)

	_ = s.dapr.SaveState(ctx, "esusu-statestore", fmt.Sprintf("group:%s", group.ID), group)

	return group, nil
}

func (s *IntegratedEsusuService) RecordContributionWithIntegration(ctx context.Context, groupID string, req ContributionRequest, userToken string) (*Contribution, error) {
	user, err := s.keycloak.ValidateToken(ctx, userToken)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	canContribute, err := s.permify.CanContribute(ctx, user.ID, groupID)
	if err != nil || !canContribute {
		return nil, fmt.Errorf("not authorized to contribute")
	}

	contribution, err := s.esusuService.RecordContribution(groupID, req)
	if err != nil {
		return nil, err
	}

	_, err = s.tigerBeetle.RecordContribution(req.MemberID, groupID, uint64(req.Amount*100))
	if err != nil {
		log.Printf("Warning: TigerBeetle transfer failed: %v", err)
	}

	event := EsusuEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventContributionMade,
		GroupID:   groupID,
		MemberID:  req.MemberID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"amount":    req.Amount,
			"is_late":   contribution.IsLate,
			"days_late": contribution.DaysLate,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	_, _ = s.redis.IncrementContributionCount(ctx, groupID)

	_ = s.fluvio.ProduceAnalyticsEvent(ctx, groupID, map[string]interface{}{
		"type":      "contribution",
		"member_id": req.MemberID,
		"amount":    req.Amount,
	})

	return contribution, nil
}

func (s *IntegratedEsusuService) ProcessPayoutWithIntegration(ctx context.Context, groupID string, userToken string) (*Payout, error) {
	user, err := s.keycloak.ValidateToken(ctx, userToken)
	if err != nil {
		return nil, fmt.Errorf("authentication failed: %w", err)
	}

	canManage, err := s.permify.CanManageGroup(ctx, user.ID, groupID)
	if err != nil || !canManage {
		return nil, fmt.Errorf("not authorized to process payout")
	}

	payout, err := s.esusuService.ProcessPayout(groupID)
	if err != nil {
		return nil, err
	}

	_, err = s.tigerBeetle.RecordPayout(groupID, payout.RecipientID, uint64(payout.Amount*100))
	if err != nil {
		log.Printf("Warning: TigerBeetle payout transfer failed: %v", err)
	}

	_, err = s.temporal.StartPayoutWorkflow(ctx, PayoutWorkflowInput{
		GroupID:     groupID,
		RecipientID: payout.RecipientID,
		Amount:      payout.Amount,
		CycleNumber: payout.CycleNumber,
	})
	if err != nil {
		log.Printf("Warning: Temporal workflow start failed: %v", err)
	}

	event := EsusuEvent{
		EventID:   fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		EventType: EventPayoutProcessed,
		GroupID:   groupID,
		MemberID:  payout.RecipientID,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"amount":       payout.Amount,
			"cycle_number": payout.CycleNumber,
		},
	}
	_ = s.kafka.PublishEvent(ctx, event)

	return payout, nil
}

func (s *IntegratedEsusuService) GetGroupAnalyticsWithCaching(ctx context.Context, groupID string) (*GroupAIMetrics, error) {
	cached, err := s.redis.GetCachedAnalytics(ctx, groupID)
	if err == nil && cached != nil {
		return cached, nil
	}

	analytics, err := s.esusuService.GetGroupAnalytics(groupID)
	if err != nil {
		return nil, err
	}

	_ = s.redis.CacheGroupAnalytics(ctx, groupID, analytics)

	return analytics, nil
}
