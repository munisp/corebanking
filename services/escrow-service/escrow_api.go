package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// sanitizeUTF8 removes invalid UTF-8 sequences from a string
func sanitizeUTF8(s string) string {
	if utf8.ValidString(s) {
		return s
	}
	// Convert to valid UTF-8 by replacing invalid sequences
	v := make([]rune, 0, len(s))
	for i, r := range s {
		if r == utf8.RuneError {
			_, size := utf8.DecodeRuneInString(s[i:])
			if size == 1 {
				// Skip invalid byte
				continue
			}
		}
		v = append(v, r)
	}
	return string(v)
}

// sanitizeTransaction sanitizes all string fields in a transaction
func sanitizeTransaction(txn *EscrowTransaction) *EscrowTransaction {
	if txn == nil {
		return txn
	}

	txn.ID = sanitizeUTF8(txn.ID)
	txn.ContractID = sanitizeUTF8(txn.ContractID)
	txn.TransactionType = sanitizeUTF8(txn.TransactionType)
	txn.Currency = sanitizeUTF8(txn.Currency)
	txn.Reference = sanitizeUTF8(txn.Reference)
	txn.ExternalReference = sanitizeUTF8(txn.ExternalReference)
	txn.Status = sanitizeUTF8(txn.Status)

	// Sanitize pointer string fields
	if txn.MilestoneID != nil {
		sanitized := sanitizeUTF8(*txn.MilestoneID)
		txn.MilestoneID = &sanitized
	}
	if txn.FromPartyID != nil {
		sanitized := sanitizeUTF8(*txn.FromPartyID)
		txn.FromPartyID = &sanitized
	}
	if txn.ToPartyID != nil {
		sanitized := sanitizeUTF8(*txn.ToPartyID)
		txn.ToPartyID = &sanitized
	}

	// Sanitize metadata map
	if txn.Metadata != nil {
		txn.Metadata = sanitizeMetadata(txn.Metadata)
	}

	return txn
}

// sanitizeMetadata recursively sanitizes string values in a metadata map
func sanitizeMetadata(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return m
	}

	result := make(map[string]interface{})
	for k, v := range m {
		switch val := v.(type) {
		case string:
			result[sanitizeUTF8(k)] = sanitizeUTF8(val)
		case map[string]interface{}:
			result[sanitizeUTF8(k)] = sanitizeMetadata(val)
		case []interface{}:
			result[sanitizeUTF8(k)] = sanitizeSlice(val)
		default:
			result[sanitizeUTF8(k)] = v
		}
	}
	return result
}

// sanitizeSlice sanitizes string values in a slice
func sanitizeSlice(s []interface{}) []interface{} {
	result := make([]interface{}, len(s))
	for i, v := range s {
		switch val := v.(type) {
		case string:
			result[i] = sanitizeUTF8(val)
		case map[string]interface{}:
			result[i] = sanitizeMetadata(val)
		case []interface{}:
			result[i] = sanitizeSlice(val)
		default:
			result[i] = v
		}
	}
	return result
}

// customRecoverer is a middleware that recovers from panics and sends proper JSON error responses
func customRecoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				// Log the panic
				fmt.Printf("PANIC: %v\n%s\n", rvr, debug.Stack())

				// Send JSON error response
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(APIResponse{
					Success: false,
					Error: &APIError{
						Code:    "ESCROW_5000",
						Message: fmt.Sprintf("Internal server error: %v", rvr),
					},
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// --- Milestone endpoint stubs ---
func (api *EscrowAPI) createMilestone(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusNotImplemented, map[string]string{"error": "not implemented"})
}

func (api *EscrowAPI) listMilestones(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusNotImplemented, map[string]string{"error": "not implemented"})
}

func (api *EscrowAPI) updateMilestone(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusNotImplemented, map[string]string{"error": "not implemented"})
}

func (api *EscrowAPI) deleteMilestone(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusNotImplemented, map[string]string{"error": "not implemented"})
}

// EscrowAPI handles HTTP API requests for escrow service
type EscrowAPI struct {
	escrowService *EscrowService
	ussdService   *USSDEscrowService
	smsService    *SMSEscrowService
}

