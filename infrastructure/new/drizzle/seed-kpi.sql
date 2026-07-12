-- ═══════════════════════════════════════════════════════════════════════════════
-- 54Bank KPI Personnel Framework — Seed Data
-- Tables: kpi_roles, kpi_metrics, kpi_scores, kpi_composite_scores,
--         kpi_notification_rules, kpi_branches, kpi_hierarchy
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── KPI ROLES (11 banking roles) ───────────────────────────────────────────

INSERT INTO kpi_roles (role_key, title, department, level, reports_to, fixed_ratio, variable_ratio, description) VALUES
('ceo', 'Chief Executive Officer', 'Executive', 1, NULL, 60, 40, 'Strategic oversight — institutional health pulse'),
('coo', 'Chief Operating Officer', 'Operations', 2, 'ceo', 70, 30, 'Transaction throughput, settlement rates, platform uptime'),
('cro', 'Chief Risk Officer', 'Risk', 2, 'ceo', 75, 25, 'AML/CFT compliance, credit risk, NPL management'),
('cto', 'Chief Technology Officer', 'Technology', 2, 'ceo', 70, 30, 'Platform availability, API performance, security posture'),
('cso', 'Chief Security Officer', 'Security', 2, 'ceo', 75, 25, 'Cyber security, access control, threat prevention'),
('treasury', 'Treasury Manager', 'Treasury', 3, 'ceo', 70, 30, 'Liquidity management, FX exposure, interest margin'),
('credit', 'Head of Credit', 'Lending', 3, 'ceo', 65, 35, 'NPL ratio, collection rates, portfolio quality'),
('head_teller', 'Head Teller', 'Operations', 3, 'coo', 60, 40, 'Transaction speed, cash accuracy, customer wait times'),
('compliance', 'Compliance Officer', 'Risk', 3, 'cro', 80, 20, 'Regulatory filings, KYC completion, SAR timeliness'),
('customer_service', 'Customer Service Manager', 'Service', 3, 'ceo', 65, 35, 'Complaint resolution, FCR, customer retention'),
('internal_audit', 'Internal Auditor', 'Audit', 3, 'cro', 80, 20, 'Maker-checker compliance, audit trail completeness')
ON CONFLICT (role_key) DO NOTHING;

-- ─── KPI HIERARCHY ──────────────────────────────────────────────────────────

INSERT INTO kpi_hierarchy (parent_role_key, child_role_key, rollup_weight) VALUES
('ceo', 'coo', 1.0),
('ceo', 'cro', 1.0),
('ceo', 'cto', 1.0),
('ceo', 'cso', 1.0),
('ceo', 'treasury', 1.0),
('ceo', 'credit', 1.0),
('ceo', 'customer_service', 1.0),
('coo', 'head_teller', 1.0),
('cro', 'compliance', 1.0),
('cro', 'internal_audit', 1.0)
ON CONFLICT DO NOTHING;

-- ─── KPI METRICS (weighted per role) ────────────────────────────────────────

-- CEO metrics (weights sum to 1.0)
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('ceo_aum', 'ceo', 'Assets Under Management Growth', 'YoY AUM growth rate', 'financial', 'percent', 'higher_better', 0.15, 10, 5, 'monthly', 'accounts', 'SELECT SUM(balance) FROM accounts WHERE status = ''active'''),
('ceo_revenue', 'ceo', 'Revenue vs Budget', 'Monthly revenue achievement %', 'financial', 'percent', 'higher_better', 0.20, 95, 80, 'monthly', 'transactions', 'SELECT SUM(amount) FROM transactions WHERE type = ''fee'' AND created_at > NOW() - interval ''30 days'''),
('ceo_cir', 'ceo', 'Cost-to-Income Ratio', 'Operating efficiency metric', 'financial', 'percent', 'lower_better', 0.15, 55, 70, 'monthly', 'gl_entries', NULL),
('ceo_customer_growth', 'ceo', 'Customer Acquisition Rate', 'Net new customers per month', 'growth', 'count', 'higher_better', 0.10, 500, 200, 'monthly', 'customers', 'SELECT COUNT(*) FROM customers WHERE created_at > NOW() - interval ''30 days'''),
('ceo_car', 'ceo', 'Capital Adequacy Ratio', 'CBN regulatory minimum 10%', 'regulatory', 'percent', 'higher_better', 0.15, 15, 10, 'quarterly', 'capital_ratios', NULL),
('ceo_roe', 'ceo', 'Return on Equity', 'Shareholder value creation', 'financial', 'percent', 'higher_better', 0.10, 20, 12, 'quarterly', 'financial_statements', NULL),
('ceo_digital_adoption', 'ceo', 'Digital Channel Adoption', '% transactions via digital channels', 'operational', 'percent', 'higher_better', 0.10, 70, 50, 'monthly', 'transactions', 'SELECT COUNT(*) FILTER (WHERE channel IN (''mobile'',''web'',''ussd'')) * 100.0 / COUNT(*) FROM transactions'),
('ceo_npl', 'ceo', 'NPL Ratio', 'Non-performing loans percentage', 'risk', 'percent', 'lower_better', 0.05, 3, 5, 'monthly', 'loans', 'SELECT COUNT(*) FILTER (WHERE status = ''default'') * 100.0 / COUNT(*) FROM loans')
ON CONFLICT (metric_key) DO NOTHING;

