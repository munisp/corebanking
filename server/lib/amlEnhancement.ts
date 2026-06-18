// AML Enhancement — Express proxy routes for 15 AML services
// Ports 8574-8588 — with realistic Nigerian banking seed data
import type { Express, Request, Response } from "express";

const proxyOrSeed = async (serviceUrl: string, path: string, seed: unknown, _req: Request, res: Response) => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(`${serviceUrl}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (resp.ok) { res.json(await resp.json()); return; }
    throw new Error(`Service returned ${resp.status}`);
  } catch {
    res.json(seed);
  }
};

const SEED: Record<string, unknown[]> = {
  "aml-risk-scoring": [
    { id: "ARS-001", name: "Alhaji Garba Mohammed", category: "Individual", riskScore: 78, riskLevel: "high", factors: "PEP, Large Cash Deposits, Cross-border", lastScreening: "2026-05-14", sanctions: "clear", status: "monitoring" },
    { id: "ARS-002", name: "Emeka Industries Ltd", category: "Corporate", riskScore: 62, riskLevel: "elevated", factors: "Complex Ownership, Shell Company Links", lastScreening: "2026-05-14", sanctions: "clear", status: "edd_required" },
    { id: "ARS-003", name: "Mrs. Fatima Hassan", category: "Individual", riskScore: 25, riskLevel: "low", factors: "Salary Account, Domestic Only", lastScreening: "2026-05-13", sanctions: "clear", status: "active" },
    { id: "ARS-004", name: "Oceanic Trading Corp", category: "Corporate", riskScore: 85, riskLevel: "critical", factors: "OFAC Partial Match, High-Risk Jurisdiction", lastScreening: "2026-05-14", sanctions: "potential_match", status: "blocked" },
    { id: "ARS-005", name: "Dr. Oluwaseun Adeyemi", category: "Individual", riskScore: 45, riskLevel: "medium", factors: "PEP Family Member, Real Estate", lastScreening: "2026-05-12", sanctions: "clear", status: "active" },
  ],
  "sar-filing": [
    { id: "SAR-2026-001", name: "Structuring — Alhaji Garba Account", category: "Structuring", amount: "₦48.5M (12 deposits)", filedTo: "NFIU", cbnRef: "CBN-SAR-2026-0142", filingDate: "2026-05-10", analyst: "Compliance Officer A", status: "filed" },
    { id: "SAR-2026-002", name: "Rapid Fund Movement — Emeka Industries", category: "Layering", amount: "₦125M (48hrs)", filedTo: "NFIU", cbnRef: "CBN-SAR-2026-0156", filingDate: "2026-05-12", analyst: "Compliance Officer B", status: "filed" },
    { id: "SAR-2026-003", name: "Dormant Account Reactivation — Suspicious", category: "Dormant-Active", amount: "₦82M", filedTo: "NFIU", cbnRef: "CBN-SAR-2026-0168", filingDate: "2026-05-14", analyst: "Compliance Officer A", status: "draft" },
    { id: "SAR-2026-004", name: "Trade-Based ML — Inflated Invoices", category: "TBML", amount: "₦340M", filedTo: "NFIU", cbnRef: "CBN-SAR-2026-0171", filingDate: "2026-05-14", analyst: "Compliance Officer C", status: "pending" },
  ],
  "ctr-auto-filer": [
    { id: "CTR-2026-0891", name: "Cash Deposit — First Bank Ikeja", category: "Cash Deposit", amount: "₦8.5M", accountHolder: "Chief Okonkwo Enterprises", branch: "Ikeja GRA", filedTo: "NFIU", status: "filed" },
    { id: "CTR-2026-0892", name: "Cash Withdrawal — GTBank VI", category: "Cash Withdrawal", amount: "₦12M", accountHolder: "Alhaji Danladi Holdings", branch: "Victoria Island", filedTo: "NFIU", status: "filed" },
    { id: "CTR-2026-0893", name: "Cash Deposit — Zenith Kano", category: "Cash Deposit", amount: "₦6.2M", accountHolder: "Musa Trading Ltd", branch: "Kano Main", filedTo: "NFIU", status: "filed" },
    { id: "CTR-2026-0894", name: "Cash Withdrawal — Access Abuja", category: "Cash Withdrawal", amount: "₦15M", accountHolder: "Federal Contractors Ltd", branch: "Abuja Central", filedTo: "NFIU", status: "pending" },
  ],
  "aml-case-manager": [
    { id: "CASE-001", name: "Structuring Investigation — Garba Account", category: "Structuring", priority: "high", assignedTo: "AML Analyst A", openDate: "2026-04-28", evidence: "12 sub-₦5M deposits in 3 days", linkedSar: "SAR-2026-001", status: "investigating" },
    { id: "CASE-002", name: "Shell Company Network — Emeka Industries", category: "Layering", priority: "critical", assignedTo: "AML Analyst B", openDate: "2026-04-15", evidence: "5 linked companies, circular transfers", linkedSar: "SAR-2026-002", status: "investigating" },
    { id: "CASE-003", name: "POS Laundering Ring — Lagos", category: "POS Fraud", priority: "high", assignedTo: "AML Analyst C", openDate: "2026-05-01", evidence: "45 POS terminals, ₦890M volume", linkedSar: "pending", status: "open" },
    { id: "CASE-004", name: "Loan-Back Scheme — Plateau", category: "Loan-Back", priority: "medium", assignedTo: "AML Analyst A", openDate: "2026-05-05", evidence: "Self-lending through nominee accounts", linkedSar: "pending", status: "open" },
  ],
  "watchlist-manager": [
    { id: "WL-001", name: "OFAC SDN List", category: "Sanctions", entries: "12,450", lastSync: "2026-05-14 06:00", syncFrequency: "daily", matchesFound: 2, source: "US Treasury", status: "active" },
    { id: "WL-002", name: "UN Security Council", category: "Sanctions", entries: "8,200", lastSync: "2026-05-14 06:00", syncFrequency: "daily", matchesFound: 0, source: "UN", status: "active" },
    { id: "WL-003", name: "CBN Internal Watchlist", category: "Internal", entries: "3,450", lastSync: "2026-05-14 00:00", syncFrequency: "realtime", matchesFound: 5, source: "CBN", status: "active" },
    { id: "WL-004", name: "EFCC Wanted List", category: "Law Enforcement", entries: "890", lastSync: "2026-05-13 12:00", syncFrequency: "weekly", matchesFound: 1, source: "EFCC", status: "active" },
    { id: "WL-005", name: "EU Consolidated Sanctions", category: "Sanctions", entries: "9,800", lastSync: "2026-05-14 06:00", syncFrequency: "daily", matchesFound: 0, source: "EU Council", status: "active" },
  ],
  "adverse-media-scanner": [
    { id: "AMS-001", name: "Punch News — Fraud Ring Alert", category: "Fraud", source: "Punch Nigeria", confidence: "0.89", entity: "Oceanic Trading Corp", publishDate: "2026-05-12", sentiment: "negative", status: "flagged" },
    { id: "AMS-002", name: "ThisDay — PEP Investigation", category: "PEP", source: "ThisDay", confidence: "0.78", entity: "Alhaji Garba Mohammed", publishDate: "2026-05-10", sentiment: "negative", status: "reviewing" },
    { id: "AMS-003", name: "Premium Times — Money Laundering", category: "AML", source: "Premium Times", confidence: "0.92", entity: "Emeka Industries Ltd", publishDate: "2026-05-08", sentiment: "negative", status: "confirmed" },
  ],
  "beneficial-ownership": [
    { id: "UBO-001", name: "Emeka Industries Ltd", category: "Corporate", uboChain: "Emeka → Oceanic Holdings → Offshore BVI", ultimateBeneficiary: "Chief Emeka Obi", percentOwnership: "72%", cacVerified: true, status: "flagged" },
    { id: "UBO-002", name: "Danladi Group", category: "Corporate", uboChain: "Danladi → Sahel Investments", ultimateBeneficiary: "Alhaji Danladi Sule", percentOwnership: "100%", cacVerified: true, status: "verified" },
    { id: "UBO-003", name: "Federal Contractors Ltd", category: "Corporate", uboChain: "Federal → State Holdings → Unknown", ultimateBeneficiary: "Under Investigation", percentOwnership: "unclear", cacVerified: false, status: "investigating" },
  ],
  "txn-pattern-analyzer": [
    { id: "TPA-001", name: "Structuring Detection — Account 001234", category: "Structuring", pattern: "12 deposits ₦4.8-4.9M in 3 days", deviation: "4.2σ", riskScore: 92, alertDate: "2026-05-14", status: "alert" },
    { id: "TPA-002", name: "Velocity Anomaly — Account 005678", category: "Velocity", pattern: "₦125M outflow in 48 hours (normal: ₦2M/month)", deviation: "8.1σ", riskScore: 98, alertDate: "2026-05-13", status: "alert" },
    { id: "TPA-003", name: "Geographic Anomaly — Account 009012", category: "Geographic", pattern: "Transactions from 4 countries in 2 hours", deviation: "5.5σ", riskScore: 88, alertDate: "2026-05-12", status: "investigating" },
    { id: "TPA-004", name: "Round-Tripping — Accounts 002345-002349", category: "Round-Trip", pattern: "Circular flow ₦50M across 5 accounts", deviation: "6.8σ", riskScore: 95, alertDate: "2026-05-11", status: "escalated" },
  ],
  "goaml-integration": [
    { id: "GOAML-001", name: "CTR Batch — May 2026 Week 1", category: "CTR", reportCount: 245, filingStatus: "submitted", nfiuRef: "NFIU-CTR-2026-W19", submissionDate: "2026-05-07", format: "goAML XML 4.0", status: "filed" },
    { id: "GOAML-002", name: "STR Batch — May 2026 Week 1", category: "STR", reportCount: 12, filingStatus: "submitted", nfiuRef: "NFIU-STR-2026-W19", submissionDate: "2026-05-07", format: "goAML XML 4.0", status: "filed" },
    { id: "GOAML-003", name: "SAR — Oceanic Trading Investigation", category: "SAR", reportCount: 1, filingStatus: "submitted", nfiuRef: "NFIU-SAR-2026-0089", submissionDate: "2026-05-12", format: "goAML XML 4.0", status: "filed" },
  ],
  "aml-compliance-dashboard": [
    { id: "ACD-001", name: "Total Screenings — May 2026", category: "Screening", metric: "screenings_total", value: "125,400", period: "MTD", target: "100%", achievement: "100%", status: "active" },
    { id: "ACD-002", name: "SAR Filing Rate", category: "Filing", metric: "sar_filing_rate", value: "98.5%", period: "MTD", target: "95%", achievement: "103.7%", status: "active" },
    { id: "ACD-003", name: "CTR Auto-Filing Rate", category: "Filing", metric: "ctr_auto_rate", value: "99.2%", period: "MTD", target: "98%", achievement: "101.2%", status: "active" },
    { id: "ACD-004", name: "Risk Score Distribution", category: "Risk", metric: "risk_distribution", value: "Low:72% Medium:18% High:8% Critical:2%", period: "current", target: "N/A", achievement: "N/A", status: "active" },
  ],
  "sanctions-batch-rescreener": [
    { id: "SBR-001", name: "Daily Full Re-screen — 2026-05-14", category: "Batch", customersScreened: "25,400", duration: "12 min 34s", newMatches: 0, falsePositives: 12, truePositives: 0, status: "completed" },
    { id: "SBR-002", name: "Daily Full Re-screen — 2026-05-13", category: "Batch", customersScreened: "25,380", duration: "12 min 28s", newMatches: 1, falsePositives: 8, truePositives: 1, status: "completed" },
    { id: "SBR-003", name: "OFAC List Update Re-screen", category: "Incremental", customersScreened: "25,400", duration: "3 min 45s", newMatches: 0, falsePositives: 2, truePositives: 0, status: "completed" },
  ],
  "aml-training-tracker": [
    { id: "ATT-001", name: "AML/CFT Annual Training 2026", category: "Mandatory", enrolled: 450, completed: 380, passRate: "94%", deadline: "2026-06-30", provider: "54Bank Compliance Academy", status: "active" },
    { id: "ATT-002", name: "Sanctions Screening Workshop", category: "Specialized", enrolled: 45, completed: 42, passRate: "98%", deadline: "2026-05-31", provider: "External — ACAMS", status: "active" },
    { id: "ATT-003", name: "NFIU goAML Filing Training", category: "Regulatory", enrolled: 12, completed: 12, passRate: "100%", deadline: "2026-04-30", provider: "NFIU", status: "completed" },
  ],
  "wire-transfer-monitor": [
    { id: "WTM-001", name: "SWIFT MT103 — Lagos → London", category: "Outbound", amount: "$245,000", originator: "Chief Okonkwo Enterprises", beneficiary: "UK Supplier Ltd", travelRule: "compliant", originatorInfo: "complete", status: "cleared" },
    { id: "WTM-002", name: "SWIFT MT103 — Dubai → Lagos", category: "Inbound", amount: "$180,000", originator: "Dubai Trading FZE", beneficiary: "Emeka Industries Ltd", travelRule: "incomplete", originatorInfo: "missing_address", status: "held" },
    { id: "WTM-003", name: "SWIFT MT103 — Lagos → New York", category: "Outbound", amount: "$500,000", originator: "Danladi Group", beneficiary: "US Investment Corp", travelRule: "compliant", originatorInfo: "complete", status: "cleared" },
  ],
  "regulatory-reporting": [
    { id: "RR-001", name: "CBN Quarterly AML Report — Q1 2026", category: "CBN", reportType: "quarterly", dueDate: "2026-04-30", filedDate: "2026-04-28", format: "CBN-AML-Q", status: "filed" },
    { id: "RR-002", name: "NFIU Monthly Return — April 2026", category: "NFIU", reportType: "monthly", dueDate: "2026-05-15", filedDate: "2026-05-10", format: "NFIU-MR", status: "filed" },
    { id: "RR-003", name: "NDIC Annual Return — 2025", category: "NDIC", reportType: "annual", dueDate: "2026-03-31", filedDate: "2026-03-28", format: "NDIC-AR", status: "filed" },
    { id: "RR-004", name: "NFIU Monthly Return — May 2026", category: "NFIU", reportType: "monthly", dueDate: "2026-06-15", filedDate: "pending", format: "NFIU-MR", status: "pending" },
  ],
  "typology-detector": [
    { id: "TYP-001", name: "CBN-AML-001: Structuring Detection", category: "CBN Typology", pattern: "Multiple sub-threshold deposits", matchCount: 8, lastMatch: "2026-05-14", riskLevel: "high", source: "CBN/FATF", status: "active" },
    { id: "TYP-002", name: "CBN-AML-004: Round-Tripping", category: "CBN Typology", pattern: "Circular fund flows across linked accounts", matchCount: 3, lastMatch: "2026-05-11", riskLevel: "critical", source: "CBN", status: "active" },
    { id: "TYP-003", name: "FATF-TBML: Trade-Based ML", category: "FATF Typology", pattern: "Over/under-invoicing of goods", matchCount: 2, lastMatch: "2026-05-08", riskLevel: "high", source: "FATF", status: "active" },
    { id: "TYP-004", name: "POS Laundering Ring", category: "Nigeria-Specific", pattern: "High-volume POS with no underlying business", matchCount: 5, lastMatch: "2026-05-14", riskLevel: "critical", source: "EFCC/CBN", status: "active" },
  ],
};

export function registerAMLEnhancementRoutes(app: Express) {
  const services = [
    { key: "aml-risk-scoring", url: process.env.AML_RISK_SCORING_URL || "http://localhost:8574" },
    { key: "sar-filing", url: process.env.SAR_FILING_URL || "http://localhost:8575" },
    { key: "ctr-auto-filer", url: process.env.CTR_AUTO_FILER_URL || "http://localhost:8576" },
    { key: "aml-case-manager", url: process.env.AML_CASE_MANAGER_URL || "http://localhost:8577" },
    { key: "watchlist-manager", url: process.env.WATCHLIST_MANAGER_URL || "http://localhost:8578" },
    { key: "adverse-media-scanner", url: process.env.ADVERSE_MEDIA_SCANNER_URL || "http://localhost:8579" },
    { key: "beneficial-ownership", url: process.env.BENEFICIAL_OWNERSHIP_URL || "http://localhost:8580" },
    { key: "txn-pattern-analyzer", url: process.env.TXN_PATTERN_ANALYZER_URL || "http://localhost:8581" },
    { key: "goaml-integration", url: process.env.GOAML_INTEGRATION_URL || "http://localhost:8582" },
    { key: "aml-compliance-dashboard", url: process.env.AML_COMPLIANCE_DASHBOARD_URL || "http://localhost:8583" },
    { key: "sanctions-batch-rescreener", url: process.env.SANCTIONS_BATCH_RESCREENER_URL || "http://localhost:8584" },
    { key: "aml-training-tracker", url: process.env.AML_TRAINING_TRACKER_URL || "http://localhost:8585" },
    { key: "wire-transfer-monitor", url: process.env.WIRE_TRANSFER_MONITOR_URL || "http://localhost:8586" },
    { key: "regulatory-reporting", url: process.env.REGULATORY_REPORTING_URL || "http://localhost:8587" },
    { key: "typology-detector", url: process.env.TYPOLOGY_DETECTOR_URL || "http://localhost:8588" },
  ];

  for (const svc of services) {
    const items = SEED[svc.key] || [];
    const seed = { items, total: items.length, service: svc.key, fallback: true };

    app.get(`/api/aml-enhancement/${svc.key}/list`, (req, res) => {
      void proxyOrSeed(svc.url, `/v1/${svc.key}/list`, seed, req, res);
    });
    app.get(`/api/aml-enhancement/${svc.key}/stats`, (req, res) => {
      void proxyOrSeed(svc.url, `/v1/${svc.key}/stats`, { total: items.length, service: svc.key }, req, res);
    });
  }
}
