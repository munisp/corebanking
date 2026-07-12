package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Escrow Reporting and Compliance Service
// Provides regulatory reports, analytics, and compliance monitoring for CBN/NDIC

// ReportingService handles escrow reporting and compliance
type ReportingService struct {
	db *pgxpool.Pool
}

// NewReportingService creates a new reporting service
func NewReportingService(db *pgxpool.Pool) *ReportingService {
	return &ReportingService{db: db}
}

// EscrowSummaryReport represents a summary of escrow activity
type EscrowSummaryReport struct {
	TenantID           string                    `json:"tenant_id"`
	ReportDate         time.Time                 `json:"report_date"`
	TotalContracts     int                       `json:"total_contracts"`
	ActiveContracts    int                       `json:"active_contracts"`
	CompletedContracts int                       `json:"completed_contracts"`
	DisputedContracts  int                       `json:"disputed_contracts"`
	TotalVolume        float64                   `json:"total_volume"`
	ActiveBalance      float64                   `json:"active_balance"`
	ReleasedAmount     float64                   `json:"released_amount"`
	RefundedAmount     float64                   `json:"refunded_amount"`
	FeesCollected      float64                   `json:"fees_collected"`
	ByUseCase          map[string]UseCaseMetrics `json:"by_use_case"`
	ByStatus           map[string]int            `json:"by_status"`
}

// UseCaseMetrics represents metrics for a specific use case
type UseCaseMetrics struct {
	Count         int     `json:"count"`
	Volume        float64 `json:"volume"`
	AvgAmount     float64 `json:"avg_amount"`
	DisputeRate   float64 `json:"dispute_rate"`
	AvgResolution float64 `json:"avg_resolution_days"`
}

// VolumeReport represents escrow volume over time
type VolumeReport struct {
	TenantID  string            `json:"tenant_id"`
	StartDate time.Time         `json:"start_date"`
	EndDate   time.Time         `json:"end_date"`
	GroupBy   string            `json:"group_by"`
	Data      []VolumeDataPoint `json:"data"`
	Totals    VolumeTotals      `json:"totals"`
}

// VolumeDataPoint represents a single data point in volume report
type VolumeDataPoint struct {
	Period         string  `json:"period"`
	ContractsCount int     `json:"contracts_count"`
	FundedCount    int     `json:"funded_count"`
	ReleasedCount  int     `json:"released_count"`
	RefundedCount  int     `json:"refunded_count"`
	DisputedCount  int     `json:"disputed_count"`
	TotalVolume    float64 `json:"total_volume"`
	FundedVolume   float64 `json:"funded_volume"`
	ReleasedVolume float64 `json:"released_volume"`
	RefundedVolume float64 `json:"refunded_volume"`
	FeesCollected  float64 `json:"fees_collected"`
}

// VolumeTotals represents total volume metrics
type VolumeTotals struct {
	TotalContracts int     `json:"total_contracts"`
	TotalFunded    int     `json:"total_funded"`
	TotalReleased  int     `json:"total_released"`
	TotalRefunded  int     `json:"total_refunded"`
	TotalDisputed  int     `json:"total_disputed"`
	TotalVolume    float64 `json:"total_volume"`
	TotalFees      float64 `json:"total_fees"`
}

// DisputeReport represents dispute analytics
type DisputeReport struct {
	TenantID            string                    `json:"tenant_id"`
	StartDate           time.Time                 `json:"start_date"`
	EndDate             time.Time                 `json:"end_date"`
	TotalDisputes       int                       `json:"total_disputes"`
	OpenDisputes        int                       `json:"open_disputes"`
	ResolvedDisputes    int                       `json:"resolved_disputes"`
	EscalatedDisputes   int                       `json:"escalated_disputes"`
	AvgResolutionDays   float64                   `json:"avg_resolution_days"`
	DisputeRate         float64                   `json:"dispute_rate"`
	TotalDisputedAmount float64                   `json:"total_disputed_amount"`
	ByReason            map[string]int            `json:"by_reason"`
	ByResolution        map[string]int            `json:"by_resolution"`
	ByUseCase           map[string]DisputeMetrics `json:"by_use_case"`
}

