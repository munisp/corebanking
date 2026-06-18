/**
 * KYC/KYB Integration Hub — Admin triggers, event-driven verification, cross-service integration.
 *
 * 1. Admin-triggered KYC/KYB: Initiate, re-verify, override, batch trigger, escalate
 * 2. Event-driven triggers: Kafka events auto-trigger KYC/KYB on account opening, loan origination, etc.
 * 3. Cross-service KYC gate: All services requiring identity verification check KYC/KYB status
 *
 * Integrated services: account-opening, loan-origination, trade-finance, card-management,
 *   payments-hub, agent-banking, diaspora-banking, mortgage, virtual-accounts, escrow,
 *   supply-chain-finance, factoring, syndicated-loans, wealth-mgmt, custody, insurance
 */
import type { Express, Request, Response } from "express";

// ── Types ──

interface KYCTrigger {
  id: string;
  customerId: string;
  customerName: string;
  triggerType: "admin_manual" | "event_auto" | "scheduled_review" | "risk_escalation" | "regulatory_mandate";
  triggerSource: string;
  sourceEvent?: string;
  kycEngineVerificationId?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  result?: "verified" | "rejected" | "manual_review";
  priority: "low" | "normal" | "high" | "urgent";
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  notes?: string;
  pipelineSteps: PipelineStep[];
}

interface KYBTrigger {
  id: string;
  companyId: string;
  companyName: string;
  rcNumber: string;
  triggerType: "admin_manual" | "event_auto" | "scheduled_review" | "risk_escalation" | "regulatory_mandate";
  triggerSource: string;
  sourceEvent?: string;
  kybEngineVerificationId?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  result?: "verified" | "rejected" | "manual_review";
  priority: "low" | "normal" | "high" | "urgent";
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  notes?: string;
}

interface PipelineStep {
  step: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
}

interface KYCEventTriggerRule {
  id: string;
  eventName: string;
  kafkaTopic: string;
  description: string;
  triggerCondition: string;
  kycLevel: "basic" | "standard" | "enhanced" | "full_edd";
  autoTrigger: boolean;
  enabled: boolean;
  integratedServices: string[];
  cooldownHours: number;
  lastTriggered?: string;
}

interface ServiceKYCGate {
  serviceId: string;
  serviceName: string;
  port: number;
  kycRequired: boolean;
  kybRequired: boolean;
  minimumKYCLevel: "basic" | "standard" | "enhanced" | "full_edd";
  bypassConditions: string[];
  enforcedEndpoints: string[];
  blockOnFailure: boolean;
  lastCheckAt?: string;
  gateStatus: "enforcing" | "monitoring" | "disabled";
}

interface KYCOverride {
  id: string;
  customerId: string;
  customerName: string;
  overrideType: "approve" | "reject" | "escalate" | "waive_liveness" | "waive_document" | "extend_expiry";
  reason: string;
  approvedBy: string;
  approvalChain: string[];
  makerCheckerId?: string;
  expiresAt?: string;
  createdAt: string;
  status: "active" | "expired" | "revoked";
}

// ── Seed Data ──

const now = () => new Date().toISOString();

function makePipelineSteps(status: "completed" | "in_progress" | "pending"): PipelineStep[] {
  const steps = [
    { step: 1, name: "Document Upload & Quality Check" },
    { step: 2, name: "PaddleOCR-VL 1.5 Extraction" },
    { step: 3, name: "Docling Structured Parsing" },
    { step: 4, name: "VLM Cross-Validation" },
    { step: 5, name: "Liveness Detection (5-method ensemble)" },
    { step: 6, name: "Face-to-ID Matching (ArcFace R100)" },
    { step: 7, name: "Risk Scoring & Decision" },
  ];
  return steps.map((s, i) => ({
    ...s,
    status: status === "completed" ? "completed" as const
      : status === "in_progress" && i < 4 ? "completed" as const
      : status === "in_progress" && i === 4 ? "running" as const
      : "pending" as const,
    ...(status === "completed" || (status === "in_progress" && i < 4) ? { startedAt: "2026-05-10T09:00:00Z", completedAt: "2026-05-10T09:00:30Z" } : {}),
  }));
}

