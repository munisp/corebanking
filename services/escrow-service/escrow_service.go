package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	tigerbeetle "github.com/tigerbeetle/tigerbeetle-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// toUint128 converts a uint64 to TigerBeetle's Uint128 type
func toUint128(value uint64) types.Uint128 {
	var result types.Uint128
	// Pack value into first 8 bytes (little-endian)
	for i := 0; i < 8; i++ {
		result[i] = byte(value >> (8 * uint(i)))
	}
	// Remaining 8 bytes stay zero (for values that fit in 64 bits)
	return result
}

// PingDB checks if the database is reachable
func (s *EscrowService) PingDB(ctx context.Context) error {
	return s.db.Ping(ctx)
}

// PingTigerBeetle checks if TigerBeetle is reachable (stub, always returns nil unless implemented)
func (s *EscrowService) PingTigerBeetle(ctx context.Context) error {
	// TODO: Implement actual TigerBeetle health check if available
	return nil
}

// PingTemporal checks if Temporal is reachable (stub, always returns nil unless implemented)
func (s *EscrowService) PingTemporal(ctx context.Context) error {
	// TODO: Implement actual Temporal health check if available
	return nil
}

// Next-Generation Escrow Service for 54Bank
// Supports multiple use cases: e-commerce, real estate, freelance, LPO, construction, vehicle, acquisition

// Prometheus metrics
var (
	escrowContractsCreated = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "escrow_contracts_created_total",
			Help: "Total escrow contracts created",
		},
		[]string{"tenant_id", "use_case"},
	)

	escrowContractsFunded = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "escrow_contracts_funded_total",
			Help: "Total escrow contracts funded",
		},
		[]string{"tenant_id", "use_case"},
	)

	escrowContractsReleased = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "escrow_contracts_released_total",
			Help: "Total escrow contracts released",
		},
		[]string{"tenant_id", "use_case"},
	)

	escrowContractsDisputed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "escrow_contracts_disputed_total",
			Help: "Total escrow contracts disputed",
		},
		[]string{"tenant_id", "use_case"},
	)

	escrowTotalVolume = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "escrow_total_volume_naira",
			Help: "Total escrow volume in Naira",
		},
		[]string{"tenant_id", "use_case"},
	)

	escrowActiveBalance = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "escrow_active_balance_naira",
			Help: "Current active escrow balance in Naira",
		},
		[]string{"tenant_id"},
	)

	escrowProcessingTime = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "escrow_processing_seconds",
			Help:    "Escrow operation processing time",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
		},
		[]string{"operation"},
	)
)

// TigerBeetle ledger codes for escrow
const (
	LedgerCodeEscrowOmnibus  uint32 = 2001
	LedgerCodeEscrowContract uint32 = 2002
	LedgerCodeEscrowFee      uint32 = 2003
	LedgerCodeEscrowReserve  uint32 = 2004
	LedgerCodeEscrowDispute  uint32 = 2005
)

// Account flags for TigerBeetle
const (
	AccountFlagLinked  uint16 = 1 << 0
	AccountFlagDebits  uint16 = 1 << 1
	AccountFlagCredits uint16 = 1 << 2
	AccountFlagHistory uint16 = 1 << 3
)

// UseCase represents escrow use cases
type UseCase string

const (
	UseCaseEcommerce    UseCase = "ecommerce"
	UseCaseRealEstate   UseCase = "real_estate"
	UseCaseFreelance    UseCase = "freelance"
	UseCaseLPO          UseCase = "lpo"
	UseCaseConstruction UseCase = "construction"
	UseCaseVehicle      UseCase = "vehicle"
	UseCaseAcquisition  UseCase = "acquisition"
	UseCaseGeneral      UseCase = "general"
)

// ContractStatus represents escrow contract status
type ContractStatus string

const (
	StatusCreated           ContractStatus = "created"
	StatusAwaitingFunding   ContractStatus = "awaiting_funding"
	StatusFunded            ContractStatus = "funded"
	StatusInProgress        ContractStatus = "in_progress"
	StatusReleased          ContractStatus = "released"
	StatusRefunded          ContractStatus = "refunded"
	StatusDisputed          ContractStatus = "disputed"
	StatusResolvedBuyer     ContractStatus = "resolved_buyer"
	StatusResolvedSeller    ContractStatus = "resolved_seller"
	StatusPartialSettlement ContractStatus = "partial_settlement"
	StatusExpired           ContractStatus = "expired"
	StatusCancelled         ContractStatus = "cancelled"
)

// MilestoneStatus represents milestone status
type MilestoneStatus string

const (
	MilestoneStatusPending          MilestoneStatus = "pending"
	MilestoneStatusFunded           MilestoneStatus = "funded"
	MilestoneStatusInProgress       MilestoneStatus = "in_progress"
	MilestoneStatusAwaitingApproval MilestoneStatus = "awaiting_approval"
	MilestoneStatusCompleted        MilestoneStatus = "completed"
	MilestoneStatusDisputed         MilestoneStatus = "disputed"
	MilestoneStatusReleased         MilestoneStatus = "released"
	MilestoneStatusRefunded         MilestoneStatus = "refunded"
)

// DisputeStatus represents dispute status
type DisputeStatus string

const (
	DisputeStatusOpen              DisputeStatus = "open"
	DisputeStatusUnderReview       DisputeStatus = "under_review"
	DisputeStatusAwaitingEvidence  DisputeStatus = "awaiting_evidence"
	DisputeStatusAwaitingDecision  DisputeStatus = "awaiting_decision"
	DisputeStatusResolvedBuyer     DisputeStatus = "resolved_buyer"
	DisputeStatusResolvedSeller    DisputeStatus = "resolved_seller"
	DisputeStatusPartialSettlement DisputeStatus = "partial_settlement"
	DisputeStatusEscalated         DisputeStatus = "escalated"
	DisputeStatusClosed            DisputeStatus = "closed"
)

// FeeType represents fee calculation type
type FeeType string

const (
	FeeTypePercentage FeeType = "percentage"
	FeeTypeFlat       FeeType = "flat"
	FeeTypeTiered     FeeType = "tiered"
)

// FeePayer represents who pays the fee
type FeePayer string

const (
	FeePayerBuyer    FeePayer = "buyer"
	FeePayerSeller   FeePayer = "seller"
	FeePayerSplit    FeePayer = "split"
	FeePayerPlatform FeePayer = "platform"
)

// PartyRole represents party roles in escrow
type PartyRole string

const (
	RoleBuyer      PartyRole = "buyer"
	RoleSeller     PartyRole = "seller"
	RolePlatform   PartyRole = "platform"
	RoleAgent      PartyRole = "agent"
	RoleArbitrator PartyRole = "arbitrator"
	RoleLogistics  PartyRole = "logistics"
	RoleInspector  PartyRole = "inspector"
)

// EscrowContract represents an escrow contract
type EscrowContract struct {
	ID                   string                 `json:"id"`
	ContractNumber       string                 `json:"contract_number"`
	TenantID             string                 `json:"tenant_id"`
	UseCase              UseCase                `json:"use_case"`
	Title                string                 `json:"title"`
	Description          string                 `json:"description,omitempty"`
	TotalAmount          float64                `json:"total_amount"`
	Currency             string                 `json:"currency"`
	Parties              []EscrowParty          `json:"parties"`
	FundingDeadline      *time.Time             `json:"funding_deadline,omitempty"`
	FulfillmentDeadline  *time.Time             `json:"fulfillment_deadline,omitempty"`
	DisputeWindowDays    int                    `json:"dispute_window_days"`
	AutoReleaseAfterDays *int                   `json:"auto_release_after_days,omitempty"`
	FeeType              FeeType                `json:"fee_type"`
	FeeRate              *float64               `json:"fee_rate,omitempty"`
	FeeAmount            *float64               `json:"fee_amount,omitempty"`
	FeeTiers             []FeeTier              `json:"fee_tiers,omitempty"`
	FeePayer             FeePayer               `json:"fee_payer"`
	Status               ContractStatus         `json:"status"`
	TigerBeetleID        types.Uint128          `json:"-"`
	Milestones           []Milestone            `json:"milestones,omitempty"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
	TemplateID           *string                `json:"template_id,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	FundedAt             *time.Time             `json:"funded_at,omitempty"`
	CompletedAt          *time.Time             `json:"completed_at,omitempty"`
	ExpiresAt            *time.Time             `json:"expires_at,omitempty"`
	CreatedBy            string                 `json:"created_by"`
}

