package middleware

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// A5: Saga Pattern with Temporal for multi-step transactions
// Implements compensatable workflows for loan origination, LC lifecycle, dispute resolution.

type WorkflowStatus string

const (
	WorkflowPending    WorkflowStatus = "pending"
	WorkflowRunning    WorkflowStatus = "running"
	WorkflowCompleted  WorkflowStatus = "completed"
	WorkflowFailed     WorkflowStatus = "failed"
	WorkflowCancelled  WorkflowStatus = "cancelled"
	WorkflowCompensating WorkflowStatus = "compensating"
)

type SagaStep struct {
	Name         string                 `json:"name"`
	Status       WorkflowStatus         `json:"status"`
	StartedAt    *time.Time             `json:"startedAt,omitempty"`
	CompletedAt  *time.Time             `json:"completedAt,omitempty"`
	Input        map[string]interface{} `json:"input,omitempty"`
	Output       map[string]interface{} `json:"output,omitempty"`
	Error        string                 `json:"error,omitempty"`
	Compensated  bool                   `json:"compensated"`
	RetryCount   int                    `json:"retryCount"`
}

type SagaWorkflow struct {
	ID            string                 `json:"id"`
	WorkflowType  string                 `json:"workflowType"`
	Status        WorkflowStatus         `json:"status"`
	Steps         []SagaStep             `json:"steps"`
	Input         map[string]interface{} `json:"input"`
	Output        map[string]interface{} `json:"output,omitempty"`
	CreatedAt     time.Time              `json:"createdAt"`
	CompletedAt   *time.Time             `json:"completedAt,omitempty"`
	TenantID      string                 `json:"tenantId"`
	CorrelationID string                 `json:"correlationId"`
}

type TemporalEngine struct {
	mu        sync.RWMutex
	workflows map[string]*SagaWorkflow
	templates map[string][]string // workflowType -> step names
}

func NewTemporalEngine() *TemporalEngine {
	engine := &TemporalEngine{
		workflows: make(map[string]*SagaWorkflow),
		templates: make(map[string][]string),
	}
	engine.registerTemplates()
	return engine
}

func (e *TemporalEngine) registerTemplates() {
	e.templates["loan-origination"] = []string{
		"application-received",
		"kyc-verification",
		"credit-scoring",
		"collateral-valuation",
		"committee-approval",
		"offer-generation",
		"customer-acceptance",
		"disbursement",
		"ledger-posting",
		"notification",
	}

	e.templates["trade-finance-lc"] = []string{
		"lc-application",
		"compliance-check",
		"credit-assessment",
		"margin-collection",
		"swift-message-generation",
		"issuing-bank-confirmation",
		"advising-bank-notification",
		"document-presentation",
		"drawing-settlement",
		"ledger-reconciliation",
	}

	e.templates["dispute-resolution"] = []string{
		"case-registration",
		"preliminary-assessment",
		"evidence-collection",
		"investigation",
		"provisional-credit",
		"merchant-representment",
		"arbitration",
		"final-decision",
		"settlement",
		"reporting",
	}

	e.templates["mortgage-origination"] = []string{
		"application-intake",
		"property-valuation",
		"income-verification",
		"dti-calculation",
		"ltv-assessment",
		"underwriting-decision",
		"offer-letter",
		"legal-documentation",
		"disbursement",
		"mortgage-registration",
	}

	e.templates["islamic-murabaha"] = []string{
		"customer-request",
		"sharia-compliance-check",
		"asset-identification",
		"cost-verification",
		"profit-margin-approval",
		"contract-generation",
		"asset-purchase",
		"asset-transfer",
		"installment-schedule",
		"activation",
	}

	e.templates["esusu-cycle"] = []string{
		"group-formation",
		"member-verification",
		"contribution-schedule",
		"collection-round",
		"payout-processing",
		"defaulter-handling",
		"cycle-completion",
		"new-cycle-initiation",
	}

	e.templates["customer-onboarding"] = []string{
		"identity-capture",
		"bvn-verification",
		"nin-verification",
		"address-verification",
		"risk-assessment",
		"account-creation",
		"card-issuance",
		"welcome-notification",
	}

	e.templates["payment-processing"] = []string{
		"validation",
		"fraud-screening",
		"balance-check",
		"debit-source",
		"route-to-network",
		"credit-destination",
		"notification",
		"reconciliation",
	}
}

