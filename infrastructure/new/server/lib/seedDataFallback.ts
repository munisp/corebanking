/**
 * Seed Data Fallback Registry — provides realistic Nigerian banking seed data
 * for ALL API routes so pages never show 503 errors when microservices are down.
 * Data is served inline by the Express server with no external dependency.
 * Also provides full CRUD (POST/PUT/DELETE) for all routes.
 */
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";

// In-memory stores for CRUD operations
const stores = new Map<string, unknown[]>();

// ── Helper to register full CRUD handlers ──
function reg(app: Express, path: string, data: unknown[]) {
  stores.set(path, [...data]);

  app.get(path, (_: Request, res: Response) => {
    const items = stores.get(path) ?? [];
    res.json({ items, total: items.length });
  });

  app.post(path, (req: Request, res: Response) => {
    const items = stores.get(path) ?? [];
    const record = { id: `REC-${randomUUID().slice(0, 8).toUpperCase()}`, ...req.body, createdAt: new Date().toISOString() };
    items.push(record);
    stores.set(path, items);
    res.status(201).json(record);
  });

  app.put(`${path}/:id`, (req: Request, res: Response) => {
    const items = stores.get(path) ?? [];
    const idx = items.findIndex((r: any) => r.id === req.params.id);
    if (idx >= 0) {
      items[idx] = { ...items[idx] as object, ...req.body, updatedAt: new Date().toISOString() };
      stores.set(path, items);
      res.json(items[idx]);
    } else {
      res.status(404).json({ error: "Record not found" });
    }
  });

  app.delete(`${path}/:id`, (req: Request, res: Response) => {
    const items = stores.get(path) ?? [];
    const filtered = items.filter((r: any) => r.id !== req.params.id);
    stores.set(path, filtered);
    res.json({ success: true, deleted: req.params.id });
  });
}