// EscrowParty represents a party in an escrow contract
type EscrowParty struct {
	ID              string        `json:"id"`
	Role            PartyRole     `json:"role"`
	UserID          *string       `json:"user_id,omitempty"`
	BusinessID      *string       `json:"business_id,omitempty"`
	Name            string        `json:"name"`
	Email           string        `json:"email,omitempty"`
	Phone           string        `json:"phone,omitempty"`
	AccountNumber   string        `json:"account_number,omitempty"`
	BankCode        string        `json:"bank_code,omitempty"`
	TigerBeetleID   types.Uint128 `json:"-"`
	SplitPercentage *float64      `json:"split_percentage,omitempty"`
	SplitAmount     *float64      `json:"split_amount,omitempty"`
	KYCVerified     bool          `json:"kyc_verified"`
	KYCLevel        int           `json:"kyc_level"`
}

// Milestone represents an escrow milestone
type Milestone struct {
	ID                string          `json:"id"`
	ContractID        string          `json:"contract_id"`
	SequenceNumber    int             `json:"sequence_number"`
	Name              string          `json:"name"`
	Description       string          `json:"description,omitempty"`
	Amount            *float64        `json:"amount,omitempty"`
	Percentage        *float64        `json:"percentage,omitempty"`
	Conditions        []Condition     `json:"conditions,omitempty"`
	RequiredApprovals []PartyRole     `json:"required_approvals,omitempty"`
	RequiredDocuments []string        `json:"required_documents,omitempty"`
	Deadline          *time.Time      `json:"deadline,omitempty"`
	Status            MilestoneStatus `json:"status"`
	Evidence          []Evidence      `json:"evidence,omitempty"`
	Approvals         []Approval      `json:"approvals,omitempty"`
	FundedAt          *time.Time      `json:"funded_at,omitempty"`
	CompletedAt       *time.Time      `json:"completed_at,omitempty"`
	ReleasedAt        *time.Time      `json:"released_at,omitempty"`
}

// Condition represents a milestone condition
type Condition struct {
	Type        string     `json:"type"`
	Description string     `json:"description"`
	Met         bool       `json:"met"`
	MetAt       *time.Time `json:"met_at,omitempty"`
	MetBy       *string    `json:"met_by,omitempty"`
}

// Evidence represents evidence for a milestone or dispute
type Evidence struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Description string    `json:"description"`
	DocumentID  string    `json:"document_id"`
	UploadedBy  string    `json:"uploaded_by"`
	UploadedAt  time.Time `json:"uploaded_at"`
	Verified    bool      `json:"verified"`
}

// Approval represents an approval for a milestone
type Approval struct {
	Role       PartyRole `json:"role"`
	ApprovedBy string    `json:"approved_by"`
	ApprovedAt time.Time `json:"approved_at"`
	Notes      string    `json:"notes,omitempty"`
}

// FeeTier represents a tiered fee structure
type FeeTier struct {
	MaxAmount *float64 `json:"max_amount,omitempty"`
	Rate      float64  `json:"rate"`
}

// Dispute represents an escrow dispute
type Dispute struct {
	ID                     string        `json:"id"`
	DisputeNumber          string        `json:"dispute_number"`
	ContractID             string        `json:"contract_id"`
	MilestoneID            *string       `json:"milestone_id,omitempty"`
	InitiatedBy            string        `json:"initiated_by"`
	InitiatedByRole        PartyRole     `json:"initiated_by_role"`
	ReasonCategory         string        `json:"reason_category"`
	ReasonDescription      string        `json:"reason_description"`
	DisputedAmount         float64       `json:"disputed_amount"`
	Status                 DisputeStatus `json:"status"`
	BuyerEvidence          []Evidence    `json:"buyer_evidence,omitempty"`
	SellerEvidence         []Evidence    `json:"seller_evidence,omitempty"`
	ResolutionType         *string       `json:"resolution_type,omitempty"`
	ResolutionAmountBuyer  *float64      `json:"resolution_amount_buyer,omitempty"`
	ResolutionAmountSeller *float64      `json:"resolution_amount_seller,omitempty"`
	ResolutionNotes        *string       `json:"resolution_notes,omitempty"`
	ResolvedBy             *string       `json:"resolved_by,omitempty"`
	ResolvedAt             *time.Time    `json:"resolved_at,omitempty"`
	EvidenceDeadline       *time.Time    `json:"evidence_deadline,omitempty"`
	DecisionDeadline       *time.Time    `json:"decision_deadline,omitempty"`
	Escalated              bool          `json:"escalated"`
	CreatedAt              time.Time     `json:"created_at"`
}

// EscrowTransaction represents a transaction on an escrow contract
type EscrowTransaction struct {
	ID                string                 `json:"id"`
	ContractID        string                 `json:"contract_id"`
	MilestoneID       *string                `json:"milestone_id,omitempty"`
	TransactionType   string                 `json:"transaction_type"`
	Amount            float64                `json:"amount"`
	Currency          string                 `json:"currency"`
	FromPartyID       *string                `json:"from_party_id,omitempty"`
	ToPartyID         *string                `json:"to_party_id,omitempty"`
	TigerBeetleID     types.Uint128          `json:"-"`
	Reference         string                 `json:"reference"`
	ExternalReference string                 `json:"external_reference,omitempty"`
	Status            string                 `json:"status"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	CompletedAt       *time.Time             `json:"completed_at,omitempty"`
}

// EscrowTemplate represents a use case template
type EscrowTemplate struct {
	ID                       string              `json:"id"`
	TenantID                 *string             `json:"tenant_id,omitempty"`
	Name                     string              `json:"name"`
	UseCase                  UseCase             `json:"use_case"`
	Description              string              `json:"description,omitempty"`
	DefaultDisputeWindowDays int                 `json:"default_dispute_window_days"`
	DefaultAutoReleaseDays   *int                `json:"default_auto_release_days,omitempty"`
	FeeType                  FeeType             `json:"fee_type"`
	FeeRate                  *float64            `json:"fee_rate,omitempty"`
	FeeAmount                *float64            `json:"fee_amount,omitempty"`
	FeeTiers                 []FeeTier           `json:"fee_tiers,omitempty"`
	FeePayer                 FeePayer            `json:"fee_payer"`
	KYCLevelRequired         int                 `json:"kyc_level_required"`
	MinAmount                *float64            `json:"min_amount,omitempty"`
	MaxAmount                *float64            `json:"max_amount,omitempty"`
	MilestoneTemplates       []MilestoneTemplate `json:"milestone_templates,omitempty"`
	IsActive                 bool                `json:"is_active"`
	IsSystem                 bool                `json:"is_system"`
}

// MilestoneTemplate represents a milestone template
type MilestoneTemplate struct {
	Sequence   int      `json:"sequence"`
	Name       string   `json:"name"`
	Percentage float64  `json:"percentage"`
	Conditions []string `json:"conditions,omitempty"`
}

// EscrowService handles escrow operations
type EscrowService struct {
	db              *pgxpool.Pool
	tbClient        tigerbeetle.Client
	idGenerator     *IDGenerator
	kycService      KYCService
	fraudService    FraudService
	notificationSvc NotificationService
	auditService    AuditService
	mutex           sync.RWMutex
}

// IDGenerator generates unique IDs for TigerBeetle
type IDGenerator struct {
	counter uint64
	mutex   sync.Mutex
}

// NewIDGenerator creates a new ID generator
func NewIDGenerator() *IDGenerator {
	return &IDGenerator{
		counter: uint64(time.Now().UnixNano()),
	}
}

// NextID generates the next unique ID
func (g *IDGenerator) NextID() types.Uint128 {
	g.mutex.Lock()
	defer g.mutex.Unlock()
	g.counter++

	var id types.Uint128
	binary.LittleEndian.PutUint64(id[:8], g.counter)
	binary.LittleEndian.PutUint64(id[8:], uint64(time.Now().UnixNano()))
	return id
}

// Service interfaces
type KYCService interface {
	VerifyUser(ctx context.Context, userID string) (bool, int, error)
	VerifyBusiness(ctx context.Context, businessID string) (bool, int, error)
}

type FraudService interface {
	ScoreEscrow(ctx context.Context, contract *EscrowContract) (float64, []string, error)
	CheckParty(ctx context.Context, partyID string) (bool, error)
}

type NotificationService interface {
	SendNotification(ctx context.Context, userID string, notification interface{}) error
	SendSMS(ctx context.Context, phone, message string) error
	SendEmail(ctx context.Context, email, subject, body string) error
}

type AuditService interface {
	LogEvent(ctx context.Context, event AuditEvent) error
}

type AuditEvent struct {
	TenantID      string                 `json:"tenant_id"`
	EntityType    string                 `json:"entity_type"`
	EntityID      string                 `json:"entity_id"`
	EventType     string                 `json:"event_type"`
	ActorID       string                 `json:"actor_id"`
	ActorType     string                 `json:"actor_type"`
	Details       map[string]interface{} `json:"details"`
	PreviousState interface{}            `json:"previous_state,omitempty"`
	NewState      interface{}            `json:"new_state,omitempty"`
}

// NewEscrowService creates a new escrow service
func NewEscrowService(
	db *pgxpool.Pool,
	tbClient tigerbeetle.Client,
	kycSvc KYCService,
	fraudSvc FraudService,
	notifSvc NotificationService,
	auditSvc AuditService,
) *EscrowService {
	return &EscrowService{
		db:              db,
		tbClient:        tbClient,
		idGenerator:     NewIDGenerator(),
		kycService:      kycSvc,
		fraudService:    fraudSvc,
		notificationSvc: notifSvc,
		auditService:    auditSvc,
	}
}

// CreateContractInput represents input for creating an escrow contract
type CreateContractInput struct {
	TenantID             string                 `json:"tenant_id"`
	UseCase              UseCase                `json:"use_case"`
	Title                string                 `json:"title"`
	Description          string                 `json:"description,omitempty"`
	TotalAmount          float64                `json:"total_amount"`
	Currency             string                 `json:"currency"`
	Parties              []CreatePartyInput     `json:"parties"`
	FundingDeadline      *time.Time             `json:"funding_deadline,omitempty"`
	FulfillmentDeadline  *time.Time             `json:"fulfillment_deadline,omitempty"`
	DisputeWindowDays    *int                   `json:"dispute_window_days,omitempty"`
	AutoReleaseAfterDays *int                   `json:"auto_release_after_days,omitempty"`
	Milestones           []CreateMilestoneInput `json:"milestones,omitempty"`
	TemplateID           *string                `json:"template_id,omitempty"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
	CreatedBy            string                 `json:"created_by"`
}

