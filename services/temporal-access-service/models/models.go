package models

import (
	"time"
)

// TemporalGrant represents a time-limited permission grant
type TemporalGrant struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	SubjectID    string                 `json:"subject_id"`
	SubjectType  string                 `json:"subject_type"` // user, service, role
	Permission   string                 `json:"permission"`   // view, edit, delete, approve, etc.
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	GrantedBy    string                 `json:"granted_by"`
	GrantedAt    time.Time              `json:"granted_at"`
	ExpiresAt    time.Time              `json:"expires_at"`
	Reason       string                 `json:"reason"`
	Status       string                 `json:"status"` // active, expired, revoked
	RevokedAt    *time.Time             `json:"revoked_at,omitempty"`
	RevokedBy    *string                `json:"revoked_by,omitempty"`
	UsageCount   int                    `json:"usage_count"`
	MaxUsage     *int                   `json:"max_usage,omitempty"`
	Conditions   *GrantConditions       `json:"conditions,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// GrantConditions defines conditional access requirements
type GrantConditions struct {
	RequireMFA       bool          `json:"require_mfa"`
	RequireLiveness  bool          `json:"require_liveness"`
	IPWhitelist      []string      `json:"ip_whitelist,omitempty"`      // CIDR notation
	DeviceIDs        []string      `json:"device_ids,omitempty"`        // Allowed device IDs
	TimeWindows      []TimeWindow  `json:"time_windows,omitempty"`      // Business hours
	LocationRestrict *LocationRule `json:"location_restrict,omitempty"` // Geo-fencing
	RiskScoreMax     *float64      `json:"risk_score_max,omitempty"`    // Max risk score allowed
}

// TimeWindow defines when access is allowed
type TimeWindow struct {
	StartTime string   `json:"start_time"` // HH:MM format
	EndTime   string   `json:"end_time"`   // HH:MM format
	Days      []string `json:"days"`       // Mon, Tue, Wed, Thu, Fri, Sat, Sun
	Timezone  string   `json:"timezone"`   // IANA timezone
}

// LocationRule defines location-based access control
type LocationRule struct {
	AllowedCountries []string `json:"allowed_countries,omitempty"` // ISO country codes
	AllowedRegions   []string `json:"allowed_regions,omitempty"`
	AllowedCities    []string `json:"allowed_cities,omitempty"`
	BlockedCountries []string `json:"blocked_countries,omitempty"`
}

// AccessPolicy defines conditional access rules
type AccessPolicy struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	ResourceType string                 `json:"resource_type"`
	Permission   string                 `json:"permission"`
	Priority     int                    `json:"priority"` // Higher number = higher priority
	Enabled      bool                   `json:"enabled"`
	Rules        []PolicyRule           `json:"rules"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	CreatedBy    string                 `json:"created_by"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CreatePolicyRequest represents the payload to create an access policy
type CreatePolicyRequest struct {
	TenantID     string       `json:"tenant_id"`
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	ResourceType string       `json:"resource_type"`
	Permission   string       `json:"permission"`
	Priority     int          `json:"priority"`
	Enabled      bool         `json:"enabled"`
	Rules        []PolicyRule `json:"rules"`
}

// UpdatePolicyRequest represents a partial update to an access policy
type UpdatePolicyRequest struct {
	Name         *string       `json:"name,omitempty"`
	Description  *string       `json:"description,omitempty"`
	ResourceType *string       `json:"resource_type,omitempty"`
	Permission   *string       `json:"permission,omitempty"`
	Priority     *int          `json:"priority,omitempty"`
	Enabled      *bool         `json:"enabled,omitempty"`
	Rules        *[]PolicyRule `json:"rules,omitempty"`
}

// PolicyRule defines a single rule in an access policy
type PolicyRule struct {
	Type     string                 `json:"type"`     // amount, risk_score, time, approval
	Operator string                 `json:"operator"` // gt, lt, eq, in, between
	Value    interface{}            `json:"value"`
	Action   string                 `json:"action"` // allow, deny, require_mfa, require_approval
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Delegation represents user-to-user permission delegation
type Delegation struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	DelegatorID  string                 `json:"delegator_id"` // User delegating the permission
	DelegateID   string                 `json:"delegate_id"`  // User receiving the delegation
	Permission   string                 `json:"permission"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	CreatedAt    time.Time              `json:"created_at"`
	ExpiresAt    *time.Time             `json:"expires_at,omitempty"`
	Revoked      bool                   `json:"revoked"`
	RevokedAt    *time.Time             `json:"revoked_at,omitempty"`
	Conditions   *GrantConditions       `json:"conditions,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CreateDelegationRequest represents payload to create a delegation
type CreateDelegationRequest struct {
	TenantID     string           `json:"tenant_id"`
	DelegatorID  string           `json:"delegator_id"`
	DelegateID   string           `json:"delegate_id"`
	Permission   string           `json:"permission"`
	ResourceType string           `json:"resource_type"`
	ResourceID   string           `json:"resource_id"`
	ExpiresAt    *time.Time       `json:"expires_at,omitempty"`
	Conditions   *GrantConditions `json:"conditions,omitempty"`
}

// AccessCheckRequest represents a permission check request
type AccessCheckRequest struct {
	TenantID     string        `json:"tenant_id"`
	SubjectID    string        `json:"subject_id"`
	SubjectType  string        `json:"subject_type"` // user, service, role
	Permission   string        `json:"permission"`
	ResourceType string        `json:"resource_type"`
	ResourceID   string        `json:"resource_id"`
	Context      AccessContext `json:"context"`
}

// AccessContext provides runtime context for access decisions
type AccessContext struct {
	IPAddress     string                 `json:"ip_address,omitempty"`
	DeviceID      string                 `json:"device_id,omitempty"`
	MFAVerified   bool                   `json:"mfa_verified"`
	LivenessScore *float64               `json:"liveness_score,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
	Location      *Location              `json:"location,omitempty"`
	RiskScore     *float64               `json:"risk_score,omitempty"`
	Amount        *float64               `json:"amount,omitempty"` // For transaction-based checks
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// Location represents user's geographic location
type Location struct {
	Country string  `json:"country"` // ISO country code
	Region  string  `json:"region,omitempty"`
	City    string  `json:"city,omitempty"`
	Lat     float64 `json:"lat,omitempty"`
	Lon     float64 `json:"lon,omitempty"`
}

