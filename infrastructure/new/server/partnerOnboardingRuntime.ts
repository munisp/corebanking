export type OperatorRole = "branch" | "operations" | "treasury" | "compliance";

export type PartnerType = "mfb" | "fintech" | "cooperative" | "agency" | "enterprise";
export type PartnerPlan = "starter" | "growth" | "enterprise";
export type PartnerStage =
  | "draft"
  | "submitted"
  | "compliance_review"
  | "commercial_review"
  | "operations_review"
  | "approved"
  | "provisioning"
  | "launch_ready"
  | "launched";
export type ComplianceStatus = "not_started" | "in_review" | "approved" | "rejected";
export type ApprovalStage = "compliance_review" | "commercial_review" | "operations_review" | "launch_signoff";
export type ApprovalState = "pending" | "approved" | "rejected";

export interface PartnerChecklistItem {
  key: string;
  label: string;
  owner: "partner" | "compliance" | "operations";
  completed: boolean;
}

export interface PartnerContact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface PartnerCommercialProfile {
  plan: PartnerPlan;
  billingModel: string;
  revenueSharePct: number;
  settlementBank: string;
  settlementAccountName: string;
  settlementAccountNumber: string;
  settlementFrequency: "daily" | "weekly" | "monthly";
  goLiveTarget?: string;
}

export interface PartnerComplianceProfile {
  kybStatus: ComplianceStatus;
  requiredDocumentCount: number;
  submittedDocumentCount: number;
  riskRating: "low" | "medium" | "high";
  notes?: string;
  lastReviewedAt?: string;
}

export interface PartnerBrandingProfile {
  displayName: string;
  supportEmail: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  loginHeadline: string;
  customDomain?: string;
}

export interface PartnerOnboardingRecord {
  id: string;
  tenantId: string;
  partnerName: string;
  legalEntity: string;
  partnerType: PartnerType;
  region: string;
  stage: PartnerStage;
  requestedModules: string[];
  primaryContact: PartnerContact;
  operationsContact: PartnerContact;
  commercial: PartnerCommercialProfile;
  compliance: PartnerComplianceProfile;
  branding: PartnerBrandingProfile;
  checklist: PartnerChecklistItem[];
  blockers: string[];
  readinessScore: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  launchedAt?: string;
  lastSubmittedBy?: string;
}