// CreatePartyInput represents input for creating a party
type CreatePartyInput struct {
	Role            PartyRole `json:"role"`
	UserID          *string   `json:"user_id,omitempty"`
	BusinessID      *string   `json:"business_id,omitempty"`
	Name            string    `json:"name"`
	Email           string    `json:"email,omitempty"`
	Phone           string    `json:"phone,omitempty"`
	AccountNumber   string    `json:"account_number,omitempty"`
	BankCode        string    `json:"bank_code,omitempty"`
	SplitPercentage *float64  `json:"split_percentage,omitempty"`
	SplitAmount     *float64  `json:"split_amount,omitempty"`
}

// CreateMilestoneInput represents input for creating a milestone
type CreateMilestoneInput struct {
	Name              string      `json:"name"`
	Description       string      `json:"description,omitempty"`
	Amount            *float64    `json:"amount,omitempty"`
	Percentage        *float64    `json:"percentage,omitempty"`
	Conditions        []string    `json:"conditions,omitempty"`
	RequiredApprovals []PartyRole `json:"required_approvals,omitempty"`
	RequiredDocuments []string    `json:"required_documents,omitempty"`
	Deadline          *time.Time  `json:"deadline,omitempty"`
}

// CreateContract creates a new escrow contract
func (s *EscrowService) CreateContract(ctx context.Context, input CreateContractInput) (*EscrowContract, error) {
	start := time.Now()
	defer func() {
		escrowProcessingTime.WithLabelValues("create_contract").Observe(time.Since(start).Seconds())
	}()

	// Validate input
	if err := s.validateCreateInput(input); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Get template if specified
	var template *EscrowTemplate
	if input.TemplateID != nil {
		var err error
		template, err = s.GetTemplate(ctx, *input.TemplateID)
		if err != nil {
			return nil, fmt.Errorf("failed to get template: %w", err)
		}
	} else {
		// Get default template for use case
		template, _ = s.GetDefaultTemplate(ctx, input.UseCase)
	}

	// Apply template defaults
	disputeWindowDays := 7
	if input.DisputeWindowDays != nil {
		disputeWindowDays = *input.DisputeWindowDays
	} else if template != nil {
		disputeWindowDays = template.DefaultDisputeWindowDays
	}

	// Generate contract number
	contractNumber := fmt.Sprintf("ESC-%s-%d", string(input.UseCase)[:3], time.Now().UnixNano()%1000000)

	// Create TigerBeetle account for the contract (only if client is available)
	var tbID types.Uint128
	tbID = s.idGenerator.NextID()

	if s.tbClient != nil {
		accounts := []types.Account{
			{
				ID:     tbID,
				Ledger: LedgerCodeEscrowContract,
				Code:   uint16(LedgerCodeEscrowContract),
				Flags:  AccountFlagDebits | AccountFlagHistory,
			},
		}

		results, err := s.tbClient.CreateAccounts(accounts)
		if err != nil {
			return nil, fmt.Errorf("failed to create TigerBeetle account: %w", err)
		}
		if len(results) > 0 {
			return nil, fmt.Errorf("TigerBeetle account creation failed: %v", results[0].Result)
		}
	}

	// Create contract
	contract := &EscrowContract{
		ID:                   uuid.New().String(),
		ContractNumber:       contractNumber,
		TenantID:             input.TenantID,
		UseCase:              input.UseCase,
		Title:                input.Title,
		Description:          input.Description,
		TotalAmount:          input.TotalAmount,
		Currency:             input.Currency,
		FundingDeadline:      input.FundingDeadline,
		FulfillmentDeadline:  input.FulfillmentDeadline,
		DisputeWindowDays:    disputeWindowDays,
		AutoReleaseAfterDays: input.AutoReleaseAfterDays,
		Status:               StatusCreated,
		TigerBeetleID:        tbID,
		Metadata:             input.Metadata,
		CreatedAt:            time.Now(),
		CreatedBy:            input.CreatedBy,
	}

	// Apply fee structure from template
	if template != nil {
		contract.FeeType = template.FeeType
		contract.FeeRate = template.FeeRate
		contract.FeeAmount = template.FeeAmount
		contract.FeeTiers = template.FeeTiers
		contract.FeePayer = template.FeePayer
		contract.TemplateID = &template.ID
	} else {
		// Default fee structure
		contract.FeeType = FeeTypePercentage
		defaultRate := 0.015
		contract.FeeRate = &defaultRate
		contract.FeePayer = FeePayerSplit
	}

	// Create parties
	for _, partyInput := range input.Parties {
		party := EscrowParty{
			ID:              uuid.New().String(),
			Role:            partyInput.Role,
			UserID:          partyInput.UserID,
			BusinessID:      partyInput.BusinessID,
			Name:            partyInput.Name,
			Email:           partyInput.Email,
			Phone:           partyInput.Phone,
			AccountNumber:   partyInput.AccountNumber,
			BankCode:        partyInput.BankCode,
			SplitPercentage: partyInput.SplitPercentage,
			SplitAmount:     partyInput.SplitAmount,
			TigerBeetleID:   s.idGenerator.NextID(),
		}

		// Verify KYC if user/business ID provided
		if partyInput.UserID != nil {
			verified, level, _ := s.kycService.VerifyUser(ctx, *partyInput.UserID)
			party.KYCVerified = verified
			party.KYCLevel = level
		} else if partyInput.BusinessID != nil {
			verified, level, _ := s.kycService.VerifyBusiness(ctx, *partyInput.BusinessID)
			party.KYCVerified = verified
			party.KYCLevel = level
		}

		contract.Parties = append(contract.Parties, party)
	}

	// Create milestones
	if len(input.Milestones) > 0 {
		for i, msInput := range input.Milestones {
			milestone := Milestone{
				ID:                uuid.New().String(),
				ContractID:        contract.ID,
				SequenceNumber:    i + 1,
				Name:              msInput.Name,
				Description:       msInput.Description,
				Amount:            msInput.Amount,
				Percentage:        msInput.Percentage,
				RequiredApprovals: msInput.RequiredApprovals,
				RequiredDocuments: msInput.RequiredDocuments,
				Deadline:          msInput.Deadline,
				Status:            MilestoneStatusPending,
			}

			// Convert condition strings to Condition objects
			for _, cond := range msInput.Conditions {
				milestone.Conditions = append(milestone.Conditions, Condition{
					Type:        cond,
					Description: cond,
					Met:         false,
				})
			}

			contract.Milestones = append(contract.Milestones, milestone)
		}
	} else if template != nil && len(template.MilestoneTemplates) > 0 {
		// Apply milestone templates
		for _, msTmpl := range template.MilestoneTemplates {
			amount := input.TotalAmount * (msTmpl.Percentage / 100)
			milestone := Milestone{
				ID:             uuid.New().String(),
				ContractID:     contract.ID,
				SequenceNumber: msTmpl.Sequence,
				Name:           msTmpl.Name,
				Amount:         &amount,
				Percentage:     &msTmpl.Percentage,
				Status:         MilestoneStatusPending,
			}

			for _, cond := range msTmpl.Conditions {
				milestone.Conditions = append(milestone.Conditions, Condition{
					Type:        cond,
					Description: cond,
					Met:         false,
				})
			}

			contract.Milestones = append(contract.Milestones, milestone)
		}
	}

	// Run fraud check
	riskScore, alerts, _ := s.fraudService.ScoreEscrow(ctx, contract)
	if riskScore > 0.8 {
		return nil, fmt.Errorf("escrow blocked due to high fraud risk: %v", alerts)
	}

	// Store in database
	if err := s.storeContract(ctx, contract); err != nil {
		return nil, fmt.Errorf("failed to store contract: %w", err)
	}

	// Update status to awaiting funding
	contract.Status = StatusAwaitingFunding
	if err := s.updateContractStatus(ctx, contract.ID, StatusAwaitingFunding); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   input.TenantID,
		EntityType: "escrow_contract",
		EntityID:   contract.ID,
		EventType:  "contract_created",
		ActorID:    input.CreatedBy,
		ActorType:  "user",
		Details: map[string]interface{}{
			"contract_number": contractNumber,
			"use_case":        input.UseCase,
			"total_amount":    input.TotalAmount,
			"parties_count":   len(contract.Parties),
		},
		NewState: contract,
	})

	// Send notifications to parties
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":            "escrow_created",
			"contract_id":     contract.ID,
			"contract_number": contractNumber,
			"role":            party.Role,
			"amount":          input.TotalAmount,
		})
	}

	// Record metrics
	escrowContractsCreated.WithLabelValues(input.TenantID, string(input.UseCase)).Inc()

	return contract, nil
}

