// B7: Agent Banking Intelligence — Float optimization, scoring, geo-mapping, commission reconciliation
import type { Express, Request, Response } from "express";

interface AgentPerformance {
  agentId: string; name: string; tier: string; location: { state: string; lga: string; lat: number; lng: number };
  monthlyTxnVolume: number; monthlyTxnValue: number; avgDailyFloat: number;
  commissionEarned: number; customerCount: number; uptimePercent: number;
  score: number; nextTierThreshold: number;
}

const agents: AgentPerformance[] = [
  { agentId: "AGT-001", name: "Mama Nkechi POS Center", tier: "super_agent", location: { state: "Lagos", lga: "Ikeja", lat: 6.6018, lng: 3.3515 }, monthlyTxnVolume: 15000, monthlyTxnValue: 250000000, avgDailyFloat: 5000000, commissionEarned: 1250000, customerCount: 3200, uptimePercent: 98.5, score: 92, nextTierThreshold: 95 },
  { agentId: "AGT-002", name: "Alhaji Garba Mobile Money", tier: "master_agent", location: { state: "Kano", lga: "Nassarawa", lat: 12.0022, lng: 8.5920 }, monthlyTxnVolume: 25000, monthlyTxnValue: 500000000, avgDailyFloat: 10000000, commissionEarned: 2500000, customerCount: 8500, uptimePercent: 99.2, score: 97, nextTierThreshold: 100 },
  { agentId: "AGT-003", name: "Chioma Digital Hub", tier: "agent", location: { state: "Enugu", lga: "Nsukka", lat: 6.8568, lng: 7.3951 }, monthlyTxnVolume: 5000, monthlyTxnValue: 50000000, avgDailyFloat: 1000000, commissionEarned: 250000, customerCount: 800, uptimePercent: 95.0, score: 75, nextTierThreshold: 80 },
  { agentId: "AGT-004", name: "Baba Alaye Pay Point", tier: "agent", location: { state: "Oyo", lga: "Ibadan North", lat: 7.3964, lng: 3.9170 }, monthlyTxnVolume: 8000, monthlyTxnValue: 80000000, avgDailyFloat: 2000000, commissionEarned: 400000, customerCount: 1500, uptimePercent: 96.3, score: 82, nextTierThreshold: 85 },
  { agentId: "AGT-005", name: "Port Harcourt Express Agent", tier: "super_agent", location: { state: "Rivers", lga: "Port Harcourt", lat: 4.8156, lng: 7.0498 }, monthlyTxnVolume: 12000, monthlyTxnValue: 180000000, avgDailyFloat: 4000000, commissionEarned: 900000, customerCount: 2100, uptimePercent: 97.8, score: 88, nextTierThreshold: 90 },
  { agentId: "AGT-006", name: "Abuja Central Agency", tier: "master_agent", location: { state: "FCT", lga: "Municipal", lat: 9.0579, lng: 7.4951 }, monthlyTxnVolume: 30000, monthlyTxnValue: 750000000, avgDailyFloat: 15000000, commissionEarned: 3750000, customerCount: 12000, uptimePercent: 99.5, score: 99, nextTierThreshold: 100 },
];

export function registerAgentBankingIntelligence(app: Express) {
  app.get("/api/platform/agents/performance", (_: Request, res: Response) => {
    res.json({ items: agents, total: agents.length });
  });

  app.get("/api/platform/agents/float-optimization", (_: Request, res: Response) => {
    const recommendations = agents.map(a => ({
      agentId: a.agentId, name: a.name,
      currentFloat: a.avgDailyFloat,
      recommendedFloat: Math.round(a.monthlyTxnValue / 30 * 0.15),
      floatUtilization: Math.round((a.monthlyTxnValue / 30 / a.avgDailyFloat) * 100) / 100,
      replenishmentFrequency: a.avgDailyFloat < 2000000 ? "daily" : "weekly",
    }));
    res.json({ items: recommendations, total: recommendations.length });
  });

  app.get("/api/platform/agents/geo-coverage", (_: Request, res: Response) => {
    const stateMap: Record<string, number> = {};
    agents.forEach(a => { stateMap[a.location.state] = (stateMap[a.location.state] || 0) + 1; });
    const coveredStates = Object.keys(stateMap).length;
    const totalNigerianStates = 37; // 36 + FCT
    const gaps = ["Adamawa", "Bauchi", "Benue", "Borno", "Cross River", "Delta", "Edo", "Ekiti",
      "Gombe", "Imo", "Jigawa", "Kaduna", "Katsina", "Kebbi", "Kogi", "Kwara",
      "Nasarawa", "Niger", "Ondo", "Osun", "Plateau", "Sokoto", "Taraba",
      "Yobe", "Zamfara", "Abia", "Akwa Ibom", "Anambra", "Bayelsa", "Ebonyi"].filter(s => !stateMap[s]);
    res.json({
      covered_states: coveredStates, total_states: totalNigerianStates,
      coverage_percent: Math.round(coveredStates / totalNigerianStates * 100),
      gap_states: gaps.slice(0, 10),
      heatmap: agents.map(a => ({ lat: a.location.lat, lng: a.location.lng, weight: a.monthlyTxnVolume })),
    });
  });

  app.get("/api/platform/agents/commission-summary", (_: Request, res: Response) => {
    const total = agents.reduce((s, a) => s + a.commissionEarned, 0);
    const byTier: Record<string, number> = {};
    agents.forEach(a => { byTier[a.tier] = (byTier[a.tier] || 0) + a.commissionEarned; });
    res.json({ total_commission: total, by_tier: byTier, agent_count: agents.length, avg_per_agent: Math.round(total / agents.length) });
  });
}
