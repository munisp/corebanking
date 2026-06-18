// B6: Islamic Banking Expansion — Sukuk, Takaful, Wakala, Sharia Compliance Engine
import type { Express, Request, Response } from "express";

interface SukukBond {
  id: string; sukukType: string; issuer: string; faceValue: number; currency: string;
  couponRate: number; maturityDate: string; assetBacking: string; status: string;
  shariaAdvisor: string; rating: string;
}

interface TakafulPolicy {
  id: string; policyType: string; participant: string; contribution: number; currency: string;
  coverageAmount: number; surplusShare: number; tabarruFund: number; status: string;
}

interface WakalaInvestment {
  id: string; investor: string; agent: string; principal: number; currency: string;
  wakalaFee: number; expectedReturn: number; actualReturn: number; status: string;
  maturityDate: string;
}

interface ShariaScreenResult {
  transactionId: string; compliant: boolean; violations: string[];
  screenedBy: string; timestamp: string;
}

const sukukBonds: SukukBond[] = [
  { id: "SKK-001", sukukType: "ijara", issuer: "FGN Sukuk Company", faceValue: 150000000000, currency: "NGN", couponRate: 11.2, maturityDate: "2031-06-15", assetBacking: "Federal road projects", status: "active", shariaAdvisor: "ISRA Advisory", rating: "AAA" },
  { id: "SKK-002", sukukType: "mudarabah", issuer: "Osun State", faceValue: 11400000000, currency: "NGN", couponRate: 14.75, maturityDate: "2027-09-01", assetBacking: "State revenue", status: "active", shariaAdvisor: "Lotus Capital", rating: "A+" },
  { id: "SKK-003", sukukType: "wakala", issuer: "Africa Finance Corp", faceValue: 500000000, currency: "USD", couponRate: 5.5, maturityDate: "2029-03-15", assetBacking: "Infrastructure portfolio", status: "active", shariaAdvisor: "IIRA", rating: "A" },
  { id: "SKK-004", sukukType: "musharakah", issuer: "FMDQ Listed Corp", faceValue: 20000000000, currency: "NGN", couponRate: 13.0, maturityDate: "2028-12-01", assetBacking: "Real estate portfolio", status: "matured", shariaAdvisor: "Lotus Capital", rating: "BBB" },
];

const takafulPolicies: TakafulPolicy[] = [
  { id: "TKF-001", policyType: "family_takaful", participant: "Alhaji Ibrahim Musa", contribution: 500000, currency: "NGN", coverageAmount: 25000000, surplusShare: 60, tabarruFund: 200000, status: "active" },
  { id: "TKF-002", policyType: "general_takaful", participant: "Dangote Cement Plc", contribution: 5000000, currency: "NGN", coverageAmount: 500000000, surplusShare: 50, tabarruFund: 2000000, status: "active" },
  { id: "TKF-003", policyType: "health_takaful", participant: "JAIZ Bank Staff", contribution: 250000, currency: "NGN", coverageAmount: 10000000, surplusShare: 40, tabarruFund: 100000, status: "active" },
  { id: "TKF-004", policyType: "motor_takaful", participant: "Hajiya Fatima Bello", contribution: 150000, currency: "NGN", coverageAmount: 15000000, surplusShare: 55, tabarruFund: 60000, status: "claims_pending" },
];

const wakalaInvestments: WakalaInvestment[] = [
  { id: "WKL-001", investor: "Alhaji Abdullahi Ganduje", agent: "JAIZ Bank", principal: 100000000, currency: "NGN", wakalaFee: 2.5, expectedReturn: 12.0, actualReturn: 11.5, status: "active", maturityDate: "2027-01-15" },
  { id: "WKL-002", investor: "Lotus Capital Fund", agent: "TAJ Bank", principal: 500000000, currency: "NGN", wakalaFee: 1.75, expectedReturn: 15.0, actualReturn: 14.2, status: "active", maturityDate: "2026-12-01" },
  { id: "WKL-003", investor: "Crescent University Endowment", agent: "Sterling Bank Islamic", principal: 50000000, currency: "NGN", wakalaFee: 2.0, expectedReturn: 10.0, actualReturn: 0, status: "pending", maturityDate: "2028-06-01" },
];

const shariaProhibited = ["alcohol", "gambling", "pork", "tobacco", "weapons", "conventional_interest", "speculation"];

export function registerIslamicBankingExpansion(app: Express) {
  app.get("/api/platform/islamic/sukuk", (_: Request, res: Response) => {
    res.json({ items: sukukBonds, total: sukukBonds.length });
  });

  app.get("/api/platform/islamic/sukuk/stats", (_: Request, res: Response) => {
    const totalFaceValue = sukukBonds.reduce((s, b) => s + b.faceValue, 0);
    const activeBonds = sukukBonds.filter(b => b.status === "active").length;
    const avgCoupon = sukukBonds.reduce((s, b) => s + b.couponRate, 0) / sukukBonds.length;
    res.json({ total_sukuk: sukukBonds.length, active: activeBonds, total_face_value: totalFaceValue, avg_coupon_rate: Math.round(avgCoupon * 100) / 100 });
  });

  app.get("/api/platform/islamic/takaful", (_: Request, res: Response) => {
    res.json({ items: takafulPolicies, total: takafulPolicies.length });
  });

  app.get("/api/platform/islamic/takaful/stats", (_: Request, res: Response) => {
    const totalContributions = takafulPolicies.reduce((s, p) => s + p.contribution, 0);
    const totalTabarru = takafulPolicies.reduce((s, p) => s + p.tabarruFund, 0);
    res.json({ total_policies: takafulPolicies.length, total_contributions: totalContributions, total_tabarru_fund: totalTabarru });
  });

  app.get("/api/platform/islamic/wakala", (_: Request, res: Response) => {
    res.json({ items: wakalaInvestments, total: wakalaInvestments.length });
  });

  app.post("/api/platform/islamic/sharia-screen", (req: Request, res: Response) => {
    const { transactionId, description, amount, counterparty } = req.body || {};
    const desc = (description || "").toLowerCase();
    const cp = (counterparty || "").toLowerCase();
    const violations: string[] = [];
    for (const item of shariaProhibited) {
      if (desc.includes(item) || cp.includes(item)) violations.push(`Prohibited activity: ${item}`);
    }
    if (amount && amount > 0 && desc.includes("interest")) violations.push("Riba (interest) detected");
    const result: ShariaScreenResult = {
      transactionId: transactionId || "TXN-UNKNOWN",
      compliant: violations.length === 0,
      violations,
      screenedBy: "54Bank Sharia Compliance Engine v1.0",
      timestamp: new Date().toISOString(),
    };
    res.json(result);
  });
}