// FundContract funds an escrow contract
func (s *EscrowService) FundContract(ctx context.Context, contractID string, amount float64, fundingSource string, reference string) (*EscrowTransaction, error) {
	start := time.Now()
	defer func() {
		escrowProcessingTime.WithLabelValues("fund_contract").Observe(time.Since(start).Seconds())
	}()

	// Get contract
	contract, err := s.GetContract(ctx, contractID)
	if err != nil {
		return nil, err
	}

	if contract.Status != StatusAwaitingFunding && contract.Status != StatusCreated {
		return nil, fmt.Errorf("contract cannot be funded in status: %s", contract.Status)
	}

	if amount < contract.TotalAmount {
		return nil, fmt.Errorf("funding amount %.2f is less than required %.2f", amount, contract.TotalAmount)
	}

	// Check funding deadline
	if contract.FundingDeadline != nil && time.Now().After(*contract.FundingDeadline) {
		return nil, fmt.Errorf("funding deadline has passed")
	}

	// Create TigerBeetle transfer (only if client is available)
	transferID := s.idGenerator.NextID()
	amountInKobo := uint64(amount * 100)

	// Get buyer's account (source)
	var buyerTBID types.Uint128
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer {
			buyerTBID = party.TigerBeetleID
			break
		}
	}

	if s.tbClient != nil {
		transfers := []types.Transfer{
			{
				ID:              transferID,
				DebitAccountID:  buyerTBID,
				CreditAccountID: contract.TigerBeetleID,
				Amount:          toUint128(amountInKobo),
				Ledger:          LedgerCodeEscrowContract,
				Code:            uint16(LedgerCodeEscrowContract),
			},
		}

		results, err := s.tbClient.CreateTransfers(transfers)
		if err != nil {
			return nil, fmt.Errorf("failed to create TigerBeetle transfer: %w", err)
		}
		if len(results) > 0 {
			return nil, fmt.Errorf("TigerBeetle transfer failed: %v", results[0].Result)
		}
	}

	contractID = sanitizeUTF8(contractID)
	fundingSource = sanitizeUTF8(fundingSource)
	reference = sanitizeUTF8(reference)

	// Create transaction record
	txn := &EscrowTransaction{
		ID:                uuid.New().String(),
		ContractID:        contractID,
		TransactionType:   "fund",
		Amount:            amount,
		Currency:          sanitizeUTF8(contract.Currency),
		TigerBeetleID:     transferID,
		Reference:         reference,
		ExternalReference: fundingSource,
		Status:            "completed",
		CreatedAt:         time.Now(),
	}
	now := time.Now()
	txn.CompletedAt = &now
	txn = sanitizeTransaction(txn)

	// Log sanitized transaction data for debugging
	fmt.Printf("DEBUG: Transaction before store - ID: %q, ContractID: %q, Type: %q, Currency: %q, Reference: %q, ExternalReference: %q, Status: %q\n",
		txn.ID, txn.ContractID, txn.TransactionType, txn.Currency, txn.Reference, txn.ExternalReference, txn.Status)

	// Store transaction
	if err := s.storeTransaction(ctx, txn); err != nil {
		return nil, fmt.Errorf("failed to store transaction: %w", err)
	}

	// Update contract status
	contract.Status = StatusFunded
	contract.FundedAt = &now
	if err := s.updateContractStatus(ctx, contractID, StatusFunded); err != nil {
		return nil, fmt.Errorf("failed to update contract status: %w", err)
	}

	// If milestones exist, fund first milestone
	if len(contract.Milestones) > 0 {
		contract.Milestones[0].Status = MilestoneStatusFunded
		contract.Milestones[0].FundedAt = &now
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   contract.TenantID,
		EntityType: "escrow_contract",
		EntityID:   contractID,
		EventType:  "contract_funded",
		ActorID:    "system",
		ActorType:  "system",
		Details: map[string]interface{}{
			"amount":         amount,
			"funding_source": fundingSource,
			"reference":      reference,
		},
	})

	// Send notifications
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":            "escrow_funded",
			"contract_id":     contractID,
			"contract_number": contract.ContractNumber,
			"amount":          amount,
		})
	}

	// Record metrics
	escrowContractsFunded.WithLabelValues(contract.TenantID, string(contract.UseCase)).Inc()
	escrowTotalVolume.WithLabelValues(contract.TenantID, string(contract.UseCase)).Add(amount)
	escrowActiveBalance.WithLabelValues(contract.TenantID).Add(amount)

	return txn, nil
}

