// E6: Workflow Automation — Visual workflow builder, approval chains, SLA tracking
import type { Express, Request, Response } from "express";

interface WorkflowDefinition {
  id: string; name: string; category: string; steps: WorkflowStep[];
  slaHours: number; status: string; version: number; createdBy: string;
}

interface WorkflowStep {
  stepId: string; name: string; type: string; assignee: string;
  slaMinutes: number; autoEscalate: boolean;
}

interface WorkflowInstance {
  id: string; workflowId: string; workflowName: string; currentStep: number;
  status: string; startedAt: string; completedAt: string | null;
  initiator: string; data: Record<string, unknown>;
}

const workflows: WorkflowDefinition[] = [
  { id: "WF-001", name: "Loan Approval", category: "lending", version: 3, status: "active", createdBy: "system", slaHours: 48,
    steps: [
      { stepId: "S1", name: "Credit Assessment", type: "automated", assignee: "credit_engine", slaMinutes: 5, autoEscalate: true },
      { stepId: "S2", name: "Branch Manager Review", type: "approval", assignee: "branch_manager", slaMinutes: 240, autoEscalate: true },
      { stepId: "S3", name: "Risk Committee", type: "approval", assignee: "risk_committee", slaMinutes: 480, autoEscalate: true },
      { stepId: "S4", name: "Disbursement", type: "automated", assignee: "payments_hub", slaMinutes: 10, autoEscalate: false },
    ] },
  { id: "WF-002", name: "Account Opening", category: "operations", version: 2, status: "active", createdBy: "system", slaHours: 24,
    steps: [
      { stepId: "S1", name: "KYC Verification", type: "automated", assignee: "kyc_engine", slaMinutes: 3, autoEscalate: true },
      { stepId: "S2", name: "Document Validation", type: "manual", assignee: "operations_officer", slaMinutes: 120, autoEscalate: true },
      { stepId: "S3", name: "Account Creation", type: "automated", assignee: "core_banking", slaMinutes: 1, autoEscalate: false },
    ] },
  { id: "WF-003", name: "International Transfer", category: "payments", version: 1, status: "active", createdBy: "system", slaHours: 4,
    steps: [
      { stepId: "S1", name: "Sanctions Screening", type: "automated", assignee: "aml_engine", slaMinutes: 2, autoEscalate: true },
      { stepId: "S2", name: "Compliance Review", type: "approval", assignee: "compliance_officer", slaMinutes: 60, autoEscalate: true },
      { stepId: "S3", name: "Treasury Approval", type: "approval", assignee: "treasury_dealer", slaMinutes: 30, autoEscalate: true },
      { stepId: "S4", name: "SWIFT Dispatch", type: "automated", assignee: "swift_gateway", slaMinutes: 5, autoEscalate: false },
    ] },
  { id: "WF-004", name: "Card Issuance", category: "cards", version: 1, status: "active", createdBy: "system", slaHours: 72,
    steps: [
      { stepId: "S1", name: "KYC Check", type: "automated", assignee: "kyc_engine", slaMinutes: 3, autoEscalate: true },
      { stepId: "S2", name: "Card Personalization", type: "automated", assignee: "card_vendor", slaMinutes: 2880, autoEscalate: true },
      { stepId: "S3", name: "PIN Generation", type: "automated", assignee: "hsm", slaMinutes: 1, autoEscalate: false },
      { stepId: "S4", name: "Dispatch to Branch", type: "manual", assignee: "logistics", slaMinutes: 1440, autoEscalate: true },
    ] },
];

const instances: WorkflowInstance[] = [
  { id: "WFI-001", workflowId: "WF-001", workflowName: "Loan Approval", currentStep: 2, status: "in_progress", startedAt: "2026-05-09T10:00:00Z", completedAt: null, initiator: "customer_360", data: { loanAmount: 5000000, customerId: "CUS-1001" } },
  { id: "WFI-002", workflowId: "WF-002", workflowName: "Account Opening", currentStep: 3, status: "completed", startedAt: "2026-05-09T09:00:00Z", completedAt: "2026-05-09T09:45:00Z", initiator: "onboarding_portal", data: { accountType: "savings", customerId: "CUS-2045" } },
  { id: "WFI-003", workflowId: "WF-003", workflowName: "International Transfer", currentStep: 1, status: "blocked", startedAt: "2026-05-09T11:30:00Z", completedAt: null, initiator: "teller_ops", data: { amount: 50000, currency: "USD", beneficiary: "Overseas Ltd" } },
];

export function registerWorkflowAutomation(app: Express) {
  app.get("/api/platform/workflows/definitions", (_: Request, res: Response) => {
    res.json({ items: workflows, total: workflows.length });
  });

  app.get("/api/platform/workflows/instances", (_: Request, res: Response) => {
    res.json({ items: instances, total: instances.length });
  });

  app.get("/api/platform/workflows/sla-dashboard", (_: Request, res: Response) => {
    const active = instances.filter(i => i.status === "in_progress" || i.status === "blocked");
    const breached = active.filter(i => {
      const wf = workflows.find(w => w.id === i.workflowId);
      if (!wf) return false;
      const elapsed = (Date.now() - new Date(i.startedAt).getTime()) / 3600000;
      return elapsed > wf.slaHours;
    });
    res.json({
      total_active: active.length, total_completed: instances.filter(i => i.status === "completed").length,
      sla_breached: breached.length, blocked: instances.filter(i => i.status === "blocked").length,
      avg_completion_time_hours: 2.5,
    });
  });

  app.post("/api/platform/workflows/instances/:id/advance", (req: Request, res: Response) => {
    const inst = instances.find(i => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Instance not found" });
    const wf = workflows.find(w => w.id === inst.workflowId);
    if (!wf) return res.status(404).json({ error: "Workflow definition not found" });
    if (inst.currentStep >= wf.steps.length) {
      inst.status = "completed";
      inst.completedAt = new Date().toISOString();
    } else {
      inst.currentStep++;
      if (inst.currentStep >= wf.steps.length) { inst.status = "completed"; inst.completedAt = new Date().toISOString(); }
    }
    res.json(inst);
  });
}
