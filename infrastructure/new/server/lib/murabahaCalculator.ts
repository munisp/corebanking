// Murabaha Profit Rate Calculator — Islamic finance cost-plus financing computation engine
//
// W12-C3-P2-MLIB (c3-1023): the murabaha quote store was module process
// memory (lost on restart, divergent across replicas). Now Postgres-authoritative
// (table `murabaha_quotes`) via lib/pgJsonStore.ts; fail-closed 503 on PG outage,
// no degraded-memory fallback.
import type { Express, Request, Response } from "express";
import { ensureTables, storeDDL, storeList, storeSeed } from "./pgJsonStore";
import { asyncRoute, pgGuard } from "./pgSupport";

const TABLE = "murabaha_quotes";

async function loadQuotes(): Promise<MurabahaQuote[]> {
  return pgGuard((async () => {
    await ensureTables("murabahaCalculator", storeDDL(TABLE));
    await storeSeed(TABLE, QUOTES_SEED, () => "");
    return storeList<MurabahaQuote>(TABLE);
  })());
}

interface MurabahaQuote {
  id: string;
  customerId: string;
  assetDescription: string;
  costPrice: number;
  profitMargin: number;
  sellingPrice: number;
  tenorMonths: number;
  monthlyInstallment: number;
  totalProfit: number;
  annualizedRate: number;
  downPayment: number;
  financedAmount: number;
  currency: string;
  status: string;
  createdAt: string;
}

// Seed rows (same data the in-memory build shipped; Postgres owns it after first seed).
const QUOTES_SEED: MurabahaQuote[] = [
  {
    id: "MRB-001", customerId: "CUST-001", assetDescription: "Toyota Hilux 2026 Model",
    costPrice: 45000000, profitMargin: 15.0, sellingPrice: 51750000,
    tenorMonths: 48, monthlyInstallment: 1078125, totalProfit: 6750000,
    annualizedRate: 3.75, downPayment: 9000000, financedAmount: 42750000,
    currency: "NGN", status: "approved", createdAt: "2026-05-01T10:00:00Z"
  },
  {
    id: "MRB-002", customerId: "CUST-002", assetDescription: "3-Bedroom Apartment Lekki Phase 1",
    costPrice: 120000000, profitMargin: 12.0, sellingPrice: 134400000,
    tenorMonths: 180, monthlyInstallment: 746667, totalProfit: 14400000,
    annualizedRate: 0.8, downPayment: 24000000, financedAmount: 110400000,
    currency: "NGN", status: "pending_approval", createdAt: "2026-05-03T14:30:00Z"
  },
  {
    id: "MRB-003", customerId: "CUST-003", assetDescription: "Commercial Cold Room Equipment",
    costPrice: 8500000, profitMargin: 18.0, sellingPrice: 10030000,
    tenorMonths: 24, monthlyInstallment: 417917, totalProfit: 1530000,
    annualizedRate: 9.0, downPayment: 1700000, financedAmount: 8330000,
    currency: "NGN", status: "disbursed", createdAt: "2026-04-15T09:00:00Z"
  },
  {
    id: "MRB-004", customerId: "CUST-004", assetDescription: "Medical Imaging Equipment",
    costPrice: 250000, profitMargin: 10.0, sellingPrice: 275000,
    tenorMonths: 36, monthlyInstallment: 7639, totalProfit: 25000,
    annualizedRate: 3.33, downPayment: 50000, financedAmount: 225000,
    currency: "USD", status: "completed", createdAt: "2025-12-01T08:00:00Z"
  },
];

async function calculateMurabaha(costPrice: number, profitMarginPct: number, tenorMonths: number, downPaymentPct: number = 20): Promise<MurabahaQuote> {
  const quotes = await loadQuotes();
  const downPayment = Math.round(costPrice * (downPaymentPct / 100));
  const financedAmount = costPrice - downPayment;
  const totalProfit = Math.round(financedAmount * (profitMarginPct / 100));
  const sellingPrice = financedAmount + totalProfit;
  const monthlyInstallment = Math.round(sellingPrice / tenorMonths);
  const annualizedRate = Math.round((profitMarginPct / (tenorMonths / 12)) * 100) / 100;

  return {
    id: `MRB-${String(quotes.length + 1).padStart(3, "0")}`,
    customerId: "", assetDescription: "", costPrice, profitMargin: profitMarginPct,
    sellingPrice: costPrice + totalProfit, tenorMonths, monthlyInstallment,
    totalProfit, annualizedRate, downPayment, financedAmount,
    currency: "NGN", status: "draft", createdAt: new Date().toISOString(),
  };
}

async function comparativeAnalysis(costPrice: number, tenorMonths: number) {
  const margins = [8, 10, 12, 15, 18, 20, 25];
  const out = [];
  for (const margin of margins) {
    const q = await calculateMurabaha(costPrice, margin, tenorMonths);
    out.push({
      profitMargin: margin,
      totalProfit: q.totalProfit,
      monthlyInstallment: q.monthlyInstallment,
      annualizedRate: q.annualizedRate,
      sellingPrice: q.sellingPrice,
    });
  }
  return out;
}

export function registerMurabahaCalculatorRoutes(app: Express): void {
  app.get("/api/platform/islamic/murabaha/quotes", asyncRoute(async (_req: Request, res: Response) => {
    const quotes = await loadQuotes();
    res.json({ items: quotes, total: quotes.length });
  }));

  app.post("/api/platform/islamic/murabaha/calculate", asyncRoute(async (req: Request, res: Response) => {
    const { costPrice, profitMarginPct, tenorMonths, downPaymentPct } = req.body;
    if (!costPrice || !profitMarginPct || !tenorMonths) {
      return res.status(400).json({ error: "costPrice, profitMarginPct, and tenorMonths are required" });
    }
    if (costPrice <= 0 || profitMarginPct <= 0 || tenorMonths <= 0) {
      return res.status(400).json({ error: "All values must be positive" });
    }
    if (profitMarginPct > 50) {
      return res.status(400).json({ error: "Profit margin exceeds Sharia-compliant threshold (max 50%)" });
    }
    const quote = await calculateMurabaha(costPrice, profitMarginPct, tenorMonths, downPaymentPct || 20);
    res.json(quote);
  }));

  app.post("/api/platform/islamic/murabaha/comparative", asyncRoute(async (req: Request, res: Response) => {
    const { costPrice, tenorMonths } = req.body;
    if (!costPrice || !tenorMonths) {
      return res.status(400).json({ error: "costPrice and tenorMonths are required" });
    }
    res.json({ analysis: await comparativeAnalysis(costPrice, tenorMonths), costPrice, tenorMonths });
  }));

  app.get("/api/platform/islamic/murabaha/quotes/:id", asyncRoute(async (req: Request, res: Response) => {
    const quotes = await loadQuotes();
    const quote = quotes.find(q => q.id === req.params.id);
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json(quote);
  }));
}
