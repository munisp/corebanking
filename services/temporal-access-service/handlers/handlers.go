package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"temporal-access-service/models"
	"temporal-access-service/permify"
	"temporal-access-service/storage"
)

// Handler handles HTTP requests
type Handler struct {
	store   *storage.RedisStore
	permify *permify.Client
}

// NewHandler creates a new handler
func NewHandler(store *storage.RedisStore, permifyClient *permify.Client) *Handler {
	return &Handler{
		store:   store,
		permify: permifyClient,
	}
}

// CreateGrant creates a new temporal grant
func (h *Handler) CreateGrant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request
	var req models.CreateGrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Derive tenant from header to enforce isolation, overriding any body value.
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "X-Tenant-ID header is required", nil)
		return
	}
	req.TenantID = tenantID

	// The caller is expected to have already authenticated the user via auth-service.
	// We treat this service as a pure grant store and do not enforce authorization
	// beyond validating the request payload.
	grantedBy := r.Header.Get("x-keycloak-id")

	// Validate request
	if err := validateCreateGrantRequest(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request", err)
		return
	}

	// Parse duration
	duration, err := parseDuration(req.Duration)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid duration", err)
		return
	}

	// Create grant
	grant := &models.TemporalGrant{
		ID:           uuid.New().String(),
		TenantID:     req.TenantID,
		SubjectID:    req.SubjectID,
		SubjectType:  req.SubjectType,
		Permission:   req.Permission,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		GrantedBy:    grantedBy,
		GrantedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(duration),
		Reason:       req.Reason,
		Status:       "active",
		UsageCount:   0,
		MaxUsage:     req.MaxUsage,
		Conditions:   req.Conditions,
		Metadata:     make(map[string]interface{}),
	}

	// Write relationship to Permify before persisting to Redis so a Permify
	// failure leaves no orphaned grant in the store.
	if err := h.createGrantRelationship(ctx, grant); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create Permify relationship", err)
		return
	}

	// Save to Redis
	if err := h.store.SaveGrant(ctx, grant); err != nil {
		// Permify write succeeded; attempt to clean it up to stay consistent.
		if delErr := h.deleteGrantRelationship(ctx, grant); delErr != nil {
			fmt.Printf("Warning: Redis save failed and Permify rollback also failed: %v\n", delErr)
		}
		respondError(w, http.StatusInternalServerError, "failed to save grant", err)
		return
	}

	// Audit log
	h.auditLog(ctx, &models.AuditLog{
		ID:           uuid.New().String(),
		TenantID:     grant.TenantID,
		Timestamp:    time.Now(),
		Action:       "grant_created",
		SubjectID:    grant.SubjectID,
		ResourceType: grant.ResourceType,
		ResourceID:   grant.ResourceID,
		Permission:   grant.Permission,
		Result:       "success",
		GrantID:      grant.ID,
		Metadata: map[string]interface{}{
			"expires_at": grant.ExpiresAt,
			"duration":   req.Duration,
		},
	})

	respondJSON(w, http.StatusCreated, grant)
}

// GetGrant retrieves a grant by ID
func (h *Handler) GetGrant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	grantID := vars["grant_id"]

	// Get grant
	grant, err := h.store.GetGrant(ctx, grantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "grant not found", err)
		return
	}

	respondJSON(w, http.StatusOK, grant)
}

// RevokeGrant revokes a grant
func (h *Handler) RevokeGrant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	grantID := vars["grant_id"]

	// Get grant
	grant, err := h.store.GetGrant(ctx, grantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "grant not found", err)
		return
	}

	// Update grant
	now := time.Now()
	grant.Status = "revoked"
	grant.RevokedAt = &now
	// Optionally track who revoked using x-keycloak-id if present
	if userID := r.Header.Get("x-keycloak-id"); userID != "" {
		grant.RevokedBy = &userID
	}

	// Delete relationship from Permify before updating Redis so a Permify
	// failure leaves the grant still active in Redis (consistent state).
	if err := h.deleteGrantRelationship(ctx, grant); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete Permify relationship", err)
		return
	}

	// Save updated grant (with short TTL)
	if err := h.store.SaveGrant(ctx, grant); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update grant", err)
		return
	}

	// Audit log (subject is the grant subject)
	h.auditLog(ctx, &models.AuditLog{
		ID:           uuid.New().String(),
		TenantID:     grant.TenantID,
		Timestamp:    time.Now(),
		Action:       "grant_revoked",
		SubjectID:    grant.SubjectID,
		ResourceType: grant.ResourceType,
		ResourceID:   grant.ResourceID,
		Permission:   grant.Permission,
		Result:       "success",
		GrantID:      grant.ID,
	})

	respondJSON(w, http.StatusOK, grant)
}