// ReleaseContract releases funds from escrow to the seller
func (s *EscrowService) ReleaseContract(ctx context.Context, contractID string, releasedBy string, notes string) (*EscrowTransaction, error) {
	start := time.Now()
	defer func() {
		escrowProcessingTime.WithLabelValues("release_contract").Observe(time.Since(start).Seconds())
	}()

	contract, err := s.GetContract(ctx, contractID)
	if err != nil {
		return nil, err
	}

	if contract.Status != StatusFunded && contract.Status != StatusInProgress {
		return nil, fmt.Errorf("contract cannot be released in status: %s", contract.Status)
	}

	// Calculate fee
	fee := s.calculateFee(contract)
	releaseAmount := contract.TotalAmount - fee

	// Get seller's account
	var sellerTBID types.Uint128
	var sellerPartyID string
	for _, party := range contract.Parties {
		if party.Role == RoleSeller {
			sellerTBID = party.TigerBeetleID
			sellerPartyID = party.ID
			break
		}
	}

	// Create transfers: escrow -> seller, escrow -> fee account (only if TigerBeetle available)
	transferID := s.idGenerator.NextID()
	feeTransferID := s.idGenerator.NextID()
	releaseAmountKobo := uint64(releaseAmount * 100)
	feeAmountKobo := uint64(fee * 100)

	// Get fee account
	var feeAccountID types.Uint128
	binary.LittleEndian.PutUint64(feeAccountID[:8], uint64(LedgerCodeEscrowFee))

	if s.tbClient != nil {
		transfers := []types.Transfer{
			{
				ID:              transferID,
				DebitAccountID:  contract.TigerBeetleID,
				CreditAccountID: sellerTBID,
				Amount:          toUint128(releaseAmountKobo),
				Ledger:          LedgerCodeEscrowContract,
				Code:            uint16(LedgerCodeEscrowContract),
			},
		}

		if feeAmountKobo > 0 {
			transfers = append(transfers, types.Transfer{
				ID:              feeTransferID,
				DebitAccountID:  contract.TigerBeetleID,
				CreditAccountID: feeAccountID,
				Amount:          toUint128(feeAmountKobo),
				Ledger:          LedgerCodeEscrowFee,
				Code:            uint16(LedgerCodeEscrowFee),
			})
		}

		// Record journal entry in Chart of Accounts (fire-and-forget — never blocks release)
		escrowAcct := coaClient.GetMapping(contract.TenantID, "escrow.liability")
		customerAcct := coaClient.GetMapping(contract.TenantID, "payments.customer.liability")
		if escrowAcct != "" && customerAcct != "" {
			amountKobo := int64(releaseAmount * 100)
			coaEntry := CreateJournalEntryRequest{
				Date:        time.Now(),
				Description: fmt.Sprintf("Escrow release for contract %s", contractID),
				Reference:   contractID,
				PostedBy:    releasedBy,
				Lines: []JournalLineRequest{
					{AccountID: escrowAcct, Description: "Escrow funds released", DebitAmount: amountKobo, CreditAmount: 0},
					{AccountID: customerAcct, Description: "Seller payment credited", DebitAmount: 0, CreditAmount: amountKobo},
				},
				Metadata: map[string]interface{}{"contract_id": contractID, "fee": fee, "source": "escrow-service"},
			}
			coaClient.PostAsync(contract.TenantID, releasedBy, "bank_admin", coaEntry)
		}

		results, err := s.tbClient.CreateTransfers(transfers)
		if err != nil {
			return nil, fmt.Errorf("failed to create TigerBeetle transfers: %w", err)
		}
		if len(results) > 0 {
			return nil, fmt.Errorf("TigerBeetle transfer failed: %v", results[0].Result)
		}
	}

	// Create transaction record
	now := time.Now()
	txn := &EscrowTransaction{
		ID:              uuid.New().String(),
		ContractID:      contractID,
		TransactionType: "release",
		Amount:          releaseAmount,
		Currency:        contract.Currency,
		ToPartyID:       &sellerPartyID,
		TigerBeetleID:   transferID,
		Reference:       fmt.Sprintf("Release to seller: %s", notes),
		Status:          "completed",
		CreatedAt:       now,
		CompletedAt:     &now,
	}

	if err := s.storeTransaction(ctx, txn); err != nil {
		return nil, fmt.Errorf("failed to store transaction: %w", err)
	}

	// Update contract status
	contract.Status = StatusReleased
	contract.CompletedAt = &now
	if err := s.updateContractStatus(ctx, contractID, StatusReleased); err != nil {
		return nil, fmt.Errorf("failed to update contract status: %w", err)
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   contract.TenantID,
		EntityType: "escrow_contract",
		EntityID:   contractID,
		EventType:  "contract_released",
		ActorID:    releasedBy,
		ActorType:  "user",
		Details: map[string]interface{}{
			"release_amount": releaseAmount,
			"fee_amount":     fee,
			"notes":          notes,
		},
	})

	// Send notifications
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":            "escrow_released",
			"contract_id":     contractID,
			"contract_number": contract.ContractNumber,
			"amount":          releaseAmount,
		})
	}

	// Record metrics
	escrowContractsReleased.WithLabelValues(contract.TenantID, string(contract.UseCase)).Inc()
	escrowActiveBalance.WithLabelValues(contract.TenantID).Sub(contract.TotalAmount)

	return txn, nil
}

// RefundContract refunds funds from escrow to the buyer
func (s *EscrowService) RefundContract(ctx context.Context, contractID string, refundedBy string, reason string) (*EscrowTransaction, error) {
	start := time.Now()
	defer func() {
		escrowProcessingTime.WithLabelValues("refund_contract").Observe(time.Since(start).Seconds())
	}()

	contract, err := s.GetContract(ctx, contractID)
	if err != nil {
		return nil, err
	}

	if contract.Status != StatusFunded && contract.Status != StatusInProgress && contract.Status != StatusDisputed {
		return nil, fmt.Errorf("contract cannot be refunded in status: %s", contract.Status)
	}

	// Get buyer's account
	var buyerTBID types.Uint128
	var buyerPartyID string
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer {
			buyerTBID = party.TigerBeetleID
			buyerPartyID = party.ID
			break
		}
	}

	// Create transfer: escrow -> buyer (only if TigerBeetle available)
	transferID := s.idGenerator.NextID()
	amountKobo := uint64(contract.TotalAmount * 100)

	if s.tbClient != nil {
		transfers := []types.Transfer{
			{
				ID:              transferID,
				DebitAccountID:  contract.TigerBeetleID,
				CreditAccountID: buyerTBID,
				Amount:          toUint128(amountKobo),
				Ledger:          LedgerCodeEscrowContract,
				Code:            uint16(LedgerCodeEscrowContract),
			},
		}

		results, err := s.tbClient.CreateTransfers(transfers)
		if err != nil {
			return nil, fmt.Errorf("failed to create TigerBeetle transfer: %w", err)
		}
		if len(results) > 0 {
			return nil, fmt.Errorf("TigerBeetle transfer failed: %v", results[0].Result)
		}
	}

	// Create transaction record
	now := time.Now()
	txn := &EscrowTransaction{
		ID:              uuid.New().String(),
		ContractID:      contractID,
		TransactionType: "refund",
		Amount:          contract.TotalAmount,
		Currency:        contract.Currency,
		ToPartyID:       &buyerPartyID,
		TigerBeetleID:   transferID,
		Reference:       fmt.Sprintf("Refund to buyer: %s", reason),
		Status:          "completed",
		CreatedAt:       now,
		CompletedAt:     &now,
	}

	if err := s.storeTransaction(ctx, txn); err != nil {
		return nil, fmt.Errorf("failed to store transaction: %w", err)
	}

	// Update contract status
	contract.Status = StatusRefunded
	contract.CompletedAt = &now
	if err := s.updateContractStatus(ctx, contractID, StatusRefunded); err != nil {
		return nil, fmt.Errorf("failed to update contract status: %w", err)
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   contract.TenantID,
		EntityType: "escrow_contract",
		EntityID:   contractID,
		EventType:  "contract_refunded",
		ActorID:    refundedBy,
		ActorType:  "user",
		Details: map[string]interface{}{
			"refund_amount": contract.TotalAmount,
			"reason":        reason,
		},
	})

	// Send notifications
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":            "escrow_refunded",
			"contract_id":     contractID,
			"contract_number": contract.ContractNumber,
			"amount":          contract.TotalAmount,
			"reason":          reason,
		})
	}

	// Record metrics
	escrowActiveBalance.WithLabelValues(contract.TenantID).Sub(contract.TotalAmount)

	return txn, nil
}

// RaiseDispute raises a dispute on an escrow contract
func (s *EscrowService) RaiseDispute(ctx context.Context, input RaiseDisputeInput) (*Dispute, error) {
	start := time.Now()
	defer func() {
		escrowProcessingTime.WithLabelValues("raise_dispute").Observe(time.Since(start).Seconds())
	}()

	contract, err := s.GetContract(ctx, input.ContractID)
	if err != nil {
		return nil, err
	}

	if contract.Status != StatusFunded && contract.Status != StatusInProgress {
		return nil, fmt.Errorf("cannot raise dispute in status: %s", contract.Status)
	}

	// Check dispute window
	if contract.FundedAt != nil {
		disputeDeadline := contract.FundedAt.AddDate(0, 0, contract.DisputeWindowDays)
		if time.Now().After(disputeDeadline) {
			return nil, fmt.Errorf("dispute window has closed")
		}
	}

	// Create dispute
	now := time.Now()
	evidenceDeadline := now.AddDate(0, 0, 7)  // 7 days for evidence
	decisionDeadline := now.AddDate(0, 0, 14) // 14 days for decision

	dispute := &Dispute{
		ID:                uuid.New().String(),
		DisputeNumber:     fmt.Sprintf("DSP-%d", time.Now().UnixNano()%1000000),
		ContractID:        input.ContractID,
		MilestoneID:       input.MilestoneID,
		InitiatedBy:       input.InitiatedBy,
		InitiatedByRole:   input.InitiatedByRole,
		ReasonCategory:    input.ReasonCategory,
		ReasonDescription: input.ReasonDescription,
		DisputedAmount:    input.DisputedAmount,
		Status:            DisputeStatusOpen,
		EvidenceDeadline:  &evidenceDeadline,
		DecisionDeadline:  &decisionDeadline,
		CreatedAt:         now,
	}

	// Store dispute
	if err := s.storeDispute(ctx, dispute); err != nil {
		return nil, fmt.Errorf("failed to store dispute: %w", err)
	}

	// Update contract status
	contract.Status = StatusDisputed
	if err := s.updateContractStatus(ctx, input.ContractID, StatusDisputed); err != nil {
		return nil, fmt.Errorf("failed to update contract status: %w", err)
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   contract.TenantID,
		EntityType: "escrow_dispute",
		EntityID:   dispute.ID,
		EventType:  "dispute_raised",
		ActorID:    input.InitiatedBy,
		ActorType:  "user",
		Details: map[string]interface{}{
			"contract_id":     input.ContractID,
			"reason_category": input.ReasonCategory,
			"disputed_amount": input.DisputedAmount,
		},
	})

	// Send notifications
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":              "dispute_raised",
			"contract_id":       input.ContractID,
			"dispute_id":        dispute.ID,
			"reason":            input.ReasonCategory,
			"evidence_deadline": evidenceDeadline,
		})
	}

	// Record metrics
	escrowContractsDisputed.WithLabelValues(contract.TenantID, string(contract.UseCase)).Inc()

	return dispute, nil
}