-- COO metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('coo_tps', 'coo', 'Transactions Per Second', 'Peak throughput capacity', 'operational', 'count', 'higher_better', 0.20, 500, 200, 'hourly', 'transactions', 'SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - interval ''1 hour'''),
('coo_fail_rate', 'coo', 'Failed Transaction Rate', '% of failed transactions', 'operational', 'percent', 'lower_better', 0.25, 0.5, 2.0, 'hourly', 'transactions', 'SELECT COUNT(*) FILTER (WHERE status = ''failed'') * 100.0 / COUNT(*) FROM transactions WHERE created_at > NOW() - interval ''1 hour'''),
('coo_settlement', 'coo', 'Settlement Success Rate', 'End-of-day settlement completion', 'operational', 'percent', 'higher_better', 0.20, 99.5, 95, 'daily', 'settlements', NULL),
('coo_uptime', 'coo', 'Platform Uptime', '% availability in rolling 30 days', 'operational', 'percent', 'higher_better', 0.20, 99.9, 99.5, 'daily', 'health_checks', NULL),
('coo_queue', 'coo', 'Queue Depth', 'Pending transaction backlog', 'operational', 'count', 'lower_better', 0.10, 50, 200, 'hourly', 'message_queues', NULL),
('coo_latency', 'coo', 'P95 Response Latency', '95th percentile API latency ms', 'operational', 'milliseconds', 'lower_better', 0.05, 200, 500, 'hourly', 'api_metrics', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- CRO metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('cro_aml_alerts', 'cro', 'Unresolved AML Alerts', 'Pending high-risk alerts', 'risk', 'count', 'lower_better', 0.25, 5, 15, 'hourly', 'aml_alerts', 'SELECT COUNT(*) FROM aml_alerts WHERE risk_score >= 80 AND status = ''pending'''),
('cro_response_time', 'cro', 'Alert Response Time', 'Avg minutes to first action on alert', 'risk', 'minutes', 'lower_better', 0.20, 15, 60, 'hourly', 'aml_alerts', NULL),
('cro_sar_timeliness', 'cro', 'SAR Filing Timeliness', '% filed within 72hr regulatory window', 'regulatory', 'percent', 'higher_better', 0.20, 100, 90, 'daily', 'sar_reports', NULL),
('cro_false_positive', 'cro', 'False Positive Rate', '% alerts resolved as false positive', 'operational', 'percent', 'lower_better', 0.15, 20, 40, 'daily', 'aml_alerts', NULL),
('cro_npl', 'cro', 'Portfolio NPL Ratio', 'Non-performing loans vs total portfolio', 'risk', 'percent', 'lower_better', 0.20, 3, 5, 'daily', 'loans', 'SELECT COUNT(*) FILTER (WHERE days_past_due > 90) * 100.0 / COUNT(*) FROM loans')
ON CONFLICT (metric_key) DO NOTHING;

-- CTO metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('cto_api_p95', 'cto', 'API P95 Latency', '95th percentile response time', 'technology', 'milliseconds', 'lower_better', 0.20, 200, 500, 'hourly', 'api_metrics', NULL),
('cto_error_rate', 'cto', 'Error Rate (5xx)', 'Server error percentage', 'technology', 'percent', 'lower_better', 0.20, 0.1, 0.5, 'hourly', 'error_logs', NULL),
('cto_availability', 'cto', 'System Availability', '% uptime across all services', 'technology', 'percent', 'higher_better', 0.20, 99.95, 99.5, 'daily', 'health_checks', NULL),
('cto_deploy_success', 'cto', 'Deployment Success Rate', '% deployments without rollback', 'technology', 'percent', 'higher_better', 0.15, 95, 80, 'weekly', 'deployments', NULL),
('cto_pool_util', 'cto', 'DB Connection Pool', '% utilization of connection pool', 'technology', 'percent', 'lower_better', 0.10, 60, 85, 'hourly', 'db_metrics', NULL),
('cto_cache_hit', 'cto', 'Cache Hit Ratio', 'Redis cache effectiveness', 'technology', 'percent', 'higher_better', 0.15, 90, 70, 'hourly', 'redis_metrics', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- CSO metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('cso_incidents', 'cso', 'Active Security Incidents', 'Unresolved security incidents', 'security', 'count', 'lower_better', 0.25, 0, 2, 'hourly', 'security_incidents', NULL),
('cso_unauthorized', 'cso', 'Unauthorized Access Attempts', 'Failed auth in past hour', 'security', 'count', 'lower_better', 0.15, 10, 50, 'hourly', 'auth_logs', 'SELECT COUNT(*) FROM auth_logs WHERE success = false AND created_at > NOW() - interval ''1 hour'''),
('cso_vuln_critical', 'cso', 'Critical Vulnerabilities', 'Unpatched critical CVEs', 'security', 'count', 'lower_better', 0.20, 0, 3, 'daily', 'vulnerability_scans', NULL),
('cso_mfa_adoption', 'cso', 'MFA Adoption Rate', '% users with MFA enabled', 'security', 'percent', 'higher_better', 0.15, 95, 80, 'daily', 'users', NULL),
('cso_patch_compliance', 'cso', 'Patch Compliance', '% systems patched within SLA', 'security', 'percent', 'higher_better', 0.15, 95, 80, 'weekly', 'systems', NULL),
('cso_pentest_score', 'cso', 'Penetration Test Score', 'Last pentest overall score', 'security', 'percent', 'higher_better', 0.10, 90, 70, 'quarterly', 'pentest_reports', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Treasury metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('trs_liquidity', 'treasury', 'Liquidity Ratio', 'Liquid assets / short-term liabilities', 'treasury', 'percent', 'higher_better', 0.25, 30, 20, 'hourly', 'accounts', NULL),
('trs_crr', 'treasury', 'Cash Reserve Ratio', 'CBN regulatory CRR compliance', 'regulatory', 'percent', 'higher_better', 0.20, 27.5, 25, 'daily', 'reserves', NULL),
('trs_fx_exposure', 'treasury', 'FX Exposure vs Limit', '% of open FX position vs limit', 'treasury', 'percent', 'lower_better', 0.20, 70, 90, 'hourly', 'fx_positions', NULL),
('trs_nim', 'treasury', 'Net Interest Margin', 'Interest earned vs paid spread', 'financial', 'percent', 'higher_better', 0.20, 5, 3, 'monthly', 'interest_accruals', NULL),
('trs_nostro_recon', 'treasury', 'Nostro Reconciliation', '% accounts reconciled daily', 'operational', 'percent', 'higher_better', 0.15, 100, 95, 'daily', 'nostro_accounts', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Credit metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('crd_npl', 'credit', 'NPL Ratio', 'Non-performing loans / total loans', 'risk', 'percent', 'lower_better', 0.30, 3, 5, 'daily', 'loans', 'SELECT COUNT(*) FILTER (WHERE days_past_due > 90) * 100.0 / NULLIF(COUNT(*), 0) FROM loans'),
('crd_collection', 'credit', 'Collection Rate', '% of due payments collected', 'operational', 'percent', 'higher_better', 0.25, 95, 85, 'daily', 'loan_repayments', NULL),
('crd_turnaround', 'credit', 'Loan Turnaround Days', 'Avg days from application to disbursement', 'operational', 'days', 'lower_better', 0.20, 3, 7, 'daily', 'loan_applications', NULL),
('crd_par30', 'credit', 'PAR > 30 Days', 'Portfolio at risk beyond 30 days', 'risk', 'percent', 'lower_better', 0.15, 5, 10, 'daily', 'loans', NULL),
('crd_growth', 'credit', 'Portfolio Growth', 'Month-over-month loan book growth', 'growth', 'percent', 'higher_better', 0.10, 5, 2, 'monthly', 'loans', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Head Teller metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('htl_txn_per_hr', 'head_teller', 'Transactions Per Hour', 'Teller productivity', 'operational', 'count', 'higher_better', 0.25, 18, 12, 'hourly', 'teller_transactions', 'SELECT COUNT(*) / NULLIF(COUNT(DISTINCT teller_id), 0) FROM teller_transactions WHERE created_at > NOW() - interval ''1 hour'''),
('htl_cash_variance', 'head_teller', 'Cash Variance (NGN)', 'End-of-day cash discrepancy', 'risk', 'currency', 'lower_better', 0.25, 0, 10000, 'daily', 'cash_counts', NULL),
('htl_wait_time', 'head_teller', 'Customer Wait Time', 'Avg wait time in minutes', 'service', 'minutes', 'lower_better', 0.20, 5, 15, 'hourly', 'queue_management', NULL),
('htl_reversal_rate', 'head_teller', 'Reversal Rate', '% transactions reversed', 'operational', 'percent', 'lower_better', 0.15, 0.5, 2, 'daily', 'teller_transactions', NULL),
('htl_cross_sell', 'head_teller', 'Cross-Sell Ratio', 'Products sold per customer visit', 'growth', 'ratio', 'higher_better', 0.15, 1.5, 1.0, 'daily', 'product_sales', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Compliance metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('cmp_kyc_pending', 'compliance', 'Pending KYC Reviews', 'Customers awaiting KYC clearance', 'regulatory', 'count', 'lower_better', 0.20, 20, 50, 'daily', 'kyc_applications', 'SELECT COUNT(*) FROM kyc_applications WHERE status = ''pending'''),
('cmp_ctr_filing', 'compliance', 'CTR Filing Rate', '% CTRs filed within 24hr of trigger', 'regulatory', 'percent', 'higher_better', 0.25, 100, 90, 'daily', 'ctr_reports', NULL),
('cmp_sar_backlog', 'compliance', 'SAR Backlog', 'Overdue SAR filings', 'regulatory', 'count', 'lower_better', 0.25, 0, 3, 'daily', 'sar_reports', NULL),
('cmp_kyc_tier', 'compliance', 'KYC Tier Compliance', '% customers at correct KYC tier', 'regulatory', 'percent', 'higher_better', 0.15, 98, 90, 'weekly', 'customers', NULL),
('cmp_expired_docs', 'compliance', 'Expired ID Documents', 'Customers with expired identity docs', 'regulatory', 'count', 'lower_better', 0.15, 0, 20, 'daily', 'customer_documents', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Customer Service metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('cs_open_complaints', 'customer_service', 'Open Complaints', 'Unresolved customer complaints', 'service', 'count', 'lower_better', 0.20, 20, 50, 'daily', 'complaints', NULL),
('cs_response_time', 'customer_service', 'First Response Time', 'Avg minutes to first response', 'service', 'minutes', 'lower_better', 0.20, 30, 120, 'daily', 'complaints', NULL),
('cs_fcr', 'customer_service', 'First Contact Resolution', '% resolved on first interaction', 'service', 'percent', 'higher_better', 0.25, 80, 60, 'daily', 'complaints', NULL),
('cs_sla', 'customer_service', 'SLA Compliance', '% complaints resolved within SLA', 'service', 'percent', 'higher_better', 0.20, 95, 80, 'daily', 'complaints', NULL),
('cs_churn', 'customer_service', 'Customer Churn Rate', 'Monthly customer attrition %', 'growth', 'percent', 'lower_better', 0.15, 1, 3, 'monthly', 'customers', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- Internal Audit metrics
INSERT INTO kpi_metrics (metric_key, role_key, name, description, category, unit, direction, weight, green_threshold, amber_threshold, frequency, data_source, sql_query) VALUES
('aud_maker_checker', 'internal_audit', 'Maker-Checker Violations', 'Transactions without dual auth', 'risk', 'count', 'lower_better', 0.30, 0, 3, 'daily', 'audit_trail', NULL),
('aud_trail_completeness', 'internal_audit', 'Audit Trail Completeness', '% actions with full audit trail', 'regulatory', 'percent', 'higher_better', 0.25, 100, 95, 'daily', 'audit_trail', NULL),
('aud_exceptions', 'internal_audit', 'Exception Reports', 'Open audit exceptions', 'risk', 'count', 'lower_better', 0.20, 5, 15, 'weekly', 'audit_findings', NULL),
('aud_sod_violations', 'internal_audit', 'Segregation of Duties Violations', 'Users with conflicting roles', 'risk', 'count', 'lower_better', 0.15, 0, 2, 'weekly', 'user_roles', NULL),
('aud_gl_discrepancy', 'internal_audit', 'GL Reconciliation Discrepancy', 'Value of unreconciled GL entries (NGN)', 'financial', 'currency', 'lower_better', 0.10, 0, 100000, 'daily', 'gl_entries', NULL)
ON CONFLICT (metric_key) DO NOTHING;

-- ─── KPI SCORES (sample data — last 30 days daily) ─────────────────────────

-- Generate sample scores for key metrics
INSERT INTO kpi_scores (metric_key, role_key, value, normalized_score, status, cadence, period_start, period_end) VALUES
-- CEO scores
('ceo_revenue', 'ceo', 97.2, 97.2, 'green', 'daily', NOW() - interval '1 day', NOW()),
('ceo_aum', 'ceo', 12.5, 87.5, 'green', 'daily', NOW() - interval '1 day', NOW()),
('ceo_cir', 'ceo', 52.3, 92.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('ceo_customer_growth', 'ceo', 620, 90.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('ceo_npl', 'ceo', 3.2, 78.0, 'amber', 'daily', NOW() - interval '1 day', NOW()),
-- COO scores
('coo_tps', 'coo', 520, 92.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('coo_fail_rate', 'coo', 0.3, 95.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('coo_settlement', 'coo', 99.8, 99.8, 'green', 'daily', NOW() - interval '1 day', NOW()),
('coo_uptime', 'coo', 99.97, 99.97, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- CRO scores
('cro_aml_alerts', 'cro', 3, 88.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cro_response_time', 'cro', 12, 92.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cro_npl', 'cro', 3.5, 75.0, 'amber', 'daily', NOW() - interval '1 day', NOW()),
-- CTO scores
('cto_api_p95', 'cto', 145, 92.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cto_error_rate', 'cto', 0.05, 98.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cto_availability', 'cto', 99.97, 99.97, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- CSO scores
('cso_incidents', 'cso', 0, 100, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cso_unauthorized', 'cso', 7, 93.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('cso_mfa_adoption', 'cso', 94, 94.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Treasury scores
('trs_liquidity', 'treasury', 42.5, 95.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('trs_crr', 'treasury', 28.5, 90.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Credit scores
('crd_npl', 'credit', 3.5, 75.0, 'amber', 'daily', NOW() - interval '1 day', NOW()),
('crd_collection', 'credit', 96.2, 96.2, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Head Teller scores
('htl_txn_per_hr', 'head_teller', 18, 90.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
('htl_cash_variance', 'head_teller', 0, 100, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Compliance scores
('cmp_kyc_pending', 'compliance', 35, 70.0, 'amber', 'daily', NOW() - interval '1 day', NOW()),
('cmp_ctr_filing', 'compliance', 100, 100, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Customer Service scores
('cs_fcr', 'customer_service', 82, 82.0, 'amber', 'daily', NOW() - interval '1 day', NOW()),
('cs_open_complaints', 'customer_service', 12, 92.0, 'green', 'daily', NOW() - interval '1 day', NOW()),
-- Internal Audit scores
('aud_maker_checker', 'internal_audit', 0, 100, 'green', 'daily', NOW() - interval '1 day', NOW()),
('aud_trail_completeness', 'internal_audit', 100, 100, 'green', 'daily', NOW() - interval '1 day', NOW());

-- ─── KPI COMPOSITE SCORES ───────────────────────────────────────────────────

INSERT INTO kpi_composite_scores (role_key, own_score, rollup_score, composite_score, status, cadence, period_start, period_end, variable_pay_multiplier) VALUES
('ceo', 91.5, 88.2, 90.2, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.35),
('coo', 96.7, 90.0, 94.0, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.40),
('cro', 82.4, 85.0, 83.4, 'amber', 'daily', NOW() - interval '1 day', NOW(), 1.10),
('cto', 96.3, NULL, 96.3, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.45),
('cso', 95.7, NULL, 95.7, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.42),
('treasury', 92.5, NULL, 92.5, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.35),
('credit', 82.1, NULL, 82.1, 'amber', 'daily', NOW() - interval '1 day', NOW(), 1.08),
('head_teller', 95.0, NULL, 95.0, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.40),
('compliance', 85.0, NULL, 85.0, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.15),
('customer_service', 87.0, NULL, 87.0, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.20),
('internal_audit', 100.0, NULL, 100.0, 'green', 'daily', NOW() - interval '1 day', NOW(), 1.50);

-- ─── KPI NOTIFICATION RULES ────────────────────────────────────────────────

INSERT INTO kpi_notification_rules (rule_key, role_key, metric_key, condition, threshold_value, severity, channels, escalation_chain, cooldown_minutes, enabled, description) VALUES
('nr-001', 'cro', 'cro_aml_alerts', 'gt', 5, 'critical', '["kafka","email","sms","in_app"]', '["cro","ceo"]', 15, true, 'AML alerts exceeding safe threshold'),
('nr-002', 'cro', 'cro_npl', 'gt', 5.0, 'critical', '["kafka","email","in_app"]', '["credit","cro","ceo"]', 60, true, 'NPL ratio exceeds CBN maximum'),
('nr-003', 'cso', 'cso_incidents', 'gt', 0, 'critical', '["kafka","email","sms","push"]', '["cso","cto","ceo"]', 5, true, 'Security breach detected'),
('nr-004', 'coo', 'coo_fail_rate', 'gt', 1.0, 'warning', '["kafka","email","in_app"]', '["coo","cto"]', 30, true, 'Transaction failure rate above threshold'),
('nr-005', 'head_teller', 'htl_cash_variance', 'gt', 10000, 'critical', '["kafka","email","sms","in_app"]', '["head_teller","coo","internal_audit"]', 15, true, 'Cash discrepancy exceeds ₦10,000'),
('nr-006', 'compliance', 'cmp_sar_backlog', 'gt', 0, 'warning', '["kafka","email","in_app"]', '["compliance","cro"]', 60, true, 'Overdue SAR filings'),
('nr-007', 'cto', 'cto_error_rate', 'gt', 0.5, 'warning', '["kafka","email","in_app"]', '["cto","coo"]', 15, true, 'Server error rate exceeds threshold'),
('nr-008', 'treasury', 'trs_liquidity', 'lt', 30, 'critical', '["kafka","email","sms","push"]', '["treasury","ceo"]', 30, true, 'Liquidity below CBN minimum'),
('nr-009', 'cso', 'cso_unauthorized', 'gt', 20, 'warning', '["kafka","email","in_app"]', '["cso","cto"]', 15, true, 'Unauthorized access spike'),
('nr-010', 'customer_service', 'cs_open_complaints', 'gt', 50, 'warning', '["kafka","email","in_app"]', '["customer_service","coo"]', 60, true, 'Complaint backlog exceeds capacity'),
('nr-011', 'internal_audit', 'aud_maker_checker', 'gt', 0, 'critical', '["kafka","email","sms","in_app"]', '["internal_audit","cro","ceo"]', 5, true, 'Maker-checker violation'),
('nr-012', 'credit', 'crd_par30', 'gt', 10, 'warning', '["kafka","email","in_app"]', '["credit","cro"]', 1440, true, 'Portfolio at risk exceeds warning level')
ON CONFLICT (rule_key) DO NOTHING;

-- ─── KPI BRANCHES (20 Nigerian branches with geospatial data) ───────────────

INSERT INTO kpi_branches (branch_id, name, state, lga, latitude, longitude, revenue_ngn, transactions_daily, customers, npl_pct, deposits_ngn, status) VALUES
('BR-001', 'Lagos Island Main', 'Lagos', 'Lagos Island', 6.4541, 3.4082, 850000000, 2400, 15200, 2.1, 12500000000, 'green'),
('BR-002', 'Victoria Island', 'Lagos', 'Eti-Osa', 6.4281, 3.4219, 1200000000, 3100, 18500, 1.8, 18000000000, 'green'),
('BR-003', 'Ikeja GRA', 'Lagos', 'Ikeja', 6.5833, 3.3500, 620000000, 1800, 12000, 3.2, 8500000000, 'green'),
('BR-004', 'Lekki Phase 1', 'Lagos', 'Eti-Osa', 6.4474, 3.4734, 950000000, 2200, 14000, 2.5, 14000000000, 'green'),
('BR-005', 'Abuja Central', 'FCT', 'Municipal', 9.0579, 7.4951, 780000000, 2000, 11000, 2.8, 10500000000, 'green'),
('BR-006', 'Garki Area 11', 'FCT', 'Garki', 9.0227, 7.4880, 450000000, 1200, 8500, 3.5, 6000000000, 'amber'),
('BR-007', 'Wuse Zone 5', 'FCT', 'Wuse', 9.0765, 7.4892, 520000000, 1500, 9200, 2.9, 7200000000, 'green'),
('BR-008', 'Port Harcourt Main', 'Rivers', 'Port Harcourt', 4.8156, 7.0498, 380000000, 1100, 7800, 4.2, 5200000000, 'amber'),
('BR-009', 'Kano City Gate', 'Kano', 'Nassarawa', 12.0022, 8.5920, 290000000, 950, 6500, 5.8, 3800000000, 'red'),
('BR-010', 'Ibadan Ring Road', 'Oyo', 'Ibadan North', 7.3776, 3.9470, 320000000, 1000, 7200, 3.5, 4500000000, 'green'),
('BR-011', 'Enugu Main', 'Enugu', 'Enugu North', 6.4584, 7.5464, 280000000, 850, 5800, 3.8, 3500000000, 'amber'),
('BR-012', 'Benin City', 'Edo', 'Oredo', 6.3350, 5.6037, 310000000, 900, 6100, 4.0, 4000000000, 'amber'),
('BR-013', 'Kaduna Central', 'Kaduna', 'Kaduna North', 10.5105, 7.4165, 260000000, 780, 5500, 4.5, 3200000000, 'amber'),
('BR-014', 'Owerri Main', 'Imo', 'Owerri Municipal', 5.4836, 7.0333, 240000000, 720, 5000, 3.2, 2800000000, 'green'),
('BR-015', 'Calabar Marina', 'Cross River', 'Calabar Municipal', 4.9517, 8.3220, 180000000, 550, 4200, 3.0, 2200000000, 'green'),
('BR-016', 'Jos Terminus', 'Plateau', 'Jos North', 9.8965, 8.8583, 195000000, 600, 4500, 4.8, 2400000000, 'amber'),
('BR-017', 'Abeokuta Kuto', 'Ogun', 'Abeokuta South', 7.1475, 3.3619, 270000000, 820, 5600, 3.1, 3400000000, 'green'),
('BR-018', 'Warri Effurun', 'Delta', 'Uvwie', 5.5544, 5.7812, 350000000, 980, 6800, 4.1, 4800000000, 'amber'),
('BR-019', 'Uyo Ikot Ekpene Rd', 'Akwa Ibom', 'Uyo', 5.0377, 7.9128, 220000000, 650, 4800, 2.9, 2600000000, 'green'),
('BR-020', 'Maiduguri GRA', 'Borno', 'Maiduguri', 11.8469, 13.1600, 150000000, 420, 3200, 6.2, 1800000000, 'red')
ON CONFLICT (branch_id) DO NOTHING;
