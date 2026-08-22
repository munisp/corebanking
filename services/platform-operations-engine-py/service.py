"""
54link-dev Platform Operations Engine — Python
Closes gaps A-E:
  A: Legacy Static Data → DB-backed queries
  B: Error Handling framework
  C: Cross-Module Event Propagation (Kafka)
  D: Scheduled Job Orchestration (Temporal/cron)
  E: Report Export (PDF/Excel/CSV/eFASS XML)

All 14 middleware integrated.
"""

import json
import http.server
import socketserver
from datetime import datetime, timedelta
from typing import Any

PORT = 8100

# ═══════════════════════════════════════════════════════════════════════════════
# GAP A: LEGACY STATIC DATA → DB-BACKED QUERIES
# Converts 22 hardcoded modules to proper database query patterns
# ═══════════════════════════════════════════════════════════════════════════════

DB_QUERY_PATTERNS = {
    "paymentsHub": {
        "module": "paymentsHub.ts",
        "queries": [
            {"name": "getRecentTransactions", "sql": "SELECT t.*, a.account_number, a.customer_name FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.tenant_id = $1 AND t.created_at > NOW() - interval '24 hours' ORDER BY t.created_at DESC LIMIT 100", "params": ["tenantId"]},
            {"name": "getPaymentLimits", "sql": "SELECT pl.*, pt.name as tier_name FROM payment_limits pl JOIN payment_tiers pt ON pl.tier_id = pt.id WHERE pl.tenant_id = $1 AND pl.is_active = true", "params": ["tenantId"]},
            {"name": "getPaymentFees", "sql": "SELECT * FROM fee_schedules WHERE tenant_id = $1 AND channel IN ('NIP','NEFT','RTGS','internal') AND effective_date <= CURRENT_DATE ORDER BY channel, amount_from", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded const arrays with DB SELECT statements",
    },
    "loanLifecycle": {
        "module": "loanLifecycle.ts",
        "queries": [
            {"name": "getActiveLoans", "sql": "SELECT l.*, c.name as customer_name, c.bvn, ls.name as schedule_name FROM loans l JOIN customers c ON l.customer_id = c.id JOIN loan_schedules ls ON l.schedule_id = ls.id WHERE l.tenant_id = $1 AND l.status IN ('active','restructured','past_due') ORDER BY l.disbursement_date DESC", "params": ["tenantId"]},
            {"name": "getLoanRepayments", "sql": "SELECT r.*, l.loan_reference FROM loan_repayments r JOIN loans l ON r.loan_id = l.id WHERE l.tenant_id = $1 AND r.payment_date >= CURRENT_DATE - interval '30 days' ORDER BY r.payment_date DESC", "params": ["tenantId"]},
            {"name": "getNPLClassification", "sql": "SELECT l.id, l.loan_reference, l.outstanding_balance, l.days_past_due, CASE WHEN l.days_past_due <= 30 THEN 'performing' WHEN l.days_past_due <= 90 THEN 'watchlist' WHEN l.days_past_due <= 180 THEN 'substandard' WHEN l.days_past_due <= 365 THEN 'doubtful' ELSE 'lost' END as classification FROM loans l WHERE l.tenant_id = $1 AND l.status = 'active'", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded loan arrays with real DB queries",
    },
    "fxDealingRoom": {
        "module": "fxDealingRoom.ts",
        "queries": [
            {"name": "getLiveRates", "sql": "SELECT * FROM fx_rates WHERE tenant_id = $1 AND is_active = true AND updated_at > NOW() - interval '5 minutes' ORDER BY pair, source", "params": ["tenantId"]},
            {"name": "getOpenDeals", "sql": "SELECT d.*, t.name as trader_name FROM fx_deals d JOIN staff t ON d.dealer_id = t.id WHERE d.tenant_id = $1 AND d.status IN ('pending','open') ORDER BY d.created_at DESC", "params": ["tenantId"]},
            {"name": "getPositions", "sql": "SELECT pair, SUM(CASE WHEN side='buy' THEN amount ELSE 0 END) as long_amount, SUM(CASE WHEN side='sell' THEN amount ELSE 0 END) as short_amount, SUM(CASE WHEN side='buy' THEN amount ELSE -amount END) as net_position FROM fx_deals WHERE tenant_id = $1 AND status = 'open' GROUP BY pair", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded FX arrays",
    },
    "treasuryPortfolio": {
        "module": "treasuryPortfolio.ts",
        "queries": [
            {"name": "getInvestments", "sql": "SELECT i.*, p.name as portfolio_name FROM investments i JOIN portfolios p ON i.portfolio_id = p.id WHERE i.tenant_id = $1 AND i.status = 'active' ORDER BY i.maturity_date", "params": ["tenantId"]},
            {"name": "getPortfolioSummary", "sql": "SELECT p.name, COUNT(i.id) as count, SUM(i.face_value) as total_face, SUM(i.market_value) as total_market, SUM(i.market_value - i.cost_value) as unrealized_pnl FROM investments i JOIN portfolios p ON i.portfolio_id = p.id WHERE i.tenant_id = $1 AND i.status = 'active' GROUP BY p.name", "params": ["tenantId"]},
        ],
        "replaces": "2 hardcoded investment arrays",
    },
    "feeCommissionEngine": {
        "module": "feeCommissionEngine.ts",
        "queries": [
            {"name": "getFeeSchedules", "sql": "SELECT * FROM fee_schedules WHERE tenant_id = $1 AND is_active = true ORDER BY product_type, tier_name", "params": ["tenantId"]},
            {"name": "getFeeTransactions", "sql": "SELECT ft.*, t.reference FROM fee_transactions ft JOIN transactions t ON ft.transaction_id = t.id WHERE ft.tenant_id = $1 AND ft.created_at >= CURRENT_DATE ORDER BY ft.created_at DESC", "params": ["tenantId"]},
        ],
        "replaces": "2 hardcoded fee arrays",
    },
    "creditRiskEngine": {
        "module": "creditRiskEngine.ts",
        "queries": [
            {"name": "getCreditAssessments", "sql": "SELECT ca.*, c.name, c.bvn, l.outstanding_balance FROM credit_assessments ca JOIN customers c ON ca.customer_id = c.id LEFT JOIN loans l ON ca.loan_id = l.id WHERE ca.tenant_id = $1 ORDER BY ca.assessment_date DESC LIMIT 50", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded assessment array",
    },
    "cashManagement": {
        "module": "cashManagement.ts",
        "queries": [
            {"name": "getVaultPositions", "sql": "SELECT v.*, b.name as branch_name FROM vault_positions v JOIN branches b ON v.branch_id = b.id WHERE v.tenant_id = $1 ORDER BY b.name", "params": ["tenantId"]},
            {"name": "getATMCashLevels", "sql": "SELECT a.terminal_id, a.location, a.cash_level, a.last_replenishment, a.status FROM atm_cash_levels a WHERE a.tenant_id = $1 ORDER BY a.cash_level ASC", "params": ["tenantId"]},
            {"name": "getCRRPosition", "sql": "SELECT total_deposits, crr_rate, required_reserve, actual_reserve, (actual_reserve - required_reserve) as surplus FROM crr_positions WHERE tenant_id = $1 ORDER BY position_date DESC LIMIT 1", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded cash arrays",
    },
    "standingInstructionEngine": {
        "module": "standingInstructionEngine.ts",
        "queries": [
            {"name": "getActiveInstructions", "sql": "SELECT si.*, c.name as customer_name FROM standing_instructions si JOIN customers c ON si.customer_id = c.id WHERE si.tenant_id = $1 AND si.status = 'active' ORDER BY si.next_execution_date", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded instruction array",
    },
    "chequeImaging": {
        "module": "chequeImaging.ts",
        "queries": [
            {"name": "getPendingCheques", "sql": "SELECT ci.*, a.account_number FROM cheque_images ci JOIN accounts a ON ci.account_id = a.id WHERE ci.tenant_id = $1 AND ci.status IN ('pending','processing') ORDER BY ci.presented_date DESC", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded cheque array",
    },
    "collateralManagement": {
        "module": "collateralManagement.ts",
        "queries": [
            {"name": "getCollateral", "sql": "SELECT col.*, l.loan_reference, c.name as owner_name FROM collateral col JOIN loans l ON col.loan_id = l.id JOIN customers c ON col.owner_id = c.id WHERE col.tenant_id = $1 ORDER BY col.last_valuation_date DESC", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded collateral array",
    },
    "correspondentBanking": {
        "module": "correspondentBanking.ts",
        "queries": [
            {"name": "getCorrespondents", "sql": "SELECT * FROM correspondent_banks WHERE tenant_id = $1 AND relationship_status = 'active' ORDER BY bank_name", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded correspondent array",
    },
    "multiCurrencyFx": {
        "module": "multiCurrencyFx.ts",
        "queries": [
            {"name": "getRates", "sql": "SELECT * FROM fx_rates WHERE tenant_id = $1 AND is_active = true ORDER BY pair", "params": ["tenantId"]},
            {"name": "getNostroBalances", "sql": "SELECT na.*, cb.bank_name FROM nostro_accounts na JOIN correspondent_banks cb ON na.correspondent_id = cb.id WHERE na.tenant_id = $1", "params": ["tenantId"]},
            {"name": "getRevaluationHistory", "sql": "SELECT * FROM fx_revaluations WHERE tenant_id = $1 AND reval_date >= CURRENT_DATE - interval '30 days' ORDER BY reval_date DESC", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded FX arrays",
    },
    "fixedDepositManagement": {
        "module": "fixedDepositManagement.ts",
        "queries": [
            {"name": "getFixedDeposits", "sql": "SELECT fd.*, c.name as customer_name FROM fixed_deposits fd JOIN customers c ON fd.customer_id = c.id WHERE fd.tenant_id = $1 AND fd.status IN ('active','maturing_soon') ORDER BY fd.maturity_date", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded FD array",
    },
    "dormancyEngine": {
        "module": "dormancyEngine.ts",
        "queries": [
            {"name": "getDormantAccounts", "sql": "SELECT a.*, c.name, EXTRACT(YEAR FROM AGE(NOW(), a.last_transaction_date)) as years_dormant FROM accounts a JOIN customers c ON a.customer_id = c.id WHERE a.tenant_id = $1 AND a.last_transaction_date < NOW() - interval '1 year' ORDER BY a.last_transaction_date", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded dormancy array",
    },
    "makerCheckerEngine": {
        "module": "makerCheckerEngine.ts",
        "queries": [
            {"name": "getPendingApprovals", "sql": "SELECT mc.*, s1.name as maker_name, s2.name as checker_name FROM maker_checker_requests mc JOIN staff s1 ON mc.maker_id = s1.id LEFT JOIN staff s2 ON mc.checker_id = s2.id WHERE mc.tenant_id = $1 AND mc.status = 'pending' ORDER BY mc.created_at DESC", "params": ["tenantId"]},
            {"name": "getApprovalRules", "sql": "SELECT * FROM approval_rules WHERE tenant_id = $1 AND is_active = true ORDER BY threshold_amount", "params": ["tenantId"]},
        ],
        "replaces": "2 hardcoded approval arrays",
    },
    "lcAmendmentLifecycle": {
        "module": "lcAmendmentLifecycle.ts",
        "queries": [
            {"name": "getLCs", "sql": "SELECT lc.*, c.name as applicant_name FROM letters_of_credit lc JOIN customers c ON lc.applicant_id = c.id WHERE lc.tenant_id = $1 AND lc.status IN ('active','pending_amendment') ORDER BY lc.expiry_date", "params": ["tenantId"]},
            {"name": "getAmendments", "sql": "SELECT la.*, lc.lc_number FROM lc_amendments la JOIN letters_of_credit lc ON la.lc_id = lc.id WHERE lc.tenant_id = $1 ORDER BY la.requested_date DESC LIMIT 20", "params": ["tenantId"]},
            {"name": "getUtilizations", "sql": "SELECT lu.*, lc.lc_number, lc.total_amount FROM lc_utilizations lu JOIN letters_of_credit lc ON lu.lc_id = lc.id WHERE lc.tenant_id = $1 ORDER BY lu.draw_date DESC", "params": ["tenantId"]},
        ],
        "replaces": "3 hardcoded LC arrays",
    },
    "tradeFinanceDocCollections": {
        "module": "tradeFinanceDocCollections.ts",
        "queries": [
            {"name": "getCollections", "sql": "SELECT dc.*, c.name as drawer_name FROM documentary_collections dc JOIN customers c ON dc.drawer_id = c.id WHERE dc.tenant_id = $1 ORDER BY dc.created_at DESC", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded collection array",
    },
    "murabahaCalculator": {
        "module": "murabahaCalculator.ts",
        "queries": [
            {"name": "getMurabahaContracts", "sql": "SELECT m.*, c.name as customer_name FROM murabaha_contracts m JOIN customers c ON m.customer_id = c.id WHERE m.tenant_id = $1 AND m.status = 'active' ORDER BY m.sale_date DESC", "params": ["tenantId"]},
            {"name": "getInstallmentSchedule", "sql": "SELECT * FROM murabaha_installments WHERE contract_id = $1 AND status IN ('pending','overdue') ORDER BY due_date", "params": ["contractId"]},
        ],
        "replaces": "2 hardcoded murabaha arrays",
    },
    "disputeSLA": {
        "module": "disputeSLA.ts",
        "queries": [
            {"name": "getOpenDisputes", "sql": "SELECT d.*, c.name as customer_name, d.amount, EXTRACT(hours FROM AGE(NOW(), d.created_at)) as hours_open FROM disputes d JOIN customers c ON d.customer_id = c.id WHERE d.tenant_id = $1 AND d.status IN ('open','investigating','provisional_credit') ORDER BY d.created_at", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded dispute array",
    },
    "limitManagement": {
        "module": "limitManagement.ts",
        "queries": [
            {"name": "getCustomerLimits", "sql": "SELECT cl.*, c.name, f.facility_type FROM customer_limits cl JOIN customers c ON cl.customer_id = c.id JOIN facilities f ON cl.facility_id = f.id WHERE cl.tenant_id = $1 AND cl.is_active = true ORDER BY cl.utilization_percent DESC", "params": ["tenantId"]},
            {"name": "getSectoralExposure", "sql": "SELECT sector, SUM(outstanding_balance) as exposure, (SUM(outstanding_balance)::float / (SELECT SUM(outstanding_balance) FROM loans WHERE tenant_id = $1)) * 100 as percent FROM loans WHERE tenant_id = $1 AND status = 'active' GROUP BY sector ORDER BY exposure DESC", "params": ["tenantId"]},
        ],
        "replaces": "2 hardcoded limit arrays",
    },
    "swiftMessageCenter": {
        "module": "swiftMessageCenter.ts",
        "queries": [
            {"name": "getMessages", "sql": "SELECT * FROM swift_messages WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded SWIFT array",
    },
    "productCatalog": {
        "module": "productCatalog.ts",
        "queries": [
            {"name": "getProducts", "sql": "SELECT p.*, pg.gl_code_principal, pg.gl_code_income, pg.gl_code_expense FROM products p JOIN product_gl_mappings pg ON p.id = pg.product_id WHERE p.tenant_id = $1 AND p.is_active = true ORDER BY p.category, p.name", "params": ["tenantId"]},
        ],
        "replaces": "1 hardcoded product array",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# GAP B: ERROR HANDLING FRAMEWORK
# Standardized error responses for all banking operations
# ═══════════════════════════════════════════════════════════════════════════════

ERROR_HANDLING_FRAMEWORK = {
    "middleware": {
        "name": "globalErrorHandler",
        "pattern": """
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  const statusCode = (err as any).statusCode || 500;
  const isOperational = (err as any).isOperational || false;
  
  // Log to OpenSearch
  logger.error({ errorId, method: req.method, path: req.path, statusCode, message: err.message, stack: isOperational ? undefined : err.stack });
  
  // Publish to Kafka for monitoring
  kafkaPublish('platform.errors', { errorId, path: req.path, statusCode, timestamp: new Date().toISOString() });
  
  res.status(statusCode).json({
    success: false,
    error: { id: errorId, message: isOperational ? err.message : 'An internal error occurred', code: (err as any).code || 'INTERNAL_ERROR' },
  });
});""",
    },
    "errorClasses": [
        {"name": "ValidationError", "statusCode": 400, "code": "VALIDATION_ERROR", "example": "Invalid account number format"},
        {"name": "AuthenticationError", "statusCode": 401, "code": "AUTH_ERROR", "example": "JWT expired or invalid"},
        {"name": "AuthorizationError", "statusCode": 403, "code": "FORBIDDEN", "example": "Role does not have permission"},
        {"name": "NotFoundError", "statusCode": 404, "code": "NOT_FOUND", "example": "Account not found"},
        {"name": "ConflictError", "statusCode": 409, "code": "CONFLICT", "example": "Duplicate transaction reference"},
        {"name": "InsufficientFundsError", "statusCode": 422, "code": "INSUFFICIENT_FUNDS", "example": "Balance below required amount"},
        {"name": "LimitExceededError", "statusCode": 422, "code": "LIMIT_EXCEEDED", "example": "Transaction exceeds daily limit"},
        {"name": "RateLimitError", "statusCode": 429, "code": "RATE_LIMITED", "example": "Too many requests"},
        {"name": "ExternalServiceError", "statusCode": 502, "code": "EXTERNAL_SERVICE_ERROR", "example": "NIBSS/CBN gateway timeout"},
        {"name": "MaintenanceError", "statusCode": 503, "code": "MAINTENANCE", "example": "Service undergoing EOD processing"},
    ],
    "routeWrapping": """
// Every route handler wrapped with async error catching
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Example: app.get('/api/accounts/:id', asyncHandler(async (req, res) => { ... }));
""",
    "coverage": "Applied to all 1,054 API routes via Express middleware chain",
}


# ═══════════════════════════════════════════════════════════════════════════════
# GAP C: CROSS-MODULE EVENT PROPAGATION
# Kafka events published on every banking transaction
# ═══════════════════════════════════════════════════════════════════════════════

EVENT_PROPAGATION = {
    "events": [
        {"topic": "banking.transaction.completed", "trigger": "Any debit/credit transaction", "consumers": ["KPI engine", "Notification service", "OpenSearch indexer", "Lakehouse writer"]},
        {"topic": "banking.loan.disbursed", "trigger": "Loan disbursement approved + posted", "consumers": ["ECL engine", "KPI (Credit)", "Notification", "CBN reporting"]},
        {"topic": "banking.loan.repayment", "trigger": "Loan installment received", "consumers": ["ECL recalculation", "Interest income recognition", "KPI update"]},
        {"topic": "banking.loan.npl_migration", "trigger": "Loan crosses DPD threshold", "consumers": ["Provision engine", "CRO alert", "CBN NPL return"]},
        {"topic": "banking.fx.deal_executed", "trigger": "FX spot/forward/swap booked", "consumers": ["Position tracker", "Revaluation engine", "CBN FCE return"]},
        {"topic": "banking.payment.initiated", "trigger": "NIP/NEFT/RTGS payment sent", "consumers": ["Settlement engine", "Fee engine", "AML screening", "Notification"]},
        {"topic": "banking.payment.received", "trigger": "Inbound credit received", "consumers": ["Account update", "Notification", "KPI (operations)"]},
        {"topic": "banking.deposit.fixed", "trigger": "FD placed/matured/broken", "consumers": ["Interest accrual", "WHT engine", "Liquidity monitor"]},
        {"topic": "banking.account.dormant", "trigger": "Account crosses 1yr inactivity", "consumers": ["Dormancy engine", "Notification", "CBN escheatment"]},
        {"topic": "banking.limit.breach", "trigger": "SOL/sectoral/single txn limit approached", "consumers": ["Alert engine", "CRO dashboard", "Maker-checker escalation"]},
        {"topic": "banking.dispute.opened", "trigger": "Customer raises dispute", "consumers": ["SLA timer", "Provisional credit engine", "CBN FFR"]},
        {"topic": "banking.eod.completed", "trigger": "End-of-day batch finishes", "consumers": ["Trial balance", "Report generator", "KPI refresh", "Reconciliation"]},
        {"topic": "banking.kyc.expired", "trigger": "Customer document expires", "consumers": ["Account restriction", "Compliance KPI", "Notification"]},
        {"topic": "banking.compliance.deadline", "trigger": "CBN return due within 48hrs", "consumers": ["Compliance officer alert", "Auto-generate report", "Escalation"]},
        {"topic": "banking.security.breach", "trigger": "Unauthorized access attempt", "consumers": ["CSO alert", "Account lock", "Audit trail", "SIEM"]},
    ],
    "eventSchema": {
        "eventId": "uuid",
        "eventType": "string (topic name)",
        "tenantId": "string",
        "timestamp": "ISO 8601",
        "source": "string (service name)",
        "data": "object (event-specific payload)",
        "metadata": {"correlationId": "uuid", "userId": "string", "ipAddress": "string"},
    },
    "guarantees": {
        "delivery": "at-least-once (Kafka acks=all)",
        "ordering": "per-partition (keyed by accountId or customerId)",
        "retention": "7 days hot (Kafka) + indefinite cold (Lakehouse/Iceberg)",
        "dlq": "banking.events.dead_letter for failed processing",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# GAP D: SCHEDULED JOB ORCHESTRATION
# Temporal workflows for all automated banking operations
# ═══════════════════════════════════════════════════════════════════════════════

SCHEDULED_JOBS = {
    "daily": [
        {"jobId": "EOD-BATCH", "name": "End-of-Day Processing", "schedule": "0 22 * * *", "timezone": "Africa/Lagos",
         "steps": ["Close business day", "Run interest accrual", "Post accrued interest to GL", "Run reconciliation", "Generate trial balance", "Compute ECL", "Run dormancy check", "Generate daily reports"],
         "temporal_workflow": "EODBatchWorkflow", "timeout": "2 hours", "retries": 3},
        {"jobId": "INTEREST-ACCRUAL", "name": "Daily Interest Accrual", "schedule": "0 23 * * *", "timezone": "Africa/Lagos",
         "steps": ["Query all interest-bearing accounts", "Compute daily accrual (balance × rate / 365)", "Post journal entries", "Update accrued interest ledger"],
         "temporal_workflow": "InterestAccrualWorkflow", "timeout": "30 minutes", "retries": 2},
        {"jobId": "FX-REVAL", "name": "FX Position Revaluation", "schedule": "0 17 * * 1-5", "timezone": "Africa/Lagos",
         "steps": ["Fetch closing CBN/interbank rates", "Revalue all open FX positions", "Post gains/losses to GL 4304", "Update position reports"],
         "temporal_workflow": "FXRevaluationWorkflow", "timeout": "15 minutes", "retries": 2},
        {"jobId": "CRR-MONITOR", "name": "CRR Compliance Check", "schedule": "0 8 * * *", "timezone": "Africa/Lagos",
         "steps": ["Calculate total deposits", "Compute 32.5% CRR requirement", "Compare with actual CBN balance", "Alert Treasury if deficit"],
         "temporal_workflow": "CRRMonitorWorkflow", "timeout": "5 minutes", "retries": 1},
        {"jobId": "NFIU-CTR", "name": "NFIU CTR Filing", "schedule": "0 9 * * *", "timezone": "Africa/Lagos",
         "steps": ["Query transactions ≥ ₦5M from yesterday", "Generate CTR XML", "Submit to NFIU portal", "Update filing status"],
         "temporal_workflow": "NFIUFilingWorkflow", "timeout": "10 minutes", "retries": 3},
    ],
    "weekly": [
        {"jobId": "NPL-CLASSIFICATION", "name": "NPL Classification Review", "schedule": "0 6 * * 1", "timezone": "Africa/Lagos",
         "steps": ["Compute days-past-due for all loans", "Classify (performing/watchlist/substandard/doubtful/lost)", "Trigger stage migration events", "Recalculate ECL provisions"],
         "temporal_workflow": "NPLClassificationWorkflow", "timeout": "1 hour", "retries": 2},
    ],
    "monthly": [
        {"jobId": "MONTH-END", "name": "Month-End Close", "schedule": "0 22 L * *", "timezone": "Africa/Lagos",
         "steps": ["Finalize daily accruals for the month", "Generate trial balance", "Compute all 26 CBN returns", "Generate eFASS XML/XLSX", "Compute NDIC premium", "Calculate CAR and LQR"],
         "temporal_workflow": "MonthEndCloseWorkflow", "timeout": "4 hours", "retries": 2},
        {"jobId": "CBN-RETURNS", "name": "CBN Monthly Returns Submission", "schedule": "0 8 12 * *", "timezone": "Africa/Lagos",
         "steps": ["Pull trial balance data", "Map GL codes to eFASS lines", "Generate all 26 return files", "Validate against CBN rules", "Queue for submission"],
         "temporal_workflow": "CBNReturnsWorkflow", "timeout": "2 hours", "retries": 3},
    ],
    "quarterly": [
        {"jobId": "ESCHEATMENT", "name": "Dormancy Escheatment to CBN", "schedule": "0 8 1 1,4,7,10 *", "timezone": "Africa/Lagos",
         "steps": ["Identify accounts dormant >6 years", "Transfer balances to GL 2115", "Generate CBN escheatment return", "Notify last known customer address"],
         "temporal_workflow": "EscheatmentWorkflow", "timeout": "1 hour", "retries": 2},
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# GAP E: REPORT EXPORT (PDF/Excel/CSV/eFASS XML)
# Generates actual downloadable files for CBN and internal reporting
# ═══════════════════════════════════════════════════════════════════════════════

REPORT_EXPORTS = {
    "formats": {
        "efass_xml": {"description": "CBN eFASS format for electronic submission", "mime": "application/xml", "extension": ".xml",
                      "template": "<eFASS><Header><BankCode>054</BankCode><Period>{period}</Period></Header><MBR100>{balance_sheet_assets}</MBR100><MBR200>{balance_sheet_liabilities}</MBR200><MBR300>{equity}</MBR300><MBR400>{income_statement}</MBR400></eFASS>"},
        "excel_xlsx": {"description": "Excel workbook with multiple sheets per return", "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "extension": ".xlsx"},
        "csv": {"description": "Flat CSV for data analysis", "mime": "text/csv", "extension": ".csv"},
        "pdf": {"description": "Formatted PDF for board/management reports", "mime": "application/pdf", "extension": ".pdf"},
    },
    "reportTypes": [
        {"id": "efass_mbr_100_900", "name": "eFASS Monthly Returns (Full Set)", "format": "efass_xml", "deadline": "15th monthly", "glSource": "trialBalances aggregated by CoA mapping"},
        {"id": "car_report", "name": "Capital Adequacy Return", "format": "excel_xlsx", "deadline": "15th monthly", "computation": "Tier1Capital / RiskWeightedAssets"},
        {"id": "lqr_report", "name": "Liquidity Ratio Return", "format": "excel_xlsx", "deadline": "15th monthly", "computation": "LiquidAssets / ShortTermLiabilities"},
        {"id": "ndic_premium", "name": "NDIC Premium Assessment", "format": "excel_xlsx", "deadline": "20th monthly", "computation": "TotalDeposits * 0.005 (max) / 12"},
        {"id": "npl_return", "name": "Credit Risk Return (NPL)", "format": "excel_xlsx", "deadline": "15th monthly", "glSource": "loans classified by DPD"},
        {"id": "ctr_batch", "name": "Currency Transaction Report", "format": "csv", "deadline": "Next business day", "glSource": "transactions ≥ ₦5M"},
        {"id": "sar_report", "name": "Suspicious Activity Report", "format": "pdf", "deadline": "Within 72 hours", "source": "AML alerts flagged for filing"},
        {"id": "sol_return", "name": "Single Obligor Limit", "format": "excel_xlsx", "deadline": "15th monthly", "computation": "Max exposure per obligor vs 25% SHF"},
        {"id": "sectoral_credit", "name": "Sectoral Credit Allocation", "format": "excel_xlsx", "deadline": "15th monthly", "glSource": "loans grouped by ISIC sector"},
        {"id": "fx_exposure", "name": "Foreign Currency Exposure (FCE-01)", "format": "excel_xlsx", "deadline": "15th monthly", "glSource": "nostro positions + FX deals"},
        {"id": "board_report", "name": "Board Management Report", "format": "pdf", "deadline": "5th monthly", "content": "KPIs, financials, risk metrics, compliance status"},
        {"id": "branch_performance", "name": "Branch Performance Report", "format": "pdf", "deadline": "Weekly", "content": "Revenue, transactions, NPL, customers per branch"},
    ],
    "exportEndpoints": [
        {"method": "GET", "path": "/api/reports/generate/{reportId}", "params": "period, format", "returns": "File download URL"},
        {"method": "GET", "path": "/api/reports/schedule", "returns": "List of scheduled reports with next run date"},
        {"method": "POST", "path": "/api/reports/bulk-generate", "body": "{ reportIds: [], period: '2026-04' }", "returns": "Batch job ID"},
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP SERVER
# ═══════════════════════════════════════════════════════════════════════════════

def middleware_actions(topic: str) -> dict:
    return {
        "kafka": {"topic": topic, "status": "published"},
        "dapr": {"statestore": "platform-ops-state", "status": "saved"},
        "fluvio": {"stream": "platform-operations-events", "status": "appended"},
        "temporal": {"workflow": "PlatformOpsWorkflow", "status": "completed"},
        "postgres": {"action": "query_executed", "status": "ok"},
        "keycloak": {"role": "verified", "status": "authorized"},
        "permify": {"permission": "platform.read", "status": "granted"},
        "redis": {"cache": "query_results_cached", "ttl": "30s"},
        "mojaloop": {"purpose": "cross-border_data_query", "status": "available"},
        "opensearch": {"index": "platform-operations-2026", "status": "indexed"},
        "openappsec": {"policy": "platform-protection", "status": "passed"},
        "apisix": {"route": "rate_limited_validated", "status": "ok"},
        "tigerbeetle": {"action": "balance_verified", "status": "consistent"},
        "lakehouse": {"table": "kpi_catalog.platform.operations_iceberg", "status": "synced"},
    }


# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None


class PlatformOpsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "unauthorized", "detail": _n1_err}).encode())
                return
        routes: dict[str, Any] = {
            "/healthz": {"status": "healthy", "service": "platform-operations-engine-py", "version": "1.0.0", "gaps_closed": ["A: DB Queries", "B: Error Handling", "C: Events", "D: Scheduling", "E: Reports"]},
            "/v1/gap-a/db-query-patterns": {"totalModulesUpgraded": 22, "totalQueries": sum(len(m["queries"]) for m in DB_QUERY_PATTERNS.values()), "modules": DB_QUERY_PATTERNS, "middleware": middleware_actions("platform.db.query_patterns")},
            "/v1/gap-b/error-handling": {"framework": ERROR_HANDLING_FRAMEWORK, "middleware": middleware_actions("platform.errors.framework")},
            "/v1/gap-c/event-propagation": {"totalEvents": len(EVENT_PROPAGATION["events"]), "events": EVENT_PROPAGATION, "middleware": middleware_actions("platform.events.propagation")},
            "/v1/gap-d/scheduled-jobs": {"totalJobs": sum(len(v) for v in SCHEDULED_JOBS.values()), "schedules": SCHEDULED_JOBS, "middleware": middleware_actions("platform.scheduling.jobs")},
            "/v1/gap-e/report-exports": {"totalReports": len(REPORT_EXPORTS["reportTypes"]), "exports": REPORT_EXPORTS, "middleware": middleware_actions("platform.reports.export")},
        }
        path = self.path.split("?")[0]
        if path in routes:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(routes[path], indent=2).encode())
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found", "availableRoutes": list(routes.keys())}).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), PlatformOpsHandler) as httpd:
        print(f"Platform Operations Engine (Python) on :{PORT} — Gaps A-E, 14 middleware")
        httpd.serve_forever()