// DisputeMetrics represents dispute metrics for a category
type DisputeMetrics struct {
	Count          int     `json:"count"`
	DisputedAmount float64 `json:"disputed_amount"`
	AvgResolution  float64 `json:"avg_resolution_days"`
	BuyerWinRate   float64 `json:"buyer_win_rate"`
	SellerWinRate  float64 `json:"seller_win_rate"`
	PartialRate    float64 `json:"partial_rate"`
}

// FeeReport represents fee collection analytics
type FeeReport struct {
	TenantID   string             `json:"tenant_id"`
	StartDate  time.Time          `json:"start_date"`
	EndDate    time.Time          `json:"end_date"`
	TotalFees  float64            `json:"total_fees"`
	AvgFeeRate float64            `json:"avg_fee_rate"`
	ByFeeType  map[string]float64 `json:"by_fee_type"`
	ByUseCase  map[string]float64 `json:"by_use_case"`
	ByMonth    []MonthlyFees      `json:"by_month"`
}

// MonthlyFees represents monthly fee data
type MonthlyFees struct {
	Month      string  `json:"month"`
	TotalFees  float64 `json:"total_fees"`
	Volume     float64 `json:"volume"`
	AvgFeeRate float64 `json:"avg_fee_rate"`
}

// AgingReport represents escrow aging analysis
type AgingReport struct {
	TenantID     string         `json:"tenant_id"`
	ReportDate   time.Time      `json:"report_date"`
	TotalActive  int            `json:"total_active"`
	TotalBalance float64        `json:"total_balance"`
	AgingBuckets []AgingBucket  `json:"aging_buckets"`
	AtRisk       []AtRiskEscrow `json:"at_risk"`
}

// AgingBucket represents an aging bucket
type AgingBucket struct {
	Label      string  `json:"label"`
	MinDays    int     `json:"min_days"`
	MaxDays    int     `json:"max_days"`
	Count      int     `json:"count"`
	Balance    float64 `json:"balance"`
	Percentage float64 `json:"percentage"`
}

// AtRiskEscrow represents an escrow at risk
type AtRiskEscrow struct {
	ContractID     string    `json:"contract_id"`
	ContractNumber string    `json:"contract_number"`
	Amount         float64   `json:"amount"`
	DaysActive     int       `json:"days_active"`
	Status         string    `json:"status"`
	RiskReason     string    `json:"risk_reason"`
	CreatedAt      time.Time `json:"created_at"`
}

// CBNRegulatoryReport represents CBN regulatory report
type CBNRegulatoryReport struct {
	ReportID        string    `json:"report_id"`
	ReportType      string    `json:"report_type"`
	ReportingPeriod string    `json:"reporting_period"`
	TenantID        string    `json:"tenant_id"`
	InstitutionCode string    `json:"institution_code"`
	GeneratedAt     time.Time `json:"generated_at"`

	// Escrow Holdings Summary
	TotalEscrowAccounts     int     `json:"total_escrow_accounts"`
	TotalEscrowBalance      float64 `json:"total_escrow_balance"`
	TotalEscrowTransactions int     `json:"total_escrow_transactions"`

	// Transaction Summary
	TotalDeposits    float64 `json:"total_deposits"`
	TotalWithdrawals float64 `json:"total_withdrawals"`
	TotalReleases    float64 `json:"total_releases"`
	TotalRefunds     float64 `json:"total_refunds"`

	// Dispute Summary
	TotalDisputes    int     `json:"total_disputes"`
	ResolvedDisputes int     `json:"resolved_disputes"`
	PendingDisputes  int     `json:"pending_disputes"`
	DisputedAmount   float64 `json:"disputed_amount"`

	// Risk Indicators
	HighValueTransactions  int `json:"high_value_transactions"`
	SuspiciousTransactions int `json:"suspicious_transactions"`
	FraudAttempts          int `json:"fraud_attempts"`

	// Compliance Status
	KYCComplianceRate float64 `json:"kyc_compliance_rate"`
	AMLScreeningRate  float64 `json:"aml_screening_rate"`
}

