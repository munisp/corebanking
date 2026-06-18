// E4: Customer Self-Service Portal — Transaction history, card controls, dispute filing
import type { Express, Request, Response } from "express";

interface TransactionHistoryEntry { id: string; date: string; description: string; amount: number; currency: string; type: string; channel: string; balance: number; reference: string; }

const txnHistory: TransactionHistoryEntry[] = [
  { id: "TXN-001", date: "2026-05-09T14:30:00Z", description: "POS Purchase - ShopRite Ikeja", amount: -45000, currency: "NGN", type: "debit", channel: "pos", balance: 2955000, reference: "POS-20260509-001" },
  { id: "TXN-002", date: "2026-05-09T10:00:00Z", description: "Salary Credit - Dangote Industries", amount: 850000, currency: "NGN", type: "credit", channel: "nip", balance: 3000000, reference: "NIP-20260509-001" },
  { id: "TXN-003", date: "2026-05-08T16:45:00Z", description: "Transfer to Emeka Obi", amount: -150000, currency: "NGN", type: "debit", channel: "mobile", balance: 2150000, reference: "MOB-20260508-001" },
  { id: "TXN-004", date: "2026-05-08T09:15:00Z", description: "ATM Withdrawal - Access Bank ATM Lekki", amount: -50000, currency: "NGN", type: "debit", channel: "atm", balance: 2300000, reference: "ATM-20260508-001" },
  { id: "TXN-005", date: "2026-05-07T11:30:00Z", description: "Electricity Bill - IKEDC", amount: -25000, currency: "NGN", type: "debit", channel: "ussd", balance: 2350000, reference: "BIL-20260507-001" },
  { id: "TXN-006", date: "2026-05-06T08:00:00Z", description: "Standing Order - Rent Payment", amount: -500000, currency: "NGN", type: "debit", channel: "standing_order", balance: 2375000, reference: "SO-20260506-001" },
  { id: "TXN-007", date: "2026-05-05T13:20:00Z", description: "Inward Transfer - FX Conversion", amount: 1200000, currency: "NGN", type: "credit", channel: "swift", balance: 2875000, reference: "SWT-20260505-001" },
  { id: "TXN-008", date: "2026-05-04T15:45:00Z", description: "Online Purchase - Jumia Nigeria", amount: -35000, currency: "NGN", type: "debit", channel: "web", balance: 1675000, reference: "WEB-20260504-001" },
];

interface CardControl { cardId: string; cardNumber: string; cardType: string; internationalEnabled: boolean; onlineEnabled: boolean; contactlessEnabled: boolean; dailyLimit: number; posLimit: number; atmLimit: number; status: string; }

const cardControls: CardControl[] = [
  { cardId: "CARD-001", cardNumber: "****1234", cardType: "debit_mastercard", internationalEnabled: true, onlineEnabled: true, contactlessEnabled: true, dailyLimit: 1000000, posLimit: 500000, atmLimit: 200000, status: "active" },
  { cardId: "CARD-002", cardNumber: "****5678", cardType: "credit_visa", internationalEnabled: false, onlineEnabled: true, contactlessEnabled: false, dailyLimit: 2000000, posLimit: 1000000, atmLimit: 500000, status: "active" },
];

export function registerSelfServicePortal(app: Express) {
  app.get("/api/platform/self-service/transactions", (req: Request, res: Response) => {
    const { channel, type, startDate, endDate } = req.query;
    let filtered = [...txnHistory];
    if (channel) filtered = filtered.filter(t => t.channel === channel);
    if (type) filtered = filtered.filter(t => t.type === type);
    if (startDate) filtered = filtered.filter(t => t.date >= (startDate as string));
    if (endDate) filtered = filtered.filter(t => t.date <= (endDate as string));
    res.json({ items: filtered, total: filtered.length });
  });

  app.get("/api/platform/self-service/cards", (_: Request, res: Response) => {
    res.json({ items: cardControls, total: cardControls.length });
  });

  app.post("/api/platform/self-service/cards/:cardId/toggle", (req: Request, res: Response) => {
    const { cardId } = req.params;
    const { feature, enabled } = req.body || {};
    const card = cardControls.find(c => c.cardId === cardId);
    if (!card) return res.status(404).json({ error: "Card not found" });
    const validFeatures = ["internationalEnabled", "onlineEnabled", "contactlessEnabled"];
    if (!validFeatures.includes(feature)) return res.status(400).json({ error: `Invalid feature. Valid: ${validFeatures.join(", ")}` });
    (card as any)[feature] = enabled;
    res.json({ cardId, feature, enabled, updatedAt: new Date().toISOString() });
  });

  app.post("/api/platform/self-service/disputes/file", (req: Request, res: Response) => {
    const { transactionId, reason, description } = req.body || {};
    if (!transactionId || !reason) return res.status(400).json({ error: "transactionId and reason required" });
    const txn = txnHistory.find(t => t.id === transactionId);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });
    const dispute = {
      disputeId: `DSP-${Date.now()}`, transactionId, transactionAmount: txn.amount,
      reason, description: description || "", status: "filed",
      filedAt: new Date().toISOString(), expectedResolution: "14 business days (CBN mandate)",
    };
    res.json(dispute);
  });
}
