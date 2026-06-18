// B8: KYC/AML Enhancement — Continuous monitoring, risk-based CDD/EDD, SAR filing, PEP database
import type { Express, Request, Response } from "express";

interface WatchlistEntry { id: string; name: string; type: string; source: string; addedDate: string; riskLevel: string; }
interface SARReport { id: string; customerId: string; customerName: string; reason: string; amount: number; currency: string; filedDate: string; status: string; cbnReference: string; }
interface PEPRecord { id: string; name: string; position: string; category: string; jurisdiction: string; startDate: string; endDate: string | null; riskTier: string; }

const watchlist: WatchlistEntry[] = [
  { id: "WL-001", name: "Global Sanctions Entity A", type: "entity", source: "OFAC-SDN", addedDate: "2025-06-15", riskLevel: "critical" },
  { id: "WL-002", name: "Regional Risk Individual B", type: "individual", source: "UN-Security-Council", addedDate: "2025-03-20", riskLevel: "high" },
  { id: "WL-003", name: "Shell Company Network C", type: "entity", source: "FATF-Grey-List", addedDate: "2025-09-01", riskLevel: "high" },
  { id: "WL-004", name: "Domestic Alert Person D", type: "individual", source: "CBN-Internal", addedDate: "2026-01-10", riskLevel: "medium" },
  { id: "WL-005", name: "Cross-Border Entity E", type: "entity", source: "EU-Sanctions", addedDate: "2025-11-05", riskLevel: "critical" },
];

const sarReports: SARReport[] = [
  { id: "SAR-001", customerId: "CUS-1045", customerName: "Suspicious Transfers Ltd", reason: "Structured transactions below CTR threshold", amount: 4900000, currency: "NGN", filedDate: "2026-04-15", status: "filed", cbnReference: "CBN/SAR/2026/0451" },
  { id: "SAR-002", customerId: "CUS-2089", customerName: "John Doe", reason: "Rapid movement of funds through multiple accounts", amount: 25000000, currency: "NGN", filedDate: "2026-05-01", status: "under_review", cbnReference: "CBN/SAR/2026/0512" },
  { id: "SAR-003", customerId: "CUS-3021", customerName: "ABC Import Export", reason: "Trade-based money laundering indicators", amount: 150000000, currency: "NGN", filedDate: "2026-03-20", status: "escalated", cbnReference: "CBN/SAR/2026/0321" },
];

const pepDatabase: PEPRecord[] = [
  { id: "PEP-001", name: "Governor A. State", position: "State Governor", category: "domestic_pep", jurisdiction: "Nigeria", startDate: "2023-05-29", endDate: null, riskTier: "tier1" },
  { id: "PEP-002", name: "Senator B. National", position: "Senator", category: "domestic_pep", jurisdiction: "Nigeria", startDate: "2023-06-12", endDate: null, riskTier: "tier1" },
  { id: "PEP-003", name: "Ambassador C. Foreign", position: "Ambassador to Nigeria", category: "foreign_pep", jurisdiction: "International", startDate: "2022-01-15", endDate: null, riskTier: "tier2" },
  { id: "PEP-004", name: "Director D. Agency", position: "DG Federal Agency", category: "domestic_pep", jurisdiction: "Nigeria", startDate: "2024-08-01", endDate: null, riskTier: "tier1" },
  { id: "PEP-005", name: "Ex-Minister E. Past", position: "Former Minister", category: "domestic_pep", jurisdiction: "Nigeria", startDate: "2019-05-29", endDate: "2023-05-28", riskTier: "tier2" },
];

export function registerKYCAMLEnhancement(app: Express) {
  app.get("/api/platform/kyc/watchlist", (_: Request, res: Response) => {
    res.json({ items: watchlist, total: watchlist.length });
  });

  app.post("/api/platform/kyc/screen", (req: Request, res: Response) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const n = name.toLowerCase();
    const matches = watchlist.filter(w => w.name.toLowerCase().includes(n));
    const pepMatches = pepDatabase.filter(p => p.name.toLowerCase().includes(n));
    const riskLevel = matches.some(m => m.riskLevel === "critical") ? "critical" : matches.length > 0 ? "high" : pepMatches.length > 0 ? "elevated" : "low";
    res.json({ screened_name: name, watchlist_matches: matches.length, pep_matches: pepMatches.length, risk_level: riskLevel, action: riskLevel === "critical" ? "block" : riskLevel === "high" ? "edd_required" : riskLevel === "elevated" ? "enhanced_monitoring" : "proceed", matches: [...matches, ...pepMatches.map(p => ({ ...p, source: "PEP-Database" }))] });
  });

  app.get("/api/platform/kyc/sar-reports", (_: Request, res: Response) => {
    res.json({ items: sarReports, total: sarReports.length });
  });

  app.get("/api/platform/kyc/pep-database", (_: Request, res: Response) => {
    res.json({ items: pepDatabase, total: pepDatabase.length });
  });

  app.get("/api/platform/kyc/risk-dashboard", (_: Request, res: Response) => {
    res.json({
      total_watchlist: watchlist.length,
      critical_entries: watchlist.filter(w => w.riskLevel === "critical").length,
      active_sars: sarReports.filter(s => s.status !== "closed").length,
      pep_records: pepDatabase.length,
      active_peps: pepDatabase.filter(p => !p.endDate).length,
      last_sync: new Date().toISOString(),
    });
  });
}