// ExtendGrant extends a grant's expiration
func (h *Handler) ExtendGrant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	grantID := vars["grant_id"]

	// Parse request
	var req models.ExtendGrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Get grant
	grant, err := h.store.GetGrant(ctx, grantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "grant not found", err)
		return
	}

	// Parse duration
	duration, err := parseDuration(req.Duration)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid duration", err)
		return
	}

	// Extend grant
	grant.ExpiresAt = grant.ExpiresAt.Add(duration)

	// Save updated grant
	if err := h.store.SaveGrant(ctx, grant); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update grant", err)
		return
	}

	// Audit log
	h.auditLog(ctx, &models.AuditLog{
		ID:           uuid.New().String(),
		TenantID:     grant.TenantID,
		Timestamp:    time.Now(),
		Action:       "grant_extended",
		SubjectID:    grant.SubjectID,
		ResourceType: grant.ResourceType,
		ResourceID:   grant.ResourceID,
		Permission:   grant.Permission,
		Result:       "success",
		GrantID:      grant.ID,
		Metadata: map[string]interface{}{
			"new_expires_at": grant.ExpiresAt,
			"duration":       req.Duration,
		},
	})

	respondJSON(w, http.StatusOK, grant)
}

// UpdateGrant updates non-time fields on a grant (reason, max_usage, conditions)
// without touching its expiry time or Permify relationships.
func (h *Handler) UpdateGrant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	grantID := vars["grant_id"]

	var req models.UpdateGrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	grant, err := h.store.GetGrant(ctx, grantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "grant not found", err)
		return
	}

	// Apply partial updates
	if req.Reason != nil {
		grant.Reason = *req.Reason
	}
	if req.MaxUsage != nil {
		grant.MaxUsage = req.MaxUsage
	}
	if req.Conditions != nil {
		grant.Conditions = req.Conditions
	}

	// Persist updated grant; this recalculates TTL based on existing ExpiresAt
	if err := h.store.SaveGrant(ctx, grant); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update grant", err)
		return
	}

	h.auditLog(ctx, &models.AuditLog{
		ID:           uuid.New().String(),
		TenantID:     grant.TenantID,
		Timestamp:    time.Now(),
		Action:       "grant_updated",
		SubjectID:    grant.SubjectID,
		ResourceType: grant.ResourceType,
		ResourceID:   grant.ResourceID,
		Permission:   grant.Permission,
		Result:       "success",
		GrantID:      grant.ID,
	})

	respondJSON(w, http.StatusOK, grant)
}

// ListGrants lists grants
func (h *Handler) ListGrants(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Fallback to query param for backward compatibility
		tenantID = r.URL.Query().Get("tenant_id")
	}

	// Fallback to query param for backward compatibility
	keycloakID := r.URL.Query().Get("keycloak_id")

	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "missing tenant ID", nil)
		return
	}

	// Get grants
	var grants []*models.TemporalGrant
	var err error

	if keycloakID != "" {
		// List grants for specific user/subject filtered by keycloak ID
		grants, err = h.store.ListGrantsBySubject(ctx, tenantID, keycloakID)
	} else {
		// List all grants for tenant
		grants, err = h.store.ListGrantsByTenant(ctx, tenantID)
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list grants", err)
		return
	}

	respondJSON(w, http.StatusOK, models.ListGrantsResponse{
		Grants: convertGrantPointers(grants),
		Total:  len(grants),
		Offset: 0,
		Limit:  len(grants),
	})
}