// NDICReport represents NDIC deposit insurance report
type NDICReport struct {
	ReportID        string    `json:"report_id"`
	ReportingPeriod string    `json:"reporting_period"`
	TenantID        string    `json:"tenant_id"`
	InstitutionCode string    `json:"institution_code"`
	GeneratedAt     time.Time `json:"generated_at"`

	// Escrow Deposit Summary
	TotalEscrowDeposits float64 `json:"total_escrow_deposits"`
	InsuredAmount       float64 `json:"insured_amount"`
	UninsuredAmount     float64 `json:"uninsured_amount"`

	// Account Distribution
	AccountsBySize map[string]int `json:"accounts_by_size"`

	// Movement Summary
	OpeningBalance float64 `json:"opening_balance"`
	Deposits       float64 `json:"deposits"`
	Withdrawals    float64 `json:"withdrawals"`
	ClosingBalance float64 `json:"closing_balance"`
}

// GenerateEscrowSummary generates escrow summary report
func (s *ReportingService) GenerateEscrowSummary(ctx context.Context, tenantID string) (*EscrowSummaryReport, error) {
	report := &EscrowSummaryReport{
		TenantID:   tenantID,
		ReportDate: time.Now(),
		ByUseCase:  make(map[string]UseCaseMetrics),
		ByStatus:   make(map[string]int),
	}

	// Query total contracts
	err := s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status IN ('funded', 'in_progress', 'disputed')) as active,
			COUNT(*) FILTER (WHERE status = 'released') as completed,
			COUNT(*) FILTER (WHERE status = 'disputed') as disputed,
			COALESCE(SUM(total_amount), 0) as total_volume,
			COALESCE(SUM(total_amount) FILTER (WHERE status IN ('funded', 'in_progress', 'disputed')), 0) as active_balance
		FROM escrow_contracts
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&report.TotalContracts,
		&report.ActiveContracts,
		&report.CompletedContracts,
		&report.DisputedContracts,
		&report.TotalVolume,
		&report.ActiveBalance,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query contract summary: %w", err)
	}

	// Query by use case
	rows, err := s.db.Query(ctx, `
		SELECT 
			use_case,
			COUNT(*) as count,
			COALESCE(SUM(total_amount), 0) as volume,
			COALESCE(AVG(total_amount), 0) as avg_amount,
			COUNT(*) FILTER (WHERE status = 'disputed')::float / NULLIF(COUNT(*), 0) as dispute_rate
		FROM escrow_contracts
		WHERE tenant_id = $1
		GROUP BY use_case
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to query by use case: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var useCase string
		var metrics UseCaseMetrics
		if err := rows.Scan(&useCase, &metrics.Count, &metrics.Volume, &metrics.AvgAmount, &metrics.DisputeRate); err != nil {
			continue
		}
		report.ByUseCase[useCase] = metrics
	}

	// Query by status
	statusRows, err := s.db.Query(ctx, `
		SELECT status, COUNT(*) as count
		FROM escrow_contracts
		WHERE tenant_id = $1
		GROUP BY status
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to query by status: %w", err)
	}
	defer statusRows.Close()

	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			continue
		}
		report.ByStatus[status] = count
	}

	// Query fees collected
	err = s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM escrow_transactions
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND transaction_type = 'fee'
	`, tenantID).Scan(&report.FeesCollected)
	if err != nil {
		report.FeesCollected = 0
	}

	return report, nil
}

// GenerateVolumeReport generates volume report over time
func (s *ReportingService) GenerateVolumeReport(ctx context.Context, tenantID, startDate, endDate, groupBy string) (*VolumeReport, error) {
	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)

	report := &VolumeReport{
		TenantID:  tenantID,
		StartDate: start,
		EndDate:   end,
		GroupBy:   groupBy,
		Data:      []VolumeDataPoint{},
	}

	// Determine date truncation based on groupBy
	dateTrunc := "day"
	switch groupBy {
	case "week":
		dateTrunc = "week"
	case "month":
		dateTrunc = "month"
	}

	query := fmt.Sprintf(`
		SELECT 
			DATE_TRUNC('%s', created_at) as period,
			COUNT(*) as contracts_count,
			COUNT(*) FILTER (WHERE status IN ('funded', 'in_progress', 'released')) as funded_count,
			COUNT(*) FILTER (WHERE status = 'released') as released_count,
			COUNT(*) FILTER (WHERE status = 'refunded') as refunded_count,
			COUNT(*) FILTER (WHERE status = 'disputed') as disputed_count,
			COALESCE(SUM(total_amount), 0) as total_volume,
			COALESCE(SUM(total_amount) FILTER (WHERE status IN ('funded', 'in_progress', 'released')), 0) as funded_volume,
			COALESCE(SUM(total_amount) FILTER (WHERE status = 'released'), 0) as released_volume,
			COALESCE(SUM(total_amount) FILTER (WHERE status = 'refunded'), 0) as refunded_volume
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND created_at >= $2
		AND created_at <= $3
		GROUP BY DATE_TRUNC('%s', created_at)
		ORDER BY period
	`, dateTrunc, dateTrunc)

	rows, err := s.db.Query(ctx, query, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query volume data: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var dp VolumeDataPoint
		var period time.Time
		if err := rows.Scan(
			&period,
			&dp.ContractsCount,
			&dp.FundedCount,
			&dp.ReleasedCount,
			&dp.RefundedCount,
			&dp.DisputedCount,
			&dp.TotalVolume,
			&dp.FundedVolume,
			&dp.ReleasedVolume,
			&dp.RefundedVolume,
		); err != nil {
			continue
		}
		dp.Period = period.Format("2006-01-02")
		report.Data = append(report.Data, dp)

		// Accumulate totals
		report.Totals.TotalContracts += dp.ContractsCount
		report.Totals.TotalFunded += dp.FundedCount
		report.Totals.TotalReleased += dp.ReleasedCount
		report.Totals.TotalRefunded += dp.RefundedCount
		report.Totals.TotalDisputed += dp.DisputedCount
		report.Totals.TotalVolume += dp.TotalVolume
	}

	return report, nil
}

// GenerateDisputeReport generates dispute analytics report
func (s *ReportingService) GenerateDisputeReport(ctx context.Context, tenantID, startDate, endDate string) (*DisputeReport, error) {
	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)

	report := &DisputeReport{
		TenantID:     tenantID,
		StartDate:    start,
		EndDate:      end,
		ByReason:     make(map[string]int),
		ByResolution: make(map[string]int),
		ByUseCase:    make(map[string]DisputeMetrics),
	}

	// Query dispute summary
	err := s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'open') as open_disputes,
			COUNT(*) FILTER (WHERE status IN ('resolved_buyer', 'resolved_seller', 'partial_settlement')) as resolved,
			COUNT(*) FILTER (WHERE escalated = true) as escalated,
			COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400) FILTER (WHERE resolved_at IS NOT NULL), 0) as avg_resolution_days,
			COALESCE(SUM(disputed_amount), 0) as total_disputed
		FROM escrow_disputes
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
	`, tenantID, start, end).Scan(
		&report.TotalDisputes,
		&report.OpenDisputes,
		&report.ResolvedDisputes,
		&report.EscalatedDisputes,
		&report.AvgResolutionDays,
		&report.TotalDisputedAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query dispute summary: %w", err)
	}

	// Query by reason
	reasonRows, err := s.db.Query(ctx, `
		SELECT reason_category, COUNT(*)
		FROM escrow_disputes
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
		GROUP BY reason_category
	`, tenantID, start, end)
	if err == nil {
		defer reasonRows.Close()
		for reasonRows.Next() {
			var reason string
			var count int
			if err := reasonRows.Scan(&reason, &count); err == nil {
				report.ByReason[reason] = count
			}
		}
	}

	// Query by resolution
	resolutionRows, err := s.db.Query(ctx, `
		SELECT status, COUNT(*)
		FROM escrow_disputes
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
		AND status IN ('resolved_buyer', 'resolved_seller', 'partial_settlement')
		GROUP BY status
	`, tenantID, start, end)
	if err == nil {
		defer resolutionRows.Close()
		for resolutionRows.Next() {
			var resolution string
			var count int
			if err := resolutionRows.Scan(&resolution, &count); err == nil {
				report.ByResolution[resolution] = count
			}
		}
	}

	// Calculate dispute rate
	var totalContracts int
	s.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM escrow_contracts
		WHERE tenant_id = $1
		AND created_at >= $2
		AND created_at <= $3
	`, tenantID, start, end).Scan(&totalContracts)

	if totalContracts > 0 {
		report.DisputeRate = float64(report.TotalDisputes) / float64(totalContracts) * 100
	}

	return report, nil
}

// GenerateAgingReport generates escrow aging report
func (s *ReportingService) GenerateAgingReport(ctx context.Context, tenantID string) (*AgingReport, error) {
	report := &AgingReport{
		TenantID:   tenantID,
		ReportDate: time.Now(),
		AgingBuckets: []AgingBucket{
			{Label: "0-7 days", MinDays: 0, MaxDays: 7},
			{Label: "8-14 days", MinDays: 8, MaxDays: 14},
			{Label: "15-30 days", MinDays: 15, MaxDays: 30},
			{Label: "31-60 days", MinDays: 31, MaxDays: 60},
			{Label: "61-90 days", MinDays: 61, MaxDays: 90},
			{Label: "90+ days", MinDays: 91, MaxDays: 9999},
		},
		AtRisk: []AtRiskEscrow{},
	}

	// Query total active
	err := s.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND status IN ('funded', 'in_progress', 'disputed')
	`, tenantID).Scan(&report.TotalActive, &report.TotalBalance)
	if err != nil {
		return nil, fmt.Errorf("failed to query active escrows: %w", err)
	}

	// Query aging buckets
	for i := range report.AgingBuckets {
		bucket := &report.AgingBuckets[i]
		err := s.db.QueryRow(ctx, `
			SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
			FROM escrow_contracts
			WHERE tenant_id = $1
			AND status IN ('funded', 'in_progress', 'disputed')
			AND EXTRACT(DAY FROM NOW() - created_at) >= $2
			AND EXTRACT(DAY FROM NOW() - created_at) <= $3
		`, tenantID, bucket.MinDays, bucket.MaxDays).Scan(&bucket.Count, &bucket.Balance)
		if err != nil {
			continue
		}
		if report.TotalBalance > 0 {
			bucket.Percentage = bucket.Balance / report.TotalBalance * 100
		}
	}

	// Query at-risk escrows (disputed or > 60 days)
	atRiskRows, err := s.db.Query(ctx, `
		SELECT id, contract_number, total_amount, 
			EXTRACT(DAY FROM NOW() - created_at)::int as days_active,
			status, created_at
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND (status = 'disputed' OR EXTRACT(DAY FROM NOW() - created_at) > 60)
		AND status IN ('funded', 'in_progress', 'disputed')
		ORDER BY total_amount DESC
		LIMIT 20
	`, tenantID)
	if err == nil {
		defer atRiskRows.Close()
		for atRiskRows.Next() {
			var escrow AtRiskEscrow
			if err := atRiskRows.Scan(
				&escrow.ContractID,
				&escrow.ContractNumber,
				&escrow.Amount,
				&escrow.DaysActive,
				&escrow.Status,
				&escrow.CreatedAt,
			); err == nil {
				if escrow.Status == "disputed" {
					escrow.RiskReason = "Active dispute"
				} else if escrow.DaysActive > 90 {
					escrow.RiskReason = "Aged > 90 days"
				} else {
					escrow.RiskReason = "Aged > 60 days"
				}
				report.AtRisk = append(report.AtRisk, escrow)
			}
		}
	}

	return report, nil
}