// RaiseDisputeInput represents input for raising a dispute
type RaiseDisputeInput struct {
	ContractID        string    `json:"contract_id"`
	MilestoneID       *string   `json:"milestone_id,omitempty"`
	InitiatedBy       string    `json:"initiated_by"`
	InitiatedByRole   PartyRole `json:"initiated_by_role"`
	ReasonCategory    string    `json:"reason_category"`
	ReasonDescription string    `json:"reason_description"`
	DisputedAmount    float64   `json:"disputed_amount"`
}

// ResolveDispute resolves a dispute
func (s *EscrowService) ResolveDispute(ctx context.Context, input ResolveDisputeInput) (*Dispute, error) {
	dispute, err := s.GetDispute(ctx, input.DisputeID)
	if err != nil {
		return nil, err
	}

	if dispute.Status != DisputeStatusOpen && dispute.Status != DisputeStatusUnderReview && dispute.Status != DisputeStatusAwaitingDecision {
		return nil, fmt.Errorf("dispute cannot be resolved in status: %s", dispute.Status)
	}

	contract, err := s.GetContract(ctx, dispute.ContractID)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	// Update dispute
	dispute.ResolutionType = &input.ResolutionType
	dispute.ResolutionAmountBuyer = input.AmountToBuyer
	dispute.ResolutionAmountSeller = input.AmountToSeller
	dispute.ResolutionNotes = &input.Notes
	dispute.ResolvedBy = &input.ResolvedBy
	dispute.ResolvedAt = &now

	// Determine new status based on resolution
	switch input.ResolutionType {
	case "full_refund":
		dispute.Status = DisputeStatusResolvedBuyer
		// Refund to buyer
		_, err = s.RefundContract(ctx, dispute.ContractID, input.ResolvedBy, "Dispute resolved in favor of buyer")
		if err != nil {
			return nil, fmt.Errorf("failed to refund: %w", err)
		}
	case "full_release":
		dispute.Status = DisputeStatusResolvedSeller
		// Release to seller
		_, err = s.ReleaseContract(ctx, dispute.ContractID, input.ResolvedBy, "Dispute resolved in favor of seller")
		if err != nil {
			return nil, fmt.Errorf("failed to release: %w", err)
		}
	case "partial_settlement":
		dispute.Status = DisputeStatusPartialSettlement
		// Handle partial settlement
		if err := s.handlePartialSettlement(ctx, contract, *input.AmountToBuyer, *input.AmountToSeller); err != nil {
			return nil, fmt.Errorf("failed to handle partial settlement: %w", err)
		}
	}

	// Update dispute in database
	if err := s.updateDispute(ctx, dispute); err != nil {
		return nil, fmt.Errorf("failed to update dispute: %w", err)
	}

	// Log audit event
	s.auditService.LogEvent(ctx, AuditEvent{
		TenantID:   contract.TenantID,
		EntityType: "escrow_dispute",
		EntityID:   dispute.ID,
		EventType:  "dispute_resolved",
		ActorID:    input.ResolvedBy,
		ActorType:  "user",
		Details: map[string]interface{}{
			"resolution_type":  input.ResolutionType,
			"amount_to_buyer":  input.AmountToBuyer,
			"amount_to_seller": input.AmountToSeller,
			"notes":            input.Notes,
		},
	})

	// Send notifications
	for _, party := range contract.Parties {
		s.notificationSvc.SendNotification(ctx, party.ID, map[string]interface{}{
			"type":            "dispute_resolved",
			"contract_id":     dispute.ContractID,
			"dispute_id":      dispute.ID,
			"resolution_type": input.ResolutionType,
		})
	}

	return dispute, nil
}

// ResolveDisputeInput represents input for resolving a dispute
type ResolveDisputeInput struct {
	DisputeID      string   `json:"dispute_id"`
	ResolutionType string   `json:"resolution_type"` // full_refund, full_release, partial_settlement
	AmountToBuyer  *float64 `json:"amount_to_buyer,omitempty"`
	AmountToSeller *float64 `json:"amount_to_seller,omitempty"`
	Notes          string   `json:"notes"`
	ResolvedBy     string   `json:"resolved_by"`
}

// Helper methods

func (s *EscrowService) validateCreateInput(input CreateContractInput) error {
	if input.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if input.Title == "" {
		return fmt.Errorf("title is required")
	}
	if input.TotalAmount <= 0 {
		return fmt.Errorf("total_amount must be positive")
	}
	if len(input.Parties) < 2 {
		return fmt.Errorf("at least buyer and seller parties are required")
	}

	hasBuyer := false
	hasSeller := false
	for _, party := range input.Parties {
		if party.Role == RoleBuyer {
			hasBuyer = true
		}
		if party.Role == RoleSeller {
			hasSeller = true
		}
	}
	if !hasBuyer {
		return fmt.Errorf("buyer party is required")
	}
	if !hasSeller {
		return fmt.Errorf("seller party is required")
	}

	return nil
}

func (s *EscrowService) calculateFee(contract *EscrowContract) float64 {
	switch contract.FeeType {
	case FeeTypePercentage:
		if contract.FeeRate != nil {
			return contract.TotalAmount * *contract.FeeRate
		}
	case FeeTypeFlat:
		if contract.FeeAmount != nil {
			return *contract.FeeAmount
		}
	case FeeTypeTiered:
		for _, tier := range contract.FeeTiers {
			if tier.MaxAmount == nil || contract.TotalAmount <= *tier.MaxAmount {
				return contract.TotalAmount * tier.Rate
			}
		}
	}
	return 0
}

func (s *EscrowService) handlePartialSettlement(ctx context.Context, contract *EscrowContract, amountToBuyer, amountToSeller float64) error {
	// Get party accounts
	var buyerTBID, sellerTBID types.Uint128
	var buyerPartyID, sellerPartyID string
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer {
			buyerTBID = party.TigerBeetleID
			buyerPartyID = party.ID
		}
		if party.Role == RoleSeller {
			sellerTBID = party.TigerBeetleID
			sellerPartyID = party.ID
		}
	}

	var transfers []types.Transfer

	if amountToBuyer > 0 {
		transfers = append(transfers, types.Transfer{
			ID:              s.idGenerator.NextID(),
			DebitAccountID:  contract.TigerBeetleID,
			CreditAccountID: buyerTBID,
			Amount:          toUint128(uint64(amountToBuyer * 100)),
			Ledger:          LedgerCodeEscrowContract,
			Code:            uint16(LedgerCodeEscrowContract),
		})
	}

	if amountToSeller > 0 {
		transfers = append(transfers, types.Transfer{
			ID:              s.idGenerator.NextID(),
			DebitAccountID:  contract.TigerBeetleID,
			CreditAccountID: sellerTBID,
			Amount:          toUint128(uint64(amountToSeller * 100)),
			Ledger:          LedgerCodeEscrowContract,
			Code:            uint16(LedgerCodeEscrowContract),
		})
	}

	if s.tbClient != nil {
		results, err := s.tbClient.CreateTransfers(transfers)
		if err != nil {
			return err
		}
		if len(results) > 0 {
			return fmt.Errorf("transfer failed: %v", results[0].Result)
		}
	}

	// Create transaction records
	now := time.Now()
	if amountToBuyer > 0 {
		txn := &EscrowTransaction{
			ID:              uuid.New().String(),
			ContractID:      contract.ID,
			TransactionType: "partial_refund",
			Amount:          amountToBuyer,
			Currency:        contract.Currency,
			ToPartyID:       &buyerPartyID,
			Reference:       "Partial settlement - buyer portion",
			Status:          "completed",
			CreatedAt:       now,
			CompletedAt:     &now,
		}
		s.storeTransaction(ctx, txn)
	}

	if amountToSeller > 0 {
		txn := &EscrowTransaction{
			ID:              uuid.New().String(),
			ContractID:      contract.ID,
			TransactionType: "partial_release",
			Amount:          amountToSeller,
			Currency:        contract.Currency,
			ToPartyID:       &sellerPartyID,
			Reference:       "Partial settlement - seller portion",
			Status:          "completed",
			CreatedAt:       now,
			CompletedAt:     &now,
		}
		s.storeTransaction(ctx, txn)
	}

	// Update contract status
	contract.Status = StatusPartialSettlement
	contract.CompletedAt = &now
	return s.updateContractStatus(ctx, contract.ID, StatusPartialSettlement)
}