const kycTriggers: KYCTrigger[] = [
  {
    id: "KYCT-001", customerId: "CUS-1045", customerName: "Amina Yusuf",
    triggerType: "event_auto", triggerSource: "account-opening-go",
    sourceEvent: "account.opened", kycEngineVerificationId: "KYCV-001",
    status: "completed", result: "verified", priority: "normal",
    requestedBy: "system/account-opening", requestedAt: "2026-05-08T09:00:00Z",
    completedAt: "2026-05-08T09:02:45Z", pipelineSteps: makePipelineSteps("completed"),
  },
  {
    id: "KYCT-002", customerId: "CUS-2089", customerName: "Chinedu Okeke",
    triggerType: "admin_manual", triggerSource: "admin-dashboard",
    kycEngineVerificationId: "KYCV-003", status: "completed", result: "manual_review",
    priority: "high", requestedBy: "admin/compliance-officer-1",
    requestedAt: "2026-05-09T10:30:00Z", completedAt: "2026-05-09T10:35:00Z",
    notes: "Triggered by compliance officer due to suspicious transaction pattern",
    pipelineSteps: makePipelineSteps("completed"),
  },
  {
    id: "KYCT-003", customerId: "CUS-3021", customerName: "John Doe",
    triggerType: "risk_escalation", triggerSource: "fraud-detection-rs",
    sourceEvent: "fraud.alert.high_risk", status: "in_progress",
    priority: "urgent", requestedBy: "system/fraud-detection",
    requestedAt: "2026-05-10T14:00:00Z",
    notes: "Auto-triggered: fraud detection flagged suspicious activity, re-verification required",
    pipelineSteps: makePipelineSteps("in_progress"),
  },
  {
    id: "KYCT-004", customerId: "CUS-4055", customerName: "Ibrahim Musa",
    triggerType: "scheduled_review", triggerSource: "temporal-sagas-go",
    sourceEvent: "kyc.periodic_review.due", kycEngineVerificationId: "KYCV-002",
    status: "completed", result: "verified", priority: "low",
    requestedBy: "system/temporal-scheduler", requestedAt: "2026-05-01T00:00:00Z",
    completedAt: "2026-05-01T00:03:12Z",
    notes: "Annual KYC review — no changes detected",
    pipelineSteps: makePipelineSteps("completed"),
  },
  {
    id: "KYCT-005", customerId: "CUS-5099", customerName: "Emeka Obi",
    triggerType: "regulatory_mandate", triggerSource: "cbn-returns-py",
    sourceEvent: "cbn.circular.kyc_refresh_mandate", status: "completed",
    result: "rejected", priority: "high",
    requestedBy: "system/cbn-compliance", requestedAt: "2026-05-05T08:00:00Z",
    completedAt: "2026-05-05T08:04:30Z",
    notes: "CBN circular mandated re-KYC for all Tier 3 accounts — face mismatch detected",
    pipelineSteps: makePipelineSteps("completed"),
  },
];

const kybTriggers: KYBTrigger[] = [
  {
    id: "KYBT-001", companyId: "COMP-001", companyName: "Dangote Industries Limited",
    rcNumber: "RC-71242", triggerType: "event_auto", triggerSource: "trade-finance-go",
    sourceEvent: "trade.lc.opened", kybEngineVerificationId: "KYB-001",
    status: "completed", result: "verified", priority: "normal",
    requestedBy: "system/trade-finance", requestedAt: "2026-05-08T11:00:00Z",
    completedAt: "2026-05-08T11:01:30Z",
  },
  {
    id: "KYBT-002", companyId: "COMP-002", companyName: "BUA Group",
    rcNumber: "RC-151345", triggerType: "admin_manual", triggerSource: "admin-dashboard",
    kybEngineVerificationId: "KYB-002", status: "completed", result: "verified",
    priority: "high", requestedBy: "admin/relationship-manager-1",
    requestedAt: "2026-05-09T09:00:00Z", completedAt: "2026-05-09T09:02:00Z",
    notes: "Manual re-verification before ₦5B facility renewal",
  },
  {
    id: "KYBT-003", companyId: "COMP-003", companyName: "Suspicious Trading Co",
    rcNumber: "RC-999888", triggerType: "risk_escalation", triggerSource: "kyc-aml-screening-py",
    sourceEvent: "aml.sanctions.hit", kybEngineVerificationId: "KYB-003",
    status: "completed", result: "rejected", priority: "urgent",
    requestedBy: "system/aml-screening", requestedAt: "2026-05-07T15:00:00Z",
    completedAt: "2026-05-07T15:02:00Z",
    notes: "Director sanctions match triggered automatic KYB re-verification — rejected",
  },
];

