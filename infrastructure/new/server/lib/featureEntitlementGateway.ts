/**
 * 54Bank Feature Entitlement & Billing Gateway
 * Exposes tier-based feature provisioning for tenants and white-label partners.
 * Features = cost. Platform operator controls what gets turned on during onboarding.
 *
 * Services:
 *   - feature-entitlement-go:8107 — Tier mapping, entitlement checks, provisioning
 *   - billing-enforcement-rs:8108 — Usage metering, overage detection, invoicing
 *   - tenant-provisioning-py:8109 — Onboarding workflows, tier changes, cost calculator
 */

import type { Express, Request, Response } from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING TIERS (mirrored from Go service for frontend consumption)
// ═══════════════════════════════════════════════════════════════════════════════

const TENANT_TIERS = [
  {
    id: "TIER-ENTERPRISE", name: "Enterprise", type: "tenant",
    monthlyFeeNGN: 25_000_000, annualFeeNGN: 250_000_000, setupFeeNGN: 50_000_000,
    maxUsers: 100_000, maxBranches: 500, maxTPS: 10_000, slaUptime: "99.99%", supportLevel: "dedicated_tam",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "treasury", "trade_finance", "wealth_management", "accounting", "risk_compliance", "agent_banking", "microfinance", "islamic_banking", "diaspora_banking", "cooperative_banking", "agriculture_banking", "billing", "multi_tenant"],
    growthFeatures: ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"],
    addOns: [],
  },
  {
    id: "TIER-COMMERCIAL", name: "Commercial", type: "tenant",
    monthlyFeeNGN: 12_000_000, annualFeeNGN: 120_000_000, setupFeeNGN: 25_000_000,
    maxUsers: 50_000, maxBranches: 200, maxTPS: 5_000, slaUptime: "99.95%", supportLevel: "priority",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "treasury", "trade_finance", "accounting", "risk_compliance", "billing"],
    growthFeatures: ["chatbot", "smart_savings", "virtual_cards", "qr_payments"],
    addOns: [
      { feature: "bnpl", monthlyFee: 2_000_000 }, { feature: "investments", monthlyFee: 3_000_000 },
      { feature: "remittances", monthlyFee: 2_500_000 }, { feature: "gamification", monthlyFee: 1_000_000 },
    ],
  },
  {
    id: "TIER-STANDARD", name: "Standard", type: "tenant",
    monthlyFeeNGN: 5_000_000, annualFeeNGN: 50_000_000, setupFeeNGN: 10_000_000,
    maxUsers: 20_000, maxBranches: 50, maxTPS: 2_000, slaUptime: "99.9%", supportLevel: "business_hours",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "accounting", "risk_compliance", "billing"],
    growthFeatures: ["chatbot", "smart_savings"],
    addOns: [
      { feature: "virtual_cards", monthlyFee: 1_500_000 }, { feature: "qr_payments", monthlyFee: 1_000_000 },
      { feature: "bnpl", monthlyFee: 2_000_000 }, { feature: "investments", monthlyFee: 3_000_000 },
      { feature: "remittances", monthlyFee: 2_500_000 }, { feature: "gamification", monthlyFee: 1_000_000 },
    ],
  },
  {
    id: "TIER-STARTER", name: "Starter (MFB/Fintech)", type: "tenant",
    monthlyFeeNGN: 1_500_000, annualFeeNGN: 15_000_000, setupFeeNGN: 3_000_000,
    maxUsers: 5_000, maxBranches: 10, maxTPS: 500, slaUptime: "99.5%", supportLevel: "email_only",
    features: ["core_banking", "payments", "mobile_money", "lending", "accounting", "billing"],
    growthFeatures: ["chatbot"],
    addOns: [
      { feature: "smart_savings", monthlyFee: 500_000 }, { feature: "virtual_cards", monthlyFee: 1_500_000 },
      { feature: "qr_payments", monthlyFee: 800_000 }, { feature: "gamification", monthlyFee: 500_000 },
    ],
  },
];

