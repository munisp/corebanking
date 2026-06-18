// B9: Card Management Enhancement — PIN, 3D Secure, Tokenization, Fraud Rules
import type { Express, Request, Response } from "express";

interface CardToken { id: string; cardId: string; tokenType: string; walletProvider: string; deviceId: string; status: string; createdAt: string; lastUsed: string; }
interface CardFraudRule { id: string; name: string; ruleType: string; threshold: number; action: string; enabled: boolean; triggeredCount: number; }

const cardTokens: CardToken[] = [
  { id: "TKN-001", cardId: "CARD-001", tokenType: "device", walletProvider: "apple_pay", deviceId: "iPhone15-A1B2C3", status: "active", createdAt: "2026-01-15", lastUsed: "2026-05-09" },
  { id: "TKN-002", cardId: "CARD-001", tokenType: "device", walletProvider: "google_pay", deviceId: "Pixel8-D4E5F6", status: "active", createdAt: "2026-02-20", lastUsed: "2026-05-08" },
  { id: "TKN-003", cardId: "CARD-003", tokenType: "ecommerce", walletProvider: "samsung_pay", deviceId: "GalaxyS24-G7H8I9", status: "suspended", createdAt: "2025-12-01", lastUsed: "2026-04-15" },
  { id: "TKN-004", cardId: "CARD-005", tokenType: "device", walletProvider: "apple_pay", deviceId: "AppleWatch-J0K1L2", status: "active", createdAt: "2026-03-10", lastUsed: "2026-05-09" },
];

const fraudRules: CardFraudRule[] = [
  { id: "FR-001", name: "Velocity Check", ruleType: "velocity", threshold: 5, action: "block_and_alert", enabled: true, triggeredCount: 234 },
  { id: "FR-002", name: "Geo-Fencing Nigeria", ruleType: "geolocation", threshold: 0, action: "require_otp", enabled: true, triggeredCount: 89 },
  { id: "FR-003", name: "High Value Transaction", ruleType: "amount", threshold: 500000, action: "require_otp", enabled: true, triggeredCount: 1567 },
  { id: "FR-004", name: "MCC Restriction - Gambling", ruleType: "merchant_category", threshold: 7995, action: "decline", enabled: true, triggeredCount: 42 },
  { id: "FR-005", name: "Night Transaction Alert", ruleType: "time_based", threshold: 23, action: "flag_for_review", enabled: true, triggeredCount: 312 },
  { id: "FR-006", name: "Cross-Border First Use", ruleType: "geolocation", threshold: 0, action: "sms_alert", enabled: true, triggeredCount: 678 },
];

export function registerCardManagementEnhancement(app: Express) {
  app.get("/api/platform/cards/tokens", (_: Request, res: Response) => {
    res.json({ items: cardTokens, total: cardTokens.length });
  });

  app.post("/api/platform/cards/3d-secure/enroll", (req: Request, res: Response) => {
    const { cardId, phoneNumber } = req.body || {};
    if (!cardId) return res.status(400).json({ error: "cardId required" });
    res.json({ cardId, enrolled: true, method: "otp_sms", phoneNumber: phoneNumber ? phoneNumber.replace(/.(?=.{4})/g, "*") : "****", enrolledAt: new Date().toISOString() });
  });

  app.post("/api/platform/cards/pin/change", (req: Request, res: Response) => {
    const { cardId, currentPin, newPin } = req.body || {};
    if (!cardId || !currentPin || !newPin) return res.status(400).json({ error: "cardId, currentPin, newPin required" });
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    if (newPin === currentPin) return res.status(400).json({ error: "New PIN must differ from current" });
    res.json({ cardId, pinChanged: true, timestamp: new Date().toISOString() });
  });

  app.get("/api/platform/cards/fraud-rules", (_: Request, res: Response) => {
    res.json({ items: fraudRules, total: fraudRules.length });
  });

  app.post("/api/platform/cards/fraud-rules/evaluate", (req: Request, res: Response) => {
    const { amount, merchantCategory, country, hour } = req.body || {};
    const triggered: string[] = [];
    for (const rule of fraudRules) {
      if (!rule.enabled) continue;
      if (rule.ruleType === "amount" && amount > rule.threshold) triggered.push(rule.name);
      if (rule.ruleType === "merchant_category" && merchantCategory === rule.threshold) triggered.push(rule.name);
      if (rule.ruleType === "geolocation" && country && country !== "NG") triggered.push(rule.name);
      if (rule.ruleType === "time_based" && hour >= rule.threshold) triggered.push(rule.name);
    }
    const action = triggered.length === 0 ? "approve" : triggered.some(t => t.includes("Velocity") || t.includes("Gambling")) ? "decline" : "require_otp";
    res.json({ triggered_rules: triggered, action, risk_score: Math.min(triggered.length * 25, 100) });
  });
}