func (e *TemporalEngine) StartWorkflow(workflowType string, input map[string]interface{}) (*SagaWorkflow, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	steps, ok := e.templates[workflowType]
	if !ok {
		return nil, fmt.Errorf("unknown workflow type: %s", workflowType)
	}

	wf := &SagaWorkflow{
		ID:            fmt.Sprintf("wf-%d", time.Now().UnixNano()),
		WorkflowType:  workflowType,
		Status:        WorkflowRunning,
		Input:         input,
		CreatedAt:     time.Now().UTC(),
		TenantID:      "54bank-platform-prod",
		CorrelationID: fmt.Sprintf("corr-%d", time.Now().UnixNano()),
	}

	for _, stepName := range steps {
		wf.Steps = append(wf.Steps, SagaStep{
			Name:   stepName,
			Status: WorkflowPending,
		})
	}

	// Auto-advance first step
	now := time.Now()
	wf.Steps[0].Status = WorkflowRunning
	wf.Steps[0].StartedAt = &now

	e.workflows[wf.ID] = wf
	log.Printf("[Temporal] Started workflow %s (%s) with %d steps", wf.ID, workflowType, len(steps))
	return wf, nil
}

func (e *TemporalEngine) AdvanceStep(workflowID string, output map[string]interface{}) (*SagaWorkflow, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	wf, ok := e.workflows[workflowID]
	if !ok {
		return nil, fmt.Errorf("workflow not found: %s", workflowID)
	}

	// Find current running step and complete it
	for i := range wf.Steps {
		if wf.Steps[i].Status == WorkflowRunning {
			now := time.Now()
			wf.Steps[i].Status = WorkflowCompleted
			wf.Steps[i].CompletedAt = &now
			wf.Steps[i].Output = output

			// Start next step if exists
			if i+1 < len(wf.Steps) {
				wf.Steps[i+1].Status = WorkflowRunning
				wf.Steps[i+1].StartedAt = &now
			} else {
				wf.Status = WorkflowCompleted
				wf.CompletedAt = &now
				wf.Output = output
			}
			break
		}
	}

	return wf, nil
}

func (e *TemporalEngine) FailStep(workflowID, errorMsg string) (*SagaWorkflow, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	wf, ok := e.workflows[workflowID]
	if !ok {
		return nil, fmt.Errorf("workflow not found: %s", workflowID)
	}

	// Compensate — reverse completed steps
	wf.Status = WorkflowCompensating
	for i := range wf.Steps {
		if wf.Steps[i].Status == WorkflowRunning {
			wf.Steps[i].Status = WorkflowFailed
			wf.Steps[i].Error = errorMsg
		}
	}

	// Mark compensation
	for i := len(wf.Steps) - 1; i >= 0; i-- {
		if wf.Steps[i].Status == WorkflowCompleted {
			wf.Steps[i].Compensated = true
			log.Printf("[Temporal] Compensating step: %s", wf.Steps[i].Name)
		}
	}

	wf.Status = WorkflowFailed
	return wf, nil
}

func (e *TemporalEngine) GetWorkflow(id string) (*SagaWorkflow, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	wf, ok := e.workflows[id]
	if !ok {
		return nil, fmt.Errorf("workflow not found: %s", id)
	}
	return wf, nil
}

func (e *TemporalEngine) ListWorkflows(workflowType string) []*SagaWorkflow {
	e.mu.RLock()
	defer e.mu.RUnlock()
	var result []*SagaWorkflow
	for _, wf := range e.workflows {
		if workflowType == "" || wf.WorkflowType == workflowType {
			result = append(result, wf)
		}
	}
	return result
}

func (e *TemporalEngine) SerializeWorkflow(wf *SagaWorkflow) ([]byte, error) {
	return json.Marshal(wf)
}