// ListUserGrants lists active grants for a specific subject/user
func (h *Handler) ListUserGrants(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	subjectID := vars["subject_id"]
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Fallback to query param for backward compatibility
		tenantID = r.URL.Query().Get("tenant_id")
	}

	// If subject_id is "me", use keycloak_id from query parameter
	if subjectID == "me" {
		keycloakID := r.URL.Query().Get("keycloak_id")
		if keycloakID != "" {
			subjectID = keycloakID
		}
	}

	if subjectID == "" || tenantID == "" {
		respondError(w, http.StatusBadRequest, "missing subject ID or tenant ID", nil)
		return
	}

	grants, err := h.store.ListGrantsBySubject(ctx, tenantID, subjectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list grants", err)
		return
	}

	now := time.Now()
	var active []models.TemporalGrant
	for _, g := range grants {
		if g == nil {
			continue
		}
		if g.Status != "active" {
			continue
		}
		if now.After(g.ExpiresAt) {
			continue
		}
		active = append(active, *g)
	}

	respondJSON(w, http.StatusOK, models.ListGrantsResponse{
		Grants: active,
		Total:  len(active),
		Offset: 0,
		Limit:  len(active),
	})
}

// CheckAccess checks if access should be allowed
func (h *Handler) CheckAccess(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request
	var req models.AccessCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Enforce tenant from header for access checks
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "X-Tenant-ID header is required", nil)
		return
	}
	req.TenantID = tenantID

	// Default SubjectType to "user" if not provided
	if req.SubjectType == "" {
		req.SubjectType = "user"
	}

	// Perform access check
	response := h.performAccessCheck(ctx, &req)

	// Audit log
	h.auditLog(ctx, &models.AuditLog{
		ID:           uuid.New().String(),
		TenantID:     req.TenantID,
		Timestamp:    time.Now(),
		Action:       "access_check",
		SubjectID:    req.SubjectID,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		Permission:   req.Permission,
		Result:       boolToResult(response.Allowed),
		Reason:       response.Reason,
		IPAddress:    req.Context.IPAddress,
		DeviceID:     req.Context.DeviceID,
		GrantID:      response.GrantID,
	})

	respondJSON(w, http.StatusOK, response)
}

// performAccessCheck performs the actual access check logic
func (h *Handler) performAccessCheck(ctx context.Context, req *models.AccessCheckRequest) *models.AccessCheckResponse {
	// 1. Check for active temporal grants
	grants, err := h.store.ListGrantsBySubject(ctx, req.TenantID, req.SubjectID)
	if err == nil {
		for _, grant := range grants {
			if grant.Status != "active" {
				continue
			}
			if grant.ResourceType != req.ResourceType {
				continue
			}
			// If grant.ResourceID is empty, treat it as applying to all resources
			if grant.ResourceID != "" && grant.ResourceID != req.ResourceID {
				continue
			}
			if grant.Permission != req.Permission {
				continue
			}
			if time.Now().After(grant.ExpiresAt) {
				continue
			}

			// Check conditions
			if grant.Conditions != nil {
				condResult := h.evaluateConditions(grant.Conditions, &req.Context)
				if !condResult.Allowed {
					continue
				}
				if condResult.RequiresMFA {
					if !req.Context.MFAVerified {
						return &models.AccessCheckResponse{
							Allowed:     false,
							Reason:      "MFA required but not verified",
							RequiresMFA: true,
							GrantID:     grant.ID,
						}
					}
				}
			}

			// Check max usage
			if grant.MaxUsage != nil && grant.UsageCount >= *grant.MaxUsage {
				continue
			}

			// Increment usage
			h.store.IncrementGrantUsage(ctx, grant.ID)

			return &models.AccessCheckResponse{
				Allowed: true,
				Reason:  "temporal grant allows access",
				GrantID: grant.ID,
			}
		}
	}

	// 2. Check delegations
	delegations, err := h.store.ListDelegationsByDelegate(ctx, req.TenantID, req.SubjectID)
	if err == nil {
		for _, delegation := range delegations {
			if delegation.Revoked {
				continue
			}
			if delegation.ResourceType != req.ResourceType {
				continue
			}
			if delegation.ResourceID != "" && delegation.ResourceID != req.ResourceID {
				continue
			}
			if delegation.Permission != req.Permission {
				continue
			}
			if delegation.ExpiresAt != nil && time.Now().After(*delegation.ExpiresAt) {
				continue
			}

			// Check conditions
			if delegation.Conditions != nil {
				condResult := h.evaluateConditions(delegation.Conditions, &req.Context)
				if !condResult.Allowed {
					continue
				}
			}

			return &models.AccessCheckResponse{
				Allowed: true,
				Reason:  "delegation allows access",
			}
		}
	}

	// 3. Check access policies
	policies, err := h.store.ListPoliciesByTenant(ctx, req.TenantID)
	if err == nil {
		for _, policy := range policies {
			if !policy.Enabled {
				continue
			}
			if policy.ResourceType != req.ResourceType {
				continue
			}
			if policy.Permission != req.Permission {
				continue
			}

			// Evaluate policy rules
			policyResult := h.evaluatePolicy(policy, &req.Context)
			if policyResult != nil {
				return policyResult
			}
		}
	}

	// 4. Check base permissions in Permify
	hasBasePermission, err := h.permify.CheckPermission(ctx, permify.CheckPermissionRequest{
		TenantID: req.TenantID,
		Metadata: map[string]interface{}{
			"schema_version": "",
			"snap_token":     "",
			"depth":          20,
		},
		Entity: permify.Entity{
			Type: req.ResourceType,
			ID:   req.ResourceID,
		},
		Permission: req.Permission,
		Subject: permify.Subject{
			Type: req.SubjectType,
			ID:   req.SubjectID,
		},
	})

	if err == nil && hasBasePermission {
		return &models.AccessCheckResponse{
			Allowed: true,
			Reason:  "base permission allows access",
		}
	}

	// 5. Default deny
	return &models.AccessCheckResponse{
		Allowed: false,
		Reason:  "no matching grant, delegation, policy, or base permission",
	}
}

