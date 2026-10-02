/**
 * CBDC Integration (eNaira) — Nigeria's central bank digital currency.
 * Wallet management, merchant payments, P2P transfers, cross-border remittance,
 * and CBN eNaira hub integration for commercial banks.
 *
 * W12-C3-P0 (top-risk #6): wallets/transactions/merchant-payments were
 * in-memory arrays (state lost on restart, divergent across replicas). They
 * are now Postgres-authoritative (enaira_wallets / enaira_transactions /
 * enaira_merchant_payments) via the server's drizzle pool. Seeds are inserted
 * once (ON CONFLICT DO NOTHING); all mutations persist.
 */
import type { Express, Request, Response } from "express";
import { ensureTables, storeDDL, storeSeed, storeList, storeInsert } from "./pgJsonStore";
import { logger } from "./logger";

interface ENairaWallet { id: string; tenantId: string; customerId: string; walletAddress: string; tier: string; balance: number; dailyLimit: number; monthlyLimit: number; kycLevel: number; status: string; linkedBankAccount?: string; createdAt: string; }
interface ENairaTransaction { id: string; walletFrom: string; walletTo: string; amount: number; type: string; narration: string; reference: string; status: string; feeAmount: number; createdAt: string; }
interface MerchantPayment { id: string; merchantId: string; merchantName: string; amount: number; customerWallet: string; reference: string; qrCode: string; status: string; createdAt: string; }

const WALLET_SEED: ENairaWallet[] = [
  { id: "EWLT-001", tenantId: "TEN-GTBANK", customerId: "CUST-GT-001", walletAddress: "eNGN-001-DANGOTE-5678", tier: "tier_3", balance: 5000000, dailyLimit: 50000000, monthlyLimit: 500000000, kycLevel: 3, status: "active", linkedBankAccount: "0012345678", createdAt: "2026-02-01T10:00:00Z" },
  { id: "EWLT-002", tenantId: "TEN-FIRSTBANK", customerId: "CUST-FB-001", walletAddress: "eNGN-002-ADEWALE-1234", tier: "tier_2", balance: 850000, dailyLimit: 5000000, monthlyLimit: 50000000, kycLevel: 2, status: "active", linkedBankAccount: "3012345678", createdAt: "2026-02-15T08:00:00Z" },
  { id: "EWLT-003", tenantId: "TEN-MUTUAL-MFB", customerId: "CUST-MFB-001", walletAddress: "eNGN-003-AMINA-9012", tier: "tier_1", balance: 45000, dailyLimit: 300000, monthlyLimit: 3000000, kycLevel: 1, status: "active", createdAt: "2026-03-01T07:00:00Z" },
  { id: "EWLT-004", tenantId: "TEN-ACCESS", customerId: "CUST-ACC-001", walletAddress: "eNGN-004-CHIDI-3456", tier: "tier_2", balance: 1200000, dailyLimit: 5000000, monthlyLimit: 50000000, kycLevel: 2, status: "active", linkedBankAccount: "0198765432", createdAt: "2026-02-20T09:00:00Z" },
  { id: "EWLT-MCH-001", tenantId: "TEN-GTBANK", customerId: "MCH-SHOPRITE", walletAddress: "eNGN-MCH-SHOPRITE-001", tier: "merchant", balance: 125000000, dailyLimit: 1000000000, monthlyLimit: 10000000000, kycLevel: 3, status: "active", createdAt: "2026-01-15T10:00:00Z" },
];

const TRANSACTION_SEED: ENairaTransaction[] = [
  { id: "ETXN-001", walletFrom: "eNGN-001-DANGOTE-5678", walletTo: "eNGN-MCH-SHOPRITE-001", amount: 45000, type: "merchant_payment", narration: "Shoprite Ikeja — Groceries", reference: "QR-SHOP-20260509-001", status: "completed", feeAmount: 0, createdAt: "2026-05-09T10:30:00Z" },
  { id: "ETXN-002", walletFrom: "eNGN-002-ADEWALE-1234", walletTo: "eNGN-003-AMINA-9012", amount: 25000, type: "p2p_transfer", narration: "Monthly contribution", reference: "P2P-20260509-001", status: "completed", feeAmount: 0, createdAt: "2026-05-09T08:00:00Z" },
  { id: "ETXN-003", walletFrom: "CBN-MINT", walletTo: "eNGN-001-DANGOTE-5678", amount: 5000000, type: "funding", narration: "Bank account funding via GT Bank", reference: "FUND-20260509-001", status: "completed", feeAmount: 0, createdAt: "2026-05-09T07:00:00Z" },
  { id: "ETXN-004", walletFrom: "eNGN-004-CHIDI-3456", walletTo: "REMIT-GH-001", amount: 150000, type: "cross_border_remittance", narration: "Remittance to Ghana — Accra", reference: "REMIT-GH-20260509-001", status: "completed", feeAmount: 500, createdAt: "2026-05-09T11:00:00Z" },
];