// Database operations (stubs - implement with actual SQL)

func (s *EscrowService) storeContract(ctx context.Context, contract *EscrowContract) error {
	partiesJSON, _ := json.Marshal(contract.Parties)
	metadataJSON, _ := json.Marshal(contract.Metadata)

	// Debug log for UTF-8 error investigation
	fmt.Println("[storeContract] partiesJSON:", partiesJSON)
	fmt.Println("[storeContract] metadataJSON:", metadataJSON)
	fmt.Println("[storeContract] contract.ID:", contract.ID)
	fmt.Println("[storeContract] contract.ContractNumber:", contract.ContractNumber)
	fmt.Println("[storeContract] contract.TenantID:", contract.TenantID)
	fmt.Println("[storeContract] contract.UseCase:", contract.UseCase)
	fmt.Println("[storeContract] contract.Title:", contract.Title)
	fmt.Println("[storeContract] contract.Description:", contract.Description)
	fmt.Println("[storeContract] contract.TotalAmount:", contract.TotalAmount)
	fmt.Println("[storeContract] contract.Currency:", contract.Currency)
	fmt.Println("[storeContract] contract.FundingDeadline:", contract.FundingDeadline)
	fmt.Println("[storeContract] contract.FulfillmentDeadline:", contract.FulfillmentDeadline)
	fmt.Println("[storeContract] contract.DisputeWindowDays:", contract.DisputeWindowDays)
	fmt.Println("[storeContract] contract.AutoReleaseAfterDays:", contract.AutoReleaseAfterDays)
	fmt.Println("[storeContract] contract.FeeType:", contract.FeeType)
	fmt.Println("[storeContract] contract.FeeRate:", contract.FeeRate)
	fmt.Println("[storeContract] contract.FeeAmount:", contract.FeeAmount)
	fmt.Println("[storeContract] contract.FeePayer:", contract.FeePayer)
	fmt.Println("[storeContract] contract.Status:", contract.Status)
	hexTBID := fmt.Sprintf("%x", contract.TigerBeetleID[:])
	fmt.Println("[storeContract] contract.TigerBeetleID (bytes):", contract.TigerBeetleID[:])
	fmt.Println("[storeContract] contract.TigerBeetleID (hex):", hexTBID)
	fmt.Println("[storeContract] contract.TemplateID:", contract.TemplateID)
	fmt.Println("[storeContract] contract.CreatedAt:", contract.CreatedAt)
	fmt.Println("[storeContract] contract.CreatedBy:", contract.CreatedBy)
	fmt.Println("[storeContract] contract.FundedAt:", contract.FundedAt)
	fmt.Println("[storeContract] contract.CompletedAt:", contract.CompletedAt)

	_, err := s.db.Exec(ctx, `
		INSERT INTO escrow_contracts (
			id, contract_number, tenant_id, use_case, title, description,
			total_amount, currency, parties, funding_deadline, fulfillment_deadline,
			dispute_window_days, auto_release_after_days, fee_type, fee_rate,
			fee_amount, fee_payer, status, tigerbeetle_account_id, metadata,
			template_id, created_at, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
	`, contract.ID, contract.ContractNumber, contract.TenantID, contract.UseCase,
		contract.Title, contract.Description, contract.TotalAmount, contract.Currency,
		partiesJSON, contract.FundingDeadline, contract.FulfillmentDeadline,
		contract.DisputeWindowDays, contract.AutoReleaseAfterDays, contract.FeeType,
		contract.FeeRate, contract.FeeAmount, contract.FeePayer, contract.Status,
		hexTBID, metadataJSON, contract.TemplateID, contract.CreatedAt, contract.CreatedBy)

	return err
}