// evaluateConditions evaluates access conditions
func (h *Handler) evaluateConditions(conditions *models.GrantConditions, ctx *models.AccessContext) *models.AccessCheckResponse {
	// Check MFA
	if conditions.RequireMFA && !ctx.MFAVerified {
		return &models.AccessCheckResponse{
			Allowed:     false,
			Reason:      "MFA required",
			RequiresMFA: true,
		}
	}

	// Check liveness
	if conditions.RequireLiveness {
		if ctx.LivenessScore == nil || *ctx.LivenessScore < 0.8 {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "liveness verification required",
			}
		}
	}

	// Check IP whitelist
	if len(conditions.IPWhitelist) > 0 {
		if !isIPInWhitelist(ctx.IPAddress, conditions.IPWhitelist) {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "IP address not in whitelist",
			}
		}
	}

	// Check device IDs
	if len(conditions.DeviceIDs) > 0 {
		if !contains(conditions.DeviceIDs, ctx.DeviceID) {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "device not authorized",
			}
		}
	}

	// Check time windows
	if len(conditions.TimeWindows) > 0 {
		if !isInTimeWindow(conditions.TimeWindows, ctx.Timestamp) {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "access not allowed at this time",
			}
		}
	}

	// Check location restrictions
	if conditions.LocationRestrict != nil && ctx.Location != nil {
		if !isLocationAllowed(conditions.LocationRestrict, ctx.Location) {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "location not authorized",
			}
		}
	}

	// Check risk score
	if conditions.RiskScoreMax != nil && ctx.RiskScore != nil {
		if *ctx.RiskScore > *conditions.RiskScoreMax {
			return &models.AccessCheckResponse{
				Allowed: false,
				Reason:  "risk score too high",
			}
		}
	}

	return &models.AccessCheckResponse{
		Allowed: true,
	}
}

// evaluatePolicy evaluates a policy
func (h *Handler) evaluatePolicy(policy *models.AccessPolicy, ctx *models.AccessContext) *models.AccessCheckResponse {
	for _, rule := range policy.Rules {
		switch rule.Type {
		case "amount":
			if ctx.Amount == nil {
				continue
			}
			if !evaluateAmountRule(rule, *ctx.Amount) {
				return &models.AccessCheckResponse{
					Allowed:  false,
					Reason:   "amount threshold not met",
					PolicyID: policy.ID,
				}
			}
			if rule.Action == "require_mfa" {
				return &models.AccessCheckResponse{
					Allowed:     false,
					Reason:      "MFA required for this amount",
					RequiresMFA: true,
					PolicyID:    policy.ID,
				}
			}
			if rule.Action == "require_approval" {
				return &models.AccessCheckResponse{
					Allowed:          false,
					Reason:           "approval required",
					RequiresApproval: true,
					PolicyID:         policy.ID,
				}
			}
		case "risk_score":
			if ctx.RiskScore == nil {
				continue
			}
			// Evaluate risk score rules
		}
	}

	return nil
}

