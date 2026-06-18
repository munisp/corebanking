/**
 * Inter-bank settlement engine — NIBSS clearing, net settlement positions,
 * settlement window management, and dispute tracking.
 */

export interface SettlementBatch {
  id: string;
  type: "nip" | "neft" | "rtgs" | "card_switch" | "direct_debit" | "cheque_clearing";
  settlementDate: string;
  window: string;
  totalInbound: number;
  totalOutbound: number;
  netPosition: number;
  positionType: "long" | "short" | "square";
  transactionCount: number;
  currency: string;
  status: "pending" | "settled" | "disputed" | "failed";
  counterparties: number;
  settledAt?: string;
}

const batches: SettlementBatch[] = [
  { id: "SB-001", type: "nip", settlementDate: "2026-05-09", window: "09:00-12:00", totalInbound: 12_500_000_000, totalOutbound: 11_800_000_000, netPosition: 700_000_000, positionType: "long", transactionCount: 45_230, currency: "NGN", status: "settled", counterparties: 22, settledAt: "2026-05-09T12:30:00Z" },
  { id: "SB-002", type: "nip", settlementDate: "2026-05-09", window: "12:00-15:00", totalInbound: 8_200_000_000, totalOutbound: 9_100_000_000, netPosition: -900_000_000, positionType: "short", transactionCount: 32_150, currency: "NGN", status: "settled", counterparties: 20, settledAt: "2026-05-09T15:30:00Z" },
  { id: "SB-003", type: "neft", settlementDate: "2026-05-09", window: "T+1", totalInbound: 3_400_000_000, totalOutbound: 2_800_000_000, netPosition: 600_000_000, positionType: "long", transactionCount: 8_420, currency: "NGN", status: "settled", counterparties: 18, settledAt: "2026-05-09T16:00:00Z" },
  { id: "SB-004", type: "rtgs", settlementDate: "2026-05-09", window: "Real-time", totalInbound: 25_000_000_000, totalOutbound: 22_000_000_000, netPosition: 3_000_000_000, positionType: "long", transactionCount: 156, currency: "NGN", status: "settled", counterparties: 12, settledAt: "2026-05-09T14:00:00Z" },
  { id: "SB-005", type: "card_switch", settlementDate: "2026-05-09", window: "EOD", totalInbound: 4_100_000_000, totalOutbound: 3_800_000_000, netPosition: 300_000_000, positionType: "long", transactionCount: 125_000, currency: "NGN", status: "pending", counterparties: 15 },
  { id: "SB-006", type: "cheque_clearing", settlementDate: "2026-05-09", window: "T+2", totalInbound: 1_200_000_000, totalOutbound: 980_000_000, netPosition: 220_000_000, positionType: "long", transactionCount: 3_200, currency: "NGN", status: "pending", counterparties: 16 },
  { id: "SB-007", type: "direct_debit", settlementDate: "2026-05-09", window: "T+1", totalInbound: 890_000_000, totalOutbound: 1_050_000_000, netPosition: -160_000_000, positionType: "short", transactionCount: 12_500, currency: "NGN", status: "settled", counterparties: 8, settledAt: "2026-05-09T15:45:00Z" },
];

export function getSettlementBatches() { return batches; }

export function getSettlementSummary() {
  let totalInbound = 0;
  let totalOutbound = 0;
  let settledCount = 0;
  const byType: Record<string, { net: number; count: number }> = {};
  for (const b of batches) {
    totalInbound += b.totalInbound;
    totalOutbound += b.totalOutbound;
    if (b.status === "settled") settledCount++;
    if (!byType[b.type]) byType[b.type] = { net: 0, count: 0 };
    byType[b.type].net += b.netPosition;
    byType[b.type].count += b.transactionCount;
  }
  return { totalBatches: batches.length, totalInbound, totalOutbound, netPosition: totalInbound - totalOutbound, settledCount, pendingCount: batches.length - settledCount, byType };
}
