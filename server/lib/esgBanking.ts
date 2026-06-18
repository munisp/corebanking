/**
 * Carbon Credit / ESG Banking — Green banking, sustainability-linked loans,
 * carbon offset tracking, ESG scoring, and climate risk assessment.
 */
import type { Express, Request, Response } from "express";

interface ESGScore { id: string; tenantId: string; entityId: string; entityName: string; environmentScore: number; socialScore: number; governanceScore: number; overallScore: number; rating: string; assessedAt: string; nextReviewAt: string; }
interface GreenLoan { id: string; tenantId: string; customerId: string; customerName: string; amount: number; purpose: string; category: string; interestRate: number; discountBps: number; carbonReductionTons: number; status: string; disbursedAt: string; }
interface CarbonCredit { id: string; projectName: string; projectLocation: string; creditType: string; vintageYear: number; tonsCo2: number; pricePerTon: number; totalValue: number; verifier: string; status: string; retiredAt?: string; }
interface ClimateRisk { id: string; tenantId: string; assetType: string; location: string; riskType: string; severity: string; financialExposure: number; mitigationPlan: string; lastAssessed: string; }

const ESG_SCORES: ESGScore[] = [
  { id: "ESG-001", tenantId: "TEN-GTBANK", entityId: "CUST-GT-001", entityName: "Dangote Industries", environmentScore: 72, socialScore: 85, governanceScore: 90, overallScore: 82, rating: "A", assessedAt: "2026-04-01T00:00:00Z", nextReviewAt: "2026-10-01T00:00:00Z" },
  { id: "ESG-002", tenantId: "TEN-GTBANK", entityId: "CUST-GT-002", entityName: "BUA Group", environmentScore: 68, socialScore: 78, governanceScore: 85, overallScore: 77, rating: "A-", assessedAt: "2026-04-01T00:00:00Z", nextReviewAt: "2026-10-01T00:00:00Z" },
  { id: "ESG-003", tenantId: "TEN-FIRSTBANK", entityId: "CUST-FB-CORP-001", entityName: "TotalEnergies Nigeria", environmentScore: 55, socialScore: 70, governanceScore: 82, overallScore: 69, rating: "B+", assessedAt: "2026-03-15T00:00:00Z", nextReviewAt: "2026-09-15T00:00:00Z" },
  { id: "ESG-004", tenantId: "TEN-ACCESS", entityId: "CUST-ACC-CORP-001", entityName: "Sahara Group", environmentScore: 60, socialScore: 75, governanceScore: 80, overallScore: 72, rating: "B+", assessedAt: "2026-04-15T00:00:00Z", nextReviewAt: "2026-10-15T00:00:00Z" },
];

const GREEN_LOANS: GreenLoan[] = [
  { id: "GL-001", tenantId: "TEN-GTBANK", customerId: "CUST-GT-SOLAR-001", customerName: "Arnergy Solar Limited", amount: 500000000, purpose: "Solar mini-grid deployment — 15 rural communities", category: "renewable_energy", interestRate: 12.5, discountBps: 200, carbonReductionTons: 8500, status: "active", disbursedAt: "2026-03-01T10:00:00Z" },
  { id: "GL-002", tenantId: "TEN-FIRSTBANK", customerId: "CUST-FB-GREEN-001", customerName: "Greenville LNG", amount: 2000000000, purpose: "CNG conversion stations — Lagos corridor", category: "clean_transport", interestRate: 13.0, discountBps: 150, carbonReductionTons: 25000, status: "active", disbursedAt: "2026-02-15T08:00:00Z" },
  { id: "GL-003", tenantId: "TEN-ACCESS", customerId: "CUST-ACC-GREEN-001", customerName: "Daystar Power", amount: 750000000, purpose: "Commercial rooftop solar — 50 industrial facilities", category: "renewable_energy", interestRate: 12.0, discountBps: 250, carbonReductionTons: 12000, status: "active", disbursedAt: "2026-04-01T09:00:00Z" },
  { id: "GL-004", tenantId: "TEN-WEMA", customerId: "CUST-WEMA-GREEN-001", customerName: "RecyclePoints Nigeria", amount: 100000000, purpose: "Plastic waste recycling — 10 collection centers", category: "waste_management", interestRate: 11.5, discountBps: 300, carbonReductionTons: 3500, status: "active", disbursedAt: "2026-04-15T10:00:00Z" },
];

