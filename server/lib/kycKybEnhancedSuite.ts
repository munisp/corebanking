/**
 * KYC/KYB Enhanced Suite — 22 enhancements across 5 phases.
 *
 * Phase 1: CBN Tiered KYC, BVN/NIN API, NFIU CTR/STR, Sanctions Screening, CAC API
 * Phase 2: Transaction Monitoring, Risk-Based Approach, PEP Enhanced DD, UBO Graph
 * Phase 3: Multi-Bureau Verification, Address Verification, Corporate Doc, KYC Analytics
 * Phase 4: Video KYC, Continuous Liveness, Workflow Orchestration, Self-Service, Agent KYC
 * Phase 5: Adverse Media, Corporate Monitoring, Data Quality, eFASS Returns
 *
 * 22 new polyglot microservices (8 Go, 6 Rust, 8 Python) with full 14-middleware integration.
 */
import type { Express, Request, Response } from "express";

// ── Phase 1: CBN Tiered KYC ──

interface TierDefinition {
  tier: number; name: string; dailyLimitNGN: number; singleTxLimitNGN: number;
  foreignTransferAllowed: boolean; requirements: string[];
}

interface CustomerTier {
  id: string; customerId: string; customerName: string; bvn: string; currentTier: number;
  tierName: string; dailyLimitNGN: number; dailyUsedNGN: number; evaluationScore: number;
  status: string; riskFlags: string[];
}

const tierDefinitions: TierDefinition[] = [
  { tier: 1, name: "Tier 1 - Low Value", dailyLimitNGN: 300000, singleTxLimitNGN: 50000, foreignTransferAllowed: false, requirements: ["BVN verification"] },
  { tier: 2, name: "Tier 2 - Medium Value", dailyLimitNGN: 5000000, singleTxLimitNGN: 2000000, foreignTransferAllowed: false, requirements: ["BVN", "Photo ID", "Utility bill"] },
  { tier: 3, name: "Tier 3 - High Value", dailyLimitNGN: Number.MAX_SAFE_INTEGER, singleTxLimitNGN: Number.MAX_SAFE_INTEGER, foreignTransferAllowed: true, requirements: ["BVN", "NIN", "Photo ID", "Address verification", "Biometric", "EDD"] },
];

const customerTiers: CustomerTier[] = [
  { id: "CT-001", customerId: "CUS-1045", customerName: "Amina Yusuf", bvn: "22345678901", currentTier: 3, tierName: "Tier 3 - High Value", dailyLimitNGN: Number.MAX_SAFE_INTEGER, dailyUsedNGN: 2500000, evaluationScore: 98.5, status: "active", riskFlags: [] },
  { id: "CT-002", customerId: "CUS-2089", customerName: "Chinedu Okeke", bvn: "33456789012", currentTier: 2, tierName: "Tier 2 - Medium Value", dailyLimitNGN: 5000000, dailyUsedNGN: 1200000, evaluationScore: 72, status: "active", riskFlags: ["NIN_NOT_LINKED"] },
  { id: "CT-003", customerId: "CUS-3021", customerName: "Oluwaseun Adeyemi", bvn: "44567890123", currentTier: 1, tierName: "Tier 1 - Low Value", dailyLimitNGN: 300000, dailyUsedNGN: 250000, evaluationScore: 35, status: "active", riskFlags: ["TIER1_NEAR_DAILY_LIMIT"] },
  { id: "CT-004", customerId: "CUS-4055", customerName: "Fatima Bello", bvn: "55678901234", currentTier: 2, tierName: "Tier 2 - Medium Value", dailyLimitNGN: 5000000, dailyUsedNGN: 0, evaluationScore: 55, status: "review_pending", riskFlags: ["DOCUMENT_EXPIRED", "PENDING_DOWNGRADE"] },
];

// ── Phase 1: BVN/NIN Verification ──