// NewEscrowAPI creates a new escrow API handler
func NewEscrowAPI(escrowSvc *EscrowService, ussdSvc *USSDEscrowService, smsSvc *SMSEscrowService) *EscrowAPI {
	return &EscrowAPI{
		escrowService: escrowSvc,
		ussdService:   ussdSvc,
		smsService:    smsSvc,
	}
}

// SetupRoutes configures the API routes
func (api *EscrowAPI) SetupRoutes() *chi.Mux {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(customRecoverer) // Use custom recoverer that sends JSON errors
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type", "X-Tenant-ID"},
		ExposedHeaders: []string{"Link"},
		MaxAge:         300,
	}))

	// Health check
	r.Get("/health", api.healthCheck)
	// Readiness check
	r.Get("/ready", api.readyCheck)

	// API v1 routes
	r.Route("/api/v1/escrow", func(r chi.Router) {
		// Contract endpoints
		r.Route("/contracts", func(r chi.Router) {
			r.Post("/", api.createContract)
			r.Get("/", api.listContracts)
			r.Get("/{contractID}", api.getContract)
			r.Post("/{contractID}/fund", api.fundContract)
			r.Post("/{contractID}/release", api.releaseContract)
			r.Post("/{contractID}/refund", api.refundContract)
			r.Post("/{contractID}/dispute", api.raiseDispute)
			r.Get("/{contractID}/timeline", api.getContractTimeline)
			r.Get("/{contractID}/transactions", api.getContractTransactions)
		})

		// Milestone endpoints
		r.Route("/milestones", func(r chi.Router) {
			r.Post("/", api.createMilestone)
			r.Get("/", api.listMilestones)
			r.Get("/{milestoneID}", api.getMilestone)
			r.Put("/{milestoneID}", api.updateMilestone)
			r.Delete("/{milestoneID}", api.deleteMilestone)
		})

		// Dispute endpoints
		r.Route("/disputes", func(r chi.Router) {
			r.Get("/", api.listDisputes)
			r.Get("/{disputeID}", api.getDispute)
			r.Post("/{disputeID}/resolve", api.resolveDispute)
			r.Post("/{disputeID}/escalate", api.escalateDispute)
		})

		// Template endpoints
		r.Route("/templates", func(r chi.Router) {
			r.Get("/", api.listTemplates)
			r.Get("/{templateID}", api.getTemplate)
			r.Post("/", api.createTemplate)
			r.Put("/{templateID}", api.updateTemplate)
		})

		// Reporting endpoints
		r.Route("/reports", func(r chi.Router) {
			r.Get("/summary", api.getEscrowSummary)
			r.Get("/volume", api.getVolumeReport)
			r.Get("/disputes", api.getDisputeReport)
			r.Get("/fees", api.getFeeReport)
			r.Get("/aging", api.getAgingReport)
		})

		// Webhook endpoints
		r.Route("/webhooks", func(r chi.Router) {
			r.Post("/", api.registerWebhook)
			r.Get("/", api.listWebhooks)
			r.Delete("/{webhookID}", api.deleteWebhook)
		})
	})

	// USSD endpoint
	r.Post("/ussd", api.handleUSSD)

	// SMS endpoint
	r.Post("/sms", api.handleSMS)

	return r
}

// Ready check handler
func (api *EscrowAPI) readyCheck(w http.ResponseWriter, r *http.Request) {
	status := map[string]string{
		"database":    "ok",
		"tigerbeetle": "ok",
		"temporal":    "ok",
		"status":      "ready",
		"service":     "escrow-service",
		"version":     "1.0.0",
	}

	// Check database
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := api.escrowService.PingDB(ctx); err != nil {
		status["database"] = "unavailable"
		status["status"] = "not-ready"
	}

	// Check TigerBeetle (if implemented)
	if err := api.escrowService.PingTigerBeetle(ctx); err != nil {
		status["tigerbeetle"] = "unavailable"
		status["status"] = "not-ready"
	}

	// Check Temporal (if implemented)
	if err := api.escrowService.PingTemporal(ctx); err != nil {
		status["temporal"] = "unavailable"
		status["status"] = "not-ready"
	}

	respondJSON(w, http.StatusOK, status)
}