func (s *EscrowService) GetContract(ctx context.Context, contractID string) (*EscrowContract, error) {
	var contract EscrowContract
	var partiesJSON, metadataJSON []byte
	var tbID []byte

	err := s.db.QueryRow(ctx, `
		SELECT 
			id, contract_number, tenant_id, use_case, title, description,
			total_amount, currency, parties, funding_deadline, fulfillment_deadline,
			dispute_window_days, auto_release_after_days, fee_type, fee_rate,
			fee_amount, fee_payer, status, tigerbeetle_account_id, metadata,
			template_id, created_at, funded_at, completed_at, created_by
		FROM escrow_contracts
		WHERE id = $1
	`, contractID).Scan(
		&contract.ID,
		&contract.ContractNumber,
		&contract.TenantID,
		&contract.UseCase,
		&contract.Title,
		&contract.Description,
		&contract.TotalAmount,
		&contract.Currency,
		&partiesJSON,
		&contract.FundingDeadline,
		&contract.FulfillmentDeadline,
		&contract.DisputeWindowDays,
		&contract.AutoReleaseAfterDays,
		&contract.FeeType,
		&contract.FeeRate,
		&contract.FeeAmount,
		&contract.FeePayer,
		&contract.Status,
		&tbID,
		&metadataJSON,
		&contract.TemplateID,
		&contract.CreatedAt,
		&contract.FundedAt,
		&contract.CompletedAt,
		&contract.CreatedBy,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get contract: %w", err)
	}

	// Unmarshal JSON fields
	if len(partiesJSON) > 0 {
		if err := json.Unmarshal(partiesJSON, &contract.Parties); err != nil {
			return nil, fmt.Errorf("failed to unmarshal parties: %w", err)
		}
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &contract.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	// Convert TigerBeetle ID
	if len(tbID) >= 16 {
		copy(contract.TigerBeetleID[:], tbID[:16])
	}

	// Get milestones
	milestones, err := s.getContractMilestones(ctx, contractID)
	if err == nil {
		contract.Milestones = milestones
	}

	return &contract, nil
}

func (s *EscrowService) getContractMilestones(ctx context.Context, contractID string) ([]Milestone, error) {
	rows, err := s.db.Query(ctx, `
		SELECT 
			id, contract_id, sequence_number, name, description,
			amount, percentage, deadline, status, funded_at, completed_at, released_at
		FROM escrow_milestones
		WHERE contract_id = $1
		ORDER BY sequence_number
	`, contractID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var milestones []Milestone
	for rows.Next() {
		var m Milestone
		err := rows.Scan(
			&m.ID,
			&m.ContractID,
			&m.SequenceNumber,
			&m.Name,
			&m.Description,
			&m.Amount,
			&m.Percentage,
			&m.Deadline,
			&m.Status,
			&m.FundedAt,
			&m.CompletedAt,
			&m.ReleasedAt,
		)
		if err != nil {
			continue
		}
		milestones = append(milestones, m)
	}

	return milestones, nil
}

func (s *EscrowService) GetTemplate(ctx context.Context, templateID string) (*EscrowTemplate, error) {
	var template EscrowTemplate
	var feeTiersJSON, milestoneTemplatesJSON []byte

	err := s.db.QueryRow(ctx, `
		SELECT 
			id, tenant_id, name, use_case, description,
			default_dispute_window_days, default_auto_release_days,
			fee_type, fee_rate, fee_amount, fee_tiers, fee_payer,
			kyc_level_required, min_amount, max_amount,
			milestone_templates, is_active, is_system
		FROM escrow_templates
		WHERE id = $1 AND is_active = true
	`, templateID).Scan(
		&template.ID,
		&template.TenantID,
		&template.Name,
		&template.UseCase,
		&template.Description,
		&template.DefaultDisputeWindowDays,
		&template.DefaultAutoReleaseDays,
		&template.FeeType,
		&template.FeeRate,
		&template.FeeAmount,
		&feeTiersJSON,
		&template.FeePayer,
		&template.KYCLevelRequired,
		&template.MinAmount,
		&template.MaxAmount,
		&milestoneTemplatesJSON,
		&template.IsActive,
		&template.IsSystem,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	// Unmarshal JSON fields
	if len(feeTiersJSON) > 0 {
		json.Unmarshal(feeTiersJSON, &template.FeeTiers)
	}

	if len(milestoneTemplatesJSON) > 0 {
		json.Unmarshal(milestoneTemplatesJSON, &template.MilestoneTemplates)
	}

	return &template, nil
}

func (s *EscrowService) GetDefaultTemplate(ctx context.Context, useCase UseCase) (*EscrowTemplate, error) {
	var template EscrowTemplate
	var feeTiersJSON, milestoneTemplatesJSON []byte

	err := s.db.QueryRow(ctx, `
		SELECT 
			id, tenant_id, name, use_case, description,
			default_dispute_window_days, default_auto_release_days,
			fee_type, fee_rate, fee_amount, fee_tiers, fee_payer,
			kyc_level_required, min_amount, max_amount,
			milestone_templates, is_active, is_system
		FROM escrow_templates
		WHERE use_case = $1 AND is_system = true AND is_active = true
		ORDER BY created_at DESC
		LIMIT 1
	`, useCase).Scan(
		&template.ID,
		&template.TenantID,
		&template.Name,
		&template.UseCase,
		&template.Description,
		&template.DefaultDisputeWindowDays,
		&template.DefaultAutoReleaseDays,
		&template.FeeType,
		&template.FeeRate,
		&template.FeeAmount,
		&feeTiersJSON,
		&template.FeePayer,
		&template.KYCLevelRequired,
		&template.MinAmount,
		&template.MaxAmount,
		&milestoneTemplatesJSON,
		&template.IsActive,
		&template.IsSystem,
	)

	if err != nil {
		// If no template found, return default in-memory template
		if err.Error() == "no rows in result set" || err.Error() == "sql: no rows in result set" {
			return s.getInMemoryDefaultTemplate(useCase), nil
		}
		return nil, fmt.Errorf("failed to get default template: %w", err)
	}

	// Unmarshal JSON fields
	if len(feeTiersJSON) > 0 {
		json.Unmarshal(feeTiersJSON, &template.FeeTiers)
	}

	if len(milestoneTemplatesJSON) > 0 {
		json.Unmarshal(milestoneTemplatesJSON, &template.MilestoneTemplates)
	}

	return &template, nil
}

func (s *EscrowService) getInMemoryDefaultTemplate(useCase UseCase) *EscrowTemplate {
	// Default fee rates by use case
	feeRates := map[UseCase]float64{
		UseCaseEcommerce:    0.015, // 1.5%
		UseCaseRealEstate:   0.005, // 0.5%
		UseCaseFreelance:    0.025, // 2.5%
		UseCaseLPO:          0.015, // 1.5%
		UseCaseConstruction: 0.010, // 1.0%
		UseCaseVehicle:      0.010, // 1.0%
		UseCaseAcquisition:  0.010, // 1.0%
		UseCaseGeneral:      0.020, // 2.0%
	}

	rate, exists := feeRates[useCase]
	if !exists {
		rate = 0.020 // Default 2%
	}

	return &EscrowTemplate{
		ID:                       fmt.Sprintf("default-%s", useCase),
		Name:                     fmt.Sprintf("Default %s Template", useCase),
		UseCase:                  useCase,
		Description:              fmt.Sprintf("System default template for %s escrow", useCase),
		DefaultDisputeWindowDays: 7,
		DefaultAutoReleaseDays:   nil,
		FeeType:                  FeeTypePercentage,
		FeeRate:                  &rate,
		FeePayer:                 FeePayerSplit,
		KYCLevelRequired:         1,
		IsActive:                 true,
		IsSystem:                 true,
	}
}

func (s *EscrowService) updateContractStatus(ctx context.Context, contractID string, status ContractStatus) error {
	_, err := s.db.Exec(ctx, `
		UPDATE escrow_contracts SET status = $1, updated_at = NOW() WHERE id = $2
	`, status, contractID)
	return err
}

func (s *EscrowService) storeTransaction(ctx context.Context, txn *EscrowTransaction) error {
	metadataJSON, _ := json.Marshal(txn.Metadata)
	// Convert TigerBeetleID to hex string to avoid UTF-8 encoding errors
	tigerBeetleIDHex := fmt.Sprintf("%x", txn.TigerBeetleID[:])
	_, err := s.db.Exec(ctx, `
		INSERT INTO escrow_transactions (
			id, contract_id, milestone_id, transaction_type, amount, currency,
			from_party_id, to_party_id, tigerbeetle_transfer_id, reference,
			external_reference, status, metadata, created_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`, txn.ID, txn.ContractID, txn.MilestoneID, txn.TransactionType, txn.Amount,
		txn.Currency, txn.FromPartyID, txn.ToPartyID, tigerBeetleIDHex,
		txn.Reference, txn.ExternalReference, txn.Status, metadataJSON,
		txn.CreatedAt, txn.CompletedAt)
	return err
}

func (s *EscrowService) storeDispute(ctx context.Context, dispute *Dispute) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO escrow_disputes (
			id, dispute_number, contract_id, milestone_id, initiated_by,
			initiated_by_role, reason_category, reason_description, disputed_amount,
			status, evidence_deadline, decision_deadline, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, dispute.ID, dispute.DisputeNumber, dispute.ContractID, dispute.MilestoneID,
		dispute.InitiatedBy, dispute.InitiatedByRole, dispute.ReasonCategory,
		dispute.ReasonDescription, dispute.DisputedAmount, dispute.Status,
		dispute.EvidenceDeadline, dispute.DecisionDeadline, dispute.CreatedAt)
	return err
}

func (s *EscrowService) GetDispute(ctx context.Context, disputeID string) (*Dispute, error) {
	var dispute Dispute
	var buyerEvidenceJSON, sellerEvidenceJSON []byte

	err := s.db.QueryRow(ctx, `
		SELECT 
			id, dispute_number, contract_id, milestone_id, initiated_by,
			initiated_by_role, reason_category, reason_description, disputed_amount,
			status, buyer_evidence, seller_evidence, resolution_type,
			resolution_amount_buyer, resolution_amount_seller, resolution_notes,
			resolved_by, resolved_at, evidence_deadline, decision_deadline,
			escalated, created_at
		FROM escrow_disputes
		WHERE id = $1
	`, disputeID).Scan(
		&dispute.ID,
		&dispute.DisputeNumber,
		&dispute.ContractID,
		&dispute.MilestoneID,
		&dispute.InitiatedBy,
		&dispute.InitiatedByRole,
		&dispute.ReasonCategory,
		&dispute.ReasonDescription,
		&dispute.DisputedAmount,
		&dispute.Status,
		&buyerEvidenceJSON,
		&sellerEvidenceJSON,
		&dispute.ResolutionType,
		&dispute.ResolutionAmountBuyer,
		&dispute.ResolutionAmountSeller,
		&dispute.ResolutionNotes,
		&dispute.ResolvedBy,
		&dispute.ResolvedAt,
		&dispute.EvidenceDeadline,
		&dispute.DecisionDeadline,
		&dispute.Escalated,
		&dispute.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get dispute: %w", err)
	}

	// Unmarshal evidence JSON
	if len(buyerEvidenceJSON) > 0 {
		json.Unmarshal(buyerEvidenceJSON, &dispute.BuyerEvidence)
	}

	if len(sellerEvidenceJSON) > 0 {
		json.Unmarshal(sellerEvidenceJSON, &dispute.SellerEvidence)
	}

	return &dispute, nil
}

func (s *EscrowService) updateDispute(ctx context.Context, dispute *Dispute) error {
	_, err := s.db.Exec(ctx, `
		UPDATE escrow_disputes SET
			status = $1, resolution_type = $2, resolution_amount_buyer = $3,
			resolution_amount_seller = $4, resolution_notes = $5, resolved_by = $6,
			resolved_at = $7, updated_at = NOW()
		WHERE id = $8
	`, dispute.Status, dispute.ResolutionType, dispute.ResolutionAmountBuyer,
		dispute.ResolutionAmountSeller, dispute.ResolutionNotes, dispute.ResolvedBy,
		dispute.ResolvedAt, dispute.ID)
	return err
}