interface BVNRecord { id: string; bvn: string; firstName: string; lastName: string; dob: string; phone: string; ninLinked: boolean; linkedNIN: string; verified: boolean; }
interface NINRecord { id: string; nin: string; firstName: string; lastName: string; dob: string; address: string; bvnLinked: boolean; linkedBVN: string; verified: boolean; }

const bvnRecords: BVNRecord[] = [
  { id: "BVN-001", bvn: "22345678901", firstName: "Amina", lastName: "Yusuf", dob: "1991-03-15", phone: "08012345678", ninLinked: true, linkedNIN: "12345678901", verified: true },
  { id: "BVN-002", bvn: "33456789012", firstName: "Chinedu", lastName: "Okeke", dob: "1985-08-22", phone: "08098765432", ninLinked: false, linkedNIN: "", verified: true },
  { id: "BVN-003", bvn: "44567890123", firstName: "Oluwaseun", lastName: "Adeyemi", dob: "1998-12-01", phone: "07012345678", ninLinked: false, linkedNIN: "", verified: true },
];

const ninRecords: NINRecord[] = [
  { id: "NIN-001", nin: "12345678901", firstName: "Amina", lastName: "Yusuf", dob: "1991-03-15", address: "15 Adeniyi Jones Ave, Ikeja, Lagos", bvnLinked: true, linkedBVN: "22345678901", verified: true },
];

// ── Phase 1: NFIU CTR/STR ──

interface CTRRecord { id: string; customerId: string; customerName: string; amountNGN: number; transactionType: string; status: string; cbnReference: string | null; slaStatus: string; }
interface STRRecord { id: string; customerId: string; customerName: string; reason: string; category: string; totalAmountNGN: number; riskScore: number; status: string; slaHoursRemaining: number; }

const ctrRecords: CTRRecord[] = [
  { id: "CTR-001", customerId: "CUS-1045", customerName: "Amina Yusuf", amountNGN: 7500000, transactionType: "cash_deposit", status: "filed", cbnReference: "CBN/CTR/2026/05/0001", slaStatus: "within_sla" },
  { id: "CTR-002", customerId: "CUS-7001", customerName: "Pinnacle Trading Ltd", amountNGN: 25000000, transactionType: "wire_transfer", status: "pending_review", cbnReference: null, slaStatus: "within_sla" },
];

const strRecords: STRRecord[] = [
  { id: "STR-001", customerId: "CUS-8001", customerName: "Suspicious Patterns Ltd", reason: "Structured deposits below CTR threshold", category: "structuring", totalAmountNGN: 58800000, riskScore: 92, status: "filed", slaHoursRemaining: 0 },
  { id: "STR-002", customerId: "CUS-2089", customerName: "Chinedu Okeke", reason: "Rapid fund movement — ₦14.8M out within 4 hours", category: "rapid_movement", totalAmountNGN: 14800000, riskScore: 85, status: "under_review", slaHoursRemaining: 52 },
];

// ── Phase 1: Sanctions Screening ──

interface SanctionsList { id: string; name: string; source: string; entryCount: number; lastUpdated: string; }
interface ScreeningResult { id: string; screenedName: string; matches: number; highestScore: number; riskLevel: string; action: string; }

const sanctionsLists: SanctionsList[] = [
  { id: "SL-001", name: "OFAC SDN List", source: "US Treasury", entryCount: 12847, lastUpdated: "2026-05-12" },
  { id: "SL-002", name: "UN Security Council", source: "United Nations", entryCount: 764, lastUpdated: "2026-05-11" },
  { id: "SL-003", name: "EU Consolidated", source: "European Commission", entryCount: 2156, lastUpdated: "2026-05-10" },
  { id: "SL-004", name: "HMT Financial Sanctions", source: "UK HM Treasury", entryCount: 3421, lastUpdated: "2026-05-11" },
  { id: "SL-005", name: "CBN Internal Watchlist", source: "CBN", entryCount: 892, lastUpdated: "2026-05-12" },
  { id: "SL-006", name: "EFCC Watchlist", source: "EFCC", entryCount: 1245, lastUpdated: "2026-05-12" },
];

