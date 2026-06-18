package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sony/gobreaker"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	temporalAccessChecksTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "temporal_access_client_checks_total",
			Help: "Total number of temporal access checks from client",
		},
		[]string{"service", "result"},
	)

	temporalAccessCheckDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "temporal_access_client_check_duration_seconds",
			Help:    "Temporal access check duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service"},
	)
)

// Client is a temporal access service client
type Client struct {
	baseURL     string
	serviceName string
	httpClient  *http.Client
	cb          *gobreaker.CircuitBreaker
	failOpen    bool // If true, allows access on service failure
}

// Config holds client configuration
type Config struct {
	BaseURL     string
	ServiceName string
	FailOpen    bool // Default: false (fail-closed)
	Timeout     time.Duration
}

// NewClient creates a new temporal access client
func NewClient(config Config) *Client {
	if config.Timeout == 0 {
		config.Timeout = 5 * time.Second
	}

	cbSettings := gobreaker.Settings{
		Name:        "temporal-access-client",
		MaxRequests: 3,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
	}

	return &Client{
		baseURL:     config.BaseURL,
		serviceName: config.ServiceName,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		cb:       gobreaker.NewCircuitBreaker(cbSettings),
		failOpen: config.FailOpen,
	}
}

// AccessCheckRequest represents a permission check request
type AccessCheckRequest struct {
	TenantID     string        `json:"tenant_id"`
	SubjectID    string        `json:"subject_id"`
	SubjectType  string        `json:"subject_type"`
	Permission   string        `json:"permission"`
	ResourceType string        `json:"resource_type"`
	ResourceID   string        `json:"resource_id"`
	Context      AccessContext `json:"context"`
}

// AccessContext provides runtime context
type AccessContext struct {
	IPAddress      string                 `json:"ip_address,omitempty"`
	DeviceID       string                 `json:"device_id,omitempty"`
	MFAVerified    bool                   `json:"mfa_verified"`
	LivenessScore  *float64               `json:"liveness_score,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
	Location       *Location              `json:"location,omitempty"`
	RiskScore      *float64               `json:"risk_score,omitempty"`
	Amount         *float64               `json:"amount,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// Location represents geographic location
type Location struct {
	Country string  `json:"country"`
	Region  string  `json:"region,omitempty"`
	City    string  `json:"city,omitempty"`
	Lat     float64 `json:"lat,omitempty"`
	Lon     float64 `json:"lon,omitempty"`
}

// AccessCheckResponse represents the response
type AccessCheckResponse struct {
	Allowed          bool                   `json:"allowed"`
	Reason           string                 `json:"reason,omitempty"`
	RequiresMFA      bool                   `json:"requires_mfa"`
	RequiresApproval bool                   `json:"requires_approval"`
	ApproverRoles    []string               `json:"approver_roles,omitempty"`
	GrantID          string                 `json:"grant_id,omitempty"`
	PolicyID         string                 `json:"policy_id,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// CheckAccess checks if access should be allowed
func (c *Client) CheckAccess(ctx context.Context, req AccessCheckRequest) (*AccessCheckResponse, error) {
	start := time.Now()
	defer func() {
		duration := time.Since(start).Seconds()
		temporalAccessCheckDuration.WithLabelValues(c.serviceName).Observe(duration)
	}()

	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.checkAccessHTTP(ctx, req)
	})

	if err != nil {
		temporalAccessChecksTotal.WithLabelValues(c.serviceName, "error").Inc()
		
		// Fail-open: allow access if service is unavailable (optional)
		if c.failOpen {
			return &AccessCheckResponse{
				Allowed: true,
				Reason:  "temporal access service unavailable (fail-open)",
			}, nil
		}
		
		return &AccessCheckResponse{
			Allowed: false,
			Reason:  "temporal access service unavailable",
		}, err
	}

	response := result.(*AccessCheckResponse)
	
	if response.Allowed {
		temporalAccessChecksTotal.WithLabelValues(c.serviceName, "allowed").Inc()
	} else {
		temporalAccessChecksTotal.WithLabelValues(c.serviceName, "denied").Inc()
	}

	return response, nil
}

func (c *Client) checkAccessHTTP(ctx context.Context, req AccessCheckRequest) (*AccessCheckResponse, error) {
	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/api/v1/check", c.baseURL),
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Service-Name", c.serviceName)

	// Send request
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("temporal access error (status %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var checkResp AccessCheckResponse
	if err := json.Unmarshal(respBody, &checkResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &checkResp, nil
}

// Helper functions for common use cases

// CheckAccountAccess checks account access
func (c *Client) CheckAccountAccess(
	ctx context.Context,
	tenantID, userID, permission, accountID string,
	accessCtx AccessContext,
) (*AccessCheckResponse, error) {
	return c.CheckAccess(ctx, AccessCheckRequest{
		TenantID:     tenantID,
		SubjectID:    userID,
		SubjectType:  "user",
		Permission:   permission,
		ResourceType: "account",
		ResourceID:   accountID,
		Context:      accessCtx,
	})
}

// CheckTransactionAccess checks transaction access
func (c *Client) CheckTransactionAccess(
	ctx context.Context,
	tenantID, userID, permission, transactionID string,
	accessCtx AccessContext,
) (*AccessCheckResponse, error) {
	return c.CheckAccess(ctx, AccessCheckRequest{
		TenantID:     tenantID,
		SubjectID:    userID,
		SubjectType:  "user",
		Permission:   permission,
		ResourceType: "transaction",
		ResourceID:   transactionID,
		Context:      accessCtx,
	})
}

// CheckLoanAccess checks loan access
func (c *Client) CheckLoanAccess(
	ctx context.Context,
	tenantID, userID, permission, loanID string,
	accessCtx AccessContext,
) (*AccessCheckResponse, error) {
	return c.CheckAccess(ctx, AccessCheckRequest{
		TenantID:     tenantID,
		SubjectID:    userID,
		SubjectType:  "user",
		Permission:   permission,
		ResourceType: "loan",
		ResourceID:   loanID,
		Context:      accessCtx,
	})
}

// ExtractContextFromHTTPRequest extracts access context from HTTP request
func ExtractContextFromHTTPRequest(r *http.Request) AccessContext {
	ctx := AccessContext{
		IPAddress:   getRealIP(r),
		DeviceID:    r.Header.Get("X-Device-ID"),
		MFAVerified: r.Header.Get("X-MFA-Verified") == "true",
		Timestamp:   time.Now(),
	}

	return ctx
}

func getRealIP(r *http.Request) string {
	// Try X-Forwarded-For first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take first IP in the chain
		if idx := bytes.IndexByte([]byte(xff), ','); idx > 0 {
			return xff[:idx]
		}
		return xff
	}

	// Try X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	if idx := bytes.LastIndexByte([]byte(r.RemoteAddr), ':'); idx > 0 {
		return r.RemoteAddr[:idx]
	}

	return r.RemoteAddr
}