// Response helpers
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    *APIMeta    `json:"meta,omitempty"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type APIMeta struct {
	Page       int `json:"page,omitempty"`
	PerPage    int `json:"per_page,omitempty"`
	Total      int `json:"total,omitempty"`
	TotalPages int `json:"total_pages,omitempty"`
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(APIResponse{
		Success: status >= 200 && status < 300,
		Data:    data,
	})
}

func respondPaginated(w http.ResponseWriter, status int, data interface{}, page, perPage, total int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	totalPages := (total + perPage - 1) / perPage
	json.NewEncoder(w).Encode(APIResponse{
		Success: true,
		Data:    data,
		Meta: &APIMeta{
			Page:       page,
			PerPage:    perPage,
			Total:      total,
			TotalPages: totalPages,
		},
	})
}

// Health check
func (api *EscrowAPI) healthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{
		"status":  "healthy",
		"service": "escrow-service",
		"version": "1.0.0",
	})
}

// Contract handlers

func (api *EscrowAPI) createContract(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title                string                 `json:"title"`
		Description          string                 `json:"description"`
		Type                 string                 `json:"type"`
		UseCase              string                 `json:"use_case"`
		TotalAmount          float64                `json:"total_amount"`
		Currency             string                 `json:"currency"`
		UserID               string                 `json:"user_id"`
		Parties              []CreatePartyInput     `json:"parties"`
		ReleaseConditions    string                 `json:"release_conditions"`
		DisputeWindowDays    *int                   `json:"dispute_window_days,omitempty"`
		AutoReleaseAfterDays *int                   `json:"auto_release_after_days,omitempty"`
		FundingDeadline      *time.Time             `json:"funding_deadline,omitempty"`
		FulfillmentDeadline  *time.Time             `json:"fulfillment_deadline,omitempty"`
		Milestones           []CreateMilestoneInput `json:"milestones,omitempty"`
		Metadata             map[string]interface{} `json:"metadata,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest, err.Error())
		return
	}

	// Get tenant ID from header
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		SendErrorWithKey(w, "bad_request", "X-Tenant-ID header required", http.StatusBadRequest, nil)
		return
	}

	// Map use_case to valid UseCase type
	useCaseMap := map[string]UseCase{
		"SERVICE":      UseCaseFreelance,
		"ECOMMERCE":    UseCaseEcommerce,
		"REAL_ESTATE":  UseCaseRealEstate,
		"FREELANCE":    UseCaseFreelance,
		"LPO":          UseCaseLPO,
		"CONSTRUCTION": UseCaseConstruction,
		"VEHICLE":      UseCaseVehicle,
		"ACQUISITION":  UseCaseAcquisition,
		"GENERAL":      UseCaseGeneral,
	}

	useCase, ok := useCaseMap[input.UseCase]
	if !ok {
		// Default to general if not recognized
		useCase = UseCaseGeneral
	}

	// Build CreateContractInput
	contractInput := CreateContractInput{
		TenantID:             tenantID,
		UseCase:              useCase,
		Title:                input.Title,
		Description:          input.Description,
		TotalAmount:          input.TotalAmount,
		Currency:             input.Currency,
		Parties:              input.Parties,
		FundingDeadline:      input.FundingDeadline,
		FulfillmentDeadline:  input.FulfillmentDeadline,
		DisputeWindowDays:    input.DisputeWindowDays,
		AutoReleaseAfterDays: input.AutoReleaseAfterDays,
		Milestones:           input.Milestones,
		Metadata:             input.Metadata,
		CreatedBy:            input.UserID,
	}

	// Validate parties - must have at least buyer and seller
	if len(contractInput.Parties) < 2 {
		SendErrorWithKey(w, "validation_failed", "At least buyer and seller parties are required", http.StatusBadRequest, nil)
		return
	}

	hasBuyer := false
	hasSeller := false
	for _, party := range contractInput.Parties {
		if party.Role == RoleBuyer {
			hasBuyer = true
		}
		if party.Role == RoleSeller {
			hasSeller = true
		}
	}

	if !hasBuyer {
		SendErrorWithKey(w, "validation_failed", "Buyer party is required", http.StatusBadRequest, nil)
		return
	}
	if !hasSeller {
		SendErrorWithKey(w, "validation_failed", "Seller party is required", http.StatusBadRequest, nil)
		return
	}

	// Add release conditions to metadata if provided
	if input.ReleaseConditions != "" {
		if contractInput.Metadata == nil {
			contractInput.Metadata = make(map[string]interface{})
		}
		contractInput.Metadata["release_conditions"] = input.ReleaseConditions
		contractInput.Metadata["type"] = input.Type
	}

	contract, err := api.escrowService.CreateContract(r.Context(), contractInput)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	// Publish event to Kafka
	event := EscrowEvent{
		Type:      "escrow.contract.created",
		EntityID:  contract.ID,
		TenantID:  contract.TenantID,
		Status:    string(contract.Status),
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"contract_number": contract.ContractNumber,
			"use_case":        contract.UseCase,
			"total_amount":    contract.TotalAmount,
			"currency":        contract.Currency,
			"created_by":      contract.CreatedBy,
		},
	}
	escrowKafkaClient.PublishEvent("escrow.contract.created", event)

	respondJSON(w, http.StatusCreated, contract)
}