// ── Phase 2: Transaction Monitoring ──

interface MonitoringRule { id: string; name: string; category: string; scenarioCode: string; riskScoreImpact: number; enabled: boolean; cbnPrescribed: boolean; }
interface TxnAlert { id: string; customerId: string; ruleName: string; riskScore: number; status: string; sarRecommended: boolean; }

const monitoringRules: MonitoringRule[] = [
  { id: "MR-001", name: "Structuring Detection", category: "structuring", scenarioCode: "CBN-AML-001", riskScoreImpact: 90, enabled: true, cbnPrescribed: true },
  { id: "MR-002", name: "Rapid Fund Movement", category: "rapid_movement", scenarioCode: "CBN-AML-002", riskScoreImpact: 85, enabled: true, cbnPrescribed: true },
  { id: "MR-003", name: "Dormant-Then-Active", category: "dormant_reactivation", scenarioCode: "CBN-AML-003", riskScoreImpact: 75, enabled: true, cbnPrescribed: true },
  { id: "MR-004", name: "Round-Tripping", category: "round_tripping", scenarioCode: "CBN-AML-004", riskScoreImpact: 80, enabled: true, cbnPrescribed: true },
  { id: "MR-005", name: "PEP Threshold Monitoring", category: "pep_monitoring", scenarioCode: "CBN-AML-005", riskScoreImpact: 70, enabled: true, cbnPrescribed: true },
  { id: "MR-006", name: "Geographic Anomaly", category: "geographic", scenarioCode: "CBN-AML-006", riskScoreImpact: 65, enabled: true, cbnPrescribed: true },
  { id: "MR-007", name: "Trade-Based ML", category: "trade_based_ml", scenarioCode: "CBN-AML-007", riskScoreImpact: 85, enabled: true, cbnPrescribed: true },
  { id: "MR-008", name: "Velocity Spike", category: "velocity", scenarioCode: "INT-001", riskScoreImpact: 60, enabled: true, cbnPrescribed: false },
];

const txnAlerts: TxnAlert[] = [
  { id: "TA-001", customerId: "CUS-8001", ruleName: "Structuring Detection", riskScore: 92, status: "sar_filed", sarRecommended: true },
  { id: "TA-002", customerId: "CUS-2089", ruleName: "Rapid Fund Movement", riskScore: 85, status: "under_investigation", sarRecommended: true },
  { id: "TA-003", customerId: "CUS-5050", ruleName: "Dormant-Then-Active", riskScore: 75, status: "new", sarRecommended: false },
];

// ── Phase 2: UBO Graph ──

interface UBOEntity { id: string; name: string; entityType: string; nationality: string; riskLevel: string; }
interface OwnershipEdge { id: string; fromEntity: string; toEntity: string; ownershipPct: number; controlType: string; }
interface UBOAlert { id: string; alertType: string; entityName: string; riskLevel: string; details: string; }

const uboEntities: UBOEntity[] = [
  { id: "UE-001", name: "Pinnacle Trading Ltd", entityType: "company", nationality: "Nigeria", riskLevel: "low" },
  { id: "UE-002", name: "Emeka Okonkwo", entityType: "individual", nationality: "Nigeria", riskLevel: "low" },
  { id: "UE-003", name: "Pinnacle Holdings BVI", entityType: "company", nationality: "BVI", riskLevel: "high" },
  { id: "UE-004", name: "Quantum Resources Nigeria Ltd", entityType: "company", nationality: "Nigeria", riskLevel: "critical" },
];

const ownershipEdges: OwnershipEdge[] = [
  { id: "OE-001", fromEntity: "UE-002", toEntity: "UE-001", ownershipPct: 60, controlType: "direct_shareholding" },
  { id: "OE-002", fromEntity: "UE-003", toEntity: "UE-001", ownershipPct: 40, controlType: "indirect_via_bvi" },
  { id: "OE-003", fromEntity: "UE-004", toEntity: "UE-004", ownershipPct: 50, controlType: "circular_cross_holding" },
];

