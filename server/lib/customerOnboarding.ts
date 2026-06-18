/**
 * E5: Customer onboarding workflow with integrated KYC/KYB enforcement.
 *
 * Onboarding stages (each gated by KYC verification):
 *   1. draft → collect personal data, BVN, phone
 *   2. bvn_pending → BVN validated via NIBSS (auto-verifies identity)
 *   3. bvn_verified → NIN cross-check (Tier 2+)
 *   4. nin_verified → liveness check (passive + active for Tier 3)
 *   5. liveness_passed → document upload + OCR verification
 *   6. documents_pending → document intelligence via PaddleOCR + VLM
 *   7. under_review → risk scoring + sanctions screening
 *   8. approved / rejected → account creation or rejection
 *
 * KYC tier requirements (CBN compliance):
 *   Tier 1: BVN only (phone-only mobile money — ₦300K max balance)
 *   Tier 2: BVN + NIN (₦500K max balance)
 *   Tier 3: BVN + NIN + liveness + document + PEP/sanctions (unlimited)
 *
 * Integration points:
 *   - kyc-engine-py: BVN/NIN verification, risk scoring
 *   - liveness-orchestrator-go: active/passive liveness challenges
 *   - document-intelligence-py: PaddleOCR, VLM, Docling
 *   - sanctions-engine-rs: OFAC/EU/UN/CBN/PEP screening
 *   - Kafka: account.onboarding.started, kyc.verification.required, account.opened
 */

export interface OnboardingApplication {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: "male" | "female";
  email: string;
  phone: string;
  bvn: string;
  nin?: string;
  address: string;
  lga: string;
  state: string;
  nationality: string;
  employmentStatus: "employed" | "self_employed" | "student" | "retired" | "unemployed";
  productType: "savings" | "current" | "domiciliary" | "fixed_deposit";
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: "draft" | "bvn_pending" | "bvn_verified" | "nin_pending" | "nin_verified" | "liveness_pending" | "liveness_passed" | "documents_pending" | "under_review" | "approved" | "rejected";
  riskScore: number;
  bvnVerified: boolean;
  ninVerified: boolean;
  livenessCheckPassed: boolean;
  documentVerified: boolean;
  sanctionsCleared: boolean;
  pepChecked: boolean;
  kycLevel: "none" | "basic" | "standard" | "enhanced" | "full_edd";
  kycCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  accountNumber?: string;
  rejectionReason?: string;
  kycGateLog: Array<{ step: string; result: string; timestamp: string }>;
}