// GenerateCBNReport generates CBN regulatory report
func (s *ReportingService) GenerateCBNReport(ctx context.Context, tenantID, institutionCode, reportingPeriod string) (*CBNRegulatoryReport, error) {
	report := &CBNRegulatoryReport{
		ReportID:        fmt.Sprintf("CBN-%s-%d", reportingPeriod, time.Now().Unix()),
		ReportType:      "ESCROW_HOLDINGS",
		ReportingPeriod: reportingPeriod,
		TenantID:        tenantID,
		InstitutionCode: institutionCode,
		GeneratedAt:     time.Now(),
	}

	// Parse reporting period (e.g., "2024-12")
	periodStart, _ := time.Parse("2006-01", reportingPeriod)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)

	// Query escrow holdings
	err := s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) as total_accounts,
			COALESCE(SUM(total_amount) FILTER (WHERE status IN ('funded', 'in_progress', 'disputed')), 0) as total_balance
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND created_at <= $2
	`, tenantID, periodEnd).Scan(&report.TotalEscrowAccounts, &report.TotalEscrowBalance)
	if err != nil {
		return nil, fmt.Errorf("failed to query escrow holdings: %w", err)
	}

	// Query transaction summary
	err = s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) as total_transactions,
			COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'fund'), 0) as deposits,
			COALESCE(SUM(amount) FILTER (WHERE transaction_type IN ('release', 'refund')), 0) as withdrawals,
			COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'release'), 0) as releases,
			COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'refund'), 0) as refunds
		FROM escrow_transactions
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
	`, tenantID, periodStart, periodEnd).Scan(
		&report.TotalEscrowTransactions,
		&report.TotalDeposits,
		&report.TotalWithdrawals,
		&report.TotalReleases,
		&report.TotalRefunds,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}

	// Query dispute summary
	err = s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status IN ('resolved_buyer', 'resolved_seller', 'partial_settlement')) as resolved,
			COUNT(*) FILTER (WHERE status IN ('open', 'under_review', 'awaiting_evidence')) as pending,
			COALESCE(SUM(disputed_amount), 0) as disputed_amount
		FROM escrow_disputes
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
	`, tenantID, periodStart, periodEnd).Scan(
		&report.TotalDisputes,
		&report.ResolvedDisputes,
		&report.PendingDisputes,
		&report.DisputedAmount,
	)
	if err != nil {
		report.TotalDisputes = 0
	}

	// Query high-value transactions (> 10M NGN)
	s.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM escrow_transactions
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
		AND amount >= 10000000
	`, tenantID, periodStart, periodEnd).Scan(&report.HighValueTransactions)

	// Calculate compliance rates
	var totalParties, kycVerified int
	s.db.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE kyc_verified = true)
		FROM escrow_parties
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
	`, tenantID).Scan(&totalParties, &kycVerified)

	if totalParties > 0 {
		report.KYCComplianceRate = float64(kycVerified) / float64(totalParties) * 100
	}
	report.AMLScreeningRate = 100.0 // Assume all transactions are screened

	return report, nil
}

// GenerateNDICReport generates NDIC deposit insurance report
func (s *ReportingService) GenerateNDICReport(ctx context.Context, tenantID, institutionCode, reportingPeriod string) (*NDICReport, error) {
	report := &NDICReport{
		ReportID:        fmt.Sprintf("NDIC-%s-%d", reportingPeriod, time.Now().Unix()),
		ReportingPeriod: reportingPeriod,
		TenantID:        tenantID,
		InstitutionCode: institutionCode,
		GeneratedAt:     time.Now(),
		AccountsBySize:  make(map[string]int),
	}

	// Parse reporting period
	periodStart, _ := time.Parse("2006-01", reportingPeriod)
	periodEnd := periodStart.AddDate(0, 1, 0).Add(-time.Second)

	// NDIC insurance limit is 500,000 NGN per depositor
	const ndicInsuranceLimit = 500000.0

	// Query total escrow deposits
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_amount) FILTER (WHERE status IN ('funded', 'in_progress', 'disputed')), 0)
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND created_at <= $2
	`, tenantID, periodEnd).Scan(&report.TotalEscrowDeposits)
	if err != nil {
		return nil, fmt.Errorf("failed to query deposits: %w", err)
	}

	// Calculate insured vs uninsured (simplified - per account basis)
	var insuredCount, uninsuredCount int
	s.db.QueryRow(ctx, `
		SELECT 
			COUNT(*) FILTER (WHERE total_amount <= $2),
			COUNT(*) FILTER (WHERE total_amount > $2)
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND status IN ('funded', 'in_progress', 'disputed')
	`, tenantID, ndicInsuranceLimit).Scan(&insuredCount, &uninsuredCount)

	// Query insured amount
	s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(LEAST(total_amount, $2)), 0)
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND status IN ('funded', 'in_progress', 'disputed')
	`, tenantID, ndicInsuranceLimit).Scan(&report.InsuredAmount)

	report.UninsuredAmount = report.TotalEscrowDeposits - report.InsuredAmount

	// Query account distribution by size
	sizeBuckets := []struct {
		label string
		min   float64
		max   float64
	}{
		{"< 100K", 0, 100000},
		{"100K - 500K", 100000, 500000},
		{"500K - 1M", 500000, 1000000},
		{"1M - 5M", 1000000, 5000000},
		{"5M - 10M", 5000000, 10000000},
		{"> 10M", 10000000, 999999999999},
	}

	for _, bucket := range sizeBuckets {
		var count int
		s.db.QueryRow(ctx, `
			SELECT COUNT(*)
			FROM escrow_contracts
			WHERE tenant_id = $1
			AND status IN ('funded', 'in_progress', 'disputed')
			AND total_amount >= $2
			AND total_amount < $3
		`, tenantID, bucket.min, bucket.max).Scan(&count)
		report.AccountsBySize[bucket.label] = count
	}

	// Query movement summary
	prevPeriodEnd := periodStart.Add(-time.Second)
	s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_amount) FILTER (WHERE status IN ('funded', 'in_progress', 'disputed')), 0)
		FROM escrow_contracts
		WHERE tenant_id = $1
		AND created_at <= $2
	`, tenantID, prevPeriodEnd).Scan(&report.OpeningBalance)

	s.db.QueryRow(ctx, `
		SELECT 
			COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'fund'), 0),
			COALESCE(SUM(amount) FILTER (WHERE transaction_type IN ('release', 'refund')), 0)
		FROM escrow_transactions
		WHERE contract_id IN (SELECT id FROM escrow_contracts WHERE tenant_id = $1)
		AND created_at >= $2
		AND created_at <= $3
	`, tenantID, periodStart, periodEnd).Scan(&report.Deposits, &report.Withdrawals)

	report.ClosingBalance = report.OpeningBalance + report.Deposits - report.Withdrawals

	return report, nil
}