// Helper functions

func (h *Handler) createGrantRelationship(ctx context.Context, grant *models.TemporalGrant) error {
	return h.permify.WriteRelationship(ctx, permify.WriteRelationshipRequest{
		TenantID: grant.TenantID,
		Metadata: map[string]interface{}{
			"schema_version": "1.0",
		},
		Tuples: []permify.RelationshipTuple{
			{
				Entity: permify.Entity{
					Type: grant.ResourceType,
					ID:   grant.ResourceID,
				},
				Relation: grant.Permission,
				Subject: permify.Subject{
					Type: grant.SubjectType,
					ID:   grant.SubjectID,
				},
			},
		},
	})
}

func (h *Handler) deleteGrantRelationship(ctx context.Context, grant *models.TemporalGrant) error {
	subj := &permify.Subject{
		Type: grant.SubjectType,
		ID:   grant.SubjectID,
	}

	return h.permify.DeleteRelationship(ctx, permify.DeleteRelationshipRequest{
		TenantID: grant.TenantID,
		Filter: permify.RelationshipFilter{
			Entity: permify.Entity{
				Type: grant.ResourceType,
				ID:   grant.ResourceID,
			},
			Relation: grant.Permission,
			Subject:  subj,
		},
	})
}

func (h *Handler) auditLog(ctx context.Context, log *models.AuditLog) {
	// Save audit log asynchronously
	go func() {
		if err := h.store.SaveAuditLog(context.Background(), log); err != nil {
			fmt.Printf("Error saving audit log: %v\n", err)
		}
	}()
}

func validateCreateGrantRequest(req *models.CreateGrantRequest) error {
	if req.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if req.SubjectID == "" {
		return fmt.Errorf("subject_id is required")
	}
	if req.Permission == "" {
		return fmt.Errorf("permission is required")
	}
	if req.ResourceType == "" {
		return fmt.Errorf("resource_type is required")
	}
	if req.Duration == "" {
		return fmt.Errorf("duration is required")
	}
	return nil
}

func parseDuration(s string) (time.Duration, error) {
	switch s {
	case "15m":
		return 15 * time.Minute, nil
	case "30m":
		return 30 * time.Minute, nil
	case "1h":
		return 1 * time.Hour, nil
	case "4h":
		return 4 * time.Hour, nil
	case "8h":
		return 8 * time.Hour, nil
	case "24h":
		return 24 * time.Hour, nil
	case "7d":
		return 7 * 24 * time.Hour, nil
	case "30d":
		return 30 * 24 * time.Hour, nil
	default:
		return time.ParseDuration(s)
	}
}