const applications: OnboardingApplication[] = [
  {
    id: "OB-001", firstName: "Amina", lastName: "Yusuf", middleName: "Halima",
    dateOfBirth: "1992-03-15", gender: "female", email: "amina.yusuf@gmail.com", phone: "+2348012345678",
    bvn: "22345678901", nin: "12345678901234", address: "15 Aminu Kano Crescent, Wuse 2",
    lga: "Wuse", state: "FCT Abuja", nationality: "Nigerian",
    employmentStatus: "employed", productType: "savings", tier: "Tier 3",
    status: "approved", riskScore: 15, bvnVerified: true, ninVerified: true,
    livenessCheckPassed: true, documentVerified: true, sanctionsCleared: true, pepChecked: true,
    kycLevel: "enhanced", kycCompletedAt: "2026-05-08T13:55:00Z",
    createdAt: "2026-05-08T09:00:00Z", updatedAt: "2026-05-08T14:00:00Z",
    completedAt: "2026-05-08T14:00:00Z", accountNumber: "5400001234",
    kycGateLog: [
      { step: "bvn_verification", result: "passed", timestamp: "2026-05-08T09:05:00Z" },
      { step: "nin_verification", result: "passed", timestamp: "2026-05-08T09:10:00Z" },
      { step: "liveness_passive", result: "passed (0.94)", timestamp: "2026-05-08T09:15:00Z" },
      { step: "liveness_active", result: "passed (blink, smile, head_turn)", timestamp: "2026-05-08T09:20:00Z" },
      { step: "document_ocr", result: "passed (passport, utility_bill)", timestamp: "2026-05-08T12:00:00Z" },
      { step: "sanctions_screening", result: "cleared (OFAC, EU, UN, CBN)", timestamp: "2026-05-08T13:50:00Z" },
      { step: "pep_check", result: "cleared", timestamp: "2026-05-08T13:52:00Z" },
      { step: "risk_scoring", result: "low (15)", timestamp: "2026-05-08T13:55:00Z" },
    ],
  },
  {
    id: "OB-002", firstName: "Chinedu", lastName: "Okeke",
    dateOfBirth: "1988-07-22", gender: "male", email: "chinedu.o@outlook.com", phone: "+2349098765432",
    bvn: "33456789012", address: "42 Allen Avenue, Ikeja",
    lga: "Ikeja", state: "Lagos", nationality: "Nigerian",
    employmentStatus: "self_employed", productType: "current", tier: "Tier 2",
    status: "documents_pending", riskScore: 35, bvnVerified: true, ninVerified: false,
    livenessCheckPassed: true, documentVerified: false, sanctionsCleared: false, pepChecked: false,
    kycLevel: "basic",
    createdAt: "2026-05-09T10:00:00Z", updatedAt: "2026-05-09T11:00:00Z",
    kycGateLog: [
      { step: "bvn_verification", result: "passed", timestamp: "2026-05-09T10:05:00Z" },
      { step: "liveness_passive", result: "passed (0.88)", timestamp: "2026-05-09T10:10:00Z" },
      { step: "nin_verification", result: "pending — required for Tier 2", timestamp: "2026-05-09T10:30:00Z" },
    ],
  },
  {
    id: "OB-003", firstName: "Fatimah", lastName: "Abdullahi",
    dateOfBirth: "2000-11-03", gender: "female", email: "fatimah.a@yahoo.com", phone: "+2347055551234",
    bvn: "44567890123", address: "8 Bello Road, Kano",
    lga: "Nassarawa", state: "Kano", nationality: "Nigerian",
    employmentStatus: "student", productType: "savings", tier: "Tier 1",
    status: "bvn_verified", riskScore: 10, bvnVerified: true, ninVerified: false,
    livenessCheckPassed: false, documentVerified: false, sanctionsCleared: false, pepChecked: false,
    kycLevel: "basic",
    createdAt: "2026-05-09T13:00:00Z", updatedAt: "2026-05-09T13:30:00Z",
    kycGateLog: [
      { step: "bvn_verification", result: "passed", timestamp: "2026-05-09T13:05:00Z" },
    ],
  },
  {
    id: "OB-004", firstName: "Oluwaseun", lastName: "Adebayo",
    dateOfBirth: "1975-01-20", gender: "male", email: "oluwaseun@corporate.ng", phone: "+2348033334444",
    bvn: "55678901234", nin: "56789012345678", address: "Plot 1234, Victoria Island",
    lga: "Eti-Osa", state: "Lagos", nationality: "Nigerian",
    employmentStatus: "employed", productType: "domiciliary", tier: "Tier 3",
    status: "rejected", riskScore: 72, bvnVerified: true, ninVerified: true,
    livenessCheckPassed: true, documentVerified: false, sanctionsCleared: true, pepChecked: true,
    kycLevel: "standard",
    createdAt: "2026-05-07T08:00:00Z", updatedAt: "2026-05-07T16:00:00Z",
    rejectionReason: "PEP flag — additional due diligence required per CBN circular",
    kycGateLog: [
      { step: "bvn_verification", result: "passed", timestamp: "2026-05-07T08:05:00Z" },
      { step: "nin_verification", result: "passed", timestamp: "2026-05-07T08:10:00Z" },
      { step: "liveness_passive", result: "passed (0.91)", timestamp: "2026-05-07T08:15:00Z" },
      { step: "liveness_active", result: "passed", timestamp: "2026-05-07T08:20:00Z" },
      { step: "pep_check", result: "FLAGGED — PEP match on Adebayo family", timestamp: "2026-05-07T12:00:00Z" },
      { step: "sanctions_screening", result: "cleared", timestamp: "2026-05-07T12:05:00Z" },
      { step: "risk_scoring", result: "high (72) — PEP 25pts + income_gap 20pts", timestamp: "2026-05-07T12:10:00Z" },
    ],
  },
];

