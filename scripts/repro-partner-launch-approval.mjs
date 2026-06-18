const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function post(path, role, body = {}, actorId) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-operator-role": role,
      ...(actorId ? { "x-actor-id": actorId } : {}),
    },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, ok: response.ok, json };
}

const create = await post(
  "/api/platform/partner-onboarding",
  "operations",
  {
    partnerName: "Runtime Partner Bank",
    legalEntity: "Runtime Partner Bank Ltd",
    region: "Ibadan",
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
      billingModel: "Platform fee",
      settlementBank: "54Bank Settlement",
      settlementAccountNumber: "2223334445",
      settlementAccountName: "Runtime Settlement",
    },
    compliance: {
      requiredDocumentCount: 6,
      submittedDocumentCount: 6,
    },
    checklist: [
      { key: "company_profile", label: "Company profile completed", owner: "partner", completed: true },
      { key: "commercial_terms", label: "Commercial package confirmed", owner: "partner", completed: true },
      { key: "kyb_documents", label: "KYB and compliance documents uploaded", owner: "partner", completed: true },
      { key: "branding_pack", label: "Branding pack finalized", owner: "partner", completed: true },
      { key: "ops_runbook", label: "Operations runbook reviewed", owner: "operations", completed: true },
      { key: "launch_readiness", label: "Launch readiness review completed", owner: "operations", completed: true },
    ],
  },
  "partner.portal",
);

console.log("create", JSON.stringify(create, null, 2));

const partnerId = create.json?.partner?.id;
if (!partnerId) process.exit(1);

const submit = await post(`/api/platform/partner-onboarding/${partnerId}/submit`, "operations", {}, "partner.portal");
console.log("submit", JSON.stringify(submit, null, 2));

const complianceApprovalId = submit.json?.approvals?.find((item) => item.stage === "compliance_review")?.id;
const commercialApprovalId = submit.json?.approvals?.find((item) => item.stage === "commercial_review")?.id;
const operationsApprovalId = submit.json?.approvals?.find((item) => item.stage === "operations_review")?.id;

const approveCompliance = await post(`/api/platform/partner-onboarding/${partnerId}/approvals/${complianceApprovalId}/approve`, "compliance", { resolutionNote: "Compliance packet validated" });
console.log("approveCompliance", JSON.stringify(approveCompliance, null, 2));

const approveCommercial = await post(`/api/platform/partner-onboarding/${partnerId}/approvals/${commercialApprovalId}/approve`, "treasury", { resolutionNote: "Commercial structure approved" });
console.log("approveCommercial", JSON.stringify(approveCommercial, null, 2));

const approveOperations = await post(`/api/platform/partner-onboarding/${partnerId}/approvals/${operationsApprovalId}/approve`, "operations", { resolutionNote: "Operations readiness approved" });
console.log("approveOperations", JSON.stringify(approveOperations, null, 2));

const launchApprovalId = approveOperations.json?.approvals?.find((item) => item.stage === "launch_signoff")?.id;
const approveLaunch = await post(`/api/platform/partner-onboarding/${partnerId}/approvals/${launchApprovalId}/approve`, "operations", { resolutionNote: "Launch sign-off granted" });
console.log("approveLaunch", JSON.stringify(approveLaunch, null, 2));