func isIPInWhitelist(ip string, whitelist []string) bool {
	ipAddr := net.ParseIP(ip)
	if ipAddr == nil {
		return false
	}

	for _, cidr := range whitelist {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if ipNet.Contains(ipAddr) {
			return true
		}
	}
	return false
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// parseWindowMinutes parses an "HH:MM" wall-clock time into minutes since
// midnight. Any malformed or out-of-range value is an error (fail-closed:
// callers deny access for unparseable windows).
func parseWindowMinutes(s string) (int, error) {
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid time window value %q (expected HH:MM)", s)
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil || hour < 0 || hour > 23 {
		return 0, fmt.Errorf("invalid hour in time window value %q", s)
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil || minute < 0 || minute > 59 {
		return 0, fmt.Errorf("invalid minute in time window value %q", s)
	}
	return hour*60 + minute, nil
}

// isInTimeWindow reports whether timestamp falls inside any of the given
// access windows. Each window's StartTime/EndTime ("HH:MM") are interpreted in
// the window's IANA Timezone (UTC when unset). Overnight windows (e.g.
// 22:00-06:00) are supported: the window opens on a listed day and closes the
// following day. Malformed windows and unknown timezones are skipped
// (fail-closed: they never grant access).
func isInTimeWindow(windows []models.TimeWindow, timestamp time.Time) bool {
	for _, window := range windows {
		loc := time.UTC
		if window.Timezone != "" {
			l, err := time.LoadLocation(window.Timezone)
			if err != nil {
				continue
			}
			loc = l
		}
		local := timestamp.In(loc)

		startMin, err := parseWindowMinutes(window.StartTime)
		if err != nil {
			continue
		}
		endMin, err := parseWindowMinutes(window.EndTime)
		if err != nil {
			continue
		}

		nowMin := local.Hour()*60 + local.Minute()
		today := local.Format("Mon")
		yesterday := local.AddDate(0, 0, -1).Format("Mon")

		if startMin <= endMin {
			// Same-day window: day must be listed and time within [start, end].
			if contains(window.Days, today) && nowMin >= startMin && nowMin <= endMin {
				return true
			}
		} else {
			// Overnight window (e.g. 22:00-06:00): inside when today is listed
			// and time is past start, or yesterday was listed and time is
			// still before the end.
			if contains(window.Days, today) && nowMin >= startMin {
				return true
			}
			if contains(window.Days, yesterday) && nowMin <= endMin {
				return true
			}
		}
	}
	return false
}

func isLocationAllowed(rule *models.LocationRule, location *models.Location) bool {
	// Check blocked countries first
	for _, country := range rule.BlockedCountries {
		if country == location.Country {
			return false
		}
	}

	// Check allowed countries
	if len(rule.AllowedCountries) > 0 {
		return contains(rule.AllowedCountries, location.Country)
	}

	return true
}

func evaluateAmountRule(rule models.PolicyRule, amount float64) bool {
	threshold, ok := rule.Value.(float64)
	if !ok {
		return false
	}

	switch rule.Operator {
	case "gt":
		return amount > threshold
	case "lt":
		return amount < threshold
	case "eq":
		return amount == threshold
	case "gte":
		return amount >= threshold
	case "lte":
		return amount <= threshold
	default:
		return false
	}
}

func convertGrantPointers(grants []*models.TemporalGrant) []models.TemporalGrant {
	result := make([]models.TemporalGrant, len(grants))
	for i, g := range grants {
		result[i] = *g
	}
	return result
}

func boolToResult(b bool) string {
	if b {
		return "allowed"
	}
	return "denied"
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string, err error) {
	errResp := models.ErrorResponse{
		Error: message,
	}
	if err != nil {
		errResp.Details = map[string]interface{}{
			"error": err.Error(),
		}
	}
	respondJSON(w, status, errResp)
}

// CreatePolicy creates a new access policy
func (h *Handler) CreatePolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.CreatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Enforce tenant from header
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "X-Tenant-ID header is required", nil)
		return
	}
	req.TenantID = tenantID

	if req.TenantID == "" || req.Name == "" || req.ResourceType == "" || req.Permission == "" {
		respondError(w, http.StatusBadRequest, "tenant_id, name, resource_type and permission are required", nil)
		return
	}

	policy := &models.AccessPolicy{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		ResourceType: req.ResourceType,
		Permission:   req.Permission,
		Priority:     req.Priority,
		Enabled:      req.Enabled,
		Rules:        req.Rules,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		CreatedBy:    r.Header.Get("x-keycloak-id"),
		Metadata:     map[string]interface{}{},
	}

	if err := h.store.SavePolicy(ctx, policy); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save policy", err)
		return
	}

	respondJSON(w, http.StatusCreated, policy)
}

// ListPolicies lists all policies for a tenant
func (h *Handler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Fallback to query param for backward compatibility
		tenantID = r.URL.Query().Get("tenant_id")
	}
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "tenant_id is required", nil)
		return
	}

	policies, err := h.store.ListPoliciesByTenant(ctx, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list policies", err)
		return
	}

	flat := make([]models.AccessPolicy, 0, len(policies))
	for _, p := range policies {
		if p != nil {
			flat = append(flat, *p)
		}
	}

	respondJSON(w, http.StatusOK, models.ListPoliciesResponse{
		Policies: flat,
		Total:    len(flat),
	})
}

// GetPolicy retrieves a policy by ID
func (h *Handler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	policyID := vars["policy_id"]

	policy, err := h.store.GetPolicy(ctx, policyID)
	if err != nil {
		respondError(w, http.StatusNotFound, "policy not found", err)
		return
	}

	respondJSON(w, http.StatusOK, policy)
}