// AccessCheckResponse represents the result of an access check
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

// CreateGrantRequest represents request to create a temporal grant
type CreateGrantRequest struct {
	TenantID     string           `json:"tenant_id"`
	SubjectID    string           `json:"subject_id"`
	SubjectType  string           `json:"subject_type"`
	Permission   string           `json:"permission"`
	ResourceType string           `json:"resource_type"`
	ResourceID   string           `json:"resource_id"`
	Duration     string           `json:"duration"` // 15m, 30m, 1h, 4h, 8h, 24h, 7d, 30d
	Reason       string           `json:"reason"`
	MaxUsage     *int             `json:"max_usage,omitempty"`
	Conditions   *GrantConditions `json:"conditions,omitempty"`
}

// ExtendGrantRequest represents request to extend a grant
type ExtendGrantRequest struct {
	Duration string `json:"duration"` // Additional time to add
	Reason   string `json:"reason"`
}

// UpdateGrantRequest represents a partial update to a grant's non-time fields
type UpdateGrantRequest struct {
	Reason     *string          `json:"reason,omitempty"`
	MaxUsage   *int             `json:"max_usage,omitempty"`
	Conditions *GrantConditions `json:"conditions,omitempty"`
}

// AuditLog represents an access audit log entry
type AuditLog struct {
	ID           string                 `json:"id"`
	TenantID     string                 `json:"tenant_id"`
	Timestamp    time.Time              `json:"timestamp"`
	Action       string                 `json:"action"` // check, grant, revoke, extend
	SubjectID    string                 `json:"subject_id"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	Permission   string                 `json:"permission"`
	Result       string                 `json:"result"` // allowed, denied
	Reason       string                 `json:"reason,omitempty"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	DeviceID     string                 `json:"device_id,omitempty"`
	GrantID      string                 `json:"grant_id,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string                 `json:"error"`
	Code    string                 `json:"code,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// ListGrantsRequest represents a request to list grants
type ListGrantsRequest struct {
	TenantID     string  `json:"tenant_id"`
	SubjectID    *string `json:"subject_id,omitempty"`
	ResourceType *string `json:"resource_type,omitempty"`
	ResourceID   *string `json:"resource_id,omitempty"`
	Status       *string `json:"status,omitempty"` // active, expired, revoked
	Offset       int     `json:"offset"`
	Limit        int     `json:"limit"`
}

// ListGrantsResponse represents the response for listing grants
type ListGrantsResponse struct {
	Grants []TemporalGrant `json:"grants"`
	Total  int             `json:"total"`
	Offset int             `json:"offset"`
	Limit  int             `json:"limit"`
}

// ListPoliciesResponse represents the response for listing policies
type ListPoliciesResponse struct {
	Policies []AccessPolicy `json:"policies"`
	Total    int            `json:"total"`
}

// ListAuditLogsResponse represents the response for listing audit logs
type ListAuditLogsResponse struct {
	Logs  []AuditLog `json:"logs"`
	Total int        `json:"total"`
}