// ── Helper to register a GET handler returning a stats object ──
function regStats(app: Express, path: string, stats: Record<string, unknown>) {
  app.get(path, (_: Request, res: Response) => {
    res.json(stats);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SEED DATA — Realistic Nigerian Banking Data
// ═══════════════════════════════════════════════════════════════════

const securityPolicies = [
  { id: "SP-001", name: "Zero Trust Architecture", category: "Network", severity: "critical", enforced: true, autoRemediate: true, description: "Enforce zero trust across all network segments", lastAudit: "2026-05-01", complianceFramework: "ISO-27001" },
  { id: "SP-002", name: "Data Encryption at Rest", category: "Data", severity: "critical", enforced: true, autoRemediate: false, description: "AES-256 encryption for all stored data", lastAudit: "2026-04-28", complianceFramework: "PCI-DSS" },
  { id: "SP-003", name: "Multi-Factor Authentication", category: "Identity", severity: "high", enforced: true, autoRemediate: true, description: "Enforce MFA for all admin and privileged access", lastAudit: "2026-05-02", complianceFramework: "CBN-RMFB" },
  { id: "SP-004", name: "API Rate Limiting", category: "Application", severity: "high", enforced: true, autoRemediate: true, description: "Rate limit all public API endpoints", lastAudit: "2026-04-30", complianceFramework: "OWASP" },
  { id: "SP-005", name: "Database Access Control", category: "Data", severity: "critical", enforced: true, autoRemediate: false, description: "Role-based database access with audit logging", lastAudit: "2026-05-03", complianceFramework: "SOC2" },
  { id: "SP-006", name: "TLS 1.3 Enforcement", category: "Network", severity: "high", enforced: true, autoRemediate: true, description: "Enforce TLS 1.3 for all communications", lastAudit: "2026-04-25", complianceFramework: "NIST-800-53" },
  { id: "SP-007", name: "Container Image Scanning", category: "Infrastructure", severity: "medium", enforced: true, autoRemediate: true, description: "Scan all container images before deployment", lastAudit: "2026-05-01", complianceFramework: "CIS-Benchmark" },
  { id: "SP-008", name: "Secret Rotation Policy", category: "Identity", severity: "high", enforced: true, autoRemediate: true, description: "Rotate all secrets and keys every 90 days", lastAudit: "2026-04-20", complianceFramework: "ISO-27001" },
  { id: "SP-009", name: "WAF Protection", category: "Application", severity: "high", enforced: true, autoRemediate: true, description: "Web Application Firewall for all public endpoints", lastAudit: "2026-05-04", complianceFramework: "OWASP" },
  { id: "SP-010", name: "Intrusion Detection System", category: "Network", severity: "critical", enforced: true, autoRemediate: false, description: "Real-time intrusion detection and alerting", lastAudit: "2026-04-29", complianceFramework: "NIST-800-53" },
  { id: "SP-011", name: "NDPR Data Protection", category: "Compliance", severity: "critical", enforced: true, autoRemediate: false, description: "Nigeria Data Protection Regulation compliance", lastAudit: "2026-05-02", complianceFramework: "NDPR" },
  { id: "SP-012", name: "CBN Cybersecurity Framework", category: "Compliance", severity: "critical", enforced: true, autoRemediate: false, description: "Central Bank of Nigeria cybersecurity guidelines", lastAudit: "2026-05-01", complianceFramework: "CBN-RMFB" },
  { id: "SP-013", name: "Log Retention Policy", category: "Audit", severity: "medium", enforced: true, autoRemediate: true, description: "Retain audit logs for minimum 7 years per CBN", lastAudit: "2026-04-15", complianceFramework: "CBN-RMFB" },
  { id: "SP-014", name: "Endpoint Detection Response", category: "Endpoint", severity: "high", enforced: true, autoRemediate: true, description: "EDR on all workstations and servers", lastAudit: "2026-05-03", complianceFramework: "CIS-Benchmark" },
  { id: "SP-015", name: "DDoS Mitigation", category: "Network", severity: "critical", enforced: true, autoRemediate: true, description: "Multi-layer DDoS protection", lastAudit: "2026-05-04", complianceFramework: "ISO-27001" },
];

const ddosRules = [
  { id: "DDOS-001", name: "TCP SYN Flood Protection", type: "volumetric", threshold: 50000, action: "block", enabled: true, mitigationRate: 100, region: "Lagos", lastTriggered: "2026-05-09T10:30:00Z" },
  { id: "DDOS-002", name: "HTTP Flood Detection", type: "application", threshold: 10000, action: "rate_limit", enabled: true, mitigationRate: 100, region: "All", lastTriggered: "2026-05-08T14:20:00Z" },
  { id: "DDOS-003", name: "DNS Amplification Block", type: "protocol", threshold: 25000, action: "block", enabled: true, mitigationRate: 100, region: "All", lastTriggered: "2026-05-07T08:45:00Z" },
  { id: "DDOS-004", name: "OFAC Geo-Block Iran", type: "geo_block", threshold: 0, action: "block", enabled: true, mitigationRate: 100, region: "IR", lastTriggered: "2026-05-06T16:00:00Z" },
  { id: "DDOS-005", name: "OFAC Geo-Block North Korea", type: "geo_block", threshold: 0, action: "block", enabled: true, mitigationRate: 100, region: "KP", lastTriggered: "2026-05-05T12:00:00Z" },
  { id: "DDOS-006", name: "OFAC Geo-Block Syria", type: "geo_block", threshold: 0, action: "block", enabled: true, mitigationRate: 100, region: "SY", lastTriggered: "2026-05-04T09:00:00Z" },
  { id: "DDOS-007", name: "OFAC Geo-Block Cuba", type: "geo_block", threshold: 0, action: "block", enabled: true, mitigationRate: 100, region: "CU", lastTriggered: "2026-05-03T11:00:00Z" },
  { id: "DDOS-008", name: "Slowloris Detection", type: "application", threshold: 500, action: "block", enabled: true, mitigationRate: 100, region: "All", lastTriggered: "2026-05-02T15:30:00Z" },
];

const swiftMessages = [
  { id: "SW-001", messageType: "MT103", direction: "outbound", sender: "ABORNGLA", receiver: "CITIUS33", amount: 5000000, currency: "USD", status: "delivered", beneficiary: "Dangote Industries Ltd", valueDate: "2026-05-09", reference: "FT26129001" },
  { id: "SW-002", messageType: "MT202", direction: "outbound", sender: "ABORNGLA", receiver: "BABOROBB", amount: 25000000, currency: "NGN", status: "delivered", beneficiary: "BUA Group Plc", valueDate: "2026-05-09", reference: "FT26129002" },
  { id: "SW-003", messageType: "MT700", direction: "inbound", sender: "SCBLSGSG", receiver: "ABOLNGLA", amount: 12000000, currency: "USD", status: "acknowledged", beneficiary: "GTBank Nigeria", valueDate: "2026-05-10", reference: "LC26129003" },
  { id: "SW-004", messageType: "MT760", direction: "outbound", sender: "ABOLNGLA", receiver: "DEUTDEFF", amount: 8000000, currency: "EUR", status: "delivered", beneficiary: "Guaranty Trust Holding", valueDate: "2026-05-11", reference: "GT26129004" },
  { id: "SW-005", messageType: "MT940", direction: "inbound", sender: "CIABORNGLA", receiver: "ABOLNGLA", amount: 0, currency: "NGN", status: "processed", beneficiary: "Statement Request", valueDate: "2026-05-09", reference: "ST26129005" },
  { id: "SW-006", messageType: "pacs.008", direction: "outbound", sender: "ABOLNGLA", receiver: "ABORNGLA", amount: 3500000, currency: "USD", status: "settled", beneficiary: "Access Bank Nigeria", valueDate: "2026-05-09", reference: "ISO26129006" },
  { id: "SW-007", messageType: "camt.053", direction: "inbound", sender: "SCBLSGSG", receiver: "ABOLNGLA", amount: 0, currency: "NGN", status: "processed", beneficiary: "End of Day Statement", valueDate: "2026-05-09", reference: "ISO26129007" },
  { id: "SW-008", messageType: "MT199", direction: "outbound", sender: "ABOLNGLA", receiver: "CITIUS33", amount: 0, currency: "USD", status: "delivered", beneficiary: "Free Format Message", valueDate: "2026-05-09", reference: "FF26129008" },
];

const pbacPolicies = [
  { id: "PBAC-001", name: "Admin Full Access", resource: "*", action: "*", effect: "allow", subject: "role:admin", conditions: "none", priority: 1, enforced: true, tenant: "all" },
  { id: "PBAC-002", name: "Teller Transaction Limit", resource: "transactions", action: "create", effect: "allow", subject: "role:teller", conditions: "amount <= 5000000", priority: 2, enforced: true, tenant: "all" },
  { id: "PBAC-003", name: "Cross-Tenant Isolation", resource: "tenant_data", action: "read", effect: "deny", subject: "tenant:*", conditions: "tenant_id != request.tenant_id", priority: 0, enforced: true, tenant: "all" },
  { id: "PBAC-004", name: "After Hours Restriction", resource: "high_value_transfers", action: "create", effect: "deny", subject: "role:officer", conditions: "time.hour < 8 || time.hour > 18", priority: 3, enforced: true, tenant: "all" },
  { id: "PBAC-005", name: "Geo-Location Block", resource: "api", action: "*", effect: "deny", subject: "ip:*", conditions: "geo.country in ['IR','KP','SY']", priority: 0, enforced: true, tenant: "all" },
  { id: "PBAC-006", name: "Auditor Read Only", resource: "*", action: "read", effect: "allow", subject: "role:auditor", conditions: "none", priority: 5, enforced: true, tenant: "all" },
  { id: "PBAC-007", name: "Branch Manager Approval", resource: "loans", action: "approve", effect: "allow", subject: "role:branch_manager", conditions: "amount <= 50000000", priority: 4, enforced: true, tenant: "all" },
  { id: "PBAC-008", name: "Customer Self-Service", resource: "own_accounts", action: "read", effect: "allow", subject: "role:customer", conditions: "account.owner_id == user.id", priority: 6, enforced: true, tenant: "all" },
  { id: "PBAC-009", name: "Compliance Officer Access", resource: "kyc,aml,sar", action: "*", effect: "allow", subject: "role:compliance_officer", conditions: "none", priority: 3, enforced: true, tenant: "all" },
  { id: "PBAC-010", name: "API Rate Limit", resource: "api", action: "*", effect: "deny", subject: "api_key:*", conditions: "rate > 1000/min", priority: 1, enforced: true, tenant: "all" },
];

const branches = [
  { id: "BR-001", name: "Lagos Marina Branch", code: "LAG-MRN", state: "Lagos", lga: "Lagos Island", address: "25 Marina Road, Lagos Island", manager: "Adebayo Ogunlesi", status: "active", tier: "flagship", employees: 45, dailyTransactions: 2500, vaultBalance: 850000000, atmCount: 4 },
  { id: "BR-002", name: "Abuja Central Branch", code: "ABJ-CTR", state: "FCT", lga: "Municipal", address: "12 Aguiyi Ironsi Street, Maitama", manager: "Amina Bello", status: "active", tier: "premium", employees: 38, dailyTransactions: 2100, vaultBalance: 720000000, atmCount: 3 },
  { id: "BR-003", name: "Kano Nassarawa Branch", code: "KAN-NAS", state: "Kano", lga: "Nassarawa", address: "45 Bello Road, Nassarawa", manager: "Ibrahim Danladi", status: "active", tier: "standard", employees: 22, dailyTransactions: 1200, vaultBalance: 350000000, atmCount: 2 },
  { id: "BR-004", name: "Port Harcourt GRA Branch", code: "PHC-GRA", state: "Rivers", lga: "Port Harcourt", address: "8 Aba Road, GRA Phase 2", manager: "Emeka Okafor", status: "active", tier: "premium", employees: 30, dailyTransactions: 1800, vaultBalance: 550000000, atmCount: 3 },
  { id: "BR-005", name: "Enugu Independence Layout", code: "ENU-IND", state: "Enugu", lga: "Enugu North", address: "15 Okpara Avenue, Independence Layout", manager: "Chidinma Eze", status: "active", tier: "standard", employees: 18, dailyTransactions: 800, vaultBalance: 250000000, atmCount: 2 },
  { id: "BR-006", name: "Ibadan Challenge Branch", code: "IBD-CHL", state: "Oyo", lga: "Ibadan South West", address: "102 Ring Road, Challenge", manager: "Folake Adeyemi", status: "active", tier: "standard", employees: 20, dailyTransactions: 950, vaultBalance: 280000000, atmCount: 2 },
];

const glAccounts = [
  { id: "GL-1000", code: "1000", name: "Cash and Bank Balances", type: "asset", subType: "current_asset", balance: 45000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-1100", code: "1100", name: "Placements with Banks", type: "asset", subType: "current_asset", balance: 120000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-1200", code: "1200", name: "Loans and Advances", type: "asset", subType: "non_current_asset", balance: 350000000000, currency: "NGN", status: "active", department: "Credit", lastPosted: "2026-05-09" },
  { id: "GL-1300", code: "1300", name: "Investment Securities", type: "asset", subType: "non_current_asset", balance: 85000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-1400", code: "1400", name: "Fixed Assets", type: "asset", subType: "non_current_asset", balance: 25000000000, currency: "NGN", status: "active", department: "Operations", lastPosted: "2026-05-08" },
  { id: "GL-1500", code: "1500", name: "Other Assets", type: "asset", subType: "current_asset", balance: 15000000000, currency: "NGN", status: "active", department: "Finance", lastPosted: "2026-05-09" },
  { id: "GL-2000", code: "2000", name: "Customer Deposits", type: "liability", subType: "current_liability", balance: 380000000000, currency: "NGN", status: "active", department: "Retail", lastPosted: "2026-05-09" },
  { id: "GL-2100", code: "2100", name: "Due to Other Banks", type: "liability", subType: "current_liability", balance: 45000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-2200", code: "2200", name: "Borrowings", type: "liability", subType: "non_current_liability", balance: 60000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-08" },
  { id: "GL-2300", code: "2300", name: "Other Liabilities", type: "liability", subType: "current_liability", balance: 18000000000, currency: "NGN", status: "active", department: "Finance", lastPosted: "2026-05-09" },
  { id: "GL-3000", code: "3000", name: "Share Capital", type: "equity", subType: "equity", balance: 50000000000, currency: "NGN", status: "active", department: "Finance", lastPosted: "2026-04-30" },
  { id: "GL-3100", code: "3100", name: "Retained Earnings", type: "equity", subType: "equity", balance: 62000000000, currency: "NGN", status: "active", department: "Finance", lastPosted: "2026-04-30" },
  { id: "GL-3200", code: "3200", name: "Reserves", type: "equity", subType: "equity", balance: 25000000000, currency: "NGN", status: "active", department: "Finance", lastPosted: "2026-04-30" },
  { id: "GL-4000", code: "4000", name: "Interest Income", type: "revenue", subType: "revenue", balance: 42000000000, currency: "NGN", status: "active", department: "Credit", lastPosted: "2026-05-09" },
  { id: "GL-4100", code: "4100", name: "Fee and Commission Income", type: "revenue", subType: "revenue", balance: 18000000000, currency: "NGN", status: "active", department: "Operations", lastPosted: "2026-05-09" },
  { id: "GL-4200", code: "4200", name: "Trading Income", type: "revenue", subType: "revenue", balance: 8000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-5000", code: "5000", name: "Interest Expense", type: "expense", subType: "expense", balance: 22000000000, currency: "NGN", status: "active", department: "Treasury", lastPosted: "2026-05-09" },
  { id: "GL-5100", code: "5100", name: "Operating Expenses", type: "expense", subType: "expense", balance: 15000000000, currency: "NGN", status: "active", department: "Operations", lastPosted: "2026-05-09" },
];

const microfinanceGroups = [
  { id: "MFG-001", name: "Aso Rock Women Cooperative", type: "solidarity", members: 25, location: "Abuja, FCT", status: "active", savingsBalance: 15000000, loanOutstanding: 35000000, repaymentRate: 97.5, meetingDay: "Monday", officer: "Fatima Ahmed" },
  { id: "MFG-002", name: "Lagos Market Traders Union", type: "cooperative", members: 50, location: "Oshodi, Lagos", status: "active", savingsBalance: 45000000, loanOutstanding: 80000000, repaymentRate: 94.2, meetingDay: "Wednesday", officer: "Bola Tinubu-Ayoola" },
  { id: "MFG-003", name: "Kano Farmers Alliance", type: "village_banking", members: 30, location: "Dawakin Kudu, Kano", status: "active", savingsBalance: 8000000, loanOutstanding: 22000000, repaymentRate: 96.0, meetingDay: "Thursday", officer: "Musa Abdullahi" },
  { id: "MFG-004", name: "Enugu Artisans Guild", type: "solidarity", members: 20, location: "Nsukka, Enugu", status: "active", savingsBalance: 12000000, loanOutstanding: 28000000, repaymentRate: 93.8, meetingDay: "Tuesday", officer: "Chukwuemeka Obi" },
  { id: "MFG-005", name: "Rivers Fish Farmers Coop", type: "cooperative", members: 35, location: "Bonny Island, Rivers", status: "forming", savingsBalance: 3000000, loanOutstanding: 0, repaymentRate: 0, meetingDay: "Friday", officer: "Tamuno George" },
];

const offlineCapabilities = [
  { id: "OFL-001", name: "Offline Transaction Queue", type: "sync_queue", status: "active", pendingItems: 0, lastSync: "2026-05-09T15:00:00Z", strategy: "CRDT", conflictResolution: "last-write-wins", maxQueueSize: 10000 },
  { id: "OFL-002", name: "Lagos Urban Profile", type: "connectivity_profile", status: "active", avgLatency: 45, bandwidth: "4G/LTE", reliability: 99.2, offlineWindow: "< 5 min", region: "Lagos" },
  { id: "OFL-003", name: "Abuja Suburban Profile", type: "connectivity_profile", status: "active", avgLatency: 120, bandwidth: "3G", reliability: 95.0, offlineWindow: "15-30 min", region: "FCT" },
  { id: "OFL-004", name: "Kano Semi-Urban Profile", type: "connectivity_profile", status: "active", avgLatency: 250, bandwidth: "2G/EDGE", reliability: 85.0, offlineWindow: "1-2 hours", region: "Kano" },
  { id: "OFL-005", name: "Rural Borno Profile", type: "connectivity_profile", status: "active", avgLatency: 800, bandwidth: "USSD-only", reliability: 60.0, offlineWindow: "4-8 hours", region: "Borno" },
  { id: "OFL-006", name: "Island Network Profile", type: "connectivity_profile", status: "active", avgLatency: 400, bandwidth: "Satellite", reliability: 70.0, offlineWindow: "2-4 hours", region: "Bonny Island" },
  { id: "OFL-007", name: "USSD Fallback Gateway", type: "fallback_channel", status: "active", pendingItems: 0, lastSync: "2026-05-09T14:55:00Z", strategy: "store_and_forward", conflictResolution: "server-wins", maxQueueSize: 5000 },
  { id: "OFL-008", name: "SMS Transaction Channel", type: "fallback_channel", status: "active", pendingItems: 0, lastSync: "2026-05-09T15:01:00Z", strategy: "idempotent_retry", conflictResolution: "server-wins", maxQueueSize: 2000 },
];

const regulatoryReturns = [
  { id: "REG-001", returnType: "CBN eFASS", framework: "CBN", frequency: "monthly", dueDate: "2026-06-15", status: "filed", completeness: 100, lastGenerated: "2026-05-05T08:00:00Z", reviewer: "Olufemi Adeyeye" },
  { id: "REG-002", returnType: "NDIC Premium Assessment", framework: "NDIC", frequency: "quarterly", dueDate: "2026-07-31", status: "draft", completeness: 75, lastGenerated: "2026-05-08T10:00:00Z", reviewer: "Ngozi Okonkwo" },
  { id: "REG-003", returnType: "Basel III LCR", framework: "Basel_III", frequency: "daily", dueDate: "2026-05-10", status: "filed", completeness: 100, lastGenerated: "2026-05-09T06:00:00Z", reviewer: "Automated" },
  { id: "REG-004", returnType: "Basel III NSFR", framework: "Basel_III", frequency: "monthly", dueDate: "2026-06-10", status: "pending", completeness: 40, lastGenerated: "2026-05-08T12:00:00Z", reviewer: "Abubakar Mohammed" },
  { id: "REG-005", returnType: "Currency Transaction Report", framework: "NFIU", frequency: "daily", dueDate: "2026-05-10", status: "filed", completeness: 100, lastGenerated: "2026-05-09T07:00:00Z", reviewer: "Automated" },
  { id: "REG-006", returnType: "Suspicious Transaction Report", framework: "NFIU", frequency: "ad-hoc", dueDate: "N/A", status: "filed", completeness: 100, lastGenerated: "2026-05-07T14:00:00Z", reviewer: "Compliance Unit" },
  { id: "REG-007", returnType: "Withholding Tax Return", framework: "FIRS", frequency: "monthly", dueDate: "2026-06-21", status: "pending", completeness: 30, lastGenerated: "2026-05-08T09:00:00Z", reviewer: "Tax Department" },
  { id: "REG-008", returnType: "BOFIA Annual Report", framework: "CBN", frequency: "annual", dueDate: "2026-12-31", status: "draft", completeness: 15, lastGenerated: "2026-05-01T08:00:00Z", reviewer: "Finance Department" },
];

const approvalChains = [
  { id: "AC-001", name: "High Value Transfer Approval", type: "maker_checker", steps: 3, slaHours: 4, escalationPolicy: "auto_escalate", status: "active", currentRequests: 5, completedToday: 12, avgCompletionMinutes: 45 },
  { id: "AC-002", name: "Loan Disbursement Chain", type: "sequential", steps: 4, slaHours: 24, escalationPolicy: "notify_manager", status: "active", currentRequests: 8, completedToday: 3, avgCompletionMinutes: 180 },
  { id: "AC-003", name: "Account Opening Verification", type: "parallel", steps: 2, slaHours: 2, escalationPolicy: "auto_escalate", status: "active", currentRequests: 15, completedToday: 45, avgCompletionMinutes: 25 },
  { id: "AC-004", name: "Card Issuance Approval", type: "maker_checker", steps: 2, slaHours: 8, escalationPolicy: "notify_manager", status: "active", currentRequests: 3, completedToday: 8, avgCompletionMinutes: 60 },
  { id: "AC-005", name: "Regulatory Filing Sign-Off", type: "sequential", steps: 5, slaHours: 48, escalationPolicy: "escalate_to_cco", status: "active", currentRequests: 2, completedToday: 1, avgCompletionMinutes: 360 },
];

const eventTopics = [
  { id: "EVT-001", name: "account.opened", partitions: 12, replicationFactor: 3, messagesPerSec: 150, consumers: 4, status: "active", retentionDays: 30, dlqSize: 0 },
  { id: "EVT-002", name: "transaction.completed", partitions: 24, replicationFactor: 3, messagesPerSec: 2500, consumers: 8, status: "active", retentionDays: 90, dlqSize: 2 },
  { id: "EVT-003", name: "kyc.verified", partitions: 6, replicationFactor: 3, messagesPerSec: 50, consumers: 3, status: "active", retentionDays: 365, dlqSize: 0 },
  { id: "EVT-004", name: "loan.disbursed", partitions: 12, replicationFactor: 3, messagesPerSec: 80, consumers: 5, status: "active", retentionDays: 90, dlqSize: 0 },
  { id: "EVT-005", name: "card.issued", partitions: 6, replicationFactor: 3, messagesPerSec: 30, consumers: 2, status: "active", retentionDays: 30, dlqSize: 0 },
  { id: "EVT-006", name: "fraud.detected", partitions: 12, replicationFactor: 3, messagesPerSec: 15, consumers: 6, status: "active", retentionDays: 365, dlqSize: 1 },
  { id: "EVT-007", name: "compliance.alert", partitions: 6, replicationFactor: 3, messagesPerSec: 10, consumers: 3, status: "active", retentionDays: 365, dlqSize: 0 },
  { id: "EVT-008", name: "swift.message.sent", partitions: 6, replicationFactor: 3, messagesPerSec: 25, consumers: 2, status: "active", retentionDays: 90, dlqSize: 0 },
  { id: "EVT-009", name: "agent.transaction", partitions: 12, replicationFactor: 3, messagesPerSec: 500, consumers: 4, status: "active", retentionDays: 30, dlqSize: 0 },
  { id: "EVT-010", name: "billing.metered", partitions: 6, replicationFactor: 3, messagesPerSec: 200, consumers: 3, status: "active", retentionDays: 90, dlqSize: 0 },
  { id: "EVT-011", name: "audit.trail", partitions: 12, replicationFactor: 3, messagesPerSec: 1000, consumers: 2, status: "active", retentionDays: 2555, dlqSize: 0 },
  { id: "EVT-012", name: "notification.sent", partitions: 6, replicationFactor: 3, messagesPerSec: 300, consumers: 2, status: "active", retentionDays: 7, dlqSize: 3 },
  { id: "EVT-013", name: "tenant.provisioned", partitions: 3, replicationFactor: 3, messagesPerSec: 1, consumers: 5, status: "active", retentionDays: 365, dlqSize: 0 },
  { id: "EVT-014", name: "feature.flag.toggled", partitions: 3, replicationFactor: 3, messagesPerSec: 5, consumers: 8, status: "active", retentionDays: 90, dlqSize: 0 },
  { id: "EVT-015", name: "payment.initiated", partitions: 24, replicationFactor: 3, messagesPerSec: 1500, consumers: 6, status: "active", retentionDays: 90, dlqSize: 1 },
  { id: "EVT-016", name: "settlement.batch", partitions: 6, replicationFactor: 3, messagesPerSec: 10, consumers: 3, status: "active", retentionDays: 365, dlqSize: 0 },
];

const featureFlags = [
  { id: "FF-001", name: "instant_card_issuance", description: "Enable instant virtual card generation", enabled: true, rolloutPercent: 100, targetSegment: "all", killSwitch: false, createdBy: "Product Team", lastModified: "2026-05-01" },
  { id: "FF-002", name: "ai_fraud_scoring_v2", description: "ML-based fraud scoring model v2", enabled: true, rolloutPercent: 75, targetSegment: "tier_1_banks", killSwitch: false, createdBy: "Risk Engineering", lastModified: "2026-04-28" },
  { id: "FF-003", name: "open_banking_psd2", description: "PSD2 Open Banking API compliance", enabled: true, rolloutPercent: 50, targetSegment: "commercial_banks", killSwitch: false, createdBy: "Compliance Team", lastModified: "2026-04-25" },
  { id: "FF-004", name: "ussd_offline_mode", description: "USSD fallback for offline transactions", enabled: true, rolloutPercent: 100, targetSegment: "agent_banking", killSwitch: false, createdBy: "Channel Team", lastModified: "2026-05-05" },
  { id: "FF-005", name: "cryptocurrency_custody", description: "Digital asset custody service", enabled: false, rolloutPercent: 0, targetSegment: "none", killSwitch: true, createdBy: "Treasury Team", lastModified: "2026-03-15" },
  { id: "FF-006", name: "biometric_login", description: "Fingerprint and facial recognition login", enabled: true, rolloutPercent: 80, targetSegment: "retail", killSwitch: false, createdBy: "Security Team", lastModified: "2026-04-20" },
  { id: "FF-007", name: "real_time_fx_engine", description: "Real-time FX rate engine with auto-hedging", enabled: true, rolloutPercent: 60, targetSegment: "treasury", killSwitch: false, createdBy: "Treasury Team", lastModified: "2026-05-03" },
  { id: "FF-008", name: "green_banking_carbon", description: "Carbon offset tracking for banking operations", enabled: true, rolloutPercent: 30, targetSegment: "pilot", killSwitch: false, createdBy: "ESG Team", lastModified: "2026-04-10" },
];

const plugins = [
  { id: "PLG-001", name: "CBN eFASS Connector", version: "2.1.0", category: "regulatory", status: "active", installs: 45, rating: 4.8, author: "54Bank Core", lastUpdated: "2026-05-01", description: "Automated CBN electronic Financial Analysis and Surveillance System submission" },
  { id: "PLG-002", name: "NIBSS Instant Pay", version: "3.0.1", category: "payments", status: "active", installs: 120, rating: 4.9, author: "54Bank Core", lastUpdated: "2026-04-28", description: "NIBSS Instant Payment integration for real-time transfers" },
  { id: "PLG-003", name: "Flutterwave Gateway", version: "1.5.0", category: "payments", status: "active", installs: 85, rating: 4.6, author: "Partner", lastUpdated: "2026-04-15", description: "Flutterwave payment gateway integration" },
  { id: "PLG-004", name: "Paystack Commerce", version: "2.0.0", category: "payments", status: "active", installs: 78, rating: 4.7, author: "Partner", lastUpdated: "2026-04-20", description: "Paystack payment processing and commerce tools" },
  { id: "PLG-005", name: "Smile Identity KYC", version: "1.3.2", category: "identity", status: "active", installs: 62, rating: 4.5, author: "Partner", lastUpdated: "2026-03-30", description: "AI-powered identity verification for Nigerian customers" },
  { id: "PLG-006", name: "Mono Financial Data", version: "1.2.0", category: "data", status: "active", installs: 40, rating: 4.4, author: "Partner", lastUpdated: "2026-04-10", description: "Financial data aggregation from Nigerian banks" },
  { id: "PLG-007", name: "Termii SMS/Voice", version: "1.0.5", category: "communications", status: "active", installs: 55, rating: 4.3, author: "Partner", lastUpdated: "2026-04-05", description: "SMS, voice, and WhatsApp messaging for Nigerian customers" },
  { id: "PLG-008", name: "Appzone Zone", version: "2.2.0", category: "core_banking", status: "active", installs: 30, rating: 4.6, author: "Partner", lastUpdated: "2026-03-25", description: "Appzone core banking middleware connector" },
  { id: "PLG-009", name: "RemitaNG Collections", version: "1.4.0", category: "collections", status: "active", installs: 48, rating: 4.5, author: "Partner", lastUpdated: "2026-04-12", description: "Remita payment collection and e-mandate management" },
  { id: "PLG-010", name: "VFD MFB Gateway", version: "1.1.0", category: "microfinance", status: "active", installs: 25, rating: 4.2, author: "Partner", lastUpdated: "2026-03-20", description: "VFD Microfinance Bank API gateway integration" },
];

const tenantRlsPolicies = [
  { id: "RLS-001", table: "accounts", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter account rows by tenant" },
  { id: "RLS-002", table: "transactions", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter transaction rows by tenant" },
  { id: "RLS-003", table: "customers", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter customer rows by tenant" },
  { id: "RLS-004", table: "loans", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter loan rows by tenant" },
  { id: "RLS-005", table: "cards", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter card rows by tenant" },
  { id: "RLS-006", table: "audit_logs", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter audit logs by tenant" },
  { id: "RLS-007", table: "kyc_records", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter KYC records by tenant" },
  { id: "RLS-008", table: "notifications", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter notifications by tenant" },
  { id: "RLS-009", table: "billing_records", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter billing records by tenant" },
  { id: "RLS-010", table: "feature_flags", policy: "tenant_row_filter", enforced: true, tenant: "all", conditions: "tenant_id = current_tenant()", createdAt: "2026-01-15", description: "Filter feature flags by tenant" },
];

const tenantMeters = [
  { id: "MTR-001", tenantId: "T-001", tenantName: "FirstBank Nigeria", metric: "api_calls", value: 2500000, period: "2026-05", unit: "requests", billedAmount: 1250000, status: "active" },
  { id: "MTR-002", tenantId: "T-001", tenantName: "FirstBank Nigeria", metric: "storage_gb", value: 450, period: "2026-05", unit: "GB", billedAmount: 225000, status: "active" },
  { id: "MTR-003", tenantId: "T-002", tenantName: "GTBank", metric: "api_calls", value: 1800000, period: "2026-05", unit: "requests", billedAmount: 900000, status: "active" },
  { id: "MTR-004", tenantId: "T-002", tenantName: "GTBank", metric: "transactions", value: 850000, period: "2026-05", unit: "txns", billedAmount: 4250000, status: "active" },
  { id: "MTR-005", tenantId: "T-003", tenantName: "Access Bank", metric: "api_calls", value: 3200000, period: "2026-05", unit: "requests", billedAmount: 1600000, status: "active" },
  { id: "MTR-006", tenantId: "T-003", tenantName: "Access Bank", metric: "active_users", value: 15000, period: "2026-05", unit: "users", billedAmount: 7500000, status: "active" },
];

const provisioningJobs = [
  { id: "PROV-001", tenantName: "Zenith Bank", tenantId: "TEN-ZENITH", status: "completed", steps: 14, completedSteps: 14, startedAt: "2026-04-01T08:00:00Z", completedAt: "2026-04-01T08:45:00Z", environment: "production", initiatedBy: "admin@54bank.app", featureFlagPackage: "enterprise", modulesEnabled: 18, provisioningSteps: ["create_tenant", "setup_database", "apply_rls_policies", "configure_keycloak", "setup_permify_roles", "create_kafka_topics", "initialize_tigerbeetle_accounts", "setup_opensearch_indices", "configure_redis_cache", "register_dapr_components", "setup_temporal_workflows", "assign_feature_flags", "configure_billing", "deploy_white_label"] },
  { id: "PROV-002", tenantName: "UBA Nigeria", tenantId: "TEN-UBA", status: "completed", steps: 14, completedSteps: 14, startedAt: "2026-04-15T10:00:00Z", completedAt: "2026-04-15T10:30:00Z", environment: "production", initiatedBy: "admin@54bank.app", featureFlagPackage: "enterprise", modulesEnabled: 18, provisioningSteps: ["create_tenant", "setup_database", "apply_rls_policies", "configure_keycloak", "setup_permify_roles", "create_kafka_topics", "initialize_tigerbeetle_accounts", "setup_opensearch_indices", "configure_redis_cache", "register_dapr_components", "setup_temporal_workflows", "assign_feature_flags", "configure_billing", "deploy_white_label"] },
  { id: "PROV-003", tenantName: "Wema Bank (ALAT)", tenantId: "TEN-WEMA", status: "in_progress", steps: 14, completedSteps: 10, startedAt: "2026-05-09T12:00:00Z", completedAt: null, environment: "staging", initiatedBy: "ops@54bank.app", featureFlagPackage: "standard", modulesEnabled: 8, provisioningSteps: ["create_tenant", "setup_database", "apply_rls_policies", "configure_keycloak", "setup_permify_roles", "create_kafka_topics", "initialize_tigerbeetle_accounts", "setup_opensearch_indices", "configure_redis_cache", "register_dapr_components", "setup_temporal_workflows", "assign_feature_flags", "configure_billing", "deploy_white_label"] },
  { id: "PROV-004", tenantName: "Mutual Benefits MFB", tenantId: "TEN-MUTUAL-MFB", status: "completed", steps: 14, completedSteps: 14, startedAt: "2026-05-01T09:00:00Z", completedAt: "2026-05-01T09:25:00Z", environment: "production", initiatedBy: "admin@54bank.app", featureFlagPackage: "microfinance", modulesEnabled: 9, provisioningSteps: ["create_tenant", "setup_database", "apply_rls_policies", "configure_keycloak", "setup_permify_roles", "create_kafka_topics", "initialize_tigerbeetle_accounts", "setup_opensearch_indices", "configure_redis_cache", "register_dapr_components", "setup_temporal_workflows", "assign_feature_flags", "configure_billing", "deploy_white_label"] },
];

const customDomains = [
  { id: "DOM-001", domain: "banking.firstbank.ng", tenantId: "T-001", status: "active", sslStatus: "valid", sslExpiry: "2027-03-15", dnsVerified: true, lastChecked: "2026-05-09T10:00:00Z" },
  { id: "DOM-002", domain: "portal.gtbank.com", tenantId: "T-002", status: "active", sslStatus: "valid", sslExpiry: "2027-01-20", dnsVerified: true, lastChecked: "2026-05-09T10:00:00Z" },
  { id: "DOM-003", domain: "app.accessbankplc.com", tenantId: "T-003", status: "active", sslStatus: "valid", sslExpiry: "2026-11-30", dnsVerified: true, lastChecked: "2026-05-09T10:00:00Z" },
  { id: "DOM-004", domain: "digital.zenithbank.com", tenantId: "T-004", status: "pending_verification", sslStatus: "pending", sslExpiry: null, dnsVerified: false, lastChecked: "2026-05-09T10:00:00Z" },
];

const graduatedRollouts = [
  { id: "GR-001", featureFlag: "ai_fraud_scoring_v2", strategy: "canary", currentPhase: "ring_3", targetPercent: 75, actualPercent: 74.8, status: "active", startedAt: "2026-04-01", errorRate: 0.02, rollbackThreshold: 5.0 },
  { id: "GR-002", featureFlag: "real_time_fx_engine", strategy: "ring_based", currentPhase: "ring_2", targetPercent: 60, actualPercent: 59.5, status: "active", startedAt: "2026-04-15", errorRate: 0.05, rollbackThreshold: 2.0 },
  { id: "GR-003", featureFlag: "biometric_login", strategy: "percentage", currentPhase: "general_availability", targetPercent: 80, actualPercent: 80.0, status: "completed", startedAt: "2026-03-01", errorRate: 0.01, rollbackThreshold: 3.0 },
  { id: "GR-004", featureFlag: "green_banking_carbon", strategy: "canary", currentPhase: "ring_1", targetPercent: 30, actualPercent: 29.5, status: "active", startedAt: "2026-05-01", errorRate: 0.08, rollbackThreshold: 5.0 },
];

const webhookEndpoints = [
  { id: "WH-001", url: "https://api.firstbank.ng/webhooks/54bank", tenant: "FirstBank Nigeria", events: ["transaction.completed", "kyc.verified"], status: "active", secret: "wh_sec_***", deliveryRate: 99.8, lastDelivery: "2026-05-09T14:30:00Z" },
  { id: "WH-002", url: "https://hooks.gtbank.com/events", tenant: "GTBank", events: ["loan.disbursed", "card.issued", "fraud.detected"], status: "active", secret: "wh_sec_***", deliveryRate: 99.5, lastDelivery: "2026-05-09T14:28:00Z" },
  { id: "WH-003", url: "https://integrations.accessbank.com/notify", tenant: "Access Bank", events: ["account.opened", "swift.message.sent"], status: "active", secret: "wh_sec_***", deliveryRate: 99.9, lastDelivery: "2026-05-09T14:25:00Z" },
  { id: "WH-004", url: "https://platform.zenithbank.com/callbacks", tenant: "Zenith Bank", events: ["settlement.batch", "billing.metered"], status: "active", secret: "wh_sec_***", deliveryRate: 98.5, lastDelivery: "2026-05-09T14:20:00Z" },
];

const whiteThemes = [
  { id: "WT-001", tenantId: "T-001", name: "FirstBank Blue", primaryColor: "#003366", secondaryColor: "#FFD700", logo: "firstbank-logo.svg", favicon: "firstbank-favicon.ico", status: "active", customCSS: true, darkMode: true },
  { id: "WT-002", tenantId: "T-002", name: "GTBank Orange", primaryColor: "#FF6600", secondaryColor: "#333333", logo: "gtbank-logo.svg", favicon: "gtbank-favicon.ico", status: "active", customCSS: true, darkMode: true },
  { id: "WT-003", tenantId: "T-003", name: "Access Diamond", primaryColor: "#E31837", secondaryColor: "#00205B", logo: "access-logo.svg", favicon: "access-favicon.ico", status: "active", customCSS: false, darkMode: false },
  { id: "WT-004", tenantId: "T-004", name: "Zenith Red", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", logo: "zenith-logo.svg", favicon: "zenith-favicon.ico", status: "draft", customCSS: true, darkMode: true },
];

const brandedEmails = [
  { id: "BE-001", template: "welcome_email", tenant: "FirstBank Nigeria", subject: "Welcome to FirstBank Digital Banking", status: "active", sentCount: 15000, openRate: 68.5, lastSent: "2026-05-09T08:00:00Z" },
  { id: "BE-002", template: "transaction_alert", tenant: "GTBank", subject: "GTBank Transaction Notification", status: "active", sentCount: 250000, openRate: 85.2, lastSent: "2026-05-09T14:30:00Z" },
  { id: "BE-003", template: "loan_approval", tenant: "Access Bank", subject: "Your Access Bank Loan Has Been Approved", status: "active", sentCount: 8500, openRate: 92.1, lastSent: "2026-05-09T11:00:00Z" },
  { id: "BE-004", template: "kyc_reminder", tenant: "Zenith Bank", subject: "Complete Your KYC Verification", status: "active", sentCount: 12000, openRate: 55.3, lastSent: "2026-05-08T09:00:00Z" },
  { id: "BE-005", template: "statement_ready", tenant: "FirstBank Nigeria", subject: "Your Monthly Statement is Ready", status: "active", sentCount: 45000, openRate: 42.8, lastSent: "2026-05-01T06:00:00Z" },
];

const products = [
  { id: "PF-001", name: "Savings Plus", category: "savings", interestRate: 4.5, minBalance: 5000, currency: "NGN", status: "active", eligibility: "all_retail", glMapping: "GL-2000", fees: "monthly_maintenance:100", tenants: 4, subscribers: 125000 },
  { id: "PF-002", name: "SME Business Account", category: "current", interestRate: 0, minBalance: 50000, currency: "NGN", status: "active", eligibility: "sme_segment", glMapping: "GL-2000", fees: "monthly_maintenance:500,cot:0.5%", tenants: 3, subscribers: 45000 },
  { id: "PF-003", name: "Agri-Loan Flex", category: "lending", interestRate: 9.0, minBalance: 0, currency: "NGN", status: "active", eligibility: "agriculture_farmers", glMapping: "GL-1200", fees: "processing:1%,insurance:0.5%", tenants: 2, subscribers: 8500 },
  { id: "PF-004", name: "Fixed Deposit Premium", category: "investment", interestRate: 12.5, minBalance: 1000000, currency: "NGN", status: "active", eligibility: "high_net_worth", glMapping: "GL-2000", fees: "early_liquidation:10%_of_interest", tenants: 4, subscribers: 22000 },
  { id: "PF-005", name: "Diaspora Current Account", category: "current", interestRate: 2.0, minBalance: 0, currency: "USD", status: "active", eligibility: "diaspora_customers", glMapping: "GL-2000", fees: "monthly_maintenance:5_USD", tenants: 3, subscribers: 35000 },
  { id: "PF-006", name: "Microfinance Group Loan", category: "microfinance", interestRate: 18.0, minBalance: 0, currency: "NGN", status: "active", eligibility: "mfb_groups", glMapping: "GL-1200", fees: "processing:2%,group_fee:500", tenants: 2, subscribers: 65000 },
];

const cardsFraudRules = [
  { id: "CFR-001", name: "High Value Card Transaction", ruleType: "amount_threshold", threshold: 5000000, action: "flag_review", enabled: true, triggerCount: 245, lastTriggered: "2026-05-09T13:45:00Z" },
  { id: "CFR-002", name: "Cross-Border Card Usage", ruleType: "geo_anomaly", threshold: 0, action: "block_and_notify", enabled: true, triggerCount: 89, lastTriggered: "2026-05-09T11:20:00Z" },
  { id: "CFR-003", name: "Rapid Successive Transactions", ruleType: "velocity", threshold: 5, action: "temporary_block", enabled: true, triggerCount: 156, lastTriggered: "2026-05-09T14:10:00Z" },
  { id: "CFR-004", name: "ATM Cash-Out Pattern", ruleType: "pattern", threshold: 3, action: "flag_review", enabled: true, triggerCount: 67, lastTriggered: "2026-05-08T22:30:00Z" },
  { id: "CFR-005", name: "POS Merchant Category Risk", ruleType: "mcc_block", threshold: 0, action: "block", enabled: true, triggerCount: 34, lastTriggered: "2026-05-07T16:00:00Z" },
];

const cardsTokens = [
  { id: "CT-001", cardId: "CARD-001", tokenType: "apple_pay", status: "active", lastUsed: "2026-05-09T12:30:00Z", deviceName: "iPhone 15 Pro", expiresAt: "2028-12-31", tokenRequestor: "Apple" },
  { id: "CT-002", cardId: "CARD-002", tokenType: "google_pay", status: "active", lastUsed: "2026-05-09T10:15:00Z", deviceName: "Samsung Galaxy S24", expiresAt: "2028-06-30", tokenRequestor: "Google" },
  { id: "CT-003", cardId: "CARD-003", tokenType: "samsung_pay", status: "active", lastUsed: "2026-05-08T18:45:00Z", deviceName: "Samsung Galaxy S23", expiresAt: "2027-11-30", tokenRequestor: "Samsung" },
  { id: "CT-004", cardId: "CARD-004", tokenType: "merchant_token", status: "active", lastUsed: "2026-05-09T14:00:00Z", deviceName: "Jumia Commerce", expiresAt: "2027-05-31", tokenRequestor: "Jumia" },
  { id: "CT-005", cardId: "CARD-001", tokenType: "google_pay", status: "suspended", lastUsed: "2026-04-15T09:00:00Z", deviceName: "Pixel 8", expiresAt: "2028-03-31", tokenRequestor: "Google" },
];

const chequeImages = [
  { id: "CHQ-001", chequeNumber: "000125", accountNumber: "0012345678", amount: 2500000, currency: "NGN", status: "cleared", capturedAt: "2026-05-09T09:30:00Z", branch: "Lagos Marina", drawer: "Dangote Industries Ltd", payee: "BUA Cement Plc" },
  { id: "CHQ-002", chequeNumber: "000126", accountNumber: "0023456789", amount: 850000, currency: "NGN", status: "pending_verification", capturedAt: "2026-05-09T10:15:00Z", branch: "Abuja Central", drawer: "MTN Nigeria Ltd", payee: "IHS Towers Nigeria" },
  { id: "CHQ-003", chequeNumber: "000127", accountNumber: "0034567890", amount: 15000000, currency: "NGN", status: "cleared", capturedAt: "2026-05-08T14:00:00Z", branch: "Port Harcourt GRA", drawer: "Shell Nigeria", payee: "NNPC Ltd" },
  { id: "CHQ-004", chequeNumber: "000128", accountNumber: "0045678901", amount: 500000, currency: "NGN", status: "returned", capturedAt: "2026-05-08T11:30:00Z", branch: "Kano Nassarawa", drawer: "Flour Mills Nigeria", payee: "BUA Foods Plc", returnReason: "Insufficient funds" },
];

const healthRegistry = [
  { id: "SVC-001", serviceName: "account-service", status: "healthy", uptime: 99.98, lastCheck: "2026-05-09T15:00:00Z", responseTime: 45, port: 8090, version: "2.4.1", replicas: 3 },
  { id: "SVC-002", serviceName: "transaction-engine", status: "healthy", uptime: 99.99, lastCheck: "2026-05-09T15:00:00Z", responseTime: 12, port: 8091, version: "3.1.0", replicas: 5 },
  { id: "SVC-003", serviceName: "kyc-service", status: "healthy", uptime: 99.95, lastCheck: "2026-05-09T15:00:00Z", responseTime: 250, port: 8092, version: "1.8.2", replicas: 2 },
  { id: "SVC-004", serviceName: "fraud-detection", status: "healthy", uptime: 99.97, lastCheck: "2026-05-09T15:00:00Z", responseTime: 35, port: 8093, version: "2.0.0", replicas: 3 },
  { id: "SVC-005", serviceName: "notification-hub", status: "degraded", uptime: 98.50, lastCheck: "2026-05-09T15:00:00Z", responseTime: 1200, port: 8094, version: "1.5.3", replicas: 2 },
  { id: "SVC-006", serviceName: "payment-gateway", status: "healthy", uptime: 99.99, lastCheck: "2026-05-09T15:00:00Z", responseTime: 18, port: 8095, version: "4.2.0", replicas: 4 },
];

const kybTriggers = [
  { id: "KYB-T001", event: "business_registration", action: "initiate_verification", status: "active", priority: "high", conditions: "new_business_account", lastTriggered: "2026-05-09T10:00:00Z" },
  { id: "KYB-T002", event: "annual_review", action: "refresh_verification", status: "active", priority: "medium", conditions: "last_verified > 12_months", lastTriggered: "2026-05-01T08:00:00Z" },
  { id: "KYB-T003", event: "ownership_change", action: "full_reverification", status: "active", priority: "critical", conditions: "director_change || shareholder_change", lastTriggered: "2026-04-28T14:00:00Z" },
  { id: "KYB-T004", event: "transaction_threshold", action: "enhanced_due_diligence", status: "active", priority: "high", conditions: "monthly_volume > 100M_NGN", lastTriggered: "2026-05-08T16:00:00Z" },
];

const kycEventRules = [
  { id: "KYC-ER001", event: "id_document_uploaded", action: "auto_verify_nin", status: "active", priority: "high", conditions: "document_type == NIN", engine: "Smile Identity" },
  { id: "KYC-ER002", event: "address_changed", action: "reverify_address", status: "active", priority: "medium", conditions: "any_address_field_changed", engine: "Internal" },
  { id: "KYC-ER003", event: "high_risk_transaction", action: "trigger_enhanced_kyc", status: "active", priority: "critical", conditions: "risk_score > 80", engine: "AI Model v2" },
  { id: "KYC-ER004", event: "pep_match_detected", action: "escalate_to_compliance", status: "active", priority: "critical", conditions: "pep_database_match > 85%", engine: "WorldCheck" },
];

const kycGates = [
  { id: "KYC-G001", name: "Account Opening Gate", level: "basic", requiredDocs: ["BVN", "NIN"], status: "active", passRate: 94.5, avgProcessingTime: "15 min" },
  { id: "KYC-G002", name: "Tier 2 Upgrade Gate", level: "standard", requiredDocs: ["BVN", "NIN", "Utility Bill", "Passport Photo"], status: "active", passRate: 87.2, avgProcessingTime: "2 hours" },
  { id: "KYC-G003", name: "High Value Customer Gate", level: "enhanced", requiredDocs: ["BVN", "NIN", "Tax Clearance", "Bank Reference", "Employer Letter"], status: "active", passRate: 78.8, avgProcessingTime: "24 hours" },
  { id: "KYC-G004", name: "Corporate Account Gate", level: "corporate", requiredDocs: ["CAC Certificate", "MEMART", "Board Resolution", "Director IDs"], status: "active", passRate: 72.0, avgProcessingTime: "3 days" },
];

const kycOverrides = [
  { id: "KYC-O001", customerId: "CUST-1001", overrideType: "document_waiver", reason: "Government official with verified identity", approvedBy: "Chief Compliance Officer", status: "active", expiresAt: "2026-12-31" },
  { id: "KYC-O002", customerId: "CUST-2045", overrideType: "tier_upgrade", reason: "Long-standing customer with clean record", approvedBy: "Branch Manager Abuja", status: "active", expiresAt: "2026-09-30" },
  { id: "KYC-O003", customerId: "CUST-3078", overrideType: "risk_score_override", reason: "False positive on PEP screening", approvedBy: "AML Officer", status: "active", expiresAt: "2026-06-30" },
];

const kycTriggers = [
  { id: "KYC-TR001", event: "account_creation", action: "initiate_basic_kyc", status: "active", priority: "high" },
  { id: "KYC-TR002", event: "tier_upgrade_request", action: "initiate_enhanced_kyc", status: "active", priority: "high" },
  { id: "KYC-TR003", event: "address_change", action: "reverify_address", status: "active", priority: "medium" },
  { id: "KYC-TR004", event: "dormancy_reactivation", action: "full_kyc_refresh", status: "active", priority: "high" },
  { id: "KYC-TR005", event: "cross_border_transaction", action: "enhanced_due_diligence", status: "active", priority: "critical" },
];

const pepDatabase = [
  { id: "PEP-001", name: "Aliko Dangote", category: "Business Leader", riskLevel: "medium", country: "Nigeria", lastUpdated: "2026-04-01", source: "WorldCheck", matchConfidence: 100 },
  { id: "PEP-002", name: "Abdul Samad Rabiu", category: "Business Leader", riskLevel: "medium", country: "Nigeria", lastUpdated: "2026-04-01", source: "WorldCheck", matchConfidence: 100 },
  { id: "PEP-003", name: "Mike Adenuga", category: "Business Leader", riskLevel: "medium", country: "Nigeria", lastUpdated: "2026-03-15", source: "Dow Jones", matchConfidence: 100 },
  { id: "PEP-004", name: "Tony Elumelu", category: "Business Leader", riskLevel: "low", country: "Nigeria", lastUpdated: "2026-04-15", source: "WorldCheck", matchConfidence: 100 },
];

const sarReports = [
  { id: "SAR-001", caseId: "CASE-2026-0045", customerName: "Obfuscated", amount: 85000000, currency: "NGN", type: "Structuring", status: "filed", filedWith: "NFIU", filedAt: "2026-05-07T10:00:00Z", investigator: "AML Unit" },
  { id: "SAR-002", caseId: "CASE-2026-0051", customerName: "Obfuscated", amount: 250000000, currency: "NGN", type: "Layering", status: "under_review", filedWith: "NFIU", filedAt: "2026-05-08T14:00:00Z", investigator: "AML Unit" },
  { id: "SAR-003", caseId: "CASE-2026-0038", customerName: "Obfuscated", amount: 15000, currency: "USD", type: "Unusual Pattern", status: "filed", filedWith: "NFIU", filedAt: "2026-05-05T09:00:00Z", investigator: "Compliance" },
];

const watchlist = [
  { id: "WL-001", listName: "OFAC SDN", entries: 12500, lastUpdated: "2026-05-09T00:00:00Z", status: "active", matchesFound: 3, autoScreen: true },
  { id: "WL-002", listName: "UN Sanctions", entries: 8200, lastUpdated: "2026-05-08T00:00:00Z", status: "active", matchesFound: 1, autoScreen: true },
  { id: "WL-003", listName: "EU Sanctions", entries: 5600, lastUpdated: "2026-05-07T00:00:00Z", status: "active", matchesFound: 0, autoScreen: true },
  { id: "WL-004", listName: "CBN Blacklist", entries: 350, lastUpdated: "2026-05-05T00:00:00Z", status: "active", matchesFound: 5, autoScreen: true },
  { id: "WL-005", listName: "Internal Watchlist", entries: 125, lastUpdated: "2026-05-09T12:00:00Z", status: "active", matchesFound: 8, autoScreen: true },
];

const selfServiceTransactions = [
  { id: "SST-001", type: "transfer", amount: 150000, currency: "NGN", from: "0012345678", to: "0023456789", status: "completed", channel: "mobile", timestamp: "2026-05-09T14:30:00Z" },
  { id: "SST-002", type: "bill_payment", amount: 25000, currency: "NGN", from: "0012345678", to: "DSTV-Premium", status: "completed", channel: "web", timestamp: "2026-05-09T13:15:00Z" },
  { id: "SST-003", type: "airtime_purchase", amount: 5000, currency: "NGN", from: "0034567890", to: "MTN-08012345678", status: "completed", channel: "ussd", timestamp: "2026-05-09T12:00:00Z" },
  { id: "SST-004", type: "transfer", amount: 500000, currency: "NGN", from: "0045678901", to: "0056789012", status: "pending_approval", channel: "mobile", timestamp: "2026-05-09T14:45:00Z" },
  { id: "SST-005", type: "card_payment", amount: 35000, currency: "NGN", from: "CARD-001", to: "Shoprite Nigeria", status: "completed", channel: "pos", timestamp: "2026-05-09T11:30:00Z" },
];

const statementHistory = [
  { id: "STH-001", accountNumber: "0012345678", period: "April 2026", format: "PDF", status: "generated", generatedAt: "2026-05-01T06:00:00Z", size: "245 KB", downloadCount: 3 },
  { id: "STH-002", accountNumber: "0012345678", period: "March 2026", format: "PDF", status: "generated", generatedAt: "2026-04-01T06:00:00Z", size: "312 KB", downloadCount: 5 },
  { id: "STH-003", accountNumber: "0023456789", period: "April 2026", format: "CSV", status: "generated", generatedAt: "2026-05-01T06:00:00Z", size: "180 KB", downloadCount: 1 },
  { id: "STH-004", accountNumber: "0034567890", period: "April 2026", format: "PDF", status: "generated", generatedAt: "2026-05-01T06:00:00Z", size: "98 KB", downloadCount: 2 },
];

const lcAmendments = [
  { id: "LCA-001", lcNumber: "LC-2026-001", amendment: "Extend validity to June 2026", status: "approved", requestedBy: "Dangote Industries", beneficiary: "Sinopec China", amount: 25000000, currency: "USD", requestedAt: "2026-05-01" },
  { id: "LCA-002", lcNumber: "LC-2026-005", amendment: "Increase amount by 15%", status: "pending", requestedBy: "BUA Group", beneficiary: "ThyssenKrupp Germany", amount: 8000000, currency: "EUR", requestedAt: "2026-05-08" },
  { id: "LCA-003", lcNumber: "LC-2026-008", amendment: "Change port of loading", status: "approved", requestedBy: "Flour Mills Nigeria", beneficiary: "Cargill USA", amount: 12000000, currency: "USD", requestedAt: "2026-04-25" },
];

const workflows = [
  { id: "WF-001", name: "Customer Onboarding", type: "sequential", steps: 8, status: "active", instances: 125, avgDuration: "2 days", sla: "5 days", lastTriggered: "2026-05-09T10:00:00Z" },
  { id: "WF-002", name: "Loan Origination", type: "parallel", steps: 12, status: "active", instances: 45, avgDuration: "5 days", sla: "10 days", lastTriggered: "2026-05-09T08:00:00Z" },
  { id: "WF-003", name: "Card Dispute Resolution", type: "sequential", steps: 6, status: "active", instances: 18, avgDuration: "3 days", sla: "7 days", lastTriggered: "2026-05-08T16:00:00Z" },
  { id: "WF-004", name: "Account Closure", type: "sequential", steps: 5, status: "active", instances: 8, avgDuration: "1 day", sla: "3 days", lastTriggered: "2026-05-07T14:00:00Z" },
  { id: "WF-005", name: "Regulatory Filing", type: "sequential", steps: 7, status: "active", instances: 3, avgDuration: "4 days", sla: "15 days", lastTriggered: "2026-05-01T09:00:00Z" },
];

const workflowInstances = [
  { id: "WI-001", workflowName: "Customer Onboarding", customerId: "CUST-NEW-001", currentStep: 5, totalSteps: 8, status: "in_progress", startedAt: "2026-05-09T08:00:00Z", assignee: "KYC Team" },
  { id: "WI-002", workflowName: "Loan Origination", loanId: "LOAN-APP-045", currentStep: 8, totalSteps: 12, status: "in_progress", startedAt: "2026-05-05T10:00:00Z", assignee: "Credit Committee" },
  { id: "WI-003", workflowName: "Card Dispute Resolution", disputeId: "DISP-089", currentStep: 3, totalSteps: 6, status: "in_progress", startedAt: "2026-05-08T09:00:00Z", assignee: "Card Operations" },
  { id: "WI-004", workflowName: "Customer Onboarding", customerId: "CUST-NEW-002", currentStep: 8, totalSteps: 8, status: "completed", startedAt: "2026-05-07T10:00:00Z", assignee: "Branch Operations" },
];

const billingOrchestratorProfiles = [
  { id: "BOP-001", tenantName: "FirstBank Nigeria", segment: "tier_1_commercial", planType: "transaction_based", monthlyFee: 5000000, perTxnFee: 5, activeUsers: 15000, status: "active", billingCycle: "monthly" },
  { id: "BOP-002", tenantName: "GTBank", segment: "tier_1_commercial", planType: "subscription", monthlyFee: 8000000, perTxnFee: 0, activeUsers: 12000, status: "active", billingCycle: "monthly" },
  { id: "BOP-003", tenantName: "Lapo MFB", segment: "microfinance", planType: "hybrid", monthlyFee: 500000, perTxnFee: 3, activeUsers: 5000, status: "active", billingCycle: "monthly" },
  { id: "BOP-004", tenantName: "Access Bank", segment: "tier_1_commercial", planType: "transaction_based", monthlyFee: 4500000, perTxnFee: 4.5, activeUsers: 18000, status: "active", billingCycle: "monthly" },
  { id: "BOP-005", tenantName: "Moniepoint", segment: "fintech", planType: "revenue_share", monthlyFee: 0, perTxnFee: 7, activeUsers: 25000, status: "active", billingCycle: "monthly" },
  { id: "BOP-006", tenantName: "Zenith Bank", segment: "tier_1_commercial", planType: "subscription", monthlyFee: 7500000, perTxnFee: 0, activeUsers: 14000, status: "active", billingCycle: "monthly" },
];

const billingRbacPolicies = [
  { id: "BRP-001", role: "billing_admin", resource: "billing.*", action: "*", effect: "allow", description: "Full billing system access", tenantScope: "own_tenant" },
  { id: "BRP-002", role: "finance_officer", resource: "billing.invoices,billing.payments", action: "read,create", effect: "allow", description: "View and create invoices/payments", tenantScope: "own_tenant" },
  { id: "BRP-003", role: "billing_viewer", resource: "billing.*", action: "read", effect: "allow", description: "Read-only billing access", tenantScope: "own_tenant" },
  { id: "BRP-004", role: "platform_admin", resource: "billing.*", action: "*", effect: "allow", description: "Cross-tenant billing administration", tenantScope: "all_tenants" },
  { id: "BRP-005", role: "auditor", resource: "billing.audit_trail", action: "read", effect: "allow", description: "Billing audit trail access", tenantScope: "all_tenants" },
  { id: "BRP-006", role: "tenant_owner", resource: "billing.plans,billing.usage", action: "read", effect: "allow", description: "View own billing plans and usage", tenantScope: "own_tenant" },
  { id: "BRP-007", role: "support_agent", resource: "billing.invoices,billing.disputes", action: "read,update", effect: "allow", description: "Handle billing support tickets", tenantScope: "assigned_tenants" },
  { id: "BRP-008", role: "compliance_officer", resource: "billing.*", action: "read", effect: "allow", description: "Compliance oversight of billing", tenantScope: "all_tenants" },
];

const billingEvents = [
  { id: "BEV-001", eventType: "api_call", tenantId: "T-001", service: "account-service", count: 45000, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 22500 },
  { id: "BEV-002", eventType: "transaction", tenantId: "T-001", service: "transaction-engine", count: 12500, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 62500 },
  { id: "BEV-003", eventType: "storage_read", tenantId: "T-002", service: "document-service", count: 8500, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 4250 },
  { id: "BEV-004", eventType: "notification_sent", tenantId: "T-002", service: "notification-hub", count: 25000, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 12500 },
  { id: "BEV-005", eventType: "api_call", tenantId: "T-003", service: "kyc-service", count: 3500, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 17500 },
  { id: "BEV-006", eventType: "compute_minutes", tenantId: "T-003", service: "ml-fraud-engine", count: 450, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 67500 },
  { id: "BEV-007", eventType: "api_call", tenantId: "T-004", service: "payment-gateway", count: 65000, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 32500 },
  { id: "BEV-008", eventType: "sms_sent", tenantId: "T-001", service: "notification-hub", count: 15000, timestamp: "2026-05-09T14:00:00Z", metered: true, billedAmount: 60000 },
];

const postgresRecords = [
  { id: "PG-001", table: "accounts", rowCount: 1250000, sizeGb: 12.5, lastVacuum: "2026-05-09T02:00:00Z", indexes: 8, replicationLag: "0ms", status: "healthy" },
  { id: "PG-002", table: "transactions", rowCount: 45000000, sizeGb: 125.0, lastVacuum: "2026-05-09T03:00:00Z", indexes: 12, replicationLag: "0ms", status: "healthy" },
  { id: "PG-003", table: "customers", rowCount: 850000, sizeGb: 8.2, lastVacuum: "2026-05-09T02:30:00Z", indexes: 6, replicationLag: "0ms", status: "healthy" },
  { id: "PG-004", table: "kyc_records", rowCount: 920000, sizeGb: 15.0, lastVacuum: "2026-05-09T02:15:00Z", indexes: 5, replicationLag: "0ms", status: "healthy" },
  { id: "PG-005", table: "audit_logs", rowCount: 125000000, sizeGb: 350.0, lastVacuum: "2026-05-09T04:00:00Z", indexes: 4, replicationLag: "2ms", status: "healthy" },
];

const murabahaQuotes = [
  { id: "MQ-001", asset: "Commercial Property - Victoria Island", costPrice: 500000000, profitMargin: 15, sellingPrice: 575000000, tenor: 60, monthlyInstallment: 9583333, status: "approved", customer: "Dangote Real Estate", currency: "NGN" },
  { id: "MQ-002", asset: "Industrial Equipment - Cement Plant", costPrice: 2000000000, profitMargin: 12, sellingPrice: 2240000000, tenor: 84, monthlyInstallment: 26666667, status: "pending", customer: "BUA Industries", currency: "NGN" },
  { id: "MQ-003", asset: "Commercial Vehicle Fleet", costPrice: 150000000, profitMargin: 18, sellingPrice: 177000000, tenor: 48, monthlyInstallment: 3687500, status: "approved", customer: "Coscharis Motors", currency: "NGN" },
];

const integrationTests = [
  { id: "IT-001", name: "Account Opening E2E", suite: "core_banking", status: "passed", duration: 2500, lastRun: "2026-05-09T06:00:00Z", assertions: 15, environment: "staging" },
  { id: "IT-002", name: "Payment Transfer Flow", suite: "payments", status: "passed", duration: 1800, lastRun: "2026-05-09T06:00:00Z", assertions: 12, environment: "staging" },
  { id: "IT-003", name: "KYC Verification Pipeline", suite: "compliance", status: "passed", duration: 5200, lastRun: "2026-05-09T06:00:00Z", assertions: 22, environment: "staging" },
  { id: "IT-004", name: "Loan Disbursement Workflow", suite: "lending", status: "passed", duration: 3500, lastRun: "2026-05-09T06:00:00Z", assertions: 18, environment: "staging" },
  { id: "IT-005", name: "Card Issuance E2E", suite: "cards", status: "failed", duration: 4200, lastRun: "2026-05-09T06:00:00Z", assertions: 14, environment: "staging", failureReason: "Card printer connection timeout" },
];

const seedRegistry = [
  { id: "SEED-001", domain: "accounts", recordCount: 1250000, lastSeeded: "2026-05-09T00:00:00Z", status: "active", source: "production_snapshot", version: "2.4.1" },
  { id: "SEED-002", domain: "transactions", recordCount: 45000000, lastSeeded: "2026-05-09T00:00:00Z", status: "active", source: "synthetic_generator", version: "3.1.0" },
  { id: "SEED-003", domain: "customers", recordCount: 850000, lastSeeded: "2026-05-09T00:00:00Z", status: "active", source: "anonymized_production", version: "1.8.2" },
  { id: "SEED-004", domain: "kyc_records", recordCount: 920000, lastSeeded: "2026-05-09T00:00:00Z", status: "active", source: "synthetic_generator", version: "2.0.0" },
  { id: "SEED-005", domain: "loans", recordCount: 125000, lastSeeded: "2026-05-09T00:00:00Z", status: "active", source: "synthetic_generator", version: "1.5.3" },
];

// ═══════════════════════════════════════════════════════════════════
//  STATS OBJECTS
// ═══════════════════════════════════════════════════════════════════

const securityStats = {
  totalPolicies: 15, enforcedPolicies: 15, securityPosture: "A+",
  vulnerabilitiesDetected: 6, vulnerabilitiesResolved: 6,
  complianceFrameworks: ["PCI-DSS", "ISO-27001", "CBN-RMFB", "NDPR", "SOC2", "NIST-800-53"],
  lastScanDate: "2026-05-09T08:00:00Z", threatsBlocked: 6,
};

const ddosStats = {
  totalRules: 8, activeRules: 8, mitigationRate: 100,
  attacksDetected: 5, attacksMitigated: 5, geoBlocks: 4,
  totalTrafficTbps: 2.5, blockedTrafficTbps: 0.8,
  topAttackVectors: ["TCP SYN Flood", "HTTP Flood", "DNS Amplification"],
};

const swiftStats = {
  totalMessages: 8, sentMessages: 5, receivedMessages: 3,
  mt103Count: 1, mt202Count: 1, mt700Count: 1, mt760Count: 1,
  iso20022Count: 2, deliveryRate: 100,
  totalValueUSD: 28500000, avgProcessingTimeSec: 12,
};

const pbacStats = {
  totalPolicies: 10, enforcementMode: "strict",
  allowDecisions: 25000, denyDecisions: 850,
  crossTenantBlocks: 150, afterHoursBlocks: 45,
  geoBlocks: 320, avgEvaluationTimeMs: 2,
};

const branchStats = {
  totalBranches: 6, activeBranches: 6, totalEmployees: 173,
  dailyTransactions: 9350, totalVaultBalance: 3000000000,
  totalAtms: 16, avgTransactionsPerBranch: 1558,
};

const glStats = {
  totalAccounts: 18, doubleEntryEnforced: true,
  totalAssets: 640000000000, totalLiabilities: 503000000000,
  totalEquity: 137000000000, totalRevenue: 68000000000,
  totalExpenses: 37000000000, trialBalanceBalanced: true,
  lastClosingDate: "2026-04-30",
};

const microfinanceStats = {
  totalGroups: 5, activeGroups: 4, formingGroups: 1,
  totalMembers: 160, totalSavings: 83000000,
  totalLoansOutstanding: 165000000, avgRepaymentRate: 95.2,
  totalOfficers: 5,
};

const offlineStats = {
  totalCapabilities: 8, resilienceScore: 98.5,
  avgSyncLatency: 45, offlineTransactionsQueued: 0,
  crdtMergeConflicts: 0, ussdFallbackActive: true,
  connectivityProfiles: 6, fallbackChannels: 2,
};

const regulatoryStats = {
  totalReturns: 8, filedReturns: 4, pendingReturns: 2, draftReturns: 2,
  complianceRate: 100, overdue: 0,
  frameworks: ["CBN", "NDIC", "Basel_III", "NFIU", "FIRS"],
  nextDueDate: "2026-05-10", autoGenerationEnabled: true,
};

// ═══════════════════════════════════════════════════════════════════
//  REGISTRATION FUNCTION
// ═══════════════════════════════════════════════════════════════════

export function registerSeedDataFallback(app: Express) {
  // ── New Service Pages (9 pages × 2 endpoints = 18 routes) ──
  reg(app, "/api/security-hardening/v1/security/policies", securityPolicies);
  regStats(app, "/api/security-hardening/v1/security/stats", securityStats);
  reg(app, "/api/ddos-protection/v1/ddos/rules", ddosRules);
  regStats(app, "/api/ddos-protection/v1/ddos/stats", ddosStats);
  reg(app, "/api/swift-messaging/v1/swift/messages", swiftMessages);
  regStats(app, "/api/swift-messaging/v1/swift/stats", swiftStats);
  reg(app, "/api/pbac-engine/v1/pbac/policies", pbacPolicies);
  regStats(app, "/api/pbac-engine/v1/pbac/stats", pbacStats);
  reg(app, "/api/branch-operations/v1/branch/branches", branches);
  regStats(app, "/api/branch-operations/v1/branch/stats", branchStats);
  reg(app, "/api/gl-engine/v1/gl/accounts", glAccounts);
  regStats(app, "/api/gl-engine/v1/gl/stats", glStats);
  reg(app, "/api/microfinance-engine/v1/microfinance/groups", microfinanceGroups);
  regStats(app, "/api/microfinance-engine/v1/microfinance/stats", microfinanceStats);
  reg(app, "/api/offline-resilience/v1/offline/capabilities", offlineCapabilities);
  regStats(app, "/api/offline-resilience/v1/offline/stats", offlineStats);
  reg(app, "/api/regulatory-automation/v1/regulatory/returns", regulatoryReturns);
  regStats(app, "/api/regulatory-automation/v1/regulatory/stats", regulatoryStats);

  // ── Missing /api/platform/ Routes (35 routes) ──
  // /api/admin/integration-tests and /api/admin/seed-registry are registered by integrationTestHarness lib
  // /api/platform/agents/performance is registered by agentBankingIntelligence lib
  reg(app, "/api/platform/approval-workflows/v1/chains", approvalChains);
  reg(app, "/api/platform/branded-comms/v1/emails", brandedEmails);
  reg(app, "/api/platform/cards/fraud-rules", cardsFraudRules);
  reg(app, "/api/platform/cards/tokens", cardsTokens);
  reg(app, "/api/platform/cheque-imaging/images", chequeImages);
  reg(app, "/api/platform/custom-domains/v1/domains", customDomains);
  reg(app, "/api/platform/event-streaming/v1/topics", eventTopics);
  reg(app, "/api/platform/feature-flags/v1/flags", featureFlags);
  reg(app, "/api/platform/graduated-rollout/v1/rollouts", graduatedRollouts);
  reg(app, "/api/platform/health/registry", healthRegistry);
  reg(app, "/api/platform/infra/postgres/records/accounts", postgresRecords);
  reg(app, "/api/platform/islamic/murabaha/quotes", murabahaQuotes);
  reg(app, "/api/platform/kyb-triggers", kybTriggers);
  reg(app, "/api/platform/kyc-event-rules", kycEventRules);
  reg(app, "/api/platform/kyc-gates", kycGates);
  reg(app, "/api/platform/kyc-overrides", kycOverrides);
  reg(app, "/api/platform/kyc-triggers", kycTriggers);
  reg(app, "/api/platform/kyc/pep-database", pepDatabase);
  reg(app, "/api/platform/kyc/sar-reports", sarReports);
  reg(app, "/api/platform/kyc/watchlist", watchlist);
  reg(app, "/api/platform/plugin-marketplace/v1/plugins", plugins);
  reg(app, "/api/platform/product-factory/v1/products", products);
  reg(app, "/api/platform/self-service/transactions", selfServiceTransactions);
  reg(app, "/api/platform/statements/history", statementHistory);
  reg(app, "/api/platform/tenant-isolation/v1/rls-policies", tenantRlsPolicies);
  reg(app, "/api/platform/tenant-metering/v1/meters", tenantMeters);
  reg(app, "/api/platform/tenant-provisioning/v1/provisioning-jobs", provisioningJobs);
  reg(app, "/api/platform/trade-finance/lc-amendments", lcAmendments);
  reg(app, "/api/platform/webhooks/v1/endpoints", webhookEndpoints);
  reg(app, "/api/platform/white-label/v1/themes", whiteThemes);
  // /api/platform/workflows/* are registered by workflowAutomation lib
  reg(app, "/api/platform/billing-orchestrator/v1/billing/profiles", billingOrchestratorProfiles);
  reg(app, "/api/platform/billing-rbac/v1/billing/rbac/policies", billingRbacPolicies);
  reg(app, "/api/platform/billing-events/v1/billing/events/metering", billingEvents);

  // ── Additional routes for 47 previously unwired services ──
  const pfData = proxyFallbackData;
  reg(app, "/api/ab-testing/v1/ab-tests/experiments", pfData["/v1/ab-tests/experiments"] ?? []);
  reg(app, "/api/api-marketplace/v1/marketplace/apis", pfData["/v1/marketplace/apis"] ?? []);
  reg(app, "/api/bank-guarantees/v1/guarantees", pfData["/v1/guarantees"] ?? []);
  reg(app, "/api/basel-engine/v1/basel/capital-adequacy", pfData["/v1/basel/capital-adequacy"] ?? []);
  reg(app, "/api/batch-processing/v1/batch/jobs", pfData["/v1/batch/jobs"] ?? []);
  reg(app, "/api/beneficiary-management/v1/beneficiaries", pfData["/v1/beneficiaries"] ?? []);
  reg(app, "/api/branch-operations/v1/branches", branches);
  reg(app, "/api/bulk-payments/v1/bulk/batches", [
    { id: "BP-001", name: "May Salary Run", totalAmount: 850000000, currency: "NGN", count: 12500, status: "completed" },
    { id: "BP-002", name: "Vendor Payments Q2", totalAmount: 250000000, currency: "NGN", count: 450, status: "processing" },
  ]);
  reg(app, "/api/cash-pooling/v1/cash-pools", pfData["/v1/cash-pools"] ?? []);
  reg(app, "/api/ddos-protection/v1/ddos/rules", ddosRules);
  reg(app, "/api/dispute-management/v1/disputes", pfData["/v1/disputes"] ?? []);
  reg(app, "/api/education-loans/v1/education-loans", pfData["/v1/education-loans"] ?? []);
  reg(app, "/api/erpnext-sync/v1/erp/sync-jobs", pfData["/v1/erp/sync-jobs"] ?? []);
  reg(app, "/api/esusu-groups/v1/esusu/groups", pfData["/v1/esusu/groups"] ?? []);
  reg(app, "/api/flag-audit/v1/flag-audits", pfData["/v1/flag-audits"] ?? []);
  reg(app, "/api/fx-rates-engine/v1/fx/rates", pfData["/v1/fx/rates"] ?? []);
  reg(app, "/api/gl-engine/v1/gl/accounts", glAccounts);
  reg(app, "/api/group-lending/v1/group-lending/groups", pfData["/v1/group-lending/groups"] ?? []);
  reg(app, "/api/identity-channels/v1/identity/channels", pfData["/v1/identity/channels"] ?? []);
  reg(app, "/api/ifrs9-engine/v1/ifrs9/ecl-models", pfData["/v1/ifrs9/ecl-models"] ?? []);
  reg(app, "/api/iso20022-hub/v1/iso20022/messages", pfData["/v1/iso20022/messages"] ?? []);
  reg(app, "/api/kyb-engine/v1/kyb/businesses", pfData["/v1/kyb/businesses"] ?? []);
  reg(app, "/api/kyc-engine/v1/kyc/verifications", [
    { id: "KYC-001", customerId: "CUS-001", type: "BVN", status: "verified", bvn: "22100000001", verifiedAt: "2026-05-01T10:00:00Z" },
    { id: "KYC-002", customerId: "CUS-002", type: "NIN", status: "verified", nin: "10200000002", verifiedAt: "2026-05-02T11:00:00Z" },
  ]);
  reg(app, "/api/leasing/v1/leases", pfData["/v1/leases"] ?? []);
  reg(app, "/api/ledger-reconciliation/v1/reconciliation/reports", pfData["/v1/reconciliation/reports"] ?? []);
  reg(app, "/api/loan-calculator/v1/loan-calculator/schedules", pfData["/v1/loan-calculator/schedules"] ?? []);
  reg(app, "/api/microfinance-engine/v1/microfinance/groups", microfinanceGroups);
  reg(app, "/api/multi-entity/v1/entities", pfData["/v1/entities"] ?? []);
  reg(app, "/api/notification-service/v1/notifications", pfData["/v1/notifications"] ?? []);
  reg(app, "/api/offline-resilience/v1/connectivity/profiles", offlineCapabilities);
  reg(app, "/api/opensearch-analytics/v1/analytics/dashboards", pfData["/v1/analytics/dashboards"] ?? []);
  reg(app, "/api/otc-derivatives/v1/otc/contracts", pfData["/v1/otc/contracts"] ?? []);
  reg(app, "/api/payment-investigation/v1/investigations", pfData["/v1/investigations"] ?? []);
  reg(app, "/api/pbac-engine/v1/pbac/policies", pbacPolicies);
  reg(app, "/api/project-finance/v1/projects", pfData["/v1/projects"] ?? []);
  reg(app, "/api/regulatory-automation/v1/regulatory/returns", regulatoryReturns);
  reg(app, "/api/savings-products/v1/savings/products", pfData["/v1/savings/products"] ?? []);
  reg(app, "/api/security-hardening/v1/security/policies", securityPolicies);
  reg(app, "/api/standing-orders/v1/standing-orders", pfData["/v1/standing-orders"] ?? []);
  reg(app, "/api/swift-messaging/v1/swift/messages", swiftMessages);
  reg(app, "/api/tenant-billing/v1/billing/records", pfData["/v1/billing/records"] ?? []);
  reg(app, "/api/tenant-export/v1/exports", pfData["/v1/exports"] ?? []);
  reg(app, "/api/tenant-ratelimit/v1/rate-limits", pfData["/v1/rate-limits"] ?? []);
  reg(app, "/api/treasury-liquidity/v1/treasury/liquidity", pfData["/v1/treasury/liquidity"] ?? []);
  reg(app, "/api/utility-payments/v1/utility-payments", pfData["/v1/utility-payments"] ?? []);
  reg(app, "/api/workflow-engine/v1/workflow/definitions", pfData["/v1/workflow/definitions"] ?? []);

  // ── Remaining 11 business services ──
  reg(app, "/api/accounting-rules/v1/rules", [
    { id: "AR-001", name: "Revenue Recognition", type: "IFRS15", status: "active", accounts: ["4001", "4002"], description: "Revenue recognition for banking services" },
    { id: "AR-002", name: "Loan Impairment", type: "IFRS9", status: "active", accounts: ["1501", "5001"], description: "Expected credit loss provisioning" },
    { id: "AR-003", name: "Depreciation", type: "IAS16", status: "active", accounts: ["1301", "5201"], description: "Fixed asset depreciation - straight line" },
  ]);
  reg(app, "/api/billing-event-processor/v1/billing/events", billingEvents);
  reg(app, "/api/db-migrations/v1/migrations", [
    { id: "MIG-001", version: "001", name: "create_customers_table", status: "applied", appliedAt: "2026-01-15T10:00:00Z" },
    { id: "MIG-002", version: "002", name: "create_accounts_table", status: "applied", appliedAt: "2026-01-15T10:01:00Z" },
    { id: "MIG-003", version: "003", name: "create_transactions_table", status: "applied", appliedAt: "2026-01-15T10:02:00Z" },
    { id: "MIG-004", version: "004", name: "add_tenant_rls_policies", status: "applied", appliedAt: "2026-02-01T08:00:00Z" },
    { id: "MIG-005", version: "005", name: "create_audit_trail_table", status: "applied", appliedAt: "2026-03-10T09:00:00Z" },
  ]);
  reg(app, "/api/eod-processor/v1/eod/runs", [
    { id: "EOD-001", date: "2026-05-09", status: "completed", startedAt: "2026-05-09T23:00:00Z", completedAt: "2026-05-09T23:45:00Z", accountsProcessed: 2500000, transactionsSettled: 850000 },
    { id: "EOD-002", date: "2026-05-08", status: "completed", startedAt: "2026-05-08T23:00:00Z", completedAt: "2026-05-08T23:42:00Z", accountsProcessed: 2480000, transactionsSettled: 820000 },
  ]);
  reg(app, "/api/exam-management/v1/exams", [
    { id: "EXM-001", name: "CBN Regulatory Exam Q2 2026", type: "regulatory", status: "scheduled", date: "2026-06-15", scope: "Capital Adequacy", examiner: "CBN Supervisory Team" },
    { id: "EXM-002", name: "Annual Internal Audit", type: "internal", status: "completed", date: "2026-03-30", scope: "Full Platform", examiner: "Deloitte Nigeria" },
  ]);
  reg(app, "/api/lcr-nsfr/v1/liquidity-ratios", [
    { id: "LCR-001", metric: "LCR", value: 185.5, threshold: 100, status: "compliant", date: "2026-03-31", currency: "NGN" },
    { id: "LCR-002", metric: "NSFR", value: 142.3, threshold: 100, status: "compliant", date: "2026-03-31", currency: "NGN" },
  ]);
  reg(app, "/api/maker-checker/v1/approvals", [
    { id: "MC-001", entityType: "transfer", entityId: "TXN-80001", maker: "teller@54bank.ng", checker: "supervisor@54bank.ng", status: "approved", amount: 50000000, currency: "NGN" },
    { id: "MC-002", entityType: "account_opening", entityId: "ACC-90001", maker: "cso@54bank.ng", checker: "branch_manager@54bank.ng", status: "pending", amount: 0, currency: "NGN" },
  ]);
  reg(app, "/api/mandate-management/v1/mandates", [
    { id: "MAN-001", customerId: "CUS-001", type: "direct_debit", status: "active", beneficiary: "FIRS", maxAmount: 5000000, currency: "NGN", frequency: "monthly" },
    { id: "MAN-002", customerId: "CUS-002", type: "standing_instruction", status: "active", beneficiary: "Lagos State IRS", maxAmount: 2000000, currency: "NGN", frequency: "monthly" },
  ]);
  reg(app, "/api/multicurrency-revaluation/v1/revaluations", [
    { id: "REVAL-001", currency: "USD", openRate: 1575.50, closeRate: 1582.75, unrealizedPnL: 725000000, date: "2026-05-09", status: "completed" },
    { id: "REVAL-002", currency: "EUR", openRate: 1710.00, closeRate: 1722.75, unrealizedPnL: 382500000, date: "2026-05-09", status: "completed" },
    { id: "REVAL-003", currency: "GBP", openRate: 1998.00, closeRate: 2013.00, unrealizedPnL: 450000000, date: "2026-05-09", status: "completed" },
  ]);
  reg(app, "/api/relationship-pricing/v1/pricing/tiers", [
    { id: "RP-001", segment: "Premium", tier: "Platinum", minBalance: 100000000, transferFee: 0, fxSpread: 0.15, loanDiscount: 2.0, currency: "NGN" },
    { id: "RP-002", segment: "Business", tier: "Gold", minBalance: 25000000, transferFee: 50, fxSpread: 0.25, loanDiscount: 1.0, currency: "NGN" },
    { id: "RP-003", segment: "Retail", tier: "Standard", minBalance: 0, transferFee: 100, fxSpread: 0.50, loanDiscount: 0, currency: "NGN" },
  ]);
  reg(app, "/api/statement-generator/v1/statements", [
    { id: "STM-001", accountNumber: "0012345678", period: "2026-04", format: "pdf", status: "generated", pages: 12, generatedAt: "2026-05-01T06:00:00Z" },
    { id: "STM-002", accountNumber: "0023456789", period: "2026-04", format: "csv", status: "generated", pages: 0, generatedAt: "2026-05-01T06:05:00Z" },
  ]);
}

// ═══════════════════════════════════════════════════════════════════
//  FEATURE FLAG TENANT CUSTOMIZATION ENGINE
// ═══════════════════════════════════════════════════════════════════

// Service catalog flag categories
const FLAG_CATEGORIES = [
  "core_banking", "payments", "cards_digital", "mobile_money", "lending",
  "treasury", "trade_finance", "wealth_management", "accounting",
  "risk_compliance", "agent_banking", "microfinance", "islamic_banking",
  "diaspora_banking", "cooperative_banking", "agriculture_banking",
  "billing", "multi_tenant",
  // Growth Features (Enhancements 13-20)
  "chatbot", "smart_savings", "virtual_cards", "qr_payments",
  "bnpl", "investments", "remittances", "gamification",
];

// Route-to-flag mapping for API middleware
const ROUTE_FLAG_MAP: Record<string, string> = {
  "/api/account-opening": "core_banking",
  "/api/customer": "core_banking",
  "/api/beneficiary": "core_banking",
  "/api/interest": "core_banking",
  "/api/fixed-deposit": "core_banking",
  "/api/savings": "core_banking",
  "/api/dormancy": "core_banking",
  "/api/standing": "core_banking",
  "/api/branch": "core_banking",
  "/api/teller": "core_banking",
  "/api/atm": "core_banking",
  "/api/pos": "core_banking",
  "/api/channel": "core_banking",
  "/api/transfer": "payments",
  "/api/payment": "payments",
  "/api/bulk-payment": "payments",
  "/api/utility-payment": "payments",
  "/api/bill-payment": "payments",
  "/api/direct-debit": "payments",
  "/api/mandate": "payments",
  "/api/collection": "payments",
  "/api/disbursement": "payments",
  "/api/card": "cards_digital",
  "/api/virtual-card": "cards_digital",
  "/api/qr": "cards_digital",
  "/api/wallet": "cards_digital",
  "/api/mobile-money": "mobile_money",
  "/api/ussd": "mobile_money",
  "/api/loan": "lending",
  "/api/credit": "lending",
  "/api/collateral": "lending",
  "/api/education-loan": "lending",
  "/api/group-lending": "lending",
  "/api/leasing": "lending",
  "/api/mortgage": "lending",
  "/api/treasury": "treasury",
  "/api/fx": "treasury",
  "/api/money-market": "treasury",
  "/api/otc": "treasury",
  "/api/securities": "treasury",
  "/api/cash-pooling": "treasury",
  "/api/trade-finance": "trade_finance",
  "/api/letter-of-credit": "trade_finance",
  "/api/bank-guarantee": "trade_finance",
  "/api/project-finance": "trade_finance",
  "/api/swift": "trade_finance",
  "/api/iso20022": "trade_finance",
  "/api/escrow": "trade_finance",
  "/api/wealth": "wealth_management",
  "/api/portfolio": "wealth_management",
  "/api/pension": "wealth_management",
  "/api/insurance": "wealth_management",
  "/api/gl": "accounting",
  "/api/gl-engine": "accounting",
  "/api/chart-of-accounts": "accounting",
  "/api/accounting-rules": "accounting",
  "/api/eod": "accounting",
  "/api/reconciliation": "accounting",
  "/api/statement": "accounting",
  "/api/risk": "risk_compliance",
  "/api/compliance": "risk_compliance",
  "/api/regulatory": "risk_compliance",
  "/api/aml": "risk_compliance",
  "/api/kyc": "risk_compliance",
  "/api/kyb": "risk_compliance",
  "/api/fraud": "risk_compliance",
  "/api/sanctions": "risk_compliance",
  "/api/ifrs9": "risk_compliance",
  "/api/lcr-nsfr": "risk_compliance",
  "/api/basel": "risk_compliance",
  "/api/agent-banking": "agent_banking",
  "/api/microfinance": "microfinance",
  "/api/islamic": "islamic_banking",
  "/api/diaspora": "diaspora_banking",
  "/api/esusu": "cooperative_banking",
  "/api/agriculture": "agriculture_banking",
  "/api/farm": "agriculture_banking",
  "/api/crop": "agriculture_banking",
  "/api/livestock": "agriculture_banking",
  "/api/warehouse": "agriculture_banking",
  "/api/commodity": "agriculture_banking",
  "/api/billing": "billing",
  "/api/pricing": "billing",
  "/api/revenue": "billing",
  // Growth Features (Enhancements 13-20)
  "/api/enhancements/chatbot": "chatbot",
  "/api/enhancements/smart-savings": "smart_savings",
  "/api/enhancements/virtual-cards": "virtual_cards",
  "/api/enhancements/qr-payments": "qr_payments",
  "/api/enhancements/bnpl": "bnpl",
  "/api/enhancements/investments": "investments",
  "/api/enhancements/remittances": "remittances",
  "/api/enhancements/gamification": "gamification",
  "/api/growth": "chatbot",
};

// In-memory tenant flag store
interface TenantFlags {
  tenantId: string;
  flags: { key: string; enabled: boolean; rolloutPct: number }[];
}

const tenantFlagStore = new Map<string, TenantFlags>();

// Default: platform admin has everything enabled
tenantFlagStore.set("TEN-PLATFORM-ADMIN", {
  tenantId: "TEN-PLATFORM-ADMIN",
  flags: FLAG_CATEGORIES.map((key) => ({ key, enabled: true, rolloutPct: 100 })),
});
// Example tenant with limited modules
tenantFlagStore.set("TEN-GTBANK", {
  tenantId: "TEN-GTBANK",
  flags: FLAG_CATEGORIES.map((key) => ({ key, enabled: true, rolloutPct: 100 })),
});
tenantFlagStore.set("TEN-MUTUAL-MFB", {
  tenantId: "TEN-MUTUAL-MFB",
  flags: [
    { key: "core_banking", enabled: true, rolloutPct: 100 },
    { key: "payments", enabled: true, rolloutPct: 100 },
    { key: "mobile_money", enabled: true, rolloutPct: 100 },
    { key: "lending", enabled: true, rolloutPct: 100 },
    { key: "microfinance", enabled: true, rolloutPct: 100 },
    { key: "accounting", enabled: true, rolloutPct: 100 },
    { key: "risk_compliance", enabled: true, rolloutPct: 100 },
    { key: "billing", enabled: true, rolloutPct: 100 },
    { key: "cooperative_banking", enabled: true, rolloutPct: 100 },
    { key: "treasury", enabled: false, rolloutPct: 0 },
    { key: "trade_finance", enabled: false, rolloutPct: 0 },
    { key: "wealth_management", enabled: false, rolloutPct: 0 },
    { key: "cards_digital", enabled: false, rolloutPct: 0 },
    { key: "agent_banking", enabled: false, rolloutPct: 0 },
    { key: "islamic_banking", enabled: false, rolloutPct: 0 },
    { key: "diaspora_banking", enabled: false, rolloutPct: 0 },
    { key: "agriculture_banking", enabled: false, rolloutPct: 0 },
    { key: "multi_tenant", enabled: false, rolloutPct: 0 },
  ],
});

export function registerFeatureFlagEngine(app: Express) {
  // GET tenant flags (for sidebar filtering)
  app.get("/api/feature-flag-engine/v1/tenant-flags", (req: Request, res: Response) => {
    const tenantId = (req.headers["x-tenant-id"] as string) || "TEN-PLATFORM-ADMIN";
    const config = tenantFlagStore.get(tenantId) ?? tenantFlagStore.get("TEN-PLATFORM-ADMIN")!;
    res.json({
      items: config.flags.map((f) => ({
        key: f.key,
        label: FLAG_CATEGORIES.find((c) => c === f.key) ?? f.key,
        enabled: f.enabled,
        rolloutPct: f.rolloutPct,
        category: f.key,
        tenantId: config.tenantId,
      })),
      tenantId: config.tenantId,
      total: config.flags.length,
    });
  });

  // PUT update tenant flags (from Service Catalog UI)
  app.put("/api/feature-flag-engine/v1/tenant-flags", (req: Request, res: Response) => {
    const { tenantId, flags } = req.body as { tenantId: string; flags: { key: string; enabled: boolean; rolloutPct: number }[] };
    if (!tenantId || !flags) {
      res.status(400).json({ error: "tenantId and flags required" });
      return;
    }
    tenantFlagStore.set(tenantId, { tenantId, flags });
    res.json({ success: true, tenantId, flagCount: flags.length });
  });

  // GET all tenants' flag configs (for admin view)
  app.get("/api/feature-flag-engine/v1/tenant-flags/all", (_: Request, res: Response) => {
    const all: TenantFlags[] = [];
    tenantFlagStore.forEach((v) => all.push(v));
    res.json({ items: all, total: all.length });
  });

  // White label config endpoint
  app.put("/api/white-label-engine/v1/config", (req: Request, res: Response) => {
    const { partnerId, subTenants } = req.body as { partnerId: string; subTenants: unknown[] };
    res.json({ success: true, partnerId, subTenantCount: subTenants?.length ?? 0 });
  });

  // POST provision a new tenant with initial feature flags
  app.post("/api/tenant-provisioning/v1/provision", (req: Request, res: Response) => {
    const { tenantId, tenantName, package: pkg, customFlags } = req.body as {
      tenantId: string; tenantName: string; package: string; customFlags?: string[];
    };
    if (!tenantId || !tenantName || !pkg) {
      res.status(400).json({ error: "tenantId, tenantName, and package required" });
      return;
    }

    // Preset packages
    const PRESETS: Record<string, string[]> = {
      enterprise: FLAG_CATEGORIES,
      standard: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "accounting", "risk_compliance", "billing", "chatbot", "smart_savings", "virtual_cards", "qr_payments"],
      basic: ["core_banking", "payments", "mobile_money", "billing", "chatbot"],
      microfinance: ["core_banking", "payments", "mobile_money", "lending", "microfinance", "accounting", "risk_compliance", "billing", "cooperative_banking", "smart_savings", "gamification"],
      agent_banking: ["core_banking", "payments", "mobile_money", "agent_banking", "agriculture_banking", "billing", "qr_payments", "chatbot"],
      islamic: ["core_banking", "payments", "lending", "accounting", "risk_compliance", "islamic_banking", "billing", "smart_savings", "investments"],
      digital_bank: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "accounting", "risk_compliance", "billing", "chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"],
      fintech: ["payments", "cards_digital", "mobile_money", "billing", "chatbot", "virtual_cards", "qr_payments", "bnpl", "gamification"],
    };

    const enabledKeys = customFlags ?? PRESETS[pkg] ?? PRESETS.basic;
    const flags = FLAG_CATEGORIES.map((key) => ({
      key,
      enabled: enabledKeys.includes(key),
      rolloutPct: enabledKeys.includes(key) ? 100 : 0,
    }));

    tenantFlagStore.set(tenantId, { tenantId, flags });

    res.json({
      success: true,
      tenantId,
      tenantName,
      package: pkg,
      modulesEnabled: enabledKeys.length,
      provisioningSteps: [
        "create_tenant", "setup_database", "apply_rls_policies",
        "configure_keycloak", "setup_permify_roles", "create_kafka_topics",
        "initialize_tigerbeetle_accounts", "setup_opensearch_indices",
        "configure_redis_cache", "register_dapr_components",
        "setup_temporal_workflows", "assign_feature_flags",
        "configure_billing", "deploy_white_label",
        "provision_growth_features", "setup_growth_kafka_topics",
        "configure_growth_temporal_workflows",
      ],
      flags,
    });
  });

  // Service catalog endpoint — list available modules
  app.get("/api/service-catalog/v1/modules", (_: Request, res: Response) => {
    res.json({
      items: FLAG_CATEGORIES.map((key) => ({
        key,
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        available: true,
      })),
      total: FLAG_CATEGORIES.length,
    });
  });
}

// Feature flag API middleware — checks tenant's enabled flags before routing
export function featureFlagMiddleware(app: Express) {
  app.use("/api", (req: Request, res: Response, next: () => void) => {
    // Skip healthz, feature-flag-engine itself, and non-gated paths
    if (req.path.includes("/healthz") || req.path.includes("/feature-flag-engine") ||
        req.path.includes("/service-catalog") || req.path.includes("/white-label") ||
        req.path.includes("/platform") || req.method === "OPTIONS") {
      next();
      return;
    }

    const tenantId = (req.headers["x-tenant-id"] as string) || "TEN-PLATFORM-ADMIN";
    const config = tenantFlagStore.get(tenantId);

    // Platform admin bypasses all checks
    if (!config || tenantId === "TEN-PLATFORM-ADMIN") {
      next();
      return;
    }

    // Find matching flag for this route
    const routePrefix = Object.keys(ROUTE_FLAG_MAP).find((prefix) =>
      req.path.startsWith(prefix.replace("/api", "")),
    );

    if (!routePrefix) {
      next();
      return;
    }

    const flagKey = ROUTE_FLAG_MAP[routePrefix];
    const flag = config.flags.find((f) => f.key === flagKey);

    if (flag && !flag.enabled) {
      res.status(403).json({
        error: "Module not enabled for this tenant",
        module: flagKey,
        tenantId,
        message: `The ${flagKey.replace(/_/g, " ")} module is not enabled for tenant ${tenantId}. Contact your platform administrator to enable this module.`,
      });
      return;
    }

    next();
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PROXY FALLBACK — returns seeded data when upstream is unavailable
// ═══════════════════════════════════════════════════════════════════

export const fallbackRegistry = new Map<string, unknown[]>();

// Populate from the same data used above, keyed by the service-level path
// (the path parameter passed to proxyToService, e.g. "/v1/agriculture/farmers")
const proxyFallbackData: Record<string, unknown[]> = {
  // Agriculture
  "/v1/agriculture/farmers": [
    { id: "FRM-001", name: "Alhaji Musa Danladi", state: "Kano", lga: "Dawakin Kudu", farmSize: 50, cropType: "Rice", status: "active", bvn: "22100000001", loanBalance: 5000000 },
    { id: "FRM-002", name: "Mrs. Ngozi Okonkwo", state: "Anambra", lga: "Awka South", farmSize: 25, cropType: "Cassava", status: "active", bvn: "22200000002", loanBalance: 2500000 },
    { id: "FRM-003", name: "Baba Adamu Yusuf", state: "Kaduna", lga: "Zaria", farmSize: 100, cropType: "Maize", status: "active", bvn: "22300000003", loanBalance: 8000000 },
    { id: "FRM-004", name: "Chief Emeka Ibe", state: "Imo", lga: "Owerri West", farmSize: 15, cropType: "Palm Oil", status: "active", bvn: "22400000004", loanBalance: 3500000 },
    { id: "FRM-005", name: "Hajia Fatima Bello", state: "Sokoto", lga: "Sokoto South", farmSize: 75, cropType: "Millet", status: "active", bvn: "22500000005", loanBalance: 6000000 },
  ],
  "/v1/agriculture/loans": [
    { id: "AGL-001", farmerId: "FRM-001", amount: 5000000, currency: "NGN", interestRate: 9, tenor: 12, status: "disbursed", purpose: "Rice cultivation inputs", collateral: "Warehouse receipt" },
    { id: "AGL-002", farmerId: "FRM-002", amount: 2500000, currency: "NGN", interestRate: 9, tenor: 12, status: "repaying", purpose: "Cassava processing equipment", collateral: "Farm land" },
    { id: "AGL-003", farmerId: "FRM-003", amount: 8000000, currency: "NGN", interestRate: 7, tenor: 24, status: "disbursed", purpose: "Mechanized farming equipment", collateral: "Tractor & implements" },
  ],
  "/v1/agriculture/insurance": [
    { id: "AGI-001", farmerId: "FRM-001", policyNumber: "AGI-2026-001", coverage: "Crop failure", premium: 250000, sumAssured: 5000000, status: "active", provider: "NAIC Nigeria" },
    { id: "AGI-002", farmerId: "FRM-003", policyNumber: "AGI-2026-002", coverage: "Weather index", premium: 400000, sumAssured: 8000000, status: "active", provider: "Leadway Assurance" },
    { id: "AGI-003", farmerId: "FRM-005", policyNumber: "AGI-2026-003", coverage: "Livestock mortality", premium: 180000, sumAssured: 3000000, status: "active", provider: "AXA Mansard" },
  ],
  "/v1/agriculture/weather": [
    { id: "WEA-001", location: "Kano", temperature: 35, humidity: 42, rainfall: 0, forecast: "Clear", updatedAt: "2026-05-09T12:00:00Z" },
    { id: "WEA-002", location: "Anambra", temperature: 28, humidity: 78, rainfall: 15, forecast: "Rain expected", updatedAt: "2026-05-09T12:00:00Z" },
  ],
  "/v1/agriculture/warehouse-receipts": [
    { id: "WR-001", farmerId: "FRM-001", commodity: "Rice (50kg bags)", quantity: 500, warehouse: "Kano Central Silo", status: "active", value: 25000000, issueDate: "2026-04-01" },
    { id: "WR-002", farmerId: "FRM-003", commodity: "Maize (50kg bags)", quantity: 800, warehouse: "Kaduna Grain Store", status: "active", value: 20000000, issueDate: "2026-03-15" },
  ],
  "/v1/agriculture/value-chain": [
    { id: "VC-001", name: "Rice Value Chain", stages: 6, activeParticipants: 250, totalFinancing: 500000000, status: "active" },
    { id: "VC-002", name: "Cassava Value Chain", stages: 5, activeParticipants: 180, totalFinancing: 300000000, status: "active" },
  ],
  "/v1/agriculture/ussd": [
    { id: "USSD-001", code: "*54bank*1#", description: "Check farm loan balance", usageCount: 15000, status: "active" },
    { id: "USSD-002", code: "*54bank*2#", description: "Request loan disbursement", usageCount: 8000, status: "active" },
  ],

  // Account service
  "/v1/accounts/applications": [
    { id: "APP-001", customerName: "Adebola Ogundimu", accountType: "savings", status: "approved", bvn: "22100000010", state: "Lagos", submittedAt: "2026-05-08T09:00:00Z" },
    { id: "APP-002", customerName: "Mohammed Sani", accountType: "current", status: "pending", bvn: "22200000011", state: "Kano", submittedAt: "2026-05-09T10:30:00Z" },
    { id: "APP-003", customerName: "Chioma Nwosu", accountType: "savings", status: "approved", bvn: "22300000012", state: "Enugu", submittedAt: "2026-05-07T14:00:00Z" },
    { id: "APP-004", customerName: "Folashade Bakare", accountType: "domiciliary", status: "under_review", bvn: "22400000013", state: "Oyo", submittedAt: "2026-05-09T08:15:00Z" },
  ],

  // ATM Management
  "/v1/atm/terminals": [
    { id: "ATM-001", terminalId: "ATM-LAG-001", location: "Lagos Marina", status: "online", cashLevel: 85, lastReplenished: "2026-05-09T06:00:00Z", model: "NCR SelfServ 80", dailyTransactions: 450 },
    { id: "ATM-002", terminalId: "ATM-ABJ-001", location: "Abuja Garki", status: "online", cashLevel: 62, lastReplenished: "2026-05-08T18:00:00Z", model: "Diebold Nixdorf DN200", dailyTransactions: 380 },
    { id: "ATM-003", terminalId: "ATM-KAN-001", location: "Kano City Gate", status: "online", cashLevel: 45, lastReplenished: "2026-05-08T12:00:00Z", model: "NCR SelfServ 80", dailyTransactions: 280 },
    { id: "ATM-004", terminalId: "ATM-PHC-001", location: "Port Harcourt GRA", status: "maintenance", cashLevel: 0, lastReplenished: "2026-05-07T10:00:00Z", model: "Hyosung MX8800", dailyTransactions: 0 },
  ],

  // Teller service
  "/v1/teller/sessions": [
    { id: "TS-001", tellerId: "TLR-001", tellerName: "Amaka Obi", branch: "Lagos Marina", status: "active", openedAt: "2026-05-09T08:00:00Z", cashDrawerBalance: 15000000, transactionCount: 45 },
    { id: "TS-002", tellerId: "TLR-002", tellerName: "Yusuf Garba", branch: "Kano Nassarawa", status: "active", openedAt: "2026-05-09T08:30:00Z", cashDrawerBalance: 8500000, transactionCount: 32 },
  ],

  // Card Management
  "/v1/cards": [
    { id: "CARD-001", pan: "****1234", type: "Verve Debit", status: "active", holder: "Adebayo Ogunlesi", issueDate: "2025-06-01", expiryDate: "2028-06-01", dailyLimit: 5000000 },
    { id: "CARD-002", pan: "****5678", type: "Mastercard Platinum", status: "active", holder: "Amina Bello", issueDate: "2025-03-15", expiryDate: "2028-03-15", dailyLimit: 10000000 },
    { id: "CARD-003", pan: "****9012", type: "Visa Gold", status: "active", holder: "Emeka Okafor", issueDate: "2025-09-01", expiryDate: "2028-09-01", dailyLimit: 8000000 },
  ],

  // Accounting
  "/v1/accounting/rules": [
    { id: "AR-001", name: "Interest Accrual Rule", type: "accrual", frequency: "daily", status: "active", affectedGLs: "GL-4000,GL-1200", automationLevel: "fully_automated" },
    { id: "AR-002", name: "Fee Income Recognition", type: "revenue_recognition", frequency: "transaction", status: "active", affectedGLs: "GL-4100,GL-2300", automationLevel: "fully_automated" },
    { id: "AR-003", name: "Loan Loss Provisioning", type: "provisioning", frequency: "monthly", status: "active", affectedGLs: "GL-5100,GL-1200", automationLevel: "semi_automated" },
  ],

  // Bulk Payments
  "/v1/bulk-payments/batches": [
    { id: "BP-001", batchName: "May Salary Payment", totalRecords: 5000, processedRecords: 5000, totalAmount: 2500000000, currency: "NGN", status: "completed", initiatedBy: "HR Department" },
    { id: "BP-002", batchName: "Vendor Payments Q2", totalRecords: 250, processedRecords: 248, totalAmount: 850000000, currency: "NGN", status: "completed_with_errors", initiatedBy: "Procurement" },
    { id: "BP-003", batchName: "Pension Contributions", totalRecords: 3500, processedRecords: 0, totalAmount: 750000000, currency: "NGN", status: "pending", initiatedBy: "Finance" },
  ],

  // Agent Banking
  "/v1/agents": [
    { id: "AGT-001", name: "Mama Nkechi POS Center", tier: "super_agent", state: "Lagos", lga: "Ikeja", status: "active", monthlyVolume: 15000, balance: 5000000 },
    { id: "AGT-002", name: "Alhaji Garba Mobile Money", tier: "master_agent", state: "Kano", lga: "Nassarawa", status: "active", monthlyVolume: 25000, balance: 10000000 },
    { id: "AGT-003", name: "Chioma Digital Hub", tier: "agent", state: "Enugu", lga: "Nsukka", status: "active", monthlyVolume: 5000, balance: 1000000 },
    { id: "AGT-004", name: "Baba Alaye Pay Point", tier: "agent", state: "Oyo", lga: "Ibadan North", status: "active", monthlyVolume: 8000, balance: 2000000 },
    { id: "AGT-005", name: "Port Harcourt Express Agent", tier: "super_agent", state: "Rivers", lga: "Port Harcourt", status: "active", monthlyVolume: 12000, balance: 4000000 },
    { id: "AGT-006", name: "Abuja Central Agency", tier: "master_agent", state: "FCT", lga: "Municipal", status: "active", monthlyVolume: 30000, balance: 15000000 },
  ],

  // Payments
  "/v1/payments/transactions": [
    { id: "PAY-001", type: "NIP Transfer", amount: 500000, currency: "NGN", sender: "Adebayo Ogunlesi", receiver: "Amina Bello", status: "completed", channel: "mobile_app", timestamp: "2026-05-09T14:30:00Z" },
    { id: "PAY-002", type: "NEFT", amount: 2500000, currency: "NGN", sender: "Dangote Industries", receiver: "BUA Cement", status: "completed", channel: "corporate_portal", timestamp: "2026-05-09T10:00:00Z" },
    { id: "PAY-003", type: "RTGS", amount: 50000000, currency: "NGN", sender: "Shell Nigeria", receiver: "NNPC Ltd", status: "completed", channel: "treasury_desk", timestamp: "2026-05-09T11:30:00Z" },
  ],

  // Collateral
  "/v1/valuations": [
    { id: "VAL-001", assetType: "Commercial Property", location: "Victoria Island, Lagos", marketValue: 850000000, forcedSaleValue: 600000000, valuationDate: "2026-04-15", valuer: "Knight Frank Nigeria", status: "current" },
    { id: "VAL-002", assetType: "Residential Property", location: "Maitama, Abuja", marketValue: 350000000, forcedSaleValue: 250000000, valuationDate: "2026-03-20", valuer: "Broll Nigeria", status: "current" },
    { id: "VAL-003", assetType: "Industrial Equipment", location: "Apapa, Lagos", marketValue: 120000000, forcedSaleValue: 80000000, valuationDate: "2026-04-01", valuer: "Messrs Ogunbiyi & Co", status: "current" },
  ],

  // Credit Bureau
  "/v1/credit-bureau/reports": [
    { id: "CR-001", bvn: "22100000001", creditScore: 750, riskGrade: "A", activeLoans: 2, totalExposure: 15000000, defaultHistory: false, bureau: "CRC Credit Bureau", reportDate: "2026-05-09" },
    { id: "CR-002", bvn: "22200000011", creditScore: 680, riskGrade: "B", activeLoans: 1, totalExposure: 5000000, defaultHistory: false, bureau: "FirstCentral", reportDate: "2026-05-08" },
    { id: "CR-003", bvn: "22300000012", creditScore: 520, riskGrade: "D", activeLoans: 3, totalExposure: 25000000, defaultHistory: true, bureau: "CreditRegistry", reportDate: "2026-05-07" },
  ],

  // Customer insights
  "/v1/insights/churn": [
    { id: "CHN-001", segment: "Retail Savings", churnRisk: 12.5, atRiskCustomers: 1250, totalCustomers: 10000, topReason: "Low interest rates", retentionActions: 3 },
    { id: "CHN-002", segment: "SME Current", churnRisk: 8.2, atRiskCustomers: 410, totalCustomers: 5000, topReason: "High fees", retentionActions: 5 },
    { id: "CHN-003", segment: "Corporate", churnRisk: 3.1, atRiskCustomers: 31, totalCustomers: 1000, topReason: "Competitor offering", retentionActions: 2 },
  ],

  // Data Export
  "/v1/exports/jobs": [
    { id: "EXP-001", name: "Monthly Transaction Report", format: "CSV", status: "completed", recordCount: 1250000, fileSize: "450 MB", createdAt: "2026-05-01T06:00:00Z", downloadUrl: "/api/platform/exports/EXP-001/download" },
    { id: "EXP-002", name: "Customer Master Data", format: "JSON", status: "completed", recordCount: 850000, fileSize: "280 MB", createdAt: "2026-05-02T08:00:00Z", downloadUrl: "/api/platform/exports/EXP-002/download" },
  ],

  // Documents
  "/v1/documents": [
    { id: "DOC-001", name: "Account Opening Form", type: "form", category: "onboarding", status: "active", version: "3.2", lastUpdated: "2026-04-01", downloads: 15000 },
    { id: "DOC-002", name: "KYC Verification Report", type: "report", category: "compliance", status: "active", version: "2.1", lastUpdated: "2026-05-01", downloads: 8500 },
    { id: "DOC-003", name: "Loan Agreement Template", type: "template", category: "lending", status: "active", version: "4.0", lastUpdated: "2026-03-15", downloads: 12000 },
  ],

  // Face Match
  "/v1/matches": [
    { id: "FM-001", customerId: "CUST-1001", matchScore: 99.2, status: "verified", method: "liveness_3d", capturedAt: "2026-05-09T10:30:00Z", device: "iPhone 15 Pro" },
    { id: "FM-002", customerId: "CUST-2045", matchScore: 97.8, status: "verified", method: "liveness_3d", capturedAt: "2026-05-09T09:15:00Z", device: "Samsung Galaxy S24" },
    { id: "FM-003", customerId: "CUST-3078", matchScore: 65.4, status: "manual_review", method: "photo_comparison", capturedAt: "2026-05-08T16:00:00Z", device: "Web Camera" },
  ],

  // Feedback
  "/v1/feedback/entries": [
    { id: "FB-001", customer: "Anonymous", channel: "mobile_app", rating: 5, category: "user_experience", comment: "The new dashboard is excellent!", status: "acknowledged", timestamp: "2026-05-09T12:00:00Z" },
    { id: "FB-002", customer: "Adebayo O.", channel: "branch", rating: 3, category: "wait_time", comment: "Long queue at Lagos Marina branch", status: "escalated", timestamp: "2026-05-08T15:00:00Z" },
    { id: "FB-003", customer: "Fatima B.", channel: "call_center", rating: 4, category: "service_quality", comment: "Helpful agent resolved my issue", status: "closed", timestamp: "2026-05-07T10:00:00Z" },
  ],

  // KYC Engine
  "/v1/verifications": [
    { id: "VER-001", customerId: "CUST-NEW-001", type: "bvn_verification", status: "verified", provider: "NIBSS", verifiedAt: "2026-05-09T10:00:00Z", confidence: 100 },
    { id: "VER-002", customerId: "CUST-NEW-002", type: "nin_verification", status: "verified", provider: "NIMC", verifiedAt: "2026-05-09T09:30:00Z", confidence: 99.5 },
    { id: "VER-003", customerId: "CUST-NEW-003", type: "address_verification", status: "pending", provider: "YouVerify", verifiedAt: null, confidence: 0 },
  ],

  // Liveness Detection
  "/v1/checks": [
    { id: "LIV-001", customerId: "CUST-1001", result: "live", confidence: 99.8, method: "3d_depth_analysis", device: "iPhone 15 Pro", timestamp: "2026-05-09T10:30:00Z" },
    { id: "LIV-002", customerId: "CUST-2045", result: "live", confidence: 98.5, method: "blink_detection", device: "Samsung Galaxy S24", timestamp: "2026-05-09T09:15:00Z" },
  ],

  // Loan Origination
  "/v1/loans/applications": [
    { id: "LA-001", customerName: "Olufemi Adeyemi", amount: 25000000, currency: "NGN", productType: "SME Term Loan", status: "approved", tenor: 36, interestRate: 18, branch: "Lagos Marina" },
    { id: "LA-002", customerName: "Hauwa Ibrahim", amount: 5000000, currency: "NGN", productType: "Personal Loan", status: "under_review", tenor: 12, interestRate: 22, branch: "Abuja Central" },
    { id: "LA-003", customerName: "Chinedu Okeke", amount: 100000000, currency: "NGN", productType: "Mortgage", status: "pending_valuation", tenor: 240, interestRate: 14, branch: "Port Harcourt GRA" },
  ],

  // Account Statements
  "/v1/statements/accounts": [
    { id: "SA-001", accountNumber: "0012345678", accountName: "Adebayo Ogunlesi", type: "savings", currency: "NGN", balance: 15000000, lastTransaction: "2026-05-09T14:30:00Z", branch: "Lagos Marina" },
    { id: "SA-002", accountNumber: "0023456789", accountName: "Amina Bello", type: "current", currency: "NGN", balance: 45000000, lastTransaction: "2026-05-09T12:00:00Z", branch: "Abuja Central" },
    { id: "SA-003", accountNumber: "0034567890", accountName: "Emeka Okafor", type: "domiciliary", currency: "USD", balance: 125000, lastTransaction: "2026-05-08T16:00:00Z", branch: "Port Harcourt GRA" },
  ],

  // ── Additional service fallback data (47 previously unwired services) ──

  // AB Testing
  "/v1/ab-tests/experiments": [
    { id: "ABT-001", name: "Mobile Login Flow", status: "active", variants: 3, participants: 12500, startDate: "2026-04-01", tenantId: "TEN-GTBANK" },
    { id: "ABT-002", name: "Card Application UX", status: "completed", variants: 2, participants: 8400, startDate: "2026-03-15", tenantId: "TEN-FIRSTBANK" },
  ],

  // API Marketplace
  "/v1/marketplace/apis": [
    { id: "API-001", name: "Account Balance API", version: "v2", calls: 2500000, status: "published", category: "core-banking" },
    { id: "API-002", name: "Payment Initiation API", version: "v1", calls: 1800000, status: "published", category: "payments" },
    { id: "API-003", name: "KYC Verification API", version: "v1", calls: 950000, status: "published", category: "compliance" },
  ],

  // Bank Guarantees
  "/v1/guarantees": [
    { id: "BG-001", applicant: "Dangote Cement Plc", beneficiary: "FG of Nigeria", amount: 5000000000, currency: "NGN", type: "performance", status: "active", expiryDate: "2027-12-31" },
    { id: "BG-002", applicant: "Julius Berger Nigeria", beneficiary: "NNPC", amount: 2000000000, currency: "NGN", type: "bid_bond", status: "active", expiryDate: "2026-12-31" },
  ],

  // Basel Engine
  "/v1/basel/capital-adequacy": [
    { id: "BAS-001", metric: "CET1 Ratio", value: 15.8, threshold: 10.0, status: "compliant", reportDate: "2026-03-31" },
    { id: "BAS-002", metric: "Total Capital Ratio", value: 18.2, threshold: 15.0, status: "compliant", reportDate: "2026-03-31" },
    { id: "BAS-003", metric: "Leverage Ratio", value: 8.5, threshold: 3.0, status: "compliant", reportDate: "2026-03-31" },
  ],

  // Batch Processing
  "/v1/batch/jobs": [
    { id: "BAT-001", name: "End of Day Processing", type: "scheduled", status: "completed", records: 1250000, duration: 1800, lastRun: "2026-05-09T23:00:00Z" },
    { id: "BAT-002", name: "Interest Accrual", type: "scheduled", status: "completed", records: 850000, duration: 2400, lastRun: "2026-05-09T23:30:00Z" },
    { id: "BAT-003", name: "Statement Generation", type: "monthly", status: "pending", records: 0, duration: 0, lastRun: "2026-04-30T23:00:00Z" },
  ],

  // Beneficiary Management
  "/v1/beneficiaries": [
    { id: "BEN-001", name: "Fatima Abdullahi", bank: "First Bank", accountNumber: "3012345678", customerId: "CUS-001", status: "verified" },
    { id: "BEN-002", name: "Chidi Nwankwo", bank: "GTBank", accountNumber: "0234567890", customerId: "CUS-001", status: "verified" },
    { id: "BEN-003", name: "Aisha Mohammed", bank: "Access Bank", accountNumber: "0145678901", customerId: "CUS-002", status: "pending" },
  ],

  // Cash Pooling
  "/v1/cash-pools": [
    { id: "CP-001", name: "Dangote Group Master Pool", type: "physical", currency: "NGN", totalBalance: 85000000000, accounts: 12, status: "active" },
    { id: "CP-002", name: "BUA Group Notional Pool", type: "notional", currency: "NGN", totalBalance: 42000000000, accounts: 8, status: "active" },
  ],

  // Dispute Management
  "/v1/disputes": [
    { id: "DSP-001", customerId: "CUS-001", transactionId: "TXN-50001", amount: 150000, currency: "NGN", reason: "Unauthorized debit", status: "under_investigation", createdAt: "2026-05-08T10:00:00Z" },
    { id: "DSP-002", customerId: "CUS-002", transactionId: "TXN-50002", amount: 500000, currency: "NGN", reason: "ATM did not dispense", status: "resolved", createdAt: "2026-05-07T14:00:00Z" },
    { id: "DSP-003", customerId: "CUS-003", transactionId: "TXN-50003", amount: 75000, currency: "NGN", reason: "Duplicate charge", status: "pending_review", createdAt: "2026-05-09T08:00:00Z" },
  ],

  // Education Loans
  "/v1/education-loans": [
    { id: "EDL-001", studentName: "Oluwaseun Adeyemi", institution: "University of Lagos", amount: 2500000, currency: "NGN", status: "disbursed", program: "BSc Computer Science", tenor: 48 },
    { id: "EDL-002", studentName: "Amara Obi", institution: "Covenant University", amount: 4000000, currency: "NGN", status: "repaying", program: "MBA Finance", tenor: 36 },
  ],

  // ERP Sync
  "/v1/erp/sync-jobs": [
    { id: "ERP-001", system: "SAP S/4HANA", direction: "bidirectional", status: "synced", lastSync: "2026-05-09T15:00:00Z", records: 45000, errors: 0 },
    { id: "ERP-002", system: "ERPNext", direction: "inbound", status: "synced", lastSync: "2026-05-09T14:30:00Z", records: 12000, errors: 2 },
  ],

  // Esusu Groups
  "/v1/esusu/groups": [
    { id: "ESU-001", name: "Lagos Market Women", members: 20, monthlyContribution: 50000, currency: "NGN", currentRound: 8, status: "active", lga: "Lagos Island" },
    { id: "ESU-002", name: "Kano Traders Union", members: 15, monthlyContribution: 100000, currency: "NGN", currentRound: 5, status: "active", lga: "Kano Municipal" },
    { id: "ESU-003", name: "Abuja Professionals", members: 12, monthlyContribution: 200000, currency: "NGN", currentRound: 3, status: "active", lga: "AMAC" },
  ],

  // Flag Audit
  "/v1/flag-audits": [
    { id: "FA-001", flagKey: "mobile_money_v2", action: "enabled", actor: "admin@54bank.ng", oldValue: "false", newValue: "true", tenantId: "TEN-GTBANK", timestamp: "2026-05-09T08:30:00Z" },
    { id: "FA-002", flagKey: "ussd_fallback", action: "rollout_updated", actor: "ops@54bank.ng", oldValue: "50%", newValue: "80%", tenantId: "TEN-FIRSTBANK", timestamp: "2026-05-09T09:15:00Z" },
  ],

  // FX Rates Engine
  "/v1/fx/rates": [
    { id: "FX-001", pair: "USD/NGN", bid: 1580.50, ask: 1585.00, mid: 1582.75, source: "CBN Official", updatedAt: "2026-05-09T15:00:00Z" },
    { id: "FX-002", pair: "EUR/NGN", bid: 1720.00, ask: 1725.50, mid: 1722.75, source: "CBN Official", updatedAt: "2026-05-09T15:00:00Z" },
    { id: "FX-003", pair: "GBP/NGN", bid: 2010.00, ask: 2016.00, mid: 2013.00, source: "CBN Official", updatedAt: "2026-05-09T15:00:00Z" },
  ],

  // Group Lending
  "/v1/group-lending/groups": [
    { id: "GL-001", name: "Aba Women Entrepreneurs", type: "solidarity", members: 10, totalLoan: 15000000, currency: "NGN", repaymentRate: 97.5, status: "active", state: "Abia" },
    { id: "GL-002", name: "Ibadan Farmers Cooperative", type: "cooperative", members: 25, totalLoan: 30000000, currency: "NGN", repaymentRate: 95.0, status: "active", state: "Oyo" },
  ],

  // Identity Channels
  "/v1/identity/channels": [
    { id: "IDC-001", channel: "BVN", provider: "NIBSS", status: "active", verifications: 850000, avgResponseMs: 450 },
    { id: "IDC-002", channel: "NIN", provider: "NIMC", status: "active", verifications: 620000, avgResponseMs: 800 },
    { id: "IDC-003", channel: "Biometric", provider: "54Bank Internal", status: "active", verifications: 350000, avgResponseMs: 200 },
  ],

  // IFRS9 Engine
  "/v1/ifrs9/ecl-models": [
    { id: "ECL-001", portfolio: "Corporate Loans", stage1: 85.2, stage2: 10.5, stage3: 4.3, totalECL: 15800000000, currency: "NGN", reportDate: "2026-03-31" },
    { id: "ECL-002", portfolio: "Retail Loans", stage1: 90.1, stage2: 7.2, stage3: 2.7, totalECL: 8500000000, currency: "NGN", reportDate: "2026-03-31" },
  ],

  // ISO20022 Hub
  "/v1/iso20022/messages": [
    { id: "ISO-001", messageType: "pacs.008", direction: "outbound", status: "delivered", amount: 50000000, currency: "NGN", sender: "GTBINGLA", receiver: "ABORNGLA" },
    { id: "ISO-002", messageType: "camt.053", direction: "inbound", status: "processed", amount: 0, currency: "NGN", sender: "CABORNGLA", receiver: "GTBINGLA" },
  ],

  // KYB Engine
  "/v1/kyb/businesses": [
    { id: "KYB-001", businessName: "Dangote Industries", rcNumber: "RC-6789", tinNumber: "TIN-1234567890", status: "verified", riskScore: 15, sector: "Manufacturing", state: "Lagos" },
    { id: "KYB-002", businessName: "BUA Group", rcNumber: "RC-12345", tinNumber: "TIN-9876543210", status: "verified", riskScore: 12, sector: "Conglomerate", state: "Lagos" },
    { id: "KYB-003", businessName: "Paystack Payments", rcNumber: "RC-1456789", tinNumber: "TIN-5551234567", status: "pending_review", riskScore: 25, sector: "Fintech", state: "Lagos" },
  ],

  // Leasing
  "/v1/leases": [
    { id: "LSE-001", lessor: "54Bank Leasing", lessee: "Dangote Transport", asset: "Fleet of 20 trucks", value: 500000000, currency: "NGN", tenor: 60, status: "active" },
    { id: "LSE-002", lessor: "54Bank Leasing", lessee: "Air Peace", asset: "Aircraft E190", value: 15000000000, currency: "NGN", tenor: 120, status: "active" },
  ],

  // Loan Calculator
  "/v1/loan-calculator/schedules": [
    { id: "LC-001", principal: 10000000, rate: 18, tenor: 12, monthlyPayment: 916667, totalInterest: 1000000, totalPayment: 11000000, method: "flat" },
    { id: "LC-002", principal: 50000000, rate: 15, tenor: 36, monthlyPayment: 1732460, totalInterest: 12368560, totalPayment: 62368560, method: "reducing_balance" },
  ],

  // Multi Entity
  "/v1/entities": [
    { id: "ENT-001", name: "54Bank Nigeria", type: "commercial_bank", country: "Nigeria", currency: "NGN", status: "active", regulatoryId: "CBN/2026/001" },
    { id: "ENT-002", name: "54Bank Ghana", type: "commercial_bank", country: "Ghana", currency: "GHS", status: "active", regulatoryId: "BOG/2026/055" },
    { id: "ENT-003", name: "54Bank Kenya", type: "commercial_bank", country: "Kenya", currency: "KES", status: "pending", regulatoryId: "CBK/2026/102" },
  ],

  // Notification Service
  "/v1/notifications": [
    { id: "NOT-001", type: "sms", recipient: "+2348012345678", subject: "Debit Alert", status: "delivered", channel: "Twilio", timestamp: "2026-05-09T14:00:00Z" },
    { id: "NOT-002", type: "email", recipient: "customer@gmail.com", subject: "Statement Ready", status: "delivered", channel: "SendGrid", timestamp: "2026-05-09T13:00:00Z" },
    { id: "NOT-003", type: "push", recipient: "device_token_abc", subject: "Transfer Successful", status: "delivered", channel: "FCM", timestamp: "2026-05-09T12:30:00Z" },
  ],

  // OpenSearch Analytics
  "/v1/analytics/dashboards": [
    { id: "ANA-001", name: "Transaction Volume Dashboard", type: "realtime", widgets: 8, refreshInterval: 30, status: "active" },
    { id: "ANA-002", name: "Customer Acquisition Funnel", type: "daily", widgets: 6, refreshInterval: 86400, status: "active" },
  ],

  // OTC Derivatives
  "/v1/otc/contracts": [
    { id: "OTC-001", type: "interest_rate_swap", notional: 10000000000, currency: "NGN", fixedRate: 12.5, floatingIndex: "NIBOR", tenor: 36, counterparty: "Access Bank", status: "active" },
    { id: "OTC-002", type: "fx_forward", notional: 5000000, currency: "USD", forwardRate: 1600, settlementDate: "2026-11-09", counterparty: "Stanbic IBTC", status: "active" },
  ],

  // Payment Investigation
  "/v1/investigations": [
    { id: "INV-001", transactionId: "TXN-90001", amount: 25000000, currency: "NGN", reason: "Funds not received", status: "in_progress", initiatedBy: "First Bank", createdAt: "2026-05-08T10:00:00Z" },
    { id: "INV-002", transactionId: "TXN-90002", amount: 5000000, currency: "NGN", reason: "Wrong account credited", status: "resolved", initiatedBy: "UBA", createdAt: "2026-05-07T14:00:00Z" },
  ],

  // Project Finance
  "/v1/projects": [
    { id: "PF-001", name: "Lekki Deep Sea Port", sector: "Infrastructure", totalFunding: 150000000000, currency: "NGN", status: "disbursing", sponsors: ["APM Terminals", "CCECC"] },
    { id: "PF-002", name: "Dangote Refinery Phase 2", sector: "Energy", totalFunding: 500000000000, currency: "NGN", status: "monitoring", sponsors: ["Dangote Industries"] },
  ],

  // Savings Products
  "/v1/savings/products": [
    { id: "SAV-001", name: "54Save Regular", type: "regular", minBalance: 1000, interestRate: 4.5, currency: "NGN", status: "active" },
    { id: "SAV-002", name: "54Save High Yield", type: "high_yield", minBalance: 1000000, interestRate: 12.0, currency: "NGN", status: "active" },
    { id: "SAV-003", name: "54Save Target", type: "target", minBalance: 5000, interestRate: 8.0, currency: "NGN", status: "active" },
  ],

  // Standing Orders
  "/v1/standing-orders": [
    { id: "SO-001", customerId: "CUS-001", amount: 500000, currency: "NGN", frequency: "monthly", beneficiary: "Lagos State IRS", purpose: "Tax payment", status: "active", nextExecution: "2026-06-01" },
    { id: "SO-002", customerId: "CUS-002", amount: 200000, currency: "NGN", frequency: "monthly", beneficiary: "FIRS", purpose: "VAT remittance", status: "active", nextExecution: "2026-06-01" },
  ],

  // Tenant Billing
  "/v1/billing/records": [
    { id: "TB-001", tenantId: "TEN-GTBANK", tenantName: "Guaranty Trust Bank", plan: "enterprise", monthlyAmount: 45000000, currency: "NGN", status: "active" },
    { id: "TB-002", tenantId: "TEN-FIRSTBANK", tenantName: "First Bank of Nigeria", plan: "enterprise", monthlyAmount: 52000000, currency: "NGN", status: "active" },
    { id: "TB-003", tenantId: "TEN-ACCESS", tenantName: "Access Bank", plan: "enterprise", monthlyAmount: 48000000, currency: "NGN", status: "active" },
  ],

  // Tenant Export
  "/v1/exports": [
    { id: "EXP-001", tenantId: "TEN-GTBANK", format: "csv", scope: "transactions", status: "completed", records: 1250000, sizeBytes: 458000000 },
    { id: "EXP-002", tenantId: "TEN-FIRSTBANK", format: "json", scope: "customers", status: "completed", records: 850000, sizeBytes: 320000000 },
  ],

  // Tenant Rate Limit
  "/v1/rate-limits": [
    { id: "RL-001", tenantId: "TEN-GTBANK", endpoint: "/api/transfers", requestsPerMinute: 1000, burstLimit: 2000, status: "active" },
    { id: "RL-002", tenantId: "TEN-FIRSTBANK", endpoint: "/api/payments", requestsPerMinute: 800, burstLimit: 1500, status: "active" },
  ],

  // Treasury Liquidity
  "/v1/treasury/liquidity": [
    { id: "LIQ-001", date: "2026-05-09", totalAssets: 2500000000000, totalLiabilities: 2100000000000, lcrRatio: 185.5, nsfrRatio: 142.3, currency: "NGN", status: "compliant" },
  ],

  // Utility Payments
  "/v1/utility-payments": [
    { id: "UP-001", biller: "IKEDC", category: "electricity", amount: 25000, currency: "NGN", meterNumber: "45123456789", status: "successful", paidAt: "2026-05-09T10:00:00Z" },
    { id: "UP-002", biller: "Lagos Water Corp", category: "water", amount: 8000, currency: "NGN", accountNumber: "WC-12345", status: "successful", paidAt: "2026-05-09T11:00:00Z" },
    { id: "UP-003", biller: "DSTV", category: "cable_tv", amount: 21000, currency: "NGN", smartcardNumber: "7012345678", status: "successful", paidAt: "2026-05-09T09:00:00Z" },
  ],

  // Workflow Engine
  "/v1/workflow/definitions": [
    { id: "WF-001", name: "Loan Approval Workflow", steps: 5, status: "active", avgCompletionTime: 48, instances: 1250 },
    { id: "WF-002", name: "Account Opening Workflow", steps: 3, status: "active", avgCompletionTime: 2, instances: 8500 },
    { id: "WF-003", name: "Trade Finance LC Workflow", steps: 8, status: "active", avgCompletionTime: 120, instances: 450 },
  ],

  // Ledger Reconciliation
  "/v1/reconciliation/reports": [
    { id: "REC-001", type: "interbank", status: "balanced", matchedTxns: 45000, unmatchedTxns: 12, totalAmount: 85000000000, currency: "NGN", date: "2026-05-09" },
    { id: "REC-002", type: "nostro", status: "balanced", matchedTxns: 1200, unmatchedTxns: 3, totalAmount: 25000000, currency: "USD", date: "2026-05-09" },
  ],
};

// Build fallback registry from the proxyFallbackData
for (const [path, data] of Object.entries(proxyFallbackData)) {
  fallbackRegistry.set(path, data);
}

export function getProxyFallback(servicePath: string): unknown[] | undefined {
  return fallbackRegistry.get(servicePath) as unknown[] | undefined;
}
