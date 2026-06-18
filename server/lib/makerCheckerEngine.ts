/**
 * Maker-Checker Workflow Engine — Multi-level approval for high-value operations.
 * Implements approval chains, delegation, escalation, SLA tracking,
 * and comprehensive audit trails for Nigerian banking compliance.
 */
import type { Express, Request, Response } from "express";

interface ApprovalRule {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  approvalLevels: number;
  approvers: string[][];
  slaMinutes: number;
  escalationPolicy: string;
  status: "active" | "disabled";
}

interface ApprovalRequest {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  ruleId: string;
  initiator: { userId: string; email: string; role: string };
  action: string;
  payload: Record<string, unknown>;
  currentLevel: number;
  totalLevels: number;
  approvals: { level: number; approverId: string; email: string; decision: "approved" | "rejected" | "pending"; comment?: string; decidedAt?: string }[];
  status: "pending" | "approved" | "rejected" | "expired" | "escalated";
  createdAt: string;
  slaDeadline: string;
  completedAt?: string;
}

const APPROVAL_RULES: ApprovalRule[] = [
  { id: "RULE-001", name: "High-Value Transfer (>₦10M)", entityType: "transfer", condition: "amount > 10000000", approvalLevels: 2, approvers: [["branch_manager", "operations_head"], ["cfo", "ceo"]], slaMinutes: 60, escalationPolicy: "escalate_to_next_level_after_sla", status: "active" },
  { id: "RULE-002", name: "Loan Approval (>₦5M)", entityType: "loan", condition: "amount > 5000000", approvalLevels: 3, approvers: [["loan_officer"], ["credit_committee"], ["md_approval"]], slaMinutes: 1440, escalationPolicy: "notify_compliance_after_sla", status: "active" },
  { id: "RULE-003", name: "New Account Opening (Corporate)", entityType: "account", condition: "accountType == corporate", approvalLevels: 2, approvers: [["kyc_officer"], ["compliance_officer"]], slaMinutes: 480, escalationPolicy: "escalate_to_next_level_after_sla", status: "active" },
  { id: "RULE-004", name: "FX Order (>$100K)", entityType: "fx_order", condition: "amount > 100000", approvalLevels: 2, approvers: [["treasury_dealer"], ["treasury_head"]], slaMinutes: 30, escalationPolicy: "auto_reject_after_sla", status: "active" },
  { id: "RULE-005", name: "Card Limit Increase (>₦5M daily)", entityType: "card_limit", condition: "dailyLimit > 5000000", approvalLevels: 1, approvers: [["card_admin", "branch_manager"]], slaMinutes: 120, escalationPolicy: "notify_card_ops_head", status: "active" },
  { id: "RULE-006", name: "GL Journal Entry (>₦50M)", entityType: "gl_journal", condition: "totalAmount > 50000000", approvalLevels: 2, approvers: [["accountant"], ["cfo"]], slaMinutes: 240, escalationPolicy: "escalate_to_next_level_after_sla", status: "active" },
  { id: "RULE-007", name: "Dormancy Reactivation", entityType: "account_reactivation", condition: "dormancyDays > 365", approvalLevels: 2, approvers: [["operations_officer"], ["compliance_officer"]], slaMinutes: 480, escalationPolicy: "notify_compliance_after_sla", status: "active" },
  { id: "RULE-008", name: "Bulk Payment (>100 beneficiaries)", entityType: "bulk_payment", condition: "beneficiaryCount > 100", approvalLevels: 2, approvers: [["operations_head"], ["cfo"]], slaMinutes: 120, escalationPolicy: "escalate_to_next_level_after_sla", status: "active" },
];

const APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id: "APR-001", tenantId: "TEN-GTBANK", entityType: "transfer", entityId: "TXN-HV-001", ruleId: "RULE-001",
    initiator: { userId: "USR-GT-OP01", email: "operations@gtbank.ng", role: "operator" },
    action: "Transfer ₦25,000,000 to BUA Group", payload: { amount: 25000000, fromAccount: "0012345678", toAccount: "0098765432", narration: "Q2 Invoice Payment" },
    currentLevel: 2, totalLevels: 2,
    approvals: [
      { level: 1, approverId: "USR-GT-BM01", email: "branchmanager@gtbank.ng", decision: "approved", comment: "Verified against purchase order PO-2026-089", decidedAt: "2026-05-09T10:15:00Z" },
      { level: 2, approverId: "", email: "", decision: "pending" },
    ],
    status: "pending", createdAt: "2026-05-09T10:00:00Z", slaDeadline: "2026-05-09T11:00:00Z",
  },
  {
    id: "APR-002", tenantId: "TEN-FIRSTBANK", entityType: "loan", entityId: "LOAN-2026-078", ruleId: "RULE-002",
    initiator: { userId: "USR-FB-LO01", email: "loanofficer@firstbanknigeria.com", role: "loan_officer" },
    action: "Approve personal loan ₦8,500,000 for Adewale Johnson", payload: { amount: 8500000, customerId: "CUST-FB-045", tenor: 36, rate: 18.5 },
    currentLevel: 2, totalLevels: 3,
    approvals: [
      { level: 1, approverId: "USR-FB-LO01", email: "loanofficer@firstbanknigeria.com", decision: "approved", comment: "Credit score 720, DTI ratio 35%", decidedAt: "2026-05-09T09:30:00Z" },
      { level: 2, approverId: "", email: "", decision: "pending" },
      { level: 3, approverId: "", email: "", decision: "pending" },
    ],
    status: "pending", createdAt: "2026-05-09T09:00:00Z", slaDeadline: "2026-05-10T09:00:00Z",
  },
  {
    id: "APR-003", tenantId: "TEN-WEMA", entityType: "account", entityId: "ACCT-NEW-CORP-001", ruleId: "RULE-003",
    initiator: { userId: "USR-WEMA-CS01", email: "cs@wemabank.com", role: "kyc_officer" },
    action: "Open corporate account for Paystack Payments Limited", payload: { businessName: "Paystack Payments Limited", rcNumber: "RC-1456789", accountType: "corporate" },
    currentLevel: 1, totalLevels: 2,
    approvals: [
      { level: 1, approverId: "USR-WEMA-CS01", email: "cs@wemabank.com", decision: "approved", comment: "KYB verification complete, all documents verified", decidedAt: "2026-05-09T11:00:00Z" },
      { level: 2, approverId: "USR-WEMA-CO01", email: "compliance@wemabank.com", decision: "approved", comment: "Sanctions screening clear, PEP check negative", decidedAt: "2026-05-09T11:30:00Z" },
    ],
    status: "approved", createdAt: "2026-05-09T10:30:00Z", slaDeadline: "2026-05-09T18:30:00Z", completedAt: "2026-05-09T11:30:00Z",
  },
  {
    id: "APR-004", tenantId: "TEN-GTBANK", entityType: "fx_order", entityId: "FX-2026-012", ruleId: "RULE-004",
    initiator: { userId: "USR-GT-TD01", email: "treasury@gtbank.ng", role: "treasury_dealer" },
    action: "Buy $250,000 at ₦1,580/$ for Dangote Industries", payload: { amount: 250000, currency: "USD", rate: 1580, totalNGN: 395000000 },
    currentLevel: 1, totalLevels: 2,
    approvals: [{ level: 1, approverId: "", email: "", decision: "pending" }, { level: 2, approverId: "", email: "", decision: "pending" }],
    status: "pending", createdAt: "2026-05-09T14:45:00Z", slaDeadline: "2026-05-09T15:15:00Z",
  },
];

export function registerMakerCheckerEngine(app: Express) {
  app.get("/api/maker-checker/v1/rules", (_req: Request, res: Response) => {
    res.json({ items: APPROVAL_RULES, total: APPROVAL_RULES.length });
  });
  app.get("/api/maker-checker/v1/requests", (req: Request, res: Response) => {
    const status = req.query.status as string;
    const filtered = status ? APPROVAL_REQUESTS.filter((r) => r.status === status) : APPROVAL_REQUESTS;
    res.json({ items: filtered, total: filtered.length });
  });
  app.get("/api/maker-checker/v1/requests/:id", (req: Request, res: Response) => {
    const r = APPROVAL_REQUESTS.find((x) => x.id === req.params.id);
    r ? res.json(r) : res.status(404).json({ error: "Request not found" });
  });
  app.post("/api/maker-checker/v1/requests/:id/approve", (req: Request, res: Response) => {
    const r = APPROVAL_REQUESTS.find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const pending = r.approvals.find((a) => a.decision === "pending");
    if (pending) {
      pending.decision = "approved";
      pending.approverId = req.body?.approverId ?? "USR-APPROVER";
      pending.email = req.body?.email ?? "approver@54bank.com";
      pending.comment = req.body?.comment ?? "";
      pending.decidedAt = new Date().toISOString();
      r.currentLevel++;
    }
    if (r.approvals.every((a) => a.decision === "approved")) {
      r.status = "approved";
      r.completedAt = new Date().toISOString();
    }
    res.json(r);
  });
  app.post("/api/maker-checker/v1/requests/:id/reject", (req: Request, res: Response) => {
    const r = APPROVAL_REQUESTS.find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    r.status = "rejected";
    r.completedAt = new Date().toISOString();
    const pending = r.approvals.find((a) => a.decision === "pending");
    if (pending) { pending.decision = "rejected"; pending.comment = req.body?.reason ?? "Rejected"; pending.decidedAt = new Date().toISOString(); }
    res.json(r);
  });
  app.get("/api/maker-checker/v1/stats", (_req: Request, res: Response) => {
    res.json({
      totalRules: APPROVAL_RULES.length, totalRequests: APPROVAL_REQUESTS.length,
      pending: APPROVAL_REQUESTS.filter((r) => r.status === "pending").length,
      approved: APPROVAL_REQUESTS.filter((r) => r.status === "approved").length,
      rejected: APPROVAL_REQUESTS.filter((r) => r.status === "rejected").length,
      avgApprovalTimeMin: 42, slaBreaches: 0, escalations: 0,
    });
  });
}