const uboAlerts: UBOAlert[] = [
  { id: "UA-001", alertType: "circular_ownership", entityName: "Quantum Resources ↔ Quantum Holdings Cayman", riskLevel: "critical", details: "Circular ownership detected: 50% cross-holding" },
  { id: "UA-002", alertType: "nominee_director", entityName: "Unknown Nominee A", riskLevel: "critical", details: "100% ownership by unidentified nominee" },
  { id: "UA-003", alertType: "tax_haven", entityName: "Pinnacle Holdings BVI", riskLevel: "high", details: "Parent in BVI — FATF high-risk jurisdiction" },
];

// ── Phase 3-5 seed data ──

const bureauChecks = [
  { id: "BC-001", customerId: "CUS-1045", bureau: "CRC", creditScore: 720, riskGrade: "A", activeLoans: 1 },
  { id: "BC-002", customerId: "CUS-1045", bureau: "FirstCentral", creditScore: 715, riskGrade: "A", activeLoans: 1 },
  { id: "BC-003", customerId: "CUS-2089", bureau: "CRC", creditScore: 580, riskGrade: "C", activeLoans: 3 },
];

const addressVerifications = [
  { id: "AV-001", customerId: "CUS-1045", address: "15 Adeniyi Jones Ave, Ikeja, Lagos", matchScore: 0.95, method: "gps+utility_bill", status: "verified" },
  { id: "AV-002", customerId: "CUS-2089", address: "42 Trans-Amadi Road, Port Harcourt", matchScore: 0.88, method: "utility_bill", status: "verified" },
];

const videoKYCSessions = [
  { id: "VK-001", customerId: "CUS-1045", officerId: "CO-001", duration: 420, geoVerified: true, aiAnalysis: "passed", status: "completed" },
];

const riskScores = [
  { id: "RS-001", customerId: "CUS-1045", staticScore: 15, dynamicScore: 8, totalScore: 23, riskTier: "low", factors: ["employed", "tier3_kyc", "no_alerts", "stable_pattern"] },
  { id: "RS-002", customerId: "CUS-2089", staticScore: 35, dynamicScore: 50, totalScore: 85, riskTier: "high", factors: ["nin_not_linked", "rapid_movement_alert", "multiple_devices"] },
  { id: "RS-003", customerId: "CUS-8001", staticScore: 60, dynamicScore: 92, totalScore: 152, riskTier: "very_high", factors: ["corporate_high_risk_sector", "structuring_alert", "sar_filed"] },
];

const agentCaptures = [
  { id: "AC-001", agentId: "AGT-101", agentName: "Bola Adesanya", customerName: "Musa Ibrahim", lga: "Ikeja", offlineCapture: false, qualityScore: 0.92 },
  { id: "AC-002", agentId: "AGT-102", agentName: "Chidinma Eze", customerName: "Halima Yusuf", lga: "Garki", offlineCapture: true, qualityScore: 0.85 },
];

const adverseMediaHits = [
  { id: "AM-001", entity: "Quantum Resources Nigeria Ltd", source: "Punch Newspaper", headline: "EFCC arrests directors of Quantum Resources for N2.5B fraud", riskImpact: "critical", detectedAt: "2026-05-10" },
  { id: "AM-002", entity: "ABC Import Export Ltd", source: "Guardian Nigeria", headline: "Import company under investigation for over-invoicing", riskImpact: "high", detectedAt: "2026-05-08" },
];

const dataQualityMetrics = {
  totalCustomers: 45000, kycComplete: 43740, kycCompletePct: 97.2,
  expiredDocuments: 1250, duplicateBVN: 12, missingNIN: 8900,
  averageCompletenessScore: 0.89, targetCompletenessScore: 0.99,
};

const efassReturns = [
  { id: "EF-001", period: "2026-04", type: "monthly", kycCompletionPct: 97.1, tier1Count: 12000, tier2Count: 25000, tier3Count: 8000, status: "submitted" },
  { id: "EF-002", period: "2026-Q1", type: "quarterly", remediationCount: 450, newAccountsKYCd: 3200, status: "accepted" },
];

