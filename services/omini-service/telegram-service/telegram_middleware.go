package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
)

type KeycloakClient struct {
	baseURL      string
	realm        string
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

type PermifyClient struct {
	baseURL    string
	httpClient *http.Client
}

type DaprClient struct {
	baseURL    string
	httpClient *http.Client
}

type FluvioClient struct {
	baseURL    string
	httpClient *http.Client
}

type TemporalClient struct {
	host       string
	namespace  string
	taskQueue  string
	httpClient *http.Client
}

type LakehouseClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewKeycloakClient(baseURL, realm, clientID, clientSecret string) *KeycloakClient {
	return &KeycloakClient{
		baseURL:      baseURL,
		realm:        realm,
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (k *KeycloakClient) ValidateToken(ctx context.Context, token string) (bool, map[string]interface{}, error) {
	url := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect", k.baseURL, k.realm)

	data := fmt.Sprintf("token=%s&client_id=%s&client_secret=%s", token, k.clientID, k.clientSecret)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(data))
	if err != nil {
		return false, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return false, nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, nil, err
	}

	active, ok := result["active"].(bool)
	if !ok || !active {
		return false, nil, nil
	}

	return true, result, nil
}

func (k *KeycloakClient) GetServiceToken(ctx context.Context) (string, error) {
	url := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", k.baseURL, k.realm)

	data := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", k.clientID, k.clientSecret)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := k.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	token, ok := result["access_token"].(string)
	if !ok {
		return "", fmt.Errorf("no access token in response")
	}

	return token, nil
}

func NewPermifyClient(baseURL string) *PermifyClient {
	return &PermifyClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *PermifyClient) CheckPermission(ctx context.Context, tenantID, subjectType, subjectID, permission, objectType, objectID string) (bool, error) {
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", p.baseURL, tenantID)

	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		"entity": map[string]interface{}{
			"type": objectType,
			"id":   objectID,
		},
		"permission": permission,
		"subject": map[string]interface{}{
			"type": subjectType,
			"id":   subjectID,
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	can, ok := result["can"].(string)
	return ok && can == "CHECK_RESULT_ALLOWED", nil
}

func (p *PermifyClient) WriteRelationship(ctx context.Context, tenantID, entityType, entityID, relation, subjectType, subjectID string) error {
	url := fmt.Sprintf("%s/v1/tenants/%s/relationships/write", p.baseURL, tenantID)

	payload := map[string]interface{}{
		"metadata": map[string]interface{}{
			"schema_version": "",
		},
		"tuples": []map[string]interface{}{
			{
				"entity": map[string]interface{}{
					"type": entityType,
					"id":   entityID,
				},
				"relation": relation,
				"subject": map[string]interface{}{
					"type": subjectType,
					"id":   subjectID,
				},
			},
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to write relationship: %d", resp.StatusCode)
	}

	return nil
}

func NewDaprClient(baseURL string) *DaprClient {
	return &DaprClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (d *DaprClient) PublishEvent(ctx context.Context, pubsubName, topic string, data interface{}) error {
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", d.baseURL, pubsubName, topic)

	body, _ := json.Marshal(data)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to publish event: %d", resp.StatusCode)
	}

	return nil
}

func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data interface{}) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", d.baseURL, appID, method)

	body, _ := json.Marshal(data)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func (d *DaprClient) GetState(ctx context.Context, storeName, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/v1.0/state/%s/%s", d.baseURL, storeName, key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	return io.ReadAll(resp.Body)
}

func (d *DaprClient) SaveState(ctx context.Context, storeName, key string, value interface{}) error {
	url := fmt.Sprintf("%s/v1.0/state/%s", d.baseURL, storeName)

	payload := []map[string]interface{}{
		{
			"key":   key,
			"value": value,
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to save state: %d", resp.StatusCode)
	}

	return nil
}

func NewFluvioClient(baseURL string) *FluvioClient {
	return &FluvioClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (f *FluvioClient) ProduceRecord(ctx context.Context, topic string, key string, value interface{}) error {
	url := fmt.Sprintf("%s/api/v1/topics/%s/produce", f.baseURL, topic)

	payload := map[string]interface{}{
		"key":   key,
		"value": value,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func NewTemporalClient(host, namespace, taskQueue string) *TemporalClient {
	return &TemporalClient{
		host:       host,
		namespace:  namespace,
		taskQueue:  taskQueue,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (t *TemporalClient) StartWorkflow(ctx context.Context, workflowType, workflowID string, input interface{}) (string, error) {
	url := fmt.Sprintf("http://%s/api/v1/namespaces/%s/workflows/%s", t.host, t.namespace, workflowID)

	payload := map[string]interface{}{
		"workflowType": map[string]string{
			"name": workflowType,
		},
		"taskQueue": map[string]string{
			"name": t.taskQueue,
		},
		"input": []interface{}{input},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	runID, _ := result["runId"].(string)
	return runID, nil
}

func (t *TemporalClient) SignalWorkflow(ctx context.Context, workflowID, runID, signalName string, input interface{}) error {
	url := fmt.Sprintf("http://%s/api/v1/namespaces/%s/workflows/%s/signal/%s", t.host, t.namespace, workflowID, signalName)

	payload := map[string]interface{}{
		"runId": runID,
		"input": []interface{}{input},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func NewLakehouseClient(baseURL string) *LakehouseClient {
	return &LakehouseClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (l *LakehouseClient) WriteEvent(ctx context.Context, namespace, table string, data interface{}) error {
	url := fmt.Sprintf("%s/v1/namespaces/%s/tables/%s/data", l.baseURL, namespace, table)

	body, _ := json.Marshal(data)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (l *LakehouseClient) QueryTable(ctx context.Context, namespace, table, query string) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/v1/namespaces/%s/tables/%s/query", l.baseURL, namespace, table)

	payload := map[string]string{
		"query": query,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

type RateLimiter struct {
	redis  *redis.Client
	prefix string
}

func NewRateLimiter(redis *redis.Client, prefix string) *RateLimiter {
	return &RateLimiter{
		redis:  redis,
		prefix: prefix,
	}
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

	count := incr.Val()
	return count <= int64(limit), nil
}

func (r *RateLimiter) GetRemaining(ctx context.Context, key string, limit int) (int, error) {
	fullKey := fmt.Sprintf("%s:%s", r.prefix, key)

	count, err := r.redis.Get(ctx, fullKey).Int()
	if err == redis.Nil {
		return limit, nil
	}
	if err != nil {
		return 0, err
	}

	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	return remaining, nil
}

type CircuitBreaker struct {
	redis       *redis.Client
	name        string
	threshold   int
	timeout     time.Duration
	halfOpenMax int
}

func NewCircuitBreaker(redis *redis.Client, name string, threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		redis:       redis,
		name:        name,
		threshold:   threshold,
		timeout:     timeout,
		halfOpenMax: 3,
	}
}

func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
	state, _ := cb.getState(ctx)

	switch state {
	case "open":
		openTime, _ := cb.getOpenTime(ctx)
		if time.Since(openTime) > cb.timeout {
			cb.setState(ctx, "half-open")
		} else {
			return fmt.Errorf("circuit breaker is open")
		}
	case "half-open":
		attempts, _ := cb.getHalfOpenAttempts(ctx)
		if attempts >= cb.halfOpenMax {
			return fmt.Errorf("circuit breaker is half-open, max attempts reached")
		}
		cb.incrementHalfOpenAttempts(ctx)
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

func (cb *CircuitBreaker) getHalfOpenAttempts(ctx context.Context) (int, error) {
	return cb.redis.Get(ctx, fmt.Sprintf("cb:%s:half_open_attempts", cb.name)).Int()
}

func (cb *CircuitBreaker) incrementHalfOpenAttempts(ctx context.Context) error {
	return cb.redis.Incr(ctx, fmt.Sprintf("cb:%s:half_open_attempts", cb.name)).Err()
}