const eventTriggerRules: KYCEventTriggerRule[] = [
  {
    id: "ETR-001", eventName: "Account Opened", kafkaTopic: "account.opened",
    description: "Auto-trigger standard KYC when a new account is opened",
    triggerCondition: "account.tier >= 'Tier 2' OR account.product IN ('current', 'domiciliary', 'fixed_deposit')",
    kycLevel: "standard", autoTrigger: true, enabled: true,
    integratedServices: ["account-opening-go", "customer-360-py", "cif-management-go"],
    cooldownHours: 0,
  },
  {
    id: "ETR-002", eventName: "Loan Application Submitted", kafkaTopic: "loan.application.submitted",
    description: "Auto-trigger enhanced KYC for any loan application above ₦500K",
    triggerCondition: "loan.amount >= 500000 OR loan.type IN ('mortgage', 'corporate')",
    kycLevel: "enhanced", autoTrigger: true, enabled: true,
    integratedServices: ["loan-origination-go", "credit-facility-go", "mortgage-servicing-rs"],
    cooldownHours: 24,
  },
  {
    id: "ETR-003", eventName: "Trade Finance LC Opened", kafkaTopic: "trade.lc.opened",
    description: "Auto-trigger full EDD KYB for trade finance letter of credit",
    triggerCondition: "lc.amount >= 1000000 OR counterparty.country NOT IN ('NG', 'US', 'UK', 'EU')",
    kycLevel: "full_edd", autoTrigger: true, enabled: true,
    integratedServices: ["trade-finance-go", "supply-chain-finance-go", "factoring-go"],
    cooldownHours: 72,
  },
  {
    id: "ETR-004", eventName: "Card Issuance Requested", kafkaTopic: "card.issuance.requested",
    description: "Auto-trigger basic KYC for debit card, enhanced for credit card",
    triggerCondition: "card.type === 'credit' ? 'enhanced' : 'basic'",
    kycLevel: "basic", autoTrigger: true, enabled: true,
    integratedServices: ["card-management-go"],
    cooldownHours: 0,
  },
  {
    id: "ETR-005", eventName: "International Transfer Initiated", kafkaTopic: "payment.international.initiated",
    description: "Auto-trigger enhanced KYC for cross-border payments above $1,000",
    triggerCondition: "payment.amount_usd >= 1000 OR payment.destination_country IN (high_risk_list)",
    kycLevel: "enhanced", autoTrigger: true, enabled: true,
    integratedServices: ["payments-hub-go", "remittance-go", "diaspora-banking-py", "mojaloop-connector-go"],
    cooldownHours: 48,
  },
  {
    id: "ETR-006", eventName: "Fraud Alert - High Risk", kafkaTopic: "fraud.alert.high_risk",
    description: "Auto-trigger full EDD re-KYC when fraud detection flags high risk",
    triggerCondition: "alert.risk_score >= 80 OR alert.type IN ('identity_fraud', 'account_takeover')",
    kycLevel: "full_edd", autoTrigger: true, enabled: true,
    integratedServices: ["fraud-detection-rs", "risk-scoring-rs"],
    cooldownHours: 0,
  },
  {
    id: "ETR-007", eventName: "Periodic KYC Review Due", kafkaTopic: "kyc.periodic_review.due",
    description: "Temporal saga triggers annual/biannual KYC review based on risk tier",
    triggerCondition: "customer.last_kyc_date + review_interval <= today",
    kycLevel: "standard", autoTrigger: true, enabled: true,
    integratedServices: ["temporal-sagas-go", "cif-management-go"],
    cooldownHours: 8760,
  },
  {
    id: "ETR-008", eventName: "Agent Onboarded", kafkaTopic: "agent.onboarded",
    description: "Auto-trigger full EDD for agent banking participants",
    triggerCondition: "agent.type IN ('super_agent', 'agent')",
    kycLevel: "full_edd", autoTrigger: true, enabled: true,
    integratedServices: ["agent-banking-go"],
    cooldownHours: 0,
  },
  {
    id: "ETR-009", eventName: "CBN Regulatory Mandate", kafkaTopic: "cbn.circular.kyc_refresh_mandate",
    description: "CBN directive triggers mass re-KYC for affected customer segments",
    triggerCondition: "circular.affected_tiers INTERSECTS customer.tier",
    kycLevel: "enhanced", autoTrigger: true, enabled: true,
    integratedServices: ["cbn-returns-py", "regulatory-reporting-py"],
    cooldownHours: 0,
  },
  {
    id: "ETR-010", eventName: "Virtual Account Created", kafkaTopic: "virtual_account.created",
    description: "Auto-trigger KYC for virtual account holder verification",
    triggerCondition: "account.type === 'corporate' OR account.limit >= 5000000",
    kycLevel: "standard", autoTrigger: true, enabled: true,
    integratedServices: ["virtual-accounts-go", "escrow-go"],
    cooldownHours: 24,
  },
  {
    id: "ETR-011", eventName: "Insurance Policy Bound", kafkaTopic: "insurance.policy.bound",
    description: "Auto-trigger KYC for high-value insurance policies",
    triggerCondition: "policy.sum_assured >= 10000000",
    kycLevel: "enhanced", autoTrigger: true, enabled: true,
    integratedServices: ["insurance-py"],
    cooldownHours: 168,
  },
  {
    id: "ETR-012", eventName: "Wealth Management Onboarding", kafkaTopic: "wealth.client.onboarded",
    description: "Auto-trigger full EDD for wealth management clients (AML/CFT requirement)",
    triggerCondition: "client.aum >= 50000000 OR client.pep_flag === true",
    kycLevel: "full_edd", autoTrigger: true, enabled: true,
    integratedServices: ["wealth-mgmt-py", "custody-service-go", "portfolio-mgmt-rs"],
    cooldownHours: 0,
  },
];