// UpdatePolicy updates an existing policy
func (h *Handler) UpdatePolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	policyID := vars["policy_id"]

	var req models.UpdatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	policy, err := h.store.GetPolicy(ctx, policyID)
	if err != nil {
		respondError(w, http.StatusNotFound, "policy not found", err)
		return
	}

	if req.Name != nil {
		policy.Name = *req.Name
	}
	if req.Description != nil {
		policy.Description = *req.Description
	}
	if req.ResourceType != nil {
		policy.ResourceType = *req.ResourceType
	}
	if req.Permission != nil {
		policy.Permission = *req.Permission
	}
	if req.Priority != nil {
		policy.Priority = *req.Priority
	}
	if req.Enabled != nil {
		policy.Enabled = *req.Enabled
	}
	if req.Rules != nil {
		policy.Rules = *req.Rules
	}
	policy.UpdatedAt = time.Now()

	if err := h.store.SavePolicy(ctx, policy); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update policy", err)
		return
	}

	respondJSON(w, http.StatusOK, policy)
}

// DeletePolicy deletes a policy
func (h *Handler) DeletePolicy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	policyID := vars["policy_id"]

	if err := h.store.DeletePolicy(ctx, policyID); err != nil {
		respondError(w, http.StatusNotFound, "policy not found", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CreateDelegation creates a new delegation
func (h *Handler) CreateDelegation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.CreateDelegationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	// Enforce tenant from header
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "X-Tenant-ID header is required", nil)
		return
	}
	req.TenantID = tenantID

	if req.TenantID == "" || req.DelegatorID == "" || req.DelegateID == "" || req.Permission == "" || req.ResourceType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields", nil)
		return
	}

	delegation := &models.Delegation{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		DelegatorID:  req.DelegatorID,
		DelegateID:   req.DelegateID,
		Permission:   req.Permission,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		CreatedAt:    time.Now(),
		ExpiresAt:    req.ExpiresAt,
		Revoked:      false,
		Conditions:   req.Conditions,
		Metadata:     map[string]interface{}{},
	}

	if err := h.store.SaveDelegation(ctx, delegation); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to save delegation", err)
		return
	}

	respondJSON(w, http.StatusCreated, delegation)
}

// ListDelegations lists delegations for a delegate
func (h *Handler) ListDelegations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Fallback to query param for backward compatibility
		tenantID = r.URL.Query().Get("tenant_id")
	}
	delegateID := r.URL.Query().Get("delegate_id")

	if tenantID == "" || delegateID == "" {
		respondError(w, http.StatusBadRequest, "tenant_id and delegate_id are required", nil)
		return
	}

	delegations, err := h.store.ListDelegationsByDelegate(ctx, tenantID, delegateID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list delegations", err)
		return
	}

	respondJSON(w, http.StatusOK, delegations)
}

// RevokeDelegation marks a delegation as revoked
func (h *Handler) RevokeDelegation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	delegationID := vars["delegation_id"]

	delegation, err := h.store.GetDelegation(ctx, delegationID)
	if err != nil {
		respondError(w, http.StatusNotFound, "delegation not found", err)
		return
	}

	if delegation.Revoked {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	now := time.Now()
	delegation.Revoked = true
	delegation.RevokedAt = &now

	if err := h.store.SaveDelegation(ctx, delegation); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to revoke delegation", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListAuditLogs lists audit logs for a tenant between optional time ranges
func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Fallback to query param for backward compatibility
		tenantID = r.URL.Query().Get("tenant_id")
	}
	if tenantID == "" {
		respondError(w, http.StatusBadRequest, "tenant_id is required", nil)
		return
	}

	// Optional: start, end (unix seconds) and limit
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")
	limitStr := r.URL.Query().Get("limit")

	end := time.Now()
	start := end.Add(-24 * time.Hour)
	limit := 100

	if startStr != "" {
		if v, err := strconv.ParseInt(startStr, 10, 64); err == nil {
			start = time.Unix(v, 0)
		}
	}
	if endStr != "" {
		if v, err := strconv.ParseInt(endStr, 10, 64); err == nil {
			end = time.Unix(v, 0)
		}
	}
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}

	logs, err := h.store.GetAuditLogs(ctx, tenantID, start, end, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list audit logs", err)
		return
	}

	flat := make([]models.AuditLog, 0, len(logs))
	for _, l := range logs {
		if l != nil {
			flat = append(flat, *l)
		}
	}

	respondJSON(w, http.StatusOK, models.ListAuditLogsResponse{
		Logs:  flat,
		Total: len(flat),
	})
}