func (api *EscrowAPI) listContracts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		SendErrorWithKey(w, "bad_request", "X-Tenant-ID header required", http.StatusBadRequest, nil)
		return
	}

	// Parse query parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	status := r.URL.Query().Get("status")
	useCase := r.URL.Query().Get("use_case")
	userID := r.URL.Query().Get("user_id")

	contracts, total, err := api.listContractsFromDB(r.Context(), tenantID, status, useCase, userID, page, perPage)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondPaginated(w, http.StatusOK, contracts, page, perPage, total)
}

func (api *EscrowAPI) getContract(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	contract, err := api.escrowService.GetContract(r.Context(), contractID)
	if err != nil {
		SendErrorWithKey(w, "not_found", "Contract not found", http.StatusNotFound, nil)
		return
	}

	respondJSON(w, http.StatusOK, contract)
}

func (api *EscrowAPI) fundContract(w http.ResponseWriter, r *http.Request) {
	contractID := sanitizeUTF8(chi.URLParam(r, "contractID"))

	// Read the raw request body
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		SendErrorWithKey(w, "decode_error", "Failed to read request body", http.StatusBadRequest, err.Error())
		return
	}
	defer r.Body.Close()

	// Sanitize the raw body to remove invalid UTF-8 sequences
	sanitizedBody := sanitizeUTF8(string(bodyBytes))

	var input struct {
		Amount        float64 `json:"amount"`
		FundingSource string  `json:"funding_source"`
		Reference     string  `json:"reference"`
	}

	// Decode from sanitized body
	if err := json.NewDecoder(strings.NewReader(sanitizedBody)).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	// Sanitize string inputs to prevent UTF-8 encoding errors
	input.FundingSource = sanitizeUTF8(strings.TrimSpace(input.FundingSource))
	input.Reference = sanitizeUTF8(strings.TrimSpace(input.Reference))

	txn, err := api.escrowService.FundContract(r.Context(), contractID, input.Amount, input.FundingSource, input.Reference)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, txn)
}

func (api *EscrowAPI) releaseContract(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	var input struct {
		UserID string `json:"user_id"`
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	txn, err := api.escrowService.ReleaseContract(r.Context(), contractID, userID, input.Notes)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, txn)
}

func (api *EscrowAPI) refundContract(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	var input struct {
		UserID string `json:"user_id"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	txn, err := api.escrowService.RefundContract(r.Context(), contractID, userID, input.Reason)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, txn)
}

func (api *EscrowAPI) raiseDispute(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	var input struct {
		UserID            string  `json:"user_id"`
		MilestoneID       *string `json:"milestone_id,omitempty"`
		ReasonCategory    string  `json:"reason_category"`
		ReasonDescription string  `json:"reason_description"`
		DisputedAmount    float64 `json:"disputed_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	dispute, err := api.escrowService.RaiseDispute(r.Context(), RaiseDisputeInput{
		ContractID:        contractID,
		MilestoneID:       input.MilestoneID,
		InitiatedBy:       userID,
		InitiatedByRole:   RoleBuyer, // Determine from contract
		ReasonCategory:    input.ReasonCategory,
		ReasonDescription: input.ReasonDescription,
		DisputedAmount:    input.DisputedAmount,
	})

	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusCreated, dispute)
}