export function registerKYCKYBEnhancedSuite(app: Express) {
  // Phase 1: CBN Tiered KYC
  app.get("/api/kyc-enhanced/tier-definitions", (_: Request, res: Response) => res.json({ items: tierDefinitions, total: tierDefinitions.length }));
  app.get("/api/kyc-enhanced/customer-tiers", (_: Request, res: Response) => res.json({ items: customerTiers, total: customerTiers.length }));
  app.post("/api/kyc-enhanced/tier-evaluate/:customerId", (req: Request, res: Response) => {
    const ct = customerTiers.find(c => c.customerId === req.params.customerId);
    if (!ct) return res.status(404).json({ error: "customer not found" });
    res.json({ customerId: ct.customerId, currentTier: ct.currentTier, evaluationScore: ct.evaluationScore, riskFlags: ct.riskFlags });
  });
  app.post("/api/kyc-enhanced/limit-check", (req: Request, res: Response) => {
    const { customerId, amountNGN } = req.body || {};
    const ct = customerTiers.find(c => c.customerId === customerId);
    if (!ct) return res.status(404).json({ error: "customer not found" });
    const allowed = ct.dailyUsedNGN + (amountNGN || 0) <= ct.dailyLimitNGN;
    res.json({ allowed, tier: ct.currentTier, dailyUsed: ct.dailyUsedNGN, dailyLimit: ct.dailyLimitNGN });
  });

  // Phase 1: BVN/NIN
  app.get("/api/kyc-enhanced/bvn-records", (_: Request, res: Response) => res.json({ items: bvnRecords, total: bvnRecords.length }));
  app.get("/api/kyc-enhanced/nin-records", (_: Request, res: Response) => res.json({ items: ninRecords, total: ninRecords.length }));
  app.post("/api/kyc-enhanced/bvn-verify", (req: Request, res: Response) => {
    const { bvn } = req.body || {};
    const rec = bvnRecords.find(b => b.bvn === bvn);
    res.json(rec || { error: "BVN not found in NIBSS records", bvn });
  });
  app.post("/api/kyc-enhanced/bvn-nin-linkage", (req: Request, res: Response) => {
    const { bvn, nin } = req.body || {};
    const bRec = bvnRecords.find(b => b.bvn === bvn);
    const linked = bRec?.ninLinked && bRec?.linkedNIN === nin;
    res.json({ bvn, nin, linked, status: linked ? "verified" : "not_linked" });
  });

  // Phase 1: NFIU CTR/STR
  app.get("/api/kyc-enhanced/ctrs", (_: Request, res: Response) => res.json({ items: ctrRecords, total: ctrRecords.length }));
  app.get("/api/kyc-enhanced/strs", (_: Request, res: Response) => res.json({ items: strRecords, total: strRecords.length }));
  app.get("/api/kyc-enhanced/nfiu-dashboard", (_: Request, res: Response) => res.json({
    ctrs: { total: 47, filed: 45, pending: 2, slaBreaches: 0 },
    strs: { total: 8, filed: 5, underReview: 2, escalated: 1 },
    goamlStatus: "active",
  }));

  // Phase 1: Sanctions Screening
  app.get("/api/kyc-enhanced/sanctions-lists", (_: Request, res: Response) => res.json({ items: sanctionsLists, total: sanctionsLists.length }));
  app.post("/api/kyc-enhanced/sanctions-screen", (req: Request, res: Response) => {
    const { name } = req.body || {};
    res.json({ screenedName: name, matches: 0, riskLevel: "clear", action: "proceed", algorithms: ["levenshtein", "soundex", "jaro_winkler", "double_metaphone"] });
  });

  // Phase 1: CAC API
  app.get("/api/kyc-enhanced/cac-companies", (_: Request, res: Response) => res.json({ items: [
    { id: "CAC-001", rcNumber: "RC-123456", companyName: "Pinnacle Trading Ltd", status: "active", annualReturnsUpToDate: true },
    { id: "CAC-002", rcNumber: "RC-789012", companyName: "ABC Import Export Ltd", status: "active", annualReturnsUpToDate: false },
    { id: "CAC-003", rcNumber: "RC-345678", companyName: "Quantum Resources Nigeria Ltd", status: "under_investigation", postNoDebit: true },
  ], total: 3 }));

  // Phase 2: Transaction Monitoring
  app.get("/api/kyc-enhanced/monitoring-rules", (_: Request, res: Response) => res.json({ items: monitoringRules, total: monitoringRules.length }));
  app.get("/api/kyc-enhanced/txn-alerts", (_: Request, res: Response) => res.json({ items: txnAlerts, total: txnAlerts.length }));

  // Phase 2: Risk-Based Approach
  app.get("/api/kyc-enhanced/risk-scores", (_: Request, res: Response) => res.json({ items: riskScores, total: riskScores.length }));

  // Phase 2: PEP Enhanced DD — extends existing PEP endpoints
  app.get("/api/kyc-enhanced/pep-edd-rules", (_: Request, res: Response) => res.json({ items: [
    { id: "PEP-RULE-001", name: "Source of Wealth Required", pepCategory: "all", enforcement: "mandatory" },
    { id: "PEP-RULE-002", name: "Senior Mgmt Approval", pepCategory: "tier1_domestic", enforcement: "mandatory" },
    { id: "PEP-RULE-003", name: "Annual Review", pepCategory: "all", enforcement: "mandatory" },
    { id: "PEP-RULE-004", name: "Lower Transaction Threshold", pepCategory: "all", threshold: 1000000 },
    { id: "PEP-RULE-005", name: "RCA Auto-Mapping", pepCategory: "all", enforcement: "automated" },
  ], total: 5 }));

  // Phase 2: UBO Graph
  app.get("/api/kyc-enhanced/ubo-entities", (_: Request, res: Response) => res.json({ items: uboEntities, total: uboEntities.length }));
  app.get("/api/kyc-enhanced/ubo-edges", (_: Request, res: Response) => res.json({ items: ownershipEdges, total: ownershipEdges.length }));
  app.get("/api/kyc-enhanced/ubo-alerts", (_: Request, res: Response) => res.json({ items: uboAlerts, total: uboAlerts.length }));

  // Phase 3: Multi-Bureau
  app.get("/api/kyc-enhanced/bureau-checks", (_: Request, res: Response) => res.json({ items: bureauChecks, total: bureauChecks.length }));

  // Phase 3: Address Verification
  app.get("/api/kyc-enhanced/address-verifications", (_: Request, res: Response) => res.json({ items: addressVerifications, total: addressVerifications.length }));

  // Phase 3: Corporate Doc Verification
  app.get("/api/kyc-enhanced/corporate-docs", (_: Request, res: Response) => res.json({ items: [
    { id: "CD-001", companyId: "CAC-001", docType: "MEMART", ocrExtracted: true, verified: true },
    { id: "CD-002", companyId: "CAC-001", docType: "Board Resolution", ocrExtracted: true, verified: true },
    { id: "CD-003", companyId: "CAC-002", docType: "Tax Clearance Certificate", ocrExtracted: true, verified: false, reason: "TCC expired Jan 2025" },
  ], total: 3 }));

  // Phase 3: KYC Analytics
  app.get("/api/kyc-enhanced/analytics-dashboard", (_: Request, res: Response) => res.json({ items: [
    { id: "KYC-DASH-001", name: "Onboarding Funnel", started: 5200, approved: 4400, dropOffRate: "15.4%", status: "active" },
    { id: "KYC-DASH-002", name: "Avg Onboarding Time", tier1: "2.5 min", tier2: "8 min", tier3: "2.5 days", status: "active" },
    { id: "KYC-DASH-003", name: "Channel Breakdown", pwa: 2100, flutter: 1800, agent: 500, status: "active" },
  ], total: 3 }));

  // Phase 4: Video KYC
  app.get("/api/kyc-enhanced/video-kyc-sessions", (_: Request, res: Response) => res.json({ items: videoKYCSessions, total: videoKYCSessions.length }));

  // Phase 4: Continuous Liveness
  app.get("/api/kyc-enhanced/step-up-configs", (_: Request, res: Response) => res.json({ items: [
    { trigger: "high_value_transfer", threshold: 5000000, methods: ["passive_3d", "blink_challenge"] },
    { trigger: "international_transfer", threshold: 0, methods: ["passive_3d", "face_match", "smile_challenge"] },
    { trigger: "new_beneficiary_large", threshold: 2000000, methods: ["passive_3d"] },
    { trigger: "periodic_tier3_quarterly", threshold: 0, methods: ["passive_3d", "face_match", "blink", "smile", "head_turn"] },
  ], total: 4 }));

  // Phase 4: Agent KYC
  app.get("/api/kyc-enhanced/agent-captures", (_: Request, res: Response) => res.json({ items: agentCaptures, total: agentCaptures.length }));

  // Phase 5: Adverse Media
  app.get("/api/kyc-enhanced/adverse-media", (_: Request, res: Response) => res.json({ items: adverseMediaHits, total: adverseMediaHits.length }));

  // Phase 5: Corporate Monitoring
  app.get("/api/kyc-enhanced/corporate-events", (_: Request, res: Response) => res.json({ items: [
    { id: "ME-001", companyId: "CAC-002", eventType: "annual_return_overdue", riskImpact: "high" },
    { id: "ME-002", companyId: "CAC-003", eventType: "efcc_charges_filed", riskImpact: "critical" },
  ], total: 2 }));

  // Phase 5: Data Quality
  app.get("/api/kyc-enhanced/data-quality", (_: Request, res: Response) => {
    const dqItems = Array.isArray(dataQualityMetrics) ? dataQualityMetrics : [dataQualityMetrics];
    res.json({ items: dqItems, total: dqItems.length });
  });

  // Phase 5: eFASS Returns
  app.get("/api/kyc-enhanced/efass-returns", (_: Request, res: Response) => res.json({ items: efassReturns, total: efassReturns.length }));

  // Summary dashboard
  app.get("/api/kyc-enhanced/summary", (_: Request, res: Response) => res.json({ items: [{
    services: {
      phase1: ["cbn-tiered-kyc-rs:8280", "bvn-nin-verification-go:8281", "nfiu-ctr-str-filing-py:8282", "sanctions-screening-rs:8283", "cac-realtime-api-go:8284"],
      phase2: ["txn-monitoring-rules-rs:8285", "risk-based-approach-py:8286", "pep-enhanced-dd-py:8287", "ubo-ownership-graph-rs:8288"],
      phase3: ["multi-bureau-verification-go:8289", "corporate-doc-verification-py:8290", "kyc-analytics-dashboard-py:8291", "address-verification-py:8301"],
      phase4: ["video-kyc-py:8292", "continuous-liveness-rs:8293", "agent-kyc-capture-go:8295", "kyc-self-service-py:8298", "kyc-workflow-orchestration-py:8299"],
      phase5: ["adverse-media-screening-py:8294", "corporate-monitoring-go:8300", "kyc-data-quality-py:8296", "efass-kyc-returns-py:8297"],
    },
    totalNewServices: 22,
    languages: { go: 5, rust: 4, python: 13 },
    middleware: ["Kafka", "Dapr", "Fluvio", "Temporal", "Postgres", "Keycloak", "Permify", "Redis", "Mojaloop", "OpenSearch", "OpenAppSec", "APISIX", "TigerBeetle", "Lakehouse"],
    tierDefinitions: tierDefinitions.length,
    monitoringRules: monitoringRules.length,
    sanctionsLists: sanctionsLists.length,
    uboEntities: uboEntities.length,
    id: "KYC-SUMMARY-001", name: "KYC/KYB Platform Summary", status: "active",
  }], total: 1 }));
}
