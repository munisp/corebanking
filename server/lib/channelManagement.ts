/**
 * Channel management — mobile, internet, USSD, ATM, POS, branch, agent banking.
 * Real-time status monitoring, uptime tracking, transaction volumes.
 */

export interface Channel {
  id: string;
  name: string;
  type: "mobile_app" | "internet_banking" | "ussd" | "atm" | "pos" | "branch" | "agent" | "api";
  status: "online" | "degraded" | "offline" | "maintenance";
  uptime30d: number;
  currentTPS: number;
  peakTPS: number;
  dailyTransactions: number;
  dailyVolume: number;
  activeUsers: number;
  lastIncident?: string;
  version?: string;
  endpoints: number;
}

const channels: Channel[] = [
  { id: "CH-001", name: "Mobile Banking App", type: "mobile_app", status: "online", uptime30d: 99.92, currentTPS: 245, peakTPS: 1_200, dailyTransactions: 850_000, dailyVolume: 42_500_000_000, activeUsers: 2_100_000, version: "4.2.1", endpoints: 48 },
  { id: "CH-002", name: "Internet Banking Portal", type: "internet_banking", status: "online", uptime30d: 99.85, currentTPS: 120, peakTPS: 600, dailyTransactions: 320_000, dailyVolume: 68_000_000_000, activeUsers: 450_000, version: "3.8.0", endpoints: 35 },
  { id: "CH-003", name: "USSD (*901#)", type: "ussd", status: "online", uptime30d: 99.97, currentTPS: 380, peakTPS: 2_000, dailyTransactions: 1_200_000, dailyVolume: 18_000_000_000, activeUsers: 5_800_000, endpoints: 12 },
  { id: "CH-004", name: "ATM Network", type: "atm", status: "degraded", uptime30d: 98.45, currentTPS: 85, peakTPS: 400, dailyTransactions: 280_000, dailyVolume: 8_400_000_000, activeUsers: 1_800_000, lastIncident: "2026-05-09T10:30:00Z — 12 ATMs offline in Lagos zone", endpoints: 6 },
  { id: "CH-005", name: "POS Terminal Network", type: "pos", status: "online", uptime30d: 99.60, currentTPS: 450, peakTPS: 1_800, dailyTransactions: 950_000, dailyVolume: 15_200_000_000, activeUsers: 85_000, endpoints: 8 },
  { id: "CH-006", name: "Branch Network", type: "branch", status: "online", uptime30d: 99.99, currentTPS: 30, peakTPS: 150, dailyTransactions: 45_000, dailyVolume: 25_000_000_000, activeUsers: 350, endpoints: 22 },
  { id: "CH-007", name: "Agent Banking Network", type: "agent", status: "online", uptime30d: 99.40, currentTPS: 95, peakTPS: 500, dailyTransactions: 420_000, dailyVolume: 6_300_000_000, activeUsers: 12_500, endpoints: 15 },
  { id: "CH-008", name: "Open Banking API", type: "api", status: "online", uptime30d: 99.98, currentTPS: 550, peakTPS: 3_000, dailyTransactions: 2_200_000, dailyVolume: 35_000_000_000, activeUsers: 180, version: "2.1.0", endpoints: 62 },
];

export function getChannels() { return channels; }

export function getChannelSummary() {
  let totalDailyTxn = 0;
  let totalDailyVol = 0;
  let totalActiveUsers = 0;
  const byStatus: Record<string, number> = {};
  for (const ch of channels) {
    totalDailyTxn += ch.dailyTransactions;
    totalDailyVol += ch.dailyVolume;
    totalActiveUsers += ch.activeUsers;
    byStatus[ch.status] = (byStatus[ch.status] || 0) + 1;
  }
  const avgUptime = Math.round((channels.reduce((s, c) => s + c.uptime30d, 0) / channels.length) * 100) / 100;
  return { totalChannels: channels.length, totalDailyTransactions: totalDailyTxn, totalDailyVolume: totalDailyVol, totalActiveUsers, avgUptime30d: avgUptime, byStatus };
}