func (api *EscrowAPI) getContractTimeline(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	timeline, err := api.getTimelineFromDB(r.Context(), contractID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, timeline)
}

func (api *EscrowAPI) getContractTransactions(w http.ResponseWriter, r *http.Request) {
	contractID := chi.URLParam(r, "contractID")

	transactions, err := api.getTransactionsFromDB(r.Context(), contractID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, transactions)
}

// Milestone handlers

func (api *EscrowAPI) getMilestone(w http.ResponseWriter, r *http.Request) {
	milestoneID := chi.URLParam(r, "milestoneID")

	milestone, err := api.getMilestoneFromDB(r.Context(), milestoneID)
	if err != nil {
		SendErrorWithKey(w, "not_found", "Milestone not found", http.StatusNotFound, nil)
		return
	}

	respondJSON(w, http.StatusOK, milestone)
}

func (api *EscrowAPI) completeMilestone(w http.ResponseWriter, r *http.Request) {
	milestoneID := chi.URLParam(r, "milestoneID")

	var input struct {
		UserID      string   `json:"user_id"`
		DocumentIDs []string `json:"document_ids"`
		Notes       string   `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	milestone, err := api.completeMilestoneInDB(r.Context(), milestoneID, userID, input.DocumentIDs, input.Notes)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, milestone)
}

func (api *EscrowAPI) approveMilestone(w http.ResponseWriter, r *http.Request) {
	milestoneID := chi.URLParam(r, "milestoneID")

	var input struct {
		UserID string `json:"user_id"`
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	milestone, err := api.approveMilestoneInDB(r.Context(), milestoneID, userID, input.Notes)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, milestone)
}

func (api *EscrowAPI) submitMilestoneEvidence(w http.ResponseWriter, r *http.Request) {
	milestoneID := chi.URLParam(r, "milestoneID")

	var input struct {
		UserID      string `json:"user_id"`
		Type        string `json:"type"`
		Description string `json:"description"`
		DocumentID  string `json:"document_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	evidence, err := api.submitMilestoneEvidenceInDB(r.Context(), milestoneID, userID, input.Type, input.Description, input.DocumentID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusCreated, evidence)
}

// Dispute handlers

func (api *EscrowAPI) listDisputes(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		SendErrorWithKey(w, "bad_request", "X-Tenant-ID header required", http.StatusBadRequest, nil)
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	status := r.URL.Query().Get("status")

	disputes, total, err := api.listDisputesFromDB(r.Context(), tenantID, status, page, perPage)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondPaginated(w, http.StatusOK, disputes, page, perPage, total)
}

func (api *EscrowAPI) getDispute(w http.ResponseWriter, r *http.Request) {
	disputeID := chi.URLParam(r, "disputeID")

	dispute, err := api.escrowService.GetDispute(r.Context(), disputeID)
	if err != nil {
		SendErrorWithKey(w, "not_found", "Dispute not found", http.StatusNotFound, nil)
		return
	}

	respondJSON(w, http.StatusOK, dispute)
}

func (api *EscrowAPI) submitDisputeEvidence(w http.ResponseWriter, r *http.Request) {
	disputeID := chi.URLParam(r, "disputeID")

	var input struct {
		UserID      string `json:"user_id"`
		Type        string `json:"type"`
		Description string `json:"description"`
		DocumentID  string `json:"document_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	evidence, err := api.submitDisputeEvidenceInDB(r.Context(), disputeID, userID, input.Type, input.Description, input.DocumentID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusCreated, evidence)
}

func (api *EscrowAPI) resolveDispute(w http.ResponseWriter, r *http.Request) {
	disputeID := chi.URLParam(r, "disputeID")

	var input struct {
		UserID string `json:"user_id"`
		// add other fields as needed for ResolveDisputeInput
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	var resolveInput ResolveDisputeInput
	resolveInput.DisputeID = disputeID
	resolveInput.ResolvedBy = input.UserID
	// copy other fields from input to resolveInput as needed
	dispute, err := api.escrowService.ResolveDispute(r.Context(), resolveInput)

	// dispute, err := api.escrowService.ResolveDispute(r.Context(), input)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, dispute)
}

func (api *EscrowAPI) escalateDispute(w http.ResponseWriter, r *http.Request) {
	disputeID := chi.URLParam(r, "disputeID")

	var input struct {
		UserID string `json:"user_id"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}
	userID := input.UserID
	dispute, err := api.escalateDisputeInDB(r.Context(), disputeID, userID, input.Reason)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, dispute)
}

