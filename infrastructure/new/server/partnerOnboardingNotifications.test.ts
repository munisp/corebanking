import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

import { notifyOwner } from "./_core/notification";
import {
  notifyPartnerApprovalDecision,
  notifyPartnerLaunchReady,
  notifyPartnerOnboardingSubmission,
} from "./partnerOnboardingNotifications";
import type { PartnerApprovalRecord, PartnerOnboardingRecord } from "./partnerOnboardingRuntime";

const basePartner: PartnerOnboardingRecord = {
  id: "PARTNER-900",
  tenantId: "tenant-runtime-partner",
  partnerName: "Runtime Partner Bank",
  legalEntity: "Runtime Partner Bank Ltd",
  partnerType: "fintech",
  region: "Ibadan",
  stage: "submitted",
  requestedModules: ["digital_onboarding", "cards", "notifications"],
  primaryContact: {
    name: "Ada Runtime",
    role: "Programme manager",
    email: "ada@runtime.54bank.app",
    phone: "+234800019900",
  },
  operationsContact: {
    name: "Bola Runtime",
    role: "Operations lead",
    email: "ops@runtime.54bank.app",
    phone: "+234800019901",
  },
  commercial: {
    plan: "starter",
    billingModel: "Platform fee",
    revenueSharePct: 10,
    settlementBank: "54Bank Settlement",
    settlementAccountName: "Runtime Settlement",
    settlementAccountNumber: "2223334445",
    settlementFrequency: "weekly",
  },
  compliance: {
    kybStatus: "in_review",
    requiredDocumentCount: 6,
    submittedDocumentCount: 6,
    riskRating: "medium",
    notes: "Ready for review",
  },
  branding: {
    displayName: "Runtime Partner Bank",
    supportEmail: "partners@runtime.54bank.app",
    primaryColor: "#0f766e",
    accentColor: "#f59e0b",
    logoUrl: "https://assets.54bank.app/logos/54bank-partner-program.png",
    loginHeadline: "Runtime onboarding workspace ready.",
    customDomain: "runtime.54bank.app",
  },
  checklist: [
    { key: "company_profile", label: "Company profile completed", owner: "partner", completed: true },
  ],
  blockers: [],
  readinessScore: 84,
  createdAt: "2026-04-21T10:00:00.000Z",
  updatedAt: "2026-04-21T10:05:00.000Z",
  submittedAt: "2026-04-21T10:05:00.000Z",
  lastSubmittedBy: "partner.portal",
};

const pendingApproval: PartnerApprovalRecord = {
  id: "PARTNER-APR-900",
  partnerId: basePartner.id,
  stage: "compliance_review",
  title: "Compliance readiness review",
  detail: "Validate KYB readiness",
  state: "pending",
  requiredRole: "compliance",
  requestedAt: "2026-04-21T10:05:00.000Z",
  requestedById: "partner.portal",
};

describe("partner onboarding notifications", () => {
  beforeEach(() => {
    vi.mocked(notifyOwner).mockReset();
    vi.mocked(notifyOwner).mockResolvedValue(true);
  });

  it("builds a submission notification with partner and approval details", async () => {
    await notifyPartnerOnboardingSubmission(basePartner, [pendingApproval]);

    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Partner onboarding submitted: Runtime Partner Bank"),
        content: expect.stringContaining("Pending approvals: Compliance readiness review"),
      }),
    );
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Requested modules: digital_onboarding, cards, notifications"),
      }),
    );
  });

  it("builds an approval decision notification with the resolution note", async () => {
    await notifyPartnerApprovalDecision(
      { ...basePartner, stage: "commercial_review", readinessScore: 92 },
      {
        ...pendingApproval,
        state: "approved",
        resolutionNote: "Compliance packet validated",
      },
    );

    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Partner approval approved: Runtime Partner Bank"),
        content: expect.stringContaining("Resolution note: Compliance packet validated"),
      }),
    );
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Current onboarding stage: commercial_review"),
      }),
    );
  });

  it("builds a launch-ready notification with rollout context", async () => {
    await notifyPartnerLaunchReady({ ...basePartner, stage: "launch_ready", readinessScore: 100 });

    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Partner launch-ready: Runtime Partner Bank"),
        content: expect.stringContaining("Custom domain: runtime.54bank.app"),
      }),
    );
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Readiness score: 100%"),
      }),
    );
  });
});