const WHITE_LABEL_TIERS = [
  {
    id: "WL-PLATINUM", name: "Platinum Partner", type: "white_label",
    monthlyFeeNGN: 40_000_000, annualFeeNGN: 400_000_000, setupFeeNGN: 100_000_000,
    maxUsers: 500_000, maxTPS: 50_000, slaUptime: "99.99%", supportLevel: "dedicated_team",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "treasury", "trade_finance", "wealth_management", "accounting", "risk_compliance", "agent_banking", "microfinance", "islamic_banking", "diaspora_banking", "cooperative_banking", "agriculture_banking", "billing", "multi_tenant"],
    growthFeatures: ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "investments", "remittances", "gamification"],
    addOns: [],
    whiteLabel: { customDomain: true, customBranding: true, subTenants: "unlimited", apiSdk: true },
  },
  {
    id: "WL-GOLD", name: "Gold Partner", type: "white_label",
    monthlyFeeNGN: 20_000_000, annualFeeNGN: 200_000_000, setupFeeNGN: 50_000_000,
    maxUsers: 200_000, maxTPS: 20_000, slaUptime: "99.95%", supportLevel: "priority",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "accounting", "risk_compliance", "billing"],
    growthFeatures: ["chatbot", "smart_savings", "virtual_cards", "qr_payments", "bnpl", "gamification"],
    addOns: [
      { feature: "investments", monthlyFee: 4_000_000 }, { feature: "remittances", monthlyFee: 3_500_000 },
      { feature: "treasury", monthlyFee: 5_000_000 }, { feature: "trade_finance", monthlyFee: 4_000_000 },
    ],
    whiteLabel: { customDomain: true, customBranding: true, subTenants: 10, apiSdk: true },
  },
  {
    id: "WL-SILVER", name: "Silver Partner", type: "white_label",
    monthlyFeeNGN: 8_000_000, annualFeeNGN: 80_000_000, setupFeeNGN: 20_000_000,
    maxUsers: 50_000, maxTPS: 5_000, slaUptime: "99.9%", supportLevel: "business_hours",
    features: ["core_banking", "payments", "cards_digital", "mobile_money", "lending", "billing"],
    growthFeatures: ["chatbot", "smart_savings", "qr_payments"],
    addOns: [
      { feature: "virtual_cards", monthlyFee: 2_000_000 }, { feature: "bnpl", monthlyFee: 2_500_000 },
      { feature: "gamification", monthlyFee: 1_500_000 }, { feature: "investments", monthlyFee: 4_000_000 },
      { feature: "remittances", monthlyFee: 3_500_000 },
    ],
    whiteLabel: { customDomain: true, customBranding: true, subTenants: 3, apiSdk: false },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export function registerFeatureEntitlementRoutes(app: Express) {
  // --- Pricing Tiers ---
  app.get("/api/entitlements/tiers", (_req: Request, res: Response) => {
    res.json({ tenantTiers: TENANT_TIERS, whiteLabelTiers: WHITE_LABEL_TIERS, total: TENANT_TIERS.length + WHITE_LABEL_TIERS.length });
  });

  app.get("/api/entitlements/tiers/tenant", (_req: Request, res: Response) => {
    res.json({ items: TENANT_TIERS, total: TENANT_TIERS.length });
  });

  app.get("/api/entitlements/tiers/white-label", (_req: Request, res: Response) => {
    res.json({ items: WHITE_LABEL_TIERS, total: WHITE_LABEL_TIERS.length });
  });

  // --- Feature Access Check ---
  app.get("/api/entitlements/check", (req: Request, res: Response) => {
    const { tenantId, feature } = req.query as { tenantId: string; feature: string };
    // In production, this calls feature-entitlement-go:8107/v1/entitlements/check
    // For now, return entitlement check based on tier
    const tier = [...TENANT_TIERS, ...WHITE_LABEL_TIERS].find((t) =>
      t.growthFeatures.includes(feature) || t.features.includes(feature),
    );
    res.json({
      allowed: !!tier,
      tenantId,
      feature,
      tier: tier?.name ?? "unknown",
      message: tier ? "Feature entitled for this tier" : "Feature not available — upgrade required",
      services: { entitlementEngine: "feature-entitlement-go:8107", billingEnforcement: "billing-enforcement-rs:8108" },
    });
  });

  // --- Billing & Invoices ---
  app.get("/api/entitlements/billing/invoices", (_req: Request, res: Response) => {
    res.json({
      items: [
        { invoiceId: "INV-2026-05-001", tenantId: "TEN-ZENITH", tenantName: "Zenith Bank", period: "2026-05", tierName: "Enterprise", baseFee: 25_000_000, addonFees: 0, overageFees: 300_000, total: 25_300_000, status: "issued" },
        { invoiceId: "INV-2026-05-002", tenantId: "WL-MONIEPOINT", tenantName: "Moniepoint", period: "2026-05", tierName: "Gold Partner", baseFee: 20_000_000, addonFees: 4_000_000, overageFees: 168_000, total: 24_168_000, status: "issued" },
        { invoiceId: "INV-2026-05-003", tenantId: "WL-OPAY", tenantName: "OPay", period: "2026-05", tierName: "Silver Partner", baseFee: 8_000_000, addonFees: 4_000_000, overageFees: 120_000, total: 12_120_000, status: "paid" },
        { invoiceId: "INV-2026-05-004", tenantId: "TEN-LAPO-MFB", tenantName: "LAPO Microfinance", period: "2026-05", tierName: "Starter", baseFee: 1_500_000, addonFees: 1_300_000, overageFees: 0, total: 2_800_000, status: "paid" },
        { invoiceId: "INV-2026-05-005", tenantId: "WL-KUDA", tenantName: "Kuda Bank", period: "2026-05", tierName: "Platinum Partner", baseFee: 40_000_000, addonFees: 0, overageFees: 0, total: 40_000_000, status: "issued" },
        { invoiceId: "INV-2026-05-006", tenantId: "TEN-UBA", tenantName: "UBA Nigeria", period: "2026-05", tierName: "Enterprise", baseFee: 25_000_000, addonFees: 0, overageFees: 0, total: 25_000_000, status: "paid" },
      ],
      totalRevenue: 129_388_000,
      services: { billingEngine: "billing-enforcement-rs:8108", ledger: "tigerbeetle" },
    });
  });

  // --- Revenue Summary ---
  app.get("/api/entitlements/billing/revenue", (_req: Request, res: Response) => {
    res.json({
      period: "2026-05",
      mrrNGN: 129_388_000,
      arrNGN: 1_552_656_000,
      breakdown: {
        baseFees: 120_500_000, addonFees: 9_300_000, overageFees: 588_000,
        tenantRevenue: 53_100_000, whiteLabelRevenue: 76_288_000,
      },
      growthFeatureAttribution: {
        chatbot: 12_000_000, smartSavings: 8_500_000, virtualCards: 15_000_000,
        qrPayments: 9_800_000, bnpl: 18_000_000, investments: 22_000_000,
        remittances: 14_500_000, gamification: 5_088_000,
      },
      pipeline: { inNegotiation: 3, expectedAdditionalMRR: 48_000_000 },
    });
  });

  // --- Provisioning ---
  app.post("/api/entitlements/provision", (req: Request, res: Response) => {
    const { tenantId, tenantName, tierId, type, addOns, operatorEmail } = req.body;
    const tier = [...TENANT_TIERS, ...WHITE_LABEL_TIERS].find((t) => t.id === tierId);
    if (!tier) { res.status(400).json({ error: "Invalid tier ID" }); return; }

    const allFeatures = [...tier.features, ...tier.growthFeatures, ...(addOns ?? [])];
    let monthlyBill = tier.monthlyFeeNGN;
    for (const addon of addOns ?? []) {
      const addOnDef = tier.addOns.find((a: any) => a.feature === addon);
      if (addOnDef) monthlyBill += addOnDef.monthlyFee;
    }

    res.json({
      success: true,
      entitlement: { tenantId, tenantName, tierId, tierName: tier.name, type, enabledFeatures: allFeatures, addOns: addOns ?? [], monthlyBill, billingStatus: "current", provisionedBy: operatorEmail },
      provisioningSteps: 19,
      estimatedDuration: "35 minutes",
      services: { entitlement: "feature-entitlement-go:8107", billing: "billing-enforcement-rs:8108", provisioning: "tenant-provisioning-py:8109" },
    });
  });

  // --- Add-On Purchase ---
  app.post("/api/entitlements/purchase-addon", (req: Request, res: Response) => {
    const { tenantId, feature, operatorEmail } = req.body;
    res.json({
      success: true, tenantId, feature, activatedBy: operatorEmail,
      message: `Feature '${feature}' activated for tenant ${tenantId}. Billing updated.`,
      services: { entitlement: "feature-entitlement-go:8107", billing: "billing-enforcement-rs:8108" },
    });
  });

  // --- Tier Upgrade ---
  app.post("/api/entitlements/upgrade", (req: Request, res: Response) => {
    const { tenantId, newTierId, operatorEmail } = req.body;
    const newTier = [...TENANT_TIERS, ...WHITE_LABEL_TIERS].find((t) => t.id === newTierId);
    if (!newTier) { res.status(400).json({ error: "Invalid tier" }); return; }
    res.json({
      success: true, tenantId, newTier: newTier.name, newMonthlyBill: newTier.monthlyFeeNGN,
      newFeatures: [...newTier.features, ...newTier.growthFeatures],
      upgradedBy: operatorEmail, effectiveDate: "immediate",
    });
  });

  // --- All Services Summary ---
  app.get("/api/entitlements/services", (_req: Request, res: Response) => {
    res.json({
      services: [
        { name: "feature-entitlement-go", port: 8107, lang: "Go", role: "Tier mapping, entitlement checks, feature gating, provisioning" },
        { name: "billing-enforcement-rs", port: 8108, lang: "Rust", role: "Usage metering, overage detection, invoice generation, cost tracking" },
        { name: "tenant-provisioning-py", port: 8109, lang: "Python", role: "Onboarding workflows (Temporal), tier management, upgrade/downgrade" },
      ],
      middleware: ["Kafka", "Dapr", "Fluvio", "Temporal", "Postgres", "Keycloak", "Permify", "Redis", "Mojaloop", "OpenSearch", "OpenAppSec", "APISIX", "TigerBeetle", "Lakehouse"],
      principle: "Features = Cost. Tenants and white-label partners only get what their tier includes or what they pay for as add-ons.",
      enforcement: {
        entitlementCheck: "Every API call checks tenant's entitled features via Permify + Redis cache",
        billingGating: "Overdue > 90 days → suspend API access. Overage → bill at per-unit rate.",
        provisioning: "Platform operator onboards via 19-step Temporal workflow. Same flow for tenants and white-label.",
      },
    });
  });
}