// Template handlers

func (api *EscrowAPI) listTemplates(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	templates, err := api.listTemplatesFromDB(r.Context(), tenantID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, templates)
}

func (api *EscrowAPI) getTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := chi.URLParam(r, "templateID")

	template, err := api.escrowService.GetTemplate(r.Context(), templateID)
	if err != nil {
		SendErrorWithKey(w, "not_found", "Template not found", http.StatusNotFound, nil)
		return
	}

	respondJSON(w, http.StatusOK, template)
}

func (api *EscrowAPI) createTemplate(w http.ResponseWriter, r *http.Request) {
	var input EscrowTemplate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	input.TenantID = &tenantID

	template, err := api.createTemplateInDB(r.Context(), &input)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusCreated, template)
}

func (api *EscrowAPI) updateTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := chi.URLParam(r, "templateID")

	var input EscrowTemplate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	input.ID = templateID

	template, err := api.updateTemplateInDB(r.Context(), &input)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, template)
}

// Report handlers

func (api *EscrowAPI) getEscrowSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		SendErrorWithKey(w, "bad_request", "X-Tenant-ID header required", http.StatusBadRequest, nil)
		return
	}

	summary, err := api.getEscrowSummaryFromDB(r.Context(), tenantID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, summary)
}

func (api *EscrowAPI) getVolumeReport(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	groupBy := r.URL.Query().Get("group_by") // day, week, month

	report, err := api.getVolumeReportFromDB(r.Context(), tenantID, startDate, endDate, groupBy)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (api *EscrowAPI) getDisputeReport(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	report, err := api.getDisputeReportFromDB(r.Context(), tenantID, startDate, endDate)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (api *EscrowAPI) getFeeReport(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	report, err := api.getFeeReportFromDB(r.Context(), tenantID, startDate, endDate)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (api *EscrowAPI) getAgingReport(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	report, err := api.getAgingReportFromDB(r.Context(), tenantID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, report)
}

// Webhook handlers

func (api *EscrowAPI) registerWebhook(w http.ResponseWriter, r *http.Request) {
	var input struct {
		URL    string   `json:"url"`
		Events []string `json:"events"`
		Secret string   `json:"secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")

	webhook, err := api.registerWebhookInDB(r.Context(), tenantID, input.URL, input.Events, input.Secret)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusCreated, webhook)
}

func (api *EscrowAPI) listWebhooks(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	webhooks, err := api.listWebhooksFromDB(r.Context(), tenantID)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, webhooks)
}

func (api *EscrowAPI) deleteWebhook(w http.ResponseWriter, r *http.Request) {
	webhookID := chi.URLParam(r, "webhookID")

	if err := api.deleteWebhookFromDB(r.Context(), webhookID); err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// USSD handler
func (api *EscrowAPI) handleUSSD(w http.ResponseWriter, r *http.Request) {
	var req USSDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request", http.StatusBadRequest, err.Error())
		return
	}

	resp, err := api.ussdService.ProcessUSSD(r.Context(), req)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(resp.Message))
}

// SMS handler
func (api *EscrowAPI) handleSMS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		From    string `json:"from"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorWithKey(w, "decode_error", "Invalid request body", http.StatusBadRequest, err.Error())
		return
	}

	response, err := api.smsService.ProcessSMSCommand(r.Context(), req.From, req.Message)
	if err != nil {
		SendErrorWithKey(w, "internal_error", err.Error(), http.StatusInternalServerError, nil)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"response": response})
}

// Database helper stubs (implement with actual SQL)

func (api *EscrowAPI) listContractsFromDB(ctx context.Context, tenantID, status, useCase, userID string, page, perPage int) ([]EscrowContract, int, error) {
	// Force a timeout to prevent indefinite waiting
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Build query
	query := `SELECT id, contract_number, title, total_amount, currency, status, created_at 
              FROM escrow_contracts 
              WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	// Get total count first (faster than loading all data)
	countQuery := "SELECT COUNT(*) FROM escrow_contracts WHERE tenant_id = $1"
	countArgs := []interface{}{tenantID}
	if status != "" {
		countQuery += " AND status = $2"
		countArgs = append(countArgs, status)
	}

	var total int
	err := api.escrowService.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count query failed: %w", err)
	}

	// Add pagination
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, perPage, (page-1)*perPage)

	rows, err := api.escrowService.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var contracts []EscrowContract
	for rows.Next() {
		var c EscrowContract
		err := rows.Scan(&c.ID, &c.ContractNumber, &c.Title, &c.TotalAmount,
			&c.Currency, &c.Status, &c.CreatedAt)
		if err != nil {
			continue
		}
		contracts = append(contracts, c)
	}

	return contracts, total, nil
}

func (api *EscrowAPI) getTimelineFromDB(ctx context.Context, contractID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (api *EscrowAPI) getTransactionsFromDB(ctx context.Context, contractID string) ([]EscrowTransaction, error) {
	return []EscrowTransaction{}, nil
}

func (api *EscrowAPI) getMilestoneFromDB(ctx context.Context, milestoneID string) (*Milestone, error) {
	return nil, nil
}

func (api *EscrowAPI) completeMilestoneInDB(ctx context.Context, milestoneID, userID string, documentIDs []string, notes string) (*Milestone, error) {
	return nil, nil
}

func (api *EscrowAPI) approveMilestoneInDB(ctx context.Context, milestoneID, userID, notes string) (*Milestone, error) {
	return nil, nil
}

func (api *EscrowAPI) submitMilestoneEvidenceInDB(ctx context.Context, milestoneID, userID, evidenceType, description, documentID string) (*Evidence, error) {
	return nil, nil
}

func (api *EscrowAPI) listDisputesFromDB(ctx context.Context, tenantID, status string, page, perPage int) ([]Dispute, int, error) {
	return []Dispute{}, 0, nil
}

func (api *EscrowAPI) submitDisputeEvidenceInDB(ctx context.Context, disputeID, userID, evidenceType, description, documentID string) (*Evidence, error) {
	return nil, nil
}

func (api *EscrowAPI) escalateDisputeInDB(ctx context.Context, disputeID, userID, reason string) (*Dispute, error) {
	return nil, nil
}

func (api *EscrowAPI) listTemplatesFromDB(ctx context.Context, tenantID string) ([]EscrowTemplate, error) {
	return []EscrowTemplate{}, nil
}

func (api *EscrowAPI) createTemplateInDB(ctx context.Context, template *EscrowTemplate) (*EscrowTemplate, error) {
	return template, nil
}

func (api *EscrowAPI) updateTemplateInDB(ctx context.Context, template *EscrowTemplate) (*EscrowTemplate, error) {
	return template, nil
}

func (api *EscrowAPI) getEscrowSummaryFromDB(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) getVolumeReportFromDB(ctx context.Context, tenantID, startDate, endDate, groupBy string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) getDisputeReportFromDB(ctx context.Context, tenantID, startDate, endDate string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) getFeeReportFromDB(ctx context.Context, tenantID, startDate, endDate string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) getAgingReportFromDB(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) registerWebhookInDB(ctx context.Context, tenantID, url string, events []string, secret string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}

func (api *EscrowAPI) listWebhooksFromDB(ctx context.Context, tenantID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (api *EscrowAPI) deleteWebhookFromDB(ctx context.Context, webhookID string) error {
	return nil
}

var escrowKafkaClient = NewEscrowKafkaClient()