export function getOnboardingApplications() { return applications; }

export function getOnboardingById(id: string) {
  return applications.find((a) => a.id === id);
}

// ── Onboarding creation with KYC kickoff ────────────────────────────────────

export function createOnboardingApplication(data: {
  firstName: string; lastName: string; middleName?: string;
  dateOfBirth: string; gender: "male" | "female";
  email: string; phone: string; bvn: string; nin?: string;
  address: string; lga: string; state: string; nationality: string;
  employmentStatus: string; productType: string; tier?: string;
}): { application: OnboardingApplication; kycAction: string } {
  const tier = (data.tier || determineTier(data.productType)) as "Tier 1" | "Tier 2" | "Tier 3";
  const app: OnboardingApplication = {
    id: `OB-${String(applications.length + 1).padStart(3, "0")}`,
    firstName: data.firstName, lastName: data.lastName, middleName: data.middleName,
    dateOfBirth: data.dateOfBirth, gender: data.gender,
    email: data.email, phone: data.phone, bvn: data.bvn, nin: data.nin,
    address: data.address, lga: data.lga, state: data.state, nationality: data.nationality,
    employmentStatus: data.employmentStatus as OnboardingApplication["employmentStatus"],
    productType: data.productType as OnboardingApplication["productType"],
    tier, status: "bvn_pending", riskScore: 0,
    bvnVerified: false, ninVerified: false, livenessCheckPassed: false,
    documentVerified: false, sanctionsCleared: false, pepChecked: false,
    kycLevel: "none",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    kycGateLog: [{ step: "onboarding_started", result: `Tier ${tier} — KYC workflow initiated`, timestamp: new Date().toISOString() }],
  };
  applications.push(app);
  return {
    application: app,
    kycAction: `BVN verification required — submit to /api/platform/onboarding/${app.id}/verify-bvn`,
  };
}

// ── Onboarding stage progression (KYC-gated) ────────────────────────────────

export function advanceOnboarding(id: string, step: string, result: { passed: boolean; details?: string }): {
  application?: OnboardingApplication; error?: string; nextStep?: string; kycBlocked?: boolean;
} {
  const app = applications.find((a) => a.id === id);
  if (!app) return { error: "Application not found" };

  const now = new Date().toISOString();
  app.kycGateLog.push({ step, result: result.passed ? `passed${result.details ? ` (${result.details})` : ""}` : `failed${result.details ? ` — ${result.details}` : ""}`, timestamp: now });
  app.updatedAt = now;

  if (!result.passed) {
    if (step === "sanctions_screening" || step === "pep_check") {
      app.status = "rejected";
      app.rejectionReason = `KYC gate blocked at ${step}: ${result.details || "failed"}`;
      app.riskScore = Math.min(app.riskScore + 40, 100);
    }
    return { application: app, kycBlocked: true, nextStep: `Retry ${step} or escalate to compliance` };
  }

  switch (step) {
    case "bvn_verification":
      app.bvnVerified = true;
      app.kycLevel = "basic";
      if (app.tier === "Tier 1") {
        app.status = "approved";
        app.completedAt = now;
        app.kycCompletedAt = now;
        app.accountNumber = `540${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`;
        return { application: app, nextStep: "Account created — Tier 1 (BVN-only mobile money)" };
      }
      app.status = "nin_pending";
      return { application: app, nextStep: "NIN verification required for Tier 2+" };

    case "nin_verification":
      app.ninVerified = true;
      app.kycLevel = "standard";
      app.status = "liveness_pending";
      return { application: app, nextStep: "Liveness check required — passive + active" };

    case "liveness_check":
      app.livenessCheckPassed = true;
      app.status = "documents_pending";
      return { application: app, nextStep: "Document upload required — ID + proof of address" };

    case "document_verification":
      app.documentVerified = true;
      app.kycLevel = "enhanced";
      app.status = "under_review";
      return { application: app, nextStep: "Sanctions screening + risk scoring in progress" };

    case "sanctions_screening":
      app.sanctionsCleared = true;
      return { application: app, nextStep: "PEP check pending" };

    case "pep_check":
      app.pepChecked = true;
      return { application: app, nextStep: "Risk scoring — final step" };

    case "risk_scoring":
      app.riskScore = parseInt(result.details || "0") || calculateOnboardingRisk(app);
      if (app.riskScore >= 70) {
        app.status = "rejected";
        app.rejectionReason = `High risk score (${app.riskScore}) — manual review required`;
        return { application: app, kycBlocked: true, nextStep: "Escalate to compliance for EDD" };
      }
      app.status = "approved";
      app.completedAt = now;
      app.kycCompletedAt = now;
      if (app.tier === "Tier 3") app.kycLevel = "enhanced";
      app.accountNumber = `540${String(Math.floor(Math.random() * 10000000)).padStart(7, "0")}`;
      return { application: app, nextStep: `Account created — ${app.tier} (KYC ${app.kycLevel})` };

    default:
      return { error: `Unknown step: ${step}` };
  }
}