const serviceKYCGates: ServiceKYCGate[] = [
  { serviceId: "account-opening-go", serviceName: "Account Opening", port: 8130, kycRequired: true, kybRequired: false, minimumKYCLevel: "standard", bypassConditions: ["tier1_basic_savings"], enforcedEndpoints: ["/v1/accounts", "/v1/accounts/approve"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "loan-origination-go", serviceName: "Loan Origination", port: 8131, kycRequired: true, kybRequired: false, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/applications", "/v1/applications/approve", "/v1/disbursements"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "trade-finance-go", serviceName: "Trade Finance", port: 8102, kycRequired: true, kybRequired: true, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/lcs", "/v1/lcs/amend", "/v1/guarantees"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "card-management-go", serviceName: "Card Management", port: 8134, kycRequired: true, kybRequired: false, minimumKYCLevel: "basic", bypassConditions: ["debit_card_tier1"], enforcedEndpoints: ["/v1/cards/issue", "/v1/cards/activate"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "payments-hub-go", serviceName: "Payments Hub", port: 8103, kycRequired: true, kybRequired: false, minimumKYCLevel: "standard", bypassConditions: ["amount_below_50000"], enforcedEndpoints: ["/v1/transfers/international", "/v1/transfers/bulk"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "agent-banking-go", serviceName: "Agent Banking", port: 8135, kycRequired: true, kybRequired: false, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/agents/register", "/v1/agents/activate"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "diaspora-banking-py", serviceName: "Diaspora Banking", port: 8147, kycRequired: true, kybRequired: false, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/accounts", "/v1/transfers"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "mortgage-servicing-rs", serviceName: "Mortgage Servicing", port: 8110, kycRequired: true, kybRequired: false, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/applications", "/v1/disbursements"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "virtual-accounts-go", serviceName: "Virtual Accounts", port: 8142, kycRequired: true, kybRequired: false, minimumKYCLevel: "standard", bypassConditions: ["sub_account_verified_parent"], enforcedEndpoints: ["/v1/accounts", "/v1/accounts/activate"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "escrow-go", serviceName: "Escrow", port: 8186, kycRequired: true, kybRequired: true, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/accounts/create", "/v1/accounts/release"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "supply-chain-finance-go", serviceName: "Supply Chain Finance", port: 8104, kycRequired: true, kybRequired: true, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/programs", "/v1/invoices/finance"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "factoring-go", serviceName: "Factoring", port: 8171, kycRequired: true, kybRequired: true, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/agreements", "/v1/invoices/advance"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "syndicated-loans-go", serviceName: "Syndicated Loans", port: 8173, kycRequired: true, kybRequired: true, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/facilities", "/v1/participations"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "wealth-mgmt-py", serviceName: "Wealth Management", port: 8170, kycRequired: true, kybRequired: false, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/clients", "/v1/portfolios"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "custody-service-go", serviceName: "Custody Services", port: 8168, kycRequired: true, kybRequired: true, minimumKYCLevel: "full_edd", bypassConditions: [], enforcedEndpoints: ["/v1/accounts", "/v1/settlements"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "insurance-py", serviceName: "Bancassurance", port: 8194, kycRequired: true, kybRequired: false, minimumKYCLevel: "enhanced", bypassConditions: ["sum_assured_below_1m"], enforcedEndpoints: ["/v1/policies/bind", "/v1/claims"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "remittance-go", serviceName: "Remittance", port: 8183, kycRequired: true, kybRequired: false, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/transfers", "/v1/beneficiaries"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "open-banking-go", serviceName: "Open Banking", port: 8109, kycRequired: true, kybRequired: false, minimumKYCLevel: "standard", bypassConditions: ["read_only_consent"], enforcedEndpoints: ["/v1/consents", "/v1/payments/initiate"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "islamic-banking-py", serviceName: "Islamic Banking", port: 8121, kycRequired: true, kybRequired: false, minimumKYCLevel: "enhanced", bypassConditions: [], enforcedEndpoints: ["/v1/murabaha", "/v1/sukuk/subscribe"], blockOnFailure: true, gateStatus: "enforcing" },
  { serviceId: "microfinance-py", serviceName: "Microfinance", port: 8182, kycRequired: true, kybRequired: false, minimumKYCLevel: "basic", bypassConditions: ["group_lending_verified"], enforcedEndpoints: ["/v1/loans", "/v1/clients"], blockOnFailure: false, gateStatus: "enforcing" },
];

const kycOverrides: KYCOverride[] = [
  {
    id: "OVR-001", customerId: "CUS-9001", customerName: "VIP Corporate Client",
    overrideType: "waive_liveness", reason: "Physically disabled — unable to complete video liveness check per CBN accommodation circular",
    approvedBy: "admin/chief-compliance-officer", approvalChain: ["compliance-officer-1", "branch-manager-lagos", "chief-compliance-officer"],
    makerCheckerId: "MC-4521", expiresAt: "2027-05-10T00:00:00Z",
    createdAt: "2026-05-10T10:00:00Z", status: "active",
  },
  {
    id: "OVR-002", customerId: "CUS-4055", customerName: "Ibrahim Musa",
    overrideType: "extend_expiry", reason: "KYC documents delayed due to NIN enrolment backlog — 30-day extension granted",
    approvedBy: "admin/compliance-officer-2", approvalChain: ["teller-1", "compliance-officer-2"],
    makerCheckerId: "MC-4522", expiresAt: "2026-06-10T00:00:00Z",
    createdAt: "2026-05-10T11:00:00Z", status: "active",
  },
  {
    id: "OVR-003", customerId: "CUS-2089", customerName: "Chinedu Okeke",
    overrideType: "escalate", reason: "PEP-adjacent — enhanced due diligence required before transaction approval",
    approvedBy: "admin/aml-officer-1", approvalChain: ["relationship-manager-1", "aml-officer-1"],
    createdAt: "2026-05-09T14:00:00Z", status: "active",
  },
];

// ── API Registration ──

export function registerKYCKYBIntegration(app: Express) {

  // ─── 1. Admin KYC Triggers ───

  app.get("/api/platform/kyc-triggers", (_: Request, res: Response) => {
    res.json({ items: kycTriggers, total: kycTriggers.length });
  });

  app.get("/api/platform/kyc-triggers/:id", (req: Request, res: Response) => {
    const t = kycTriggers.find(x => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: "KYC trigger not found" });
    res.json(t);
  });

  app.post("/api/platform/kyc-triggers/initiate", (req: Request, res: Response) => {
    const { customerId, customerName, documentType, priority, notes, requestedBy } = req.body || {};
    if (!customerId || !customerName) {
      return res.status(400).json({ error: "customerId and customerName are required" });
    }
    const trigger: KYCTrigger = {
      id: `KYCT-${String(kycTriggers.length + 1).padStart(3, "0")}`,
      customerId, customerName,
      triggerType: "admin_manual", triggerSource: "admin-dashboard",
      status: "pending", priority: priority || "normal",
      requestedBy: requestedBy || "admin/unknown",
      requestedAt: now(), notes,
      pipelineSteps: makePipelineSteps("pending"),
    };
    kycTriggers.push(trigger);
    res.status(201).json({
      ...trigger,
      message: `KYC verification initiated for ${customerName}`,
      kafkaEvent: { topic: "kyc.admin.triggered", payload: { triggerId: trigger.id, customerId, documentType } },
    });
  });

  app.post("/api/platform/kyc-triggers/re-verify", (req: Request, res: Response) => {
    const { customerId, customerName, reason, requestedBy } = req.body || {};
    if (!customerId) return res.status(400).json({ error: "customerId required" });
    const trigger: KYCTrigger = {
      id: `KYCT-${String(kycTriggers.length + 1).padStart(3, "0")}`,
      customerId, customerName: customerName || customerId,
      triggerType: "admin_manual", triggerSource: "admin-dashboard",
      status: "pending", priority: "high",
      requestedBy: requestedBy || "admin/unknown",
      requestedAt: now(), notes: `Re-verification: ${reason || "Admin requested"}`,
      pipelineSteps: makePipelineSteps("pending"),
    };
    kycTriggers.push(trigger);
    res.status(201).json({
      ...trigger,
      message: `KYC re-verification initiated for ${trigger.customerName}`,
      kafkaEvents: [
        { topic: "kyc.reverify.triggered", payload: { triggerId: trigger.id, customerId } },
        { topic: "kyc.customer.status_changed", payload: { customerId, newStatus: "reverification_pending" } },
      ],
    });
  });

  app.post("/api/platform/kyc-triggers/batch", (req: Request, res: Response) => {
    const { customerIds, reason, priority, requestedBy } = req.body || {};
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: "customerIds array required (non-empty)" });
    }
    const created = customerIds.map((c: { id: string; name: string }) => {
      const trigger: KYCTrigger = {
        id: `KYCT-${String(kycTriggers.length + 1).padStart(3, "0")}`,
        customerId: c.id, customerName: c.name || c.id,
        triggerType: "admin_manual", triggerSource: "admin-batch",
        status: "pending", priority: priority || "normal",
        requestedBy: requestedBy || "admin/unknown",
        requestedAt: now(), notes: `Batch: ${reason || "Admin batch KYC"}`,
        pipelineSteps: makePipelineSteps("pending"),
      };
      kycTriggers.push(trigger);
      return trigger;
    });
    res.status(201).json({
      batchId: `BATCH-${Date.now()}`,
      total: created.length,
      triggers: created,
      kafkaEvent: { topic: "kyc.batch.triggered", payload: { batchSize: created.length, customerIds: customerIds.map((c: { id: string }) => c.id) } },
    });
  });

  // ─── 2. Admin KYC Overrides ───

  app.get("/api/platform/kyc-overrides", (_: Request, res: Response) => {
    res.json({ items: kycOverrides, total: kycOverrides.length });
  });

  app.post("/api/platform/kyc-overrides", (req: Request, res: Response) => {
    const { customerId, customerName, overrideType, reason, approvedBy } = req.body || {};
    if (!customerId || !overrideType || !reason || !approvedBy) {
      return res.status(400).json({ error: "customerId, overrideType, reason, and approvedBy required" });
    }
    const override: KYCOverride = {
      id: `OVR-${String(kycOverrides.length + 1).padStart(3, "0")}`,
      customerId, customerName: customerName || customerId,
      overrideType, reason, approvedBy,
      approvalChain: [approvedBy],
      createdAt: now(), status: "active",
    };
    kycOverrides.push(override);
    res.status(201).json({
      ...override,
      kafkaEvent: { topic: "kyc.override.created", payload: { overrideId: override.id, customerId, overrideType } },
    });
  });

  // ─── 3. Admin KYB Triggers ───

  app.get("/api/platform/kyb-triggers", (_: Request, res: Response) => {
    res.json({ items: kybTriggers, total: kybTriggers.length });
  });

  app.post("/api/platform/kyb-triggers/initiate", (req: Request, res: Response) => {
    const { companyId, companyName, rcNumber, priority, notes, requestedBy } = req.body || {};
    if (!companyName || !rcNumber) {
      return res.status(400).json({ error: "companyName and rcNumber are required" });
    }
    const trigger: KYBTrigger = {
      id: `KYBT-${String(kybTriggers.length + 1).padStart(3, "0")}`,
      companyId: companyId || `COMP-${Date.now()}`, companyName, rcNumber,
      triggerType: "admin_manual", triggerSource: "admin-dashboard",
      status: "pending", priority: priority || "normal",
      requestedBy: requestedBy || "admin/unknown",
      requestedAt: now(), notes,
    };
    kybTriggers.push(trigger);
    res.status(201).json({
      ...trigger,
      message: `KYB verification initiated for ${companyName} (${rcNumber})`,
      kafkaEvent: { topic: "kyb.admin.triggered", payload: { triggerId: trigger.id, companyName, rcNumber } },
    });
  });

  // ─── 4. Event Trigger Rules ───

  app.get("/api/platform/kyc-event-rules", (_: Request, res: Response) => {
    res.json({ items: eventTriggerRules, total: eventTriggerRules.length });
  });

  app.put("/api/platform/kyc-event-rules/:id/toggle", (req: Request, res: Response) => {
    const rule = eventTriggerRules.find(r => r.id === req.params.id);
    if (!rule) return res.status(404).json({ error: "Event trigger rule not found" });
    rule.enabled = !rule.enabled;
    res.json({ ...rule, message: `Rule ${rule.id} is now ${rule.enabled ? "enabled" : "disabled"}` });
  });

  // ─── 5. Service KYC Gates ───

  app.get("/api/platform/kyc-gates", (_: Request, res: Response) => {
    res.json({ items: serviceKYCGates, total: serviceKYCGates.length });
  });

  app.put("/api/platform/kyc-gates/:serviceId/toggle", (req: Request, res: Response) => {
    const gate = serviceKYCGates.find(g => g.serviceId === req.params.serviceId);
    if (!gate) return res.status(404).json({ error: "Service KYC gate not found" });
    const nextStatus = gate.gateStatus === "enforcing" ? "monitoring" : gate.gateStatus === "monitoring" ? "disabled" : "enforcing";
    gate.gateStatus = nextStatus as "enforcing" | "monitoring" | "disabled";
    res.json({ ...gate, message: `KYC gate for ${gate.serviceName} is now: ${gate.gateStatus}` });
  });

  app.post("/api/platform/kyc-gates/check", (req: Request, res: Response) => {
    const { serviceId, customerId, operation } = req.body || {};
    if (!serviceId || !customerId) {
      return res.status(400).json({ error: "serviceId and customerId required" });
    }
    const gate = serviceKYCGates.find(g => g.serviceId === serviceId);
    if (!gate) return res.status(404).json({ error: "Service not found in KYC gates" });
    if (gate.gateStatus === "disabled") {
      return res.json({ allowed: true, reason: "KYC gate disabled for this service", gateStatus: "disabled" });
    }
    const kycVerified = kycTriggers.some(t => t.customerId === customerId && t.status === "completed" && t.result === "verified");
    const allowed = kycVerified || gate.gateStatus === "monitoring";
    res.json({
      allowed,
      serviceId: gate.serviceId,
      serviceName: gate.serviceName,
      customerId,
      operation: operation || "unknown",
      kycVerified,
      gateStatus: gate.gateStatus,
      minimumLevel: gate.minimumKYCLevel,
      blockOnFailure: gate.blockOnFailure,
      reason: allowed ? "KYC verified — operation permitted" : "KYC verification required — operation blocked",
      kafkaEvent: !allowed ? { topic: "kyc.gate.blocked", payload: { serviceId, customerId, operation } } : undefined,
    });
  });

  // ─── 6. Integration Dashboard ───

  app.get("/api/platform/kyc-integration/dashboard", (_: Request, res: Response) => {
    const totalKYCTriggers = kycTriggers.length;
    const completedKYC = kycTriggers.filter(t => t.status === "completed").length;
    const pendingKYC = kycTriggers.filter(t => t.status === "pending" || t.status === "in_progress").length;
    const adminTriggered = kycTriggers.filter(t => t.triggerType === "admin_manual").length;
    const eventTriggered = kycTriggers.filter(t => t.triggerType === "event_auto").length;
    const riskEscalated = kycTriggers.filter(t => t.triggerType === "risk_escalation").length;
    const scheduledReviews = kycTriggers.filter(t => t.triggerType === "scheduled_review").length;
    const totalKYBTriggers = kybTriggers.length;
    const enabledRules = eventTriggerRules.filter(r => r.enabled).length;
    const enforcingGates = serviceKYCGates.filter(g => g.gateStatus === "enforcing").length;
    const activeOverrides = kycOverrides.filter(o => o.status === "active").length;

    res.json({
      kycTriggers: { total: totalKYCTriggers, completed: completedKYC, pending: pendingKYC, adminTriggered, eventTriggered, riskEscalated, scheduledReviews },
      kybTriggers: { total: totalKYBTriggers, completed: kybTriggers.filter(t => t.status === "completed").length },
      eventRules: { total: eventTriggerRules.length, enabled: enabledRules, disabled: eventTriggerRules.length - enabledRules },
      serviceGates: { total: serviceKYCGates.length, enforcing: enforcingGates, monitoring: serviceKYCGates.filter(g => g.gateStatus === "monitoring").length, disabled: serviceKYCGates.filter(g => g.gateStatus === "disabled").length },
      overrides: { total: kycOverrides.length, active: activeOverrides },
      integratedServices: Array.from(new Set(eventTriggerRules.flatMap(r => r.integratedServices))).sort(),
      kafkaTopics: Array.from(new Set(eventTriggerRules.map(r => r.kafkaTopic))).sort(),
    });
  });

  app.get("/api/platform/kyc-integration/stats", (_: Request, res: Response) => {
    res.json({
      total_kyc_triggers: kycTriggers.length,
      total_kyb_triggers: kybTriggers.length,
      total_event_rules: eventTriggerRules.length,
      enabled_event_rules: eventTriggerRules.filter(r => r.enabled).length,
      total_service_gates: serviceKYCGates.length,
      enforcing_gates: serviceKYCGates.filter(g => g.gateStatus === "enforcing").length,
      total_overrides: kycOverrides.length,
      active_overrides: kycOverrides.filter(o => o.status === "active").length,
      integrated_services_count: Array.from(new Set(eventTriggerRules.flatMap(r => r.integratedServices))).length,
      kafka_topics_count: Array.from(new Set(eventTriggerRules.map(r => r.kafkaTopic))).length,
    });
  });
}