const CARBON_CREDITS: CarbonCredit[] = [
  { id: "CC-001", projectName: "Jigawa Solar Farm", projectLocation: "Jigawa State, Nigeria", creditType: "VCS", vintageYear: 2026, tonsCo2: 15000, pricePerTon: 12.5, totalValue: 187500, verifier: "Verra", status: "active" },
  { id: "CC-002", projectName: "Cross River Forest REDD+", projectLocation: "Cross River State, Nigeria", creditType: "VCS_REDD+", vintageYear: 2025, tonsCo2: 50000, pricePerTon: 8.0, totalValue: 400000, verifier: "Verra", status: "active" },
  { id: "CC-003", projectName: "Lagos Cookstove Project", projectLocation: "Lagos State, Nigeria", creditType: "Gold_Standard", vintageYear: 2026, tonsCo2: 8000, pricePerTon: 15.0, totalValue: 120000, verifier: "Gold Standard", status: "retired", retiredAt: "2026-04-30T00:00:00Z" },
];

const CLIMATE_RISKS: ClimateRisk[] = [
  { id: "CR-001", tenantId: "TEN-GTBANK", assetType: "commercial_property", location: "Victoria Island, Lagos", riskType: "flood", severity: "high", financialExposure: 15000000000, mitigationPlan: "Flood insurance mandate, elevated construction standards", lastAssessed: "2026-03-01T00:00:00Z" },
  { id: "CR-002", tenantId: "TEN-FIRSTBANK", assetType: "agricultural_loan", location: "Borno State", riskType: "drought", severity: "medium", financialExposure: 2500000000, mitigationPlan: "Weather-indexed insurance, irrigation requirements", lastAssessed: "2026-03-15T00:00:00Z" },
  { id: "CR-003", tenantId: "TEN-ACCESS", assetType: "oil_gas_portfolio", location: "Niger Delta", riskType: "transition_risk", severity: "high", financialExposure: 45000000000, mitigationPlan: "Portfolio diversification roadmap — 30% green by 2028", lastAssessed: "2026-04-01T00:00:00Z" },
];

export function registerEsgBanking(app: Express) {
  app.get("/api/esg/v1/scores", (_req: Request, res: Response) => { res.json({ items: ESG_SCORES, total: ESG_SCORES.length }); });
  app.get("/api/esg/v1/green-loans", (_req: Request, res: Response) => { res.json({ items: GREEN_LOANS, total: GREEN_LOANS.length, totalDisbursed: GREEN_LOANS.reduce((s, l) => s + l.amount, 0) }); });
  app.get("/api/esg/v1/carbon-credits", (_req: Request, res: Response) => { res.json({ items: CARBON_CREDITS, total: CARBON_CREDITS.length, totalTons: CARBON_CREDITS.reduce((s, c) => s + c.tonsCo2, 0) }); });
  app.get("/api/esg/v1/climate-risks", (_req: Request, res: Response) => { res.json({ items: CLIMATE_RISKS, total: CLIMATE_RISKS.length }); });
  app.get("/api/esg/v1/stats", (_req: Request, res: Response) => {
    res.json({ esgScoresAssessed: ESG_SCORES.length, avgOverallScore: Math.round(ESG_SCORES.reduce((s, e) => s + e.overallScore, 0) / ESG_SCORES.length),
      greenLoans: GREEN_LOANS.length, greenLoanVolume: GREEN_LOANS.reduce((s, l) => s + l.amount, 0),
      carbonCredits: CARBON_CREDITS.length, totalCarbonOffsetTons: CARBON_CREDITS.reduce((s, c) => s + c.tonsCo2, 0),
      climateRisks: CLIMATE_RISKS.length, totalClimateExposure: CLIMATE_RISKS.reduce((s, r) => s + r.financialExposure, 0) });
  });
}
