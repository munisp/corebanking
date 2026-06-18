import { notifyOwner } from "./_core/notification";
import type { PartnerApprovalRecord, PartnerOnboardingRecord } from "./partnerOnboardingRuntime";

function summarizeModules(modules: string[]) {
  return modules.length ? modules.join(", ") : "No modules selected";
}

function pendingApprovalTitles(approvals: PartnerApprovalRecord[]) {
  return approvals.filter((item) => item.state === "pending").map((item) => item.title);
}

export async function notifyPartnerOnboardingSubmission(
  partner: PartnerOnboardingRecord,
  approvals: PartnerApprovalRecord[],
) {
  const pendingTitles = pendingApprovalTitles(approvals);
  return notifyOwner({
    title: `Partner onboarding submitted: ${partner.partnerName}`,
    content: [
      `${partner.partnerName} (${partner.legalEntity}) submitted a white-label onboarding application.`,
      `Tenant ID: ${partner.tenantId}`,
      `Region: ${partner.region}`,
      `Requested modules: ${summarizeModules(partner.requestedModules)}`,
      `Readiness score: ${partner.readinessScore}%`,
      `Pending approvals: ${pendingTitles.length ? pendingTitles.join(", ") : "None"}`,
      `Review route: /admin/onboarding`,
    ].join("\n"),
  });
}

export async function notifyPartnerApprovalDecision(
  partner: PartnerOnboardingRecord,
  approval: PartnerApprovalRecord,
) {
  const decisionLabel = approval.state === "approved" ? "approved" : "rejected";
  return notifyOwner({
    title: `Partner approval ${decisionLabel}: ${partner.partnerName}`,
    content: [
      `${approval.title} was ${decisionLabel} for ${partner.partnerName}.`,
      `Current onboarding stage: ${partner.stage}`,
      `Required role: ${approval.requiredRole}`,
      `Requested by: ${approval.requestedById}`,
      `Resolution note: ${approval.resolutionNote || "No note provided"}`,
      `Readiness score: ${partner.readinessScore}%`,
      `Review route: /admin/onboarding`,
    ].join("\n"),
  });
}

export async function notifyPartnerLaunchReady(partner: PartnerOnboardingRecord) {
  return notifyOwner({
    title: `Partner launch-ready: ${partner.partnerName}`,
    content: [
      `${partner.partnerName} is now launch-ready for white-label rollout.`,
      `Tenant ID: ${partner.tenantId}`,
      `Display name: ${partner.branding.displayName}`,
      `Custom domain: ${partner.branding.customDomain || "Pending assignment"}`,
      `Requested modules: ${summarizeModules(partner.requestedModules)}`,
      `Readiness score: ${partner.readinessScore}%`,
      `Launch route: /admin/onboarding`,
    ].join("\n"),
  });
}
