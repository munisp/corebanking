package permify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/sony/gobreaker"
)

// Client is a Permify HTTP client with circuit breaker
type Client struct {
	baseURL string
	client  *http.Client
	cb      *gobreaker.CircuitBreaker
}

// NewClient creates a new Permify client
func NewClient(baseURL string) *Client {
	cbSettings := gobreaker.Settings{
		Name:        "permify",
		MaxRequests: 3,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		},
	}

	return &Client{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		cb: gobreaker.NewCircuitBreaker(cbSettings),
	}
}

// CheckPermissionRequest represents a permission check request to Permify
type CheckPermissionRequest struct {
	TenantID   string                 `json:"-"` // Used in URL path, not in body
	Metadata   map[string]interface{} `json:"metadata"`
	Entity     Entity                 `json:"entity"`
	Permission string                 `json:"permission"`
	Subject    Subject                `json:"subject"`
	Context    map[string]interface{} `json:"context,omitempty"`
}

// Entity represents the resource being accessed
type Entity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// Subject represents the entity requesting access
type Subject struct {
	Type     string `json:"type"`
	ID       string `json:"id"`
	Relation string `json:"relation,omitempty"`
}

// CheckPermissionResponse represents Permify's response
type CheckPermissionResponse struct {
	Can      string                 `json:"can"` // RESULT_ALLOWED, RESULT_DENIED
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// WriteRelationshipRequest represents a request to write a relationship
type WriteRelationshipRequest struct {
	TenantID string                 `json:"-"` // Used in URL path, not in body
	Metadata map[string]interface{} `json:"metadata"`
	Tuples   []RelationshipTuple    `json:"tuples"`
}

// DeleteRelationshipRequest represents a request to delete a relationship
type DeleteRelationshipRequest struct {
	TenantID string             `json:"-"` // Used in URL path, not in body
	Filter   RelationshipFilter `json:"filter"`
}

// RelationshipTuple represents a relationship between entities
type RelationshipTuple struct {
	Entity   Entity  `json:"entity"`
	Relation string  `json:"relation"`
	Subject  Subject `json:"subject"`
}

// RelationshipFilter for filtering relationships to delete
type RelationshipFilter struct {
	Entity   Entity   `json:"entity"`
	Relation string   `json:"relation,omitempty"`
	Subject  *Subject `json:"subject,omitempty"`
}

// CheckPermission checks if a subject has permission on an entity
func (c *Client) CheckPermission(ctx context.Context, req CheckPermissionRequest) (bool, error) {
	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.checkPermissionHTTP(ctx, req)
	})

	if err != nil {
		return false, fmt.Errorf("permify circuit breaker: %w", err)
	}

	return result.(bool), nil
}

func (c *Client) checkPermissionHTTP(ctx context.Context, req CheckPermissionRequest) (bool, error) {
	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return false, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", c.baseURL, req.TenantID)
	log.Printf("[Permify] Checking permission: URL=%s, Subject=%s:%s, Permission=%s, Entity=%s:%s",
		url, req.Subject.Type, req.Subject.ID, req.Permission, req.Entity.Type, req.Entity.ID)
	log.Printf("[Permify] Request body: %s", string(body))

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return false, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.client.Do(httpReq)
	if err != nil {
		log.Printf("[Permify] ERROR: Failed to send request: %v", err)
		return false, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[Permify] ERROR: Failed to read response: %v", err)
		return false, fmt.Errorf("read response: %w", err)
	}

	log.Printf("[Permify] Response status=%d, body=%s", resp.StatusCode, string(respBody))

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Permify] ERROR: Non-OK status: %d - %s", resp.StatusCode, string(respBody))
		return false, fmt.Errorf("permify error (status %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var checkResp CheckPermissionResponse
	if err := json.Unmarshal(respBody, &checkResp); err != nil {
		log.Printf("[Permify] ERROR: Failed to unmarshal response: %v", err)
		return false, fmt.Errorf("unmarshal response: %w", err)
	}

	allowed := checkResp.Can == "CHECK_RESULT_ALLOWED"
	log.Printf("[Permify] Permission check result: can=%s, allowed=%v", checkResp.Can, allowed)

	return allowed, nil
}

// WriteRelationship writes a relationship to Permify
func (c *Client) WriteRelationship(ctx context.Context, req WriteRelationshipRequest) error {
	_, err := c.cb.Execute(func() (interface{}, error) {
		return nil, c.writeRelationshipHTTP(ctx, req)
	})

	return err
}

func (c *Client) writeRelationshipHTTP(ctx context.Context, req WriteRelationshipRequest) error {
	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/v1/tenants/%s/relationships/write", c.baseURL, req.TenantID),
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("permify error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// DeleteRelationship deletes relationships from Permify
func (c *Client) DeleteRelationship(ctx context.Context, req DeleteRelationshipRequest) error {
	_, err := c.cb.Execute(func() (interface{}, error) {
		return nil, c.deleteRelationshipHTTP(ctx, req)
	})

	return err
}

func (c *Client) deleteRelationshipHTTP(ctx context.Context, req DeleteRelationshipRequest) error {
	// Marshal request
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/v1/tenants/%s/relationships/delete", c.baseURL, req.TenantID),
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("permify error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// CheckTemporalGrantPermission checks if a subject can create/manage temporal grants
func (c *Client) CheckTemporalGrantPermission(ctx context.Context, tenantID, subjectID, permission, grantID string) (bool, error) {
	return c.CheckPermission(ctx, CheckPermissionRequest{
		TenantID: tenantID,
		Metadata: map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		Entity: Entity{
			Type: "temporal_grant",
			ID:   grantID,
		},
		Permission: permission, // create, view, revoke, extend
		Subject: Subject{
			Type: "user",
			ID:   subjectID,
		},
	})
}

// CheckAccessPolicyPermission checks if a subject can manage access policies
func (c *Client) CheckAccessPolicyPermission(ctx context.Context, tenantID, subjectID, permission, policyID string) (bool, error) {
	return c.CheckPermission(ctx, CheckPermissionRequest{
		TenantID: tenantID,
		Metadata: map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		Entity: Entity{
			Type: "access_policy",
			ID:   policyID,
		},
		Permission: permission, // create, view, edit, delete
		Subject: Subject{
			Type: "user",
			ID:   subjectID,
		},
	})
}

// CheckTenantAdminPermission checks if a subject is a tenant admin
func (c *Client) CheckTenantAdminPermission(ctx context.Context, tenantID, subjectID string) (bool, error) {
	return c.CheckPermission(ctx, CheckPermissionRequest{
		TenantID: tenantID,
		Metadata: map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		Entity: Entity{
			Type: "bank",
			ID:   tenantID,
		},
		Permission: "admin",
		Subject: Subject{
			Type: "user",
			ID:   subjectID,
		},
	})
}