export interface PartnerApprovalRecord {
  id: string;
  partnerId: string;
  stage: ApprovalStage;
  title: string;
  detail: string;
  state: ApprovalState;
  requiredRole: OperatorRole;
  requestedAt: string;
  requestedById: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface PartnerOnboardingState {
  partnerOnboardingRecords?: PartnerOnboardingRecord[];
  partnerApprovalRecords?: PartnerApprovalRecord[];
}

function defaultChecklist(): PartnerChecklistItem[] {
  return [
    { key: "company_profile", label: "Company profile completed", owner: "partner", completed: false },
    { key: "commercial_terms", label: "Commercial package confirmed", owner: "partner", completed: false },
    { key: "kyb_documents", label: "KYB and compliance documents uploaded", owner: "partner", completed: false },
    { key: "branding_pack", label: "Branding pack finalized", owner: "partner", completed: false },
    { key: "ops_runbook", label: "Operations runbook reviewed", owner: "operations", completed: false },
    { key: "launch_readiness", label: "Launch readiness review completed", owner: "operations", completed: false },
  ];
}

function defaultBranding(partnerName: string, displayName?: string): PartnerBrandingProfile {
  return {
    displayName: displayName || partnerName,
    supportEmail: "partners@54bank.app",
    primaryColor: "#0f766e",
    accentColor: "#f59e0b",
    logoUrl: "https://assets.54bank.app/logos/54bank-partner-program.png",
    loginHeadline: `${displayName || partnerName} onboarding workspace is ready for configuration and review.`,
    customDomain: "",
  };
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const seededPartnerOnboardingRecords: PartnerOnboardingRecord[] = [
  {
    id: "PARTNER-001",
    tenantId: "tenant-sunrise-mfb",
    partnerName: "Sunrise Microfinance Bank",
    legalEntity: "Sunrise MFB Limited",
    partnerType: "mfb",
    region: "Lagos",
    stage: "commercial_review",
    requestedModules: ["digital_onboarding", "cards", "transfers", "savings", "notifications"],
    primaryContact: {
      name: "Ifeoma Okonkwo",
      role: "Program lead",
      email: "ifeoma@sunrisemfb.bank",
      phone: "+234800010001",
    },
    operationsContact: {
      name: "Tunde Adebayo",
      role: "Operations manager",
      email: "ops@sunrisemfb.bank",
      phone: "+234800010002",
    },
    commercial: {
      plan: "growth",
      billingModel: "Revenue share + platform fee",
      revenueSharePct: 12,
      settlementBank: "54Bank Settlement",
      settlementAccountName: "Sunrise Settlement Collection",
      settlementAccountNumber: "1234567890",
      settlementFrequency: "daily",
      goLiveTarget: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(),
    },
    compliance: {
      kybStatus: "in_review",
      requiredDocumentCount: 8,
      submittedDocumentCount: 8,
      riskRating: "medium",
      notes: "Corporate documents received; awaiting commercial sign-off before provisioning.",
      lastReviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
    branding: {
      displayName: "Sunrise Bank",
      supportEmail: "support@sunrisemfb.bank",
      primaryColor: "#ea580c",
      accentColor: "#1d4ed8",
      logoUrl: "https://assets.54bank.app/logos/sunrise-mfb.png",
      loginHeadline: "Digital banking tailored for Sunrise branch and field teams.",
      customDomain: "bank.sunrisemfb.bank",
    },
    checklist: [
      { key: "company_profile", label: "Company profile completed", owner: "partner", completed: true },
      { key: "commercial_terms", label: "Commercial package confirmed", owner: "partner", completed: true },
      { key: "kyb_documents", label: "KYB and compliance documents uploaded", owner: "partner", completed: true },
      { key: "branding_pack", label: "Branding pack finalized", owner: "partner", completed: true },
      { key: "ops_runbook", label: "Operations runbook reviewed", owner: "operations", completed: false },
      { key: "launch_readiness", label: "Launch readiness review completed", owner: "operations", completed: false },
    ],
    blockers: [],
    readinessScore: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    lastSubmittedBy: "ifeoma@sunrisemfb.bank",
  },
  {
    id: "PARTNER-002",
    tenantId: "tenant-greenfield-fintech",
    partnerName: "Greenfield Lending",
    legalEntity: "Greenfield Lending Technologies Ltd",
    partnerType: "fintech",
    region: "Abuja",
    stage: "draft",
    requestedModules: ["digital_onboarding", "loans", "notifications"],
    primaryContact: {
      name: "Mary Danjuma",
      role: "Founder",
      email: "mary@greenfieldlending.app",
      phone: "+234800010101",
    },
    operationsContact: {
      name: "",
      role: "",
      email: "",
      phone: "",
    },
    commercial: {
      plan: "starter",
      billingModel: "Platform fee",
      revenueSharePct: 8,
      settlementBank: "",
      settlementAccountName: "",
      settlementAccountNumber: "",
      settlementFrequency: "weekly",
      goLiveTarget: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
    },
    compliance: {
      kybStatus: "not_started",
      requiredDocumentCount: 8,
      submittedDocumentCount: 3,
      riskRating: "medium",
      notes: "Draft partner intake still missing KYB packet and settlement details.",
    },
    branding: {
      displayName: "Greenfield",
      supportEmail: "hello@greenfieldlending.app",
      primaryColor: "#166534",
      accentColor: "#f59e0b",
      logoUrl: "https://assets.54bank.app/logos/greenfields-finance.png",
      loginHeadline: "Launch greenfield credit journeys with a branded onboarding experience.",
      customDomain: "",
    },
    checklist: defaultChecklist(),
    blockers: [],
    readinessScore: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

const seededPartnerApprovalRecords: PartnerApprovalRecord[] = [
  {
    id: "PARTNER-APR-001",
    partnerId: "PARTNER-001",
    stage: "compliance_review",
    title: "Compliance readiness review",
    detail: "Validate KYB documents, shareholder structure, and risk posture before commercial packaging is finalized.",
    state: "approved",
    requiredRole: "compliance",
    requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    requestedById: "ifeoma@sunrisemfb.bank",
    resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    resolutionNote: "KYB packet complete. No critical blockers remain at compliance stage.",
  },
  {
    id: "PARTNER-APR-002",
    partnerId: "PARTNER-001",
    stage: "commercial_review",
    title: "Commercial package approval",
    detail: "Confirm pricing, settlement expectations, and requested module scope before provisioning begins.",
    state: "pending",
    requiredRole: "treasury",
    requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    requestedById: "ops@sunrisemfb.bank",
  },
];

export const partnerOnboardingRecords: PartnerOnboardingRecord[] = clone(seededPartnerOnboardingRecords);
export const partnerApprovalRecords: PartnerApprovalRecord[] = clone(seededPartnerApprovalRecords);

function stageOrder(stage: ApprovalStage) {
  return ["compliance_review", "commercial_review", "operations_review", "launch_signoff"].indexOf(stage);
}

function approvalTitle(stage: ApprovalStage) {
  switch (stage) {
    case "compliance_review":
      return "Compliance readiness review";
    case "commercial_review":
      return "Commercial package approval";
    case "operations_review":
      return "Operations readiness approval";
    case "launch_signoff":
      return "Final launch sign-off";
  }
}

function approvalDetail(stage: ApprovalStage, partner: PartnerOnboardingRecord) {
  switch (stage) {
    case "compliance_review":
      return `Validate KYB package and risk posture for ${partner.partnerName}.`;
    case "commercial_review":
      return `Approve pricing, settlement model, and requested modules for ${partner.partnerName}.`;
    case "operations_review":
      return `Confirm onboarding checklist, support readiness, and provisioning dependencies for ${partner.partnerName}.`;
    case "launch_signoff":
      return `Approve launch readiness and white-label rollout for ${partner.partnerName}.`;
  }
}

function approvalRole(stage: ApprovalStage): OperatorRole {
  switch (stage) {
    case "compliance_review":
      return "compliance";
    case "commercial_review":
      return "treasury";
    case "operations_review":
      return "operations";
    case "launch_signoff":
      return "operations";
  }
}

function pendingOrRejectedApprovals(partnerId: string) {
  return partnerApprovalRecords
    .filter((item) => item.partnerId === partnerId)
    .sort((left, right) => stageOrder(left.stage) - stageOrder(right.stage));
}

function requiredStages(): ApprovalStage[] {
  return ["compliance_review", "commercial_review", "operations_review", "launch_signoff"];
}

function normalizeChecklist(checklist?: PartnerChecklistItem[]) {
  const base = defaultChecklist();
  if (!Array.isArray(checklist) || !checklist.length) return base;
  const incoming = new Map(checklist.map((item) => [item.key, item]));
  return base.map((item) => ({ ...item, ...(incoming.get(item.key) ?? {}) }));
}

function mergeContact(input?: Partial<PartnerContact>, current?: PartnerContact): PartnerContact {
  return {
    name: input?.name ?? current?.name ?? "",
    role: input?.role ?? current?.role ?? "",
    email: input?.email ?? current?.email ?? "",
    phone: input?.phone ?? current?.phone ?? "",
  };
}

function mergeCommercial(input?: Partial<PartnerCommercialProfile>, current?: PartnerCommercialProfile): PartnerCommercialProfile {
  return {
    plan: input?.plan ?? current?.plan ?? "starter",
    billingModel: input?.billingModel ?? current?.billingModel ?? "Platform fee",
    revenueSharePct: input?.revenueSharePct ?? current?.revenueSharePct ?? 10,
    settlementBank: input?.settlementBank ?? current?.settlementBank ?? "",
    settlementAccountName: input?.settlementAccountName ?? current?.settlementAccountName ?? "",
    settlementAccountNumber: input?.settlementAccountNumber ?? current?.settlementAccountNumber ?? "",
    settlementFrequency: input?.settlementFrequency ?? current?.settlementFrequency ?? "weekly",
    goLiveTarget: input?.goLiveTarget ?? current?.goLiveTarget,
  };
}

function mergeCompliance(input?: Partial<PartnerComplianceProfile>, current?: PartnerComplianceProfile): PartnerComplianceProfile {
  return {
    kybStatus: input?.kybStatus ?? current?.kybStatus ?? "not_started",
    requiredDocumentCount: input?.requiredDocumentCount ?? current?.requiredDocumentCount ?? 8,
    submittedDocumentCount: input?.submittedDocumentCount ?? current?.submittedDocumentCount ?? 0,
    riskRating: input?.riskRating ?? current?.riskRating ?? "medium",
    notes: input?.notes ?? current?.notes ?? "",
    lastReviewedAt: input?.lastReviewedAt ?? current?.lastReviewedAt,
  };
}

function mergeBranding(input?: Partial<PartnerBrandingProfile>, current?: PartnerBrandingProfile, partnerName?: string): PartnerBrandingProfile {
  const fallback = defaultBranding(partnerName || current?.displayName || "54Bank Partner", current?.displayName || partnerName);
  return {
    displayName: input?.displayName ?? current?.displayName ?? fallback.displayName,
    supportEmail: input?.supportEmail ?? current?.supportEmail ?? fallback.supportEmail,
    primaryColor: input?.primaryColor ?? current?.primaryColor ?? fallback.primaryColor,
    accentColor: input?.accentColor ?? current?.accentColor ?? fallback.accentColor,
    logoUrl: input?.logoUrl ?? current?.logoUrl ?? fallback.logoUrl,
    loginHeadline: input?.loginHeadline ?? current?.loginHeadline ?? fallback.loginHeadline,
    customDomain: input?.customDomain ?? current?.customDomain ?? fallback.customDomain,
  };
}

function computeReadiness(partner: PartnerOnboardingRecord) {
  const approvals = pendingOrRejectedApprovals(partner.id);
  const approvedCount = approvals.filter((item) => item.state === "approved").length;
  const pendingApprovals = approvals.filter((item) => item.state === "pending");
  const rejectedApprovals = approvals.filter((item) => item.state === "rejected");
  const completedChecklist = partner.checklist.filter((item) => item.completed).length;
  const checklistScore = partner.checklist.length ? completedChecklist / partner.checklist.length : 0;
  const docsReady = partner.compliance.requiredDocumentCount > 0
    ? Math.min(1, partner.compliance.submittedDocumentCount / partner.compliance.requiredDocumentCount)
    : 0;
  const orgReady = Number(Boolean(partner.partnerName && partner.legalEntity && partner.region));
  const contactsReady = Number(Boolean(partner.primaryContact.email && partner.operationsContact.email));
  const commercialReady = Number(Boolean(partner.commercial.settlementBank && partner.commercial.settlementAccountNumber && partner.commercial.billingModel));
  const brandingReady = Number(Boolean(partner.branding.displayName && partner.branding.primaryColor && partner.branding.accentColor));
  const modulesReady = Number(partner.requestedModules.length > 0);
  const approvalReady = approvals.length ? approvedCount / approvals.length : 0;
  const score = Math.round(((orgReady + contactsReady + commercialReady + brandingReady + modulesReady + docsReady + checklistScore + approvalReady) / 8) * 100);

  const blockers: string[] = [];
  if (!partner.primaryContact.email) blockers.push("Primary contact details are incomplete.");
  if (!partner.operationsContact.email) blockers.push("Operations contact details are incomplete.");
  if (!partner.commercial.settlementBank || !partner.commercial.settlementAccountNumber) blockers.push("Settlement configuration is incomplete.");
  if (partner.requestedModules.length === 0) blockers.push("Requested modules have not been selected.");
  if (partner.compliance.submittedDocumentCount < partner.compliance.requiredDocumentCount) blockers.push("Compliance documents are incomplete.");
  if (rejectedApprovals.length > 0) blockers.push(...rejectedApprovals.map((item) => `${approvalTitle(item.stage)} was rejected.`));
  if (pendingApprovals.length > 0) blockers.push(...pendingApprovals.map((item) => `${approvalTitle(item.stage)} is still pending.`));
  if (completedChecklist < partner.checklist.length) blockers.push("Launch checklist still has incomplete items.");

  let stage: PartnerStage = partner.stage;
  if (!partner.submittedAt) {
    stage = "draft";
  } else if (rejectedApprovals.some((item) => item.stage === "compliance_review") || pendingApprovals.some((item) => item.stage === "compliance_review")) {
    stage = "compliance_review";
  } else if (rejectedApprovals.some((item) => item.stage === "commercial_review") || pendingApprovals.some((item) => item.stage === "commercial_review")) {
    stage = "commercial_review";
  } else if (rejectedApprovals.some((item) => item.stage === "operations_review") || pendingApprovals.some((item) => item.stage === "operations_review")) {
    stage = "operations_review";
  } else if (rejectedApprovals.some((item) => item.stage === "launch_signoff") || pendingApprovals.some((item) => item.stage === "launch_signoff")) {
    stage = completedChecklist === partner.checklist.length ? "launch_ready" : "provisioning";
  } else if (approvals.length > 0 && approvals.every((item) => item.state === "approved")) {
    stage = completedChecklist === partner.checklist.length ? "launch_ready" : "approved";
  } else if (partner.submittedAt) {
    stage = "submitted";
  }

  return { readinessScore: score, blockers, stage };
}

function refreshDerivedState(partner: PartnerOnboardingRecord) {
  const derived = computeReadiness(partner);
  partner.readinessScore = derived.readinessScore;
  partner.blockers = derived.blockers;
  partner.stage = derived.stage;
  partner.updatedAt = new Date().toISOString();
  return partner;
}

function ensureApproval(partner: PartnerOnboardingRecord, stage: ApprovalStage, requestedById: string) {
  const existing = partnerApprovalRecords.find((item) => item.partnerId === partner.id && item.stage === stage);
  if (existing) {
    if (existing.state === "rejected") {
      existing.state = "pending";
      existing.resolvedAt = undefined;
      existing.resolutionNote = undefined;
      existing.requestedAt = new Date().toISOString();
      existing.requestedById = requestedById;
    }
    return existing;
  }

  const approval: PartnerApprovalRecord = {
    id: nextId("PARTNER-APR", partnerApprovalRecords.length),
    partnerId: partner.id,
    stage,
    title: approvalTitle(stage),
    detail: approvalDetail(stage, partner),
    state: "pending",
    requiredRole: approvalRole(stage),
    requestedAt: new Date().toISOString(),
    requestedById,
  };
  partnerApprovalRecords.push(approval);
  return approval;
}

function normalizeModules(modules?: string[]) {
  if (!Array.isArray(modules)) return [];
  return Array.from(new Set(modules.map((item) => item.trim()).filter(Boolean)));
}

function enrich(partner: PartnerOnboardingRecord) {
  return refreshDerivedState(partner);
}

seededPartnerOnboardingRecords.forEach((partner) => enrich(partner));
partnerOnboardingRecords.forEach((partner) => enrich(partner));

export function listPartnerOnboardingRecords() {
  return partnerOnboardingRecords
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map((partner) => enrich(partner));
}

export function getPartnerOnboardingRecord(partnerId: string) {
  const partner = partnerOnboardingRecords.find((item) => item.id === partnerId);
  return partner ? enrich(partner) : null;
}

export function listPartnerApprovalRecords(partnerId?: string) {
  return partnerApprovalRecords
    .filter((item) => !partnerId || item.partnerId === partnerId)
    .sort((left, right) => stageOrder(left.stage) - stageOrder(right.stage));
}

export function createPartnerOnboardingDraft(input: Partial<PartnerOnboardingRecord> & { actorId?: string } = {}) {
  const now = new Date().toISOString();
  const partnerName = input.partnerName?.trim() || "New White-Label Partner";
  const record: PartnerOnboardingRecord = {
    id: nextId("PARTNER", partnerOnboardingRecords.length),
    tenantId: input.tenantId?.trim() || `tenant-${partnerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || partnerOnboardingRecords.length + 1}`,
    partnerName,
    legalEntity: input.legalEntity?.trim() || partnerName,
    partnerType: input.partnerType || "fintech",
    region: input.region?.trim() || "Nigeria",
    stage: "draft",
    requestedModules: normalizeModules(input.requestedModules),
    primaryContact: mergeContact(input.primaryContact),
    operationsContact: mergeContact(input.operationsContact),
    commercial: mergeCommercial(input.commercial),
    compliance: mergeCompliance(input.compliance),
    branding: mergeBranding(input.branding, undefined, partnerName),
    checklist: normalizeChecklist(input.checklist),
    blockers: [],
    readinessScore: 0,
    createdAt: now,
    updatedAt: now,
    submittedAt: undefined,
    launchedAt: undefined,
    lastSubmittedBy: input.actorId,
  };
  partnerOnboardingRecords.unshift(enrich(record));
  return record;
}

export function updatePartnerOnboardingDraft(partnerId: string, patch: Partial<PartnerOnboardingRecord>) {
  const partner = partnerOnboardingRecords.find((item) => item.id === partnerId);
  if (!partner) return null;

  partner.partnerName = patch.partnerName?.trim() ?? partner.partnerName;
  partner.legalEntity = patch.legalEntity?.trim() ?? partner.legalEntity;
  partner.partnerType = patch.partnerType ?? partner.partnerType;
  partner.region = patch.region?.trim() ?? partner.region;
  partner.tenantId = patch.tenantId?.trim() ?? partner.tenantId;
  partner.requestedModules = patch.requestedModules ? normalizeModules(patch.requestedModules) : partner.requestedModules;
  partner.primaryContact = patch.primaryContact ? mergeContact(patch.primaryContact, partner.primaryContact) : partner.primaryContact;
  partner.operationsContact = patch.operationsContact ? mergeContact(patch.operationsContact, partner.operationsContact) : partner.operationsContact;
  partner.commercial = patch.commercial ? mergeCommercial(patch.commercial, partner.commercial) : partner.commercial;
  partner.compliance = patch.compliance ? mergeCompliance(patch.compliance, partner.compliance) : partner.compliance;
  partner.branding = patch.branding ? mergeBranding(patch.branding, partner.branding, patch.partnerName ?? partner.partnerName) : partner.branding;
  partner.checklist = patch.checklist ? normalizeChecklist(patch.checklist) : partner.checklist;
  if (patch.launchedAt !== undefined) partner.launchedAt = patch.launchedAt;
  if (patch.stage === "launched") {
    partner.stage = "launched";
    partner.launchedAt = patch.launchedAt ?? new Date().toISOString();
  }
  return enrich(partner);
}

export function submitPartnerOnboarding(partnerId: string, actorId: string) {
  const partner = partnerOnboardingRecords.find((item) => item.id === partnerId);
  if (!partner) return null;
  partner.submittedAt = new Date().toISOString();
  partner.lastSubmittedBy = actorId;
  for (const stage of requiredStages()) {
    ensureApproval(partner, stage, actorId);
  }
  partner.compliance.kybStatus = partner.compliance.submittedDocumentCount >= partner.compliance.requiredDocumentCount ? "in_review" : partner.compliance.kybStatus;
  partner.stage = "submitted";
  return enrich(partner);
}

export function resolvePartnerApproval(partnerId: string, approvalId: string, decision: Extract<ApprovalState, "approved" | "rejected">, resolutionNote: string | undefined, role: OperatorRole) {
  const approval = partnerApprovalRecords.find((item) => item.partnerId === partnerId && item.id === approvalId);
  if (!approval) return { error: "not_found" as const };
  if (approval.requiredRole !== role) {
    return { error: "forbidden" as const, approval };
  }
  approval.state = decision;
  approval.resolvedAt = new Date().toISOString();
  approval.resolutionNote = resolutionNote;

  const partner = partnerOnboardingRecords.find((item) => item.id === partnerId);
  if (!partner) return { error: "not_found" as const };
  if (approval.stage === "compliance_review") {
    partner.compliance.kybStatus = decision === "approved" ? "approved" : "rejected";
    partner.compliance.lastReviewedAt = approval.resolvedAt;
  }

  return { error: null, partner: enrich(partner), approval };
}

export function serializePartnerOnboardingState(): PartnerOnboardingState {
  return {
    partnerOnboardingRecords: clone(partnerOnboardingRecords.map((item) => enrich(item))),
    partnerApprovalRecords: clone(partnerApprovalRecords),
  };
}

export function hydratePartnerOnboardingState(state?: PartnerOnboardingState | null) {
  if (!state) return;
  if (Array.isArray(state.partnerOnboardingRecords)) {
    partnerOnboardingRecords.splice(0, partnerOnboardingRecords.length, ...state.partnerOnboardingRecords.map((item) => enrich(item)));
  }
  if (Array.isArray(state.partnerApprovalRecords)) {
    partnerApprovalRecords.splice(0, partnerApprovalRecords.length, ...state.partnerApprovalRecords);
  }
}