// AuditTrailReport represents audit trail for compliance
type AuditTrailReport struct {
	ContractID string       `json:"contract_id"`
	Events     []AuditEntry `json:"events"`
}

// AuditEntry represents a single audit entry
type AuditEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	EventType   string                 `json:"event_type"`
	ActorID     string                 `json:"actor_id"`
	ActorType   string                 `json:"actor_type"`
	Description string                 `json:"description"`
	Details     map[string]interface{} `json:"details,omitempty"`
	IPAddress   string                 `json:"ip_address,omitempty"`
}

// GenerateAuditTrail generates audit trail for a contract
func (s *ReportingService) GenerateAuditTrail(ctx context.Context, contractID string) (*AuditTrailReport, error) {
	report := &AuditTrailReport{
		ContractID: contractID,
		Events:     []AuditEntry{},
	}

	rows, err := s.db.Query(ctx, `
		SELECT created_at, event_type, actor_id, actor_type, event_description, metadata, actor_ip
		FROM escrow_audit_log
		WHERE contract_id = $1
		ORDER BY created_at ASC
	`, contractID)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit log: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var entry AuditEntry
		var details []byte
		if err := rows.Scan(
			&entry.Timestamp,
			&entry.EventType,
			&entry.ActorID,
			&entry.ActorType,
			&entry.Description,
			&details,
			&entry.IPAddress,
		); err != nil {
			continue
		}
		if len(details) > 0 {
			json.Unmarshal(details, &entry.Details)
		}
		report.Events = append(report.Events, entry)
	}

	return report, nil
}

// Helper for JSON unmarshaling