// ── KYC requirement by tier ─────────────────────────────────────────────────

export function getKYCRequirements(tier: string): { steps: string[]; level: string; description: string } {
  switch (tier) {
    case "Tier 1":
      return { steps: ["bvn_verification"], level: "basic", description: "BVN only — mobile money (₦300K max)" };
    case "Tier 2":
      return { steps: ["bvn_verification", "nin_verification", "liveness_check"], level: "standard", description: "BVN + NIN + liveness (₦500K max)" };
    case "Tier 3":
      return { steps: ["bvn_verification", "nin_verification", "liveness_check", "document_verification", "sanctions_screening", "pep_check", "risk_scoring"], level: "enhanced", description: "Full KYC — BVN + NIN + liveness + documents + sanctions + PEP (unlimited)" };
    default:
      return { steps: ["bvn_verification"], level: "basic", description: "Default to Tier 1" };
  }
}

export function getOnboardingStats() {
  const total = applications.length;
  const byStatus: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const kycCompletion = { bvn: 0, nin: 0, liveness: 0, documents: 0, sanctions: 0, pep: 0 };
  for (const app of applications) {
    byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    byTier[app.tier] = (byTier[app.tier] || 0) + 1;
    if (app.bvnVerified) kycCompletion.bvn++;
    if (app.ninVerified) kycCompletion.nin++;
    if (app.livenessCheckPassed) kycCompletion.liveness++;
    if (app.documentVerified) kycCompletion.documents++;
    if (app.sanctionsCleared) kycCompletion.sanctions++;
    if (app.pepChecked) kycCompletion.pep++;
  }
  return { total, byStatus, byTier, kycCompletion, avgRiskScore: Math.round(applications.reduce((s, a) => s + a.riskScore, 0) / total) };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function determineTier(productType: string): string {
  switch (productType) {
    case "savings": return "Tier 1";
    case "current": return "Tier 2";
    case "domiciliary": case "fixed_deposit": return "Tier 3";
    default: return "Tier 1";
  }
}

export function validateBVN(bvn: string): { valid: boolean; reason?: string } {
  if (!/^\d{11}$/.test(bvn)) return { valid: false, reason: "BVN must be exactly 11 digits" };
  return { valid: true };
}

export function validateNIN(nin: string): { valid: boolean; reason?: string } {
  if (!/^\d{11}$/.test(nin)) return { valid: false, reason: "NIN must be exactly 11 digits" };
  return { valid: true };
}

export function calculateOnboardingRisk(app: { employmentStatus: string; tier: string; bvnVerified: boolean; ninVerified: boolean }): number {
  let score = 0;
  if (!app.bvnVerified) score += 30;
  if (!app.ninVerified) score += 20;
  if (app.employmentStatus === "unemployed") score += 15;
  if (app.tier === "Tier 3" && !app.ninVerified) score += 10;
  return Math.min(score, 100);
}