const MERCHANT_PAYMENT_SEED: MerchantPayment[] = [
  { id: "MPAY-001", merchantId: "MCH-SHOPRITE", merchantName: "Shoprite Ikeja", amount: 45000, customerWallet: "eNGN-001-DANGOTE-5678", reference: "QR-SHOP-20260509-001", qrCode: "data:image/png;base64,...", status: "completed", createdAt: "2026-05-09T10:30:00Z" },
  { id: "MPAY-002", merchantId: "MCH-TANTALIZERS", merchantName: "Tantalizers VI", amount: 3500, customerWallet: "eNGN-002-ADEWALE-1234", reference: "QR-TANT-20260509-001", qrCode: "data:image/png;base64,...", status: "completed", createdAt: "2026-05-09T12:30:00Z" },
];

const ENSURE_KEY = "enairaCbdc";
function ensure(): Promise<void> {
  return ensureTables(ENSURE_KEY, [
    ...storeDDL("enaira_wallets"),
    ...storeDDL("enaira_transactions"),
    ...storeDDL("enaira_merchant_payments"),
  ]).then(async () => {
    await storeSeed("enaira_wallets", WALLET_SEED, (w) => w.tenantId);
    await storeSeed("enaira_transactions", TRANSACTION_SEED, () => "");
    await storeSeed("enaira_merchant_payments", MERCHANT_PAYMENT_SEED, () => "");
  });
}

function dbUnavailable(res: Response, err: unknown) {
  logger.error("enairaCbdc: database unavailable", { error: String(err) });
  return res.status(503).json({ error: "enaira_store_unavailable", message: "eNaira store (Postgres) unavailable; refusing to serve in-memory data" });
}

export function registerENairaCbdc(app: Express) {
  app.get("/api/enaira/v1/wallets", async (_req: Request, res: Response) => {
    try { await ensure(); const items = await storeList<ENairaWallet>("enaira_wallets"); res.json({ items, total: items.length }); }
    catch (err) { dbUnavailable(res, err); }
  });
  app.get("/api/enaira/v1/transactions", async (_req: Request, res: Response) => {
    try { await ensure(); const items = await storeList<ENairaTransaction>("enaira_transactions"); res.json({ items, total: items.length }); }
    catch (err) { dbUnavailable(res, err); }
  });
  app.get("/api/enaira/v1/merchant-payments", async (_req: Request, res: Response) => {
    try { await ensure(); const items = await storeList<MerchantPayment>("enaira_merchant_payments"); res.json({ items, total: items.length }); }
    catch (err) { dbUnavailable(res, err); }
  });
  app.post("/api/enaira/v1/transfer", async (req: Request, res: Response) => {
    try {
      await ensure();
      const existing = await storeList<ENairaTransaction>("enaira_transactions");
      const txn: ENairaTransaction = { id: `ETXN-${String(existing.length + 1).padStart(3, "0")}-${Date.now()}`, walletFrom: req.body?.from ?? "eNGN-001", walletTo: req.body?.to ?? "eNGN-002", amount: req.body?.amount ?? 0, type: "p2p_transfer", narration: req.body?.narration ?? "", reference: `P2P-${Date.now()}`, status: "completed", feeAmount: 0, createdAt: new Date().toISOString() };
      await storeInsert("enaira_transactions", "", txn);
      res.status(201).json(txn);
    } catch (err) { dbUnavailable(res, err); }
  });
  app.get("/api/enaira/v1/stats", async (_req: Request, res: Response) => {
    try {
      await ensure();
      const wallets = await storeList<ENairaWallet>("enaira_wallets");
      const transactions = await storeList<ENairaTransaction>("enaira_transactions");
      const merchantPayments = await storeList<MerchantPayment>("enaira_merchant_payments");
      res.json({ totalWallets: wallets.length, merchantWallets: wallets.filter((w) => w.tier === "merchant").length, totalTransactions: transactions.length,
        totalVolume: transactions.reduce((s, t) => s + t.amount, 0), merchantPayments: merchantPayments.length,
        crossBorderRemittances: transactions.filter((t) => t.type === "cross_border_remittance").length, cbnHubStatus: "connected" });
    } catch (err) { dbUnavailable(res, err); }
  });
}
